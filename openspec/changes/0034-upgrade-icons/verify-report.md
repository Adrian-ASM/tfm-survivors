# Verify report · 0034-upgrade-icons

Rama `change/0034-upgrade-icons` (8d82d09..1eb62fb sobre 0166807). Verificador independiente.

## Ejecución

| Comando | Resultado |
|---|---|
| `npm run verify` | OK: lint, tsc, guard:all (1298 ficheros), 350 ficheros / 4238 tests en verde |
| `npm run test:e2e` | OK: 19 passed (proyecto `logic`) |

## Comprobaciones pedidas

- Regenerar `scripts/icons/draw-icons.mjs` en carpeta temporal fuera del repo: 18/18 PNG con el sha256 de `generated[]`; los ficheros del repo también coinciden (0 diferencias).
- Núcleo: `git diff 0166807..HEAD -- src/domain src/application` vacío. Solo cambian `content/appearance.json` y `content/asset-provenance.json`; `tests/support/balanceBaseline.ts` intacto (balance idéntico a `BALANCE_BASELINE`, el lote del bot sigue en verde).
- `guard-assets` rechaza imágenes IA fuera de `public/assets/icons/`: escenario "Imagen con IA fuera de los iconos" cubierto en `tests/guardrails/assets.test.ts`; `guard:all` pasa sobre el repo real.
- tasks.md: 14 tareas `[x]`, 0 pendientes; 8 commits de grupo (guardarraíl, datos, carta, tienda, composición, iconos, E2E, docs).
- e2e-lite: 0 tests E2E nuevos; se amplían la "Tienda" de `gameplay.spec` (7 filas `painted`, cartas `painted`) y `tests/remote/public.spec.ts` (a demanda). Cumple ≤ 2. Sin umbrales de fps ni de tiempo.
- Cambio de origen (Claude en lugar de Antigravity) documentado en design.md D-apply, ai-log del apply y GDD; la nota lo refleja en `tool`/`postProcess`.

## Escenario → Test → Estado

| Grupo de escenarios (specs) | Test | Estado |
|---|---|---|
| asset-provenance: procedencia IA (9 casos de registro, sin registro, sin fichero, fuera de iconos, política sin ADR, ruta en dos listas, sin versión del pack, sin red) y regresiones de la nota | `tests/guardrails/assets.test.ts` | OK |
| asset-provenance: iconos medidos, tamaño/alfa, icono de más, estado real del repo | `tests/content/upgrade-icons.test.ts`, `tests/support/pngProbe.ts` | OK |
| castle-shop: siete filas, producto sin icono, imagen que no carga, reglas, clic sobre el icono, overlay | `tests/infrastructure/shop-panel.test.ts` + E2E Tienda | OK |
| upgrades: datos, id desconocido, mejora sin entrada, datos inválidos, no cambia la simulación | `tests/infrastructure/icons-appearance.test.ts`, `tests/composition/content-boot.test.ts`, balance base | OK |
| upgrades: resolución, reserva de otra categoría | `tests/infrastructure/upgrade-icons.test.ts` | OK |
| upgrades: URLs, filtro sin suavizado, partida con todos sin cargar | `asset-url.test.ts`, `boot-plan.test.ts`, `ui-fallback-run.test.ts` | OK |
| upgrades: estados en la sonda / iconos en oferta y tienda [E2E] | `icon-probe.test.ts` + `gameplay.spec.ts` (Tienda ampliada) | OK |
| sprite-rendering: aspecto con IA, icono que falla sin reserva, hojas/UI sin regresión | `appearance-*.test.ts`, `ui-fallback-run.test.ts` | OK |
| sprite-rendering/upgrades: icono en la carta (k entero y fraccionario, descripción larga, sin icono, no cargan, reserva, clic y RESIZE) | `upgrade-overlay-icons.test.ts`, `card-layout.test.ts`, `upgrade-overlay.test.ts` | OK |
| Arte en la URL pública | `tests/remote/public.spec.ts` | OK (a demanda) |

## Hallazgos

### Critical
Ninguno.

### Warning
Ninguno.

### Suggestion
1. S1: la cobertura de escenarios se comprobó por título y por revisión de ficheros; la correspondencia es 1:1 con las specs. Ningún test aparece vacío o tautológico en las muestras revisadas.
2. S2: el aviso de que los iconos son obra de un script determinista (no de un modelo de imagen) vive en la nota y el ai-log. Conviene mencionarlo en la retrospectiva del archive para que la procedencia "IA" no se interprete como imagen generativa.

**C: 0 · W: 0 · S: 2**
