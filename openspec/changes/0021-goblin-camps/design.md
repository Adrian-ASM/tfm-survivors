# Design · 0021-goblin-camps

## Resumen
Las casas y torres goblin son **entidades del núcleo** (`Structure`), no celdas. La rejilla, `FlowField`, la
conectividad y la firma de celdas no cambian (D1-A). Se colocan después de generar el mapa con un flujo de azar
propio, `STRUCT_STREAM` (D2). Cada casa tiene un `GuardPost`: el puesto (su puerta), los 4 puntos de patrulla y un
campo de distancias por punto, calculado una vez porque el mapa no cambia. Del puesto nace el tipo nuevo
`goblin-tnt-guard` (D3), con tres clases nuevas en la unión cerrada de ADR-0019: `patrol`, `alert` y `return`. Las
armas solo apuntan a una estructura si su criterio no encuentra ningún enemigo (D5). Las ruinas se quedan hasta el
final de la partida. El arte va en el plan del mapa con un aspecto intacto y otro de ruina, y `MapCuller` aprende una
máscara de "habilitado" para mostrar solo el aspecto vigente.

Decisiones del gate que se aplican tal cual: A1 (TNT a 100, curva 9/4), A2 (W3 condicional), A3 (barril con salida
60, vida 25 y radio 80 como punto de partida) y D1–D9 con la opción recomendada.

## 0. Contraste con las specs delta (escritas después de la primera versión de este design)
Se han comparado las 11 specs delta del change. Donde no coincidían, **manda la spec** y el design se ha corregido:

| Tema | Primera versión del design | Spec | Resolución |
|---|---|---|---|
| Orden director/guardias | Director → guardias | Igual (`simulation-loop` pasos 8–9) | Confirmado. |
| Puerta | (centro x de la huella, fila frontal) | Centro de la celda (c0 + ⌊cols/2⌋, r0 + rows) | **Alineado con la spec**: el puesto es el centro de esa celda (p. ej. (1.290, 810)). |
| Fila frontal | Hierba en la casa y en la torre | Solo la celda de la puerta de la casa, que no puede estar en ninguna huella; la torre no tiene puerta | **Alineado con la spec**. |
| Patrulla | 4 esquinas filtradas por línea libre | 4 esquinas en orden fijo y en bucle, recolocadas a una celda caminable, con "Navegación hacia un punto fijo" (línea libre o campo del punto) | **Alineado con la spec**: es más simple y mantiene el invariante de celda caminable con el campo de cada punto. |
| Transiciones de guardia | Detección y pérdida antes de moverse | Todas después de moverse (`enemy-behavior`, escenarios de límite) | **Alineado con la spec**. |
| Primer nacimiento | Tick 1 | Cuando han pasado ≥ el intervalo desde el tick 0 (tope 2 e intervalo 120 → ticks 120 y 240) | **Alineado con la spec**. |
| Flechas contra enemigos | Atraviesan las estructuras | Igual | Confirmado. |
| Pulso con solo una estructura | Se dispara | Igual | Confirmado. |
| Detección ≤ 360 y < abandono | Histéresis por destino | Abandono > **todos** los radios de detección del tipo y detección ≤ 360 | **Alineado con la spec** (regla por tipo, más simple). Valores 240 y 360. |
| Estructuras como objetos del mapa | En el plan y recortadas | Igual | Confirmado. Cambia el mecanismo de la ruina (§8). |
| Huella en el snapshot | Solo en `MapSnapshot` | También en `RunSnapshot` | **Alineado con la spec**. |
| Distancia a la zona de inicio | Desde la celda de la salida (medición 5) | Hasta las celdas de la zona de inicio | **Alineado con la spec**: `minStartCells` pasa a 6, que equivale a los 9 de la medición menos el radio de la zona en celdas (3). Lo comprueba el test 1..1000. |
| Huella por defecto | 2 × 2 más un tejado fuera de la huella | Los escenarios usan casas de 2 × 3; parte baja = fila inferior | **2 × 3 en los dos tipos**: el sprite escalado (120 × 180) coincide con la huella. |
| Estructuras declaradas | Huella caminable | Solo caben en la rejilla (y la puerta, si es casa); sin reglas de colocación | **Alineado con la spec**. Se declaran tipo y huella completa. |
| Puesto en `RunSetup` | `guardOf` (índice de casa) | "Puesto (1.000, 1.000) salvo que se diga otra cosa", sin casa | **Alineado con la spec**: `post` (un punto) o `house` (índice). |
| Validación de guardia | Exactamente 1 estado `patrol`; tipos con `patrol`/`return` fuera de las oleadas | Inicial de clase patrulla si hay estados de guardia; fuera de las oleadas todo tipo cuyo inicial es patrulla | **Alineado con la spec**. Se quita la regla de "exactamente 1". |
| Bench | ≤ 0,25 ms informativo | ≤ 2 ms en el bench (sin bloquear), anotado frente a 0,25 | Compatibles. Se mantienen las dos cifras. |

