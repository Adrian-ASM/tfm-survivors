# Design · 0026-build-sites

## Resumen
`GameMap` separa el **terreno**, que no cambia, de una **capa de obra** mutable con contador de revisión
(ADR-0025). Todos los lectores de paso (`isWalkable`, barridos, `nearestWalkable`, `hasClearLine`) ven la obra
al momento, y cada `FlowField`, el de la partida y los de los `GuardPost`, se invalida solo cuando cambia la
revisión. Un `Settlement` de dominio, propiedad de `Run`, guarda los 6 solares, sus puertas de acceso, las casas
con su ingreso y una `TowerBattery` con su propia reserva de proyectiles. La elección es la fase `building`, que
copia la tienda: el paso 12 la abre y `Run.build(kind)` y `Run.leaveSite()` no consumen azar. Los solares del mapa
generado salen del flujo `SITE_STREAM` 7, con candidatas y 1 valor por solar, como en ADR-0021.

Vía de la API de Phaser: MCP `phaser-docs`. Se consultaron
`/api-documentation/namespace/gameobjects-components-texturecrop.md` (`setCrop`, que ya usa el plan de
estructuras) y `class/gameobjects-image.md`. La doc publicada es la 4.1.0. No hace falta ninguna API nueva: se
reutilizan `Layer`, `setVisible`, `setCrop` y los pools de 0016–0022. Si hay dudas, mandan los tipos de
`node_modules/phaser` (4.2.1).

Sin bash en esta sesión no se pudo hacer `git fetch`. El ADR se numeró con el último local (0024), y hay que
comprobar contra `origin/main` antes del commit.

## 1. Huella, acceso y arte (medido)
- Hojas de Knights, del pack local (`Factions/Knights/Buildings/`): `House_Construction` y `House_Blue` miden
  **128 × 192**, y `Tower_Construction` y `Tower_Blue` **128 × 256**, con un solo frame. Se midieron sobre la
  imagen y coinciden con `Goblin_House` 128 × 192 y `Castle_Blue` 320 × 256, que ya están en el repo.
  **El implementador confirma ancho y alto en la cabecera PNG** (IHDR, bytes 16–23) al calcular el sha256 de
  procedencia. La base visible de las cuatro hojas ocupa los ~128 px inferiores.
- **Huella única 2 × 2** (120 × 120 px) para casa y torre. El solar tiene que tener huella antes de elegir, así
  que las dos han de ser iguales. Escala 0,9375 (60/64, la del castillo y las estructuras): 120 px de ancho,
  exacto en 2 celdas. Origen (0,5, 1) en el centro del borde inferior de la huella. La casa sobresale 1 celda por
  arriba y la torre 2. La parte de encima de la huella va a la capa alta, con el corte de `structureAspect`.
- **Acceso**: un punto fijo en x = centro de la huella e y = borde inferior + 1,5 celdas (90 px), en el centro
  de la fila r+3. Queda **fuera de la huella** y separado de ella por una fila libre (r+2). `BuildingRules`
  exige `access.radius + player.radius < 1,5 · cellSize` (40 + 16 < 90). Así el jugador nunca solapa la huella al
  abrirse el panel y, al construir, no hay que moverlo. También exige `rearmDistance > radius` (160 > 40, como
  `shop.json`).
- **Aspecto en obra común** (decisión del usuario tras el design): todo solar `free` se ve con la **misma** hoja,
  `House_Construction`. El pack no tiene una hoja de obra neutra de Knights, y `Castle_Construction` está vetada por
  la spec. `House_Construction` cabe entera en la huella 2 × 2 y no sugiere un tipo, porque el panel ofrece los dos.
  Al construir, el solar pasa a `House_Blue` o `Tower_Blue`. Hay reserva de color por aspecto (`siteColors`: obra,
  casa y torre, distintos). **Hojas versionadas: 3** (`House_Construction`, `House_Blue` y `Tower_Blue`), con su
  entrada en `asset-provenance.json`. `Tower_Construction` y las `*_Destroyed` no se versionan, porque los edificios
  son indestructibles.
- Huella de casa = huella de torre = huella del solar (2 × 2). La spec permite que sean distintas, pero aquí son
  iguales.

