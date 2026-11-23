# Tasks · 0015-procedural-map

<!-- Cada tarea ≤ ~30 min, con test en rojo primero y referencia a los escenarios que cubre. Orden: dominio del mapa →
     colisión/gemas/partida → bot y PUNTO DE CONTROL DE BALANCE (gate del usuario) → URL y sonda → render → E2E →
     bench y docs. El implementer marca [x] y hace un commit por tarea. "E2E afectados" = specs de Playwright de esa
     tarea (`npm run test:e2e -- <nombre>.spec`); "—" = ninguna. La suite E2E entera solo en 7.2.
     Design: revisión 2 (design.md §11). Specs: procedural-map (PM), player-movement (MOV), xp-gems (GEM),
     run-outcome (RO), sprite-rendering (SR), world-camera (WC), simulation-loop (SL), enemy-behavior (EB). -->

## 1. Rejilla, contenido y generador (dominio)
- [x] 1.1 `CellType`, `MapRules` y `GameMap` sin generador (design §3.1, §3.3): `GameMap.open`, `fromCells`
  (error que menciona "dimensiones"), `typeAt`, `isWalkable` (fuera → false), `cellAt` (x = W → última columna),
  `cellRect` recortado. Cruzadas `cellSize ≥ 2r`, `startRadius ≤ min(W, H)/2`, resto 0 o ≥ 2r.
  Escenarios: PM "Rejilla por defecto", "Mundo no múltiplo de la celda", "Celda de un punto", "Caminabilidad por
  tipo y fuera de la rejilla", "Mapa de dimensiones incorrectas" (nivel `fromCells`).
  Test: `tests/domain/map/game-map.test.ts`, `tests/domain/map/map-rules.test.ts`. E2E afectados: —
- [x] 1.2 Contenido del mapa: `content/map.json`, `MapSchema` estricto (incluido `tuning`), `RunConfig.map`,
  `RunRules.map`, `loadRunConfig`/`repositoryContent` y `aDefaultConfig()` leyendo `map.json`. Rojo: `content.test.ts`
  con los casos de la spec (campo nombrado en el error, menú no mostrado vía `bootContent`).
  Escenarios: PM "Contenido por defecto", "Celda en el límite del radio del jugador", "Valores fuera de rango",
  "Límites válidos", "Campo ausente o desconocido"; RO "Contenido de los tests igual al del juego" (parte del mapa).
  Test: `tests/infrastructure/content.test.ts`. E2E afectados: —
- [x] 1.3 Zona de inicio y conectividad: celdas de la zona (distancia estricta `<`), `reachableFrom` (BFS 4-vecina
  sin asignar) y `isFullyConnected(map, start)`.
  Escenarios: PM "Celdas dentro y fuera de la zona", "Celda encerrada no es alcanzable".
  Test: `tests/domain/map/connectivity.test.ts`. E2E afectados: —
- [x] 1.4 Ríos (design §3.2 paso 2) y semilla del mapa: `deriveSeed(seed, stream)` en
  `src/infrastructure/random/` (uint32; 0 y 4.294.967.295 válidas) y helper `mapForSeed(config, seed)` en
  `tests/support/` que usa `Mulberry32(deriveSeed(seed, MAP_STREAM))`. `generateMap` con solo ríos: 4-conexo, de borde
  a borde, sin bloque 2 × 2, fuera de la zona, `bridges.min..max` puentes en celdas rectas, 2 ríos en lados opuestos,
  vecindad 3 × 3 marcada `noTrunk`.
  Escenarios: PM "Composición con las semillas del conjunto" (parte río), "Sin río ni troncos", "Misma semilla,
  mismo mapa" (nivel generador).
  Test: `tests/domain/map/generate-rivers.test.ts`, `tests/infrastructure/derive-seed.test.ts`. E2E afectados: —
