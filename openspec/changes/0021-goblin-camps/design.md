# Design · 0021-goblin-camps

## Resumen
Las casas y torres goblin son **entidades del núcleo** (`Structure`), no celdas. La rejilla, `FlowField`, la
conectividad y la firma de celdas no cambian (D1-A). Se colocan después de generar el mapa con un flujo de azar
propio, `STRUCT_STREAM` (D2). Cada casa tiene un `GuardPost` (puesto, ruta de patrulla fija y campo de distancias
hacia el puesto, calculado una vez) del que nace el tipo nuevo `goblin-tnt-guard` (D3). Ese tipo usa tres clases
nuevas de la unión cerrada de ADR-0019: `patrol`, `alert` y `return`. Las armas eligen estructura solo si no hay
ningún enemigo en su criterio (D5). Las ruinas se quedan hasta el final. El arte va en el plan del mapa, y al
destruirse una estructura su textura se cambia por la de la ruina (los frames miden lo mismo), así que el recorte
de 0018 sirve sin tocarlo.

Decisiones del gate que se aplican tal cual: A1 (TNT 100, curva 9/4), A2 (W3 condicional), A3 (barril con salida 60,
vida 25 y radio 80 como punto de partida) y D1–D9 con la opción recomendada (sin campamentos, sin recompensa, la torre
no ataca y las explosiones no dañan estructuras).

## 1. Piezas por capa

| Capa | Pieza | Nueva/Mod. | Notas |
|---|---|---|---|
| domain | `structure/StructureType` (VO) | Nueva | id, `footprint {cols, rows}`, `radius`, `health`, `guards?` `{type, max, everyTicks}`. Invariantes con `Result`. |
| domain | `structure/StructureRules` (VO) | Nueva | Tipos en orden de contenido, `count` por tipo y `placement` (`minStartCells`, `minCastleCells`, `minWaterCells`, `minGapCells`, `maxAttempts`). Referencias cruzadas con el catálogo (§2.4). |
| domain | `structure/StructureSite` (VO) | Nueva | Sitio estático: id, tipo, `col,row,cols,rows`, centro (x, y), `radius` y `door` (punto del puesto). Inmutable. |
| domain | `structure/placeStructures` | Nueva | Generador puro: `(map, rules, random) → StructureSite[]`. Solo lee `GameMap` (§3). |
| domain | `structure/resolveStructures` | Nueva | Sitios de la partida según `TerrainSource`: generados, declarados (`open`/`cells`) o ninguno (§3.3). |
| domain | `structure/Structure` (entidad) | Nueva | Vida y `lastHitTick` escalares y mutables (ADR-0003). Cumple `WeaponTarget` de forma estructural. `destroyedAt`. Si es casa, tiene su `GuardPost`. |
| domain | `structure/StructureField` (servicio con estado, de `Run`) | Nueva | Lista estable de estructuras (las ruinas no se retiran), paso de nacimiento de guardias y vista `targets` para las armas. |
| domain | `enemy/GuardPost` | Nueva | Puesto (x, y), ruta de patrulla (`Float64Array`), `FlowField` propio hacia la celda del puesto y contador de guardias vivos. Está en `enemy/` para que `Enemy` no dependa de `structure/`. |
| domain | `enemy/behavior/BehaviorConfig`, `Behavior` | Mod. | Clases `patrol`, `alert` y `return` (§4.1). Arrays nuevos: `detectDistSq`, `loseDistSq`, `patrolRadius` y `detectTo`/`loseTo`. |
| domain | `enemy/Enemy` | Mod. | `post: GuardPost \| null` (readonly) y `waypoint` (escalar). `Enemy.spawn(..., post?)`. |
| domain | `enemy/Horde` | Mod. | `act` con ramas para las clases nuevas (§4.2). `spawn(type, x, y, n, post?)`. `removeDead` sin cambios: la liberación del puesto se hace en `onDeath`. |
| domain | `map/FlowField` | Mod. (mínima) | `hasClearLine` pasa a la función pura `map/clearLine.ts`; `FlowField` delega en ella. Nada más cambia. |
| domain | `map/TerrainSource` | Mod. | `generated` pide `structureRandom`. `open` y `cells` aceptan `structures?: DeclaredStructure[]`. |
| domain | `map/MapSnapshot` | Mod. | `structures: readonly StructureSiteSnapshot[]` (estático, una vez por partida). |
| domain | `weapon/Arsenal`, `Projectile` | Mod. | `step(n, px, py, enemies, structures = [])` y `Projectile.atStructure` (§5). |
| domain | `wave/WaveTable` | Mod. | Rechaza los tipos con `patrol`/`return` en las oleadas (necesitan puesto). |
| domain | `run/Run`, `RunConfig`, `RunSetup`, `RunSnapshot`, `snapshotParts` | Mod. | Orden del tick (§6), `RunConfig.structures`, `setup.enemies[i].guardOf`, `setup.structures[i].health`, `RunSnapshot.structures`. |
| application | — | Sin cambios | `StartRun`/`TickRun` reciben el `TerrainSource` igual que hoy. |
| infrastructure | `random/deriveSeed` | Mod. | `STRUCT_STREAM = 3` (constante nueva; `deriveSeed` no cambia). |
| infrastructure | `content/schemas`, `loadRunConfig` | Mod. | `StructuresSchema` (`content/structures.json`, nuevo) y clases nuevas en el `discriminatedUnion` del comportamiento. `RawContentFiles.structures`. |
| infrastructure | `content/appearanceSchema`, `loadAppearance`, `art/looks`, `map/mapLooks` | Mod. | `map.structures.<tipo>.{intact, ruin}` (hoja, escala, origen, frame), colores de reserva por elemento y aspecto `goblin-tnt-guard` (`TNT_Red`). |
| infrastructure | `phaser/map/planMapArt` | Mod. | Base (capa baja) y tejado (capa alta) por estructura, con `bounds`, y `structures: StructureDrawRef[]` (índices de las dos piezas y aspectos intacto y ruina). |
| infrastructure | `phaser/TerrainView` (`MapArtCanvas`) | Mod. | `swap(index, look)`: cambia textura y frame de un sprite, o el color de un rectángulo de reserva. |
| infrastructure | `phaser/StructureArt` | Nueva | Sin motor. En cada frame compara `snapshot.structures[i].destroyed` con lo ya pintado y llama a `swap` solo en las transiciones (O(k), sin asignar). |
| infrastructure | `phaser/EnemyLayer`, `renderCounts` | Mod. | `StateCounts` con `patrol`/`alert`/`return` (andar o quieto, como `chase`). Sonda `sprites.structures` (§7). |
| composition | `seedSource.seededRun` | Mod. | `structureRandom = Mulberry32(deriveSeed(seed, STRUCT_STREAM))`. Sigue siendo la única ruta de siembra. |
| content | `structures.json` (nuevo), `enemies.json`, `appearance.json`, `asset-provenance.json` | Nueva/Mod. | §2, §8 y §9. |
| tests/support | `mapGolden.ts`, `map-golden.test.ts`, `mapStats.ts`, `builders.ts`, bench | Mod. | Firma dorada de estructuras nueva (§10). El bot (`policies.ts`) solo cambia si entra W3 (§11). |

