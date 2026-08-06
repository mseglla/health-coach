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

- [x] Arquitectura online-first documentada.
- [x] Model inicial de Supabase documentat.
- [x] Flux de desplegament documentat.
- [x] Definir criteris d’acceptació de la nova base.
- [x] Crear entorn preview/staging.
- [ ] Afegir proves de navegació automatitzades.

## Fase 2 — Persistència local heretada i migració

- [x] Dissenyar repositoris de dades desacoblats de la UI.
- [x] Introduir IndexedDB sense eliminar localStorage.
- [x] Migració localStorage → IndexedDB provada i reversible.
- [x] Exportació/importació de còpies.
- [x] Proves de persistència i recuperació.

## Fase 3 — Supabase mínim

- [x] Crear projecte DEV.
- [x] Configurar Auth.
- [x] Crear migracions SQL versionades.
- [x] Crear `profiles`, `goals` i `weight_logs`.
- [x] Activar i provar RLS.
- [x] Sincronitzar pesos com a pilot.
- [x] Sincronitzar resums diaris.
- [x] Simplificar el comportament sense connexió, sense cues ni conflictes.

## Fase 4 — Sincronització completa

- [ ] Activitats.
- [x] Estats visibles de connexió, càrrega i error.
- [x] Recuperació en un segon dispositiu.

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

- [x] Connectar repositori.
- [x] Configurar producció, staging i previews.
- [x] Validar que la configuració pública actual no requereix variables d’entorn.
- [x] Rollback provat.
- [ ] Retirar GitHub Pages només després de validació.

## Fase 7 — Funcionalitats avançades

- Apple Health mitjançant app nativa o wrapper adequat.
- Predicció de pes.
- Informes compartibles.
- Coach adaptatiu.

## Fora d’abast immediat

- No simularem integració directa amb Apple Health des d’una PWA web.
- No publicarem una nova UI completa d’un sol cop.
- No afegirem IA abans de tenir autenticació, persistència i sincronització fiables.
