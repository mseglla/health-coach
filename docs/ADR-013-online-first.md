# ADR-013 — Arquitectura online-first

**Data:** 2026-08-04  
**Estat:** acceptada  
**Substitueix parcialment:** ADR-001 i ADR-002

## Context

ATLES s’utilitzarà gairebé sempre amb connexió. Mantenir una arquitectura local-first completa obliga a construir i mantenir cues de canvis, resolució de conflictes, sincronització bidireccional, tombstones, recuperació d’errors i dues fonts potencials de veritat.

Aquesta complexitat no aporta prou valor en l’etapa actual i pot frenar els objectius principals: Apple Health, analítica personal, coaches i Digital Twin.

## Decisió

ATLES adopta una arquitectura **online-first**:

- Supabase és la font de veritat.
- Les funcionalitats principals requereixen connexió.
- Sense connexió, l’app mostra un missatge clar i no permet operacions que puguin perdre’s.
- No es desenvoluparà ara un motor general de cues offline ni resolució de conflictes.
- IndexedDB i localStorage existents es mantindran temporalment per compatibilitat, migració o memòria cau, però deixen de ser la base estratègica.
- La UI continuarà desacoblada mitjançant serveis o repositoris perquè la decisió pugui revisar-se en el futur.

## Conseqüències positives

- Arquitectura més simple.
- Menys risc de duplicats i conflictes.
- Menys codi crític a mantenir.
- Supabase concentra autenticació, seguretat i persistència.
- Més rapidesa per arribar a Apple Health, analítica, coaches i Digital Twin.
- Recuperació entre dispositius més directa.

## Costos i limitacions

- L’app no serà operativa sense connexió.
- Cal dissenyar bons estats de càrrega, error i absència de xarxa.
- Una caiguda de Supabase impedirà temporalment l’ús.
- Les escriptures només es confirmaran quan el servidor les accepti.

## Salvaguardes

- Exportació i còpies de dades.
- Migracions versionades.
- RLS provada.
- Gestió explícita d’errors.
- Serveis desacoblats de la UI.
- Possibilitat d’afegir una memòria cau o suport offline parcial més endavant si les dades d’ús ho justifiquen.
