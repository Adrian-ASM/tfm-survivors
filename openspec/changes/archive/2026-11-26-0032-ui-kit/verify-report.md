# Verify report · 0032-ui-kit

Resultado: `npm run verify` verde (guard:all 1.237 ficheros, 334 ficheros y 3.968 tests). `npm run test:e2e` verde (17 de 17).

## Comprobaciones
- Diff de `src/domain` y `src/application` entre 83f6cd3~1 y HEAD: 0 líneas. `tests/domain` y `tests/application` sin cambios.
- `BALANCE_BASELINE` y las seis firmas: no tocados. `ui-invariance.test.ts` fija 820/904 objetos del mapa en las semillas 42 y 123 y compara 1.200 ticks con otra `ui`.
- Procedencia: 8 piezas y la fuente tienen entrada en `content/asset-provenance.json`, todas bajo `UI/`. Nada del Free Pack. `OFL.txt` versionado.
- CSP: `index.html` sin cambios.
- E2E (e2e-lite): 0 nuevos y 1 ampliado (`smoke.spec`, "Arranque y menú"). Sin umbrales de tiempo.
- Escenarios: 79 en las specs. 76 tienen test por título. Los otros tres ("Menú con piezas en el navegador", "Partida con arte", "Desde el menú") se cubren con E2E: el primero es el ampliado y los otros dos son E2E existentes sin cambios.
- Hooks: los 5 commits del change llevan `refs` y `Assisted-by`. El reflog muestra que los commits `wip` temporales (con `--no-verify`) se deshicieron con `reset` y no están en la rama.

## Escenario → Test → Estado
| Escenario | Test | Estado |
|---|---|---|
| asset-provenance (piezas, integridad, sin entrada, Free Pack, iconos, fuente, registro) | `tests/guardrails/assets.test.ts`, `ui-provenance.test.ts` | OK |
| sprite-rendering (datos `ui`, variables, reservas, arranque con fuente, invariancia, partida en reserva) | `appearance-ui`, `ui-kit`, `ui-font`, `boot-plan`, `ui-fallback-run`, `ui-invariance` | OK |
| hud, upgrades (cartas) | `hud-panels`, `ui-panel`, `ui-layout`, `upgrade-overlay` | OK |
| main-menu, menu-guide, castle-shop, build-sites, run-results | `styles-ui`, `dom-unchanged`, `ui-fallback-run` | OK |
| main-menu "Menú con piezas en el navegador" | `smoke.spec.ts` (ampliado) | OK |
| sprite-rendering E2E existentes | `gameplay.spec`, `smoke.spec` | OK, sin cambios |

## Desviaciones del implementer
- Margen del HUD 24, textos de carta anclados, `--ui-panel-on-bg: transparent`, `WEBGL_RENDERER` local y `damageNumberStyle`: aceptables, documentadas en `tasks.md` y en el diario de IA. Sin cambio de valores en los números de daño.

## Hallazgos
### Critical
Ninguno.

### Warning
- W1: el diario `docs/ai-log/2026-11-26-0032-apply.md` cuenta un solo commit WIP con `--no-verify`. El reflog muestra tres commits `wip` (06ba0c8, 6c95816 y a925123, este último un cherry-pick del rebase). Los commits finales no se saltaron los hooks, pero el diario debería decir cuántos fueron. Tampoco se puede probar con el reflog que los 5 commits finales pasaron el hook. Lo respalda `guard:all` en verde.
- W2: ADR-0028 sigue en "propuesta". Pasa a "aceptada" al archivar, como prevé la tarea 5.3.

### Suggestion
- S1: tres escenarios se localizan solo por E2E o por texto distinto del título. Convendría citar el título exacto en el comentario del test.
- S2: el diff de `src/domain` y `src/application` se comprobó a mano, no con un test. Es decisión documentada, porque `merge-base` falla en el checkout superficial del CI.

C: 0 · W: 2 · S: 2
