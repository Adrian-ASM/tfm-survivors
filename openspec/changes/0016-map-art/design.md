# Design · 0016-map-art

> Revisión 2 (fase tasks): contrastado con las 7 specs delta. **§12 manda** sobre §1–§11 donde difieran; el resto
> sigue vigente. Revisión 3: R1 cerrado por el usuario (orilla en la celda de tierra) y spec sprite-rendering
> reajustada; cambian B1, B2, B6, B11 (nuevo), §12.3, §12.5 y §12.6.

## Resumen
El castillo entra en el **dominio** como un tipo de celda nuevo (`castle`, código 4, no caminable) con una huella
fija que solo escribe `generateMap`; el punto de salida deja de ser una constante de `MapRules` y pasa a ser
**propiedad de cada `GameMap`**: el centro del mundo en el mapa vacío y en los explícitos, y la puerta del castillo en
el generado. Con eso, colisión, gemas, conectividad y bot tratan el castillo sin código nuevo y `map=empty` no cambia.
El arte vive entero en el **adaptador**: un planificador puro (`planMapArt`) convierte el `MapSnapshot` y los datos de
aspecto en una lista de objetos (agua por tramo, orillas por autotile de 4 vecinos agrupadas en tramos, espuma, árboles
partidos en tronco y copa, puentes orientados, castillo partido en base y tejado, rectángulos de reserva), y una
costura sin motor la pinta en **dos `Layer`**: una bajo las entidades y otra sobre ellas y bajo el HUD.

Vía de consulta de Phaser: MCP `phaser-docs` (páginas en §5.6, documentadas para la 4.1.0) contrastado con
`node_modules/phaser/types/phaser.d.ts` de la **4.2.1** instalada (`Texture.add`, `setCrop`, `TileSprite.setTileScale`
/`setTilePosition`, `class Layer`).

## 1. Decisiones del gate y abiertas, y dónde viven

| # | Decisión | Dónde vive |
|---|---|---|
| D1 | Castillo sólido: celda `castle` (código 4), no caminable | `CellType.ts` |
| D2 | Huella 5 × 4 por contenido; colocación derivada: centrada en la columna del centro, fila inferior = fila del centro, puerta debajo | `content/map.json` `castle`, `MapRules.castle` |
| D3 | Salida = centro de la celda de la puerta ((990, 630) por defecto); zona de inicio (r = 180) centrada en ella | `CastleSite`, `MapRules.inStartZone` |
| D4 | Castillo solo con mapa generado; `open` y `cells` sin castillo y salida en el centro | `GameMap.start` por mapa |
| D5 | Río vetado en la unión de zona y huella (bandas de `RiverAxis`) | `generateMap` |
| D6 | Orillas: autotile de 4 vecinos, 16 casos por datos, en el adaptador | `planMapArt`, `appearance.map.shore.frames` |
| D7 | Copas y tejado sobre todas las entidades, bajo HUD/overlays | `Layer` alta creada tras `RenderLayers` |
| D8 | Marcos de `Bridge_All.png` como rectángulos validados (zod + encaje en la imagen al cargar) | `appearance.map.bridges.frames`, `BootScene` |
| D9 | Variedad de árboles con flujo derivado `DECOR_STREAM`, sin consumir azar de partida ni de mapa | `treeChoices` |
| D10 | Reserva por colores de 0015 por grupo de elementos; color nuevo `terrain.castle` | `resolveMapLooks`, `TerrainSchema` |
| D11 | ≤ 300 objetos del mapa en las semillas 42 y 123, comprobado sin motor | test de `planMapArt` |
| D12 | `player.speed` 215, re-medido con la huella definitiva | `content/player.json`, §7 |
| D13 | Sonda: `map.castle`, `counts.castle`, `start` = salida; `sprites.mapArt` por elemento | `main.ts`, `renderCounts.ts` |
| D14 | ≤ 2 E2E, ampliando los dos existentes del mapa y de reserva | §8 |

## 2. Piezas por capa

