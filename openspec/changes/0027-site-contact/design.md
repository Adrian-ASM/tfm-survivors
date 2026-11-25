# Design · 0027-site-contact

## Resumen
Al crear la partida, la huella de cada solar libre se marca en la **capa de obra** de `GameMap` con el código
`BUILT` que ya existe (ADR-0025). Desde el tick 0 es un obstáculo para todo lo que lee la caminabilidad, sin
tocar `typeAt` ni la colocación. El punto de acceso y su `ProximityGate` desaparecen. Cada `BuildSite` tiene un
armado propio que se dispara al **tocar** la huella: el hueco entre el círculo del jugador y el rectángulo de la
huella es ≤ `CONTACT_EPS` (1 px, constante de dominio). Se re-arma por histéresis cuando ese hueco llega a
`contact.rearmDistance` (64 px, `buildings.json`). La oferta se abre siempre y lleva las dos opciones con
`affordable` y lo que falta. El `BuildPanel` pinta las dos con iconos `<img>` de las hojas del HUD.

Vía de la API de Phaser: **no aplica**. El change no usa ninguna API nueva del motor. El panel es DOM y los iconos
son `<img>` con la URL de la hoja que ya carga `BootScene` (`composition/assetUrl`). No se consultó `phaser-docs`.

Numeración del ADR: **ADR-0026**, comprobado libre en `origin/main` por el orquestador.

## 1. Decisiones

### 1.1 Código de celda: se reutiliza `BUILT` (5), sin `SITE` 6
- Ningún consumidor del mapa necesita distinguir un solar libre de un edificio. El estado lo guarda `BuildSite`
  (`free | house | tower`), no el mapa. Los lectores de `isBuilt`/`isBuiltAt` (despeje de enemigos, `PickupField`,
  origen de las ovejas, `GuardPost.evict`) **deben** tratar el solar libre igual que el edificio, porque los dos
  son obstáculos.
- A partir de ahora `BUILT` se lee como "celda de la **capa de obra** (solar o edificio)". Se reescribe el
  docstring de `CellType.BUILT`, `GameMap.build`/`isBuilt` y ADR-0025 (addendum en ADR-0026). Los nombres no
  cambian para no tocar ~23 referencias de tests sin motivo.
- Con `SITE` 6 habría que tocar `isWalkableCode`, `FlowField.hasBlocked`, el despeje y `isBuilt` para tratar dos
  códigos que significan lo mismo para todos. Se descarta (C1 de la exploración).

### 1.2 Marcado al empezar, revisión y campos de flujo
- `Run.start`, tras `initialState` y antes de `new Run` (el orden del prototipo medido), llama a
  `map.build(col,row,cols,rows)` por solar, en orden de id. El terreno, `MapSnapshot.cells` y las firmas no
  cambian. `revision` = n.º de solares (6 en el mapa generado).
- **`GameMap.build` solo sube `revision` si cambia alguna celda.** Así se cumple el contrato que ya documenta
  (`revision` cambia si y solo si cambia la caminabilidad). Construir sobre un solar ya marcado (huella del
  edificio = huella del solar, §1.6) no la sube y no recalcula ningún campo. `Run.raise` sigue llamando a
  `map.build`: es idempotente y robusto si un día las huellas difieren.
- `FlowField` y los `GuardPost` no cambian: el primer `sync()` ve la revisión del marcado (o ya nace con ella) y
  calcula `blocked`. En el mapa generado ya había BFS por troncos y agua. En `open` con solares declarados, la
  persecución pasa a BFS (es lo que pide la spec).
- **`Flock.ts:254`**: se quita la guarda `map.revision > 0`. La reaparición descarta siempre las celdas base cuyo
  círculo solapa una celda no caminable (`overlapsBlocked`). En el mapa generado equivale exactamente al prototipo
  medido (revisión 6 > 0). Esa guarda solo existía para que 0026 no cambiara nada con 0 obras, y ahora el estado
  "sin obra" ya no existe en el mapa generado. En `open` sin celdas bloqueadas no cambia nada.