No he tenido que cambiar ninguna spec, y nada de lo anterior cambia el alcance aprobado.

**Criterios de éxito de `proposal.md` frente a las specs**: no hay contradicciones. Coinciden la banda 25–35, los 0
quietos con los dos mapas, las mechas > 16,3, el lote ≤ 90 s equivalentes, la firma de celdas intacta, los plazos del
quieto, las 4 hojas, el máximo de 2 E2E (la spec añade 1 nuevo: "Estructuras y guardias en el navegador") y los
≤ 1.000 objetos. Hay tres matices:
1. La propuesta pone el bench solo en "≤ 0,25 informativo". La spec añade el umbral de 2 ms del bench, que es
   informativo y no bloquea.
2. La spec de `run-outcome` amplía las palancas a los parámetros de estructuras y guardias y a la mecha y el daño del
   barril. Son las palancas de 0020 más las de las estructuras: no contradicen A3 ni el veto a oleadas, stats y curva.
3. El snapshot incluye la huella, que la propuesta no listaba. Es un añadido, no un cambio.

## 1. Piezas por capa

| Capa | Pieza | Nueva/Mod. | Notas |
|---|---|---|---|
| domain | `structure/StructureType` (VO) | Nueva | id, `footprint {cols, rows}`, `radius`, `health`, `count`, `guards?` `{type, max, everyTicks}`. Invariantes con `Result`. |
| domain | `structure/StructureRules` (VO) | Nueva | `house` y `tower` y `placement` (`minStartCells`, `minCastleCells`, `minWaterCells`, `minGapCells`, `maxAttempts`). Referencias cruzadas con el catálogo (§2.4). |
| domain | `structure/StructureSite` (VO) | Nueva | Sitio estático: id, tipo, `col,row,cols,rows`, centro (x, y), `radius` y `door` (null en la torre). Geometría pura. |
| domain | `structure/placeStructures` | Nueva | Generador puro `(map, rules, random) → StructureSite[]` (§3.2). |
| domain | `structure/resolveStructures` | Nueva | Sitios de la partida según `TerrainSource`: generados, declarados (`open`/`cells`) o ninguno (§3.3). |
| domain | `structure/Structure` (entidad) | Nueva | Vida y `lastHitTick` escalares y mutables (ADR-0003). Cumple `WeaponTarget`. Las casas tienen su `GuardPost`, `nextSpawnAt` y `lastSpawnAt`. |
| domain | `structure/StructureField` (servicio con estado, de `Run`) | Nueva | Lista estable de estructuras (las ruinas no se retiran), `spawnGuards` y la vista `targets` para las armas. |
| domain | `enemy/GuardPost` | Nueva | Puesto (x, y), puntos de patrulla por estado `patrol` (`Float64Array`), una `FlowField` por punto distinto (puesto y esquinas) y contador de guardias vivos. Está en `enemy/` para que `Enemy` no dependa de `structure/`. |
| domain | `enemy/behavior/BehaviorConfig`, `Behavior` | Mod. | Clases `patrol`, `alert` y `return` (§4.1). Arrays nuevos: `patrolRadius`, `detectDistSq`, `detectTo`, `loseDistSq`, `loseTo` y `arriveTo`. Validación por tipo (§2.4). |
| domain | `enemy/Enemy` | Mod. | `post: GuardPost \| null` (readonly) y `waypoint` (escalar). `Enemy.spawn(..., post?)`. |
| domain | `enemy/Horde` | Mod. | `act` con las ramas de las clases nuevas (§4.1) y `spawn(type, x, y, n, post?)`. La liberación del puesto se hace en `onDeath`. |
| domain | `map/FlowField` | Mod. (mínima) | Sin cambios de comportamiento. Constructor opcional que comparte la copia de códigos (`codesOf`) entre los campos de los puestos. |
| domain | `map/TerrainSource` | Mod. | `generated` pide `structureRandom`. `open` y `cells` aceptan `structures?: { type, col, row, cols, rows }[]`. |
| domain | `map/MapSnapshot` | Mod. | `structures: readonly { id, type, col, row, cols, rows, x, y, radius, door }[]` (estático). |
| domain | `weapon/Arsenal`, `Projectile` | Mod. | `step(n, px, py, enemies, structures = [])` y `Projectile.atStructure` (§5). |
| domain | `wave/WaveTable` | Mod. | Rechaza los tipos cuyo estado inicial es de clase patrulla. |
| domain | `run/Run`, `RunConfig`, `RunSetup`, `RunSnapshot`, `snapshotParts` | Mod. | Orden del tick (§6), `RunConfig.structures`, `setup.enemies[i].post` o `.house`, `setup.structures[i].health` (opcional, para tests) y `RunSnapshot.structures`. |
| application | — | Sin cambios | `StartRun`/`TickRun` reciben el `TerrainSource` igual que hoy. |
| infrastructure | `random/deriveSeed` | Mod. | `STRUCT_STREAM = 3` (constante nueva; `deriveSeed` no cambia). |
| infrastructure | `content/schemas`, `loadRunConfig` | Mod. | `StructuresSchema` (`content/structures.json`, nuevo) con objetos estrictos por id, y las clases nuevas en el `discriminatedUnion`. `RawContentFiles.structures`. Los errores nombran el tipo de estructura. |
| infrastructure | `content/appearanceSchema`, `loadAppearance`, `art/looks`, `map/mapLooks` | Mod. | `structures.<tipo>.{intact, ruin}` (aspectos de entidad con `idle`), colores `goblin-house`/`goblin-tower`/`ruin` distintos entre sí y de los del mapa, y aspecto `goblin-tnt-guard` (`TNT_Red`, con `throw`). |
| infrastructure | `phaser/map/planMapArt` | Mod. | Por estructura y aspecto (intacto y ruina): parte baja (capa baja) y alta (capa alta), o un rectángulo de reserva. Más `structures: { id, intact: number[], ruin: number[] }` con los índices de sus objetos. |
| infrastructure | `phaser/map/mapCulling` (`MapCuller`) | Mod. | Máscara `enabled` por índice (`setEnabled(i, on)`). Visible = habilitado y dentro del recorte. `drawn` cuenta lo visible. Sigue siendo puro. |
| infrastructure | `phaser/StructureArt` | Nueva | Sin motor. Por frame, si `snapshot.structures[i].destroyed` pasa a true, deshabilita los índices intactos y habilita los de ruina (O(k), sin asignar). |
| infrastructure | `phaser/EnemyLayer`, `renderCounts`, `e2e` | Mod. | `StateCounts` con `patrol`/`alert`/`return` (andar o quieto). Sonda `sprites.structures` y `map.structures`. |
| composition | `seedSource.seededRun` | Mod. | `structureRandom = Mulberry32(deriveSeed(seed, STRUCT_STREAM))`. |
| content | `structures.json` (nuevo), `enemies.json`, `appearance.json`, `asset-provenance.json` | Nueva/Mod. | §2 y §8. |
| tests/support | `mapGolden.ts`, `map-golden.test.ts`, `builders.ts`, `balanceMeasure.ts`, bench | Mod. | `STRUCTURE_GOLDEN` nueva (§10) y medición de mechas (§11). El bot (`policies.ts`) solo cambia si entra W3. |

