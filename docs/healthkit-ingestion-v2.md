# Importació conjunta HealthKit v2 — validada en local; pendent d'iPhone

Base: `c744d3ea506d21c8a845fdaa7062fe273f263553` (PROD validada pel propietari).
Branca prevista: `feature/apple-health-ingestion-v2`.

## Abast

La PWA, el service worker i les dades existents no canvien. El nou codi és al connector
iOS, en una migració additiva, i en proves. No s'ha executat cap migració remota.
`ATLESHealthIngestionV2Enabled` està en `NO` tant en Debug com en Release.

| Dada | Tipus ATLES | Unitat / representació |
| --- | --- | --- |
| Freqüència cardíaca en repòs | `resting_heart_rate_bpm` | bpm, mostres de `restingHeartRate` |
| HRV | `hrv_sdnn_ms` | mil·lisegons, SDNN; no RMSSD |
| VO₂max | `vo2_max_ml_kg_min` | ml/kg/min, observacions amb data |
| Pes | `body_mass_kg` | kg, sense sobreescriure `weight_logs` manuals |
| Greix corporal | `body_fat_percent` | punts percentuals: 0,25 de HealthKit → 25 |
| Massa magra | `lean_body_mass_kg` | kg |
| Son | `sleep_stage` | intervals i categories, sense sumar ni solapar fonts |

Les set famílies noves es guarden a `health_samples`. Són dades disponibles per a
funcionalitats posteriors, no s'afegeixen targetes ni es carreguen automàticament a la PWA.
No es desen mostres crues de passos/pols d'alta freqüència ni rutes GPS.

Els permisos i observers es descriuen a `HealthMetricCatalog`. S'han conservat les
unitats i els càlculs existents d'energia, passos, distància, pols i entrenaments.
Els triggers legacy continuen sent passos, pols i entrenaments; no es multipliquen.
Quan s'activa v2, s'afegeixen els set tipus nous amb notificació `.hourly`.
Aquesta freqüència no garanteix una execució puntual: iOS controla el segon pla.

## Identitat, qualitat i sincronització

- `user_id + metric_type + source + external_id` identifica la mostra.
- UUID de HealthKit, timestamps amb fraccions de segon, origen, versió i dispositiu.
- `timezone` només conté la metadada de la font si existeix. `import_timezone` registra
  el context d'importació; no es presenta com la zona històrica original.
- Consulta ancorada sense filtre de dates mòbil: inclou dades antigues afegides tard
  i UUID explícits d'eliminacions dels set tipus nous.
- Blocs de 250 mostres, màxim 100 pàgines/tipus en manual i 4 en segon pla.
  Una passada amb més dades queda marcada com pendent de continuar; el botó reprèn
  des de l'últim checkpoint. Una passada curta addicional pot ser necessària per
  confirmar el final. No es promet que tot un historial acabi en un sol intent.
- RPC transaccional: aplica altes i baixes juntes. Només després d'un ACK vàlid es
  desa el cursor local. Un error de lectura, validació, HTTP, sessió o persistència
  no avança el checkpoint afectat; els blocs anteriors confirmats es conserven.
- Les pàgines buides no avancen el cursor. La falta d'accés no pot generar zeros ni
  una baixa inferida. HealthKit no permet distingir sempre denegació i falta de dades.
- Els tombstones inclouen UUID encara no importats per impedir que un reintent o
  un segon dispositiu ressusciti una mostra explícitament eliminada.
- Un lock transaccional per usuari/tipus serialitza RPC concurrents. RLS protegeix
  les dues taules i la funció deriva l'usuari de `auth.uid()`, no del payload.
- Errors aïllats per tipus; un error d'HRV no bloqueja el son ni el pes.
- Les importacions ampliades manuals/background comparteixen coordinador i cursors.
- Cursor separat per backend, usuari i tipus. No es reinicia automàticament un cursor
  corrupte. Reinstal·lar/restaurar el dispositiu requereix revisar-ne la validesa;
  un reimport complet autoritzat és idempotent.

## Son i fonts

Es conserven `in_bed`, `asleep_unspecified`, `awake`, `core`, `deep`, `rem` i valors
futurs com `unknown` amb el valor original. Es preserven intervals que travessen
mitjanit i intervals solapats de diferents fonts. No s'infereix que tot el temps al
llit sigui son; no es calcula cap durada total ni cap score de recuperació.
La selecció/prioritat entre fonts per mostrar dades es decidirà en la capa d'anàlisi.

## Límits que NO dona per resolts aquest patch

- Els agregats i entrenaments legacy continuen amb finestres de 7/14 dies (30 dies
  de context basal). No se'ls atribueix el tractament de baixes antigues de v2.
