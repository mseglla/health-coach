# ATLES — Master Plan

## 1. Visió

ATLES és un sistema operatiu personal de salut i rendiment. L’objectiu és que cada usuari disposi d’un equip digital coordinat comparable al que tindria un esportista d’elit: preparador físic, nutricionista, especialista en recuperació i son, psicòleg esportiu, analista de rendiment i suport mèdic preventiu.

ATLES no és un visor de dades ni un tracker de calories. Apple Health, Apple Watch i la resta de fonts són sensors que alimenten el sistema. El producte és la interpretació: entendre com està l’usuari, com evoluciona respecte als seus objectius, què està funcionant, què no i quina és la millor acció següent.

ATLES no substitueix professionals sanitaris ni diagnostica. Recull dades, les interpreta, aprèn de la resposta individual de cada persona i converteix informació dispersa en decisions útils, personalitzades, accionables i explicables.

El seu bucle fonamental és:

`objectiu → observar → interpretar → decidir → actuar → mesurar la resposta → adaptar`

## 2. Missió

Construir el millor entrenador personal digital possible, capaç de conèixer profundament cada usuari, acumular memòria durant anys i guiar-lo de manera clara cap als seus objectius de salut i rendiment.

ATLES ha de poder respondre, amb el mínim soroll possible, quatre preguntes:

1. Com estic?
2. Com estic evolucionant?
3. Estic en trajectòria d’aconseguir els meus objectius?
4. Què em convé fer ara?

## 3. Principis

- **Goals First:** les dades i recomanacions s’interpreten en relació amb objectius explícits de l’usuari.
- **Interpretation First:** conclusions, tendències i decisions abans que dades brutes.
- **Closed Loop:** ATLES observa, recomana, mesura la resposta i adapta les recomanacions futures.
- **Honest Feedback:** si l’usuari no progressa, s’estanca o va en una mala direcció, ATLES ho diu clarament i proposa una acció.
- **Online First:** Supabase és la font de veritat de les dades de salut del compte; no es mostren estats de guardat falsos sense connexió.
- **Privacy First:** les dades pertanyen a l’usuari i s’han de protegir per defecte.
- **AI First:** la IA forma part del disseny del sistema, no és un afegit final.
- **Data Driven:** les recomanacions han de basar-se en dades i evidència.
- **Explainable AI:** cada recomanació ha d’explicar el perquè, les dades utilitzades i el grau de confiança.
- **Uncertainty Explicit:** ATLES diferencia entre fets observats, estimacions i hipòtesis.
- **Human First:** el sistema s’adapta a la vida real, no exigeix perfecció ni una entrada manual obsessiva de dades.
- **Science over trends:** prioritat a criteris sòlids per davant de modes.
- **Adherència abans que perfecció:** la millor recomanació és la que l’usuari pot seguir.
- **Tendències abans que soroll:** no es prenen decisions importants per una sola dada o un sol dia si no hi ha motiu.
- **Simplicitat abans que saturació:** mostrar només informació que ajudi a entendre l’estat, el progrés o la següent decisió.
- **Base sòlida abans que funcionalitats:** canvis petits, revisables i recuperables.

## 4. Arquitectura de referència

```text
Apple Watch / Apple Health / altres fonts
↓
Connector iOS i integracions
↓
Supabase — autenticació, font de veritat i backend
↓
PWA ATLES
↓
Motor d’analítica, interpretació, coaches i Digital Twin
```

ATLES segueix una arquitectura online-first per a les dades de salut del compte.

Supabase és la font de veritat. IndexedDB i localStorage només es poden utilitzar com a memòria cau, migració o suport local no autoritatiu. No s’implementen cues offline de mutacions ni resolució general de conflictes mentre no siguin necessàries.

Les dades originals es guarden com a registres. Els valors derivats —tendències, càrrega, readiness, progrés, estimacions o conclusions— es calculen o versionen de manera explícita i no es dupliquen innecessàriament.

La PWA no accedeix directament a HealthKit. El flux de referència és:

```text
Apple Watch → Apple Health → connector iOS → Supabase → ATLES
```

## 5. Equip virtual d’ATLES

### 5.1 Coordinador general

Integra les recomanacions de tots els especialistes i resol conflictes. Per exemple, evita que el coach d’entrenament proposi una sessió exigent si el coach de recuperació detecta fatiga elevada.

### 5.2 Preparador físic