**Por qué en el dominio**: la vida de las estructuras, el nacimiento de los guardias y sus estados cambian la
partida, así que forman parte del contrato de determinismo y del balance que mide el bot sin motor. La escena solo
pinta el snapshot (antipatrón: lógica en la escena). **Sin puertos nuevos**: no hay dos implementaciones
previsibles. La colocación es un valor (`TerrainSource`), igual que el mapa (ADR-0013).

## 2. Contenido

### 2.1 `content/structures.json` (nuevo; valores de partida, se pueden ajustar en apply)
```json
{
  "placement": { "minStartCells": 9, "minCastleCells": 6, "minWaterCells": 2, "minGapCells": 4,
                 "maxAttempts": 2000 },
  "types": [
    { "id": "goblin-house", "count": 4, "footprint": { "cols": 2, "rows": 2 }, "radius": 48,
      "health": 60, "guards": { "type": "goblin-tnt-guard", "max": 2, "everyTicks": 900 } },
    { "id": "goblin-tower", "count": 3, "footprint": { "cols": 2, "rows": 2 }, "radius": 48,
      "health": 90 }
  ]
}
```
- Las distancias son de Chebyshev en celdas, con los mismos criterios que la medición 5. `minStartCells` se mide
  desde la celda de la salida del mapa. `minCastleCells` se mide hasta el rectángulo del castillo. `minWaterCells`
  se mide hasta cualquier celda `water` o `bridge`. `minGapCells` es la separación entre las huellas ampliadas (la
  huella más su fila frontal) de dos estructuras.
