# Design · 0022-resources-sheep

> Base: `proposal.md` aprobada tal cual (2026-11-24) y las 9 specs delta del change (`specs/`), contrastadas una a una
> (§12). Decisiones del gate: veta "al pasar" (una vez, queda agotada, no bloquea ni es objetivo); sin `meat`; el
> barril que detona su propia mecha **no** suelta madera; oro y madera no salen en resultados ni se guardan.
> Revisión 2: la primera versión se escribió antes que las specs; esta sigue a las specs (lista única de recogibles,
> una secuencia de ids, `gemRadius` común, vetas de una celda, XP como forma de color).

## Resumen
Todo lo que se recoge del suelo pasa a ser un **recogible** con tipo cerrado `xp | gold | wood`, valor, posición,
radio `gemRadius` común e id de **una sola secuencia**, en **una sola lista** en orden de creación. El tope y el
relleno ("suma al más antiguo de su tipo") son **por tipo**, así que la XP conserva su tope de 300 y nunca compite
con oro ni madera: el combate, la XP y el balance no cambian. Un `Stockpile` en `Run` cuenta oro y madera. Fuentes,
todas fijas y sin azar de partida: madera del barril abatido (no del que explota), oro de casas y torres al quedar en
ruina, montones de madera (recogibles `wood` desde el tick 0) y vetas (entidad fija de una celda que entrega su oro al
contacto una vez). Montones y vetas los coloca un cuarto flujo `RESOURCE_STREAM` 4. Render con un pool de sprites de
recogibles, vetas en el plan del mapa con el recorte de 0018 y HUD con dos contadores.

## 1. Piezas por capa

