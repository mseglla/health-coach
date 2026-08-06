# Desplegament i rollback

## Branques

- `main`: producció estable.
- `develop`: integració i pròxima versió.
- `feature/*`: una funcionalitat o canvi concret.
- `stable/v0.3`: referència de recuperació de la versió estable actual.

## Flux obligatori

```text
feature/* → PR a develop → proves → merge

develop → preview/staging → proves mòbils reals → PR a main → producció
```

No es fan commits funcionals directament a `main`.

## Criteris per fusionar a develop

- Objectiu i criteris d’acceptació definits.
- Canvi petit i revisable.
- Sintaxi i tests automàtics en verd.
- Sense regressions conegudes.
- Migracions i canvis de dades documentats.

## Criteris per fusionar a main

- Preview o staging accessible.
- Prova real en Safari iPhone.
- Navegació completa.
- Formularis principals.
- Persistència després de tancar i reobrir.
- Comportament sense connexió validat: els formularis de salut queden bloquejats i no es mostra cap guardat fals.
- Migració de dades existents verificada.
- Service worker i actualització de PWA verificats.
- Pla de rollback identificat.
- CI en verd.

## Checklist de prova manual

1. Obrir la pantalla inicial.
2. Navegar per totes les pestanyes.
3. Obrir i tancar tots els modals o sheets.
4. Crear, editar i eliminar un pes.
5. Crear, editar i eliminar un àpat.
6. Crear, editar i eliminar una activitat.
7. Tancar completament l’app i reobrir.
8. Comprovar que les dades continuen existint.
9. Activar mode avió i comprovar que no es poden crear ni modificar registres de salut.
10. Comprovar que l’error de connexió és visible i que no apareix cap confirmació falsa de guardat.
11. Recuperar connexió i comprovar que les dades remotes es carreguen correctament.
12. Verificar que no hi ha elements bloquejant la navegació.
13. Verificar safe areas i teclat a iPhone.

## Rollback

Versió estable actual:

- branca: `stable/v0.3`
- commit: `ee70aef35f3795f89f06c52c474d9ecf27307aa5`

En una incidència crítica:

1. Aturar merges.
2. Guardar el SHA de la versió defectuosa.
3. Restaurar `main` al commit estable o revertir el merge.
4. Esperar el desplegament.
5. Verificar la web pública amb un paràmetre de cache busting.
6. No indicar a l’usuari que esborri dades locals abans d’analitzar la migració.
7. Crear una incidència amb causa, impacte i correcció.

## Configuració pública de Supabase

El frontend pot contenir exclusivament:

- URL pública del projecte Supabase.
- Publishable key del projecte.
- Versió fixada del SDK oficial.

No es poden incloure mai al frontend:

- `service_role`.
- Secret keys.
- Contrasenya de la base de dades.
- Tokens personals o credencials d’usuaris.

El SDK de Supabase es carrega sota demanda. Supabase és la font de veritat dels registres de salut del compte. Sense sessió o connexió, l’aplicació no permet crear ni modificar aquests registres i ha de mostrar un estat d’error clar.

## GitHub Pages i Vercel

GitHub Pages continua com a producció pública temporal fins que `develop` es promocioni explícitament a `main` i es validi el desplegament final.

Vercel ja està connectat al repositori i s’ha validat amb producció, staging i previews automàtiques.

A Vercel:

- `main` → Production.
- `develop` → Staging.
- `feature/*` → Preview deployments.
