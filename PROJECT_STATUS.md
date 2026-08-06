# ATLES — Estat del projecte

Aquest document és el marcador operatiu del roadmap. S’actualitza quan una fita es completa, es bloqueja o canvia de prioritat.

## Objectiu final

Construir un sistema personal de salut i rendiment que integri Apple Watch i Apple Health, aprengui del comportament i la resposta fisiològica de l’usuari, desenvolupi un Digital Twin i coordini un equip virtual de preparació física, nutrició, recuperació, psicologia esportiva, analítica i suport preventiu.

## Estat global

- **Fase actual:** Fase 1 — Infraestructura segura i online-first
- **Estat:** en curs
- **Pròxima fita:** crear preview/staging i validar-hi la base online-first
- **Branca d’integració:** `develop`
- **Producció estable:** `main`

## Fase 0 — Fonaments

- [x] Restaurar una versió estable.
- [x] Crear `stable/v0.3`.
- [x] Crear `develop`.
- [x] Documentar arquitectura, base de dades, desplegament i decisions.
- [x] Crear el Master Plan.
- [x] Definir l’objectiu final: Digital Twin + Elite Mode.
- [ ] Crear tag/release `v0.3-stable`.

## Fase 1 — Infraestructura segura i online-first

- [x] Crear Supabase DEV.
- [x] Configurar autenticació amb correu i contrasenya.
- [x] Crear migracions inicials.
- [x] Crear `profiles`, `goals` i `weight_logs`.
- [x] Activar i provar RLS.
- [x] Implementar pilot de pesos amb UUID i soft delete.
- [x] Adoptar arquitectura online-first.
- [x] Descartar cues offline i resolució general de conflictes com a requisit actual.
- [x] Revisar el codi existent d’IndexedDB/localStorage i definir què es conserva com a migració o memòria cau.
- [x] Fer que Supabase sigui la font de veritat del pilot de pesos.
- [x] Afegir estats clars de connexió, càrrega i error.
- [x] Validar recuperació de dades en un segon dispositiu.
- [x] Crear preview/staging.
- [x] Afegir proves reals de navegador.
- [x] Provar rollback de la nova base.

### Validació 2026-08-04

- Lectura, alta, edició i eliminació de pesos validades contra Supabase.
- Soft delete verificat mitjançant `deleted_at`.
- Recuperació i coherència validades en dos navegadors amb el mateix compte.
- Els resums diaris també es recuperen des de Supabase.
- Estat `SESSIÓ TANCADA` diferenciat de `SENSE CONNEXIÓ`.
- Formularis de pes i resum desactivats sense sessió i mentre es carreguen dades remotes.
- Eliminat el camí alternatiu de guardat local per als registres de salut.
- Canvis integrats a `develop` mitjançant el merge `afc7aeb`.

### Validació de preview 2026-08-06

- Vercel connectat al repositori `mseglla/health-coach`.
- `main` configurada com a producció de Vercel.
- Preview de `feature/staging-foundation` desplegada correctament.
- Autenticació, lectura, alta i eliminació validades a la preview.
- Redirect URLs de Supabase configurades per GitHub Pages, localhost, producció Vercel i previews.

### Validació real en iPhone 2026-08-06

- Preview de `develop` oberta amb Safari en un iPhone real.
- Accés realitzat mitjançant un enllaç compartit de Vercel.
- Autenticació i recuperació de dades validades.
- Navegació, formularis i persistència validades.
- Obertura com a PWA des de la pantalla d'inici validada.
- No s'han detectat bloquejos de navegació ni problemes visibles amb el teclat o les safe areas.

### Validació de rollback 2026-08-06

- Branca estable `stable/v0.3` confirmada al commit `ee70aef35f3795f89f06c52c474d9ecf27307aa5`.
- Branca temporal `test/rollback-v0.3` desplegada correctament a Vercel.
- La versió v0.3 carrega, permet navegar i conserva dades locals després de recarregar.
- La prova s'ha fet sense modificar `main` ni `develop`.

### Criteri de sortida

