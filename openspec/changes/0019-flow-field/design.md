# Design · 0019-flow-field

## Resumen
Un servicio de dominio nuevo, `FlowField`, guarda la distancia en celdas (BFS de 4 vecinos) desde la celda del
jugador sobre el `GameMap` de la partida. Se recalcula entero solo cuando el jugador cambia de celda. Cada enemigo
vivo calcula su objetivo del tick así: si tiene **línea libre**, el centro del jugador (la persecución en línea recta
de hoy); si está en la celda del jugador, también; si no, el centro de la siguiente celda del campo. Después se mueve
con el `Enemy.chase` actual. La aparición se recoloca en la celda caminable más cercana dentro de `placeSpawn`.
`maxAlive` sube a 300. El balance se recalibra con palancas de contenido que no son ni el presupuesto de oleadas ni
`player.speed` (§6), con un criterio de parada explícito.

Base de partida (gate del 2026-11-24): enfoque A de la exploración tal como se aprobó. Sin separación, sin colisión de
enemigos con el mapa, sin edificios. Oleadas y `player.speed` intactos.

## 1. Piezas por capa
| Capa | Pieza | Nueva/Mod. | Notas |
|---|---|---|---|
| domain | `map/FlowField.ts` (`FlowField`) | Nueva | Servicio de dominio con estado, propiedad de `Run` (como `GemField`). Buffers preasignados; no asigna en el tick |
| domain | `map/connectivity.ts` | Mod. | Nueva `distancesFrom(cells, cols, rows, start, dist, queue)` (BFS con distancias, mismo orden de vecinos que `reachableFrom`); se exporta `codesOf` |
| domain | `map/GameMap.ts` | Sin cambios | Ya tiene `isWalkable`, `colAt/rowAt` y `nearestWalkable` (lo reutilizan la recolocación y el campo) |
| domain | `enemy/Horde.ts` | Mod. | `chase(x, y, dt, field)`: pide a `field.steer` el objetivo de cada enemigo y llama a `enemy.chase(tx, ty, …)` |
| domain | `enemy/Enemy.ts` | Sin cambios | `chase` hacia un punto con recorte a la arena; no se mueve más allá del objetivo |
| domain | `wave/placeSpawn.ts` | Mod. | Recibe el `GameMap`: candidato = `nearestWalkable(clampCircle(punto del anillo))`; se acepta si su celda es caminable y está a ≥ `minDistance`; sigue gastando 1 valor de azar por intento |
| domain | `run/Run.ts` | Mod. | Crea el `FlowField`; en `tick`: jugador → `field.retarget(col, row)` → `horde.chase(…, field)` → resto igual. Se actualiza el comentario del contrato de determinismo |
| application | — | — | No hay casos de uso nuevos: la navegación es una regla interna del agregado `Run` |
| infrastructure | `content/waves.json` | Mod. (contenido) | `maxAlive` 300. El esquema zod no cambia (`Count`) |
| infrastructure | `content/{enemies,upgrades,progression}.json` | Mod. (contenido, calibración) | Solo lo que salga de §6 |
| infrastructure | Phaser (`EnemyLayer`, snapshot, sonda) | Sin cambios | El pool de sprites ya se dimensiona con `waves.maxAlive` (`composition/main.ts`, ADR-0003): pasa a 300 sin tocar código |
| composition | — | Sin cambios | `seededRun` ya pasa el `TerrainSource` |
| tests/support | `builders.ts` | Mod. | `DEFAULT_ENEMY_TYPES`, `DEFAULT_PROGRESSION` y `DEFAULT_UPGRADE_LIST` duplican `content/`; se leen del JSON (como `DEFAULT_WAVES`) para que la calibración tenga una sola fuente |