- Planificació diària, setmanal i per objectius.
- Running, força, ciclisme, spinning, pàdel, mobilitat i altres activitats.
- Progressió de volum, intensitat i freqüència.
- Control de càrrega aguda i crònica.
- Detecció de fatiga, estancament i risc de sobrecàrrega.
- Recomanació de descans, recuperació activa o sessió intensa.
- Preparació de curses i reptes.
- Adaptació automàtica del pla segons calendari, disponibilitat i resposta real.
- Comparació d’entrenaments i detecció de millores personals.
- Biblioteca d’exercicis amb tècnica, alternatives i material disponible.

### 5.3 Nutricionista

- Registre ràpid d’àpats, calories i macronutrients.
- Estimació d’àpats descrits en llenguatge natural o fotografies.
- Objectius de calories, proteïna, hidrats, greixos, fibra i hidratació.
- Ajust del dèficit o superàvit segons evolució real del pes.
- Aprenentatge del metabolisme i de la resposta individual.
- Recomanacions abans i després d’entrenar.
- Planificació d’àpats segons entrenaments, horaris, gana i preferències.
- Receptes segons aliments disponibles, pressupost i temps.
- Llista de la compra intel·ligent.
- Gestió flexible d’àpats socials, vacances i excepcions.
- Detecció de patrons de gana, picoteig i baixa adherència.

### 5.4 Especialista en recuperació i son

- Seguiment de son, descans, HRV, freqüència cardíaca en repòs i sensacions.
- Puntuació diària de preparació o readiness.
- Recomanació de son, descans, mobilitat i recuperació activa.
- Detecció d’acumulació de fatiga.
- Relació entre son, rendiment, gana, estat d’ànim i adherència.
- Alertes davant canvis persistents respecte del patró personal.

### 5.5 Psicòleg esportiu i coach d’hàbits

- Registre de motivació, estrès, energia, gana i estat emocional.
- Detecció de patrons d’abandonament, frustració o excés d’exigència.
- Objectius realistes i revisió del progrés.
- Estratègies per mantenir hàbits en setmanes difícils.
- Reforç positiu basat en progrés real.
- Preparació mental per curses o reptes.
- Adaptació del missatge al perfil de l’usuari.
- Sense diagnòstic ni substitució d’atenció psicològica professional.

### 5.6 Analista de rendiment

- Evolució de pes, composició corporal, ritmes, watts, freqüència cardíaca i volum.
- Tendències i comparacions amb el propi historial.
- Rècords personals i millores significatives.
- Relacions entre variables: son-rendiment, càrrega-fatiga, dieta-pes, estrès-adherència.
- Informes diaris, setmanals, mensuals i per temporada.
- Prediccions amb interval d’incertesa.
- Explicació de què ha canviat i per què probablement ha canviat.

### 5.7 Suport mèdic preventiu

- Historial de salut, lesions, medicació, analítiques i constants, si l’usuari ho decideix.
- Detecció d’anomalies o canvis persistents respecte del patró personal.
- Recomanació de consultar un professional quan correspongui.
- Resums exportables per compartir amb metges o altres professionals.
- Mai diagnosticar, prescriure ni substituir atenció sanitària.

## 6. Funcionalitats transversals

### Perfil i objectius

- Perfil personal, historial, preferències, limitacions i material disponible.
- Objectius de pes, salut, rendiment, curses i hàbits.
- Objectius principals, intermedis i dates rellevants.
- Seguiment de progrés i reajust automàtic.

### Registre i dades

- Pes i composició corporal.
- Menjars, calories, macros, aigua i sensacions de gana.
- Activitat diària, passos, distància, calories i entrenaments.
- Son, HRV, freqüència cardíaca, VO₂max i recuperació.
- Mesures corporals.
- Hàbits i check-ins diaris.
- Lesions, dolor i limitacions.
- Notes lliures i esdeveniments contextuals.

### Integracions

- Apple Health i Apple Watch.
- Futures integracions amb Garmin, Whoop, Oura, Strava, bàscules i sensors.
- Calendari per adaptar els entrenaments a la disponibilitat real.
- Importació i exportació de dades.
- API modular per afegir noves fonts sense redissenyar el sistema.

### Dashboard i experiència diària

- Resum del dia amb estat, objectius i prioritats.
- Recomanació principal del dia.
- Readiness, càrrega, balanç energètic i progrés.
- Registre ràpid en pocs segons.
- Vista setmanal de pla, compliment i recuperació.
- Gràfiques simples amb explicació, no només números.
- Widgets i notificacions útils, no invasives.
- Experiència mòbil i futura extensió a Apple Watch.

