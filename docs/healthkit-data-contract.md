# Contracte de dades HealthKit → ATLES

## Objectiu

Definir el contracte mínim per importar dades d’Apple Health a ATLES mitjançant una capa nativa iOS.

El flux previst és:

```text
Apple Watch
→ Apple Health / HealthKit
→ connector iOS
→ Supabase
→ ATLES
```

La PWA no accedeix directament a HealthKit.

## Principis

- Supabase és la font de veritat d’ATLES.
- El connector iOS és responsable de llegir HealthKit.
- Les dades només es confirmen quan Supabase les accepta.
- Cada registre ha de conservar la seva procedència.
- La importació ha de ser incremental i idempotent.
- No es guardaran totes les mostres crues en la primera prova tècnica.
- Els agregats diaris i els entrenaments es modelen per separat.

## Camps comuns de procedència

Els registres importats de HealthKit han de poder conservar:

- `source`: origen normalitzat de la dada. Per Apple Health serà `healthkit`.
- `external_id`: identificador estable del registre a la font externa.
- `source_bundle_id`: identificador de l’app o sistema que va generar la dada.
- `source_device`: descripció del dispositiu d’origen quan estigui disponible.
- `timezone`: zona horària aplicable al registre.
- `metadata`: metadades originals útils en format JSON.
- `imported_at`: moment en què ATLES va importar el registre.
- `created_at` i `updated_at`: timestamps gestionats per Supabase.
- `deleted_at`: soft delete quan sigui necessari.

## Passos diaris

Els passos es consolidaran a `daily_summaries`.

Camps mínims:

- `user_id`
- `summary_date`
- `steps`
- `source`
- `updated_at`

Regles:

- Hi ha una única fila activa per `user_id` i `summary_date`.
- El connector calcula el total del dia segons la zona horària de l’usuari.
- Una nova importació del mateix dia actualitza el total existent.
- No es guarden les mostres individuals de passos durant la prova tècnica.
- El valor no pot ser negatiu.

## Entrenaments

Els entrenaments es guardaran com a registres independents a `activity_logs`.

Camps mínims:

- `id`
- `user_id`
- `activity_type`
- `started_at`
- `ended_at`
- `duration_minutes`
- `active_calories`
- `distance_meters`
- `steps`
- `source`
- `external_id`
- `source_bundle_id`
- `source_device`
- `timezone`
- `metadata`
- timestamps comuns

Regles:

- `started_at` és obligatori.
- `ended_at` ha de ser posterior o igual a `started_at`.
- La durada, les calories, la distància i els passos no poden ser negatius.
- `activity_type` utilitza un vocabulari normalitzat d’ATLES.
- El tipus original de HealthKit es pot conservar dins de `metadata`.

## Identitat i deduplicació

Per als entrenaments importats, la clau de deduplicació serà:

```text
user_id + source + external_id
```

Això implica un índex únic parcial per als registres que tinguin `external_id`.

Una reimportació del mateix registre:

- no crea una fila nova;
- actualitza els camps modificables;
- conserva la identitat interna d’ATLES;
- actualitza `updated_at` i `imported_at`.

Per als resums diaris, la clau continua sent:

```text
user_id + summary_date
```

## Sincronització incremental

El connector iOS ha de:

1. Demanar només els permisos necessaris.
2. Llegir canvis nous o modificats des de l’últim punt de sincronització.
3. Normalitzar tipus, dates i unitats.
4. Enviar els registres a Supabase.
5. Confirmar el punt de sincronització només després d’una resposta correcta.
6. Poder repetir una importació sense crear duplicats.
7. Mostrar errors sense afirmar que la sincronització ha finalitzat.

El cursor o token de sincronització és responsabilitat del connector iOS. No es considera una dada de salut i no cal exposar-lo a la PWA.

## Zona horària

- Els timestamps d’esdeveniments es guarden com `timestamptz`.
- La zona horària original es conserva quan estigui disponible.
- Els passos diaris s’assignen a `summary_date` segons la zona horària de l’usuari en aquell moment.
- ATLES no ha d’agrupar un dia únicament segons UTC.

## Unitats normalitzades

ATLES utilitzarà inicialment:

- durada: minuts;
- calories: kcal;
- distància: metres;
- passos: enter;
- pes: kg.

Les unitats originals poden conservar-se dins de `metadata` quan sigui útil.

## Seguretat

- Totes les taules tenen RLS.
- Un usuari només pot llegir o modificar els seus registres.
- El connector opera amb la sessió autenticada de l’usuari.
- No s’utilitza `service_role` dins de l’app iOS ni del frontend.
- Les metadades no han de contenir secrets, tokens ni credencials.

## Abast de la prova tècnica

Inclòs:

- passos diaris;
- entrenaments;
- procedència;
- dispositiu;
- identificador extern;
- zona horària;
- deduplicació;
- sincronització incremental.

Fora d’abast inicial:

- freqüència cardíaca mostra a mostra;
- HRV;
- son detallat;
- rutes GPS;
- mostres crues de moviment;
- importació completa de tot l’historial;
- escriptura de dades cap a HealthKit.

## Criteri de sortida

La prova es considera viable quan:

- un connector iOS pot llegir passos i entrenaments reals;
- les dades arriben a Supabase amb procedència completa;
- ATLES les pot consultar;
- repetir la sincronització no crea duplicats;
- les dates i els totals diaris es mantenen correctes;
- un altre usuari no pot accedir a aquestes dades.
