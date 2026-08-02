# Registre de decisions d’ATLES

## ADR-001 — Arquitectura local-first

**Estat:** acceptada.

ATLES funcionarà sobre dades locals i sincronitzarà amb Supabase. La xarxa no bloquejarà l’ús bàsic.

**Motiu:** l’app s’utilitza principalment al mòbil i ha de continuar funcionant amb connexió inestable.

## ADR-002 — IndexedDB com a persistència principal

**Estat:** acceptada i implementada.

IndexedDB és la persistència principal. localStorage es manté temporalment com a còpia de seguretat mitjançant escriptura dual i recuperació provada.

**Motiu:** millor capacitat, transaccions i estructura per a una PWA local-first.

## ADR-003 — Supabase com a backend

**Estat:** acceptada.

Supabase oferirà Auth, PostgreSQL, RLS i recuperació entre dispositius.

**Motiu:** permet una base sòlida sense construir un backend complet des de zero.

## ADR-004 — main no és una branca de desenvolupament

**Estat:** acceptada.

`main` només conté producció validada. El treball passa per `feature/*` i `develop`.

## ADR-005 — Cap desplegament sense preview i prova real

**Estat:** acceptada.

El CI de sintaxi i lògica no substitueix les proves de navegador. Abans de producció són obligatòries proves reals de navegació, formularis, persistència i PWA.

## ADR-006 — Desenvolupament incremental de la v0.4

**Estat:** acceptada.

La v0.4 anterior no es reutilitzarà com un bloc únic per publicar. Se’n podran recuperar parts, però s’integraran i provaran una per una.

## ADR-007 — Vercel després de preparar la base

**Estat:** acceptada.

GitHub Pages es manté temporalment. Vercel s’introduirà quan tinguem `develop`, Supabase, variables d’entorn i necessitat de previews.

## ADR-008 — Soft delete i UUID

**Estat:** acceptada, validada a l’esquema SQL i implementada per als pesos locals.

Els registres sincronitzables utilitzen UUID i `deleted_at` per evitar pèrdues i permetre propagar eliminacions. Els identificadors antics dels pesos es migren una sola vegada a UUID i es persisteixen abans de sincronitzar.

## ADR-009 — Apple Health no és una funció web directa

**Estat:** acceptada.

Una PWA no prometrà accés directe complet a Apple Health. Aquesta integració requerirà una capa nativa o una solució específica futura.

## ADR-010 — Autenticació inicial amb correu i contrasenya

**Estat:** acceptada.

ATLES utilitzarà inicialment Supabase Auth amb correu i contrasenya. La confirmació del correu serà obligatòria.

**Motiu:** és el flux més previsible per validar autenticació, RLS, recuperació entre dispositius i sincronització en una PWA. Evita introduir ara la complexitat dels redirects de magic link entre el navegador i la PWA instal·lada.

**Configuració inicial de seguretat:**

- Canvi segur de correu activat.
- Canvi segur de contrasenya activat.
- Contrasenya mínima de 10 caràcters.
- Requisits de majúscula, minúscula, número i símbol.
- Confirmació del correu activada.

**Conseqüències:**

- Caldrà implementar registre, confirmació, inici i tancament de sessió i recuperació de contrasenya.
- Magic link i altres proveïdors es podran afegir posteriorment sense modificar el model de dades funcional.
- L’autenticació necessita connexió, però les funcionalitats locals d’ATLES no han de quedar bloquejades permanentment per l’absència de xarxa.

## ADR-011 — Repositoris de dades entre la UI i la persistència

**Estat:** acceptada i implementada inicialment per als pesos.

La UI no ha de crear, editar ni eliminar directament els registres sincronitzables. Cada entitat disposarà progressivament d’un repositori que centralitzi les operacions locals i les metadades necessàries per sincronitzar.

**Motiu:** separar la UI de StorageService i del futur Sync Engine permet canviar la persistència o afegir Supabase sense duplicar lògica ni acoblar la xarxa als formularis.

**Alternatives descartades:**

- Connectar `app.js` directament amb Supabase, perquè trencaria l’arquitectura local-first.
- Crear ara un repositori genèric per a totes les entitats, perquè introduiria un refactor massa gran abans de validar el pilot.

**Conseqüències:**

- `WeightRepository` és el primer repositori i serveix com a patró.
- Els pesos utilitzen el mateix UUID localment i remotament.
- Les eliminacions són soft delete i es conserven com a tombstones.
- Àpats, activitats i altres entitats adoptaran el patró incrementalment.

## ADR-012 — SDK de Supabase carregat sota demanda

**Estat:** acceptada i implementada al servei base.

ATLES utilitzarà el SDK oficial `supabase-js` amb una versió fixada. El SDK només es carregarà quan una operació necessiti autenticació o sincronització.

**Motiu:** Supabase Auth gestiona correctament sessió, renovació de tokens i flux PKCE. Carregar-lo sota demanda evita que una dependència de xarxa bloquegi l’ús local d’ATLES.

**Alternatives descartades:**

- Reimplementar manualment el protocol d’autenticació i renovació de tokens.
- Carregar el SDK obligatòriament durant l’arrencada de l’aplicació.
- Introduir ara un procés complet de bundling per una única dependència.

**Conseqüències:**

- L’autenticació i la sincronització necessiten xarxa.
- Les funcionalitats locals continuen disponibles sense el SDK.
- La versió del SDK s’ha d’actualitzar explícitament i tornar a provar.
- Només la URL i la publishable key poden formar part del frontend.