### Coach conversacional

- Conversa amb context personal i memòria de llarg termini.
- Respostes coordinades entre especialistes.
- Possibilitat de preguntar què entrenar, què menjar o com recuperar.
- Explicació de recomanacions i alternatives.
- Distinció entre fets, estimacions i hipòtesis.
- Capacitat de recordar preferències i patrons validats.

### Assistent proactiu

- Alertes de fatiga, falta de recuperació o risc de pèrdua d’hàbit.
- Preparació anticipada de setmanes complicades.
- Ajust del pla davant canvis de calendari.
- Recordatoris contextuals.
- Recomanacions abans que l’usuari les demani.
- Silenci quan no hi ha res realment útil a dir.

### Digital Twin i Knowledge Model

- Model personal que aprèn de la resposta real de l’usuari.
- Estimació de metabolisme, recuperació i tolerància a càrrega.
- Memòria de patrons: què funciona, què no i en quines circumstàncies.
- Coneixement amb evidència, data d’actualització i nivell de confiança.
- Separació entre coneixement general, dades personals i inferències.
- Simulació de possibles decisions: dieta, descans, entrenament o calendari.
- Comparació principal amb un mateix, no amb la població general.

### Planificació i simulació

- Pla d’entrenament adaptatiu.
- Pla nutricional flexible.
- Simulació de trajectòria de pes o rendiment.
- Escenaris del tipus «què passa si aquesta setmana entreno menys?».
- Predicció de dates d’objectiu amb incertesa explícita.
- Recomanacions de mínima acció efectiva en dies difícils.

### Privadesa i control

- Consentiment granular per tipus de dada.
- Separació estricta de dades per usuari amb RLS.
- Funcionament local i sincronització controlada.
- Exportació, portabilitat i eliminació de dades.
- Registre de recomanacions i dades utilitzades.
- Cap ús secundari de dades sense consentiment explícit.

## 7. Roadmap

### Fase 0 — Fonaments

**Objectiu:** establir la direcció i protegir la versió estable.

- Arquitectura inicial.
- Flux Git i rollback.
- Data Dictionary.
- Documentació base i ADR.
- Master Plan.

**Criteri de sortida:** projecte recuperable, documentat i amb una font de veritat clara.

### Fase 1 — Infraestructura robusta

**Objectiu:** disposar d’una base segura, local-first i sincronitzable.

- Supabase DEV.
- Autenticació.
- Esquema inicial i migracions.
- RLS i polítiques per usuari.
- IndexedDB.
- `StorageService`.
- Motor de sincronització i resolució de conflictes.
- Gestió d’errors, còpies i recuperació.
- Tests, CI, preview i rollback.

**Criteri de sortida:** un usuari pot iniciar sessió, treballar offline i sincronitzar dades sense pèrdues ni accés creuat.

### Fase 2 — Nucli personal de salut

**Objectiu:** convertir ATLES en una aplicació útil cada dia.

- Perfil i objectius.
- Pes i mesures.
- Balanç energètic i nutrició inferida.
  - No requereix registre manual d’àpats ni recompte diari de calories.
  - Inference inicial a partir de tendència de pes i dades de despesa disponibles.
  - Dèficit, manteniment o superàvit sempre expressats com a estimació amb incertesa.
  - El registre d’àpats queda com a funcionalitat futura i opcional del nutricionista.
- Activitat i entrenaments.
- Check-in diari.
- Dashboard diari.
- Historial i gràfiques.
- Registre ràpid.

**Criteri de sortida:** l’usuari pot registrar i entendre el seu dia complet des d’una única app.

### Fase 3 — Dades automàtiques i Apple Health

**Objectiu:** reduir al mínim l’entrada manual.

- Importació de passos, calories, pes, son, entrenaments, HRV, freqüència cardíaca i VO₂max.
- Deduplificació i normalització.
- Permisos i control de fonts.
- Sincronització incremental.
- Transparència sobre l’origen de cada dada.

**Criteri de sortida:** ATLES disposa d’un historial fiable i automatitzat de salut i activitat.

### Fase 4 — Primers coaches útils

**Objectiu:** passar de registrar dades a donar criteri.

