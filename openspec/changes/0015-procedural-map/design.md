# Design · 0015-procedural-map

> Revisión 2 (tras contrastar las 8 specs delta). Cambios respecto de la revisión 1 en §11.

## Resumen
El mapa es un **`GameMap` inmutable de rejilla** (⌈W/60⌉ × ⌈H/60⌉ celdas, 32 × 18 por defecto, un byte por celda)
que genera una función pura del dominio (`generateMap`) a partir de `MapRules` (de `content/map.json`, validado con
zod) y de un **`RandomGenerator` propio**, sembrado por la composición con una semilla derivada de la de la partida.
`Run` lo recibe ya resuelto (`TerrainSource`) y lo usa en dos sitios del tick: el movimiento del jugador (resolución
exacta por ejes con contacto tangente) y la suelta de gemas (recolocación). Lo expone una sola vez como
`MapSnapshot` para el render y la sonda E2E. El adaptador pinta las celdas no-hierba en **una CanvasTexture de
cols × rows px escalada × `cellSize`** con filtro NEAREST, encima del suelo de hierba.

Decisión estructural (flujo de azar propio y rejilla en el núcleo): **ADR-0013**.

Vía de consulta de Phaser: MCP `phaser-docs` (páginas citadas en §5) contrastado con
`node_modules/phaser/types/phaser.d.ts` de la 4.2.1 instalada (`createCanvas`, `CanvasTexture.refresh`,
`Texture.setFilter`).

## 1. Decisiones del gate y dónde viven

| # | Decisión | Dónde vive |
|---|---|---|
| G1 | Celda 60 px → rejilla 32 × 18 | `content/map.json` `cellSize` |
| G2 | Troncos 12 % (58–80 de 576, tolerancia provisional), manchas 3–8 | `trunkDensity`, `trunkPatch` |
| G3 | Un río de ancho 1, 2–3 puentes, vecindad 3 × 3 del puente sin troncos | `rivers`, `bridges` |
| G4 | Zona de inicio: disco de radio 180 px en el centro, toda hierba | `startRadius` |
| G5 | Rechazo por BFS de toda mancha que desconecte celdas caminables | `generateMap` |
| G6 | Azar del mapa derivado de la semilla, independiente del de oleadas | composición + ADR-0013 |
| G7 | Solo el jugador colisiona; resolución por ejes (x, luego y) | `Player.move` + `GameMap` |
| G8 | Gemas en celda no caminable → centro de la caminable más cercana, sin azar | `GemField.drop` |
| G9 | Bot v2 (repulsión 1/d² de celdas bloqueadas < 64 px, giros +45, −45, +90, −90, +135, −135) | `tests/support/policies.ts` |
| G10 | Balance objetivo ~28/50 con un retoque pequeño de contenido | §7 |
| G11 | `?e2e&map=empty` solo en composición/adaptador | `resolveMapMode` |
| G12 | Render en una sola textura con colores lisos | `TerrainView` |
| G13 | Sonda `window.__sprint.map` + `sprites.cells` | `main.ts` |
| G14 | Rejilla tipada con `isWalkable(col, row)` para el flow-field | `GameMap` |

## 2. Piezas por capa

