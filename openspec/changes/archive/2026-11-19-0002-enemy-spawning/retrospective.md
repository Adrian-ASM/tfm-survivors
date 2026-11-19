# Retrospectiva · 0002-enemy-spawning

- **Fechas**: inicio 2026-11-19 → archivado 2026-11-19
- **PR**: pendiente de abrir (rama `change/0002-enemy-spawning`, sin push al archivar)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 32 / 32 |
| Commits (asistidos por IA) | 15 (15), incluido el de archivado |
| Tests añadidos | 176 unitarios (87 → 263, 10 → 26 ficheros) + 2 E2E (1 → 3) |
| Hallazgos verify (C / W / S) | 0 / 3 / 7 (los 3 Warning resueltos antes de archivar) |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 0 / sin ejecutar (sin push) |
| Iteraciones de prompt relevantes | 2 revisiones de la propuesta (spawn fuera de vista; valores del gate) |
| Diff frente a `main` | 66 ficheros, +4.265 / −146 (`src` +963, `tests` +1.908) |
| Benchmark `Run.tick` (200 vivos) | media 0,0069 ms, p99 0,0110 ms (umbral 2 ms) |

## Qué fue bien
- Las decisiones de diseño de juego se tomaron con preguntas cerradas al usuario antes de proponer; la
  propuesta solo necesitó dos revisiones y ninguna tras el gate.
- Spec y design en paralelo: el arquitecto contrastó con las specs al terminar y resolvió las 4
  discrepancias a favor de la spec, dejándolo escrito.
- Determinismo verificable: misma semilla + mismos inputs → snapshots idénticos en 36.000 ticks (≈ 0,6 s de
  test). El pool de `EnemyLayer` y la posición mutable de `Enemy` dejan el tick ~290× por debajo del umbral.
- Ningún hook ni regla de ESLint bloqueó: las reglas de capas y pureza se respetaron desde el diseño.

## Qué fue mal / dónde falló la IA
- **Test débil (W1)**: "Primer tick de vida" tomaba la posición de referencia del propio snapshot, así que no
  podía fallar. Lo detectó el verifier (modelo distinto), no el implementer. Corregido con mutación manual.
- El implementer escribió un test con heredoc pese a la prohibición de AGENTS.md (el fichero quedó bien).
- `tasks.md` pedía un commit por tarea y se hizo uno por bloque (W2), sin anotarlo hasta el verify.
- El implementer no podía cerrar la 9.2 (ADR y AGENTS.md fuera de sus permisos de escritura): la tarea estaba
  mal asignada en `tasks.md`.
- Cifras del benchmark ligeramente distintas entre diario (0,0069 ms) y verify-report (0,0071 ms): dos
  ejecuciones, ninguna anotada como referencia.

## Desviaciones respecto a spec o diseño
- 5.1 y 5.2 adelantadas al bloque 3 (sin ellas `loadRunConfig` no compilaba).
- `TICK_SECONDS` movido a `src/domain/shared/Tick.ts` para romper el ciclo `WaveTable → Run`.
- `buildRunRules` valida también al jugador (una sola fuente de reglas cruzadas).
- `npm run bench` con `--reporter=verbose` para que se vean las cifras.
- El E2E filtra el aviso del driver WebGL de Chromium headless ("GPU stall due to ReadPixels"); el filtro es
  estrecho y no oculta el aviso de `seed` ni los `pageerror`.
- Commits por bloque en lugar de por tarea (W2).

## Lecciones → acciones
- Un test que lee su valor esperado del sistema bajo prueba no prueba nada → añadir a la skill `test-writer`
  la regla "el esperado se calcula aparte, nunca del snapshot/salida del SUT" y exigir mutación manual en los
  tests de "no ocurre X".
- Las tareas de cierre deben asignarse al rol que puede escribir esos ficheros → en la plantilla de
  `tasks.md`, marcar el responsable (implementer / architect / orquestador / humano) en el bloque de cierre.
- La granularidad de commits debe decidirse en el design → plantilla de `tasks.md`: "commit por bloque salvo
  que se indique otra cosa".
- Benchmarks dependientes de máquina → registrar una única ejecución de referencia (máquina, fecha) en el ADR
  y citarla desde el resto de documentos.
- Pendientes de 0002 para changes futuros: ráfaga de spawns tras aplazamiento largo y presupuesto al bajar del
  tope (0003); trigonometría entre navegadores (0007); cámara para arena mayor que la vista; Suggestions S1–S7
  del verify-report.
