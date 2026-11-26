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