| Capa | Pieza | Nueva/Mod. | Notas |
|---|---|---|---|
| domain | `map/CellType.ts` | Nueva | `CELL_TYPES = ['grass','trunk','water','bridge']`, códigos 0..3, `isWalkableType`. |
| domain | `map/MapRules.ts` (VO) | Nueva | Parámetros + invariantes cruzadas con arena y jugador (§3.1). Errores como constantes. |
| domain | `map/GameMap.ts` (VO) | Nueva | Rejilla inmutable (`Uint8Array` privada). `typeAt`, `isWalkable`, `cellAt`, `cellRect`, `overlapsBlocked`, `limitMoveX/Y`, `nearestWalkable`, `snapshot()`. Fábricas `open`, `fromCells`. |
| domain | `map/generateMap.ts` | Nueva | `(rules, random) → GameMap` (§3.2). |
| domain | `map/connectivity.ts` | Nueva | `reachableFrom(cells, cols, rows, start, seen, queue)`: BFS 4-vecina sobre buffers del llamador. |
| domain | `map/TerrainSource.ts` | Nueva | `open` / `generated(random)` / `cells(types[])` y `resolveTerrain(source, rules)`. |
| domain | `map/MapSnapshot.ts` | Nueva | Vista congelada (§3.5), construida una vez por partida. |
| domain | `player/Player.ts` | Mod. | `move(input, dt, arena, map)`: recorte al mundo y resolución por ejes con el mapa (§4). |
| domain | `progression/GemField.ts` | Mod. | Recibe el `GameMap`; `drop` recoloca antes de ocupar la gema del pool (también las de `RunSetup`). |
| domain | `run/RunConfig.ts` | Mod. | `RunConfig.map`, `RunRules.map: MapRules`; `buildRunRules` construye `MapRules`. |
| domain | `run/RunSetup.ts` | Mod. | `initialPlayer` falla si el jugador inicial solapa una celda no caminable. |
| domain | `run/Run.ts` | Mod. | `Run.start(config, random, setup = {}, terrain = OPEN_TERRAIN)`; guarda `GameMap` y su `MapSnapshot`; getter `map`. Contrato de determinismo actualizado. |
| domain | `shared/RandomGenerator.ts` | Mod. (doc) | "Única fuente de azar" → "único puerto de azar"; la partida usa dos instancias. |
| application | `StartRun.ts` | Mod. | `execute(config, random, setup?, terrain?)`; tipo `RunSeeding { random; terrain }`. |
| application | `RestartRun.ts` | Mod. | `nextSeeding: () => RunSeeding` en lugar de `nextRandom`. |
| application | `TickRun.ts` | Mod. | `map(): MapSnapshot`. |
| infrastructure | `content/map.json` + `MapSchema` | Nueva | zod estricto (§3.1); `loadRunConfig` lo añade. |
| infrastructure | `random/deriveSeed.ts` | Nueva | `deriveSeed(seed, stream)`: mezcla uint32 (finalizador murmur3 con *salt*). |
| infrastructure | `url/resolveMapMode.ts` | Nueva | `?e2e&map=empty` con zod (`z.literal('empty')`); patrón de `resolveManual`. |
| infrastructure | `phaser/TerrainView.ts` | Nueva | Costura `TerrainCanvas` + función pura `terrainFills(map, colors)` (rectángulos de mundo por celda no-hierba y recuento por tipo). |
| infrastructure | `phaser/GameScene.ts` | Mod. | Implementa `TerrainCanvas` con CanvasTexture; pinta al crear y al reiniciar; `mapView()` para la sonda. |
| infrastructure | `content/appearanceSchema.ts` + `appearance.json` | Mod. | `terrain: { trunk, water, bridge }` estricto, `#RRGGBB`, distintos dos a dos (superRefine que nombra el campo repetido). |
| infrastructure | `phaser/renderCounts.ts` | Mod. | `SpriteCounts.cells: { trunk, water, bridge }` (0 en el menú). No cuenta como fondo ni como reserva. |
| composition | `seedSource.ts` | Mod. | `seededRun(seed, mode): RunSeeding` — oleadas `Mulberry32(seed)`, mapa `Mulberry32(deriveSeed(seed, MAP_STREAM))` u `OPEN_TERRAIN` con `map=empty`. `restartRandoms` lo usa. |
| composition | `runLauncher.ts` | Mod. | Usa `seededRun`. |
| composition | `main.ts` | Mod. | `resolveMapMode` una vez por carga (aviso único); sonda `map` getter (null en el menú) con `emptyForced`. |
| tests/support | `policies.ts` | Mod. | `referenceBot(config, map)` v2 (§7.1). |
| tests/support | `runs.ts`, `mapLayouts.ts` | Mod./Nueva | `startSeededRun(config, seed, mode?)` vía `seededRun`; `mapWith(config, { '10,4': 'trunk', … })` para escenarios. |