**Por qué en el dominio**: la vida de las estructuras, el nacimiento de los guardias y sus estados cambian la
partida, así que forman parte del contrato de determinismo y del balance que mide el bot sin motor. La escena solo
pinta. **Sin puertos nuevos**: no hay dos implementaciones previsibles. La colocación es un valor (`TerrainSource`),
como el mapa (ADR-0013).

## 2. Contenido

### 2.1 `content/structures.json` (nuevo; valores de partida, se pueden ajustar en apply)
```json
{
  "placement": { "minStartCells": 6, "minCastleCells": 6, "minWaterCells": 2, "minGapCells": 4,
                 "maxAttempts": 2000 },
  "types": {
    "goblin-house": { "count": 4, "footprint": { "cols": 2, "rows": 3 }, "radius": 48, "health": 60,
                      "guards": { "type": "goblin-tnt-guard", "max": 2, "everyTicks": 900 } },
    "goblin-tower": { "count": 3, "footprint": { "cols": 2, "rows": 3 }, "radius": 48, "health": 90 }
  }
}
```
- `types` es un objeto **estricto por id**: exactamente `goblin-house` y `goblin-tower`, y un campo `guards` en la
  torre es un campo desconocido. Así el error nombra `goblin-tower`, y la orden de colocación es la del objeto (casas
  y luego torres).
