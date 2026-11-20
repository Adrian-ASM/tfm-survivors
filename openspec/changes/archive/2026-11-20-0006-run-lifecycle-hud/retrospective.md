# Retrospectiva · 0006-run-lifecycle-hud

- **Fechas**: inicio 2026-11-19 → archivado 2026-11-20
- **PR**: #10 (squash `a719203`)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 40 / 40 (algunas agrupadas en un mismo commit) |
| Commits (asistidos por IA) | 37 (37) en la rama, fusionados por squash |
| Tests añadidos | +126 unitarios (804 → 930) · +1 E2E (6 → 7, `results.spec.ts`) |
| Hallazgos verify (C / W / S) | 0 / 2 / 4 |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 2 / 0 |
| Iteraciones de prompt relevantes | 2 (parada de ganabilidad en 0.2 → rebalanceo; tasks tras contrastar specs tardías) |

## Qué fue bien
- El usuario decidió las 4 cuestiones abiertas de la exploración antes de la propuesta, así que la propuesta salió
  sin idas y vueltas y el gate fue de una sola pasada.
- La parada obligatoria de la tarea 0.2 funcionó: el implementador midió, vio que no se podía ganar y paró sin
  tocar contenido. Con un solo valor (tramo de 180 s, 3,5/s → 2,5/s) se resolvió.
- `RunPhase` como unión cerrada hace que `over` sin resultado no se pueda representar; el compilador lo comprueba.
- Escenarios de 36.000 ticks probados a la letra y baratos (enemigo lento calibrado para golpear en el tick n).
- `Run.ts` bajó de 307 a 278 líneas pese a sumar la victoria y el contador de bajas.

## Qué fue mal / dónde falló la IA
- El design previó ajustes de balance (tramo de 480 s, `guardrail`) sin datos: las partidas morían antes de 300 s,
  así que esos ajustes no servían. La medición debió hacerse en explore.
- Spec y design en paralelo: el arquitecto contrastó el design cuando aún faltaban dos specs delta y hubo que
  reabrirlo (frame del reinicio, `seedSource.ts`).
- TDD sin rojo visible en ~10 tareas: el comportamiento ya lo dejaba hecho la tarea anterior. Señal de tareas
  demasiado finas o mal ordenadas.
- Ganabilidad frágil (W1): solo 1 de 10 semillas gana con el bot sencillo, y `balance.test.ts` fija esa semilla.

## Desviaciones respecto a spec o diseño
- `RunSetup.kills` (bajas iniciales, solo para tests) e `initialState` en `RunSetup.ts`: no estaban en el design.
- `fleeInput` recibe el tamaño de la arena como parámetro opcional (el snapshot no lo trae).
- `Run.ts` en 278 líneas frente al objetivo de 270.
- Rebalanceo de `content/waves.json` fuera de lo previsto en el design, aprobado por el usuario en el punto de
  control.
- La rama del worktree la creó la app como `claude/…` y el orquestador la renombró a `change/0006-…`.

## Lecciones → acciones
- Medir la ganabilidad (o cualquier objetivo de balance) en explore, no en apply → añadir a la plantilla de
  exploración un apartado "mediciones previas" cuando el change fije un objetivo de balance.
- Si spec y design van en paralelo, el arquitecto debe esperar a todas las specs antes de cerrar la cobertura →
  anotarlo en `sdd-workflow` §2 (contraste final del design al lanzar tasks).
- Tareas que no ponen ningún test en rojo → el arquitecto agrupa en una tarea los pasos que se cumplen juntos.
- Deuda de balance (W1) y E2E de reinicio tras victoria (W2) → registrar en el backlog del GDD para un change de
  equilibrio antes del despliegue público.