Por qué en dominio: generación, caminabilidad y colisión son reglas de juego deterministas (ADR-0002). El
seed-mixing (`deriveSeed`) es detalle técnico de cómo se siembra el puerto y va junto a Mulberry32.
`TerrainSource` no es un puerto (es un valor sin dos implementaciones de comportamiento).

## 3. Modelo

### 3.1 `content/map.json` y `MapRules`
```json
{
  "cellSize": 60,
  "startRadius": 180,
  "trunkDensity": 0.12,
  "trunkPatch": { "min": 3, "max": 8 },
  "rivers": 1,
  "bridges": { "min": 2, "max": 3 },
  "tuning": { "riverVerticalChance": 0.5, "riverMeander": 0.25, "patchAttempts": 4000 }
}
```
- zod por campo (spec "Contenido del mapa validado"): `cellSize` entero ≥ 1; `startRadius` > 0;
  `trunkDensity` ∈ [0, 0,3]; `trunkPatch` enteros 1 ≤ min ≤ max ≤ 16; `rivers` entero ∈ [0, 2]; `bridges` enteros
  1 ≤ min ≤ max ≤ 6; `tuning` (campos de ajuste del design, mismas reglas: ausente/desconocido/fuera de rango):
  `riverVerticalChance` y `riverMeander` ∈ [0, 1], `patchAttempts` entero ≥ 1. Todo `strictObject`.
- Cruzadas en `MapRules.create(config, arena, playerRadius)` (una sola implementación; la llaman `buildRunRules` y el
  `superRefine` del loader, ADR-0007), con el campo en el error:
  1. `cellSize ≥ 2 · player.radius` → `map.cellSize`. Garantiza que un pasillo de 1 celda deja pasar al jugador, así
     que **la BFS 4-vecina por celdas equivale a la alcanzabilidad del círculo** (dos celdas que solo comparten
     esquina no comunican ni en BFS ni para el círculo).
  2. `startRadius ≤ min(W, H) / 2` → `map.startRadius`.
  3. Resto del mundo no múltiplo: `W mod cellSize` y `H mod cellSize` deben ser 0 o ≥ 2 · radio → `map.cellSize`
     (mantiene la equivalencia BFS en la última columna/fila recortada; 4.000 mod 60 = 40 ≥ 32 vale).
- Rejilla: `cols = ⌈W / cellSize⌉`, `rows = ⌈H / cellSize⌉`; la celda (c, r) ocupa
  `[c·s, min((c+1)·s, W)] × [r·s, min((r+1)·s, H)]`. `cellAt(x, y) = (min(⌊x/s⌋, cols−1), min(⌊y/s⌋, rows−1))`.
- Zona de inicio: celda cuyo rectángulo tenga algún punto a distancia **< `startRadius`** del centro (estricto: con el
  contenido por defecto, (18, 9) a 120 px sí, (19, 9) a 180 px no). Por defecto: columnas 13..18 × filas 6..11 (con
  las esquinas del bloque fuera del disco).

### 3.2 `generateMap` (orden de consumo de azar fijo, parte del contrato)
1. `cells[]` = hierba; `zone[]` = zona de inicio; `noTrunk[]` = zona.
2. **Ríos** (`rivers` veces). Orientación común a todos: vertical con `riverVerticalChance`. El primer río elige
   lado (antes o después de la zona de inicio) al azar; el segundo, el opuesto, así que **nunca se tocan**. Banda del
   río: índices de columna (vertical) o fila (horizontal) entre el borde + 1 y la banda de la zona − 1, en su lado
   (vertical por defecto: cols 1..11 o 20..30; horizontal: filas 1..4 o 13..16). Posición inicial uniforme en la banda.
   Recorrido de borde a borde, una línea por paso: con probabilidad `riverMeander` se desplaza ±1 dentro de la banda y
   añade la celda de enlace en la misma línea (el río sigue siendo **4-conexo**); **un desplazamiento no puede invertir
   el anterior en la línea siguiente** (sin bloques 2 × 2 de río). Todas las celdas son `water`.
   Puentes: `n` uniforme en `[bridges.min, bridges.max]`; candidatos = celdas "rectas" (sus dos vecinas del río están
   en el eje del río), fuera de la primera y última línea y no adyacentes a otro puente; se eligen `n` al azar entre
   candidatos y pasan a `bridge`. Su vecindad 3 × 3 pasa a `noTrunk`. El río no se rechaza (con puentes siempre
   conecta); la postcondición (paso 4) lo vigila.
