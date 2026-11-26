# 2026-11-26 · 0034-upgrade-icons · apply, grupos 1–5 (borrador)

- Subagente `sdd-implementer` (Claude Code, claude-opus-5-5) en el worktree
  `tfm-survivors/.claude/worktrees/youthful-napier-bd6ed0`, rama `change/0034-upgrade-icons`. `node_modules` ya
  instalado y `core.hooksPath` = `.husky/_`: el pre-commit (lint-staged + `guard-staged`) corrió en todos los
  commits. `origin/main` no avanzó durante el apply: sin rebases.
- Sin núcleo: todo *test-after* (ADR-0018). `src/domain` y `src/application` sin cambios; `BALANCE_BASELINE`
  idéntica semilla a semilla (gate de `verify`).
- Solo los grupos 1–5 (código sin ningún PNG, sección `icons` ausente). El grupo 6 espera los iconos del autor.

## Consultas de API
- MCP `phaser-docs` (`search_phaser_docs`, `docs: "api"`) para `Image.setTexture` / `setDisplaySize`: la página
  de `gameobjects-image` lista los dos como heredados (`Components.Size`, `Components.Texture`). Contrastado con
  los tipos de `node_modules/phaser` 4.2.1.
- `TextureManager.js` de 4.2.1: la textura `__DEFAULT` se crea siempre en el arranque; es la inicial de los 3
  `Image` de icono (ocultos hasta la primera oferta).

## Decisiones de apply
- `ShopPanel.view` devuelve `products: []` con la tienda cerrada: el design (D7) daba por hecho que ya era así, pero
  `snapshot.shop.products` existe en todo estado. La spec ("con la tienda cerrada, la de filas" vacía) manda.
- `.shop-panel__name` con `grid-column: 2` fijo: con el icono oculto (`none`, `display: none`) los textos no
  cambian de columna.
- `applyNearest(FilterBook, keys)` en `bootPlan.ts`: costura pura para el `NEAREST` de piezas de UI e iconos, que
  hace probable "Filtro sin suavizado" sin Phaser.
- `FakeElement.clickBubbling()` en el DOM falso para "Clic sobre el icono" (el `<img>` está dentro del botón).

## Incidencias
- Un `node -e` con comillas dobles en Git Bash interpretó los acentos graves de un comentario como sustitución de
  órdenes y estropeó `UpgradeOverlay.ts`; se revirtió con `git checkout` y se rehízo con Edit (AGENTS §8.1:
  código con Edit/Write). Ningún hook bloqueó nada.

## Grupo 6 · contenido (un solo lote, 6.1–6.3)
- Cambio de origen decidido por el autor: no entran las 4 imágenes de prueba de Antigravity ni
  `remove-white-bg.ps1`. Los 18 iconos (16 `<id>.png` + 2 reservas) los dibujó el orquestador (Claude Code,
  Claude Opus 5.5) con `scripts/icons/draw-icons.mjs`: pixel art determinista sin dependencias (rejilla 32 × 32,
  bisel, contorno automático, 64 × 64 RGBA transparente). Anotado en design D8/D9 y en ADR-0030.
- El script no pasaba prettier: se formateó sin tocar el dibujo y se regeneró en una carpeta temporal; los 18 sha256
  salieron idénticos a los PNG entregados, así que no hubo que recalcular nada.
- `generated[]`: 18 entradas con `tool`, `createdOn` 2026-11-26, términos de consumo de Anthropic §4 (leídos
  2026-11-26), prompt (encargo común + objeto + función del script), `postProcess` = el propio generador (matiz en
  design D8) y sha256/bytes medidos. `generatedPolicy` apunta al ADR-0030.
- Sección `icons` obligatoria: unas 30 llamadas de test a `parseAppearance`/`bootContent` ganan `GENERATED_PATHS`
  con un codemod de un solo uso (en el scratchpad, sin versionar). `JSON.stringify` + prettier habría reescrito el
  formato compacto de `appearance.json`: se revirtió y la sección se añadió con Edit.
- La comparación "listas de arte y fuentes iguales a las de antes" usa una huella sha256 fija: el CI clona sin
  historia y `git show <sha>` fallaría.

## Grupos 7–8 · E2E y documentación
- E2E: se amplió el test de la Tienda de `gameplay.spec` (escucha de CSP, 7 filas `painted` y, tras salir,
  `stepUntil` hasta la primera oferta con 3 cartas `painted`). Suite `logic` entera en verde (19 tests).
- Smoke remoto (`tests/remote/public.spec.ts`, a demanda, **no se ejecutó**): pide los 18 iconos con 200
  `image/png`. De paso deja de leer `appearanceJson.gem`, que no existe desde 0022 (la lectura de `.sheet` habría
  roto el módulo al lanzarlo).
- Docs: GDD (Won't, nota de 0032, sección y fila de 0034) y AGENTS.md §1 con el estado de 0034. ADR-0030 sigue
  "propuesta": pasa a "aceptada" al archivar. Sin cupo ni herramienta externa: el único "prompt" es el encargo
  registrado en cada entrada de `generated[]`.
