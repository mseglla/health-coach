# Model de dades de Supabase

## Criteris generals

- PostgreSQL gestionat per Supabase.
- Totes les taules d’usuari inclouen `user_id uuid not null`, excepte `profiles`, on l’`id` coincideix amb l’usuari autenticat.
- Claus primàries UUID generades al client o al servidor.
- Camps comuns: `created_at`, `updated_at`, `deleted_at` quan aplica.
- RLS activada des del primer dia.
- Cap taula funcional es crea directament en producció sense migració SQL versionada.
- Arquitectura online-first: Supabase és la font de veritat dels registres de salut.
- `IndexedDB` i `localStorage` no actuen com a font autoritativa ni mantenen cues generals de mutacions offline.

## Taules

### profiles

Una fila per usuari.

- `id uuid primary key references auth.users(id)`
- `display_name text`
- `birth_date date null`
- `height_cm numeric null`
- `metabolic_sex text null`
- `timezone text not null default 'Europe/Madrid'`
- `created_at timestamptz`
- `updated_at timestamptz`

### goals

Permet conservar historial d’objectius i representar objectius de
diferents dominis amb un contracte comú.

- `id uuid primary key`
- `user_id uuid not null`
- `goal_type text not null`
- `title text not null`
- `target_value numeric not null`
- `target_unit text not null`
- `target_date date null`
- `metadata jsonb not null default '{}'`
- `is_primary boolean not null default false`
- `is_active boolean not null default true`
- `start_weight_kg numeric null` — compatibilitat i context per objectius de pes
- `target_weight_kg numeric null` — compatibilitat específica de pes
- `weekly_goal_kg numeric null`
- timestamps comuns i soft delete

ATLES pot mantenir diversos objectius actius, però només un objectiu
actiu pot ser el principal de cada usuari.


### body_measurements

Registra mesures corporals genèriques independents del pes.

- `id uuid primary key`
- `user_id uuid not null`
- `measurement_type text not null`
- `value numeric not null`
- `unit text not null`
- `measured_at timestamptz not null`
- `source text not null default 'manual'`
- timestamps comuns i soft delete

La primera mesura visible a ATLES és `waist`, expressada en `cm`. El model permet afegir en el futur altres mesures, com composició corporal o perímetres, sense crear una taula específica per cadascuna.

### weight_logs

Registre de pes. Supabase és la font de veritat.

- `id uuid primary key`
- `user_id uuid not null`
- `value_kg numeric not null`
- `measured_at timestamptz not null`
- `source text not null default 'manual'`
- timestamps comuns
- soft delete mitjançant `deleted_at`

### daily_summaries

Resum diari introduït o consolidat per ATLES. No s’utilitza com a contenidor genèric de dades automàtiques de HealthKit.

Una fila per usuari i dia.

- `id uuid primary key`
- `user_id uuid not null`
- `summary_date date not null`
- `total_kcal integer null`
- `active_kcal integer null`
- `intake_kcal integer null`
- `steps integer null`
- `source text not null default 'manual'`
- timestamps comuns
- unique: `(user_id, summary_date)`

### health_daily_metrics

Mètriques diàries automàtiques importades de fonts de salut, creada inicialment per al pilot HealthKit.

Separar aquesta taula de `daily_summaries` evita barrejar el resum manual d’ATLES amb l’origen automàtic de HealthKit.

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id)`
- `metric_date date not null`
- `metric_type text not null`
- `value numeric not null`
- `unit text not null`
- `source text not null default 'healthkit'`
- `source_bundle_id text null`
- `source_device text null`
- `timezone text null`
- `metadata jsonb not null default '{}'`
- `imported_at timestamptz not null default now()`
- `created_at timestamptz`
- `updated_at timestamptz`
- `deleted_at timestamptz null`

Tipus admesos en el pilot:

- `steps`
- `active_kcal`
- `total_kcal`

Identitat lògica i deduplicació:

```text
(user_id, metric_date, metric_type, source)
```

Aquesta restricció permet `upsert` estàndard de Supabase i fa que una reimportació actualitzi la mètrica existent en lloc de crear-ne una còpia.

### activity_logs

Activitats manuals i entrenaments importats. La mateixa taula permet conservar l’origen de cada registre.

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id)`
- `activity_type text not null`
- `started_at timestamptz not null`
- `ended_at timestamptz null`
- `duration_minutes numeric null`
- `active_calories numeric null`
- `distance_meters numeric null`
- `steps integer null`
- `notes text null`
- `source text not null default 'manual'`
- `external_id text null`
- `source_bundle_id text null`
- `source_device text null`
- `timezone text null`
- `metadata jsonb not null default '{}'`
- `imported_at timestamptz null`
- `created_at timestamptz`
- `updated_at timestamptz`
- `deleted_at timestamptz null`

Identitat lògica dels entrenaments importats:

```text
(user_id, source, external_id)
```

`external_id` pot ser `null` per a activitats manuals. PostgreSQL permet múltiples files amb `null` dins una restricció `UNIQUE`, de manera que aquesta identitat no impedeix crear múltiples activitats manuals.

### sync_operations

No forma part del model servidor actual. Les cues generals de sincronització offline s’han descartat amb l’arquitectura online-first. Només es reconsideraria una taula de diagnòstic si apareix una necessitat concreta.

## RLS mínima

Patró per totes les taules amb `user_id`:

```sql
using (auth.uid() = user_id)
with check (auth.uid() = user_id)
```

Per `profiles`:

```sql
using (auth.uid() = id)
with check (auth.uid() = id)
```

`health_daily_metrics` i `activity_logs` tenen `SELECT`, `INSERT` i `UPDATE` concedits al rol `authenticated`, amb polítiques que limiten les files a `auth.uid() = user_id`. El rol `anon` no té accés a aquestes taules.

La validació remota s’ha fet amb dos usuaris reals i ha comprovat:

- lectura pròpia correcta;
- impossibilitat de llegir files de l’altre usuari;
- impossibilitat d’inserir una fila fent-se passar per un altre `user_id`;
- `upsert` sense duplicació per les identitats definides.

## Índexs mínims

- `weight_logs(user_id, measured_at desc)`
- `daily_summaries(user_id, summary_date desc)`
- `health_daily_metrics(user_id, metric_date desc)` per files no eliminades
- `activity_logs(user_id, started_at desc)` per files no eliminades

## HealthKit — contracte de persistència del pilot

Flux previst:

```text
Apple Watch → Apple Health / HealthKit → connector iOS → Supabase → ATLES
```

La PWA no accedeix directament a HealthKit. El connector iOS és responsable de llegir HealthKit, normalitzar les dades i enviar-les a Supabase amb la identitat de l’usuari autenticat.

En el pilot:

- els agregats diaris es desen a `health_daily_metrics`;
- els entrenaments es desen a `activity_logs`;
- no es desen mostres crues de HealthKit;
- `source`, identificadors externs, dispositiu i metadades permeten explicar la procedència i deduplicar reimportacions;
- una reimportació d’una mateixa identitat es resol amb `upsert`;
- una fila eliminada lògicament es pot restaurar en una reimportació establint `deleted_at = null`.

La migració de base és `20260806213000_healthkit_foundation.sql`.

## Decisions pendents

- Estratègia definitiva de separació entre Supabase DEV i un futur entorn PROD quan ATLES deixi de ser un pilot personal.
- Política d’importació històrica i incremental de HealthKit més enllà de la prova tècnica inicial.
- Retenció i granularitat de dades fisiològiques quan s’incorporin freqüència cardíaca, HRV, son i altres mètriques de la fase Apple Health completa.
