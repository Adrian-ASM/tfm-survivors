# Retrospectiva · 0014-e2e-manual-step

- **Fechas**: inicio 2026-11-23 → archivado 2026-11-23
- **PR**: #33 (change) y el PR de archive con la calibración final (5.2)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 26 / 26 (4.9 descartada por el usuario) |
| Commits (asistidos por IA) | 41 (41) en el PR #33, más 2 en el de archive |
| Tests añadidos | Unitarios: 1.436 → 1.554 (+118, 11 ficheros nuevos). E2E: 99 → 112 (`manual-step.spec` con 36 casos, `calibration.spec`, `throttle.spec`) |
| Hallazgos verify (C / W / S) | 0 / 6 / 3 en la primera pasada; 0 / 4 / 4 tras el re-verify (W1–W3 resueltos, W7 nuevo, resuelto después) |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 0 / 0. Un test unitario (guardarraíl del literal 960 de 0013) quedó rojo en `d5b6b76` y se arregló en el commit siguiente |
| Iteraciones de prompt relevantes | 6 rondas de `sdd-implementer` (secciones 1, 2–3, 4, 5 + rebase, W2/W3 y W7), 1 de `sdd-spec-writer` (W1) y 2 de `sdd-verifier` |

Duración de los E2E: suite local de 2,8 a ~2,0 min (`logic` ~27 s; `realtime` ~1,6 min); CI 8,0 min. Los tests de
`logic` tardan < 1 s cada uno.

## Qué fue bien
- El avance por ticks exactos (`step(n)`) quitó las esperas de reloj de las specs de reglas. Una guarda
  (`logicGuard.ts`) y una regla de ESLint impiden que vuelvan.
- El núcleo (`src/domain`, `src/application`) no se tocó: todo el modo manual vive en infraestructura.
- La equivalencia manual ↔ tiempo real se prueba en Node con `TickRun` real (semillas 42 y 7).
- El rebase sobre 0013 se detectó antes de medir la calibración, no al abrir el PR.

## Qué fue mal / dónde falló la IA
- **Base desfasada.** 0013 se fusionó mientras se hacía el apply y nadie lo comprobó hasta la sección 5. Las
  constantes medidas con la base vieja (ticks de la semilla 7, x inicial 480) hubo que medirlas de nuevo.
- **Hooks de commit inactivos** en el worktree (`core.hooksPath` apuntaba a una ruta que no existía), y git no avisaba.
- **Test de W3 que saturaba la CPU.** Para cubrir "Manual ignorado fuera de E2E" se adelantó `page.clock` hasta
  el fin de la partida: cada Chromium a ~50 % de 16 hilos y la máquina al 100 %. Lo detectó el usuario, no el
  agente. Se movió a un test Node de 0,4 s.
- **Calibración engañosa.** Elegir el frenado solo por fps (30) frenaba el JS más que CI e hizo fallar por tiempo
  un test largo. Con 25 (p95 igual al de CI) pasa.
- Reglas de edición incumplidas por el implementador: heredocs y un `node -e` sobre ficheros de test, y un
  `git add -A` que metió en su commit un fichero del orquestador.

## Desviaciones respecto a spec o diseño
- "Oferta a mitad de step": `step(3600)` → `step(4800)` por el mundo 2x de 0013 (spec delta corregida, W1).
- `requestStep` recibe `StepRequester` (el `Pick` del test) en lugar de `ManualStepper | undefined`.
- enemies avanza hasta el primer enemigo (con la semilla 42 no hay ninguno en el tick 30); results deja de medir
  "derrota en ≤ 12 s reales"; "Partida sin terminar" (progress) pasa a `logic`.
- `camera.spec` (0013) se repartió entre `logic` y `realtime`, fuera de las tareas originales.
- `DEFAULT_CPU_THROTTLE` = 25, no un valor de la tabla del design (1–6): en este PC ningún rate ≤ 10 baja de
  60 fps.
- Deuda que queda (verify-report): W5 (commit intermedio en rojo), W6 (la guarda es análisis de texto) y las
  Suggestions S1–S4.

## Lecciones → acciones
- Comprobar `origin/main` al cerrar cada sección del apply → añadirlo a la skill `sdd-workflow` (fase apply).
- Al reutilizar un worktree, comprobar `git config --get core.hooksPath` → paso en la skill `worktree-flow`.
- Un E2E que adelanta el reloj simulado sin sonda gasta CPU como una partida a máxima velocidad. Una regla que no
  depende del render se prueba en Node → nota en la skill `test-writer`.
- Calibrar el frenado contrastando fps **y** la duración de los tests largos frente a CI → hecho en el comentario
  de `tests/support/cpuThrottle.ts`.
- El filtro de ruta de Playwright casa con el nombre del worktree → hecho en AGENTS.md §2 (`<nombre>.spec`).
- Con orquestador y subagente en el mismo worktree, nada de `git add -A` → nota en el agente `sdd-implementer`.
- Vitest en `verify` usa todos los hilos (pico breve al 100 %) → change o `chore(tooling)` aparte con
  `maxWorkers`.