### 1.3 Arranque: validaciones y despeje inicial
Orden en `Run.start` (corregido tras contrastar las specs delta, ver §8): `initialState` → marcado → jugador →
ovejas declaradas → `new Run` → despeje inicial → `prebuild`.
- **Jugador**: si el círculo del jugador en su posición inicial **solapa** (distancia < radio; la tangencia,
  g = 0, es legal) la huella de **cualquier** solar, devuelve `err(MAP_SITE_OVERLAPS_PLAYER)` con
  `map.sites.<i>` (el error nombra el solar, spec "Solar declarado sobre el jugador"). La constante vive en
  `resolveSites.ts`. `SETUP_SITE_OVERLAPS_PLAYER` y su comprobación en `prebuild` desaparecen: un solar de
  `RunSetup.sites` es un solar del mapa y ya lo cubre esta regla. En el mapa generado nunca pasa
  (`minStartCells` 6). Va tras `initialState` porque la posición inicial sale de `initialPlayer`, y tras el
  marcado no se puede delegar en `SETUP_PLAYER_ON_BLOCKED_CELL`, que nombraría `setup.player`.
- **Ovejas declaradas**: tras marcar, cada oveja declarada (`open`/`cells`) se vuelve a validar con
  `isLegalSheepAt` sobre la capa de obra. Si solapa una huella, `err(MAP_SHEEP_ILLEGAL)` con `map.sheep.<i>`
  (spec "Oveja declarada sobre el solar libre": el error nombra la oveja; tangente se crea). **No** se recolocan.
- **Puerta**: se **retira** `MAP_SITE_COVERS_DOOR`. Ninguna spec lo pide y un mapa declarado no tiene que
  cumplir la conectividad (`procedural-map`, "Mapa explícito y mapa vacío"). `resolveSites.fits` deja de
  comprobar el acceso: solo exige que la huella quepa en la rejilla (`MAP_SITE_OUTSIDE`, texto sin "acceso").
- **Despeje inicial**: tras marcar, `Run` aplica una vez `clearFootprint`. Recoloca enemigos y recogibles de
  `RunSetup` y puestos y puntos de patrulla de guardia (`GuardPost.evict`) que hayan quedado en una huella
  (spec "Punto de patrulla sobre el solar libre": fuera de la huella desde el nacimiento). Las ovejas no llegan
  aquí (ya validadas). No consume azar. En el mapa generado no hace nada, porque la zona del solar excluye
  estructuras y puertas, vetas, montones y ovejas iniciales, y `minStructureCells` 4 es mayor que el radio de
  patrulla. Lo cubre el test de las 50 semillas ("Nada en las celdas de obra").
- **`RunSetup.sites[i].armed`** (nuevo, opcional, por defecto true): solo escenarios preparados. Con
  `armed: false` y `withRearm(1e6)` se obtienen los "solares que empiezan desarmados y no se arman nunca" de la
  spec "La política de obra fija no cambia la partida" (`simulation-loop`).

### 1.4 Contacto y re-armado (dominio, sin azar)
- `hueco(site, x, y, r) = hypot(ex, ey) − r`, con `ex`/`ey` la distancia del centro al intervalo de la huella en
  cada eje. Es la `gap` de `GameMap`, y los bordes se recortan al mundo como en `cellRect`. `BuildSite` precalcula
  `left/top/right/bottom` al construirse, para lo que recibe `width`/`height` del mapa.
- **Tocar**: `hueco ≤ CONTACT_EPS`. `CONTACT_EPS = 1` (px) es una constante exportada de `BuildingRules.ts`. No
  es contenido. El barrido deja al jugador tangente (`hueco ≈ 0`, con un error de float de ~1e-12), así que vale
  igual en caras y esquinas.
- **Re-armado**: desarmado y `hueco ≥ contact.rearmDistance` ⇒ armado. Como zod y `BuildingRules` exigen
  `rearmDistance > CONTACT_EPS`, en un paso nunca pasan a la vez la apertura y el re-armado. X se mide **desde el
  borde del jugador** (hueco), confirmado por la spec: la separación g es la distancia del centro al rectángulo
  cerrado de la huella menos el radio, tocar es g ≤ ε y re-armar es g ≥ X (`build-sites`, vocabulario).
- **`ProximityGate` no se usa en los solares**: la tienda se queda con él. Se descarta un `ContactGate` genérico
  porque solo tendría un usuario. El armado vive en `BuildSite` (`armed`, `touch(x, y, r, canOpen): boolean`), con
  la misma semántica que `ProximityGate.step`: armado y sin `canOpen` sigue armado.
