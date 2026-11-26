# 2026-11-26 · GDD · UI del pack, iconos de mejoras y audio (0032–0034) y renumeración 0035–0036

- Con 0031 `combat-feedback` hecho, el autor aprobó tres changes nuevos justo después, todos Should y sin subir
  ningún Must: 0032 `ui-kit` (banners, botones, ribbons y paneles de Tiny Swords en la apariencia general), 0033
  `upgrade-icons` (iconos para las 9 mejoras de personaje y las 6 de arma) y 0034 `audio` (música, efectos y opciones
  de volumen/silencio guardadas en local).
- "UI del pack" y "audio" subieron de Could a Should; las "opciones de audio" del Should quedaron absorbidas por 0034.
  0033 va después de 0032 porque el icono se encaja en el marco de carta de la UI del pack.
- Contexto de 0033: una prueba previa en otra sesión generó 4 imágenes con Antigravity y se agotó el cupo gratuito.
  El Won't actual es "enemigos dibujados con IA"; los iconos no son enemigos, pero hace falta una regla y un registro
  (herramienta, fecha, términos de uso, prompt). Probable ADR, decisión del autor.
- Contexto de 0034: Tiny Swords no trae audio. Fuentes CC0 candidatas (Kenney, OpenGameArt, Freesound, jsfxr) y la
  aceptación de CC-BY con atribución quedan para explore y decisión del autor. El guardarraíl de procedencia
  (`.claude/hooks/guard-assets.mjs`) tendrá que cubrir `.ogg`, `.mp3` y `.wav`.
- El subagente `game-designer` editó solo `docs/gdd.md`:
  - Añadió las historias 0032, 0033 y 0034 con criterios Given/When/Then, riesgos de procedencia y preguntas
    abiertas.
  - Renumeró `goblin-tower-archers` de 0032 a 0035 y `characters` de 0033 a 0036 (línea de enemigos, backlog MoSCoW,
    nota del bloque de contenido 0020–0036, encabezados de historias, balance-pass-2 y tabla "Orden tentativo").
  - Añadió tres filas nuevas a la tabla con su "Spike previo" (inventario de piezas UI de Update 010; política de
    imágenes IA y herramienta; fuentes CC0 y si la música encaja) y el párrafo "Renumeración (2026-11-26)".
- No se tocaron specs, código, ADRs ni otros docs. Preguntas abiertas de cada change: ver sus historias en el GDD.
