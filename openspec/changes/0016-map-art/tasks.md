# Tasks · 0016-map-art

<!-- Cada tarea ≤ ~30 min (salvo las marcadas), con su test en rojo primero y el escenario que cubre. Orden: dominio →
     contenido → render puro → motor y composición → puerta visual → E2E → docs. El implementer marca [x] y hace un
     commit por tarea con `npm run verify` en verde. Design de referencia: design.md, §12 manda sobre §1–§11.
     Los escenarios ya cubiertos por una tarea anterior van como test de regresión dentro de la tarea que los pone
     en rojo (regla de 0006), no como tarea propia. -->

## 1. Dominio (castillo, salida y generador)

- [x] 1.1 `CellType` + `'castle'` (código 4, `CASTLE`), no caminable; `GameMap.fromCells` la acepta; `CELL_CODE.castle =
  'C'` en `tests/support/mapGolden.ts`. Tests con mapas explícitos (`tests/domain/map/game-map.test.ts`,
  `run-map.test.ts`, `run-gems-map.test.ts`, `policies.test.ts`, persecución): rojo por tipo inexistente; sin lógica
  nueva en colisión, gemas, enemigos ni bot. — escenarios: "Caminabilidad por tipo y fuera de la rejilla", "Deslizar
  por la fachada del castillo", "Baja dentro del castillo", "Persecución a través del castillo", "Repulsión de un
  tronco, del agua y del castillo", "Dirección bloqueada por el castillo"
- [x] 1.2 `MapConfig.castle { cols, rows }`: zod (`MapSchema`, enteros ≥ 1, estricto, obligatorio) y
  `MapRules.create` (`checkCross`: `cols ≤ ⌊columnas/2⌋`, `rows ≤ ⌊filas/2⌋`, huella y puerta dentro de la rejilla →
  `CASTLE_OUT_OF_GRID`, campo `map.castle`); `MapRules.playerRadius`; `content/map.json` con `castle {5, 4}`; builders
  de test con huella pequeña si su arena es diminuta (riesgo §14). — escenarios: "Contenido por defecto", "Valores
  fuera de rango" (casos `castle`), "Límites válidos" (`{1, 1}`, `{16, 9}`), "Campo ausente o desconocido" (sin
  `castle`)
- [x] 1.3 VO `CastleSite` (`castleSite(config, grid)`: columnas, filas, puerta, salida = centro de la puerta,
  congelado) y `MapRules.castle`; **sin** mover aún la zona de inicio ni el generador (la firma no cambia). Test en
  `map-rules.test.ts`. — escenarios: "Huella y salida por defecto" (parte de reglas: 14–18 × 6–9, salida (990, 630)),
  "Huella en un mundo mayor" (31–35 × 30–33, salida (2.010, 2.070))
- [x] 1.4 Salida por mapa: `GameMap` con `start` y `castle` (huella o `null`) en el constructor; `TerrainSource`
  `open`/`cells` con `start?` validado en `resolveTerrain` (`MAP_START_ILLEGAL`, campo `map.start`; tangencia legal);
  `MapSnapshot.castle { firstCol, lastCol, firstRow, lastRow } | null`, `counts.castle`, `start` = salida + radio;
  `RunSetup.initialPlayer` nace en `map.start`. `adopt` sigue con el centro hasta 1.5. Helper
  `emptyWithExit(config)` en `tests/support`. — escenarios: "Partida con mapa vacío", "Mapa explícito con salida
  declarada", "Salida declarada ilegal", "Mapa explícito con celdas de castillo", "Partida nueva con el mapa vacío",
  "Mapa explícito con y sin salida declarada"
- [x] 1.5 (~45 min, cambio atómico del mapa generado) `generateMap`: `Draft` escribe la huella antes de los ríos;
  `inStartZone` centrada en `castleStart`; bandas del río y `noTrunk` = zona ∪ huella; `placeTrunks` parte del índice
  de la puerta; `adopt` → `castleStart` + huella. `content/player.json` `speed` 215. Firma dorada de 42 y 123
  regenerada y **revisada a mano** (20 `C` en 14–18 × 6–9, ningún `~`/`=` en filas 6..13 × columnas 13..19,
  diferencias del orden de 135/576 y 95/576). `balance.test` debe cerrar en verde aquí: si sale de 25..35 o algún
  quieto no pierde, **parar** y pasar al punto de control con la medición. — escenarios: "Huella y salida por
  defecto", "Sin río ni troncos", "Celdas dentro y fuera de la zona", "Celdas tras el castillo alcanzables",
  "Partida nueva con el mapa generado", "Choque con la fachada del castillo", "Tasa de victoria del bot de
  referencia", "Jugador quieto pierde con todas las semillas"