- `Settlement.step(x, y, r, canOpen, m)`, paso 12, en orden de id:
  - re-arma todo solar libre que proceda;
  - el primer solar libre, armado y tocado, con `canOpen` y sin otro abierto en el paso, abre la oferta y se
    desarma;
  - **ya no exige nada asequible**;
  - se mantiene: como mucho uno por tick, la prioridad del paso 10 (mejora) y del 11 (tienda) a través de
    `canOpen = status === 'running'`, y nada en el tick final.
- Si dos huellas se tocan a la vez (solo en mapas declarados), se abre la de menor id. La otra sigue armada y se
  abrirá en el primer tick en curso en que siga tocada. Es coherente con "uno por tick".

### 1.5 Oferta: siempre las dos opciones
- `Settlement` fija la oferta al abrirse: `BUILDING_KINDS` en orden (`house`, `tower`), cada uno con
  `{ kind, wood, stone, affordable, missing: { wood, stone } }`, donde
  `missing.x = max(0, coste.x − stock.x)`. Mientras está abierta no cambian ni el stock ni el coste, así que la
  oferta queda fija.
- `Run.build(kind)`: `not-building` → `unknown-kind` → `not-affordable` (por `canAfford`/`spendMaterials`, ya no
  por `offered.includes`). Un rechazo no cambia nada.
- `BuildOptionSnapshot` gana `affordable` y `missing`. `toBuildSnapshot` no cambia de forma.

### 1.6 Qué se borra del acceso
| Sitio | Cambio |
|---|---|
| `content/buildings.json` | `access {radius, rearmDistance}` → `contact { "rearmDistance": 64 }` |
| zod (`schemas.ts`) | `access` → `contact: z.strictObject({ rearmDistance: z.number().gt(CONTACT_EPS) })`, mensaje `CONTACT_REARM_MUST_EXCEED_EPS` |
| `BuildingRules` | Fuera `access`, `checkAccess`, `ACCESS_OFFSET_CELLS` y `ACCESS_*`, incluida la regla cruzada con `playerRadius`. Entra `contact` + `CONTACT_EPS` (la misma regla que zod, una sola implementación desde el superRefine) |
| `BuildSite` | Fuera `access` y `gate`. Entran `armed`, `touch` y el rectángulo de la huella |
| `MapSnapshot.sites` | Fuera `access` (quedan id, col, row, cols, rows, x, y) |
| `RunSnapshot.sites` | Fuera `access` (quedan id, state, armed, house, tower) |
| Sonda E2E | `map.sites[].access` desaparece con el snapshot. `__sprint.sites.options` pasa a llevar `affordable` y `missing` |
| `placeSites` | **No cambia de comportamiento** (`SITE_GOLDEN` intacta). La fila r+3 se queda en la zona libre (proposal: quitarla cambiaría la firma, queda fuera). `accessCellOf` → `routeCellOf` y `ACCESS_HALF` → `ROUTE_CELL_HALF`, con docstring de "celda de referencia de colocación y ruta", sin papel en el juego. Es un renombrado puro |

**Huella del edificio = huella del solar**: `BuildingRules` ya tiene una sola `sites.footprint`. No queda ninguna
celda libre del solar al construir, así que no hay que decidir qué pasa con ella.

### 1.7 Bots
- `botWorld(config, map)` marca en su `GameMap` las huellas de `map.sites`, las mismas que el núcleo. Los bots v4
  y v5 huyen de ellas y las rodean desde el tick 0. `builderBot.syncBuilt` desaparece, porque las huellas ya
  están marcadas.
- **v4**: no cambia de política. Cada oferta que se abra al rozar un solar la cierra `chooseWhileOpen`, que ya
  llama a `leaveSite`. Abrir y salir no consumen ni ticks ni azar.
- **v5, objetivo de contacto**: por cada solar libre y armado, la celda objetivo es
  `(col + ⌊cols/2⌋, row + rows)`, la celda del anillo justo bajo la huella, que en el mapa generado siempre es
  `grass`. El punto objetivo es `(x del centro, (row + rows) · cellSize)`, en el borde inferior. Se elige el de
  menor distancia de ruta a esa celda (`routeField`), con desempate por id. Si la distancia es −1, el solar se
  salta.
  - Dentro de la celda objetivo, `steer` devuelve el punto y el barrido deja al jugador tangente: hueco 0 y
    contacto.
  - Es lo que midió el prototipo: v5 34/50.