- Las distancias son de Chebyshev en celdas, como define `goblin-structures`. La posición de una estructura es el
  centro del rectángulo de su huella. La puerta es el centro de la celda (c0 + ⌊cols/2⌋, r0 + rows).

### 2.2 `goblin-tnt-guard` en `content/enemies.json`
Tiene los stats de `goblin-tnt` y este comportamiento:
```json
"behavior": { "initial": "patrol", "states": [
  { "name": "patrol", "kind": "patrol", "radius": 120, "detect": { "distance": 240, "to": "alert" } },
  { "name": "alert", "kind": "alert", "exit": { "distance": 100, "to": "aim" },
    "lose": { "distance": 360, "to": "return" } },
  { "name": "aim", "kind": "charge", "ticks": 30, "to": "reload",
    "dynamite": { "flightTicks": 45, "radius": 56, "damage": 15 } },
  { "name": "reload", "kind": "wait", "ticks": 90, "to": "alert" },
  { "name": "return", "kind": "return", "detect": { "distance": 240, "to": "alert" }, "to": "patrol" }
]}
```
Cotas que cumple: lanzamiento 100 > 22 + 16 y ≤ 360; vuelo 45 ≥ ⌈(56 + 16) / 3,583⌉ = 21; detección 240 ≤ 360 y
< abandono 360. Lanza a 100 px, por debajo de `FLEE_ENEMY_RANGE` 150, así que el caso W3 no se da por diseño.

### 2.3 Barril (A3)
`exit.distance` 60, `health` 25 y `fuse.radius` 80. Se pueden recalibrar en apply (§11). Si cambian, hay que
actualizar antes de verify los escenarios que los citan ("Parámetros del barril por defecto", "Stats por defecto" y
"Vida por defecto de cada tipo").

### 2.4 Invariantes en el dominio (zod solo comprueba la forma)
- **Estructuras**: `count` y las distancias de colocación son enteros ≥ 0. `maxAttempts`, `max`, `everyTicks` y
  `footprint` son enteros ≥ 1, y la huella cabe en la rejilla. `radius` y `health` son > 0. `guards.type` existe en el
  catálogo y su estado inicial es de clase `patrol`.