| Capa | Pieza | Nueva/Mod. | Notas |
|---|---|---|---|
| domain | `pickup/PickupKind.ts` | Nueva | Unión cerrada `'xp' \| 'gold' \| 'wood'` y `PICKUP_KINDS`. |
| domain | `pickup/Pickup.ts` | Mod. (ex `XpGem`) | Registro mutable de pool (ADR-0003/0006) con `kind`, `value`, `attracted`, `collected`. |
| domain | `pickup/PickupField.ts` | Mod. (ex `GemField`) | Lista única en orden de creación, pool libre compartido de `Σ topes`, contador de activos por tipo, una secuencia de ids. `drop(kind, x, y, value)`, `step(px, py, pr, reach, out)` (§3). |
| domain | `pickup/PickupRules.ts` | Mod. (ex `GemRules`) | `gemRadius`, `magnetSpeed`, `maxGems`, `maxGold`, `maxWood` (todo de `progression.json`). |
| domain | `resource/Stockpile.ts` | Nueva | Contadores `gold`, `wood`: enteros, empiezan en 0, solo suben. Interno a `Run`. |
| domain | `resource/GoldVein.ts` | Nueva | Entidad: id, celda, centro, radio de contacto, oro, `depleted`. `tap(px, py, pr): number`. |
| domain | `resource/ResourceRules.ts` | Nueva | VO de `resources.json` (§2), con los drops resueltos contra el catálogo de enemigos y los tipos de estructura. |
| domain | `resource/placeResources.ts`, `resolveResources.ts` | Nuevas | Colocación pura con su generador (§4); declarados en `open`/`cells`; ninguno en el mapa vacío. |
| domain | `map/chebyshev.ts` | Nueva (extraída) | `chebyshevFrom` sale de `placeStructures.ts` sin cambios; la usan estructuras y recursos. |
| domain | `structure/placeStructures.ts` | Mod. | Importa `chebyshevFrom`. `STRUCTURE_GOLDEN` vigila que nada cambie. |
| domain | `structure/Structure.ts`, `StructureField.ts` | Mod. | `settle(onRuin)`: avisa, en orden de lista, de cada estructura que queda destruida **en este tick**. |
| domain | `enemy/Enemy.ts` | Mod. | `explode()` marca además `detonated` (solo lo marca la propia mecha). |
| domain | `map/TerrainSource.ts` | Mod. | `generated` gana `resourceRandom` (obligatorio); `open`/`cells` ganan `resources?: { veins?: Point[]; woodPiles?: Point[] }`. |
| domain | `map/MapSnapshot.ts` | Mod. | `veins` (id, x, y, celda) y `woodPiles` (x, y) en orden de colocación. Estático. |
| domain | `run/Run.ts`, `RunConfig.ts`, `RunSetup.ts` | Mod. | Drops, paso 7, snapshot (§3). `RunSetup.gems[i].kind?` (`xp` por defecto), `RunSetup.resources?: { gold, wood }` y `RunSetup.veins?: { depleted }[]` (escenarios con contadores o vetas ya agotadas). |
| domain | `run/RunSnapshot.ts`, `snapshotParts.ts` | Mod. | `pickups`, `resources`, `veins`; `gems` como vista de los `xp` (§3). |
| application | — | Sin cambios | `StartRun`/`RestartRun` pasan `RunSeeding` tal cual; el reinicio ya crea un `Run` nuevo (contadores a 0). |
| infrastructure | `random/deriveSeed.ts` | Mod. | `RESOURCE_STREAM = 4`. |
| infrastructure | `content/schemas.ts`, `parseContent` | Mod. | zod de `resources.json`, `maxGold`/`maxWood` en progresión, comprobación cruzada `maxWood ≥ woodPiles.count`, `appearance.json` (§5). |
| infrastructure | `phaser/PickupLayer.ts` | Mod. (ex `GemLayer`) | Un `SlotPool` de capacidad `Σ topes` asociado por id; al aparecer, el sprite toma el aspecto de su tipo. |
| infrastructure | `phaser/map/planMapArt.ts`, `TerrainView.ts` | Mod. | Vetas en la capa baja tras las estructuras: 1 sprite por aspecto, reserva con un dibujo `circle` nuevo (§7). |
| infrastructure | `phaser/StructureArt.ts` | Mod. | Se parametriza con el lector del segundo estado (`destroyed` / `depleted`); una instancia para estructuras y otra para vetas. |
| infrastructure | `phaser/Hud.ts`, `ui/uiLayout.ts`, `hudFormat.ts` | Mod. | Icono + número de oro y madera (§6). |
| infrastructure | `phaser/renderCounts.ts`, `GameScene.ts`, `RenderLayers.ts` | Mod. | Sonda (§8). |
| composition | `seedSource.ts`, `main.ts` | Mod. | `resourceRandom = Mulberry32(deriveSeed(seed, RESOURCE_STREAM))`; carga de `resources.json`. |
| content | `resources.json` (nueva), `progression.json`, `appearance.json`, `asset-provenance.json` | — | §2, §5. |
| tests/support | `mapGolden.ts`, `balanceBaseline.ts` (nueva), `scenarioConfig` | Mod. | `RESOURCE_GOLDEN`, línea base de balance por semilla (M0) y `withoutResourceSources(config)` (§10). |

Por qué en esta capa: qué se recoge, cuánto y cuándo (recogibles, drops, vetas, colocación y contadores) es
simulación y va al núcleo puro (ADR-0002). `application` no cambia porque el caso de uso es el mismo. Aspectos, HUD y
plan de arte son presentación y van a infraestructura. No hay puertos nuevos: nada tiene dos implementaciones
previsibles.

## 2. Contenido

`content/progression.json` gana `"maxGold": 32` y `"maxWood": 64` (la spec pone los topes en el fichero de
progresión). `gemRadius` 5 es el radio de los tres tipos.

`content/resources.json` (nuevo, zod estricto):

```json
{
  "drops": {
    "enemies": { "goblin-barrel": { "wood": 1 } },
    "structures": { "goblin-house": { "gold": 5 }, "goblin-tower": { "gold": 8 } }
  },
  "woodPiles": { "count": 8, "wood": 3 },
  "goldVeins": { "count": 3, "gold": 10, "radius": 30 },
  "placement": { "minStartCells": 6, "minCastleCells": 3, "minGapCells": 4 }
}
```

- Fichero propio: la economía que afinarán 0023 y 0024 queda junta, y `enemies.json` y `structures.json` no se tocan
  (escenario "Contenido de combate intacto").