- `REFERENCE_BUILD_POLICY` filtra por `affordable`: torre si es asequible, si no casa, y si no `null`, que hace
  salir. El v5 puede rozar solares que no puede pagar al huir: se abre la oferta y sale.

## 2. Piezas por capa
| Capa | Pieza | Nueva/Mod. | Notas |
|---|---|---|---|
| domain | `CellType.BUILT` | Mod. (doc) | "Celda de la capa de obra: solar libre o edificio" |
| domain | `GameMap.build` | Mod. | `revision` +1 solo si cambia alguna celda (§1.2) |
| domain | `BuildSite` | Mod. | Sin `access`/`gate`. `armed` (nace armado), rectángulo de la huella recortado al mundo, `gap(x,y,r)` y `touch(x,y,r,canOpen)` con re-armado por `contact.rearmDistance` (§1.4) |
| domain | `BuildingRules` | Mod. | `contact.rearmDistance` > `CONTACT_EPS`. Fuera el acceso (§1.6) |
| domain | `Settlement` | Mod. | `step` con radio del jugador y apertura sin asequibilidad. `offered` → opciones con `affordable`/`missing` (§1.5) |
| domain | `siteSnapshots`, `RunSnapshot`, `MapSnapshot` | Mod. | Fuera `access`. `BuildOptionSnapshot` + `affordable`, `missing` |
| domain | `resolveSites` | Mod. | `fits` solo de la huella. Nuevo `MAP_SITE_OVERLAPS_PLAYER` (`map.sites.<i>`) |
| domain | `RunSetup` | Mod. | Fuera `SETUP_SITE_OVERLAPS_PLAYER`. `sites[i].armed?` (escenarios) |
| domain | `resolveSheep` | Mod. | Revalidación de las ovejas declaradas tras el marcado (`map.sheep.<i>`) |
| domain | `placeSites` | Renombrado | `routeCellOf`. Sin cambio de comportamiento |
| domain | `Run` | Mod. | Marcado y despeje inicial en `start`. `SETUP_SITE_OVERLAPS_PLAYER` para todo solar. `build` rechaza por `canAfford`. Paso 12 con `player.radius` |
| domain | `Flock.spawnAway` | Mod. | Sin la guarda `revision > 0` (§1.2) |
| application | `BuildOnSite`, `LeaveSite` | Sin cambios | Ya devuelven el error tipado |
| infrastructure | `schemas.ts` (`BuildingsSchema`) | Mod. | `contact` en lugar de `access` |
| infrastructure | `dom/BuildPanel` | Mod. | §3 |
| infrastructure | `dom/resourceIcons` | Nueva (función pura) | `(appearance, assetUrl) → { wood, stone }` con la URL de `pickups.wood` (`W_Idle`, frame 0) y de la roca `medium` de `pickups.stone` (`Deco/05`), las mismas que usa `counterIcon`. Test sin navegador |
| infrastructure | `dom/menuText` | Mod. | `buildMissing(n)` → «faltan N». `buildWood`/`buildStone` pasan a `madera`/`piedra` y son el `alt` de los iconos |
| infrastructure | `styles.css` | Mod. | §3 |
| composition | `main` / `contentBoot` | Mod. | Pasan `resourceIcons(appearance, assetUrl)` al `BuildPanel` |
| tests/support | `botWorld`, `builderBot`, `REFERENCE_BUILD_POLICY`, `sites.ts` | Mod. | §1.7. `TEST_ACCESS`, `NEAR_ACCESS`, `withSiteAccess` y `dAccess` se sustituyen por ayudas de contacto (`touchPoint(site, lado)`, `withRearm(x)`) |

## 3. BuildPanel (infraestructura, CSP `style-src 'self'; img-src 'self' data:`)
- **Iconos**: `<img class="resource-icon resource-icon--wood" alt="madera">` (`alt` en minúscula, `madera` y
  `piedra`, como pide la spec) con `src` = URL de la hoja (la misma
  ruta `BASE_URL + assets/tiny-swords/…` que carga Phaser). Se cumple `img-src 'self'`, sin `data:` y sin estilos
  inline.
  - El recorte al frame 0 va en CSS: caja cuadrada, `object-fit: cover` y `object-position: 0 50%`. Las dos hojas
    son de una fila (`W_Idle` 128 × 128, `Deco/05` 64 × 64).
  - `image-rendering: pixelated`. Tamaño de `2em`, que escala con `--ui-scale`.
  - Si la hoja no carga, el navegador muestra el `alt`, así que el panel se sigue leyendo.
  - Se descarta generar una `data:` URL desde la textura de Phaser: acopla el DOM a la escena y al momento de la
    carga.
  - **Procedencia**: no entra ningún asset nuevo. `W_Idle` y `Deco/05` ya tienen entrada en
    `asset-provenance.json` (0022 y 0025).