- [x] 1.5 Troncos y postcondición (design §3.2 pasos 3–4): manchas por frontera que no se fusionan, respeto de
  `noTrunk`, rechazo por BFS, parada en `≥ T`, invariante final.
  Escenarios: PM "Composición con las semillas del conjunto" (troncos 58–80, manchas 3–8, ≥ 404 caminables), "Zona
  libre con todas las semillas" (1..1000, 0, 2³²−1), "Todas las celdas caminables alcanzables", "Semillas extremas",
  "Mapa distinto en cada semilla del conjunto".
  Test: `tests/domain/map/generate-map.test.ts` (1..1000 en un `describe` propio; < 1 s). E2E afectados: —

**Punto de control 1** (sin gate): `npm run verify`; anotar en `docs/ai-log/` sobre 1..1000 mín./máx. de troncos,
% de agua por orientación, % caminable mínimo y tiempo medio de generación. Si los troncos se salen de 58–80 o las
manchas de 3–8 en alguna semilla, ajustar `tuning.patchAttempts` y avisar al orquestador (la tolerancia es
provisional en la spec).

## 2. Colisión, gemas y partida con mapa
- [x] 2.1 Colisión por barrido (design §4.1): `GameMap.overlapsBlocked`, `limitMoveX/Y` (cara y esquina) y
  `Player.move(input, dt, arena, map)`; `Run` pasa `GameMap.open` mientras no haya `TerrainSource`.
  Escenarios: MOV "Choque frontal con un tronco", "Choque a velocidad máxima", "Deslizar a lo largo de una fila de
  troncos", "Rodear la esquina de un tronco", "Sin paso entre dos troncos en diagonal", "Cruzar un río por el
  puente", "El agua frena fuera del puente", "Sin movimiento contra un obstáculo"; los de "Movimiento del jugador por
  input" siguen verdes con el mapa vacío.
  Test: `tests/domain/player-collision.test.ts`. E2E afectados: —
- [x] 2.2 `TerrainSource` y lectura del mapa: `Run.start(config, random, setup, terrain)`, `StartRun.execute(…,
  terrain?)`, `MapSnapshot` congelado (576 tipos, recuentos, zona), `Run.map`, `TickRun.map()`, `initialPlayer` falla
  si solapa una celda no caminable.
  Escenarios: PM "Partida con mapa vacío", "Mapa de dimensiones incorrectas" (nivel partida), "Mapa constante",
  "Lectura no mutable"; SL "La colisión no consume azar".
  Test: `tests/domain/run-map.test.ts`. E2E afectados: —
- [x] 2.3 Recolocación de gemas (design §3.3 `nearestWalkable`, §4.3): `GemField(rules, map)`, distancia euclídea a
  centros recortados, empate fila → columna, sin recolocar con el tope lleno; vale también para gemas de `RunSetup`.
  Escenarios: GEM "Baja sobre un tronco", "Empate entre celdas", "Baja en un río ancho", "Baja en hierba junto a un
  tronco", "Recolocar no consume azar", "Gema recolocada recogida en el mismo tick", "Varias bajas en el mismo tick,
  una sobre agua"; los vivos de "Suelta de gema por baja" siguen verdes.
  Test: `tests/domain/run-gems-map.test.ts`. E2E afectados: —
- [x] 2.4 Partida sembrada como en producción: `RunSeeding` y `seededRun(seed, mode)` en `src/composition/seedSource.ts`;
  `startSeededRun(config, seed, mode?)` en `tests/support/runs.ts`; los tests de determinismo, `stillSurvivors` y
  partidas largas con "contenido por defecto + semilla" pasan a `startSeededRun`. Revalidar los plazos de 4.800 ticks
  (anotar tick de primer golpe, primer pulso y primera oferta con el mapa).
  Escenarios: PM "Mismos spawns con y sin mapa", "Primera oferta igual con y sin mapa"; EB "Persecución a través del
  agua", "Misma trayectoria con mapa generado y vacío"; SL "Dos partidas idénticas", "Semillas distintas", "Partida con
  contactos reproducible", "Partida con armas reproducible", "Partida con progresión reproducible", "Partida larga
  reproducible", "Resultado reproducible", "Victoria reproducible".
  Test: `tests/domain/map-independence.test.ts`, `determinism*.test.ts`. E2E afectados: —