- Drops por id: las claves de `drops.enemies` deben existir en el catálogo y las de `drops.structures` en los tipos de
  estructura (el error nombra la clave). Cada drop admite solo `wood` (enemigos) o `gold` (estructuras), entero ≥ 1.
  Una clave desconocida, también `meat`, falla por ser campo desconocido (zod estricto) con un error que la nombra. Los
  mapas pueden estar vacíos: así se anulan las fuentes en los tests (§10), sin cantidades a 0.
- `count` entero ≥ 0, cantidades enteras ≥ 1, `radius` > 0, distancias de colocación enteras ≥ 0. No hay `maxAttempts`
  porque la colocación no usa intentos (§4).
- Cruce de ficheros: `maxWood ≥ woodPiles.count` lo comprueba `parseContent` tras zod, con el mensaje del dominio
  (error que nombra `progression.maxWood`). El dominio vuelve a comprobarlo en `buildRunRules`.
- Cantidades **provisionales**: no tienen efecto en el juego hasta 0023/0024. `startRadius` 180 + 6 celdas de
  Chebyshev deja cada centro a más de 308 px de la salida; lo comprueba el test de 1.002 semillas.

## 3. Recogibles, contadores y snapshot

**Lista única, tope por tipo** (ADR-0021). `PickupField`:
- `active: Pickup[]` en orden de creación (sin agrupar por tipo), `free` compartido de `maxGems + maxGold + maxWood`
  registros preasignados, `count[kind]` de activos y `nextId` único para los tres tipos.
- `drop(kind, x, y, value)`: si `count[kind] < max[kind]`, recoloca con `map.nearestWalkable`, asigna el siguiente id y
  añade al final. Si no, suma el valor al **primer** activo de ese tipo (barrido desde el principio, solo con el tope
  lleno; acotado por `Σ topes` ≤ 396) y no crea ni recoloca nada.
- `step(px, py, pr, reach, out)`: una pasada en orden de creación con imán común y recogida estricta; acumula
  `out.xp`, `out.gold` y `out.wood` en un objeto reutilizado; compactación estable.

La XP se comporta bit a bit como hoy: los recogibles xp conservan su orden relativo, su tope y su relleno, y los otros
tipos no ocupan su plaza ni la cambian. Solo cambian los **ids** de las gemas si hay montones o drops intercalados (la
spec lo admite: "gemas (identificadores aparte)").

**Paso 7**: (7.1) `step` → `experience.gain(out.xp)`, `stock.add(out.gold, out.wood)`; (7.2) vetas en orden de lista:
`tap` suma su oro con solape estricto (`d < pr + radius`) y la deja agotada. En el tick de muerte o victoria no se
ejecuta (como hoy).

**Drops**:
- `Run.onDeath(dead)` (ex `dropGem`): primero la gema de XP; después, si el tipo tiene `wood` en `drops.enemies` y
  `!dead.detonated`, el `wood` en el mismo punto. Las dos recolocaciones dan la misma celda porque parten del mismo
  punto. Casos: barril abatido por armas (también en el tick en que su mecha terminaría, porque las armas actúan antes)
  o por una explosión ajena con su mecha sin terminar → madera; barril que explota, aunque otra explosión del tick lo
  deje a 0 (D2 de 0020) → sin madera.
- `structures.settle(onRuin)` tras el `removeDead` del paso de armas: `gold` del tipo en `site.x, site.y`, en orden de
  lista, después de los recogibles de todas las bajas del paso.
- Montones: al crear la partida, un `wood` no atraído por montón, en el orden de colocación y **antes** que cualquier
  `RunSetup.gems` (ids 0..N−1).