| Capa | Pieza | Nueva/Mod. | Notas |
|---|---|---|---|
| domain | `map/CellType.ts` | Mod. | `CELL_TYPES` + `'castle'` (código 4, `CASTLE`). `isWalkableCode` no cambia (solo `grass`/`bridge`). |
| domain | `map/CastleSite.ts` (VO) | Nueva | `{ col, row, cols, rows, door: Cell, exit: {x, y} }` congelado; `castleSite(config, grid)` → `Result`. §3.2. |
| domain | `map/MapRules.ts` | Mod. | `MapConfig.castle: { cols, rows }`; `MAP_LIMITS.castleMax`; `centerStart` (antes `start`), `castle: CastleSite`, `castleStart: StartZone`; `inStartZone` centrada en la salida. Errores `map.castle`. |
| domain | `map/GameMap.ts` | Mod. | `start` y `castle: CastleFootprint \| null` por mapa (constructor). `open`/`fromCells` → `centerStart`, `null`; `adopt` (generador) → `castleStart`, footprint. |
| domain | `map/generateMap.ts` | Mod. | `Draft` escribe la huella antes de los ríos; zona = disco(salida) ∪ huella para las bandas; postcondición del castillo. Sin consumo de azar nuevo. |
| domain | `map/placeTrunks.ts` | Mod. | Recibe el índice de la celda de salida (no lee `rules.start`). |
| domain | `map/MapSnapshot.ts` | Mod. | `castle: CastleFootprint \| null`; `counts.castle`; `start` del mapa. |
| domain | `run/RunSetup.ts` | Mod. | `initialPlayer`: sin `setup.player`, nace en `map.start` (= `arena.center` con `open`/`cells`). |
| application | — | Sin cambios | `RunSeeding`, `StartRun`, `RestartRun`, `TickRun.map()` siguen igual. |
| infrastructure | `content/schemas.ts` (`MapSchema`) | Mod. | `castle: strictObject({ cols, rows })` enteros en [1, `castleMax`]; misma constante de error que el dominio. |
| infrastructure | `content/appearanceSchema.ts` | Mod. | Sección `map` (§5.1) estricta; `TerrainSchema` + `castle`, 4 colores distintos dos a dos. |
| infrastructure | `content/loadAppearance.ts` | Mod. | Las hojas e imágenes de `map` también deben figurar en la nota de procedencia. |
| infrastructure | `random/deriveSeed.ts` | Mod. | `DECOR_STREAM = 2` (presentación; no entra en el contrato de determinismo de la simulación). |
| infrastructure | `phaser/map/shoreTiles.ts` | Nueva | `landMask(snapshot, c, r)` (4 bits), `isShore`, `mergeTileRuns` por filas o columnas. Puro. |
| infrastructure | `phaser/map/treeChoices.ts` | Nueva | `treeChoices(snapshot, models, flip)` con `Mulberry32(deriveSeed(cellsHash(snapshot), DECOR_STREAM))`. Puro. |
| infrastructure | `phaser/map/mapLooks.ts` | Nueva | `resolveMapLooks(map, terrain, frames, hasFrame)`: arte o reserva por grupo (§5.3). Puro. |
| infrastructure | `phaser/map/planMapArt.ts` | Nueva | `planMapArt(snapshot, looks) → MapArtPlan` (listas por capa + recuentos). Sustituye a `terrainFills`/`mergeRuns` como entrada del pintado (se reutilizan para la reserva). Puro. |
| infrastructure | `phaser/TerrainView.ts` | Mod. | `MapArtCanvas` (costura sin motor, §5.4) y `paintMapArt(canvas, plan)`; `TerrainCanvas` se absorbe en ella. `PaintedCell` + `castle`. |
| infrastructure | `phaser/phaserArt.ts` | Mod. | `mapArtCanvas(scene)`: `low()` y `high()` crean cada una su `Layer` con pools de `TileSprite`, `Sprite` y `Rectangle` reutilizados entre partidas. |
| infrastructure | `phaser/GroundView.ts` | Mod. | `createPlayfield`: suelo → `Layer` baja → `RenderLayers` → `Layer` alta. |
| infrastructure | `phaser/RenderLayers.ts` | Mod. | `paintMap(canvas, plan)`; `render` actualiza el frame de la espuma con su `AnimClock` solo cuando cambia. |
| infrastructure | `phaser/BootScene.ts`, `bootPlan.ts` | Mod. | Carga hojas regulares (`spritesheet`) e imágenes (`image`); en `create`, `Texture.add` de los marcos con nombre del puente si caben en la imagen. |
| infrastructure | `phaser/renderCounts.ts` | Mod. | `SpriteCounts.cells` + `castle`; `SpriteCounts.mapArt` (§6). |
| infrastructure | `phaser/GameScene.ts` | Mod. | Pinta con `planMapArt` al crear y tras R; `mapView()` igual. |
| composition | `main.ts` | Mod. | Sonda `map` ya incluye `castle` (viene del snapshot); `sprites.mapArt` en el menú a 0. |
| content | `map.json`, `player.json`, `appearance.json`, `asset-provenance.json` | Mod. | `castle {5, 4}`; `speed` 215; `map` + `terrain.castle` + `ground.scale` 0,9375; 5 entradas nuevas. |
| assets | `public/assets/tiny-swords/...` | Nueva | `Terrain/Water/Water.png`, `Terrain/Water/Foam/Foam.png`, `Resources/Trees/Tree.png`, `Terrain/Bridge/Bridge_All.png`, `Factions/Knights/Buildings/Castle/Castle_Blue.png` (rutas del pack, ADR-0012). |
| tests/support | `mapGolden.ts`, `policies.ts`, `appearance.ts` | Mod. | `CELL_CODE.castle = 'C'`, firmas 42/123 regeneradas a mano; bot sin lógica nueva (solo doc: "celdas no caminables"); aspecto de prueba con `map`. |

Por qué así:
- **Castillo en dominio**: bloquea al jugador y desplaza la salida, así que es regla de juego (ADR-0002). Una celda más
  reutiliza `isWalkable`, el barrido por ejes, `nearestWalkable` y la BFS: cero lógica nueva en colisión, gemas y bot.
- **Salida por mapa y no por reglas**: es la única forma de que el castillo exista solo en el generado (gate 3) sin
  ramas en `RunSetup`: el mapa vacío conserva `start = centro` y la simulación sin mapa es idéntica.
- **Arte en el adaptador**: orillas, variedad de árboles, orientación de puentes y capas son presentación; el
  snapshot no cambia por ellas (criterio "simulación intacta").
- **Sin puerto nuevo**: `MapArtCanvas` es una costura de test (como `TerrainCanvas` y `GroundFactory`), no un puerto
  de dominio; tiene una implementación de motor y dobles en test.

## 3. Modelo (dominio)

### 3.1 `content/map.json`
```json
{ "...": "igual que 0015", "castle": { "cols": 5, "rows": 4 } }
```
zod (`MapSchema`) y `MapRules.create` con los mismos mensajes: `cols`, `rows` enteros en [1, `castleMax` = 8]
(`CASTLE_SIZE_OUT_OF_RANGE`, campo `map.castle.cols`/`rows`). `castle` es obligatorio (el contenido por defecto siempre
tiene castillo; quien no lo quiera usa `map=empty` o un mapa explícito).

### 3.2 `CastleSite` (colocación derivada, sin números mágicos)
Con `cc = colAt(W / 2)` y `rc = rowAt(H / 2)` (celda del centro del mundo):
- columnas `c0 = cc − ⌊cols / 2⌋ .. c0 + cols − 1`; filas `r0 = rc − rows + 1 .. rc`;
- puerta = `(cc, rc + 1)`; **salida** = centro del rectángulo (recortado) de la puerta.

Por defecto: `cc = 16`, `rc = 9` → columnas 14–18, filas 6–9, puerta (16, 10), salida (990, 630), idéntico al
prototipo medido. Invariantes cruzadas en `MapRules.create` → `map.castle` (`CASTLE_OUT_OF_GRID`): `c0 ≥ 0`,
`c0 + cols ≤ cols_grid`, `r0 ≥ 0`, `rc + 1 < rows_grid`. La salida nunca solapa la huella: dista `s / 2` de la fila
`rc` y `cellSize ≥ 2 · radio` ya está garantizado.

