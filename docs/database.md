# Model de dades de Supabase

## Criteris generals

- PostgreSQL gestionat per Supabase.
- Totes les taules d’usuari inclouen `user_id uuid not null`.
- Claus primàries UUID generades al client o al servidor.
- Camps comuns: `created_at`, `updated_at`, `deleted_at`.
- RLS activada des del primer dia.
- Cap taula funcional es crea directament en producció sense migració SQL versionada.

## Taules inicials

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

Permet conservar historial d’objectius.

- `id uuid primary key`
- `user_id uuid not null`
- `start_weight_kg numeric null`
- `target_weight_kg numeric not null`
- `target_date date null`
- `weekly_goal_kg numeric null`
- `is_active boolean not null default true`
- timestamps comuns

### weight_logs

- `id uuid primary key`
- `user_id uuid not null`
- `value_kg numeric not null`
- `measured_at timestamptz not null`
- `source text not null default 'manual'`
- timestamps comuns

### activity_logs

- `id uuid primary key`
- `user_id uuid not null`
- `activity_type text not null`
- `duration_minutes numeric null`
- `active_calories numeric null`
- `steps integer null`
- `started_at timestamptz not null`
- `notes text null`
- `source text not null default 'manual'`
- timestamps comuns

### daily_summaries

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

### sync_operations

Inicialment local a IndexedDB. Només es crearà al servidor si realment aporta valor de diagnòstic.

- `id uuid`
- `entity_type text`
- `entity_id uuid`
- `operation text`
- `status text`
- `attempts integer`
- `last_error text null`
- timestamps

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

## Índexs mínims

- `weight_logs(user_id, measured_at desc)`
- `activity_logs(user_id, started_at desc)`
- `daily_summaries(user_id, summary_date desc)`
- índex parcial de files no eliminades quan sigui necessari.

## Decisions pendents abans de crear taules

- Un únic projecte Supabase amb esquemes separats o projectes DEV/PROD independents.
- Política exacta de conflictes i soft delete.
- Límit de retenció del registre de sincronització.