**Snapshot**:
- `pickups: { id, kind, value, x, y, radius }[]` en orden de creación.
- `gems`: vista de los `xp` de `pickups` con la forma de hoy `{ id, x, y, radius }`. La spec la permite ("las gemas
  son los recogibles de tipo `xp`") y evita reescribir unos 170 usos en 40 ficheros de test. Se calcula en el mismo
  recorrido que `pickups` (un array más por snapshot, una vez por frame). `@deprecated`; la retira un chore posterior.
- `resources: { gold, wood }`; `veins: { id, x, y, radius, gold, depleted }[]` en orden fijo y de longitud constante.
- Todo congelado, como el resto del snapshot.

## 4. Colocación con `RESOURCE_STREAM` 4

`placeResources(map, structureSites, rules, random)`, función pura, solo en mapas generados:
1. Rejillas: `chebyshevFrom` a la zona de inicio y a la huella del castillo, y ocupación de las huellas y puertas de las
   estructuras ya colocadas. Las estructuras salen antes de su propio flujo y no cambian.
2. Cada recurso ocupa **una celda** y su posición es el centro de esa celda. Se colocan en orden fijo: las `goldVeins.count`
   vetas y después los `woodPiles.count` montones.
3. Para cada uno se construye la lista de **celdas candidatas**, en orden de filas: `grass`, fuera de huellas y
   puertas, a distancia ≥ `minStartCells` de la zona de inicio y ≥ `minCastleCells` del castillo, y a distancia de
   Chebyshev ≥ `minGapCells` (y nunca la misma celda) de los recursos ya colocados. Se elige la de índice
   `⌊random.next() · len⌋`, que es **1 valor por recurso**. Sin candidatas, se dejan de colocar recursos (mejor
   esfuerzo, sin error).
4. Coste: O(celdas) por recurso, 11 × 2.304 por partida, despreciable frente a `generateMap`. Así se coloca exactamente
   el número pedido siempre que quepa, que es lo que exige la spec para 1..1.000, 0 y 2³² − 1, sin depender de un
   número de intentos.
5. El orden de consumo y el criterio son contrato de determinismo; los vigila `RESOURCE_GOLDEN` (mismas semillas que
   `STRUCTURE_GOLDEN`).

Las vetas y los montones no bloquean ni cambian celdas, así que `MAP_GOLDEN`, el campo de flujo y la colisión del
jugador no cambian. El mapa explícito declara sus posiciones en px y se valida que estén dentro del mundo (el error
nombra la veta o el montón).

## 5. Aspectos y arte

- **Oro**: `Resources/Resources/G_Idle.png` (ya versionado). **Madera**: `W_Idle.png`. **Vetas**:
  `Resources/Gold Mine/GoldMine_Active.png` y `GoldMine_Inactive.png` (≈ 192 × 128; medidas exactas al copiar), escala
  0,6 para que el dibujo no tape mucho más que su celda, origen en la posición de la veta.
- **XP sin hoja**, como **forma de color** (la opción que da la spec). El pack no trae gema; se descartan teñir la bolsa
  (se confunde con el oro), `M_Idle` (reservada a la carne, y su versionado está prohibido) y los iconos de UI. La
  forma reutiliza el pintado de reserva: textura de reserva teñida con el color de `xp` y tamaño 2 × `gemRadius`. La
  sonda no la cuenta como reserva (como los avisos) y no exige `idle`. Así no hace falta `generateTexture`, que la
  versión 1 de este design proponía, ni ningún PNG nuevo para la XP.
- `appearance.json`: `gem` → `pickups: { xp: { shape: true, placeholderColor }, gold: {...G_Idle}, wood: {...W_Idle} }`,
  `veins: { active, depleted }`, `veinColor` y colores de reserva distintos dos a dos y distintos de `terrain` y de
  `structureColors` (zod con mensajes que nombran el tipo o el campo). Los iconos del HUD usan los aspectos `gold` y
  `wood`.
- Cada PNG copiado (`W_Idle`, `GoldMine_Active`, `GoldMine_Inactive`) lleva su entrada en
  `content/asset-provenance.json` (sha256, bytes) **en la misma tarea y el mismo commit**. Nada del Free Pack, ni
  `GoldMine_Destroyed`, `_(NoShadow)`, `*_Spawn`, `M_*` o `HappySheep_*` (`guard:all`).

## 6. HUD

`HUD_BASE` gana `iconSize` 16, `iconGap` 4 y dos filas a la derecha bajo las bajas: oro en `xpY` (34) y madera en 52,
todo ×`uiScale`. En cada fila el icono queda fijo junto al margen derecho y el número, alineado a la derecha
(`originX` 1), a su izquierda. Icono + número son **un solo elemento** para `hudBoxes` (`gold`, `wood`), con su caja
para los tests de solape y contención con 123456 / 12345. El número va como entero completo (`String(n)`) y se
escribe solo si cambia. El icono es una imagen de la hoja, o un cuadrado del color de reserva del tipo si la hoja no
cargó. Son 4 objetos de HUD creados una vez, con `scrollFactor` 0, que se reubican en cada RESIZE con `relayout`.
Sonda E2E `hud: { gold, wood }` con los textos mostrados (solo con `?e2e`), que necesita el escenario "Contadores en
el navegador".

## 7. Render y recorte

- `PickupLayer`: un `SlotPool` de `Σ topes` sprites preasignados asociado por id (los ids son únicos entre tipos). Al
  aparecer, el sprite toma el aspecto de su tipo (`look` + frame + `paint`); un sprite reutilizado cambia de aspecto.
  Sin asignar por frame. Los recogibles no entran en `MapCuller`, como las gemas hoy.
- Vetas en el plan del mapa, capa baja (5) tras las estructuras: por veta, 1 sprite activo y 1 agotado (2 objetos; 6
  con 3 vetas). El cambio de aspecto va por máscara (`StructureArt` parametrizado). Reserva: dibujo nuevo
  `CircleDraw { kind: 'circle', x, y, radius, color, bounds }`, que `TerrainView` pinta con
  `scene.add.circle(x, y, radius, color)` (`Phaser.GameObjects.Arc`). Todo lo recorta `MapCuller` por `bounds` sin
  cambios. Objetos esperados: 695/778 + 6 en 42/123 (≤ 1.000).
- API de Phaser: MCP `phaser-docs`, `/api-documentation/class/gameobjects-gameobjectfactory.md` →
  `circle([x], [y], [radius], [fillColor], [fillAlpha])` (la página publicada es de 4.1.0); comprobado en
  `node_modules/phaser/types/phaser.d.ts` 4.2.1 (`circle(x?, y?, radius?, fillColor?, fillAlpha?): Arc`). No se usa
  ninguna otra API nueva.

## 8. Sonda E2E

`sprites.pickups.{xp,gold,wood}` (`visible`/`placeholder`; la `xp` nunca reserva) y `sprites.gems` = el mismo objeto
que `sprites.pickups.xp`; `sprites.veins: { active, depleted, fallback }`; `mapArt.objects` con las vetas;
`map.veins`/`map.woodPiles`; `hud`; `snapshot.pickups/resources/veins`. Todo a 0 o `null` en el menú.

## 9. Flujo de un tick (solo cambios)

```
1 jugador → 2 comportamiento → 3 armas → removeDead(onDeath: xp [+ wood si !detonated])
  → settle(onRuin: gold) → 4 peligros → removeDead(onDeath) → lanzamientos
  → 5 golpe → 6 victoria? (muerte/victoria: sin paso 7)
  → 7.1 recogibles (una pasada, orden de creación) → 7.2 vetas → 8 director → 9 guardias → 10 oferta
```

Consumo de azar: el mismo que hoy. La colocación usa solo `resourceRandom`.

## 10. Escenarios que necesitan apoyo de test

- **"Mismo combate con y sin recursos"**: `withoutResourceSources(config)` en `tests/support`, a nivel de `RunConfig`
  del dominio: `woodPiles.count` 0, `goldVeins.count` 0 y mapas de drops vacíos (no hace falta ninguna cantidad a 0).
  Se compara cada tick sin los ids de las gemas.
- **"Victorias del bot de referencia"** (mismo resultado, tick y bajas por semilla que antes) y **"Contenido de combate
  intacto"**: M0 congela antes de tocar código `tests/support/balanceBaseline.ts` (resultado, tick y bajas de las
  semillas 1..50 y la media de mechas) y la huella de los campos de combate del contenido. Los tests comparan con
  esos ficheros.