- Coach nutricional bàsic.
- Coach d’entrenament bàsic.
- Coach de recuperació i son.
- Coach d’hàbits i motivació.
- Recomanacions diàries explicables.
- Coordinador de recomanacions.

**Criteri de sortida:** cada dia ATLES pot recomanar una acció concreta, coherent i justificada.

### Fase 5 — Planificació adaptativa

**Objectiu:** construir plans que canviïn amb la realitat.

- Plans d’entrenament per objectius.
- Progressió de càrrega.
- Planificació nutricional flexible.
- Integració amb calendari.
- Replanificació automàtica.
- Preparació de curses i reptes.

**Criteri de sortida:** el pla s’adapta als entrenaments fets, la recuperació i la disponibilitat real.

### Fase 6 — Motor predictiu

**Objectiu:** anticipar evolució i riscos.

- Tendència de pes i composició corporal.
- Predicció de rendiment.
- Risc d’abandonament.
- Detecció d’estancament, sobrecàrrega i mala recuperació.
- Escenaris i simulacions.
- Incertesa i confiança explícites.

**Criteri de sortida:** les prediccions són mesurables, revisables i milloren respecte de regles genèriques.

### Fase 7 — Digital Twin

**Objectiu:** modelar com respon cada persona.

- Perfil metabòlic personal.
- Tolerància individual a la càrrega.
- Patrons de son, gana, estrès, motivació i rendiment.
- Knowledge Model amb evidències i confiança.
- Aprenentatge continu i correcció de conclusions.
- Comparació amb el propi historial.

**Criteri de sortida:** ATLES distingeix clarament entre recomanacions generals i conclusions personals validades.

### Fase 8 — Elite Mode

**Objectiu:** oferir l’experiència d’un equip de rendiment coordinat.

- Preparador físic avançat.
- Nutricionista avançat.
- Especialista en recuperació.
- Psicòleg esportiu i coach d’hàbits.
- Analista de rendiment.
- Suport mèdic preventiu.
- Coordinador general que resol conflictes entre especialistes.
- Informes integrats diaris, setmanals i per temporada.

**Criteri de sortida:** l’usuari rep una estratègia única i coherent, no sis opinions independents.

### Fase 9 — Assistent proactiu

**Objectiu:** anticipar les necessitats de l’usuari.

- Recomanacions contextuals abans que siguin demanades.
- Adaptació a calendari, viatges, vacances i càrrega laboral.
- Alertes intel·ligents i silencioses quan no cal intervenir.
- Preparació de dies i setmanes clau.
- Seguiment posterior per comprovar si la recomanació ha funcionat.

**Criteri de sortida:** la proactivitat aporta valor mesurable sense generar soroll ni dependència.

### Fase 10 — Salut integral i Health OS

**Objectiu:** coordinar tot l’ecosistema personal de salut.

- Analítiques, constants, medicació i antecedents.
- Lesions, fisioteràpia i retorn a l’activitat.
- Informes per a professionals.
- Nous dispositius i fonts de dades.
- API i ecosistema d’integracions.
- Control complet, portabilitat i governança de dades.

**Criteri de sortida:** ATLES actua com a capa personal d’intel·ligència sobre tot l’ecosistema de salut, sense substituir professionals.

## 8. Prioritat immediata

La visió completa és ambiciosa, però l’ordre és obligatori:

1. Seguretat i persistència.
2. Dades fiables.
3. Experiència diària útil.
4. Integracions automàtiques.
5. Recomanacions basades en regles transparents.
6. Predicció i personalització avançada.
7. Equip virtual coordinat.

No s’implementarà una funcionalitat avançada si depèn de dades o fonaments que encara no són fiables.

## 9. Regla per incorporar funcionalitats

Cada nova funcionalitat ha de respondre:

1. Quin problema real resol?
2. A quina fase pertany?
3. Quines dades necessita?
4. Quin especialista o component la utilitza?
5. Quin coneixement genera?
6. Com millora el Digital Twin?
7. Com s’explica a l’usuari?
8. Quin risc de privadesa o salut introdueix?
9. Com sabrem que funciona?

Si no contribueix a la missió o arriba abans que els seus fonaments, no es desenvolupa encara.

## 10. Definició final

ATLES no és una app de calories ni un simple chatbot. És un sistema operatiu personal de salut i rendiment que converteix dades disperses en criteri personalitzat, aprèn de cada usuari i coordina un equip virtual d’especialistes per ajudar-lo a prendre millors decisions durant tota la vida.
