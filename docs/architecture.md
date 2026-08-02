# Arquitectura d’ATLES

## Objectiu

Construir una PWA **local-first**, robusta i usable sense connexió. El núvol ha de sincronitzar i protegir les dades, però l’app no ha de deixar de funcionar si Supabase no està disponible.

## Arquitectura general

```text
iPhone / navegador
        │
        ▼
PWA ATLES
        │
        ▼
Repositoris de dades
        │
        ▼
StorageService
        │
        ├── IndexedDB (font local operativa)
        └── localStorage (còpia de seguretat)
        │
        ▼
Motor de sincronització
        │
        ▼
Supabase
- Auth
- PostgreSQL
- RLS
- backups
```

## Principis

1. **Local-first:** l’usuari pot registrar i consultar dades sense Internet.
2. **Sincronització eventual:** els canvis pendents es pugen quan torna la connexió.
3. **Cap pèrdua silenciosa:** els errors de sincronització han de quedar registrats i ser recuperables.
4. **IDs estables:** cada registre té un UUID generat al client.
5. **Timestamps obligatoris:** `created_at`, `updated_at` i, quan calgui, `deleted_at`.
6. **Soft delete:** les eliminacions es sincronitzen; no s’esborren immediatament del núvol.
7. **Separació d’entorns:** producció, integració i funcionalitats no comparteixen desplegament.

## Responsabilitats

### PWA

- Interfície d’usuari.
- Validació immediata dels formularis.
- Accés a les dades mitjançant repositoris.
- Funcionament offline.
- Cua de canvis pendents.
- Lectura de l’estat de sincronització.

### Repositoris de dades

- Desacoblen la UI de la persistència i la sincronització.
- Centralitzen creació, consulta, actualització i soft delete.
- Generen UUID estables que s’utilitzen tant localment com a Supabase.
- Conserven `created_at`, `updated_at` i `deleted_at`.
- Exposen els tombstones al motor de sincronització, però no a la UI.
- S’afegeixen incrementalment per entitat; `WeightRepository` és el primer pilot.

### StorageService

- Ofereix una interfície asíncrona comuna de persistència.
- Utilitza IndexedDB com a font principal.
- Manté localStorage com a còpia de seguretat durant la migració.
- Permet substituir els adaptadors sense modificar els repositoris ni la UI.

### IndexedDB

- Perfil i preferències.
- Objectius.
- Pesos.
- Àpats.
- Activitats.
- Resums diaris.
- Operacions pendents de sincronitzar.

### Client Supabase

- Es carrega sota demanda quan cal autenticació o sincronització.
- Manté la renovació i persistència de la sessió mitjançant el SDK oficial.
- Una fallada de xarxa o del SDK no bloqueja la càrrega de les dades locals.
- Utilitza només la URL i la publishable key del projecte corresponent.

### Supabase

- Autenticació.
- Còpia sincronitzada de les dades.
- Seguretat amb RLS.
- Recuperació entre dispositius.
- Base futura per informes, IA i serveis externs.

## Sincronització inicial

1. L’app llegeix IndexedDB.
2. Renderitza sense esperar la xarxa.
3. Si hi ha sessió i connexió, executa `push` de canvis locals pendents.
4. Després executa `pull` de canvis remots posteriors a l’última sincronització.
5. Actualitza IndexedDB.
6. Torna a renderitzar només si hi ha canvis.

## Conflictes

Primera estratègia:

- Els registres independents es fusionen per UUID.
- En una edició concurrent del mateix registre, preval el `updated_at` més recent.
- Els conflictes dubtosos es registren; no s’han de descartar silenciosament.
- Les dades crítiques han de conservar una còpia anterior fins confirmar la sincronització.

## Evolució prevista

1. localStorage inicial estable — completat.
2. Migració controlada a IndexedDB — completat.
3. Supabase Auth i esquema mínim — completat.
4. Repositori local de pesos — completat.
5. Sincronització d’una sola entitat: pesos — següent pilot.
6. Extensió a àpats, activitats i resums.
7. Previews i desplegament a Vercel.
8. Integracions d’IA i salut.