- **Estructura por opción**: es un `button.build-panel__option` (`data-building`) con `span.build-panel__name` y
  `span.build-panel__cost`. El coste tiene un `span.build-panel__amount` por recurso **con coste > 0** (icono +
  número; un coste 0 no se pinta, así la casa por defecto solo muestra madera), con `.is-short` (rojo) y un
  `span.build-panel__missing` («faltan N», N = coste − saldo) solo en el recurso que no alcanza.
  - Ningún elemento lleva atributo `style` (CSP); todo va por clases.
  - Medidas que comprueba el E2E: icono ≥ 20 × 20 px (2em con la fuente base del panel a ×1) y ≥ 8 px entre el
    nombre y el coste (`column-gap` 1,25em).
  - Siempre hay dos botones, casa y torre.
  - El que no se puede pagar lleva `.is-unavailable`, `disabled` y `aria-disabled`. Un clic sobre él no deja
    acción.
- **Saldo**: la línea `build-panel__stock` muestra icono y número de madera y de piedra, con el mismo `amount`.
- **CSS**:
  - `.build-panel`: `min-width: 18em`.
  - `.build-panel__option`: `display: grid; grid-template-columns: 1fr auto; column-gap: 1.25em;
    align-items: center`. Se acaba el "Casa15".
  - `.build-panel__cost`: `inline-flex`, `gap: 0.75em`.
  - `.build-panel__amount`: `inline-flex`, `gap: 0.25em`.
  - `.is-unavailable`: `opacity: 0.55; cursor: not-allowed`, el patrón de la tienda.
  - `.is-short`: un color de error del tema.
- **Sonda**: `BuildPanelView.options[]` = `{ kind, wood, stone, affordable, missing }`.
- **Tests**: DOM en `build-panel.test.ts` (dos opciones siempre, clases, «faltan N», `alt` y `src`) y
  `resource-icons.test.ts`.

## 4. Flujo de un tick (solo cambia el paso 12)
```
1 jugador (barrido: las huellas de los solares ya bloquean) → ovejas → 2 comportamientos (FlowField)
… 3–11 sin cambios …
12 solares, en orden de id, con (x, y, r) del jugador:
   libre y desarmado y hueco ≥ rearmDistance → armado
   libre y armado y hueco ≤ CONTACT_EPS y status = running y nadie abrió en el paso
     → desarmado, oferta {house, tower} con affordable/missing, fase building
```
`build`/`leaveSite` no cambian (entre ticks, sin azar). Construir ya no cambia la caminabilidad (§1.2), pero
`clearFootprint` sigue ejecutándose: los enemigos ignoran el mapa al moverse y pueden estar sobre la huella libre.

## 5. Balance, firmas y lotes
- Lo cambian el bloqueo desde el tick 0 y que los bots vean las huellas. La apertura no, porque no consume ni
  ticks ni azar. Prototipo: v4 34/50, v5 34/50 y 0 quietos (muerte más tardía en el tick 6.067).
- Se regeneran `BALANCE_BASELINE` (v4), la referencia del v5 y los conteos exactos que dependen de la partida.
- **Firmas**: solo `STONE_GOLDEN`. `MAP`, `STRUCTURE`, `RESOURCE`, `SHEEP` (son las ovejas iniciales) y
  `SITE_GOLDEN` no cambian, porque ni el terreno ni la colocación cambian.
- **Riesgo**: v4 está a 1 victoria del techo (35). Este design reproduce el prototipo en todo lo que toca a la
  simulación del v4: mismo orden de marcado y mismo filtro de ovejas. Si apply lo saca de banda, se vuelve a
  propose (criterio de la proposal).
- **Lotes**: 37,7 s (v4) y 43,9 s (v5) en local, unos 105/123 s proyectados a CI (×2,8) con un tope de 180 s. El
  paso 12 añade 6 × (2 restas + `hypot`) por tick, despreciable. El BFS por el marcado es una vez por partida,
  porque construir ya no lo invalida. El verify-report anota los tiempos.