Por qué en domain: el campo es una regla del juego sobre el mapa, pura y determinista (GDD §técnico: "el mapa, el
campo de flujo y las colisiones viven en domain/application"). No hay puerto: hay una sola implementación y nada
externo que sustituir (antipatrón "puerto sin dos implementaciones").

## 2. Modelo de `FlowField`
```ts
class FlowField {
  constructor(map: GameMap);                 // copia los códigos (codesOf) una vez; aloja dist/queue (Int32Array)
  retarget(col: number, row: number): void;  // fija la celda objetivo; si cambia, marca el campo como sucio
  distanceAt(col: number, row: number): number; // −1 = sin distancia; calcula la BFS si está sucio
  hasClearLine(ex: number, ey: number, px: number, py: number): boolean;
  steer(ex: number, ey: number, px: number, py: number, out: { x: number; y: number }): void;
}
```
**Cálculo perezoso** (corrección tras las specs): `retarget` solo marca el campo como sucio. La BFS se hace la
primera vez que `steer` (sin línea libre) o `distanceAt` la necesitan, y como mucho una vez por celda objetivo. El
campo es función pura de (mapa, celda), así que hacer la BFS tarde o pronto no cambia nada observable. Con todos
los enemigos con línea libre no se calcula. `distanceAt` siempre es válido, también con el mapa vacío (spec
procedural-map "Mapa vacío": |c − 32| + |r − 18|).
Reglas (forman parte del contrato de determinismo; ver ADR-0017):
1. **Campo = f(mapa, celda del jugador)**. `retarget` siempre recalcula desde cero (sin estado incremental), así que
   dos partidas con la misma celda tienen el mismo campo, sea cual sea el camino recorrido.
2. **BFS de 4 vecinos** con el orden fijo **izquierda, derecha, arriba, abajo**, que es el de `reachableFrom`.
   `dist` = −1 en las celdas bloqueadas y en las inalcanzables. Si la celda del jugador no es caminable (solo puede
   pasar en escenarios `cells`), todo queda a −1.
3. **`steer`**, para un enemigo en la celda `e` y el jugador en la celda `p`:
   - Si `e == p` → el objetivo es el centro del jugador.
   - Si hay **línea libre** → el objetivo es el centro del jugador.
   - Si `dist[e] > 0` → el objetivo es el centro del rectángulo recortado del **primer vecino, en el orden fijo, con
     `dist = dist[e] − 1`**. El empate se resuelve por ese orden y no por el padre que asignó la BFS, para que la
     regla sea local y fácil de comprobar.
   - Si `dist[e] == −1` (el enemigo está en una celda bloqueada o aislada, cosa que solo pasa con `RunSetup` o
     `cells`) → persigue directamente al jugador (comportamiento de hoy, como reserva).
4. **Línea libre** (spec enemy-behavior): toda celda que contiene algún punto del segmento entre el centro del
   enemigo y el del jugador es caminable, con la regla de "celda de un punto" (floor, como `colAt/rowAt`; un punto
   sobre una línea de la rejilla pertenece a la celda de coordenada mayor). Se implementa con un recorrido de rejilla
   (Amanatides–Woo) que empieza en la celda del enemigo y aplica floor en cada cruce. Si el segmento pasa exactamente
   por una esquina (`tMaxX == tMaxY`), se comprueban las **dos** celdas laterales y la diagonal. Se para en la primera
   celda bloqueada. Un segmento horizontal o vertical sobre una línea de la rejilla recorre solo la fila o columna que
   da floor (escenario "Segmento sobre el borde de una celda bloqueada"). Solo cuenta el centro: el radio del enemigo
   puede rozar una celda bloqueada (aceptado en la propuesta).
5. **Mapa sin celdas bloqueadas** (`open`, o `cells` todo `grass`): `steer` devuelve el jugador sin BFS ni recorrido,
   porque la línea libre siempre es cierta. Así los escenarios numéricos de "Persecución en línea recta" dan los mismos
   resultados exactos (no solo con un error ≤ 0,001). Este atajo solo existe en `steer`; `distanceAt` sigue
   calculando el campo.
6. El enemigo no se pasa del centro de la celda objetivo: si el paso es mayor que la distancia, se queda en el centro
   y pierde el resto del paso en ese tick (≤ 1,5 px; es la semántica de `chase` de hoy).

Por qué el camino nunca pisa celdas bloqueadas: desde un punto de la celda `e`, el segmento hasta el centro de un
vecino ortogonal se queda en la fila o columna de `e` y solo cruza `e` y ese vecino. Con línea libre el segmento ya se
ha comprobado, y el enemigo avanza sobre él. Esto sustenta el escenario "nunca tiene el centro en una celda `water`".

## 3. Flujo de un tick
```
player.move(input, map)            // sin cambios
field.retarget(colAt(px), rowAt(py))   // marca el campo sucio si cambió la celda; BFS perezosa en steer
horde.chase(px, py, dt, field)     // por enemigo: steer → out (objeto reutilizado) → enemy.chase
arsenal → removeDead → contacto → victoria → gemas → director(place → placeSpawn con mapa) → oferta
```
El campo se recalcula después del movimiento del jugador y antes de la persecución. Hay que modificar el escenario
"Orden de los pasos del tick" de `simulation-loop`. Ni el campo ni la recolocación consumen azar: el orden de consumo
de `random` no cambia. Los enemigos nuevos siguen sin moverse en el tick en que aparecen; su posición de aparición ya
es la recolocada.

## 4. Recolocación de la aparición
En `placeSpawn`, en cada intento: ángulo (1 valor) → punto del anillo → `clampCircle` → `map.nearestWalkable` (mismo
criterio que las gemas: centro de la celda caminable más cercana, con empate a la fila menor y luego a la columna
menor) → se acepta si queda a ≥ `minDistance`. Ventajas: la distancia mínima vale sobre la posición **final**, cada
intento sigue gastando exactamente 1 valor y no hay azar extra. Con `open`, `nearestWalkable` es la identidad y el
resultado es el de hoy. Coste: O(celdas) (2.304) solo en el 12–13 % de las apariciones que caen en celda bloqueada.
El centro de una celda queda a 30 px del borde, por encima del radio máximo (22), así que la posición sigue dentro
del mundo (`Enemy.spawn` vuelve a recortar de todos modos). Los enemigos de `RunSetup` no se recolocan, porque son
geometría de escenario.

Ajustes tras contrastar con la spec enemy-spawning:
- **1 valor de azar por intento**, se recoloque o no. Si la recolocación deja el punto por debajo de `minDistance`, el
  intento no vale y el siguiente gasta otro valor (escenario "Recolocación que queda demasiado cerca").
- **Mapa sin celdas caminables**: `nearestWalkable` deja el punto donde estaba. `placeSpawn` comprueba después que la
  celda final es caminable y, si no lo es, el intento no vale (escenario "Mapa sin celdas caminables").
- **Visibilidad**: solo los puntos **no recolocados** (y sin recorte) siguen fuera del rectángulo del tope `maxView`.
  Un punto recolocado puede quedar a ≤ ~2,5 celdas hacia dentro. La garantía que da la spec para todas las
  apariciones es quedar fuera de las vistas de **1.280 × 720 y 960 × 540** (escenario "Jugador ante la puerta del
  castillo", semilla 42), además del mundo, `minDistance` y la celda caminable. No se añade ninguna regla de vista al
  núcleo: el núcleo no conoce la vista (ADR-0015) y lo que asegura el margen es el anillo de 1.500 px.

## 5. Dependencias nuevas
| Paquete | Versión exacta | Motivo | Alternativa descartada |
|---|---|---|---|
| — | — | Ninguna: BFS y recorrido de rejilla propios, de pocas líneas | Librerías de *pathfinding* (`pathfinding`, `easystarjs`): asignan memoria, no garantizan el orden de vecinos que fija el contrato y meterían código de terceros en el núcleo |

Phaser: el diseño no usa ninguna API nueva del motor. El render no cambia y el pool de 300 sale de la configuración.
Vía de documentación: no se ha consultado porque no aplica.

## 6. Calibración del balance (sin oleadas ni `player.speed`)
Punto de partida medido: **18/50** (banda 25–35). Hay que subir unas 7–12 victorias del bot sin que ningún jugador
quieto sobreviva 180 s.

**Palancas, por orden de preferencia** (todas en `content/`, una cada vez y por pasos). **Todas las fija alguna spec
viva**, y la columna "Delta necesario" dice cuál habría que actualizar (spec run-outcome: "todo valor de contenido que
una spec viva fije… MUST actualizarse en una spec delta"):
| # | Palanca | Pasos | Límite | Delta necesario | Por qué va en este orden |
|---|---|---|---|---|---|
| P1 | `goblin-tnt.health` 45 | −5 | 30 | enemy-spawning "Stats heredados sin cambios"; auto-weapons (impactos para matar al `goblin-tnt`) | Solo aparece desde el segundo 180: **no toca el invariante del quieto**. Es el tipo que más frena al bot en los puentes |
| P2 | `goblin-tnt.damage` 15 | −1 | 10 | enemy-spawning "Stats heredados sin cambios" | Mismo argumento; reduce los golpes castigados en los cuellos de botella |
| P3 | `strict-rules.perLevel` (daño del arco) 3 | +1 | 5 | upgrades (Linter con `damage` 9/21); enemy-spawning (escenario con `strict-rules` nivel 1) | La mejora la aprovecha más quien sube más de nivel (el bot); el quieto apenas recoge gemas |
| P4 | `progression.xpGrowth` 5 | −1 | 3 | leveling "Curva por defecto" | Más subidas para quien recoge; afecta al quieto antes de 180 s, por eso va después |
| P5 | `goblin-barrel.health` 20 | −2 | 14 | enemy-spawning "Stats heredados"; auto-weapons (impactos para matar al `goblin-barrel`) | Aparece desde el segundo 60 y afecta al quieto: es la última |

**Medir y fijar son pasos distintos**: el barrido (script no versionado) no cambia ningún fichero versionado. Antes de
fijar en `content/` una configuración que cambie un valor de la columna "Delta necesario", el implementer **se para y
avisa al orquestador**, con la tabla de lotes y los valores elegidos, para que `sdd-spec-writer` añada esos deltas.
Solo después actualiza el contenido y los tests afectados.

Quedan **excluidas** las oleadas (`waves.segments`, `maxBudget`), `player.speed` y la mejora `shortcuts` (velocidad:
mismo efecto no monótono que `player.speed`), además del anillo de aparición y `maxAlive` (fijado en 300).

**Procedimiento** (un lote = bot v2 en las semillas 1..50 + quietos con mapa generado y vacío a 10.800 ticks + plazos
de la semilla 7/42):
1. Con la implementación en verde y el contenido sin tocar, se mide la base con `maxAlive` 300 (dato nuevo: el
   prototipo medía con 200).
2. Se recorre P1 paso a paso. Tras cada paso se anotan las victorias, los quietos supervivientes y los plazos. Si un
   paso no mejora o empeora en más de 3 (el ruido medido es de ±3–4), la palanca se considera no monótona: se vuelve
   al último valor bueno y se pasa a la siguiente.
3. Al llegar al límite de una palanca sin entrar en la banda, se mantiene su mejor valor y se sigue con la siguiente
   (efecto acumulado).
4. **Aceptación**: la primera configuración con **27–33 victorias** (centro de la banda, con margen para el ruido),
   0 quietos vivos en los dos mapas y plazos de primera oferta, golpe y pulso ≤ 4.800 y de primera baja ≤ 900. Si al
   agotar las palancas solo hay configuraciones en 25–26 o 34–35, se acepta la más cercana a 30 y se anota.
5. **Criterio de parada**: como máximo **15 lotes**, o todas las palancas en su límite. Si ninguna configuración
   cumple 25–35 con 0 quietos en los dos mapas, o si cumplir la banda rompe un plazo de la spec, **se para la apply
   antes de verify y se consulta al usuario** (spec run-outcome: "la decisión vuelve al usuario"), con la tabla de
   mediciones. No se relaja la banda y no se tocan oleadas ni `player.speed` sin su aprobación.
   Plazos con la semilla 7 (spec "Plazos del jugador quieto con el contenido final"): primer golpe, pulso y oferta
   ≤ 4.800 y primera baja ≤ 900. El test actual mide el primer golpe con la semilla 42 y se añade el de la 7.
6. El barrido se hace con un script no versionado (en el directorio temporal) que usa `tests/support/runs.ts`. La
   tabla de lotes se copia al diario de IA y el resultado final a la spec `run-outcome` (tasa, plazos medidos) y al
   addendum de resultados de ADR-0017.

### Resultado de la calibración (apply, 2026-11-24)
Base real con `maxAlive` 300: **12/50**, no 18 como en el prototipo. 18 lotes en total: 15 del procedimiento y 3
más aprobados por el usuario, solo con la curva de XP. Columnas: victorias del bot / quietos vivos en el mapa
generado / quietos vivos en el vacío.
| Lote | Configuración | Victorias | Quietos gen. | Quietos vacío |
|---|---|---|---|---|
| 1 | base | 12 | – | – |
| 2–4 | `tnt.health` 40 / 35 / 30 | 15 / 15 / 14 | – | – |
| 5–9 | tnt 40 + `tnt.damage` 14 / 13 / 12 / 11 / 10 | 15 / 16 / 16 / 16 / 16 | – | – |
| 10–11 | tnt 40/13 + `strict-rules` 4 / 5 | 31 / 33 | 44 / 6, 42, 44 | 37 / 17, 37 |
| 12–13 | tnt 40/13 + `xpGrowth` 4 / 3 | 30 / 37 | 27 / – | – |
| 14–15 | `xpGrowth` 3 / + `tnt.health` 40 | 38 / 37 | – | – |
| 16 | `xpGrowth` 3, `baseXp` 7 | 30 | 37 | 25 |
| **17** | **`xpGrowth` 3, `baseXp` 9** (elegido) | **26** | – | – |
| 18 | `xpGrowth` 4, `baseXp` 6 | 26 | – | 28 |

Contenido final: solo la curva (`baseXp` 9, `xpGrowth` 3; delta de `leveling`). Plazos del quieto con la semilla 7:
primer golpe 2.276, pulso 1.524, oferta 2.082 y baja 728; con la 42, primer golpe 2.442. 26 está en la banda, pero
fuera del margen 27–33: aceptado como la configuración más cercana a 30 que cumple las demás condiciones (paso 4).

## 7. Rendimiento
- Presupuesto: tick medio ≤ 2 ms con 300 vivos (bench, informativo, fuera de `verify`), y recálculo del campo
  ≤ 0,1 ms. Medido en el prototipo: BFS de 0,022 ms de media y 0,025 ms en p95; tick con 300 vivos de 0,027 ms. El
  coste nuevo dominante es la línea libre: ≤ 300 × ~50 celdas por tick, con salida temprana.
- Cero asignaciones por tick: `dist`, `queue` y `codes` se reservan una vez por partida; el `out` de `steer` es un
  campo de `Horde`; `steer` no crea `Vector2`.
- Bench (`tests/bench/run.bench.ts`, escenarios de simulation-loop): `CAP` = 300 en todos los casos. "Tope de vivos
  alcanzado" con mapa generado (`startSeededRun`). "300 enemigos sin línea libre": 300 `bench` repartidos en la
  orilla contraria del río de un mapa generado, con el jugador quieto, y la gemela comprueba que ≥ 150 no tienen línea
  libre en cada tick. "Jugador que cambia de celda en cada tick": jugador ante la puerta (fila 19, libre por la zona
  de inicio) con `speed` 3.600 (60 px por tick) e input alterno (1, 0) / (−1, 0), de modo que cambia de celda en cada
  tick (la spec dice "colocado por el escenario": se interpreta como velocidad de escenario; si el verifier lo ve
  distinto, se ajusta la redacción). En `map.bench.ts`, "Cálculo del campo": `distanceAt` tras `retarget` hacia la
  salida y hacia (0, 0) en los mapas 1..50.
- Render: con 300 sprites animados (el spike medía 200 a ~165 fps) el riesgo es bajo. Se comprueba a demanda con el
  proyecto `realtime`, no en el gate (chore `e2e-lite`).

## 8. Seguridad y datos
No cambian los datos persistidos (récords e historial) ni las entradas externas. El contenido modificado sigue
pasando por el mismo esquema zod; `maxAlive` 300 es un `Count` válido.

## 9. Tests afectados (para tasks)
- `map-independence.test.ts`: desaparecen "Los enemigos ignoran el mapa" y "Misma trayectoria". "Mismos spawns con y
  sin mapa" admite posiciones recolocadas. xp-gems: los escenarios de bajas sobre troncos y castillo no cambian,
  porque esos enemigos están en celdas sin distancia y persiguen en línea recta como reserva, o tienen velocidad ~0.
- Coste de `verify`: los barridos de 50 semillas (7.200 ticks con input aleatorio y 3.600 quieto) se suman al test
  de balance. Se agrupan en un solo fichero con un `beforeAll` por barrido y un *timeout* propio, como `balance.test.ts`.
- `enemy-behavior`: los escenarios de "ignoran el mapa" se sustituyen por: puente único, rodeo de un tronco y del
  castillo, línea libre, celda del jugador, empate por el orden de vecinos y determinismo (mismo campo con caminos
  distintos hasta la misma celda).
- `place-spawn`, `long-run` (200 → 300), `run-config` (`maxAlive` 300) y `content.test` si comprueba el valor.
- Ninguna aparición en celda bloqueada en las semillas 1..50 (test de aplicación con `seededRun`).
- Los E2E no cambian (`map=empty` por defecto). Si un E2E con `map: 'real'` mide tiempos, se revisa y no se añade
  ninguno nuevo.

## 10. GDD (renumeración, en este change)
`docs/gdd.md` (la tarea de docs; si se delega, la hace `game-designer`): 0018 map-culling pasa a la tabla y a la lista
de hechos. "Navegación por campo de flujo" pasa de 0018 a **0019** (líneas 118, 128, 159, 167, 198). El bloque Should
0019–0023 pasa a **0020–0024** (líneas 17, 57, 119, 124, 128, 199–203). El criterio "Given un edificio nuevo…" de la
historia del campo de flujo se mueve a build-sites (**0024**). En la línea 246, la deuda "sin separación" deja de
saldarse con el campo de flujo y queda "pendiente, change propio". Los números de línea son orientativos: antes de
editar hay que buscar "0018"–"0023".

## ADRs
- **Nueva** `docs/adr/0017-navegacion-por-campo-de-flujo.md`: es una decisión estructural (un servicio nuevo en el
  núcleo y reglas nuevas en el contrato de determinismo). Un addendum a ADR-0013 mezclaría la navegación con la
  geometría y el azar del mapa. En ADR-0013 solo se añade un puntero ("deuda saldada por ADR-0017").
