# ATLES — Estat del projecte

Aquest document és el marcador operatiu del roadmap. S’actualitza quan una fita es completa, es bloqueja o canvia de prioritat.

## Objectiu final

Construir un sistema personal de salut i rendiment que integri Apple Watch i Apple Health, aprengui del comportament i la resposta fisiològica de l’usuari, desenvolupi un Digital Twin i coordini un equip virtual de preparació física, nutrició, recuperació, psicologia esportiva, analítica i suport preventiu.

## Estat global

- **Fase actual:** Fase 2 — Nucli personal de salut
- **Estat:** en curs
- **Pròxima fita:** continuar la Fase 2 amb registre ràpid
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

- [x] Definir contracte de dades HealthKit → ATLES.
- [x] Preparar camps d’origen, dispositiu i identificador extern.
- [x] Validar una capa nativa iOS mínima.
- [x] Importar almenys passos i entrenaments.
- [x] Provar deduplicació i sincronització segura amb dades reals de HealthKit.
- [x] Validar sincronització automàtica de passos en segon pla.
- [x] Validar sincronització automàtica d'entrenaments en segon pla.

### Base HealthKit validada 2026-08-10

- Contracte `HealthKit → connector iOS → Supabase → ATLES` documentat.
- Creada `health_daily_metrics` per separar mètriques automàtiques diàries dels resums manuals.
- Creada `activity_logs` per activitats manuals i entrenaments importats.
- Identitat única de mètrica: `(user_id, metric_date, metric_type, source)`.
- Identitat única d’activitat importada: `(user_id, source, external_id)`.
- Camps d’origen preparats: `source`, `external_id`, `source_bundle_id`, `source_device`, `timezone`, `metadata` i `imported_at` segons la taula.
- Migració `20260806213000_healthkit_foundation.sql` aplicada a Supabase i historial local/remot alineat.
- RLS verificada per `health_daily_metrics` i `activity_logs`: `SELECT`, `INSERT` i `UPDATE` limitats a l’usuari autenticat.
- Proves remotes amb dos usuaris reals superades per a les dues taules: upsert sense duplicats, aïllament de lectura i bloqueig de suplantació de `user_id`.
- Canvis integrats a `develop` mitjançant el merge `753e2bf`.

### Validació real HealthKit 2026-08-16

- Connector natiu iOS executat en un iPhone real amb HealthKit.
- Lectura real de passos i entrenaments validada.
- Autenticació del connector contra Supabase validada amb un compte ATLES real.
- Sessió Supabase persistent mitjançant Keychain i renovació amb `refresh_token`.
- Sincronització manual de passos cap a `health_daily_metrics` validada.
- Sincronització manual d'entrenaments cap a `activity_logs` validada.
- Deduplicació real de passos validada: una única fila per `(user_id, metric_date, metric_type, source)` actualitzada mitjançant upsert.
- HealthKit Background Delivery i `HKObserverQuery` implementats.
- Sincronització automàtica de passos en segon pla validada en dispositiu real sense prémer cap botó.
- Branca de treball: `feature/healthkit-supabase-sync`.
- Últim checkpoint validat de la sessió persistent: `2299084`.

### Validació background d'entrenaments 2026-08-17

- Sessió del connector persistent després de tancar i reobrir l'app, amb credencials conservades al Keychain.
- Eliminada la competició entre múltiples instàncies de `SupabaseAuthManager`; UI i sincronització en segon pla comparteixen una única sessió.
- HealthKit Background Delivery confirmat per `stepCount` i `workout`.
- Passos configurats amb freqüència `.hourly`.
- Entrenaments configurats amb freqüència `.immediate`.
- `HKObserverQuery` d'entrenaments validat en un iPhone real.
- Entrenament iniciat a `2026-08-17 20:15:34+00` i finalitzat a `20:16:36+00`.
- Sense obrir ATLES Connector, HealthKit va activar l'observer a `20:23:02+00` després de desbloquejar l'iPhone.
- El mateix entrenament va arribar automàticament a `activity_logs` amb `imported_at = 2026-08-17 20:23:02+00`.
- Validat, per tant, el flux automàtic `HealthKit → connector iOS en segon pla → Supabase`.
- Commit final de la prova tècnica: `459c44c`.