- **Comportamiento**: valores > 0 y destinos existentes. Un tipo con algún estado `patrol`, `alert` o `return` debe
  empezar en un `patrol`. En un tipo, cada `lose.distance` es mayor que todos sus `detect.distance`.
- **Oleadas**: un tipo cuyo inicial es `patrol` no puede figurar en ningún tramo.
- **`RunSetup`**: un enemigo cuyo inicial es `patrol` necesita `post` o `house`, y cualquier otro los tiene
  prohibidos. `house` tiene que apuntar a una casa de la partida, y el guardia cuenta en su tope.

## 3. Colocación (D2) y determinismo del mapa

### 3.1 Flujos
```
seededRun(seed): random          = Mulberry32(seed)                           // oleadas y ofertas
                 mapRandom       = Mulberry32(deriveSeed(seed, MAP_STREAM))    // 1, sin cambios
                 structureRandom = Mulberry32(deriveSeed(seed, STRUCT_STREAM)) // 3, nuevo
decorSeedOf(seed) = deriveSeed(seed, DECOR_STREAM)                            // 2, solo render
```
`generateMap` no cambia, así que **la firma de celdas no cambia**. `placeStructures` se ejecuta con el `GameMap` ya
hecho y solo lee de él.

### 3.2 Algoritmo de `placeStructures(map, rules, random)`
1. **Precálculo** (O(celdas), una vez): tres rejillas con la distancia de Chebyshev de cada celda a la zona de inicio
   (`inStartZone`), a la huella del castillo y a las celdas `water`/`bridge`. Más una rejilla de ocupación, donde cada
   estructura colocada marca su huella ampliada en `minGapCells` y su puerta.
2. Recorre los tipos en orden (casa, torre) y, para cada uno, hasta `count` estructuras. Cada estructura tiene hasta
   `maxAttempts` intentos:
   - `col = pickInt(0, cols − fcols)` y luego `row = pickInt(0, rows − frows − (casa ? 1 : 0))`: 2 valores, en ese
     orden.
   - Acepta si toda celda de la huella (y la puerta, si es casa) es `grass`, cumple las tres distancias y no está
     ocupada, y si la puerta no cae en ninguna huella ya colocada.
   - Al aceptar, el id es el índice global en orden de colocación.
3. Si se agotan los intentos de una estructura, **ese tipo deja de colocarse** y se pasa al siguiente (mejor
   esfuerzo, sin error: "Contenido sin hueco suficiente").

Cada intento cuesta O(huella) gracias a las rejillas, y 500 casas siguen siendo baratas. El contrato de determinismo
lo forman el orden de consumo, el orden de los tipos y el criterio de aceptación.

### 3.3 Mapas vacíos y explícitos
`open` y `cells` no tienen estructuras salvo que declaren `structures: [{ type, col, row, cols, rows }]`. Solo se
exige que quepan en la rejilla y que la puerta de una casa quepa también; si no, el error menciona
`map.structures.i`. La vida y el radio salen del tipo de contenido. El E2E por defecto (`map=empty`) no tiene
estructuras.

## 4. Guardias

### 4.1 Clases nuevas y paso de comportamiento (amplían ADR-0019)
En `Horde.act`, enemigo a enemigo y en orden de lista:
1. Si termina una `wait`, pasa a su destino.
2. Se mueve según la clase:
   - `chase` y `alert`: `field.steer` hacia el jugador.
   - `patrol`: hacia `post.point(state, waypoint)`.
   - `return`: hacia `post`.
   - El resto no se mueve.
   La navegación hacia un punto fijo Q es `post.fieldFor(Q).steer(ex, ey, Qx, Qy, out)` seguido de `Enemy.chase`.
   Es la regla de la persecución con el campo de la celda de Q, línea libre y reserva en línea recta, y `chase` no se
   pasa del objetivo.