- [ ] 2.5 Reinicio y lanzador con mapa: `RestartRun(config, nextSeeding)`, `restartRandoms` y `createRunLauncher` con
  `seededRun`; partidas largas con mapa real. Rojo: test de `run-launcher` que compara `map()` con `mapForSeed`.
  Escenarios: PM "Reinicio con otra semilla" (unitario); MOV "Partida larga sin solapes"; GEM "Ninguna gema en reposo
  en celda no caminable".
  Test: `tests/composition/run-launcher.test.ts`, `tests/application/restart-run.test.ts`,
  `tests/domain/long-run.test.ts`. E2E afectados: —

## 3. Bot v2 y PUNTO DE CONTROL DE BALANCE (gate del usuario: PARAR hasta su decisión)
- [ ] 3.1 Bot de referencia v2 (design §7.1): `referenceBot(config, map)`, repulsión de celdas `trunk`/`water`
  < 64 px, bloqueo con 1 tick a velocidad efectiva, giros +45, −45, +90, −90, +135, −135 y (0, 0) si todo bloquea.
  Escenarios: RO "Repulsión de un tronco y del agua", "Celda a exactamente 64 px", "Puente sin repulsión", "Dirección
  bloqueada por un tronco", "Huida sin amenazas con el mapa generado", "El bot huye de las paredes del mundo real" y
  los vivos de huida y elección.
  Test: `tests/domain/policies.test.ts`. E2E afectados: —
- [ ] 3.2 Medición con el mapa: `balance.test.ts` con `startSeededRun` (mapa generado) para el bot y el quieto, y
  quieto también con mapa vacío. Barrido temporal (scratchpad, no versionado) de `player.speed` 200/210/220 (y
  `maxHealth` 100/110 solo si speed no basta), con tabla `victorias | quietos vivos gen./vacío | primera subida |
  primer pulso | derrota media` en `docs/ai-log/`. **Parar y presentar la tabla al usuario**; no tocar contenido.
  Escenarios: RO "Tasa de victoria del bot de referencia", "Toda partida del bot termina", "Jugador quieto pierde con
  todas las semillas", "Jugador quieto pierde también con el mapa vacío", "Bot reproducible".
  Test: `tests/domain/balance.test.ts`. E2E afectados: —
- [ ] 3.3 Fijar el valor decidido por el usuario en `content/player.json` (rojo: `content.test.ts` con el valor
  nuevo) y ajustar los números de escenario que dependan de él y los plazos revalidados en 2.4.
  Escenarios: RO banda 25..35 (objetivo ~28) y "Muerte quieta en el límite de 180 s"; SL plazos de 4.800 ticks.
  Test: `content.test.ts`, `balance.test.ts`, `determinism*.test.ts`. E2E afectados: —

## 4. URL y sonda del mapa (composición)
- [ ] 4.1 `resolveMapMode(search)` en `src/infrastructure/url/` (zod, solo con `?e2e`, aviso con valor truncado) y
  composición: una vez por carga, `seededRun(seed, mode)` en lanzador y reinicios, 1 aviso en toda la carga.
  Escenarios: PM "Mapa vacío en modo E2E" (reglas), "Valor inválido", "Ignorado fuera de E2E", "Se mantiene en
  todas las partidas de la carga" (unitario).
  Test: `tests/infrastructure/resolve-map-mode.test.ts`, `tests/composition/seed-source.test.ts`. E2E afectados: —
- [ ] 4.2 Sonda `window.__sprint.map` (`{ ...MapSnapshot, emptyForced }`, null en el menú) y firma dorada
  `tests/support/mapGolden.ts` (semillas 42 y 123, sin imports; la fija un test unitario con `mapForSeed`). E2E
  nuevo `procedural-map.spec.ts` (proyecto `logic`, `manual`). Rojo: la sonda no tiene `map`.
  Escenarios: PM "Sonda coherente con el núcleo", "Sonda en el menú", "Sin sonda fuera de E2E", "Mapa vacío forzado",
  "Mapa real por defecto en E2E", "Valor inválido", "Ignorado fuera de E2E", "Se mantiene en todas las partidas de la
  carga", "Reinicio con otra semilla" (E2E); MOV "Sin solapes en la build con el mapa real"; WC "Nada fuera del mundo
  con el mapa real".
  Test: `tests/support/map-golden.test.ts`. E2E afectados: `procedural-map.spec`