Si en apply la huella tiene que moverse para el balance (§7), se añade un desplazamiento opcional por contenido
(`castle.offset`), nunca constantes en código; la decisión vuelve al usuario.

### 3.3 `MapRules`, `GameMap` y zona de inicio
- `MapRules.centerStart = { x: W/2, y: H/2, radius }` (lo que antes era `start`): salida de `open` y `cells`.
- `MapRules.castleStart = { ...castle.exit, radius }`; `inStartZone(c, r)` mide contra él (solo lo usa el generador),
  con la misma regla estricta `< startRadius` de 0015. Por defecto la zona son las columnas 13..19 × filas 7..13 (sin
  las esquinas del bloque).
- `GameMap` recibe `start` y `castle` en el constructor privado; `typeAt`, `isWalkable`, barridos y `nearestWalkable`
  no cambian. `fromCells` acepta celdas `castle` (no caminables) pero `castle = null` y salida en el centro: un mapa
  explícito nunca mueve al jugador (gate 3).
- `connectivity.reachableCells` ya parte de `map.start`: con el generado, la BFS sale de la puerta (spec
  "Conectividad desde la salida").

### 3.4 `generateMap` (orden de consumo de azar sin cambios)
1. `Draft`: celdas a hierba; **huella** a `CASTLE`; `noTrunk` = zona ∪ huella; extensión de banda
   (`zoneCols`/`zoneRows`) = unión de la zona y la huella. Por defecto filas 6..13 y columnas 13..19: bandas de río
   verticales 1..11 / 21..30 y horizontales 1..4 / 15..16.
2. Ríos y puentes: igual que 0015 con las bandas nuevas (así nunca tocan zona ni huella, con 1 celda de margen).
3. Troncos: igual; `TrunkDraft.start` = índice de la puerta (antes, del centro).
4. Postcondición: exactamente `cols · rows` celdas `castle`, todas dentro de la huella; puerta caminable; BFS completa
   desde la puerta; troncos en tolerancia. Si no, `Error('Invariante rota…')`.

El orden de llamadas a `random` es el mismo; los valores cambian porque cambian las bandas (por eso cambian la firma
dorada y el balance). `deriveSeed` y `MAP_STREAM` no cambian.

### 3.5 Snapshot y arranque
- `MapSnapshot.castle: { col, row, cols, rows } | null` y `counts.castle` (20 por defecto, 0 sin castillo).
- `initialPlayer`: `position = setup.player ? clamp(...) : map.start`. Con `open` (y `cells`) `map.start` es
  exactamente `arena.center`: mismos valores en coma flotante, así que las partidas sin mapa son idénticas tick a
  tick salvo por la velocidad 215.
- Enemigos: sin cambios; siguen ignorando el mapa y pueden estar sobre celdas `castle` (deuda 0018, gate 2).

## 4. Flujo de un tick
Sin cambios respecto de 0015: `Player.move` con `limitMoveX/Y` (el castillo es una celda no caminable más),
persecución y armas sin mapa, `GemField.drop → nearestWalkable` (recoloca también desde celdas `castle`). Ni
asignaciones ni consumo de azar nuevos. El arte no participa en el tick.

## 5. Render (adaptador)

### 5.1 Datos de aspecto (`appearance.json`, sección `map`, todo `strictObject`)
```json
"map": {
  "water":   { "sheet": { "file": "Terrain/Water/Water.png", "frameWidth": 64, "frameHeight": 64 },
               "frame": 0, "scale": 0.9375 },
  "foam":    { "sheet": { "file": "Terrain/Water/Foam/Foam.png", "frameWidth": 192, "frameHeight": 192 },
               "scale": 0.9375, "anim": { "frames": [0,1,2,3,4,5,6,7], "fps": 8, "loop": true } },
  "shore":   { "sheet": { "file": "Terrain/Ground/Tilemap_Flat.png", "frameWidth": 64, "frameHeight": 64 },
               "scale": 0.9375, "frames": [33,23,30,20,3,13,0,10,32,22,31,21,2,12,1,11] },
  "trees":   { "sheet": { "file": "Resources/Trees/Tree.png", "frameWidth": 192, "frameHeight": 192 },
               "scale": 0.9375, "origin": { "x": 0.5, "y": 0.9 }, "models": [0,1,2,3,4,5], "flip": true,
               "canopyHeight": 150 },
  "bridges": { "image": "Terrain/Bridge/Bridge_All.png", "scale": 0.9375,
               "frames": { "horizontal": { "x": 0, "y": 0, "width": 192, "height": 64 },
                           "vertical":   { "x": 0, "y": 80, "width": 80, "height": 176 } } },
  "castle":  { "image": "Factions/Knights/Buildings/Castle/Castle_Blue.png", "scale": 0.9375,
               "roofHeight": 160 }
}
```
- Los números de `origin`, `canopyHeight`, `roofHeight` y los rectángulos del puente son **provisionales** (los fija
  la puerta visual del apply, §9); el esquema no cambia.
- `shore.frames`: exactamente 16 enteros ≥ 0, índice = máscara de tierra `N=1, E=2, S=4, W=8`. Los valores de arriba
  son la lectura de `Tilemap_Flat` (bloque 3 × 3, tira vertical, tira horizontal e isla verdes); el 15 (sin agua) no se
  usa en una orilla y se fija al centro (11).
- `models`: ≥ 1 índice de frame; `flip` añade el volteo como variedad. Nota: los 6 frames de `Tree.png` son fotogramas
  de la misma especie (viento y tala), así que la variedad es sutil; el volteo la duplica sin objetos extra.
- `bridges.frames`: rectángulos de enteros (`x, y ≥ 0`, `width, height ≥ 1`); el encaje en la imagen se comprueba al
  cargar (§5.3), porque zod no conoce el tamaño del PNG.
- `terrain`: `{ trunk, water, bridge, castle }`, distintos dos a dos; los de 0015 no cambian. `ground.scale` → 0,9375.
- Test de contenido: `scale · frameWidth = cellSize` para `ground`, `water` y `shore`, y castillo a escala = huella
  en px (320 × 256 · 0,9375 = 300 × 240).