## 2. Piezas por capa
| Capa | Pieza | Nueva/Mod. | Notas |
|---|---|---|---|
| domain | `GameMap` | Mod. | Terreno `cells` inmutable (lo leen `typeAt`, `MapSnapshot` y `MAP_GOLDEN`). Copia viva `live` con `BUILT = 5`, código interno que no es `CellType` y no es caminable. `isWalkable`, `sweep`, `overlapsBlocked` y `nearestWalkable` leen `live`. `build(col,row,cols,rows): Result` (solo falla fuera de la rejilla; marca `BUILT` sea cual sea el terreno) y `revision` (+1 por obra). `isBuilt(c,r)` y `liveCodes` (vista de solo lectura para BFS). Deja de usar `Object.freeze(this)`: los campos siguen `readonly` |
| domain | `connectivity.codesOf` | Mod. | Copia `liveCodes`. Antes de construir es igual al terreno, así que la generación y las firmas no cambian. Permite el test de conectividad con todo construido |
| domain | `FlowField` | Mod. | Sin copia propia: lee `map.liveCodes`. Guarda `seenRevision`. Si `map.revision` cambia, `sync()` (al principio de `distanceAt` y `steer`) lo marca sucio y recalcula `blocked` (O(celdas), una vez por obra). Así el mapa `open` con una obra pasa a navegar por BFS. Desaparece el parámetro `cells` |
| domain | `GuardPost` | Mod. | Ya no hace `codesOf`: sus campos leen el mapa vivo y se invalidan solos. Gana `evict(map)` (§4) para los puntos que caigan en una obra, algo que solo ocurre en mapas declarados |
| domain | `CellType` | Mod. | Se añade `BUILT = 5` como constante interna. `isWalkableCode` no cambia (5 no es caminable) |
| domain | `BuildSite` (entidad) | Nueva | id, ancla (col, row), huella 2 × 2, centro, punto de acceso, `state: 'empty'|'house'|'tower'`, `builtAt` y su `ProximityGate` |
| domain | `ProximityGate` | Nueva (extraída) | La lógica de `CastleGate` sin cambios: armado, `step(x,y,canOpen)` con radio estricto y re-armado por distancia. `CastleGate` pasa a ser `ProximityGate` sobre la puerta del mapa. Si algún test de 0024 importa `CastleGate`, queda `class CastleGate extends ProximityGate` |
| domain | `Settlement` (servicio con estado, propiedad de `Run`) | Nueva | Los solares en orden de id, el paso 12 (`step`), `open` (solar abierto), `options(stock)`, `build(kind, tick, map)`, el ingreso de las casas (`income(n)`) y la `TowerBattery` |
| domain | `TowerBattery` | Nueva | Un `Weapon` por torre construida (preasignados hasta `sites.count`) con origen fijo en el centro de la huella, `selectTarget` del arma de la torre sobre `horde.alive` y su pool de `Projectile` con tope `tower.maxProjectiles`. Lleva su propia secuencia de ids y solo tier 0 (enemigos). Reutiliza `Projectile`, `selectTarget` y `firstOverlapping`, que se mueve de `Arsenal` a `weapon/hits.ts`. `Arsenal` no cambia |
| domain | `BuildingRules` / `BuildingKind` | Nueva | Se construyen desde `buildings.json`: costes, ingreso, arma de la torre (`WeaponType.create`), tope de proyectiles, acceso y colocación. Comprueba las restricciones cruzadas de §1 |
| domain | `placeSites` / `resolveSites` | Nueva | §3. Mapa generado ⇒ `siteRandom`. `open`/`cells` ⇒ `sites?: DeclaredSite[]` (`{col,row}`, celda de referencia = ancla). Solo se valida que la huella y el acceso caben en la rejilla y en el mundo (spec): sin reglas de terreno |
| domain | `Stockpile` | Mod. | `spendMaterials(wood, stone): boolean`, todo o nada. Es el único camino que baja la madera y la piedra |
| domain | `Enemy`, `PickupField`, `Flock` | Mod. | `Enemy.relocate(x,y)`, `PickupField.evict(map)` y `Flock.evict(map)` (§4) |
| domain | `RunPhase` / `RunStatus` | Mod. | `BUILDING = { status: 'building', outcome: null }` congela como `shopping`. Revisar los `switch` sobre el estado (`assertNever`) |
| domain | `TerrainSource` | Mod. | `generated.siteRandom` (obligatorio) y `sites?` en `open`/`cells` |
| domain | `MapSnapshot` | Mod. | `sites: MapSite[]` estático: id, col, row, cols, rows, x, y (centro) y `access {x,y}`. El estado va en `RunSnapshot`. `Run.map` sigue siendo la misma vista durante toda la partida |
| domain | `RunSnapshot` | Mod. | `sites: { id, state, armed }[]`, `build: { open: boolean, siteId: number \| null, options: { kind, wood, stone }[] }` (cacheado por clave como `shopView`) y `towerProjectiles` (separado de `projectiles`, que sigue ≤ 32) |
| domain | `Run` | Mod. | Crea `Settlement`. Paso 3, paso 7.4, paso 12 y `build`/`leaveSite` (§5). Error tipado `BuildError`: `not-building`, `unknown-kind` o `not-affordable` |
| application | `BuildOnSite`, `LeaveSite` | Nuevos | Copian `BuyFromShop`/`LeaveShop`: devuelven el snapshot o el error, sin azar |
| infrastructure | `content/buildings.schema` (zod) + parser | Nueva | `buildings.json` (§6). Reutiliza el esquema de arma de `weapons.json` |
| infrastructure | `random/deriveSeed` | Mod. | `SITE_STREAM = 7` |
| infrastructure | `map/planMapArt` | Mod. | `sites`: 3 aspectos por solar (obra, casa, torre), cada uno con su parte baja y alta (≤ 6 objetos), y `bounds` para `MapCuller` (0018). Al pintar se habilita la obra |
| infrastructure | `SiteArt` | Nueva | Como `StructureArt`, con 3 aspectos y `StructureMask`. En cada frame, el primer estado `house`/`tower` del snapshot cambia la máscara (O(k), sin asignar). Recuentos para la sonda |
| infrastructure | `ProjectileLayer` (2ª instancia) | Mod. | Pool de `tower.maxProjectiles` para `towerProjectiles`, con el aspecto de la flecha |
| infrastructure | `dom/BuildPanel` + `phaser/BuildGate` | Nuevos | Copian `ShopPanel`/`ShopGate`: Esc o Salir ⇒ `LeaveSite`, y Casa/Torre ⇒ `BuildOnSite`. Orden en `GameScene.update`: `ShopGate → BuildGate → PauseGate`. `playScreen` añade `'build'` |
| infrastructure | sonda E2E | Mod. | `__sprint.sites` (`total`, `empty`, `house`, `tower`, `armed`, `open`, `options`), `map.sites`, `sprites.sites` (`empty`, `house`, `tower`, `fallback`), `sprites.towerArrows` y `screens` con `build` |
| composition | `seedSource.seededRun` | Mod. | `siteRandom = Mulberry32(deriveSeed(seed, SITE_STREAM))`, solo en el modo `generated` |
| composition | `contentBoot` / `main` | Mod. | Cargan `buildings.json` y cablean `BuildOnSite`/`LeaveSite` y `BuildPanel` |

