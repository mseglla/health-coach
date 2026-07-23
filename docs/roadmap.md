# Roadmap d’ATLES

## Regla principal

La prioritat és construir una base fiable. No s’afegeixen funcionalitats grans sobre una arquitectura no validada.

## Fase 0 — Estabilitat

- [x] Restaurar la v0.3 estable.
- [x] Crear `stable/v0.3`.
- [x] Documentar rollback.
- [x] Crear `develop`.
- [ ] Crear tag/release `v0.3-stable`.

## Fase 1 — Arquitectura i procés

- [x] Arquitectura local-first documentada.
- [x] Model inicial de Supabase documentat.
- [x] Flux de desplegament documentat.
- [ ] Definir criteris d’acceptació de la nova base.
- [ ] Crear entorn preview/staging.
- [ ] Afegir proves de navegació automatitzades.

## Fase 2 — Persistència local robusta

- [ ] Dissenyar repositoris de dades desacoblats de la UI.
- [ ] Introduir IndexedDB sense eliminar localStorage.
- [ ] Migració localStorage → IndexedDB provada i reversible.
- [ ] Exportació/importació de còpies.
- [ ] Proves de persistència i recuperació.

## Fase 3 — Supabase mínim

- [ ] Crear projecte DEV.
- [ ] Configurar Auth.
- [ ] Crear migracions SQL versionades.
- [ ] Crear `profiles`, `goals` i `weight_logs`.
- [ ] Activar i provar RLS.
- [ ] Sincronitzar només pesos com a pilot.
- [ ] Provar offline, conflictes i recuperació.

## Fase 4 — Sincronització completa

- [ ] Àpats.
- [ ] Activitats.
- [ ] Resums diaris.
- [ ] Estat visible de sincronització.
- [ ] Reintents i registre d’errors.
- [ ] Recuperació en un segon dispositiu.

## Fase 5 — Nova interfície v0.4

Es desenvolupa en blocs petits sobre la base validada:

1. Navegació.
2. Registre ràpid.
3. Diari.
4. Progrés.
5. Perfil.
6. Coach.

Cada bloc necessita preview i prova real abans de passar al següent.

## Fase 6 — Vercel

- [ ] Connectar repositori.
- [ ] Configurar producció, staging i previews.
- [ ] Variables d’entorn.
- [ ] Rollback provat.
- [ ] Retirar GitHub Pages només després de validació.

## Fase 7 — Funcionalitats avançades

- Apple Health mitjançant app nativa o wrapper adequat.
- IA per interpretar àpats.
- Fotos d’àpats.
- Predicció de pes.
- Informes compartibles.
- Coach adaptatiu.

## Fora d’abast immediat

- No simularem integració directa amb Apple Health des d’una PWA web.
- No publicarem una nova UI completa d’un sol cop.
- No afegirem IA abans de tenir autenticació, persistència i sincronització fiables.