### Criteri de sortida

Demostrar amb dades reals que el flux `Apple Watch → Apple Health → connector iOS → Supabase → ATLES` és viable.

**Criteri assolit el 2026-08-17.**

## Fase 2 — Nucli personal de salut

- [x] Perfil i objectius.
- [x] Pes i mesures.
- [x] Balanç energètic i nutrició inferida.
- [x] Activitat i entrenaments.
- [x] Check-in contextual i opcional.
- [x] Dashboard diari — snapshot unificat de l'estat del dia.
- [x] Historial i gràfiques.
- [ ] Registre ràpid.

### Validació Perfil i objectius 2026-08-18

- `profiles` connectat a Supabase com a font de veritat del perfil.
- Nom, data de naixement, alçada, sexe metabòlic i zona horària carregats i guardats remotament.
- L’edat es deriva de la data de naixement per als càlculs metabòlics.
- Eliminats els valors personals hardcoded de l’estat inicial.
- `goals` generalitzat per suportar objectius més enllà del pes mitjançant `goal_type`, `target_value`, `target_unit`, `metadata` i `is_primary`.
- Objectiu de pes carregat, creat i modificat contra Supabase.
- L’objectiu actiu es mostra al dashboard i conserva els canvis després de recarregar.
- Migració des dels valors locals antics `settings.goal` i `settings.targetDate` preparada.
- Les dades remotes de perfil i objectius no s’utilitzen com a font autoritativa del storage local.
- Service worker limitat a assets GET del mateix origen i actualitzat amb els nous repositoris.
- Validació funcional real completada en navegador local.
- Commits principals: `5f3b67e` i `282bbec`.

### Validació Pes i mesures 2026-08-18

- El pes continua gestionat a Supabase amb alta, edició, soft delete, historial i recuperació remota.
- Afegida `body_measurements` com a model genèric de mesures corporals.
- El model admet `measurement_type`, `value`, `unit`, `measured_at` i `source`, preparant futures mesures sense redissenyar l’esquema.
- La cintura és la primera mesura corporal visible a ATLES.
- Alta, edició, eliminació i persistència de cintura validades contra Supabase.
- Historial de cintura editable disponible a la UI.
- RLS activada per limitar lectura, inserció i actualització a l’usuari autenticat.
- Les mesures corporals remotes no s’utilitzen com a font autoritativa del storage local.
- Migració `20260818215000_body_measurements.sql` aplicada al Supabase DEV.
- Validació funcional real completada en navegador local.
- Commit principal: `e685263`.

### Validació Balanç energètic i nutrició inferida 2026-08-19

- Eliminada la dependència del registre manual de calories ingerides per interpretar el balanç energètic.
- ATLES infereix dèficit, manteniment o superàvit a partir de la tendència real del pes.
- La primera versió compara dues finestres de 7 dies i exigeix cobertura mínima de mesures.
- L’estimació utilitza una equivalència energètica aproximada i es mostra explícitament com a inferència, no com a fet observat.
- S’informa del grau de confiança de la inferència.
- El coach deixa de demanar completar la ingesta manual per poder donar una lectura.
- El dashboard mostra balanç inferit en lloc de calories ingerides.
- Eliminat l’anell de progrés perquè representava incorrectament una inferència de tendència com si fos un objectiu diari precís.
- La UI definitiva de la Home queda pendent d’un redisseny posterior.
- Validació funcional real amb dades de pes de l’usuari: dèficit inferit detectat correctament.
- Commit principal: `beac016`.

### Validació Activitat i entrenaments 2026-08-19