3. Transiciones **después de moverse**, con la distancia al jugador ya movido (comparadas al cuadrado):
   - `chase`: `exit`.
   - `alert`: `exit` y, si no, `lose`.
   - `patrol`: `detect` y, si no, si ha llegado exactamente al punto, `waypoint = (i + 1) mod 4`.
   - `return`: `detect` y, si no, si ha llegado exactamente al puesto, pasa a `arriveTo` con `waypoint = 0`.

Al entrar en `patrol` siempre se va al primer punto. Nada consume azar ni asigna memoria.

- **Puntos de patrulla** (`GuardPost`, al crear el puesto): las esquinas (x − r, y − r), (x + r, y − r),
  (x + r, y + r) y (x − r, y + r), en ese orden. Cada una se recorta a la arena con el radio del tipo y, si su celda no
  es caminable, se lleva a `GameMap.nearestWalkable`. Se calculan para cada estado `patrol` del tipo.
- **Campos**: una `FlowField` por punto distinto (puesto y 4 esquinas), orientada una sola vez (`retarget`) a la celda
  del punto. La BFS se hace en la primera consulta y no se repite. Comparten la copia de códigos. Tanto la navegación
  como el invariante "centro en celda caminable" son los de ADR-0017.
- La alerta reutiliza `charge`/`wait`/`HazardField.launch` de 0020 sin cambios.

### 4.2 Nacimiento (D3)
`StructureField.spawnGuards(n, horde, maxAlive)` recorre las casas en orden de lista. Una casa hace nacer **una**
guardia en su puerta si se cumplen todas estas condiciones: no está destruida, `post.alive < max`,
`n − lastSpawnAt ≥ everyTicks` (con `lastSpawnAt` = 0 al empezar) y `horde.alive.length < maxAlive`. La guardia nace
con `waypoint` 0 y `post` asignado, y `lastSpawnAt = n`. Si no se cumple, se vuelve a comprobar en el tick siguiente.
`dropGem` llama a `post.release()`. Las guardias que siguen vivas tras destruirse su casa conservan su puesto.

## 5. Armas sobre estructuras (D5)
- **Selección**: `selectTarget(criterio, enemigos)`. Si da −1, `selectTarget(criterio, estructuras)`, que solo
  considera las no destruidas (`alive` false en las ruinas). Ni se concatena ni se asigna.
- **Proyectil**: guarda `atStructure`. Primero daña al primer enemigo vivo que solapa. Solo si no hay ninguno y
  `atStructure` es true, daña a la primera estructura no destruida que solapa.
- **Pulso**: se dispara si hay un enemigo o, si no, una estructura en el criterio. Daña a todos los enemigos y a
  todas las estructuras no destruidas que solapa.
- `step` solo devuelve bajas de enemigos. Destruir una estructura no da gema ni baja. `HazardField` y el contacto no
  cambian.

## 6. Orden del tick
Es el de `simulation-loop` delta, pasos 1–10:
1. Jugador.
2. Comportamiento (§4.1).
3. Armas: proyectiles (contra enemigos y, los dirigidos a estructuras, contra estructuras) → disparos (enemigos
   primero) → bajas de enemigos → estructuras destruidas.
4. Peligros, sin cambios.
5. Golpe al jugador.
6. Victoria.
7. Gemas.
8. Director.
9. Nacimiento de guardias.
10. Oferta.

Lo único que consume azar en el tick sigue siendo cada intento de aparición del director y la oferta. Una casa
destruida en el paso 3 no hace nacer en el paso 9.

## 7. Snapshot y sonda E2E
- `RunSnapshot.structures` (por frame, congelado): `{ id, type, x, y, radius, col, row, cols, rows, health,
  destroyed }`. Las ruinas van con `health` 0. Opcionalmente `damaged`, para el destello.
