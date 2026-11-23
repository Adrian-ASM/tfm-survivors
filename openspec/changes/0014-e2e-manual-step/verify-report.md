# Verify report · 0014-e2e-manual-step

Fecha: 2026-11-23 · Rama `change/0014-e2e-manual-step` (34 commits sobre `origin/main`, todos con `refs: 0014` y `Assisted-by`).

## Resultado de los comandos

| Comando | Resultado |
|---|---|
| `npm run verify` | Verde (exit 0): lint, typecheck, `guard:all` (602 ficheros) y 135 ficheros / 1.547 tests unitarios, ~20 s |
| `npm run test:e2e` (suite completa, 2 workers) | 112 pasan, 1 saltado (`throttle.spec.ts`, solo corre con `CI_LIKE`), 0 fallos; 2,0 min en total |
| Duración por proyecto | No medida por separado en esta pasada (el reporter solo da el total). Datos del autor (tarea 6.2): `logic` 67 en 27,5 s, `realtime` 45 + 1 saltado en 1,6 min |
| Pasada pesada `CI_LIKE` | No repetida, como se pidió. Diario y `cpuThrottle.ts`: 138 pasan, 0 fallos, 5,5 min con rate 4 |
| `git diff origin/main -- src/domain src/application` | Vacío |
| `package.json` y lockfile | Sin cambios frente a `origin/main` (sin dependencias nuevas) |
| Guarda `logicGuard.ts` | `LOGIC_GUARDED_SPECS` tiene 11 specs. `logic-guard.test.ts` compara la lista con las specs reales que tienen tests de `logic`, así que una spec nueva sin vigilar rompe `verify`. `menu`, `menu-flow`, `smoke`, `speed`, `sprites`, `calibration` y `throttle` son enteras `@realtime`, y la guarda las excluye bien |
| Regla ESLint de `./fixtures` | Presente en `eslint.config.js` para `tests/e2e/**/*.spec.ts` (`no-restricted-imports`, `importNames: ['test']`). Ninguna spec importa `test` de `@playwright/test`; los `import type`/`type Page` están permitidos |

## Trazabilidad escenario → test

Los tests E2E son `tests/e2e/manual-step.spec.ts` (E2E) y los unitarios están en `tests/infrastructure/` (U).

| Escenario | Test | Estado |
|---|---|---|
| Modo manual activo | E2E "Modo manual activo" + U `resolve-manual` | OK |
| Sin manual en modo E2E | U `resolve-manual` "Sin manual en modo E2E"; E2E "Step sin modo manual" (`ticksPerFrame` ≈ 1) | OK (el "1 tick exacto" es aproximado: ver S1) |
| Valor de manual inválido en modo E2E | E2E "Valor de manual inválido" (4 valores) + U | OK |
| Manual ignorado fuera de E2E | E2E "Manual ignorado fuera de E2E" (3 URLs, sin sonda ni avisos, el canvas avanza) | Parcial: ver W3 |
| Avisos independientes de seed, speed y manual | E2E "Avisos independientes…" + U `resolve-advance` | OK |
| Sin step no avanza | E2E `@realtime` "Sin step no avanza" | OK |
| Frames largos sin step | Ninguno directo (600 frames y 1 frame de 5.000 ms) | Parcial: ver W2 |
| Pausa sin step | E2E "Pausa sin step y Step en pausa" | OK |
| Elección sin step | E2E "Elección sin step" | OK |
| Reinicio sin step | E2E "Reinicio sin step" (logic) y `@realtime` (2 s reales) | OK |
| Avance exacto | E2E "Avance exacto y Un solo tick" + `@realtime` 2 s | OK |
| Un solo tick | E2E (mismo test, step(1): 61) | OK |
| Más de 15 ticks en un step | E2E step(225) + U `advance-ticks` | OK |
| Independiente de la duración de los frames | U `manual-stepper` (la API no admite duración) | Parcial: ver W2 |
| Input leído al empezar el step | E2E `holdKey` + U `advance-ticks` + U `manual-stepper` | OK |
| Pulsación sin step entre medias | E2E | OK |
| Oferta a mitad de step | E2E con `step(4800)`, k = 4.346 + U | OK, pero la spec está desfasada: ver W1 |
| Oferta en el último tick del step | E2E (desde 4.000, `step(346)`) + U | OK |
| Fin de partida a mitad de step | E2E (resultados, historial, luego 0) + U | OK |
| Victoria al llegar a la duración objetivo | U `advance-ticks` (120, desde 100, 50 → 20) | OK |
| Step en pausa | E2E + U `pause-gate` | OK |
| Step en el menú | E2E + U `manual-stepper` | OK |
| Step sin modo manual | E2E `@realtime` | OK |
| n inválido | E2E (7 llamadas, 7 avisos) + U `step-request` | OK |
| n muy grande | E2E `MAX_SAFE_INTEGER` + U | OK |
| Llamadas simultáneas | E2E `Promise.all` [30, 30] + U | OK |
| Llamada simultánea que encuentra la oferta | E2E [20, 0] (oferta fijada en 4.346 − 20) + U | OK |
| Manual frente a tiempo real | U `manual-equivalence` (semilla 42, `TickRun` real) | OK |
| Reparto distinto de los ticks | U `manual-equivalence` (semilla 7) | OK |
| Manual gana a speed | E2E | OK |
| Manual con speed inválida | E2E (`speed=abc`; `speed=16` solo en U) | OK |
| Manual inválido no anula speed | E2E `@realtime` | OK |
| Manual tras reiniciar con R | E2E `@realtime` | OK |
| Manual tras volver al menú | E2E | OK |
| Manual inválido y varios reinicios | E2E `@realtime` | OK |
| Escenarios MODIFIED de velocidad sin manual (8) | `speed.spec.ts`, `menu.spec.ts`, `pause.spec.ts` y `resolve-advance.test.ts`, que cubre los casos de `speed.test.ts` | OK |
| Criterio de la proposal: `logic` sin esperas de reloj | `logic-guard.test.ts`, 11 specs | OK |

