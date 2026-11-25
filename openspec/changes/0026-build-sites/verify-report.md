# Verify report · 0026-build-sites

Verificador independiente. Rama `change/0026-build-sites`, commits 53e8930..HEAD (9 grupos).

## Ejecución
- `npm run verify`: lint, typecheck y `guard:all` (1083 ficheros) en verde. Vitest: 293 ficheros, 3444 tests, todos en verde (59 s).
- `npm run test:e2e`: no se repite. El implementador lo pasó 17/17 y el cambio de UI está acotado a 1 E2E nuevo.

## Escenarios → Test → Estado
Las specs delta tienen 133 escenarios en 11 capacidades: build-sites 78, procedural-map 16, simulation-loop 13, sprite-rendering 6, run-state 5, enemy-behavior 4, resources 4, asset-provenance 3, player-movement 2, auto-weapons 1, main-menu 1.

Comprobé que el título literal de cada uno de los 133 aparece en algún fichero de `tests/`. Ninguno falta. No audité el cuerpo de todos los tests uno por uno.

| Grupo de escenarios | Test | Estado |
|---|---|---|
| bs mapa, colisión y campo (grupos 1) | `tests/domain/map/game-map-build.test.ts`, `collision-build.test.ts`, `flow-field-build.test.ts`, `guard-post-build.test.ts` | OK |
| bs reglas y colocación (2) | `tests/domain/sites/building-rules.test.ts`, `place-sites.test.ts`, `determinism-sites.test.ts` | OK |
| bs apertura, obra y construcción (3) | `run-sites-open`, `run-building-frozen`, `run-build`, `run-build-clearance` | OK |
| bs casas y torres (4) | `run-house-income`, `weapon/tower-battery`, `run-towers` | OK |
| Casos de uso (5) | `tests/application/build-on-site.test.ts`, `fixed-step-building.test.ts` | OK |
| Contenido y procedencia (6) | `buildings-content`, `seed-source`, `tests/hooks/guard-assets.test.ts` | OK |
| Render, panel y sonda (7) | `plan-sites`, `site-art`, `tower-arrows`, `build-panel`, `build-gate` | OK (sin navegador) |
| Bots e invariantes (8) | `tests/domain/balance-builder.test.ts`, `invariants-build.test.ts`, `determinism-build.test.ts` | OK |
| bs "Construir una casa en el juego real [E2E]", "Sonda de solares en el menú" y parte E2E de sr | `tests/e2e/gameplay.spec.ts` (1 test nuevo, manual, sin umbrales de fps ni de tiempo) | OK, cumple e2e-lite |

## Arquitectura y pureza
- Ninguno de los ficheros de `src/` tocados usa `Math.random`, `Date.now` ni `performance.now`.
- `guard:all` y ESLint de capas en verde.
- Firmas doradas intactas: el diff solo añade `tests/support/siteGolden.ts`, y `mapGolden`, `structureGolden` y los demás no se tocan.
- `balanceBaseline.ts` sin cambios, y el bot v4 coincide con `BALANCE_BASELINE` semilla a semilla (test verde).
- Procedencia: las 3 hojas (`House_Construction`, `House_Blue`, `Tower_Blue`) están registradas con su entrada en `asset-provenance.json`. El guardarraíl pasa. No hay `Tower_Construction`, como pide la spec.
- Tasks: 9 grupos, todos marcados, un commit por grupo.
- CI: el script `verify` corre en `quality`, que tiene `timeout-minutes: 10`, así que el tope de 180 s es del propio test.

## Hallazgos

### Critical
Ninguno.

### Warning
- **W1 · Lote v5 cerca del tope.**
  - `BOT_BATCH_TIMEOUT_MS` es 180 s (`tests/domain/balance-builder.test.ts`).
  - El lote tarda 53,5 s en local con el invariante "Nada en la huella" por tick. Con el factor ×2,8 estimado en CI son ~150 s, un margen del 17 %.
  - Junto al lote v4 (~35 s), el CI soporta más de 3 minutos de bots en un solo job.
  - Un runner lento daría un rojo intermitente sin tocar código.
  - Acción sugerida: medir un primer CI real antes de archivar. Si supera ~120 s, mover el invariante por tick a una muestra de semillas o subir el timeout.
- **W2 · Desviaciones del apply sin respaldo de spec.**
  - `GameMap.nearestWalkableCenter` e `isBuiltAt` son API nueva de dominio que el design no preveía. Es comportamiento observable: la oveja desalojada va al centro de su celda y la reaparición descarta celdas base que solapan una obra.
  - `snapshot.sites` lleva también el acceso y las huellas. El apply dice que lo pide la spec, así que no es un requisito nuevo. Falta reflejarlo en el design.
  - `Run` lanza un error de invariante si el jugador solapa la huella. Es defensivo y lo impide `BuildingRules`.
  - `RunSetup.sites` (solares construidos en el tick 0) es API de escenario. "Semillas del conjunto con edificios" se cubre en un tick distinto del de la spec (1.800).
  - Acción: anotar estas decisiones en el design (o ADR-0025) antes de archivar. Hay que dejar constancia del escenario que usa otro tick.
- **W3 · Fixture "Celda en el límite del radio del jugador".** El radio de oferta queda fijado a 30 por una decisión del orquestador, sin trazarse en la spec (el escenario no fija ese dato). Registrar la restricción (radio de oferta < 32 con `cellSize` 32) en el design.

### Suggestion
- S1 · `tasks.md` 6.2 sigue diciendo "contradicción con ap sobre `Tower_Construction` pendiente del orquestador". La implementación es coherente con la spec, así que se puede limpiar esa nota.
- S2 · Los escenarios "Reserva de las torres llena", "El jugador conserva su tope" y "Recogible creado sobre el edificio" se cubren a nivel de `TowerBattery`, `Arsenal` y `PickupField`, no de `Run`. Es aceptable y está justificado en el diario. Basta una frase en el design.

C: 0 · W: 3 · S: 2