### 5.2 Planificador puro `planMapArt(snapshot, looks)`
Celdas "mojadas" = `water` ∪ `bridge`. Orilla = celda no mojada con alguna vecina 4-conexa mojada. Máscara de tierra:
bit a 1 si la vecina no está mojada; **fuera de la rejilla cuenta como tierra** (el borde del mundo no hace orilla).

| Lista | Capa | Qué | Objetos |
|---|---|---|---|
| `water` | baja | tramos por fila de celdas mojadas ∪ orillas (`TileSprite`, `tilePosition` alineada al mundo para que los tramos no muestren costura) | ~1 por fila con río |
| `foam` | baja | un sprite de 192 centrado por celda de orilla | 1 por orilla |
| `shore` | baja | `TileSprite` del frame de su máscara; tramos de máscara igual, por filas o por columnas, el agrupado con menos objetos | pocos por orilla recta |
| `bridges` | baja | sprite del marco `horizontal` si las vecinas N/S están mojadas (río vertical), `vertical` si no | 1 por puente |
| `trunks` | baja | árbol completo, base alineada al fondo de la celda | 1 por tronco |
| `castleBase` | baja | castillo completo en la huella, origen (0, 0) | 1 |
| `fallback` | baja | rectángulos de reserva por tramo (`terrainFills` + `mergeRuns` de 0015) de los grupos sin arte | según reserva |
| `canopies` | alta | mismo frame, posición y volteo que su tronco, `setCrop(0, 0, w, canopyHeight)` | 1 por tronco |
| `castleRoof` | alta | castillo con `setCrop(0, 0, w, roofHeight)` | 1 |

Orden dentro de la capa baja: agua, espuma, orillas, puentes, troncos, castillo, reserva. Así la espuma queda bajo la
orilla (como en el pack) y el jugador que pasa al sur de un árbol o del castillo se pinta delante de la base y detrás
de nada; quien pasa al norte queda tapado por la copa o el tejado.

Sin esquinas cóncavas (proposal): una orilla con agua solo en diagonal no existe para la máscara; queda la muesca.

Recuentos: el plan devuelve `objects` (total de objetos de ambas capas) y los recuentos de §6. El test del plan con
el contenido por defecto fija **`objects ≤ 300` en las semillas 42 y 123** (D11) y registra el máximo de 1..50 en el
diario (informativo).

### 5.3 Reserva por grupo (`resolveMapLooks`)
| Grupo | Hojas | Si falta alguna (o un frame usado no existe) |
|---|---|---|
| río | `Water.png`, `Foam.png`, `Tilemap_Flat.png` | celdas `water` y `bridge` como rectángulos de 0015; sin orillas ni espuma; los puentes con arte se siguen pintando encima si su grupo está bien |
| árboles | `Tree.png` | celdas `trunk` como rectángulos; sin copas |
| puentes | `Bridge_All.png` o un marco que no cabe | celdas `bridge` como rectángulos |
| castillo | `Castle_Blue.png` | huella como un rectángulo `terrain.castle`; sin tejado |

Es la misma regla que `resolveLooks` (0012): `FrameCount` y, para los marcos con nombre, `hasFrame(key, name)`. Los
marcos del puente se añaden en `BootScene.create` con `Texture.add(name, 0, x, y, w, h)` solo si el rectángulo cabe en
la fuente; si no, no se añaden y el grupo cae a reserva (sin excepción). Celdas `castle` fuera de una huella (solo en
mapas explícitos de test) siempre como rectángulo.

### 5.4 Costura y motor
```ts
interface MapArtCanvas {
  clear(): void;                                    // oculta todo (R)
  tiles(layer: 'low', run: TileRun): void;          // TileSprite reutilizado: tamaño, frame, escala, tilePosition
  sprite(layer: 'low' | 'high', s: SpriteSpec): void; // frame, escala, origen, flipX, crop opcional
  foam(frame: number): void;                        // pone el frame a todas las espumas visibles
  rect(fill: CellFill): void;                       // reserva
}
```
- `mapArtCanvas(scene)` crea `low` y `high` como `Layer` en dos llamadas separadas para respetar el orden de
  creación: `createPlayfield` hace suelo → `low` → `new RenderLayers(...)` (sus pools se crean al construir) →
  `high`. HUD y overlays van después y con `setDepth`, así que quedan encima. Un hijo de `Layer` solo se ordena dentro
  de su capa (doc de `Layer`), así que los objetos que se añaden al repintar caen en su capa aunque se creen tarde.
- Pools por tipo en cada capa, crecientes y reutilizados entre partidas (`clear` oculta, el siguiente se coloca);
  en Volver al menú el motor destruye la escena y se recrean, como `terrainCanvas` hoy.
- Espuma: `RenderLayers.render` calcula `frameAt(foam.anim, clock.ms)` y llama a `canvas.foam(f)` solo si cambia: 8
  cambios por segundo × N espumas, sin asignar. Con el mundo detenido o en modo manual sin `step`, el reloj no avanza
  (ADR-0012) y ningún test depende del frame.
- Variedad (D9): `treeChoices` hace un hash FNV-1a de 32 bits de los códigos del snapshot y siembra
  `Mulberry32(deriveSeed(hash, DECOR_STREAM))`; por cada tronco en orden de filas, un `next()` para el modelo y, con
  `flip`, otro para el volteo. Misma semilla → mismo mapa → mismos árboles; no toca ni el `random` de la partida ni el
  del mapa (instancia propia, fuera del núcleo). Descartado pasar la semilla a la escena: `StartedRun` y `RestartRun`
  la ocultan a propósito (ADR-0013) y abrir ese canal solo para presentación acopla la escena a la siembra.

### 5.5 Mapa vacío
Sin celdas no-hierba: plan vacío, 0 objetos, `sprites.mapArt` a 0. El suelo sigue siendo el `TileSprite` de hierba,
ahora con `tileScale` 0,9375.

### 5.6 Páginas consultadas
- `api-documentation/class/textures-texture.md#instance-addname-sourceindex-x-y-width-height` (`add` devuelve `null`
  si el nombre existe: se llama una vez en `BootScene`; la textura es global).