**Por qué la capa de obra vive en `GameMap`**: los ~8 lectores de paso ya reciben un `GameMap`. Una capa aparte
obligaría a pasar dos objetos a todos y abriría la puerta a olvidar uno. El terreno sigue siendo inmutable y la
única mutación es `build`, que solo llama `Run` (la raíz del agregado). No hay puerto nuevo: no hay dos
implementaciones previsibles.

## 3. Colocación (`placeSites`, `SITE_STREAM` 7)
Función pura de (mapa, estructuras, recursos, posiciones iniciales de las ovejas, reglas, `siteRandom`). Se
resuelve en `Run.start` **después** de estructuras, recursos y ovejas. Lee las huellas y puertas de las
estructuras, las vetas, los montones y las celdas iniciales de las ovejas, que quedan fuera de la zona, como exige
la spec.
1. Zona de un ancla (c, r): huella c..c+1 × r..r+1, más un anillo de 1 celda alrededor, más la fila de acceso
   r+3 en c..c+1. **Toda la zona dentro de la rejilla y `grass`** (sin tronco, agua, puente ni castillo).
2. Restricciones estáticas, todas con Chebyshev desde la huella:
   - a `water`/`bridge` ≥ `minWaterCells` (3);
   - al castillo ≥ `minCastleCells` (4);
   - a la zona de inicio ≥ `minStartCells` (6);
   - a la huella y la puerta de cada estructura goblin ≥ `minStructureCells` (4). El radio de patrulla es de 120 px
     (2 celdas), así que ninguna esquina de `GuardPost` cae en una obra.
   - Ninguna veta ni montón dentro de la zona.