- Con la escala 0,9375 del pack, la casa (128 × 192) ocupa 120 × 180 px, es decir, 2 columnas por 3 filas. La huella
  es la base de 2 × 2 y la fila de arriba es tejado (capa alta). La torre (frame de 256 × 192, de los que solo se ven
  unos 128) usa la misma huella.
- La **fila frontal** (`row + rows`) también tiene que ser hierba. En ella está la celda de la puerta: la de la
  columna `colAt(cx)`. El **puesto** es (cx, centro de la fila frontal), y está en una celda caminable. Esta regla es
  la misma para los dos tipos, aunque solo la casa use la puerta.

### 2.2 `goblin-tnt-guard` en `content/enemies.json`
Tiene los stats de `goblin-tnt` (velocidad 45, radio 22, daño 15, vida 45, xp 4; `cost` 3, que no se usa porque no
está en las oleadas) y este comportamiento:
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
Lanza a **100 px**, por debajo de `FLEE_ENEMY_RANGE` 150. Así el caso W3 (lanzamiento desde fuera del radio de
huida a un jugador quieto) no se da por diseño (§11).

### 2.3 Barril (A3)
Valores: `approach.exit.distance` 60, `health` 25 y `fuse.radius` 80. Cumplen las cotas de 0020: 60 < 80 y mecha
40 ≥ ⌈(80 + 16 − 60) / (215 / 60)⌉ = 11. Se pueden recalibrar en apply (§11).

### 2.4 Invariantes y referencias cruzadas (dominio; zod solo comprueba la forma)
- `count`, `max` y `maxAttempts` son enteros ≥ 0 (`max` ≥ 1 si hay `guards`). `everyTicks`, `footprint` y las
  distancias son enteros ≥ 1. `radius` y `health` son > 0. Los ids de tipo no se repiten.
- `guards.type` existe en el catálogo, su estado inicial es de clase `patrol` y tiene **exactamente un** estado
  `patrol`, que es el que da el radio de la ruta.
- `alert`: `lose.distance` > `exit.distance`, si hay salida. `patrol.detect.to` y `return.detect.to` apuntan a un
  estado `alert` y `detect.distance` < su `lose.distance`, para que haya histéresis y la guardia no oscile. `return.to`
  apunta a un `patrol`.
- `WaveTable`: un tipo de las oleadas no puede declarar `patrol` ni `return`.
- `RunSetup`: un enemigo de un tipo con `patrol`/`return` necesita `guardOf` (el índice de una casa de la partida), y
  cualquier otro lo tiene prohibido.
- Todo error nombra el tipo y el campo (`namingEnemyType` se amplía a `structures.types.i`).

## 3. Colocación (D2) y determinismo del mapa

### 3.1 Flujos
```
seededRun(seed): random          = Mulberry32(seed)                         // oleadas y ofertas
                 mapRandom       = Mulberry32(deriveSeed(seed, MAP_STREAM))  // 1, sin cambios
                 structureRandom = Mulberry32(deriveSeed(seed, STRUCT_STREAM)) // 3, nuevo
decorSeedOf(seed) = deriveSeed(seed, DECOR_STREAM)                          // 2, solo render
```
`generateMap` no cambia y no consume nada nuevo, así que **la firma de celdas queda igual**. `placeStructures` se
ejecuta con el `GameMap` ya construido y solo lee de él.

### 3.2 Algoritmo de `placeStructures(map, rules, random)`
Recorre los tipos en el orden del contenido y, para cada uno, `count` estructuras. Cada estructura tiene hasta
`maxAttempts` intentos (el número es global por estructura). En cada intento:
1. `col = pickInt(0, cols − fcols)` y luego `row = pickInt(0, rows − frows − 1)`: 2 valores, siempre en ese orden.
2. Acepta si: todas las celdas de la huella y de la fila frontal son `grass`; se cumplen las tres distancias de
   §2.1; y la huella ampliada está a ≥ `minGapCells` de las de las estructuras ya colocadas.
3. Al aceptar, el id es el índice global en orden de colocación. Si se agotan los intentos, el tipo se queda con
   menos estructuras y se pasa a la siguiente (mejor esfuerzo, sin excepción).

