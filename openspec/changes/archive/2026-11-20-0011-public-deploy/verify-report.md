# Verify report · 0011-public-deploy

Base de comparación: `origin/main..HEAD` (12 commits, `ebe607f..6f90b93`). Auditor distinto del implementer.

## Ejecuciones
| Comprobación | Resultado |
|---|---|
| `npm run verify` | Verde: 106 ficheros, 1196 tests |
| `npm run test:e2e` | Verde: 48 passed (1,3 min) |
| `npx playwright test --list` | 48 tests en 13 ficheros (igual que main) |
| `git diff --quiet origin/main -- .github/workflows/ci.yml tests/guardrails/ci.test.ts` | exit 0 |
| `npm run smoke:public` (URL pública) | 4 passed, 7,3 s Playwright, 8,0 s de reloj (límite 180 s). Sin build ni preview |
| `npm run build` + `dist/index.html` | Scripts y CSS bajo `/tfm-survivors/`; 1 meta CSP; 0 apariciones de `frame-ancestors`, `report-uri`, `report-to` ni `sandbox` |
| Última ejecución de `ci` en main | Id **44796176861** (push, success, 3m45s). Jobs: setup, quality, e2e, deploy, todos `success` |

## Matriz escenario → evidencia
| Escenario | Test / evidencia | Estado |
|---|---|---|
| Push a main con código y CI en verde | `tests/guardrails/deploy.test.ts` (needs, if, path dist, con variantes mutadas) | OK |
| Pull request en verde | `deploy.test.ts` (condición de push a main) | OK (estático) |
| Push a main solo de documentación | `deploy.test.ts` (`paths-ignore` con las 5 rutas) | OK (estático) |
| Push a main con e2e en rojo | `deploy.test.ts` (`needs: [quality, e2e]`) | OK (estático) |
| Evidencia del despliegue vigente | Run 44796176861, 4 jobs en verde | OK |
| Rutas del index.html publicado | `target.test.ts` (`localAssetRefs`) + T1 en `public.spec.ts` + lectura de `dist/index.html` | OK |
| Sin recursos rotos en la URL objetivo | T1 (verde contra la URL pública) | OK |
| Ruta inexistente bajo la base | T2 (verde, URL pública) | OK |
| Carga limpia | T1 (`cspState`, 0 `pageerror`, `https://`) | OK |
| Directivas que la meta ignora | `csp.test.ts` (+`report-to`), T1 sobre el HTML servido, `dist` revisado a mano | OK |
| HTTP redirige a HTTPS | T3 (verde) | OK |
| Riesgo aceptado documentado | `deploy-docs.test.ts` sobre ADR-0004 | OK |
| Jugar, guardar, exportar e importar | T4 (verde, 5,9 s) | OK |
| Persistencia tras recargar | T4 (mismo test) | OK |
| Smoke en verde contra la URL pública | Ejecución propia: exit 0 en 8 s | OK |
| URL objetivo alternativa | `target.test.ts` + diario de IA (T2 y T3 saltados con localhost) | Warning: no reejecutado por el verifier |
| Barra final opcional | `target.test.ts` | OK |
| URL objetivo inválida | `target.test.ts` + diario de IA | Warning: no reejecutado de extremo a extremo |
| URL objetivo que no responde | `target.test.ts` (`checkReachable`) + diario de IA | Warning: no reejecutado de extremo a extremo |
| Workflow manual | `smoke-isolation.test.ts` (workflows) | OK |
| test:e2e no incluye el smoke remoto | `smoke-isolation.test.ts` (testDir) | OK |
| Mismo número de E2E que en main | `playwright --list` = 48 | OK |
| verify no incluye el smoke remoto | `smoke-isolation.test.ts` (cadena expandida) | OK |
| Ningún disparador automático | `smoke-isolation.test.ts` | OK |
| ci.yml intacto | `git diff --quiet origin/main` exit 0; `ci.test.ts` verde | OK |
| README con URL e instrucciones | `deploy-docs.test.ts` | OK |

## Hallazgos
### Critical
Ninguno.

### Warning
- W1. Los commits `f1043e3..ccfe1b1` no pasaron por `.husky/pre-commit` (lint-staged y `guard-staged`) porque
  `core.hooksPath` del worktree apuntaba a una ruta inexistente. Mitigación comprobada: `npm run verify` incluye
  `guard:all` y ESLint sobre todo el repo y está en verde con el HEAD final, y los 12 commits llevan `refs:`. Falta dejar
  constancia del incidente en el diario de IA como evidencia del TFM (AGENTS.md §3, `CLAUDE.md`). Conviene
  comprobar que el CI de la PR (`quality`) pasa.
- W2. Tres escenarios del smoke (URL alternativa, URL inválida, URL que no responde) tienen cobertura unitaria y
  mediciones del implementer en el diario de IA, pero no hay test automático de extremo a extremo y este verify no
  los reejecutó. No incumple la spec: el diseño no pide automatizarlos.
- W3. `.husky/_` aparece como `core.hooksPath` actual. Debe confirmarse que el siguiente commit ejecuta los hooks.
- W4. Los escenarios de PR en verde, solo documentación y e2e en rojo se cubren solo por análisis estático de
  `ci.yml`. Es la decisión de design (comportamiento de GitHub Actions), pero queda sin comprobación dinámica.

### Suggestion
- S1. Tarea 3.4 sin marcar: es condicional y no aplica (T1 verde sin 404 de favicon). Márcala como "no aplica" en
  `tasks.md` al archivar. La 5.1 la cubre este informe y la 5.2 es de archive.
- S2. El smoke dura unos 8 s contra la URL pública, muy por debajo del presupuesto. Se podría reducir el
  `globalTimeout` si la ejecución en Actions confirma la holgura.
- S3. Corregir en la spec viva `outcome` a `'lost'` al archivar (discrepancia 1 del design).

## Recuento
C: 0 · W: 4 · S: 3