## 6. E2E (ligeros)
**0 nuevos.** Se amplía el existente "Construir una casa en el juego real" (`gameplay.spec`, `?e2e&manual&seed=42`,
`map: 'real'`):
- La ruta de `routeFrom`/`walk` trata como bloqueadas las huellas de `map.sites`.
- El test camina a la celda bajo la huella del solar más cercano y empuja hacia arriba hasta abrir.
- Con 15 de madera comprueba que el panel muestra casa y torre, con la torre `.is-unavailable` y «faltan»
  (`sites.options[1].affordable === false`).
- Construye la casa.

El resto de escenarios de apertura y re-armado se cubren en el dominio, y los del panel en DOM.

## 7. Documentación
- GDD: entrada 0027 `site-contact`. Se renumeran `goblin-tower-archers` → 0028 y `characters` → 0029, y también
  `balance-pass-2` y "bloque 0020-0028" (líneas en `exploration.md`).
- AGENTS.md §1: párrafo de 0027 al archivar.
- ADR-0025: nota "matizada por ADR-0026".

## Dependencias nuevas
| Paquete | Versión exacta | Motivo | Alternativa descartada |
|---|---|---|---|
| — | — | Ninguna | — |

## Rendimiento y seguridad
- Presupuesto: < 0,01 ms/tick añadidos (contacto de 6 solares). El marcado inicial es O(celdas de 6 huellas), con
  un recálculo de campos en el primer tick. Construir ya no recalcula campos. El bench `run-tick-buildings` no
  debería moverse.
- Objetos del mapa sin cambios (737/820): el arte del solar no cambia.
- Datos persistidos: ninguno. Entrada externa: solo `buildings.json` (`contact`), validado con zod y
  `BuildingRules`.
- CSP: los iconos son `<img>` same-origin, sin `style=`, sin `data:` y sin dependencias.

## 8. Contraste con las specs delta (tras escribirlas)
Specs: `build-sites` (70 escenarios), `procedural-map` (17), `enemy-behavior` (6), `player-movement` (2), `sheep` (2)
y `simulation-loop` (4). Correcciones aplicadas arriba:
1. **Separación g** (§1.4): confirmada la fórmula del borde; se quita la alternativa "desde el centro".
2. **Jugador sobre un solar** (§1.3): `MAP_SITE_OVERLAPS_PLAYER` con `map.sites.<i>` (antes
   `SETUP_SITE_OVERLAPS_PLAYER` con `setup.sites.<i>`); tangente legal.
3. **`MAP_SITE_COVERS_DOOR`** retirado: no lo pide ninguna spec.
4. **Oveja declarada en una huella** (§1.3): error `map.sheep.<i>`, no recolocación.
5. **Política de obra fija** (§1.3): la comparación es con "solares desarmados que no se arman nunca", no con la
   partida sin solares; se añade `RunSetup.sites[i].armed`.
6. **Panel** (§3): coste 0 no se pinta; `alt` `madera`/`piedra`; sin `style`; icono ≥ 20 px y hueco ≥ 8 px.
7. **Reaparición de ovejas** (§1.2): sin la guarda `revision > 0`; la celda candidata excluye las de obra.
   Con radio 20 < media celda, el filtro del círculo (`overlapsBlocked`) equivale a "celda caminable".
8. **`player-movement`**: sin pieza nueva; el barrido por ejes ya lee la capa de obra.
9. **Referencia del v5**: la spec exige que las victorias coincidan con una referencia versionada; hoy solo se
   comprueba la banda. Se añade `BUILDER_REFERENCE` en `tests/support/balanceBaseline.ts`.
10. **Quieto**: también con el mapa vacío (la proposal solo citaba el generado); el test ya lo hace.
11. Proposal vs specs: criterios de éxito alineados (bandas, quieto, 737/820, solo `STONE_GOLDEN`, 180 s,
    sonda sin `access`, panel con «faltan N»).

## ADRs
- `docs/adr/0026-solar-bloqueante-y-oferta-por-contacto.md`: la capa de obra incluye los solares libres desde el
  tick 0 (con `BUILT`), la revisión solo cambia con la caminabilidad, la oferta se abre por contacto con
  histéresis y sin exigir nada asequible, y se retira el punto de acceso. Matiza ADR-0025.
