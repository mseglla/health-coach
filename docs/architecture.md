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
IndexedDB (font local operativa)
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
- Persistència local.
- Funcionament offline.
- Cua de canvis pendents.
- Lectura de l’estat de sincronització.

### IndexedDB

- Perfil i preferències.
- Objectius.
- Pesos.
- Àpats.
- Activitats.
- Resums diaris.
- Operacions pendents de sincronitzar.

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

1. localStorage estable actual.
2. Migració controlada a IndexedDB.
3. Supabase Auth i esquema mínim.
4. Sincronització d’una sola entitat: pesos.
5. Extensió a àpats, activitats i resums.
6. Previews i desplegament a Vercel.
7. Integracions d’IA i salut.