3. **Troncos**: objetivo `T = round(trunkDensity · N)` (69 por defecto). Hasta `T` o `patchAttempts` intentos:
   tamaño `s` uniforme en `[min, max]`, semilla aleatoria; crecimiento por frontera (celda 4-vecina elegible al azar).
   Elegible = hierba, no `noTrunk` y **sin vecina 4-conexa `trunk` de otra mancha** (las manchas no se fusionan: cada
   componente queda en [min, max]). Si no llega a `s`, o si la BFS detecta alguna caminable no alcanzable, se revierte
   la mancha entera. Se para al alcanzar `≥ T` (máximo `T + max − 1` = 76 ≤ 80).
4. **Postcondición** (invariante, no se espera que falle): BFS completa desde la celda del centro y recuento de
   troncos en [T − 0,02·N, T + 0,02·N]; si no, `Error('Invariante rota…')`. Los tests 1..1000, 0 y 2³²−1 lo ejercitan.

Asignaciones solo en la generación: `cells`, `zone`, `noTrunk`, `seen`, cola `Int32Array(N)`. Prototipo: ≤ 0,15 ms.
Agua esperada: vertical ~20–25 celdas (3,5–4,5 %), horizontal ~36–42 (6–7 %); caminable ≥ 75 %.

### 3.3 `GameMap`
- `cols`, `rows`, `cellSize`, `width`, `height`, `start: { x, y, radius }`.
- `typeAt(c, r)`; `isWalkable(c, r)`: fuera de la rejilla → `false`; `grass`/`bridge` → `true`.
- `overlapsBlocked(x, y, r)`: celdas del AABB del círculo; punto más cercano del rectángulo cerrado; solape estricto
  `d² < r²` (tangencia no es solape). Sin asignar.
- `limitMoveX(x0, x1, y, r)` / `limitMoveY(y0, y1, x, r)`: posición final del eje (§4). Sin asignar.
- `nearestWalkable(x, y, out)`: si `cellAt(x, y)` es caminable, `out = (x, y)`; si no, centro (del rectángulo
  recortado) de la caminable de menor **distancia² euclídea desde (x, y)**; recorrido fila-mayor con `<` estricto ⇒
  empate → fila menor, luego columna menor. O(N), sin azar, escribe en `out`.
- `GameMap.open(rules)`; `GameMap.fromCells(types, rules): Result` (dimensiones exactas, error con
  "dimensiones"; no exige composición, zona ni conectividad).

### 3.4 API de arranque (G6)
```ts
type TerrainSource =
  | { readonly kind: 'open' }
  | { readonly kind: 'generated'; readonly random: RandomGenerator }
  | { readonly kind: 'cells'; readonly cells: readonly CellType[] };

Run.start(config, random, setup = {}, terrain: TerrainSource = OPEN_TERRAIN)
StartRun.execute(config, random, setup?, terrain?)
interface RunSeeding { readonly random: RandomGenerator; readonly terrain: TerrainSource }
RestartRun(config, nextSeeding: () => RunSeeding)
```
- `Run.start(config, seed)` descartado: el dominio conocería el PRNG (ADR-0002).
- `OPEN_TERRAIN` por defecto = la convención de la spec ("posiciones explícitas sin mapa declarado → mapa vacío"):
  los ~43 usos de tests siguen válidos. Lo que juega "contenido por defecto + semilla" (determinismo, balance,
  partida larga) pasa a `startSeededRun`, que llama a la misma `seededRun` que la composición.
