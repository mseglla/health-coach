# Health Coach v0.2

PWA mobile-first per registrar pes, calories ingerides, calories actives i passos.

## Estructura

- `css/tokens.css`: design tokens.
- `css/base.css`: estils globals.
- `css/components.css`: components reutilitzables.
- `css/screens.css`: estils específics de pantalles.
- `js/calculations.js`: càlculs purs.
- `js/coach.js`: regles inicials de decisió.
- `js/storage.js`: persistència i migració de dades.
- `js/ui.js`: renderitzat de la interfície.
- `js/app.js`: inicialització i esdeveniments.

## Executar localment

Els mòduls JavaScript requereixen un servidor local. Des del directori del projecte:

```bash
python3 -m http.server 8000
```

Obre `http://localhost:8000`.
