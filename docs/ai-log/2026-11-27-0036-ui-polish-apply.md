# 2026-11-27 · 0036-ui-polish · apply, grupos 1–5

- Subagente `sdd-implementer` (Claude Code, claude-opus-5-5) en el worktree
  `tfm-survivors/.claude/worktrees/youthful-napier-bd6ed0`, rama `change/0036-ui-polish`. `node_modules` ya
  instalado y `core.hooksPath` = `.husky/_`: el pre-commit corrió en todos los commits.
- Sin núcleo: todo *test-after* (ADR-0018). `origin/main` no avanzó durante el apply (sin rebase).
- `npm run verify` en verde al cerrar cada grupo; `npm run test:e2e` completo en verde (19 tests `logic`).

## Consultas de API
- MCP `phaser-docs` (herramientas `mcp__phaser-docs__*`): `search_phaser_docs` «Image setCrop» y
  `read_phaser_doc` de `namespace/gameobjects-components-texturecrop` (`docs: "api"`, publicada 4.1.0).
  `setCrop(x, y, w, h)` en coordenadas del frame, sin cambiar el tamaño del objeto y escalado con él; los tipos de
  `node_modules/phaser` 4.2.1 tienen la misma firma. De ahí `cropPose`: origen en el centro del recorte y escala
  lado / ancho del recorte.

## Ajustes del design durante el apply
- Recortes del HUD medidos con `tests/support/png.ts` (regla de D5): calavera (frame 5) 44, 54, 47 × 47; oro
  44, 49, 52; madera 37, 61, 53; roca 16, 13, 33. Las cifras del design eran orientativas.
- `BUILD_TEXT_MAX` (64) se aplica al texto **mostrado** tras interpolar, no al crudo: el crudo de la casa, con
  sus marcadores, mide 74 caracteres y lo que se ve, 16. El mensaje sigue siendo `GUIDE_BUILD_TOO_LONG`.
- `buildingIcons` devuelve `{ url, width, height }` por edificio (el design decía solo la URL): el panel necesita
  el tamaño del frame para los atributos `width`/`height` de la imagen.
- La × mide 48·k + 2 px y se coloca a 16·k − 1 px: el borde de 1 px de la reserva (y del recuadro) descentraba el
  glifo 1 px y alejaba la × 1 px de la esquina. Además de `place-items`, hace falta `place-content: unsafe center`:
  sin él la pista de la rejilla (el ancho del glifo) desbordaba solo a la derecha (3,6 px de Δx en el E2E).
- `createHud(scene, frame, icons, metrics, ui?)`, `hudIcons(appearance, looks, frames)` y `killsIcon` (reserva si
  `Dead.png` no cargó o el frame no existe). `MobileEnv` gana `hud` (las medidas entran en k_max).
- Test de `dom-unchanged`: la instantánea se regeneró y una segunda, «antes de 0036», deshace solo las diferencias
  permitidas; se comprobó que es idéntica, carácter a carácter, a la instantánea de antes del change.
- Shop E2E: la tienda se cierra ahora con la × (Esc en la tienda lo sigue usando el E2E de los solares y los
  tests de Node comparan los dos caminos campo a campo).

## Incidencias
- Dos heredocs de Git Bash con comillas invertidas dentro de `node -e` rompieron comentarios de JSDoc; se
  corrigieron con Edit y el resto de ediciones se hicieron con scripts en el scratchpad (AGENTS §8.1). Ningún hook
  bloqueó nada.
- Contradicción en la spec (`sprite-rendering`, «Golpe que deja la estructura en ruina»): pide que la casa con vida
  4 de 60, pintada en n − 1, no tenga barra, pero el requisito la define como dañada (vida < máxima) y por tanto con
  barra. Se implementa el requisito; el test conserva la barra en n − 1 y comprueba que no hay ninguna de n a n + 60.
  Queda devuelto al orquestador.
- Cruce de títulos de escenario con `tests/`: sin test propio quedan los de `main-menu` («Menú centrado en dos
  ventanas», «Jugar tras redimensionar el menú», «Diálogo abierto al redimensionar», «Pausa centrada y operativa
  tras redimensionar», «Guía abierta al redimensionar», «Cerrar la guía con la × tras redimensionar») y «Volver al
  menú con cadáveres en curso», copiado sin cambios en el MODIFIED de `sprite-rendering`: E2E retirados en
  `e2e-lite`, aceptados por la regla (tasks 5.1).