- `activity_logs` connectada a ATLES com a font remota d'entrenaments.
- Els entrenaments importats des de HealthKit es mostren a la PWA sense registre manual.
- Validat el flux `Apple Watch → Apple Health → connector → Supabase → ATLES`.
- Es mostren tipus d'activitat, data/hora, durada, calories actives i distància quan existeixen.
- Afegida lectura de freqüència cardíaca mitjana i màxima per entrenament.
- Afegida lectura de potència mitjana i màxima per running i ciclisme quan HealthKit disposa de la dada.
- FC i potència es guarden dins de `metadata` sense necessitat de nova migració.
- Les dades absents no es representen com a zero.
- Validada la deduplicació mitjançant `(user_id, source, external_id)`.
- La resincronització actualitza registres existents sense crear duplicats.
- Mapatge de `coreTraining` afegit com a `core_training`.
- Validació funcional real completada amb entrenaments importats de l'Apple Watch.
- Commit principal: `e7f2cb1`.

### Validació Check-in contextual i opcional 2026-08-19

- Afegida `contextual_checkins` a Supabase com a font de veritat del context subjectiu.
- El check-in és completament opcional i la seva absència no converteix el dia en incomplet.
- La primera versió pregunta únicament `Com et trobes avui?` amb una escala simple d'1 a 5.
- Es pot respondre amb un únic toc.
- La nota lliure és opcional i queda amagada per defecte.
- L'usuari pot prémer `Ara no` i continuar utilitzant ATLES normalment.
- L'omissió només es conserva localment per evitar tornar a mostrar la proposta durant el mateix dia.
- Una resposta queda persistida a Supabase i no torna a demanar-se aquell dia després de recarregar.
- Preparat el model perquè en el futur ATLES decideixi contextualment quan val la pena proposar un check-in.
- Validació funcional real completada en navegador local.

### Validació Dashboard diari 2026-08-19

- Creat `dailySnapshot` com a capa única de lectura de l'estat del dia.
- El snapshot integra pes, tendència, balanç energètic inferit, passos, check-in i entrenaments.
- Els passos d'Apple Health es consumeixen directament des de `health_daily_metrics`.
- Creada una capa `dailyInsight` separada de la UI per interpretar el snapshot.
- La Home prioritza una conclusió principal abans de mostrar mètriques.
- La lectura diària diferencia entre tendència energètica i trajectòria respecte a l'objectiu.
- El sistema pot identificar quan el pes baixa però a un ritme inferior al necessari per arribar a l'objectiu en la data marcada.
- La lectura mostra un màxim de tres evidències principals.
- Afegida una única recomanació contextual sota `Què et convé fer ara`.
- El check-in subjectiu pot modificar la recomanació quan l'usuari declara cansament.
- Eliminada la duplicació entre la targeta de balanç energètic i la recomanació principal.
- La lògica d'interpretació queda desacoblada de la presentació i preparada per a futures capes d'analítica i IA.
- Validació funcional real completada en navegador local.

### Validació Historial i gràfiques 2026-08-19

- Pantalla `Progrés` reorganitzada entorn de preguntes útils i no de mètriques decoratives.
- Afegit resum de pes, passos i càrrega d'entrenament.
- Pes: historial de fins a 30 registres amb dates reals a l'eix X.
- Pes puntual separat visualment de la tendència suavitzada.
- Afegida trajectòria objectiu discontínua basada en el pes inicial de l'objectiu i la data objectiu.
- La desviació respecte a la trajectòria es quantifica en kg.
- La lectura de ritme diferencia entre ritme observat i ritme necessari per arribar a l'objectiu.
- La tendència de pes utilitzada per interpretar progrés evita donar massa pes a una mesura puntual.
- Passos: mitjana dels dies realment disponibles i cobertura explícita del període.
- Els dies sense dades no s'interpreten com a zeros ni com a continuïtat observada.
- Entrenament: sessions i minuts agregats per les últimes 4 setmanes.
- Els eixos de mètriques no negatives, com passos i minuts d'entrenament, no baixen de zero.
- Validació funcional real completada en navegador local.

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