- Riesgo del defecto (producción sin mapa): lo cierran `seededRun` como única ruta de la composición, el test de
  `runLauncher`/`restartRandoms` (mapa = el de `generateMap` con la semilla derivada) y el E2E de la sonda.
- El mapa **no consume** el `random` de la partida (spec "Azar del mapa independiente").

### 3.5 `MapSnapshot` y sondas
```ts
interface MapSnapshot {
  readonly cols: number; readonly rows: number; readonly cellSize: number;
  readonly cells: readonly CellType[];               // cols·rows, orden de filas, congelado
  readonly counts: Readonly<Record<CellType, number>>;
  readonly start: { readonly x: number; readonly y: number; readonly radius: number };
}
```
- No va en `RunSnapshot` (estático: copiarlo por frame asignaría). `Run.map` devuelve la misma instancia congelada;
  modificarla desde fuera no toca la `Uint8Array` interna.
- `window.__sprint.map` = `{ ...MapSnapshot, emptyForced }` (la composición sabe si `map=empty`); `null` en el menú.
- `window.__sprint.sprites.cells` = recuento por tipo que devolvió el último `paintTerrain` (0 en el menú).
- "Igual al que genera el núcleo" en E2E: los E2E no importan `src/`; comprueban (a) los invariantes sobre la sonda
  (recuentos, zona, conectividad por BFS en el propio test) y (b) una firma dorada: `tests/support/mapGolden.ts` (sin
  imports) guarda la lista de la semilla 42 y 123 serializada (`.T~=`, 576 caracteres); un test unitario la recalcula
  con `seededRun` y falla si diverge.

## 4. Flujo de un tick (solo lo que cambia)
1. `Player.move`: `(dx, dy) = dir · speed · dt`. Eje x: `x1 = clampX(x0 + dx)`, `x = map.limitMoveX(x0, x1, y0, r)`;
   eje y con la x ya resuelta: `y1 = clampY(y0 + dy)`, `y = map.limitMoveY(y0, y1, x, r)`.
   `limitMoveX` (y simétrico): para cada celda no caminable del AABB barrido `[min(x0,x1) − r, max + r] × [y − r, y + r]`
   calcula el primer contacto en la dirección del movimiento: si `y` está en `[top, bottom]`, cara (`left − r` o
   `right + r`); si no, esquina con `ey` = distancia vertical a la cara más cercana y, si `ey < r`,
   `left − √(r² − ey²)` (o `right + …`). Resultado `clamp(min contactos, x0, x1)` en la dirección del movimiento.
   Propiedades (spec "Colisión con el mapa"): llega exactamente al destino si es legal; queda **tangente** (584,
   no 583,33); la componente paralela se conserva; nunca rebota (resultado entre x0 y x1); **no hay túneles** a
   ninguna velocidad (es un barrido, no una prueba del destino); dos troncos en diagonal no dejan paso porque cada
   eje se para en su cara. Coste: ≤ 6 celdas por eje, sin asignar (un `Vector2` por tick, como hoy).
2. Persecución, armas, proyectiles, pulsos y spawns: **sin cambios** (los enemigos no consultan el mapa).
3. `removeDead → dropGem → GemField.drop(x, y, xp)`: `map.nearestWalkable` en un `out` reutilizable; con el tope
   lleno se suma a la más antigua sin recolocar nada (spec).
4. `GemField.step`: sin cambios. Las gemas **atraídas** vuelan en línea recta y pueden cruzar celdas bloqueadas; el
   invariante "ninguna gema en celda no caminable" aplica solo a las no atraídas (spec `xp-gems`). Una gema en esquina
   cóncava entra en el radio de atracción (128 px), así que siempre es recogible.

Orden del tick y consumo de azar: idénticos.

## 5. Render (adaptador)
- `terrainFills(map, colors)` (puro, testeable sin Phaser): por cada celda no-hierba, `{ col, row, color }` y su
  rectángulo de mundo recortado; recuento por tipo. `paintTerrain(canvas, map, colors)` lo aplica a la costura.