Un usuari pot autenticar-se, llegir i modificar les seves dades amb connexió, recuperar-les en un altre dispositiu i no pot accedir a dades d’altres usuaris. Els errors de xarxa són visibles i no provoquen estats falsos o pèrdues silencioses.

## Fase 1B — Prova tècnica Apple Health

- [ ] Definir contracte de dades HealthKit → ATLES.
- [ ] Preparar camps d’origen, dispositiu i identificador extern.
- [ ] Validar una capa nativa iOS mínima.
- [ ] Importar almenys passos i entrenaments.
- [ ] Provar deduplicació i sincronització segura.

### Criteri de sortida

Demostrar amb dades reals que el flux `Apple Watch → Apple Health → connector iOS → Supabase → ATLES` és viable.

## Fase 2 — Nucli personal de salut

- [ ] Perfil i objectius.
- [ ] Pes i mesures.
- [ ] Àpats i nutrició bàsica.
- [ ] Activitat i entrenaments manuals.
- [ ] Check-in diari.
- [ ] Dashboard diari.
- [ ] Historial i gràfiques.
- [ ] Registre ràpid.

## Fase 3 — Apple Health complet

- [ ] Passos i distància.
- [ ] Calories actives i en repòs.
- [ ] Entrenaments.
- [ ] Freqüència cardíaca i freqüència en repòs.
- [ ] HRV.
- [ ] Son.
- [ ] VO₂max.
- [ ] Pes i composició corporal quan hi hagi font compatible.
- [ ] Importació històrica i incremental.
- [ ] Deduplificació, permisos i transparència de fonts.

## Fase 4 — Analítica personal

- [ ] Càrrega d’entrenament.
- [ ] Recuperació i readiness.
- [ ] Tendència de pes i balanç energètic.
- [ ] Relacions entre son, rendiment, gana, estrès i adherència.
- [ ] Informes diaris i setmanals.
- [ ] Qualitat i cobertura de dades.

## Fase 5 — Primers coaches

- [ ] Preparador físic.
- [ ] Nutricionista.
- [ ] Recuperació i son.
- [ ] Psicologia esportiva i hàbits.
- [ ] Coordinador de recomanacions.
- [ ] Recomanació diària explicable.

## Fase 6 — Planificació adaptativa

- [ ] Plans d’entrenament.
- [ ] Progressió de càrrega.
- [ ] Nutrició flexible.
- [ ] Integració amb calendari.
- [ ] Replanificació automàtica.
- [ ] Preparació de curses i reptes.

## Fase 7 — Motor predictiu

- [ ] Predicció de pes i rendiment.
- [ ] Detecció de fatiga, estancament i mala recuperació.
- [ ] Risc d’abandonament.
- [ ] Simulacions i escenaris.
- [ ] Incertesa i confiança explícites.

## Fase 8 — Digital Twin

- [ ] Perfil metabòlic personal.
- [ ] Tolerància individual a la càrrega.
- [ ] Patrons de son, gana, estrès, motivació i rendiment.
- [ ] Knowledge Model amb evidències i confiança.
- [ ] Aprenentatge continu i correcció de conclusions.

## Fase 9 — Elite Mode

- [ ] Preparador físic avançat.
- [ ] Nutricionista avançat.
- [ ] Especialista en recuperació.
- [ ] Psicòleg esportiu.
- [ ] Analista de rendiment.
- [ ] Suport mèdic preventiu.
- [ ] Coordinador general multidisciplinari.

## Fase 10 — Assistent proactiu i Health OS

- [ ] Alertes i anticipació contextual.
- [ ] Adaptació a calendari, viatges i setmanes difícils.
- [ ] Lesions, analítiques, medicació i fisioteràpia.
- [ ] Informes compartibles amb professionals.
- [ ] Integracions amb altres dispositius i plataformes.

## Regla d’actualització

Quan completem una fita:

1. es prova;
2. es marca aquí;
3. s’indica el commit o PR corresponent quan sigui rellevant;
4. no es dona per completada només perquè el codi existeixi;
5. no es passa a una fase posterior si falta una dependència crítica.