3. Ruta: distancia BFS 4-vecina (`distancesFrom` sobre el terreno, desde la celda de `map.door`) desde la celda
   de acceso (r+3, c) en [`route.min`, `route.max`] = [18, 35]. Sin puerta (mapas declarados) no aplica.
4. Candidatas base en orden de filas por ancla. Por cada solar, de 0 a `count − 1`: se filtran las que están a
   Chebyshev ≥ `minGapCells` (6) entre huellas de las ya colocadas y se elige `⌊next · n⌋` (**1 valor por
   solar**). Sin candidatas, se deja de colocar (mejor esfuerzo). El test de las 50 semillas exige 6 y el
   implementador ajusta `minGapCells` si no salen.
5. **Conectividad garantizada por construcción**: cada huella está rodeada de un anillo `grass` que ninguna otra
   huella toca (separación ≥ 6 > 1). Todo camino que cruce una huella se desvía por su anillo. Lo confirma el
   test con las 50 semillas y los 6 solares construidos (`isFullyConnected` sobre `codesOf` vivo).
6. `SITE_GOLDEN` nueva (`tests/support/siteGolden.ts`): anclas por semilla en 1..50. Las otras cinco firmas no
   cambian porque ningún otro flujo se toca y el terreno no cambia.

## 4. Construir (`Run.build(kind)`, entre ticks, sin azar)
1. La fase debe ser `building` y `kind` estar entre las opciones asequibles. Si no, el error tipado no cambia
   nada.
2. `stock.spendMaterials(cost.wood, cost.stone)`.
3. `site.state = kind` y `builtAt = tickCount`. `map.build(huella)` sube la revisión.
4. **Desalojo**, en orden fijo: enemigos en orden de lista, recogibles en orden de creación y ovejas en orden de
   lista.
   - Enemigos y recogibles: todo el que tenga la celda de su centro construida va a `nearestWalkable(x, y)`.
   - Ovejas: toda la que cumpla `overlapsBlocked(x, y, r)` va a `nearestWalkable` de su centro, y su **punto de
     origen**, si cae en celda construida, también.
   - `GuardPost.evict(map)`: el puesto y los puntos de patrulla en celda construida pasan a `nearestWalkable`, y el
     campo de cada punto movido se reorienta a su celda nueva (spec "Punto de patrulla dentro de la huella"). En el
     mapa generado no pasa nunca, por `minStructureCells`, pero los mapas declarados sí pueden provocarlo.
   - Desempate de `nearestWalkable` (ya existe y es determinista): menor distancia euclídea al centro de la celda
     y, si empatan, la fila menor y luego la columna menor (recorrido en orden de filas con `<` estricto). Es
     O(celdas) por entidad y solo se ejecuta al construir.
   - El jugador no se mueve (§1). Dinamitas, avisos y explosiones siguen igual.
5. Si es torre, `TowerBattery.add(site)` activa un `Weapon` cargado desde su creación.
6. `phase = RUNNING`. El solar queda construido y ya no se vuelve a armar.

`leaveSite()` vuelve a `RUNNING` y la puerta del solar sigue desarmada hasta que el jugador esté a ≥ 160.