- `GameScene`: `textures.createCanvas('terrain', cols, rows)` **una vez** por instancia de la escena (persiste entre
  entradas; el TextureManager es global y `createCanvas` devuelve `null` si la clave existe) y
  `texture.setFilter(NEAREST)`. En cada partida (create y R): `clearRect`, `fillRect(c, r, 1, 1)` por celda no-hierba,
  `refresh()` (una subida a GPU por partida). Un `Image` en (0, 0), origen (0, 0), `setScale(cellSize)`, creado tras
  el suelo y antes de anillos/gemas/cadáveres/enemigos/proyectiles/jugador (orden de pintado = orden de creación).
  Con mundo no múltiplo el `Image` sobresale del mundo, pero la cámara está recortada al mundo (0013) y nunca lo
  muestra. En el menú la escena no existe: no se ve ninguna celda.
- Hierba transparente: el mosaico de `Tilemap_Flat` (o su reserva lisa) sigue debajo; las celdas se pintan igual
  falle o no la hoja del fondo.
- Coste por frame: un quad; sin objetos por celda ni por frame.
- Páginas consultadas: `api-documentation/class/textures-canvastexture.md#refresh` ("call refresh() once you are
  finished with your changes"), `class/textures-texturemanager.md` (`createCanvas` → `null` si la clave existe) y
  `class/gameobjects-graphics.md` (descartado: un Graphics se re-tesela cada frame; `generateTexture` exige clave
  única). Tipos 4.2.1: `createCanvas(key, width?, height?)`, `CanvasTexture.context/refresh()`,
  `Texture.setFilter(filterMode)`.

## 6. Riesgos
- **Agua**: con un río de ancho 1 y enlaces en los meandros sale 3,5–7 % según la orientación (la cifra "~6 %" del
  gate solo se alcanza en horizontal). El prototipo medía un 12 % **total** (troncos + agua) con hasta 3 ríos; aquí
  son 12 % de troncos **más** el río, así que hay algo más de bloqueo que lo medido. Por eso el balance se re-mide
  en el primer punto de control del apply (§7.2) antes de nada más.
- **Tolerancia de troncos 58–80 y manchas 3–8**: provisionales (spec); el test de composición sobre 1..1000 las
  confirma en el mismo punto de control. Si `patchAttempts` se agota antes de 58 en alguna semilla, se sube.
- **"Mismos spawns con y sin mapa" (1.200 ticks)**: válido mientras no se abra una oferta antes del tick 1.200 con
  el jugador quieto (hoy la primera llega ~4.346). La recolocación puede adelantar o atrasar recogidas; por eso el
  escenario de la primera oferta está condicionado a que se abra en el mismo tick.
- **Reordenación por semilla**: E2E que esperan algo concreto de `?e2e&seed=N` (p. ej. 42 quieto pierde) cargan con
  `map=empty` según la spec; los nuevos del mapa usan el real.
- **Plazos de 4.800 ticks** (primer pulso 4.161, primera oferta 4.346 en 0013): se revalidan con el mapa en el
  punto de control de balance.

## 7. Balance

### 7.1 Bot de referencia v2 (`referenceBot(config, map)`)
Suma 1/d² de enemigos (< 150 px), paredes (< 64 px) y celdas `trunk`/`water` (< 64 px, desde el punto más cercano
del rectángulo cerrado; dirección de ese punto al centro del jugador). Cuantiza a 8 direcciones; vector nulo →
(0, 0). Bloqueada = un tick de movimiento **sin obstáculos** a la **velocidad efectiva** (base + `speed` por nivel de
las mejoras del snapshot) deja el círculo solapando una celda no caminable (`map.overlapsBlocked`; las paredes no
bloquean). Orden de giros: +45°, −45°, +90°, −90°, +135°, −135° (positivo = horario en pantalla, de +x hacia +y);
todas bloqueadas → (0, 0). Lee el mapa por `MapSnapshot`/`GameMap`, nunca un mapa fijo.

### 7.2 Palanca y medición (punto de control con el usuario)
- Objetivo: **27–30 victorias /50** (~28) y 0 quietos vivos a 180 s, con mapa generado **y** con mapa vacío.
- Palanca primaria: **`player.speed`** (200 → 210 → 220): ayuda al bot a rodear obstáculos y no ayuda al quieto.
  Reserva: `player.maxHealth` (100 → 110), que sí afecta al quieto (vigilarlo).
- Medición: script temporal (scratchpad, no versionado) que barre los valores con la misma ruta que
  `balance.test.ts` y anota `victorias | quietos vivos (generado / vacío) | primera subida | primer pulso | derrota
  media` en el diario de IA. Se propone el menor valor en 27–30 y **el usuario decide** antes de fijarlo.
- Si cambia `player.speed`, revisar escenarios que usan "velocidad 200 px/s" sin declararla (los de la spec la
  declaran; los tests usan builders con velocidad propia).

## 8. Dependencias nuevas
| Paquete | Versión exacta | Motivo | Alternativa descartada |
|---|---|---|---|
| — | — | Ninguna. BFS, paseo aleatorio y mezcla de semilla son ~150 líneas propias. | `rot-js`/`simplex-noise`: el paseo basta y una dependencia en el núcleo complica pureza y bundle. Tilemap de Phaser: tileset generado para pintar colores lisos; más piezas para el mismo quad. |

## 9. Rendimiento y seguridad
- **Presupuesto**: generación ≤ 0,15 ms/partida (fuera del tick; spec < 20 ms en `npm run bench`, informativo).
  Colisión: 2 barridos de ≤ 6 celdas por tick (~0,05 µs). Recolocación O(576) solo en bajas sobre celda bloqueada.
  Sin asignaciones nuevas por tick (ADR-0003). Bench: caso nuevo "generar mapa" y el tope de enemigos con mapa.
- **Render**: CanvasTexture de 32 × 18 (2,3 KB) subida una vez por partida; un quad por frame.
- **Entradas externas**: `content/map.json` y `appearance.terrain` (zod + invariantes); `?e2e&map` (zod, solo con
  `?e2e`, 1 aviso a consola con el valor truncado, nunca HTML). Sin datos persistidos nuevos (el récord guarda la
  semilla, que reproduce el mapa). Sin cambios de CSP (canvas 2D).

## 10. ADRs
- `docs/adr/0013-mapa-de-rejilla-con-flujo-de-azar-propio.md`.

## 11. Cambios de la revisión 2 (contraste con las specs)
1. Campos de contenido con los nombres de la spec (`trunkDensity`, `trunkPatch`, `rivers` 0..2, `bridges`), más
   `tuning`. `trunkDensity` es fracción de **troncos** (no total bloqueado).
2. Rejilla ⌈W/s⌉ × ⌈H/s⌉ con última columna/fila recortadas (antes: exigía múltiplo). Nueva cruzada: resto 0 o ≥ 2r.
3. Zona de inicio con distancia estricta `<`; se elimina la cruzada `startRadius ≥ radio` (no está en la spec).
4. Colisión: barrido analítico por ejes con contacto tangente (antes: "si el destino solapa, no te muevas", que no
   llega a 584 ni bordea esquinas). Se elimina la cruzada de paso máximo por tick (el barrido no tiene túneles).
5. Río 4-conexo (celdas de enlace, sin inversión inmediata), siempre fuera de la zona de inicio, de borde a borde;
   dos ríos en lados opuestos. Puentes en celdas rectas; la vecindad 3 × 3 solo prohíbe troncos (el agua sigue).
6. Manchas por crecimiento de frontera que no tocan otras manchas (componentes en [min, max]).
7. Gemas: distancia euclídea desde el punto de la baja a centros (recortados), no distancia entre celdas.
8. Bot: bloqueo con 1 tick a velocidad efectiva (antes 4 ticks a velocidad base) y (0, 0) si todo bloquea.
9. Sonda: lista completa de 576 tipos + `emptyForced`; render con `sprites.cells` por tipo (antes `terrain` con
   reserva). Colores validados distintos dos a dos.