- [x] 1.6 Postcondición del castillo en `generateMap` (exactamente `cols · rows` celdas `castle` en la huella, puerta
  caminable, BFS desde la puerta; si no, `Error('Invariante rota…')`), rojo con un borrador roto en el comprobador
  puro. Regresión en el mismo commit: suites exhaustivas y comparaciones contra `emptyWithExit`. — escenarios: "Misma
  huella con todas las semillas", "Composición con las semillas del conjunto", "Zona libre con todas las semillas",
  "Todas las celdas caminables alcanzables", "Mismos spawns con y sin mapa", "Primera oferta igual con y sin mapa",
  "Misma trayectoria con mapa generado y vacío", "Partida nueva tras acabar en una esquina", "Salida ante la puerta
  con el mapa generado", "Jugador ante la puerta del castillo" (spawn), "Partida larga sin solapes", "Ninguna gema en
  reposo en celda no caminable", "Jugador quieto pierde también con el mapa vacío", "Toda partida del bot termina",
  "Bot reproducible"

**Punto de control 1 · balance** (tras 1.6, antes del render): anotar en el diario victorias/50 con 215, tick máximo
de los quietos (generado y vacío) y los plazos de 4.800 ticks (primera subida, pulso quieto). Seguir solo con 25..35
y 0 quietos vivos; si no, proponer al usuario 210/220 o `castle.offset` (design §3.2, §7) con la medición de cada
opción (script temporal en el scratchpad) y esperar su decisión.

## 2. Contenido y datos de aspecto

- [x] 2.1 Assets: copiar `Water.png`, `Foam.png`, `Tree.png`, `Bridge_All.png` y `Castle_Blue.png` (rutas del pack,
  ADR-0012) a `public/assets/tiny-swords/` con su entrada en `content/asset-provenance.json` (`sha256`, `bytes`, ruta
  de Update 010). Test de contenido en rojo primero; `npm run guard:all`. — escenarios: "Hoja de cada elemento",
  "Solo las hojas usadas"
- [x] 2.2 Sección `map` de `appearanceSchema` (estricta, design §12.2 B2: `shore.cases` de 15 claves, `foam.idle` en
  bucle, `trees.models [{ frame }]` + `flip`, `bridges.frames { northSouth, eastWest }`, `castle.sheet` 320 × 256 +
  `frame`, `origin` en todos) y `terrain.castle` (4 colores distintos dos a dos); hojas del mapa en la nota de
  procedencia; `appearance.json` y `tests/support/appearance.ts` con valores provisionales (claves de `shore.cases` =
  lados de río). — escenarios: "Datos del
  repositorio", "Datos del mapa inválidos", "Rutas de hoja no admitidas" (hoja del castillo), "Colores del
  repositorio", "Colores inválidos", "Datos inválidos en el arranque" (sin agua)
- [x] 2.3 Escala de baldosa en el arranque: `loadAppearance(raw, { enemyIds, cellSize })` exige `frame · scale =
  cellSize` (± 0,001) en `ground`, `map.water` y `map.shore`; `ground.scale` 0,9375. Test de contenido del repositorio:
  castillo 320 × 256 · 0,9375 = 300 × 240 y corte derivado de copa/tejado con `0 < cut < frameHeight` (B4). —
  escenarios: "Escala del repositorio", "Escala que no casa con la celda"

## 3. Render puro (adaptador, sin motor)

- [x] 3.1 `phaser/map/shoreTiles.ts`: `riverSides(snapshot, c, r)` (río = `water`/`bridge`; fuera de la rejilla **no**
  es río), `shoreCase` → clave canónica de lados de río, `isShore` (solo celdas de tierra `grass`/`trunk`/`castle`
  con ≥ 1 lado de río) y `bridgeOrientation` (tierra = no río, fuera de la rejilla = río solo para la orientación,
  B3). — escenarios: "Río recto horizontal" (64 orillas, borde del mundo), "Tierra junto a un puente", "Meandro"
  (7 orillas), "Tronco y castillo cuentan como tierra", "Bloque de agua y borde del mundo" (12 orillas, hierba
  entera sin orillas), "Puente en un río horizontal", "Puente en un río vertical", "Puente en un recodo", "Puentes
  del mapa generado"