## 5. Tick (orden nuevo; con 0 obras es idéntico al de hoy)
```
1 jugador (colisión con la obra) → ovejas → 2 comportamientos (FlowField.sync por revisión)
3.1 arsenal.advance (proyectiles del jugador) → towers.advance (flechas, solo enemigos)
3.2 arsenal.fire (armas del jugador) → towers.fire (en orden de solares; reserva propia)
3.3 si bajas > 0: removeDead (orden de lista) → 3.4 estructuras → 3.5 ovejas
    (`Arsenal.step` se parte en `advance` + `fire` sin cambiar su comportamiento: sin torres, la llamada es
    idéntica a la de hoy)
4 peligros (los edificios no son objetivos: indestructibles) → 5 golpe → fin
7.1 recogibles → 7.2 vetas → 7.3 regeneración → 7.4 casas: cada casa con (n − builtAt) % everyTicks === 0
  y n > builtAt suma `gold` vía stock.add(gold, 0, goldBonusPercent), en orden de id
8 director (placeSpawn lee la obra) → 9 guardias → 9.2 ovejas → 10 oferta → 11 tienda
12 solares, en orden de id: re-armado y, si status === 'running', el primero armado, vacío, a d < radio y con
   alguna opción asequible abre `building` (uno por tick). Con la oferta o la tienda abierta en este tick, solo
   re-arma
```
**Todos los solares empiezan armados** (spec), a diferencia de la puerta del castillo. Un solar armado y sin nada
asequible no se abre y sigue armado (decisión del usuario). Si el jugador recoge madera dentro del radio, se
abre en ese tick. La spec fija la redacción de "no se arma": este diseño la implementa como "no se abre". Las
bajas de torre pasan por el mismo `removeDead`, así que dan XP, oro, madera, 1 valor de piedra y `kills`. Con el
bot v4 no hay torres ni casas, así que la secuencia de azar no cambia y `BALANCE_BASELINE` queda idéntico.

## 6. Contenido
`content/buildings.json`, nuevo. El número y el espaciado de solares van aquí, en `sites`, como `placement` de
`structures.json`, y no en `map.json`, que es solo terreno:
```json
{ "sites": { "count": 6, "footprint": { "cols": 2, "rows": 2 }, "minGapCells": 6, "minWaterCells": 3,
    "minCastleCells": 4, "minStartCells": 6, "minStructureCells": 4, "route": { "min": 18, "max": 35 } },
  "access": { "radius": 40, "rearmDistance": 160 },
  "house": { "cost": { "wood": 15, "stone": 0 }, "income": { "gold": 1, "everyTicks": 1800 } },
  "tower": { "cost": { "wood": 30, "stone": 15 }, "maxProjectiles": 16,
    "weapon": { "id": "tower-arrow", "cooldownTicks": 45, "damage": 4,
      "targeting": { "mode": "nearest-in-range", "range": 350 },
      "attack": { "type": "projectile", "speed": 480, "radius": 4, "lifetimeTicks": 60 } } } }
```
`maxProjectiles` 16 ≥ 6 torres × ⌈60/45⌉ = 12, así que con 6 torres no se pierde ningún disparo. Si falta
espacio en el pool, la torre conserva la carga, igual que `Arsenal`. El arma de la torre no está en
`upgrades.json` y no hereda mejoras. `appearance.json` añade `sites` (obra par/impar, casa y torre) y
`siteColors`.

## 7. Bot v5 y balance
- `tests/support`: `builderBot(config)` es v4 más esta política: si hay un solar vacío asequible, va a su punto
  de acceso por un `FlowField` (como a la puerta) y elige con `REFERENCE_BUILD_POLICY`: torre si es asequible y,
  si no, casa. El orden de solares es por distancia de ruta, con desempate por id. El bot v4 no cambia.
- Un lote aparte en `verify` (test "Balance con construcción", semillas 1..50): entre 25 y 35 victorias. El lote
  de quietos no se repite, porque el quieto no construye. Si se sale de la banda, se recalibra solo
  `tower.weapon` o `tower.cost`.
- Otros tests sin navegador: conectividad (50 semillas, todo construido), 6 solares a 18–35 de ruta, objetos del
  mapa ≤ 1.000 en 42 y 123, y bench (`Run.tick`, 300 enemigos, 6 obras y 6 torres).

