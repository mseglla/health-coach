# Registre de decisions d’ATLES

## ADR-001 — Arquitectura local-first

**Estat:** acceptada.

ATLES funcionarà sobre dades locals i sincronitzarà amb Supabase. La xarxa no bloquejarà l’ús bàsic.

**Motiu:** l’app s’utilitza principalment al mòbil i ha de continuar funcionant amb connexió inestable.

## ADR-002 — IndexedDB com a persistència futura

**Estat:** acceptada, pendent d’implementació.

localStorage es manté a la versió estable fins tenir una migració provada. IndexedDB serà la persistència principal de la nova base.

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

**Estat:** proposta acceptada a nivell d’arquitectura; pendent de validar a l’esquema SQL.

Els registres sincronitzables utilitzaran UUID i `deleted_at` per evitar pèrdues i permetre propagar eliminacions.

## ADR-009 — Apple Health no és una funció web directa

**Estat:** acceptada.

Una PWA no prometrà accés directe complet a Apple Health. Aquesta integració requerirà una capa nativa o una solució específica futura.