- `MapSnapshot.structures` (estático): tipo, huella y `door` (null en la torre). Es lo que la sonda
  `__sprint.map.structures` expone.
- `EnemySnapshot.stateKind` admite `patrol | alert | return`.
- Sonda de render: `sprites.structures = { [tipo]: { intact, ruin, fallback } }` (del plan y del estado, sin
  depender de la cámara), `enemyStates` con las tres claves nuevas, y `mapArt.objects`/`drawn` con las estructuras.
  En el menú, todo a 0.
- **E2E nuevo (1)**: "Estructuras y guardias en el navegador", en modo manual con `step(n)`, mapa real y semilla 42.
  Se amplían las cifras de los E2E existentes que citan objetos del mapa.

## 8. Arte, culling y presupuesto
- **Ficheros** (4, del pack local Update 010, con `Wood_Tower_Red` porque los goblins son rojos), en
  `public/assets/tiny-swords/Factions/Goblins/Buildings/Wood_House/{Goblin_House,Goblin_House_Destroyed}.png` y
  `.../Wood_Tower/{Wood_Tower_Red,Wood_Tower_Destroyed}.png`. Cada uno con su entrada `path/source/version/sha256/bytes`
  medida al copiar. Siguen prohibidos `Fire`, `W_Idle`, `Wood_Tower_InConstruction` y los otros colores. El test de
  `appearance-hazards.test.ts` (l. ~208) se reduce a esa lista.
- **Plan**: para cada estructura, cada aspecto (intacto y ruina) aporta una parte baja (por debajo del borde superior
  de la fila inferior de la huella) y una parte alta (el resto), ancladas en el punto medio del borde inferior de la
  huella. Si un aspecto no tiene hoja, aporta un rectángulo de reserva sobre la huella, sin parte alta, con el color de
  su tipo o el de ruina. Las piezas van tras la fachada del castillo (capa baja) y tras el tejado (capa alta). La torre
  usa el frame 0 de `idle`; animar la bandera queda fuera del change.
- **Ruina con máscara** (sustituye el cambio de textura de la primera versión): las piezas de los dos aspectos se
  crean al pintar el plan, pero solo el aspecto vigente está habilitado. `MapCuller.setEnabled` las combina con el
  recorte. Así se cubren las reservas mixtas que exige "Reserva de las estructuras" (casa en rectángulo y torre en
  hoja, o al revés) sin cambiar de clase de objeto. No se crean objetos del motor por frame. Solo se llama a
  `setVisible` (ya en uso desde 0018) donde cambia el estado.
- **Presupuesto**: hasta 4 objetos por estructura (2 aspectos × 2 piezas). Con 7 estructuras son ≤ 28: unos 695 y 778
  en las semillas 42 y 123, por debajo de 1.000. Lo comprueba `plan-map-fallback.test.ts` sin navegador. `objects`
  cuenta todos los objetos de escena, también los del aspecto deshabilitado. `drawn` solo cuenta los visibles.
- **API de Phaser**: consultada con el MCP `phaser-docs`, página
  `/api-documentation/class/gameobjects-sprite.md#inherited-methods` (`Visible.setVisible` y `TextureCrop.setCrop`,
  los mismos que ya usa el mapa). La doc publicada puede ir por detrás de la 4.2.1, así que se han comprobado los
  fuentes de `node_modules/phaser`. No se introduce ninguna API nueva.

## 9. Dependencias nuevas
Ninguna.