El contrato de determinismo de la colocación es: ese orden de consumo, el orden de tipos y el criterio de aceptación.
Un test de 1..1000 exige que se coloquen todas (la medición 5 da ≥ 189 huellas 2 × 3 disjuntas por semilla, así que
hay mucho margen). Coste: O(intentos × huella), solo al empezar la partida.

### 3.3 Mapas vacíos y explícitos
`open` y `cells` no tienen estructuras salvo que declaren `structures: [{ type, col, row }]` (escenarios y tests).
Las declaradas solo tienen que estar dentro de la rejilla, con la huella y la fila frontal caminables y sin solaparse
entre sí. No se aplican las distancias. El mapa E2E por defecto (`map=empty`) no tiene estructuras.

## 4. Guardias

### 4.1 Clases nuevas (amplían ADR-0019; `assertNever` en el dominio y `discriminatedUnion` en zod)
| Clase | Movimiento | Transición antes de moverse | Transición después de moverse |
|---|---|---|---|
| `patrol` | Hacia el punto `waypoint` de la ruta del puesto, en línea recta | d(guardia, jugador) ≤ `detect` → `detect.to` | Si llega exactamente al punto, `waypoint = (i + 1) mod len` |
| `alert` | Igual que `chase`: `field.steer` hacia el jugador | d > `lose` → `lose.to` | d ≤ `exit` → `exit.to` (igual que `chase`) |
| `return` | `post.field.steer` hacia el puesto | d(guardia, jugador) ≤ `detect` → `detect.to` | Si llega exactamente al puesto → `to`, con `waypoint = 0` |

- En `Horde.act`, para cada enemigo y en orden de lista: (a) si termina una `wait`, pasa a su destino; (b) se
  comprueban las transiciones previas del estado resultante (como mucho una); (c) se mueve según la clase; (d) se
  comprueban las transiciones posteriores. Ocurre como mucho una transición en (b) y otra en (d). Las distancias se
  comparan al cuadrado, sin asignar y sin azar.
- "Llega exactamente": `Enemy.chase` no se pasa del objetivo y deja el centro en él cuando d ≤ paso. Los puntos de
  la ruta ya están recortados a la arena con el radio de la guardia, así que el recorte final de `chase` no cambia
  nada.
- **Ruta de patrulla** (`GuardPost`, al crear la casa, fuera del camino caliente): son las 4 esquinas del cuadrado de
  semilado `radius` centrado en el puesto, en el orden fijo (−,−), (+,−), (+,+), (−,+). Cada esquina se recorta a la
  arena y, si su celda no es caminable, se recoloca con `GameMap.nearestWalkable`. Después se filtra: una esquina se
  acepta si hay línea libre (`clearLine`) desde la anterior aceptada, empezando por el puesto. Al final se quitan
  esquinas del final hasta que la última tenga línea libre con la primera. Si la ruta queda vacía, la guardia se queda
  quieta en el puesto mientras patrulla. Todo tramo recorrido tiene línea libre, así que **el centro siempre está en
  una celda caminable**. Para entrar en la ruta desde el puesto también hace falta línea libre, y la primera esquina
  aceptada la cumple.
- **Vuelta**: la `FlowField` del puesto se crea una vez por casa, se orienta (`retarget`) a la celda del puesto y la
  BFS se hace la primera vez que se consulta. El mapa no cambia, así que no se recalcula nunca. Usa la misma regla de
  línea libre y de vecinos de ADR-0017, y por eso mantiene el invariante de celda caminable.
- La alerta reutiliza `charge`/`wait`/`HazardField.launch` de 0020 sin cambios. Mecha, carga y espera siguen
  quietas.

### 4.2 Nacimiento (D3)
`StructureField.spawnGuards(n, horde, maxAlive)` recorre las casas en orden de lista. Una casa hace nacer **una**
guardia en su puesto si se cumplen todas estas condiciones: no está destruida, `n ≥ nextSpawnAt`,
`post.alive < max` y `horde.alive.length < maxAlive`. La guardia nace en el estado inicial, con `waypoint` 0 y
`post` asignado. Entonces `nextSpawnAt = n + everyTicks`; al empezar vale 1, así que la primera guardia nace en el
tick 1. Si el tope lo impide, `nextSpawnAt` no cambia y se vuelve a intentar en cada tick. Al morir una guardia,
`dropGem` llama a `post.release()`. Nacer no consume azar. La guardia entra al final de la lista con el siguiente id
de `Horde`, no se mueve en su tick de nacimiento, cuenta contra `maxAlive`, da su gema y cuenta en las bajas. Si la
casa se destruye, deja de hacer nacer guardias, pero las que ya viven siguen con su puesto.