- No hi ha migració d'històric existent ni es reinterpreten els pesos manuals.
- No hi ha renovació automàtica nova del JWT. HTTP 401 conserva el cursor; cal
  renovar la sessió al connector i reprendre. No s'oculta com un èxit.
- No hi ha cua general offline: una falta de connexió deixa el cursor pendent.
- Lectura a la PWA, prioritats de fonts, resums diaris i recomanacions són treballs posteriors.

## Gate obligatori: confirmar DEV abans d'activar

`docs/database.md` encara té pendent la separació definitiva DEV/PROD. El codi
aportat usa un endpoint fix al connector i la PWA. Una branca de Git NO aïlla dades.

**No activar el flag ni executar `supabase db push` contra el projecte vinculat
sense identificar i confirmar abans el backend de proves.** Si no existeix DEV
aïllat, cal acordar-ne la creació/configuració abans d'enviar dades noves.
No s'han canviat endpoints ni credencials en aquest patch.

En DEV aïllat i amb autorització explícita:

1. Aplicar el conjunt de migracions del repositori, inclosa
   `20260827060000_health_samples_ingestion.sql`.
2. Crear dos usuaris de prova i executar `scripts/validate-health-ingestion-dev.mjs`
   amb `ATLES_DEV_SUPABASE_URL`, `ATLES_DEV_SUPABASE_KEY`,
   `ATLES_DEV_USER_A_EMAIL`, `ATLES_DEV_USER_A_PASSWORD`,
   `ATLES_DEV_USER_B_EMAIL`, `ATLES_DEV_USER_B_PASSWORD` i
   `ATLES_ALLOW_DEV_WRITES=health-ingestion-tests`.
   No enganxar contrasenyes/tokens al xat. L'script rebutja el backend de la PWA
   actual. Crea registres sintètics identificables i els deixa amb soft delete.
3. Configurar autenticació i escriptura del connector contra el mateix DEV. Evitar
   compartir sessió Keychain/bundle amb l'app real; preparar una variant DEV abans
   d'instal·lar-la al mateix dispositiu. No fer-ho només canviant un endpoint.
4. Activar el flag només a la variant Debug DEV; mantenir Release en `NO`.
5. Instal·lar, iniciar sessió DEV, prémer Connectar Apple Health i escollir els permisos.
6. Prémer Importar / continuar dades ampliades. Comparar mostres reals amb Salut,
   incloent un dia de son que travessi mitjanit. No crear o esborrar dades reals a
   Salut per provar; usar mostres de prova autoritzades o les proves sintètiques DEV.
7. Provar interrupció/reobertura, xarxa absent, permisos parcials, segon pla i canvi
   de compte. Comprovar que no hi ha duplicats ni sobreescriptura de dades manuals.

## Resultats verificats al Mac — 2026-08-27

- Suite Node, proves del motor Swift i compilació Xcode per a simulador correctes.
- Les 10 migracions aplicades a Supabase LOCAL, inclosa `20260827060000`.
- Proves HTTP amb dos usuaris ficticis: unitats, upsert, RLS, rollback, baixes i son correctes.
- Usuaris de prova conservats; mostres sintètiques amb soft delete i tombstones.
- Entorn local amb `vector,logflare,edge-runtime` exclosos de l'arrencada.
- Restricció dels ports a localhost pendent; ús acordat només en xarxa de confiança amb dades sintètiques.
- Cap migració remota ni activació del flag. Pendent de variant DEV i prova real a l'iPhone.

## Proves de codi (sense base de dades)

Des de l'arrel del repositori:

```bash
for file in tests/*.test.mjs; do node "$file" || exit 1; done
bash scripts/test-health-ingestion-core.sh
xcodebuild -project ios/ATLESConnector/ATLESConnector.xcodeproj \
  -scheme ATLESConnector -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO build
```

Els tests Node de wiring són estàtics: no validen compilació Swift ni SQL/RLS.
El test Swift usa el runner de producció amb dobles de consulta/transport/cursor:
tipus/unitats, fases futures, timestamps, paginació, baixa, reintent, cursor estancat,
errors, absència, límit de pàgines i canvi de sessió. Cal executar-lo al Mac.

## Rollback

Mantenir/restaurar `ATLESHealthIngestionV2Enabled=NO` i instal·lar el connector
anterior o la build amb el flag desactivat. No eliminar les taules noves ni els
cursors per defecte; conservar dades i checkpoints per inspecció. Les taules i
pantalles existents no depenen de v2. No hi ha cap desplegament automàtic del patch.

## Fonts tècniques

- [Consultes ancorades](https://developer.apple.com/documentation/healthkit/hkanchoredobjectquery)
- [Permisos de HealthKit](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)
- [Categories de son](https://developer.apple.com/documentation/healthkit/hkcategoryvaluesleepanalysis)
- [Percentatges: fracció de 0 a 1](https://developer.apple.com/documentation/healthkit/hkunit/percent())