## 10. Firmas doradas y cifras que cambian
| Firma | ¿Cambia? | Motivo |
|---|---|---|
| `MAP_GOLDEN` (celdas, 42 y 123) | **No** | D1-A con D2. Lo comprueba "Mapa intacto". |
| `STRUCTURE_GOLDEN` (nueva, 42 y 123) | Nueva | `tipo@col,row,cols,rows` en orden de id, en `tests/support/mapGolden.ts`. |
| `deriveSeed`, `MAP_STREAM`, `DECOR_STREAM`, `treeChoices` | No | Solo se añade `STRUCT_STREAM` 3. |
| Objetos del mapa 667/750 y `drawn` (42/123) | Sí | Por las piezas de las estructuras. Se regeneran y se anotan. |
| Balance 27/50, primera oferta s7 2.082, plazos del quieto | Sí | Por el barril, los guardias y los ids. Se miden de nuevo (§11). |
| "Mismos spawns con y sin mapa" | Sí | Compara solo las apariciones del director (tipo y tick), como fija la spec. |

## 11. Plan de balance en apply (por pasos, para aislar causas)
Cada paso se mide con `measureBalance` (bot v3, 1..50): victorias, quietos con el mapa generado y con el vacío, mechas
y explosiones de barril por partida, primera oferta de s7, plazos del quieto y tiempo del lote en local (umbral
**≤ 32 s**, unos 90 s en CI). Los pasos 2 y 3 son configuraciones de test.
1. **Barril (A3)**: se espera 29/50, 0/0 y unas 29,0 mechas (medición 7c). Si no se reproduce, se para.
2. **Estructuras sin guardias** (`guards.max` 1 con `everyTicks` mayor que la partida, así que no nace ninguno):
   efecto de la puntería sobre estructuras. Se espera ±1 victoria. Si cae más de 2, se revisa §5 antes de seguir.
3. **Guardias** (contenido final): con la banda 25–35 y 0 quietos, el bot se queda en v3.
4. **Si el paso 3 queda fuera de la banda**, se mide el daño de dinamita de guardia que el bot recibe en ticks en que
   v3 devuelve `NONE` con ≥ 1 aviso amenazante.
   - **W3 (bot v4 "flee-nearest")** entra solo si las victorias son < 25 **y** ese daño es > 0 en semillas que el
     paso 2 ganaba. Antes de verify hay que escribir entonces el MODIFIED de "Bot de referencia para el balance"
     (spec-writer).
   - Si no es W3, se ajusta por este orden: `max`/`everyTicks` de los guardias, `detect`/`lose`, el barril dentro de
     A3 y de las cotas, y `count`/`health` de las estructuras. Todo lo demás está vetado: si hiciera falta, se vuelve
     al gate.
5. Las cifras finales van al addendum de ADR-0020 y al verify-report. Los valores que cite una spec delta se
   actualizan antes de verify.

## 12. Rendimiento y seguridad
- **Coste por tick**: reserva de objetivos O(S) (S ≤ 7) solo sin enemigos en el criterio; colisión de proyectiles
  marcados O(S); nacimiento O(casas); como mucho 8 guardias con `steer` acotado; BFS de cada punto una sola vez.
  Estimación: < 0,01 ms/tick añadido. Sin asignaciones en el tick, salvo la `Enemy` de cada nacimiento (igual que
  cualquier aparición).
- **Memoria**: unos 18 KB por punto con campo (`dist` y `queue` de 2.304 celdas). Hasta 5 por casa, unos 360 KB con
  4 casas, creados al empezar.
- **Bench**: caso "peor caso con estructuras y guardias" (mapa de la semilla 42, 300 vivos, cada casa en su tope,
  mitad en patrulla y mitad en alerta, con `RunSetup.enemies[i].house`). ≤ 2 ms en el bench, anotado frente a 0,25.
- **Lote**: `BOT_BATCH_TIMEOUT_MS` se queda en 180 s (D9).
- **Seguridad y datos**: solo contenido versionado, validado con zod y con el dominio. Sin entradas externas nuevas.
  El formato del progreso no cambia. Los PNG nuevos tienen sha256 y los vigila el guardarraíl de assets.

## ADRs
- `docs/adr/0020-estructuras-goblin-como-entidades-y-puestos-de-guardia.md`. Amplía ADR-0019 (clases nuevas y orden
  del tick) y ADR-0013 (tercer flujo).