## 5. Armas sobre estructuras (D5)
- **Selección** (`Arsenal.fire`): `selectTarget(criterio, enemigos)`. Si da −1, `selectTarget(criterio,
  estructuras)`, que solo considera las vivas porque las ruinas tienen `alive` false. Es la misma función con otra
  lista: ninguna concatenación ni asignación.
- **Proyectil**: al lanzarlo se guarda `atStructure`. En cada paso daña al primer enemigo vivo que solapa. Solo si no
  hay ninguno y `atStructure` es true, daña a la primera estructura viva que solapa. Una flecha lanzada contra un
  enemigo **atraviesa** las casas. Se elige así porque es la lectura más estricta de "prioridad menor": una estructura
  nunca le quita daño a un enemigo y no altera el balance actual.
- **Pulso**: se dispara si su criterio da un enemigo o, si no hay ninguno, una estructura. Daña a todos los enemigos
  y a todas las estructuras vivas que solapa.
- `step` solo devuelve las bajas de **enemigos**. Una estructura destruida no llama a `removeDead`, no da gema ni
  cuenta en las bajas (D6). Las explosiones (`HazardField`) no cambian y no dañan estructuras. El contacto sigue
  siendo solo de enemigos.

## 6. Orden del tick (contrato de determinismo; amplía ADR-0019)
```
1 jugador → retarget del campo
2 comportamiento en orden de lista (incluye patrol/alert/return; §4.1)
3 armas: enemigos y, de reserva, estructuras (§5) → removeDead si hay bajas de enemigos (gemas, release)
4 peligros (sin cambios; no dañan estructuras) → removeDead → lanzamientos
5 golpe único max(contacto, explosión) → muerte o victoria cortan el tick
6 gemas y XP → director de oleadas → nacimiento de guardias (casas en orden de lista) → oferta
```
Lo único que consume azar sigue siendo cada intento de aparición del director y la oferta. Las estructuras usan su
propio flujo, y solo al empezar.

## 7. Snapshot y sonda E2E
- `MapSnapshot.structures` (estático): `{ id, type, col, row, cols, rows, x, y, radius, door: {x, y} }`.
- `RunSnapshot.structures` (por frame, congelado): `{ id, type, x, y, radius, health, maxHealth, destroyed,
  damaged }`, en orden de id. Las ruinas se incluyen con `health` 0.
- `EnemySnapshot.stateKind` admite `patrol | alert | return`. No hace falta ningún campo más (el puesto no se
  expone).
- Sonda: `__sprint.snapshot.structures` y `__sprint.map.structures` salen solos de lo anterior.
  `sprites.structures = { [tipo]: { intact, ruin, fallback } }` y `sprites.enemyStates` con las tres claves nuevas.
  `sprites.mapArt.objects` y `drawn` incluyen las piezas de las estructuras. Los nombres exactos los fija la spec
  `sprite-rendering`: si difieren, manda la spec.
- E2E (e2e-lite, **1** como máximo): se amplía un test de humo con `map: 'real'`, `?e2e&manual` y `step(n)`. Comprueba
  que hay estructuras en `map` y en `snapshot`, `sprites.structures` con arte (`fallback` 0) y al menos una guardia
  en `patrol` tras `step(1)`. El cambio a ruina y la reserva se cubren con tests de infraestructura con `FakeSprite`,
  sin navegador.

## 8. Arte, culling y presupuesto de objetos
- **Ficheros** (4, del pack local Update 010; `Wood_Tower_Red` porque los goblins son rojos), copiados en
  `public/assets/tiny-swords/Factions/Goblins/Buildings/...`:
  `Wood_House/Goblin_House.png`, `Wood_House/Goblin_House_Destroyed.png` (128 × 192),
  `Wood_Tower/Wood_Tower_Red.png` (4 × 256 × 192; se usa el **frame 0 fijo** y la animación de la bandera queda fuera)
  y `Wood_Tower/Wood_Tower_Destroyed.png` (256 × 192). Cada uno con su entrada `path/source/version/sha256/bytes` en
  `content/asset-provenance.json`, medida al copiar. `guard:all` en verde. Siguen prohibidos `Fire`,
  `Wood_Tower_InConstruction`, los otros colores y todo el Free Pack. El test de
  `appearance-hazards.test.ts` (l. ~208) se reduce a esa lista.