- `api-documentation/namespace/gameobjects-components-texturecrop.md#instance-setcropx-y-width-height` (crop relativo
  al frame, escalado con el objeto; no cambia tamaño ni origen).
- `api-documentation/class/gameobjects-layer.md` (un `Layer` es una lista de pintado; el `setDepth` de un hijo solo
  cuenta dentro de la capa; sin `scrollFactor`, que no hace falta en objetos del mundo).
- Tipos 4.2.1: `Texture.add(name, sourceIndex, x, y, width, height): Frame | null`, `setCrop(x?, y?, w?, h?)`,
  `TileSprite.setTileScale/setTilePosition`, `class Layer`. A comprobar en la primera tarea del render: que
  `setCrop` respeta `flipX` en la 4.2.1 (si no, la copa volteada usa un marco con nombre por modelo, mismo esquema).

## 6. Sondas E2E
- `window.__sprint.map`: el `MapSnapshot` (`castle`, `counts.castle`, `start` = salida) + `emptyForced`. Con
  `map=empty`: `castle: null`, `start` en el centro.
- `window.__sprint.sprites.cells`: `{ trunk, water, bridge, castle }` celdas representadas (con arte o reserva).
- `window.__sprint.sprites.mapArt` (nuevo): `{ shore, foam, trees, canopies, bridges, castle, objects,
  placeholders: { river, trees, bridges, castle } }`. `shore` = celdas de orilla (no tramos); `trees`/`canopies` =
  troncos con arte; `castle` = 1 con arte; `placeholders.*` = celdas pintadas con reserva por grupo. 0 en el menú.
- Contrato E2E: `trees + placeholders.trees = counts.trunk`, `bridges + placeholders.bridges = counts.bridge`,
  `castle = 1` con mapa generado y arte, y `shore` igual a las orillas que el test calcula sobre `map.cells`.

## 7. Balance
- `player.speed` 210 → 215 (decisión del usuario sobre el prototipo: 28/50; 24/50 con 210).
- **Punto de control** tras las tareas de dominio, antes del render: `balance.test` con la huella definitiva (banda
  25..35 sobre 1..50) y "quieto pierde antes de 180 s" con las 50; revalidar los plazos de 4.800 ticks (primera subida
  y pulso quieto). La banda manda sobre la velocidad: si cae fuera, se propone al usuario 210/220 o el desplazamiento
  de §3.2 con la medición de cada opción (script temporal en el scratchpad, como 0015 §7.2) y él decide.
- Firma dorada (42 y 123): se regenera y se **revisa a mano** antes de fijarla: las 20 `C` en columnas 14–18 × filas
  6–9, ningún `~`/`=` en filas 6..13 × columnas 13..19 y diferencias del orden de 135/576 y 95/576 (prototipo).

## 8. Plan de pruebas (e2e-lite)
| Escenario | Nivel |
|---|---|
| Celda `castle` no caminable; colisión del jugador con el castillo; gemas recolocadas desde el castillo | dominio |
| `CastleSite` por defecto y en otra rejilla; errores `map.castle` (tamaño, fuera de la rejilla) en dominio y zod | dominio + content |
| Zona de inicio centrada en la salida; río fuera de zona ∪ huella; 1 castillo de 20 celdas, salida libre y BFS 100 % desde ella en 1..50, 1..1.000, 0, 2³² − 1 | dominio |
| `open`/`cells`: sin castillo, salida en el centro; misma partida tick a tick con `map=empty` (salvo velocidad) | dominio + aplicación |
| Balance 25..35/50 y quieto < 180 s; firma dorada | aplicación (tests/support) |
| `landMask` en los 16 casos; tramos de orilla; orientación de puentes; `treeChoices` determinista e independiente | infraestructura (puro) |
| `planMapArt`: listas por capa, recuentos de la sonda, ≤ 300 objetos en 42/123; reserva por grupo | infraestructura (puro) |
| Orden de capas: baja antes de las entidades, alta después del jugador y antes del HUD (fábricas falsas) | infraestructura |
| Esquema `map`, colores de 4 tipos, escalas coherentes, procedencia de las 5 hojas | content + `guard:all` |
| Marcos del puente que no caben → reserva | infraestructura (`BootScene` con doble de texturas) |
| Espuma: frame por reloj, congelada en pausa y en manual sin `step` | infraestructura |

**E2E (0 nuevos, 2 ampliados, modo manual)**:
1. `gameplay.spec` "Mapa real…": añade firma con castillo, salida en (990, 630), recuentos de `sprites.mapArt` contra
   `map` (contrato de §6) y un intento de cruzar el castillo hacia el norte que se queda tangente.
2. `gameplay.spec` "Sprites…reserva": además de Torch, bloquea `Tree.png` y `Castle_Blue.png` y comprueba
   `placeholders.trees = counts.trunk`, `placeholders.castle = 20`, `canopies = 0` y sin errores no capturados.
Ajuste obligado (no nuevo): "Cámara: centrada al empezar…" usa el mapa real con la semilla 7; el jugador nace en la
salida, así que la vista inicial esperada pasa a (510, 360) y el recorrido hacia la derecha se revisa.

## 9. Puerta visual (primer bloque del apply)
Orden del apply: (1) dominio del castillo + punto de control de balance (§7); (2) datos, procedencia y render
completo; (3) **puerta visual**: capturas de las semillas 42, 123 y dos más (una con río vertical y otra horizontal)
con un script temporal de Playwright en el scratchpad (`?e2e&manual&seed=N`, varias posiciones de cámara con
`step(n)` e input; nada versionado), con orillas, puentes, copas, castillo y la escala 0,9375. El usuario las aprueba
antes de seguir con firma, E2E y docs; los valores provisionales de §5.1 se cierran aquí. Si rechaza las muescas de
orilla, el apply se para (proposal). Medición de fps `CI_LIKE=1` a demanda en ese punto (no gate).