## 11. Rendimiento y seguridad

- **Presupuesto**: el lote de balance tarda unos 30 s en local. Objetivo: ≤ +5 % y ≤ 35 s en local (×2,8 ≈ CI, tope
  90 s). Trabajo nuevo por tick: los recogibles de oro y madera de la misma pasada (normalmente < 30) y 3 vetas, sin
  asignaciones. El barrido del relleno con el tope lleno es O(n ≤ 396) por drop desbordado. Por frame, el snapshot
  añade una lista y la vista `gems`.
- **Mediciones**:
  - M0 (antes de tocar código, misma máquina): `npm run bench` (caso "Peor caso con gemas") y tiempo de pared del lote,
    dos veces; línea base de balance y de contenido (§10).
  - M1 (al cerrar el núcleo): caso de bench nuevo "tres topes llenos" (300 enemigos, 32 proyectiles, 300 + 32 + 64
    recogibles atraídos a ≥ 400 px y 3 vetas), ≤ 2 ms y anotado frente a 0,25 ms; lote ≤ 35 s; balance idéntico por
    semilla (27/50, 0 quietos en 100 partidas, 26,9 mechas). Cualquier desviación es un bug de determinismo, no un
    balance que recalibrar.
  - M2 (render): objetos del mapa en 42/123 ≤ 1.000 y `drawn` 0 en el menú.
  - Informativo (no gate): oro y madera medios por partida con el bot v3.