## Hallazgos

### Critical
Ninguno.

### Warning
- **W1. Spec delta desfasada por 0013.** "Oferta a mitad de step" dice `k < 3.600` y `step(3600)`. Con el mundo 2x la primera oferta de la semilla 7 llega en el tick 4.346, y el test usa `step(4800)` (constante `OFFER_STEP`, con un comentario). Hay que actualizar el texto de la spec a `k < 4.800` / `step(4800)` antes de archivar, o el escenario no se puede reproducir tal como está escrito. Los demás escenarios no tienen constantes de 0013: los que dependen de la semilla 7 usan constantes medidas (4.346, 4.688 y fin en 4.885) y "n muy grande" cumple `t ≤ 36.000`.
- **W2. Escenarios sin test directo del comportamiento descrito.** "Frames largos sin step" pide 600 frames de 16,667 ms y 1 frame de 5.000 ms con 0 ticks, y luego `step(1)` = n + 1. Solo existe el cálculo del stepper y "Manual gana a speed" (120 frames). "Independiente de la duración de los frames" se cubre únicamente por la firma de `ManualStepper` (no recibe duración). La escena no usa `deltaMs` en manual, pero ningún test lo fija con frames largos inyectados. Es riesgo bajo, aunque el escenario no queda probado.
- **W3. "Manual ignorado fuera de E2E" omite la cláusula AND.** La spec exige que al terminar la partida se guarden récord e historial como sin `manual`. El test solo comprueba sonda, avisos y que el canvas avanza. Hay que añadirlo o remitirlo a un test existente.
- **W4. Tareas 5.2 (paso 3) y 6.2 siguen `[ ]`.** Falta leer la calibración del job `e2e` en el PR y confirmar el CI verde. `DEFAULT_CPU_THROTTLE = 4` es provisional y la tabla local no distingue los rates 1–6: siempre 60 fps, p95 16,7–16,8 ms y 8,0 ticks por frame. Por eso la sonda no discrimina localmente, y el valor 4 se justifica solo por margen (más lento = más conservador; la duración sube de 4,7 a 5,9 min). Es aceptable como provisional, pero no se puede archivar sin el paso 3 (o sin registrar que se acepta 4 sin referencia de CI). Si CI da fps < 60 o p95 > 16,8, habrá que probar rates mayores.
- **W5. Historial: `d5b6b76` no pasa `verify` por sí solo** (corregido en `8c65659`). Hay que dejar el fallo anotado en el diario; el PR debe revisarse por rango o con squash.
- **W6. Deuda de tests de reloj en specs `logic` mixtas.** `camera.spec.ts`, `enemies.spec.ts` y `progress.spec.ts` combinan tests `logic` y `@realtime`; la guarda las vigila por bloque. Es correcto, pero es una guarda por análisis de texto: depende de la forma de las specs (limitación documentada en la cabecera de `logicGuard.ts`).

### Suggestion
- **S1.** "Sin manual en modo E2E" comprueba `ticksPerFrame ≈ 1`, no "exactamente 1 tick por frame de 16,667 ms". Un test unitario de escena con frame inyectado lo haría exacto (y cerraría W2).
- **S2.** Desviaciones del diario (enemies, results sin la medida de 12 s, "Partida sin terminar" movida a `logic`, `camera.spec.ts` clasificada, `requestStep` con `StepRequester`): ninguna rompe la spec ni el design. Conviene reflejar en `design.md` la de `StepRequester` y la tarea 4.9 descartada (ya marcada en `tasks.md`).
- **S3.** Mantener el comentario de `cpuThrottle.ts` con la tabla hasta el paso 3 y pasarlo al ADR/diario al archivar.

## Cumplimiento del design y de AGENTS.md §3
- Capas: `src/domain` y `src/application` sin cambios (diff vacío). El modo manual vive en `src/infrastructure/{url,e2e,phaser}` y `src/composition/main.ts` (resolución). El núcleo no recibe `manual` ni `step`.
- Sin `Math.random`/`Date.now` nuevos en el núcleo; `guard:all` y ESLint verdes. Entrada externa (`manual`, `n`) validada con zod. Sin secretos ni dependencias nuevas.
- Tareas: todas marcadas salvo 5.2 y 6.2 (W4), cada una con commit.

C: 0 · W: 6 · S: 3
