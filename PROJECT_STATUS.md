# ATLES — Estat del projecte

Aquest document és el marcador operatiu del roadmap. S’actualitza quan una fita es completa, es bloqueja o canvia de prioritat.

## Objectiu final

Construir un sistema personal de salut i rendiment que integri Apple Watch i Apple Health, aprengui del comportament i la resposta fisiològica de l’usuari, desenvolupi un Digital Twin i coordini un equip virtual de preparació física, nutrició, recuperació, psicologia esportiva, analítica i suport preventiu.

## Estat global

- **Fase actual:** Fase 1 — Infraestructura segura i online-first
- **Estat:** en curs
- **Pròxima fita:** consolidar Supabase com a font de veritat i completar els serveis remots de les entitats pilot
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
- [ ] Revisar el codi existent d’IndexedDB/localStorage i definir què es conserva com a migració o memòria cau.
- [ ] Fer que Supabase sigui la font de veritat del pilot de pesos.
- [ ] Afegir estats clars de connexió, càrrega i error.
- [ ] Validar recuperació de dades en un segon dispositiu.
- [ ] Crear preview/staging.
- [ ] Afegir proves reals de navegador.
- [ ] Provar rollback de la nova base.

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