## 5. Render del mapa (infraestructura)
- [ ] 5.1 Colores del mapa en datos de aspecto: `terrain: { trunk, water, bridge }` estricto, `#RRGGBB`, distintos dos
  a dos (error con el campo repetido), en `appearance.json`.
  Escenarios: SR "Colores del repositorio", "Colores inválidos".
  Test: `tests/infrastructure/appearance.test.ts`. E2E afectados: —
- [ ] 5.2 `TerrainView`: `terrainFills` (rectángulos de mundo recortados y recuento por tipo), `paintTerrain` sobre
  la costura `TerrainCanvas`, `SpriteCounts.cells` (0 en el menú, no cuenta como fondo ni reserva) y orden de creación
  tras el suelo y antes del resto de capas.
  Escenarios: SR "Celda pintada en su sitio y en su capa", "Fondo de hierba en el mundo entero" (orden), "Sonda en el
  menú" (cells a 0).
  Test: `tests/infrastructure/terrain-view.test.ts`, `ground-view.test.ts`. E2E afectados: —
- [ ] 5.3 `GameScene` con CanvasTexture (design §5): crear una vez, repintar en create y en R, `Image` escalado ×
  `cellSize`, NEAREST. E2E nuevo en `sprite-rendering.spec.ts` (`realtime` solo si hace falta pintar; si no, `logic`).
  Escenarios: SR "Celdas pintadas iguales al mapa", "Mapa vacío", "Partida nueva con otro mapa", "Mapa sobre el fondo
  de reserva", "Recuento coherente con el snapshot" (celdas constantes en 600 frames).
  Test: E2E. E2E afectados: `sprite-rendering.spec`

**Punto de control 2** (con el usuario, como la puerta visual de 0012): capturas de 3–4 semillas con
`?e2e&manual&seed=N` (`step(0)` y screenshot de Playwright en scratchpad). El usuario valida legibilidad y colores;
cambiar colores es solo contenido.

## 6. E2E existentes
- [ ] 6.1 Migrar a `map=empty` todos los E2E `logic` y los `realtime` que recorren posiciones fijas (esquinas,
  derrota quieta con 42), sin cambiar sus aserciones. Rojo: desde 2.5 el lanzador juega con el mapa real, así que fallan
  `camera.spec`, `sprite-rendering` (esquinas) y los que asumen posiciones libres.
  Escenarios: PM "Mapa vacío en modo E2E" (regla de migración); WC "Nada fuera del mundo en una partida real";
  SR "Fondo de reserva en el mundo entero", "Fondo en las cuatro esquinas"; RO "Derrota E2E con una semilla del
  conjunto". E2E afectados: los que fallen + `camera.spec`, `sprite-rendering.spec`, `results.spec`
- [ ] 6.2 Barrido `logicGuard` y `realtime` con CPU frenada: `CI_LIKE=1 npm run test:e2e -- --project=realtime
  --repeat-each=3` en verde; si un `realtime` es inestable por el pintado del mapa, corregir el adaptador (no los
  tiempos). Test: E2E. E2E afectados: proyecto `realtime`

## 7. Bench y cierre
- [ ] 7.1 Bench: caso "generar mapa" (spec < 20 ms) y tope de enemigos con mapa; `npm run bench` una vez y anotar
  ms/tick y ms/mapa en `docs/ai-log/`. Docs: estado de AGENTS.md §1 (mapa, `?e2e&map=empty`, sonda `map`), ADR-0013
  a "aceptada" si verify no tiene Critical.
  Escenarios: PM "Generación determinista por semilla" (coste). Test: `tests/bench/map.bench.ts`. E2E afectados: —
- [ ] 7.2 Cierre: `npm run verify` y `npm run test:e2e` completos en verde; repasar que ningún escenario de las 8
  specs delta queda sin test (tabla escenario → test en `docs/ai-log/`). E2E afectados: suite completa