- **Plan** (`planMapArt`, puro): por estructura hay una base en la capa baja (recorte inferior) y un tejado en la capa
  alta (recorte superior), con el mismo corte que el castillo (`origin.y · h − cellSize / scale`). Ancla: centro
  inferior de la huella. Van después de la fachada del castillo y del tejado, respectivamente. Sin arte, se pinta 1
  rectángulo de reserva sobre la huella con el color del elemento (intacto o ruina; `appearance.terrain`).
- **Ruina**: los frames intactos y de ruina miden lo mismo (128 × 192 y 256 × 192), así que el cambio es
  `setTexture(clave, frame)` sobre los mismos sprites. Phaser conserva el recorte al cambiar de frame
  (`TextureCrop.setFrame` → `updateCropUVs` si `isCropped`; comprobado en
  `node_modules/phaser/src/gameobjects/components/TextureCrop.js`). Las cajas no cambian y **`MapCuller` no se toca**.
  `StructureArt` solo llama a `swap` en las transiciones, y no se crean objetos del motor por frame.
- **Presupuesto**: +2 objetos por estructura con arte (+1 con reserva). Con 7 estructuras son +14, así que unos 681 y
  764 en las semillas 42 y 123, por debajo de 1.000. El test sin navegador `plan-map-fallback.test.ts` se amplía y
  sigue siendo el gate. `drawn` cambia solo si alguna estructura cae en la vista inicial.
- **Guardia**: aspecto `goblin-tnt-guard` con la hoja `TNT_Red` (sin fichero nuevo) y un color de reserva propio.

**API de Phaser**: consultada con el MCP `phaser-docs`, página
`/api-documentation/class/gameobjects-sprite.md#inherited-methods` (`TextureCrop`: `setCrop`, `setFrame`,
`setTexture`). Como la doc publicada puede ir por detrás de la 4.2.1, el comportamiento del recorte se ha
comprobado en los fuentes de `node_modules/phaser`.

## 9. Dependencias nuevas
| Paquete | Versión exacta | Motivo | Alternativa descartada |
|---|---|---|---|
| — | — | Ninguna | — |

## 10. Firmas doradas y cifras que cambian
| Firma | ¿Cambia? | Motivo |
|---|---|---|
| `MAP_GOLDEN` (celdas, 42 y 123) | **No** | D1-A con D2. `map-golden.test.ts` sigue igual y es la prueba de que no ha cambiado. |
| `STRUCTURE_GOLDEN` (nueva, 42 y 123) | Nueva | `tipo@col,row` en orden de id, en `tests/support/mapGolden.ts` (sin imports), fijada contra `placeStructures`. |
| `deriveSeed`, `MAP_STREAM`, `DECOR_STREAM` | No | Solo se añade `STRUCT_STREAM` 3. |
| Variedad de árboles (`treeChoices`) | No | `DECOR_STREAM` sin cambios. |
| Objetos del mapa 667/750 y `drawn` 106/67 (42/123) | Sí | Por las piezas de las estructuras. Se regeneran y se anotan. |
| Balance 27/50, primera oferta s7 2.082, plazos del quieto | Sí | Por el barril, los guardias y los ids. Se miden de nuevo (§11). |
| "Mismos spawns con y sin mapa" | Sí | Con el mapa generado, los guardias desplazan ids. El test compara solo las apariciones del director, o usa mapas sin estructuras. |

Toda firma que cambie se justifica en el verify-report.

## 11. Plan de balance en apply (por pasos, para aislar causas)
Cada paso se mide con `measureBalance` (bot v3, 1..50): victorias, quietos en el mapa generado y en el vacío, mechas
y explosiones por partida, primera oferta de s7 y tiempo del lote. Los pasos 2 y 3 usan configuraciones de test
(`builders`), no contenido publicado.
1. **Barril (A3)**: solo `enemies.json` del barril. Se espera 29/50, 0/0 quietos y unas 29,0 mechas (7c). Si no se
   reproduce, se para y se investiga antes de seguir.
2. **Estructuras sin guardias** (`guards.max` 0 en la config de test): mide el efecto de que las armas apunten a
   estructuras. Se espera ±1 victoria. Si cae más de 2, se revisa la regla de §5 antes de seguir.