- [x] 3.2 `mergeTileRuns(cells, key, axis)` y `bestRuns` (por filas o por columnas, el de menos tramos) para agua
  (`water` ∪ `bridge` ∪ orillas; solo `water` ∪ `bridge` si la orilla va a reserva, B6) y orillas (misma clave de
  caso). Test: río vertical por columnas, cobertura exacta sin solapes, ningún tramo de agua sobre tierra no-orilla.
  — escenarios: "Elementos en su sitio" (rectángulos del agua), "Pintado del mapa" (agua bajo orillas, no bajo
  tierra)
- [x] 3.3 `phaser/map/treeChoices.ts`: `treeModel(decorSeed, cellIndex, models, flip)` con hash por celda
  (`deriveSeed`); `DECOR_STREAM = 2` en `deriveSeed.ts`. — escenarios: "Mismos modelos con la misma semilla" (parte
  pura), "Variedad dentro de un mapa", "Otra semilla, otros modelos", "La variedad no toca la simulación"
  (regresión)
- [x] 3.4 `phaser/map/mapLooks.ts`: `resolveMapLooks(appearance.map, terrain, frameCount, hasFrame)` arte o reserva
  **por elemento** (B6): agua, orilla (falla también si falla la hoja del fondo), espuma, árbol, puente (marco con
  nombre ausente) y castillo. — escenarios: "Reserva de cada elemento" (decisión por elemento), "Recorte del puente
  fuera de la hoja" (parte pura)
- [ ] 3.5 `phaser/map/planMapArt.ts` con arte: listas por capa (agua, espuma, orillas, puentes, troncos, fachada en la
  baja; copas y tejado en la alta), posiciones (árbol en el punto medio del borde inferior de su celda, puente
  centrado, castillo con origen en el borde inferior de la huella) y cortes derivados; 1 espuma por celda de orilla
  con `foamCrop(sides)` (celda + extensión solo en sus lados de río, B11) y todas las espumas antes que todas las
  orillas, y la orilla antes que el tronco de su celda. — escenarios: "Elementos en su sitio", "Castillo sobre su
  huella", "Tronco y copa" (geometría del corte), "Jugador ante la puerta" (corte del tejado en y = 540), "Pintado
  del mapa" (espuma en el borde con el río, bajo la pieza)
- [ ] 3.6 `planMapArt` con reserva y recuentos: rectángulos por elemento sin arte, celdas `castle` sueltas como
  rectángulos, mapa vacío sin objetos; recuentos de la sonda (`cells` + `castle`, `mapArt` con `painted`/`fallback`,
  `objects`; `shore` = `foam` = celdas de orilla en tierra, 0 sin su hoja). — escenarios: "Recuentos del mapa
  pintado" (parte pura, sobre el mapa de 42), "Reserva de cada elemento", "Reserva del castillo", "Celdas de castillo de un mapa
  explícito", "Mapa vacío" (plan vacío)
- [ ] 3.7 **Punto de control 2 · objetos**: test de `planMapArt` con el contenido y el aspecto del repositorio,
  `objects ≤ 300` en las semillas 42 y 123; registra el máximo de 1..50 en el diario. Estimación r3 en el límite
  (~275–340, espuma en las dos riberas). Si alguna supera 300: avisar al orquestador con la medición y aplicar la
  palanca (a) de §12.3 (espuma en `Blitter`, 1 objeto; en 4.2 y 4.3) y, solo si no basta, la (b) (árboles). —
  escenario: "Objetos del mapa" (gate sin navegador)

## 4. Motor y composición

- [ ] 4.1 `MapArtCanvas` (costura sin motor) y `paintMapArt(canvas, plan)` en `TerrainView.ts`, que absorbe
  `TerrainCanvas`; test con canvas doble: un objeto por entrada del plan (`objects` igual al del plan), `clear` antes
  de repintar, nada visible del mapa anterior ni en el menú. — escenarios: "Partida nueva con otro mapa" (unitario),
  "Mapa vacío"
- [ ] 4.2 `phaserArt.mapArtCanvas(scene)`: `Layer` baja y alta con pools de `TileSprite`, `Sprite` y `Rectangle`
  reutilizados (o `Blitter` si lo pidió 3.7); `createPlayfield`: suelo → baja → `RenderLayers` → alta, HUD y
  overlays después. Test con fábricas falsas del orden de creación. — escenarios: "Tronco y copa", "Jugador ante la
  puerta", "Proyectiles y gemas bajo las copas"
- [ ] 4.3 `BootScene`/`bootPlan`: carga hojas (`spritesheet`) e imágenes (`image`) del mapa; en `create`,
  `Texture.add` de los marcos del puente solo si caben en la fuente (y, con la palanca de 3.7, los 8 × 15 marcos de
  espuma recortada por caso y, si hizo falta, los de tronco/copa).
  Test con doble de texturas. — escenarios: "Recorte del puente fuera de la hoja", "Hojas del mapa bloqueadas"
  (reserva sin errores, parte unitaria)