## 8. Ajustes tras contrastar con las specs delta
- Bot v4: al abrirse una oferta de obra sale sin construir ("Política de obra fija"). El harness de los tests
  (`chooseWhileOpen` y su equivalente) trata `building` como la tienda. Abrir y salir no consumen azar ni ticks, así
  que `BALANCE_BASELINE` queda idéntico.
- E2E: **1 nuevo**, el de la spec, "Construir una casa en el juego real", en `?e2e&manual&seed=42` con
  `map: 'real'`. La ruta la calcula el test con BFS sobre `map.cells`: montones de madera hasta ≥ 15 y después el
  acceso del solar más cercano. "Sonda de solares en el menú" amplía el test de humo del menú (no es un E2E nuevo).
  El resto de escenarios del panel se cubren con tests de DOM de `BuildPanel`/`BuildGate`, como `ShopPanel`.

## 9. Ajustes del apply (registrados tras verify, W2/W3/S2)
- API de dominio nueva en `GameMap`: `isBuiltAt(cell)` y `nearestWalkableCenter(point)`. La oveja desalojada de
  una huella va al centro de la celda caminable más cercana (mismo desempate que `nearestWalkable`) y la
  reaparición de ovejas descarta las celdas que solapan una obra.
- `snapshot.sites` lleva, además de id, estado y armado, el acceso y las huellas de casa y torre (lo pide la spec).
- `Run.build` lanza un error de invariante si el jugador solapa la huella. Es defensivo: `BuildingRules` lo impide
  (radio de oferta + radio del jugador < distancia del acceso a la huella).
- `RunSetup.sites` permite que un escenario empiece con solares ya construidos en el tick 0 (bench y tests). Por
  eso "Semillas del conjunto con edificios" se prueba con las obras en el tick 0 y no en el 1.800 de la spec: el
  invariante comprobado (conectividad y nada en la huella) no depende del tick de la obra.
- La regla de contenido "radio de oferta + radio del jugador < 1,5 celdas" obliga a que el fixture de
  "Celda en el límite del radio del jugador" (`cellSize` 32, radio del jugador 16) use un radio de oferta 30. El
  escenario no fija ese dato; el valor de `content/` no cambia.
- "Reserva de las torres llena", "El jugador conserva su tope", "Con el tope del jugador lleno…" y
  "Recogible creado sobre el edificio" se prueban sobre `TowerBattery` + `Arsenal` y `PickupField`, no sobre `Run`,
  porque en una partida no se puede montar el estado de partida exacto.

## Dependencias nuevas
| Paquete | Versión exacta | Motivo | Alternativa descartada |
|---|---|---|---|
| — | — | Ninguna | — |

## Rendimiento y seguridad
- Presupuesto: < 0,5 ms por tick añadidos.
  - BFS de 64 × 36 ≈ 15 µs. Una obra invalida el campo de la partida y los ≤ 20 campos de guardia, que se
    recalculan de forma perezosa: ≈ 0,3 ms una sola vez, ≤ 6 veces por partida.
  - Torres: 6 × `selectTarget` sobre ≤ 300 enemigos, solo con carga, más ≤ 16 proyectiles × 300 solapes:
    ≈ 0,05 ms.
  - `isWalkable` lee un solo array, así que el camino caliente no cambia.
  - Desalojo O(entidades × celdas), solo al construir.
  - Lo mide el bench.
- Objetos del mapa: +≤ 36 (6 × 6), es decir ~737/820 en 42 y 123, frente al tope de 1.000. Pasan por el
  recorte de 0018.
- Datos persistidos: ninguno. Los edificios no se guardan ni salen en resultados. Entrada externa nueva: solo
  `buildings.json`, validado con zod y con `BuildingRules` antes del dominio.

## ADRs
- `docs/adr/0025-capa-de-obra-mutable-y-solares.md`: terreno inmutable con capa de obra y revisión en `GameMap`,
  invalidación de `FlowField` y `GuardPost` por revisión (enmienda "el mapa no cambia" de ADR-0013, ADR-0017 y
  ADR-0020), `building` como segunda fase modal (extiende ADR-0023), `SITE_STREAM` 7 y torres con reserva propia.
