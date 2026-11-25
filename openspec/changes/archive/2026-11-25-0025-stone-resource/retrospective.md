# Retrospectiva · 0025-stone-resource

- **Fechas**: inicio 2026-11-25 → archivado 2026-11-25
- **PR**: [#63](https://github.com/Adrian-ASM/tfm-survivors/pull/63) (squash `772aec2`; CI `quality` y `e2e` en verde)

## Métricas
| Métrica | Valor |
|---|---|
| Tareas completadas | 15 / 15 (8 grupos) |
| Commits (asistidos por IA) | 10 (10): 1 de planificación, 8 de apply (uno por grupo) y 1 de verify-report |
| Tests añadidos | ~145 (3.078 → 3.223 en `verify`); 10 ficheros de `tests/` nuevos (44 tocados); 0 E2E nuevos (se amplía «Contadores en el navegador» de `gameplay.spec`) |
| Hallazgos verify (C / W / S) | 0 / 0 / 2 (S1 nota de `hooksPath` en el diario; S2 títulos de 3 escenarios distintos de la spec: deuda registrada) |
| Bloqueos de guardarraíles (hook / ESLint / CI) | 0 / 0 / 0 (`core.hooksPath` del worktree apuntaba al de 0022 y se quitó antes del primer commit de código) |
| Iteraciones de prompt relevantes | 3: 4 preguntas de alcance tras explorar, 2 discrepancias spec ↔ design resueltas por el autor y reenvío de la spec |

Balance: lote del bot v4 con piedra **idéntico** a `BALANCE_BASELINE` semilla a semilla (30/50, 0 quietos con los dos
mapas), sin regenerar línea base ni huellas de 0024. Piedra media por partida: 48,2 soltadas (cota inferior) y 30,7
recogidas. Lote 35,5 s local. Bench con cinco topes 0,254 ms/tick (objetivo M1 ≤ 0,3). Rocas `Deco/04–06`: 64 × 64,
un frame, 433/571/794 bytes. `STONE_GOLDEN`: 3 piedras en la semilla 42 y 2 en la 123 con el jugador quieto.

## Qué fue bien
- Change pequeño y bien acotado por el GDD: sin mediciones previas; el balance idéntico salió por construcción (flujo
  de azar propio `STONE_STREAM` 6 y bot que no lee los recogibles) y se comprobó semilla a semilla.
- Las preguntas abiertas de la exploración (porcentaje entero, 1 piedra con roca por tipo, barril detonado, todo mapa)
  se decidieron antes de *propose*, así que la propuesta se aprobó sin cambios.
- Prompts con "escribe `<fichero>` y devuélveme un resumen" (lección de 0024): ningún subagente dejó de escribir su
  artefacto.
- Apply de una sola pasada (8 grupos en verde, rojo comprobado en las 6 tareas de núcleo) y verify sin Warnings; CI
  verde a la primera.

## Qué fue mal / dónde falló la IA
- Spec ∥ design volvió a chocar en dos decisiones de fondo: consumo de azar (spec: solo con p ≥ 1 y no detonado;
  design: 1 valor por baja siempre) y dónde vive la roca (`resources.json` frente a `appearance.json`). Se detectó al
  recibir los dos informes, antes de *tasks*, y lo decidió el autor; costó una ronda más del spec-writer.
- El `sdd-architect` no tiene Bash y no pudo hacer el `git fetch` para numerar la ADR-0024; lo comprobó el
  orquestador.
- `core.hooksPath` heredado del worktree de 0022 otra vez (ya pasó en 0024), y `node_modules` incompleto (faltaba
  `reveal.js`, `npm ci`).
- El implementador dejó un `cat` sin entrada colgado en segundo plano (sin efectos).
- Al archivar, la primera pasada del script de fusión sustituía requisitos MODIFIED enteros y perdía los escenarios
  vivos que la delta cita como "sin cambios" (−56 escenarios en `simulation-loop`); se revirtió y se fusionó por
  escenario como en 0024.

## Desviaciones respecto a spec o diseño
- `RunSetup.gems[i].source` opcional en escenarios (el design decía sin `source`); lo exigen "Tope de piedra lleno",
  "Piedra en el snapshot" y "Snapshot no mutable".
- `PickupLayer` recibe `looks.stones` como cuarto parámetro.
- `run.bench.ts`, roto desde 0024, se arregló añadiendo el tipo del bench a `goldPerKill` y `stoneChance` con 0.
- El E2E amplía «Contadores en el navegador» de `gameplay.spec` en vez de `smoke.spec` (lo pide la spec `hud`).
- Al archivar, a mano: se retiró "Topes de los cuatro tipos pintados" de `xp-gems` (sustituido por el de cinco) y se
  actualizaron los Purposes de `resources` (con vocabulario de piedra y "gastar madera y piedra es de 0026"), `hud` y
  `xp-gems`.

## Lecciones → acciones
- Las deltas de MODIFIED son parciales por convención ("Escenarios vivos sin cambios: …") → versionar el script de
  fusión por escenario (`scripts/merge-spec-deltas.mjs`) y que `sdd-archive` lo cite, en vez de reescribirlo en cada
  archivo.
- Las decisiones de consumo de azar y de ubicación del contenido se resuelven distinto en spec ∥ design → cuando la
  exploración deja abierta una regla de azar o de fichero, decidirla en el gate de propuesta y escribirla en
  `proposal.md` (añadir a §3 de `sdd-workflow`).
- `core.hooksPath` por worktree se hereda de otros checkouts → añadir a `worktree-flow` un `git config --worktree
  --get core.hooksPath` al preparar el change.