- [ ] 4.4 Espuma animada: `RenderLayers.render` calcula el frame de `foam.idle` con su `AnimClock` y llama a
  `canvas.foam(f)` solo al cambiar; congelada en pausa y en manual sin `step`. — escenario: "Pintado del mapa"
  (espuma en bucle en tiempo de render)
- [ ] 4.5 Sonda y cableado: `renderCounts` (`cells.castle`, `mapArt`), menú a 0; `GameScene` pinta con `planMapArt`
  al crear y tras R; `GameSceneDeps.decorSeed()` desde `main.ts` (`deriveSeed(semilla actual, DECOR_STREAM)`); sonda
  `map` con `castle` y `start`. — escenarios: "Recuento coherente con el snapshot" (celdas por tipo constantes),
  "Sonda en el menú" (render y mapa), "Mismos modelos con la misma semilla" (tras R con la misma semilla), "Sonda
  coherente con el núcleo", "Sonda con el mapa vacío"

## 5. Puerta visual (gate humano)

- [ ] 5.1 Capturas con un script temporal de Playwright en el scratchpad (nada versionado): `?e2e&manual&seed=N` con
  las semillas 42, 123, una con río vertical y otra con río horizontal (elegidas con `map.cells`), varias posiciones
  de cámara con `step(n)` e input. Cerrar con ellas los valores provisionales (`shore.cases`, `trees.origin.y`,
  rectángulos del puente; R1 ya cerrado: orilla en tierra) y revisar que la espuma recortada no asome sobre la hierba
  interior. Medición `CI_LIKE=1` opcional. **Parar**: el orquestador enseña las capturas al usuario; no seguir sin su
  aprobación. Si se rechazan las muescas de orilla, el apply se para y vuelve a spec. — escenarios: "Escala del repositorio" (visual), "Capas del mapa y de las entidades" (visual)

## 6. E2E (e2e-lite: 0 tests nuevos en `logic`, 2 ampliados) y realtime

- [ ] 6.1 Ampliar "Mapa real…" (`gameplay.spec.ts`): firma con castillo, huella y salida, jugador en (990, 630),
  `sprites.cells` con `castle` 20, `mapArt` contra `map.cells` (orilla = espuma = celdas `grass`/`trunk`/`castle`
  con ≥ 1 vecina 4-conexa `water`/`bridge` dentro de la rejilla, calculadas en el test), sin reserva;
  `overlapsBlocked` con `castle`. Ajustar la primera lectura de "Cámara…" a la fórmula (vista (510, 360)). Tipos de la
  sonda en `tests/e2e/probe.ts`. — escenarios: "Recuentos del mapa pintado", "Sonda con castillo y salida", "Sin
  solapes en la build con el mapa real", "Nada fuera del mundo con el mapa real"
- [ ] 6.2 Ampliar "Sprites…reserva": abortar también las 5 hojas del mapa; tras el primer `step(60)`, reserva de agua,
  árbol y puente igual a los recuentos, castillo 1 con reserva, espuma y copa 0, tick 60 y sin errores no capturados
  (filtrar los "Failed to load resource" de las 6 hojas); entidades cuya hoja no se bloquea sin reserva (spec ya
  ajustada, §12.6). — escenario:
  "Hojas del mapa bloqueadas"
- [ ] 6.3 Test `@realtime` en `realtime.spec.ts` (mapa real, 42 y 123): objetos de la sonda ≤ 300 y fps con su % sobre
  21,6/21,9; ejecutarlo una vez a demanda con `CI_LIKE=1` y anotar el resultado (informativo). — escenarios:
  "Objetos del mapa", "Fps con el mapa real"

## 7. Documentación

- [ ] 7.1 Specs del change con los valores definitivos si cambió la huella o la velocidad (requisito "Castillo en el
  mapa generado"), `AGENTS.md` (estado: castillo sólido, salida por mapa, arte del mapa en dos capas, sonda
  `mapArt`, `speed` 215 y balance medido) y addendum de ADR-0013 de "propuesto" a "aceptado". `npm run verify`.
- [ ] 7.2 Diario de IA (`docs/ai-log/`): mediciones de los puntos de control 1 y 2, decisión de la puerta visual, cierre de R1 (orilla en tierra) y palanca de espuma si se usó,
  fps a demanda, incidentes de hooks; comprobar la nota de procedencia (bytes exactos, ningún `Castle_*` de otro color
  ni `Rocks`) con `npm run guard:all`.