## 10. Dependencias nuevas
| Paquete | Versión exacta | Motivo | Alternativa descartada |
|---|---|---|---|
| — | — | Ninguna. Autotile, tramos, hash y crop son unas 200 líneas propias sobre la API del motor ya usada. | `Tilemap` de Phaser: exige tileset y capa a pantalla completa (lección del PR #36: la capa transparente a pantalla completa partía los fps en CI); `RenderTexture` (opción A): mejor fps pero el usuario eligió C por la espuma animada. |

## 11. Rendimiento y seguridad
- **Tick**: sin coste nuevo (una celda más en las mismas consultas). Generación: + `cols · rows` escrituras de la
  huella; sigue ≤ 0,15 ms (bench "generar mapa").
- **Render**: ≤ 300 objetos estáticos por partida (D11), creados una vez y reutilizados al reiniciar; por frame solo
  `setFrame` de la espuma al cambiar de frame; 0 objetos y 0 asignaciones por frame. fps `CI_LIKE` ≥ 85 % de la base
  como objetivo a demanda, no gate (proposal). Palancas si se supera el tope o cae el fps, por este orden: (1) tronco
  sin copa separada cuando su vecina sur no es caminable (nadie puede pasar por delante: un solo sprite en la capa
  alta); ~~(2) una espuma por cada dos celdas~~ (retirada en r3: la sonda exige espuma = orillas; ver la palanca
  `Blitter` de §12.3); (3) volver a consultar al usuario.
- **Bundle/repo**: 5 PNG nuevos en `public/` (bytes exactos en la nota al copiarlos); sin cambio de código cargado
  de terceros.
- **Entradas externas**: `content/map.json` y `appearance.json` con zod estricto; marcos del puente contrastados con
  la imagen real antes de usarse. Procedencia: cada PNG con `sha256` y `bytes`, ninguno del Free Pack
  (`guard-assets.mjs`); solo las hojas usadas (no los otros colores del castillo ni `Rocks`).
- **CSP**: sin cambios (imágenes del mismo origen con `HTMLImageElement`, ADR-0012).
- **Datos persistidos**: sin cambios de formato. Los récords guardan la semilla: una semilla anterior a 0016
  reproduce ahora otro mapa (castillo y río movido), igual que pasó en 0015; aceptable, el historial no reproduce
  partidas.

## 12. Contraste con las specs delta (revisión 2, manda sobre lo anterior)

### 12.1 Dominio
| # | Spec | Antes (design r1) | Ahora |
|---|---|---|---|
| A1 | procedural-map "Contenido del mapa validado" | `castle` en [1, `castleMax` = 8] | `cols` en [1, ⌊columnas / 2⌋] y `rows` en [1, ⌊filas / 2⌋] de la rejilla (16 y 9 por defecto). zod solo exige enteros ≥ 1 (`map.castle.cols`/`rows`); el tope por rejilla y el encaje de huella + puerta van en `MapRules.create` (`checkCross`, que ya recibe arena), error `CASTLE_OUT_OF_GRID` con campo `map.castle`. Se elimina `MAP_LIMITS.castleMax`. Casos: {17, 4} y {5, 10} fallan; {1, 1} y {16, 9} valen (con 16 × 9: c0 = 8, r0 = 1, puerta en la fila 10). |
| A2 | "Mapa explícito y mapa vacío" | `open`/`cells` siempre con salida en el centro | `TerrainSource` `open` y `cells` aceptan `start?: { x, y }`. Sin él, centro del mundo sin comprobar. Con él, `resolveTerrain` exige posición legal (centro en [r, W − r] × [r, H − r] y sin solape con celdas no caminables, tangencia legal) con `MapRules.playerRadius` (nuevo campo; `create` ya recibe el radio); si no, `err` `MAP_START_ILLEGAL`, campo `map.start` ("punto de salida"). La zona de inicio de un mapa dado se centra en su salida. |
| A3 | Comparaciones con/sin mapa (procedural-map, enemy-behavior, run-outcome) | contra `open` en el centro | contra el **mapa vacío con salida (990, 630)**: `{ kind: 'open', start: castle.exit }`. Helper de test `emptyWithExit(config)` en `tests/support`. |
| A4 | "Sonda del mapa para E2E" | `castle: { col, row, cols, rows }` | `castle: { firstCol, lastCol, firstRow, lastRow } \| null`; `start: { x, y, radius }` es a la vez salida y zona (siempre coinciden). |
| A5 | run-outcome "Salida ante la puerta" | — | Comprobado a mano: a 64 px de (990, 630) solo hay la (16, 9) (30 px, +y) y las esquinas de la (15, 9) y la (17, 9) (42,426 px, x opuestas): input (0, 1) sin lógica nueva en el bot. Test en `tests/support` con 1..50. |
| A6 | enemy-spawning "Jugador ante la puerta" | — | Comprobado: el anillo (582,727) solo se recorta por arriba/abajo (y = r o H − r), fuera de (510, 360)–(1.470, 900); pasa con la lógica de 0013. Va como test de regresión dentro de la tarea de la salida, no como tarea propia. |

### 12.2 Render
| # | Spec | Antes (design r1) | Ahora |
|---|---|---|---|
| B1 | "Orillas por autotile de 4 vecinos" | orilla = celda de **tierra** junto al río; fuera de la rejilla = tierra; 16 frames | (r3, vuelve a la semántica de r1) orilla = celda de **tierra** (`grass`, `trunk`, `castle`) con ≥ 1 lado de río (`water` o `bridge`); fuera de la rejilla **no** es río. El caso es el conjunto de lados de **río** (15 casos útiles; el vacío no es orilla). `water` y `bridge` nunca son orilla. Función pura `riverSides(snapshot, c, r)` en `shoreTiles.ts`. Espuma: 1 por celda de orilla. La pieza de orilla va en la celda de tierra, bajo el árbol si lo hay (capa baja: orilla antes que troncos). |
| B2 | "Datos de aspecto validados" (mapa) | `shore.frames` array de 16; `foam.anim`; `trees.models` de enteros; `bridges.image` + `horizontal/vertical`; `castle.image` + `roofHeight`; `canopyHeight` | Cada aspecto del mapa con `sheet` (o `image` en el puente), `scale` y `origin`. `shore.cases`: `strictObject` de **15 claves canónicas** = lados de río (`N`, `E`, `S`, `W`, `NE`, `NS`, `NW`, `ES`, `EW`, `SW`, `NES`, `NEW`, `NSW`, `ESW`, `NESW`, letras en orden N-E-S-W) → índice de frame de `Tilemap_Flat` (hierba con borde en esos lados; p. ej. `S` = borde inferior del bloque 3 × 3); ausente = error con la clave, otra grafía (`EN`) = campo desconocido. `foam.idle` con `loop: true` obligatorio. `trees.models: [{ frame }]` (≥ 1) y `flip` booleano. `bridges.frames: { northSouth, eastWest }`. `castle.sheet` con `frameWidth`/`frameHeight` 320 × 256 y `frame`. Sin `canopyHeight` ni `roofHeight` (ver B4). |
| B3 | "Orientación de los puentes" | `horizontal` si N/S mojadas | **norte-sur** si N y S son tierra; si no, **este-oeste** si E y O son tierra; si no, norte-sur (recodo). Fuera de la rejilla = río. Función pura `bridgeOrientation` en `shoreTiles.ts`. |
| B4 | "Capas del mapa y de las entidades" | corte por `canopyHeight`/`roofHeight` de datos | El corte se **deriva**, sin números de datos: copa = parte del dibujo con y < borde superior de la celda del tronco; tejado = parte con y < borde superior de la fila inferior de la huella. En px de frame: `cut = origin.y · frameHeight − cellSize / scale` (árbol) y `frameHeight − cellSize / scale` (castillo con origen (0,5; 1): 256 − 64 = 192). Tronco/fachada con `setCrop(0, cut, w, h − cut)`, copa/tejado con `setCrop(0, 0, w, cut)`: el recorte es de **ancho completo**, así que `flipX` no le afecta (se retira el riesgo de §5.6). Test de contenido: `0 < cut < frameHeight`. |
| B5 | "Pintado del mapa" | castillo con origen (0, 0) | Castillo con origen en el punto medio del borde inferior de la huella ((990, 600) por defecto, `origin` (0,5; 1)); árbol con su origen en el punto medio del borde inferior de su celda; puente centrado en su celda (`origin` (0,5; 0,5)). |
| B6 | "Reserva por elemento" | reserva por **grupo** (río = agua + espuma + orilla) | Reserva **por elemento**, independiente: agua → rectángulo `water` por celda `water` (las `bridge` no); árbol → rectángulo `trunk`, sin copa; puente → rectángulo `bridge`; castillo → 1 rectángulo `castle` sobre la huella, sin tejado; orilla y espuma → no se pintan. La orilla usa `Tilemap_Flat.png`, la hoja del fondo: si el fondo falla, tampoco hay orillas (spec). Agua con arte: tramos de celdas `water` ∪ `bridge` ∪ **orillas** (el agua asoma por el margen transparente de la pieza; nunca bajo tierra que no sea orilla). Si la orilla cae a reserva, los tramos de agua se limitan a `water` ∪ `bridge` (si no, el agua quedaría a la vista sobre la tierra). |
| B11 | "Pintado del mapa" (espuma en su borde con el río, bajo la pieza) | espuma de 180 px centrada sin recorte | La espuma centrada en la celda de orilla invadiría la hierba de las celdas de tierra no-orilla vecinas (el fondo está por debajo). Se recorta con `setCrop` a la celda más la extensión de **sus lados de río**: en px de frame, con la celda en [m, 192 − m] (m = (192 − 64) / 2 = 64), `x0 = W ? 0 : m`, `x1 = E ? 192 : 192 − m`, igual en `y` con N/S. Rectángulo puro `foamCrop(sides, frame, tile)` en `planMapArt`; la extensión sobre orillas vecinas la tapan sus piezas (todas las espumas van antes que todas las orillas) y la de un puente, el puente. Comprobado en `node_modules/phaser/src/gameobjects/components/TextureCrop.js` (4.2.1): `setFrame` reaplica el crop (`updateCropUVs`) si `isCropped`, así que la animación lo conserva. |
| B7 | "Baldosas a la escala de la celda" | test de contenido | Además **validación de arranque**: `loadAppearance(raw, { enemyIds, cellSize })` comprueba `frameWidth · scale = frameHeight · scale = cellSize` (± 0,001) para `ground`, `map.water` y `map.shore`, error con `ground.scale`/`map.water.scale`/`map.shore.scale`. El castillo de 300 × 240 se comprueba en el test de contenido del repositorio (la spec lo pide "con los datos del repositorio"). |
| B8 | "Variedad de árboles por semilla" | semilla = hash del mapa | **Semilla de la partida**: con el hash del mapa, "Otra semilla, otros modelos" (mismo mapa explícito, semillas 42 y 43) fallaría. La composición ya conoce la semilla de cada partida (`started(s)`, sonda y `RecordRun`): `GameSceneDeps.decorSeed(): number` devuelve `deriveSeed(semillaActual, DECOR_STREAM)` y la escena lo pide al pintar cada mapa nuevo. `treeModel(decorSeed, cellIndex, models, flip)` = hash por celda (`deriveSeed(decorSeed, cellIndex)`, uint32: `h % models.length` y, con `flip`, un bit alto). Sin instancia de PRNG ni orden de recorrido; `application` sin cambios (ADR-0013, addendum 3). |
| B9 | "Sonda de render para E2E" | `mapArt` con `placeholders` por grupo | `sprites.mapArt = { water, shore, foam, tree, canopy, bridge, castle: { painted, fallback }, objects }`; `painted` incluye los pintados con reserva; orilla, espuma y copa no tienen reserva (si su hoja falta, `painted` 0). `sprites.cells` + `castle`. Todo a 0 en el menú. |
| B10 | "Coste de render (a demanda)" | test sin motor en 42/123 | Las dos cosas: (a) **gate en `verify`**: test puro de `planMapArt` con `objects ≤ 300` en 42 y 123 y máximo de 1..50 registrado; test de `paintMapArt` con canvas doble que comprueba `sprites.mapArt.objects = plan.objects`; (b) el escenario `[realtime]` se cubre con un test `@realtime` nuevo en `realtime.spec.ts` (mapa real, 42 y 123: objetos de la sonda ≤ 300, fps registrados y % sobre 21,6/21,9), fuera del CI y de la suite `logic`. |

### 12.3 Objetos: estimación y palanca medida
(r3) Con la orilla en tierra hay orilla y espuma en **las dos riberas**: ~2 × largo del río más recodos, ~70–110
celdas de orilla por mapa. Estimación semilla 123: árboles 2 × ≤ 80 = ≤ 160, espuma ~70–110 (1 sprite por celda,
no se agrupa: lleva recorte por caso), orillas en tramos de igual caso ~30–45, agua en tramos ~10–20, puentes 3,
castillo 2 → **~275–340: puede pasar de 300**. La espuma es lo que crece; las orillas y el agua siguen cabiendo
gracias al agrupado.
- **Agrupado (por defecto)**: agua y orillas en tramos por filas **o** por columnas, el que dé menos objetos (un río
  vertical baja de ~18 tramos de agua a ~3).
- **Punto de control** (tarea 3.7): el test de D11 mide 42, 123 y el máximo de 1..50 antes de tocar el motor.
- **Palanca si > 300** (sin cambiar el plan ni la spec), por pasos y midiendo tras cada uno: (a) **espuma** en un
  `Blitter` de la capa baja, un `Bob` por celda de orilla; como los `Bob` no recortan, `BootScene` añade marcos con
  nombre por frame × caso (8 × 15 = 120 `Texture.add` con el rectángulo de `foamCrop`) y la animación es `setFrame`
  al marco `(frame, caso)`: la espuma pasa a 1 objeto (~185–235 en total); (b) solo si no basta, troncos y copas en
  `Blitter` con marcos con nombre de tronco/copa por modelo. Cuenta 1 objeto por `Blitter`; la sonda sigue contando
  espumas/árboles por celda. Doc:
  `api-documentation/class/gameobjects-bob.md` y `class/gameobjects-gameobjectfactory.md#instance-blitterx-y-texture-frame`;
  tipos 4.2.1: `class Blitter` con `Transform` (la escala del `Blitter` escala los `Bob`, que se colocan en
  `pos / scale`), `Bob.setFrame`, `Bob.flipX`. Antes de aplicarla se avisa al orquestador con la medición.

### 12.4 E2E (e2e-lite: 0 tests nuevos en `logic`, 2 ampliados)
- "Recuentos del mapa pintado" + "Sonda con castillo y salida" → amplían **"Mapa real…"** (`gameplay.spec`): firma con
  castillo, huella 14–18 × 6–9, salida (990, 630), jugador en ella, `sprites.cells` con `castle` 20, `mapArt` contra
  `map.cells` (orillas calculadas en el test sobre la lista), sin reserva; `overlapsBlocked` incluye `castle`.
- "Hojas del mapa bloqueadas" → amplía **"Sprites…reserva"**: además de Torch, aborta las 5 hojas del mapa; tras el
  primer `step(60)` comprueba reserva de agua/árbol/puente = recuentos, castillo 1 con reserva, espuma y copa 0, tick
  60; el resto del test (muestreo de 600 ticks) sigue. Choca con "los sprites de entidades no usan aspecto de
  reserva" (Torch sí lo usa): **ajuste de redacción pedido a la spec** (§12.6).
- "Cámara: centrada al empezar…": la primera lectura pasa a la fórmula de la cámara con el jugador del snapshot
  ((510, 360) con la semilla 7); el escenario de world-camera no fija la posición inicial con mapa real.

### 12.5 Riesgos nuevos
- ~~**R1 · semántica de orilla y `Tilemap_Flat`**~~: **cerrado** (r3). El usuario aprobó la orilla en la celda de
  tierra (hierba con borde de `Tilemap_Flat`), agua lisa en la celda de agua y espuma en el borde; la spec se
  ajustó (B1, B6, B11). Queda solo elegir los 15 frames en la puerta visual (dato).
- **R3 · objetos con espuma en las dos riberas**: estimación en el límite (§12.3); el punto de control 3.7 decide si
  se aplica la palanca (a).
- **R2** · el corte derivado exige elegir `origin.y` del árbol tal que `cut` caiga en la base del tronco del dibujo;
  se fija en la puerta visual (dato).

### 12.6 Ajustes de redacción pedidos a la spec
Los tres están ya aplicados en `specs/sprite-rendering/spec.md` (r3): "Hojas del mapa bloqueadas" (…cuya hoja no se
bloquea…), tope ≤ 300 también con test sin navegador en `verify`, y orilla en tierra con sus recuentos en "Recuentos
del mapa pintado".

### 12.7 Desviaciones del apply (registradas tras verify, W1)
Coherentes con las specs; detalle en `docs/ai-log/2026-11-23-0016-apply.md`:
- La regla baldosa × escala = `cellSize` la comprueba `checkTileScales`, llamada desde `bootContent`;
  `loadAppearance` no recibe `{ enemyIds, cellSize }`.
- El aspecto de reserva de cada elemento se pinta en su propio hueco de la capa baja, no todo al final (§5.2).
- Los tests de comparación con y sin mapa usan el helper `startEmptyWithExit` (mapa vacío con salida (990, 630)).

## 13. ADRs
- Addendum a `docs/adr/0013-mapa-de-rejilla-con-flujo-de-azar-propio.md` (castillo en dominio, salida por mapa y
  declarable, `DECOR_STREAM` con la semilla de la partida fuera del contrato de la simulación, render por sprites en
  dos capas con `Blitter` como palanca).

## 14. Riesgos del design
- **Objetos cerca del tope**: ver §12.3 (estimación, punto de control y palanca).
- ~~`setCrop` con `flipX`~~: retirado por B4 (recorte de ancho completo).
- **Builders de test con mundos pequeños**: `castle` obligatorio y su encaje en la rejilla pueden invalidar
  `MapRules` de tests con arenas diminutas; se les da una huella pequeña en el builder.
- **Firma y E2E de cámara/mapa** cambian por la salida; revisar a mano, no regenerar a ciegas.
- **Variedad sutil de árboles** (fotogramas de la misma especie); se juzga en la puerta visual.