3. **Guardias** (contenido final): con la banda 25–35 y 0 quietos, el bot se queda en v3 y su spec no cambia.
4. **Si el paso 3 sale de la banda**, se mide con instrumentación de test el **daño de dinamita de guardia recibido
   en ticks en que v3 devuelve `NONE` con ≥ 1 aviso amenazante** (la firma de W3):
   - **W3 entra (bot v4 "flee-nearest", el diff de la medición 4)** solo si victorias < 25 **y** ese daño es > 0 en
     las semillas que se ganaban en el paso 2 y ahora se pierden. Con lanzamiento a 100 < 150 no se espera.
   - Si no es W3, se ajustan los parámetros del guardia en este orden: `max`, `everyTicks`, `detect`/`lose`. Después,
     el barril dentro de A3 y de las cotas de 0020. Por último, `count`/`health` de las estructuras. Las demás
     palancas (oleadas, `maxAlive`, anillo, `player.speed`, armas, mejoras, stats de `goblin-torch`/`goblin-tnt`,
     curva) están **vetadas**: si hicieran falta, se vuelve al gate.
5. Las cifras finales (victorias, quietos, mechas y explosiones por partida, s7, plazos) van al addendum de ADR-0020 y
   al verify-report.

## 12. Rendimiento y seguridad
- **Coste por tick** (300 vivos): la reserva de estructuras es O(S) con S ≤ 7, y solo cuando no hay ningún enemigo en
  el criterio. El filtro de proyectiles con `atStructure` es O(S) por proyectil marcado. El nacimiento es O(casas). Las
  guardias (como mucho 8 con 4 casas × 2) hacen comparaciones y `steer`/`clearLine` acotados. La BFS de cada puesto se
  hace una sola vez. Estimación: < 0,01 ms/tick añadido. **Sin asignaciones en el tick**: `targets` es el array
  interno de `StructureField`; la ruta y los campos se crean al empezar. Crear la `Enemy` de una guardia asigna, igual
  que cualquier aparición.
- **Memoria**: unos 20 KB por casa (copia de códigos y buffers `dist`/`queue` de 2.304 celdas). Unos 80 KB en total.
- **Bench** (`npm run bench`, informativo): caso nuevo "peor caso con estructuras y guardias", con el mapa de la
  semilla 42, 300 vivos, las estructuras del contenido, 4 guardias en `alert`/`charge` y 4 en `patrol` (con
  `RunSetup` y `guardOf`). Objetivo **≤ 0,25 ms/tick**. Se anota y no bloquea.
- **Lote del bot**: se mide en local tras los pasos 1 y 3. Umbral **≤ 32 s en local** (≈ 90 s en CI con el factor
  ×2,8). `BOT_BATCH_TIMEOUT_MS` se queda en 180 s (D9). Si se supera, se registra la causa antes de cambiar nada.
- **Seguridad y datos**: solo contenido versionado validado con zod (forma) y con el dominio (invariantes). No hay
  entradas externas nuevas. El progreso guardado (`localStorage`/JSON) no cambia de formato: récords e historial no
  incluyen estructuras. Los PNG nuevos tienen procedencia con sha256 y los vigila el guardarraíl de assets.

## 13. Pendiente de cotejar con las specs delta (se escriben en paralelo)
- La regla del proyectil marcado `atStructure` (§5) y que el pulso se dispare solo con una estructura en el criterio:
  tienen que coincidir con `auto-weapons`.
- Los nombres de la sonda (`sprites.structures`, claves de `enemyStates`) y del snapshot: `sprite-rendering` y
  `run-state`.
- Las cotas legibles del guardia (histéresis `detect < lose`, lanzamiento a 100) y el invariante de celda caminable
  en la patrulla: `enemy-behavior`.
- El primer nacimiento en el tick 1 y que la casa destruida conserve a sus guardias vivas: `goblin-structures` y
  `enemy-spawning`.
- Los valores numéricos de §2 son el punto de partida. La spec fija las cotas, no las cifras, salvo las del barril
  (A3).

## ADRs
- `docs/adr/0020-estructuras-goblin-como-entidades-y-puestos-de-guardia.md` (nuevo). Amplía ADR-0019 (clases nuevas
  y orden del tick) y ADR-0013 (tercer flujo de azar).
