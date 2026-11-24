# Retrospectiva · 0019-flow-field

- **Fechas**: inicio 2026-11-24 → archivado 2026-11-24
- **PR**: #45 (squash `27eb704`)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 14 / 14 casillas de `tasks.md` (2.1 y 2.2 en un commit, como permitía la tarea) |
| Commits (asistidos por IA) | 14 (14) en la rama, fusionados en squash |
| Tests añadidos | +75 / −14 casos (`it`/`test`) en el diff de `src` y `tests`; ficheros de test 171 → 178; unitarios 2.049 en verde; E2E `logic` siguen en 13 (0 nuevos) |
| Hallazgos verify (C / W / S) | 0 / 3 / 3 (W2 corregido por el orquestador antes del PR; S3 resuelto al archivar; W1, W3, S1 y S2 quedan como deuda) |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 0 / 0 |
| Iteraciones de prompt relevantes | 1 `sdd-explorer`, 1 `sdd-implementer` de medición (desechable), `sdd-spec-writer` en 1 sesión con 5 rondas (propose, spec, nota del design, delta `xp-gems`, delta `leveling`), `sdd-architect` en 1 sesión con 2 rondas (design; contraste + tasks), `sdd-implementer` en 1 sesión con 3 rondas (hasta la parada 4.1, lotes extra, cierre), 1 `sdd-verifier` |

Mediciones:
- Prototipo previo (desechable): BFS de 4 vecinos 0,022 ms de media y 0,025 ms en p95; tick con 300 vivos
  0,015–0,027 ms; el 11,8–13,4 % de las apariciones caen en celdas bloqueadas.
- Balance (bot v2, semillas 1..50): 25 antes del change; 18 con el prototipo; **12 con la implementación real**;
  **26** con la curva de XP 9/3. 0 quietos sobreviven en el mapa generado ni en el vacío, y los plazos se cumplen.
- Calibración: 18 lotes. Eran 15 previstos y el usuario aprobó 3 más.

## Qué fue bien
- Medir antes de proponer (regla de `sdd-workflow` §3) puso el problema del balance en el gate de propose. El
  usuario decidió con datos que no se tocaban las oleadas, en lugar de descubrirlo en apply.
- La parada obligatoria en la 4.1 funcionó dos veces. El implementer no fijó ningún valor de contenido que pidiera
  spec, y el delta de `leveling` llegó antes que el commit de calibración.
- Spec y design en paralelo: el orquestador pasó al spec-writer la regla de "1 valor de azar por intento" y el
  contraste del design antes de tasks corrigió tres puntos (campo perezoso, celda por floor, visibilidad solo para
  las apariciones no recolocadas). Ninguno llegó a apply.
- Arquitectura limpia: `FlowField` es dominio puro, sin asignar memoria en el tick, y los escenarios se cubren con
  unitarios. No hizo falta ningún E2E nuevo (`e2e-lite`).

## Qué fue mal / dónde falló la IA
- El prototipo sobrestimó el balance (18/50, contra 12/50 reales). La medición previa orienta la dirección, pero no
  sirve como cifra de partida. El design §6 y el delta de `leveling` copiaron el 18/50 (W2).
- Los commits 2.1–3.3 se hicieron con `balance.test.ts` en rojo (W3) contra "no cierres una tarea en rojo". El
  diseño de tareas ponía la calibración al final, después de los cambios que la rompían.
- En la 1.3 un `npm run verify | grep` ocultó un error de tipos (el código de salida era el del `grep`). Se corrigió
  con un amend.
- El GDD no se renumeró cuando 0018 pasó a ser `map-culling`, y al arrancar el change hubo que deducir qué era 0019
  a partir de la propuesta de 0018.

## Desviaciones respecto a spec o diseño
- La calibración usó la curva de XP (P4), no la vida ni el daño del `goblin-tnt` (P1/P2) que el design proponía
  primero. Esas palancas aportaban 3–4 victorias. El usuario restringió los lotes extra a la curva de XP para que
  el único delta fuera `leveling`.
- El resultado, 26/50, cae fuera del margen preferido 27–33 del design, aunque dentro de la banda (W1).
- "Mapa sin celdas caminables" solo se prueba en `placeSpawn`, porque `RunSetup` no deja montar una partida con el
  jugador en celdas no caminables.
- Las cifras de XP de los tests pasan a la curva de escenario 5/5 (`SCENARIO_PROGRESSION`), separada de la curva
  por defecto del contenido.

## Lecciones → acciones
- Una tarea que rompe a sabiendas el test de balance deja el historial en rojo → en `tasks.md`, la calibración
  debe ir junto a la tarea que la rompe (o el test se marca como pendiente explícito con fecha de vuelta). Anotarlo
  en la plantilla de tasks (candidata a chore).
- El prototipo de medición no reproduce la implementación real → en la propuesta, tratar sus números de balance
  como orientativos y prever lotes de calibración con margen (aquí hicieron falta 18 sobre 15).
- `verify | grep` oculta fallos → en el prompt de `sdd-implementer`, usar `npm run verify > log; echo $?` o
  `set -o pipefail` (ya se le pidió en esta sesión; candidata a regla en AGENTS.md §8.1).
- Renumerar el roadmap en el mismo PR en el que se decide el cambio → al archivar un change que reordena el
  backlog, actualizar `docs/gdd.md` antes del siguiente.
- El balance queda a 1 victoria del suelo (W1) → el próximo change que toque contenido de combate debe recalibrar
  apuntando al centro de la banda.