- **Datos persistidos**: ninguno nuevo (récords, historial y resultados sin cambios). Entradas externas: solo el
  contenido, validado con zod antes del dominio. Sin red ni secretos. Sin dependencias nuevas.

## Dependencias nuevas
| Paquete | Versión exacta | Motivo | Alternativa descartada |
|---|---|---|---|
| — | — | Ninguna | — |

## 12. Contraste con las specs delta y la proposal

| Punto | Spec | Decisión |
|---|---|---|
| Lista e ids | `xp-gems` "Recogibles con tipo", `simulation-loop` "Snapshot" | Lista única y una secuencia de ids (cambio respecto a la v1). `gems` como vista de los `xp`. |
| Topes y radio | `xp-gems` "Contenido de gemas validado" | `maxGold`/`maxWood` en `progression.json`; `gemRadius` común; `maxWood ≥` montones. |
| Veta | `resources` "Vetas de oro al pasar" | Oro directo al contador en 7.2, tras los recogibles; sin vetas en el tick de victoria o derrota. Una celda (cambio respecto a la huella 3 × 2 de la v1). |
| Barril | `enemy-hazards` "Madera del barril abatido" | `detonated` solo por su mecha; gema y luego madera. |
| XP sin hoja | `sprite-rendering` "Aspectos…" | Forma de color con el pintado de reserva, no contada como reserva; sin `generateTexture`. |
| Sin fuentes | `resources` "Recursos sin efecto" | `withoutResourceSources` (mapas de drops vacíos, conteos 0). |
| `W_Idle` | `asset-provenance` delta | Se versiona con su entrada; el resto sigue prohibido. |
| Colocación | `procedural-map` "Recursos en el mapa generado" | Celda única, candidatas + 1 valor por recurso, sin `maxAttempts`, sin distancia al agua (no la pide la spec; `grass` ya excluye el agua). |
| HUD E2E | `hud` "Contadores en el navegador" | Sonda `hud` nueva; E2E nuevo (§13 de tasks). |
| Criterios de la proposal | 27/50, 0 quietos, goldens, ≤ 1.000 objetos, procedencia, ≤ 2 E2E | Cubiertos; la spec endurece el balance a "misma semilla, mismo tick y mismas bajas" (necesita M0). |

Interpretación que conviene confirmar: los mapas de drops admiten estar vacíos (contenido válido sin fuente de
madera o de oro). La spec exige las cinco cantidades ≥ 1 en el contenido por defecto, pero no que su ausencia sea
un error, salvo el oro por veta.

## ADRs
- `docs/adr/0021-recogibles-con-tipo-y-flujo-de-recursos.md`: lista única con tope por tipo, contadores de partida y
  `RESOURCE_STREAM` 4 con colocación por candidatas, como contrato de determinismo. Numeración confirmada por el
  orquestador (`origin/main` acaba en 0020).
