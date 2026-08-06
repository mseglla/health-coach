# Arquitectura d’ATLES

## Objectiu

Construir una aplicació **online-first**, segura i simple. Supabase és la font de veritat de les dades. ATLES necessita connexió per autenticar, carregar i desar informació; si no hi ha xarxa, mostrarà un estat clar de «sense connexió» i evitarà qualsevol canvi que pugui perdre’s.

Aquesta decisió redueix considerablement la complexitat de sincronització, conflictes, cues offline i duplicació de dades. El suport offline complet es podrà reconsiderar en el futur només si l’ús real ho justifica.

## Arquitectura general

```text
Apple Watch
    ↓
Apple Health / connector iOS futur
    ↓
PWA ATLES
    ↓
Serveis i repositoris de dades
    ↓
Supabase
- Auth
- PostgreSQL
- RLS
- Storage / Edge Functions quan calgui
    ↓
Motor analític, coaches, IA i Digital Twin
```

## Principis

1. **Online-first:** les operacions funcionals necessiten connexió.
2. **Supabase com a font de veritat:** el servidor conserva l’estat canònic.
3. **Sense canvis offline:** si no hi ha connexió, la UI informa i no permet desar operacions.
4. **Memòria cau limitada:** es pot conservar informació no crítica per accelerar la càrrega, però no és una segona font de veritat.
5. **Cap pèrdua silenciosa:** qualsevol error de lectura o escriptura es mostra i es registra.
6. **IDs estables:** cada registre sincronitzable utilitza UUID.
7. **Timestamps obligatoris:** `created_at`, `updated_at` i, quan calgui, `deleted_at`.
8. **Soft delete:** es conserva per integritat, auditoria i futures integracions.
9. **Separació d’entorns:** producció, integració i funcionalitats no comparteixen desplegament.
10. **Desenvolupament incremental:** una funcionalitat, una branca petita, una prova real.

## Responsabilitats

### PWA

- Interfície d’usuari.
- Validació immediata dels formularis.
- Comprovació de connexió i sessió.
- Accés a dades mitjançant serveis o repositoris.
- Missatges clars davant errors o absència de xarxa.
- Cap promesa de treball offline complet.

### Repositoris i serveis

- Desacoblen la UI de Supabase.
- Centralitzen creació, consulta, actualització i soft delete.
- Gestionen UUID, timestamps, validació i errors.
- Permeten canviar la implementació sense reescriure la interfície.
- S’afegeixen incrementalment per entitat.

### Persistència local existent

IndexedDB i localStorage ja existeixen en parts del projecte. No s’eliminaran precipitadament:

- es mantindran temporalment per compatibilitat i migració;
- no es desenvoluparà un motor offline complet;
- no s’afegiran cues complexes ni resolució general de conflictes;
- podran evolucionar cap a memòria cau o eliminar-se quan Supabase estigui validat com a font principal.

### Client Supabase

- Gestiona autenticació i dades remotes amb el SDK oficial.
- Utilitza només la URL i la publishable key al frontend.
- Tradueix errors tècnics a missatges comprensibles.
- No permet operacions si la sessió o la xarxa no són vàlides.

### Supabase

- Autenticació.
- PostgreSQL com a font de veritat.
- Seguretat amb RLS.
- Recuperació entre dispositius.
- Migracions versionades.
- Base futura per Apple Health, informes, IA, coaches i Digital Twin.

## Flux funcional

1. L’app comprova connexió i sessió.
2. Si no hi ha connexió, mostra una pantalla o avís clar i no permet modificar dades.
3. Si hi ha connexió, carrega les dades necessàries de Supabase.
4. Les operacions s’envien directament al backend.
5. La UI només confirma un canvi quan Supabase l’ha acceptat.
6. Els errors es mostren i no es dissimulen amb un fals estat local.

## Apple Health i Digital Twin

La base de dades ha d’estar preparada des d’ara per rebre dades amb:

- font i dispositiu;
- identificador extern;
- data d’inici i final;
- zona horària;
- valor i unitat;
- metadades originals;
- mecanismes de deduplicació.

La integració completa requerirà una capa nativa iOS. Aquestes dades alimentaran l’analítica personal, els coaches i el Digital Twin.

## Evolució prevista

1. Supabase Auth i esquema mínim — completat.
2. RLS i pilot de pesos — completat.
3. Simplificar la persistència cap a online-first — decisió adoptada.
4. Completar entitats principals i serveis remots.
5. Estat visible de connexió, càrrega i errors.
6. Recuperació en un segon dispositiu.
7. Preview/staging i desplegament segur.
8. Nucli diari de salut.
9. Prova tècnica Apple Health.
10. Analítica, coaches i Digital Twin.
