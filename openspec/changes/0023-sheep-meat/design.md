# Design · 0023-sheep-meat

> Base: `proposal.md` aprobada (2026-11-24; las armas apuntan en orden **enemigos → estructuras → ovejas**),
> `exploration.md` y las 10 specs delta del change (`sheep` nueva; `xp-gems`, `resources`, `player-health`,
> `simulation-loop`, `auto-weapons`, `enemy-hazards`, `procedural-map`, `sprite-rendering`, `asset-provenance`).
> **Revisión tras el contraste con las specs** (§14): mandan las specs. Cambian el deambular (pasto/paseo con origen),
> la curación, el sitio de la carne en el contenido, la reaparición (distancia en px, "otra celda"), la colocación (sin
> excluir recursos), el orden del tick (ovejas en el paso 1), el arte (dos hojas) y el balance (dos lotes).

## Resumen
La oveja es una **entidad neutral propia** del núcleo (`Sheep`), gestionada por un `Flock` que posee `Run`, separada de
`Horde`, del director y de `kills`. Se mueve con el barrido por ejes del jugador: huye en recta si el jugador está a
menos del radio de huida y, si no, alterna **pasto** (quieta) y **paseo** (dirección fija; vuelve hacia su origen si
se ha alejado más del radio de pasto). Las armas la apuntan como **tercer nivel de reserva** y las explosiones la dañan.
Al morir suelta un recogible `meat` (un tope más en la unión de ADR-0021); al recogerlo cura
`valor × max(1, ⌊healPercent × vidaMáx / 100⌋)` con tope. Reaparece tras un intervalo en otra celda candidata. Todo el
azar de las ovejas sale de **un flujo propio `SHEEP_STREAM` 5** consumido en orden fijo (§4). Mapa, estructuras,
recursos y oleadas no lo ven: `MAP_/STRUCTURE_/RESOURCE_GOLDEN` no cambian.

## 1. Piezas por capa

| Capa | Pieza | Nueva/Mod. | Notas |
|---|---|---|---|
| domain | `sheep/Sheep.ts` | Nueva | Registro de pool mutable interno al agregado (ADR-0003), cumple `WeaponTarget`: id, x, y, origen (ox, oy), radio, vida, `mode` (`graze`/`wander`/`flee`), `phaseEnd` (último tick de la fase), dirección (dx, dy), `lastHitAt`. |
| domain | `sheep/Flock.ts` | Nueva | Lo posee `Run`. Lista viva en orden de creación (compactación estable, ADR-0006), pool de `capacity`, secuencia de ids propia, cola FIFO de reapariciones pendientes y celdas base de reaparición. `step` (paso 1), `settle` (3.5 y 4.2), `respawn` (9.2). |
| domain | `sheep/SheepRules.ts` | Nueva | VO de `content/sheep.json` (§2) con `maxAlive ≥ 0` y el cruce `radius ≤ cellSize / 2`. |
| domain | `sheep/placeSheep.ts`, `resolveSheep.ts` | Nuevas | Colocación inicial pura (§4.1) y resolución por `TerrainSource` (declaradas o generadas), con validación de posición legal (`map.sheep[i]`). |
| domain | `map/candidateCells.ts` | Nueva (extracción) | Celdas base `grass` fuera de huellas y puertas, con distancias opcionales a inicio y castillo. Lo usan `placeResources` (sin cambio de resultado: `RESOURCE_GOLDEN` lo vigila) y `placeSheep`/`Flock`. |
| domain | `shared/Health.ts`, `player/Player.ts` | Mod. | `heal(amount)`: `min(max, current + amount)`; devuelve `this` si no cambia o si la vida está agotada (no resucita). `Player.heal` conserva posición e invulnerabilidad. |
| domain | `pickup/PickupKind.ts`, `PickupRules.ts`, `PickupField.ts` | Mod. | `'meat'` en la unión y en `PICKUP_KINDS`, `maxMeat`, `capacity` = Σ 4 topes, `PickupGain.meat`. Relleno y pasada única sin cambios. |
| domain | `resource/ResourceRules.ts` | Mod. | `meat: { perSheep, healPercent }` (de `resources.json`, §2). |
| domain | `weapon/Arsenal.ts`, `Projectile.ts` | Mod. | Reserva por niveles (§7): `step(n, px, py, enemies, reserves)`; `atStructure: boolean` pasa a `tier: number`. |
| domain | `hazard/HazardField.ts` | Mod. | `explode(n, enemies, sheep, px, py, pr)`: daña también a las ovejas vivas que solapa. El retorno sigue siendo "hubo bajas de enemigos". |
| domain | `map/TerrainSource.ts` | Mod. | `generated` gana `sheepRandom` (obligatorio). `open`/`cells` ganan `sheep?: { at: DeclaredStart[]; random: RandomGenerator }` (§4.3). |
| domain | `run/Run.ts`, `RunConfig.ts`, `RunSetup.ts`, `RunSnapshot.ts`, `snapshotParts.ts` | Mod. | `RunConfig.sheep`, orden del tick (§8), carne en `onSheepDeath`, curación en 7.1, `snapshot.sheep` (§9). `RunSetup` gana `player.health` y `sheep[i]: { health?, origin? }` (escenarios). |
| application | — | Sin cambios | `StartRun`/`RestartRun` pasan `RunSeeding` tal cual; el generador de ovejas viaja en `terrain`. |
| infrastructure | `random/deriveSeed.ts` | Mod. | `SHEEP_STREAM = 5`. `deriveSeed` no cambia (ADR-0013). |
| infrastructure | `content/schemas.ts`, `parseContent`, `loadRunConfig.ts` | Mod. | zod estricto de `sheep.json`, `resources.meat`, `progression.maxMeat` y cruces (§2). |
| infrastructure | `content/appearanceSchema.ts`, `phaser/art/looks.ts` | Mod. | Aspecto `sheep` con `idle` y `bounce`, **cada animación con su hoja** (§10), y `pickups.meat`. |
| infrastructure | `phaser/SheepLayer.ts` | Nueva | `SlotPool` de `capacity` sprites por id (ADR-0006); `idle` en `graze`, `bounce` en `wander`/`flee`; volteo por Δx (`Motion`), destello como `EnemyLayer`, sin cadáver ni barra. |
| infrastructure | `phaser/PickupLayer.ts`, `renderCounts.ts`, `RenderLayers.ts`, `GameScene.ts` | Mod. | Pool de Σ 4 topes y aspecto `meat`; capa de ovejas sobre recogibles y bajo jugador/enemigos; sonda (§11). |
| composition | `seedSource.ts`, `contentBoot.ts` | Mod. | `sheepRandom = Mulberry32(deriveSeed(seed, SHEEP_STREAM))` en `generated`; carga de `sheep.json`. |
| content | `sheep.json` (nuevo), `resources.json`, `progression.json`, `appearance.json`, `asset-provenance.json` | — | §2 y §10. `enemies`, `waves`, `weapons`, `upgrades`, `player`, `structures` y la curva **no** cambian. |
| tests/support | `builders.ts`, `mapGolden.ts`, `balanceMeasure.ts`, `balanceBaseline.ts` | Mod. | `TEST_SHEEP`, `withSheep`, `withoutSheep` (tope 0), `declaredSheep`; `SHEEP_GOLDEN`; traza con curación, ovejas muertas y tick de muerte del quieto; huella de `resources.json` sin `meat`. |

**Por qué en esta capa.** Movimiento, daño, suelta, curación y reaparición son simulación: núcleo puro (ADR-0002). El
caso de uso no cambia, así que `application` tampoco. Aspectos, pool y sonda son presentación (infraestructura); solo la
composición conoce `Mulberry32` y el número de flujo. **Sin puertos nuevos**: el generador de ovejas es otro
`RandomGenerator`.

**Opción A descartada** (oveja como enemigo neutral en `enemies.json`): mezclaría `kills`, `maxAlive`, presupuesto,
contacto y objetivo de primer nivel, y el enemigo ignora el mapa mientras que la oveja lo respeta.

## 2. Contenido

`content/sheep.json` (nuevo, zod estricto; cifras **provisionales**, se calibran en 5.2):

```json
{
  "maxAlive": 5,
  "radius": 18,
  "health": 12,
  "graze": { "ticks": 180, "radius": 240 },
  "wander": { "speed": 40, "ticks": 60 },
  "flee": { "radius": 200, "speed": 150 },
  "respawn": { "everyTicks": 1800, "minPlayerDistance": 600 },
  "placement": { "minStartCells": 9, "minCastleCells": 3, "minGapCells": 6 }
}
```

`content/resources.json` gana `"meat": { "perSheep": 1, "healPercent": 20 }` y `content/progression.json` gana
`"maxMeat": 8`.

- **Rangos (spec `sheep`, "Contenido de las ovejas validado")**: `maxAlive` entero ≥ 0 (0 válido; sin máximo: el
  escenario "Contenido sin hueco suficiente" carga 2.000); `radius` > 0; `health` entero ≥ 1; `wander.speed`,
  `flee.speed`, `flee.radius`, `graze.radius` > 0; `graze.ticks`, `wander.ticks`, `respawn.everyTicks` enteros ≥ 1;
  `respawn.minPlayerDistance` ≥ 0 (px); `placement.*` enteros ≥ 0 (celdas). Un campo desconocido (p. ej.
  `contactDamage`) o ausente falla nombrándolo.
- **Carne en `resources.json`** (spec `resources`, "Contenido de recursos validado"): `meat.perSheep` entero ≥ 1 y
  `meat.healPercent` entero en [1, 100]. `meatPerHouse` u otro campo extra falla por estricto. `maxMeat` entero ≥ 1
  (spec `xp-gems`). La huella de "Contenido de combate intacto" compara `resources.json` **sin** `meat`.
- **Cruce de ficheros** (`buildRunRules`, única implementación, también desde el `superRefine`): `sheep.radius ≤
  map.cellSize / 2`, para que el centro de una celda caminable sea posición legal (colocación y reaparición). No lo
  exige la spec pero es un invariante del modelo; el error nombra `sheep.radius`.
- **Distancia a la salida** (spec `procedural-map`): con el contenido por defecto, toda oveja colocada queda a más de
  `flee.radius + graze.radius + wander.speed × wander.ticks / 60` (200 + 240 + 40 = 480 px) de la salida. Lo asegura
  `minStartCells` 9 (la zona de inicio es de 180 px) y lo vigila el test de 1..1.000 semillas.

## 3. Entidad y flota

`Sheep`: `set(id, x, y, health, phaseEnd)` al aparecer (origen = posición, `mode = 'graze'`, `lastHitAt = −∞`);
`takeDamage(amount, tick)` recorta a 0, anota `lastHitAt` y devuelve true si este golpe la deja a 0; `damagedAt(k,
flash)` como el enemigo.

`Flock`:
- `all`: el array vivo, el mismo durante toda la partida (el `Arsenal` lo recibe una vez como nivel 2).
- `capacity` = `maxAlive` (generado) o número de declaradas. Pool y cola preasignados: sin asignaciones por tick.
- `step(n, px, py, map, arena, random)` (paso 1, tras el jugador): §5.
- `settle(onDeath)`: compacta las de vida 0 en orden de lista; por cada una llama a `onDeath` (carne) y encola
  `{ dueAt: n + everyTicks, cell }` con la celda de su centro. Se llama en 3.5 y en 4.2.
- `respawn(n, px, py, random)` (9.2): §4.2.

## 4. Azar: `SHEEP_STREAM` 5

**Un solo flujo, consumido en orden fijo** (contrato de determinismo, ADR-0022). En los mapas generados es
`Mulberry32(deriveSeed(seed, 5))`; en los declarados, el que pase el escenario.
1. **Colocación inicial** (solo generados, al crear la partida): 1 valor por oveja (§4.1).
2. **Primer pasto** (solo generados, justo después): 1 valor por oveja colocada, en orden de lista:
   `phaseEnd = 0 + 1 + ⌊next · graze.ticks⌋` (duración en [1, graze.ticks]).
3. **Durante la partida**, en el orden del tick:
   - paso 1, en orden de lista: 1 valor por cada paseo que empieza con dirección **aleatoria**
     (`DIRS[⌊next · 8⌋]`); los paseos de vuelta al origen no consumen;
   - paso 9.2, en orden de cola: 1 valor por cada reaparición vencida que tiene candidatas.

La firma inicial (`SHEEP_GOLDEN`, semillas 42 y 123 y más) solo depende de la fase 1, que va primera. Oleadas y
ofertas siguen con `Mulberry32(seed)` sin cambios. Se descarta el hash sin estado del primer design porque la spec
`simulation-loop` exige que **toda** la aleatoriedad salga de instancias de `RandomGenerator`, y porque el deambular de
la spec tiene estado (fases con duración) y no épocas fijas.

### 4.1 Colocación (spec `procedural-map`, "Ovejas en el mapa generado")
- Base: `candidateCells(map, sites, { minStartCells, minCastleCells })` en orden de filas (`grass`, fuera de huellas y
  puertas, Chebyshev a zona de inicio y castillo como en estructuras). **No** excluye vetas ni montones.
- Por cada oveja hasta `maxAlive`: candidatas = base a Chebyshev ≥ `max(1, minGapCells)` de las ya colocadas (nunca la
  misma celda); `⌊next · len⌋`. Sin candidatas se para (mejor esfuerzo, sin error).
- Posición y origen: centro de la celda.

### 4.2 Reaparición (spec `sheep`, "Reaparición de ovejas")
- Celdas base de reaparición, calculadas una vez al crear la partida: generados, las mismas de §4.1; declarados,
  `grass` fuera de huellas y puertas, sin distancias.
- En 9.2, por cada pendiente con `dueAt ≤ n`, en orden FIFO (orden de muerte y, a igual tick, de lista): candidatas =
  base sin la celda de muerte y con `dist²(centro, jugador) ≥ minPlayerDistance²`. Si `k > 0`, se elige la
  `⌊next · k⌋`-ésima en una segunda pasada sin asignar; la oveja nueva (id siguiente, vida del contenido, origen en su
  posición, pasto completo: `phaseEnd = n + graze.ticks`) va al final de la lista. Si `k = 0`, sigue pendiente sin
  consumir azar.
- Las ovejas que la colocación no pudo poner **no** se encolan: solo las muertes generan reapariciones.
- En los ticks que acaban en 5 o 6 no se llega a 9.2: no aparece ninguna.

### 4.3 Mapas declarados
`open`/`cells` con `sheep: { at, random }`: cada `at[i]` debe ser posición legal de un círculo de radio
`sheep.radius` (dentro del mundo, sin solapar celdas no caminables; tangencia legal); si no, error en `map.sheep[i]`.
Sin tope; pasto inicial completo; sin consumo de colocación. `OPEN_TERRAIN` y `?e2e&map=empty` no tienen ovejas. El
helper de tests `declaredSheep(positions, seed)` construye el `random` con `Mulberry32(deriveSeed(seed, 5))`.

## 5. Movimiento (paso 1, tras el jugador)

Para cada oveja viva, en orden de lista, con el jugador ya movido en (px, py) y `d` la distancia entre centros:
1. `d < flee.radius` (estricto): `mode = 'flee'`, dirección `(sx − px, sy − py) / d` (con `d = 0`, (1, 0)), avanza
   `flee.speed / 60`.
2. Si no, y `mode === 'flee'`: `mode = 'graze'`, `phaseEnd = n + graze.ticks − 1`; no se mueve.
3. Si no, y `mode === 'graze'` y `n > phaseEnd`: empieza paseo, `mode = 'wander'`, `phaseEnd = n + wander.ticks − 1`;
   dirección = hacia el origen normalizada si `dist(origen) > graze.radius` (estricto), o `DIRS[⌊next · 8⌋]`; avanza.
4. Si no, y `mode === 'wander'` y `n > phaseEnd`: `mode = 'graze'`, `phaseEnd = n + graze.ticks − 1`; no se mueve.
5. Si no, y `mode === 'wander'`: avanza `wander.speed / 60` en su dirección. En `graze`: quieta.

Comprobado contra los escenarios: creada en t con `phaseEnd = t + g` pasta de t + 1 a t + g y pasea desde t + g + 1
("Pasto y paseo": 0–120 `graze`, 121–180 `wander`, 181–300 `graze`); al salir de la huida en el tick 18 pasta del 18 al
137. `DIRS` es una tabla fija de 8 unitarios con `Math.SQRT1_2` (sin trigonometría, cuyo resultado ECMAScript no fija).

**Avance**: `x = map.limitMoveX(x0, arena.clampX(x0 + dx·step, r), y0, r)` y lo mismo en y con la x ya resuelta, el
barrido de `Player.move`: desliza, no rebota, no pasa entre esquinas y puede atascarse. Sin colisión con jugador,
enemigos, otras ovejas, estructuras ni recogibles. Las ovejas solo reaccionan al jugador.

## 6. Carne y curación

- `onSheepDeath(sheep)`: `pickups.drop('meat', x, y, meat.perSheep)`, con la recolocación a celda caminable y el
  relleno "suma al más antiguo de su tipo" (ADR-0021). La carne comparte la secuencia de ids de los recogibles.
- 7.1, en la misma pasada: tras `experience.gain` y `stock.add`, si `gain.meat > 0`,
  `heal = gain.meat × max(1, ⌊healPercent × health.max / 100⌋)` con el máximo **efectivo** (mejorado) y
  `player = player.heal(heal)`. Sumar las piezas y curar una vez equivale a curar pieza a pieza en orden con tope
  (el tope es monótono). Ejemplos de la spec: 100 → 20; 140 → 28; 15 % de 110 → 16; 1 % de 60 → 1.
- **No resucita** y no cura en la victoria: 7 no se ejecuta en los ticks que acaban en 5 o 6. La carne no se guarda ni
  sale en resultados ni HUD.

## 7. Armas: reserva por niveles

`Run` crea una vez `reserves = [structures.all, flock.all]` y llama a `arsenal.step(n, x, y, horde.alive, reserves)`.
- **Disparo**: enemigo según el criterio; si no hay, el primer nivel en el que el mismo criterio encuentra algo
  (estructura no destruida y, después, oveja viva), con empate por orden de lista. Sin concatenar ni asignar.
- **Proyectil**: guarda `tier` (0 enemigo, 1 estructura, 2 oveja). Impacta en el primer enemigo vivo que solapa; si no
  y `tier > 0`, en el primer objetivo vivo de **su** nivel. El dirigido a un enemigo atraviesa estructuras y ovejas; el
  dirigido a una oveja atraviesa estructuras, y viceversa (spec `auto-weapons`, "Proyectiles").
- **Pulso**: hay objetivo si hay enemigo, o estructura, o oveja en el radio (en ese orden); al disparar daña a todos
  los enemigos, estructuras y ovejas que solapan.
- `step` sigue devolviendo solo bajas de enemigos: `kills` no cambia por construcción. Con el nivel 2 vacío, las armas
  se comportan bit a bit como hoy (prueba de regresión: lote con tope 0 igual a la línea base, §12).

**Peligros**: en `strike`, tras los enemigos, cada oveja viva con `d < R + r` pierde `D` (sin cambiar su estado).

## 8. Flujo de un tick (cambios en negrita)

```
1 jugador → **ovejas (huida / pasto / paseo; consume SHEEP en paseos aleatorios)**
  → 2 comportamiento de enemigos
  → 3 armas (enemigos → estructuras → **ovejas**) → 3.3 bajas (xp, wood) → 3.4 ruinas (gold)
    → **3.5 ovejas muertas (meat, encola reaparición)**
  → 4.1 explosiones (**también dañan ovejas**) → 4.2 bajas → **ovejas muertas (meat)** → 4.3 lanzamientos
  → 5 golpe (las ovejas no son candidatas) → 6 victoria? (muerte/victoria: fin del tick)
  → 7.1 recogibles (xp, gold, wood, **meat → curar**) → 7.2 vetas → 8 director
  → 9.1 guardias → **9.2 reaparición de ovejas (SHEEP)** → 10 oferta
```

El docblock de `Run` se actualiza con este contrato y con el consumo de azar de §4.

## 9. Snapshot

`sheep: { id, x, y, radius, health, state, damaged, origin: { x, y } }[]`, vivas en orden de creación, congelado.
`origin` lo piden "Ovejas de la partida" y "Determinismo". La carne va en `pickups` (`kind: 'meat'`); `gems` sigue
siendo la vista de los `xp`. `kills`, `outcome`, resultados, récord e historial no cambian.

## 10. Arte y procedencia

- **Hojas** (spec `asset-provenance` y `sprite-rendering`, que coinciden con GDD y proposal):
  `Resources/Sheep/HappySheep_Idle.png` (8 fotogramas de 128, animación `idle` en `graze`),
  `Resources/Sheep/HappySheep_Bouncing.png` (6 de 128, `bounce` en `wander`/`flee`) y
  `Resources/Resources/M_Idle.png` (carne, 1 fotograma, como `G_Idle`). La spec **prohíbe** versionar
  `HappySheep_All.png`, `M_Spawn.png` y `M_Idle_(NoShadow).png`. El primer design proponía `_All`; queda como
  alternativa a decidir en el gate de tareas (§13).
- **Fácil de cambiar**: el aspecto `sheep` declara `idle` y `bounce` **cada una con su propia `sheet`** (fichero y
  tamaño de fotograma) más escala, origen, `facing` y color de reserva comunes. Con dos hojas, cada animación apunta a
  la suya; con `_All`, las dos apuntan a la misma con rangos 0–7 y 8–13. Cambiar de opción es tocar solo
  `appearance.json`, `asset-provenance.json`, los PNG y dos specs; el código no cambia. `SheepLayer` cambia de textura
  con `setTexture(key, frame)` al cambiar de animación (ya lo hace `PaintedSprite` en `PickupLayer`).
- Cada PNG va a `public/assets/tiny-swords/...` con su entrada (sha256 y bytes) en `content/asset-provenance.json` en
  el **mismo commit** (`guard-assets`). Los tests `appearance-schema.test.ts` y `resource-provenance.test.ts` dejan de
  prohibir `M_Idle` y `HappySheep` y pasan a prohibir `_All`, `M_Spawn` y `NoShadow`.
- **Reserva**: si falla cualquiera de las dos hojas de la oveja, todas las ovejas se pintan como disco del color de
  `sheep` (diámetro 2 × radio); la carne, como forma del color de `meat` (2 × `gemRadius`). Colores distintos de los
  demás (regla zod existente, ampliada a `sheep`).
- **Escala** ~0,4 (oveja) y ~0,3 (carne), origen en el centro.
- **Sin barra de vida ni aviso de curación**: basta el destello de daño y la barra del jugador.
- **API de Phaser** (vía: MCP `phaser-docs` y tipos de `node_modules/phaser`): no hay API nueva. `setTexture`,
  `setFrame`, `setFlipX` y `setTint` son métodos heredados de Sprite (componentes Texture, Flip y Tint), página
  `/api-documentation/class/gameobjects-sprite.md#inherited-methods`; la firma `setTexture(key, frame?)` se ha
  comprobado en `node_modules/phaser/types/phaser.d.ts` (la búsqueda del MCP no devolvió la entrada directa).
- **Recorte**: las ovejas no entran en el plan del mapa ni en `MapCuller`: 701/784 objetos sin cambios.

## 11. Sonda E2E

`sprites.sheep: { visible, placeholder, byState: { graze, wander, flee } }`, `sprites.pickups.meat: { visible,
placeholder }` y `snapshot.sheep`. Todo a 0 en el menú y con `map=empty`.

**Ningún E2E nuevo**: se amplía "Estructuras y guardias en el navegador" (`tests/e2e/gameplay.spec.ts`, modo manual,
mapa real, semilla 42), cuyo texto modificado ya pide que los sprites de oveja (número y estado) y de `meat` coincidan
con el snapshot sin reserva. El recuento de `logicGuard` no cambia.

## 12. Rendimiento, balance y seguridad

**Coste por tick** (≤ 5 ovejas): paso 1 con dos barridos por oveja; `settle` dos bucles de ≤ 5; nivel 2 de reserva
solo sin enemigos ni estructuras en el criterio; +5 solapes por explosión; reaparición con 2 pasadas por ≤ 2.304
celdas por hueco vencido (peor caso `capacity × 2.304` por tick sin candidatas, raro). Presupuesto < 0,05 ms/tick
añadidos, sin asignaciones en el bucle. Bench nuevo "cuatro topes llenos + ovejas en huida" (spec
`simulation-loop`, "Rendimiento con recogibles por tipo"): ≤ 2 ms, informativo, comparado con 0,27 ms (0022) y con
"Peor caso con gemas" frente a 0,25 ms.

**Mediciones**:
- **M0** (antes de tocar código, misma máquina): bench "tres topes"; lote del bot dos veces (28–32 s en 0022);
  duración de los dos tests del quieto y tick de muerte máximo del quieto sobre 1..50 (margen hasta 10.800); huella
  sha256 de `resources.json` de `main` para "Contenido de combate intacto".
- **M1** (gate de apply, al poner las ovejas en el mapa generado):
  - **Con ovejas** (spec `sheep`): victorias del bot v3 en **25–35/50** (cifra y delta semilla a semilla frente a
    `BALANCE_BASELINE`, 27) y 0 quietos supervivientes en < 10.800 con mapa generado y vacío.
  - **Con tope 0** (spec `resources`, "Balance sin recalibrar con los recursos"): exactamente 27, cada semilla con el
    mismo resultado, tick y bajas que `BALANCE_BASELINE`, 26,9 mechas (> 16,3) y 0 quietos. Es la prueba de que carne,
    cuarto tipo y reserva por niveles no cambian nada sin ovejas.
  - Informativo: curación media por partida del bot y del quieto, ovejas muertas por partida, tick de muerte máximo
    del quieto, tiempo de cada lote (local y ×2,8, tope 90 s).
- **Tests de balance**: el lote actual se queda **con ovejas** (banda, mechas > 16,3, toda partida termina) y se
  añade un lote **con tope 0** (igualdad con la línea base y 26,9 mechas), cada uno con su `beforeAll` y su timeout de
  180 s. El quieto con mapa generado corre dos veces (con ovejas y con tope 0); el del mapa vacío es igual en las dos
  configuraciones (no hay ovejas) y cubre ambos escenarios una sola vez. `balanceBaseline.ts` no se regenera.
- **Coste en `verify`**: un lote más del bot (~30 s local) y un quieto más (~50 partidas cortas). Si un test del
  quieto supera 10 s en local, se le da un timeout propio de 60 s con la medición anotada.
- **Riesgo principal: el quieto que se cura.** Defensas: la colocación deja las ovejas a > 480 px de la salida; el
  imán (128) es menor que la huida (200), así que la carne de una oveja que muere sin acercarse queda fuera del
  alcance del quieto; la reaparición va a ≥ 600 px. Una oveja sí puede pasear a < 400 px (alcance del Linter) y morir,
  pero su carne queda a ≥ 200 px.
- **Orden de ajuste si M1 falla** (solo contenido de ovejas y carne, spec `sheep`; nunca oleadas, curva, armas,
  mejoras, `player.json` ni bot):
  - quieto superviviente: `respawn.everyTicks` ↑ → `respawn.minPlayerDistance` ↑ → `meat.healPercent` ↓ →
    `maxAlive` 5 → 4 → `flee.radius` ↑;
  - victorias > 35: `meat.healPercent` ↓ → `respawn.everyTicks` ↑ → `maxMeat` ↓ → `maxAlive` 5 → 4;
  - victorias < 25: `meat.healPercent` ↑ (≤ 30) → `respawn.everyTicks` ↓ → `health` ↓;
  - si con eso no se cumple, se **para** antes de verify y decide el usuario. Si `healPercent` deja de ser 20, el
    escenario "Contenido por defecto" de `resources` (curación 20) se corrige con el spec-writer.
- **Seguridad y datos**: sin datos persistidos nuevos; la única entrada nueva es contenido validado con zod. Sin red,
  sin secretos y sin dependencias.

## Dependencias nuevas
| Paquete | Versión exacta | Motivo | Alternativa descartada |
|---|---|---|---|
| — | — | Ninguna | — |

## 13. Decisiones abiertas para el gate de tareas
1. **Hojas de la oveja**: las specs fijan `HappySheep_Idle` + `HappySheep_Bouncing` y prohíben `_All`. Las tareas
   siguen las specs; si el usuario prefiere `_All`, el spec-writer cambia `asset-provenance` y `sprite-rendering` y la
   tarea 6.1 solo cambia contenido (§10).
2. **Coste del segundo lote** en `verify` (§12): lo exige la spec `resources`; se informa en el verify-report.

## 14. Contraste con las specs (resuelto)
1. **Proyectiles por nivel**: confirmado por `auto-weapons` ("Proyectiles", pasos 3 y 4).
2. **Huida**: estricta (`d < radius`), dirección (1, 0) con `d = 0`. **Curación**:
   `valor × max(1, ⌊% × max / 100⌋)` (antes `⌊piezas · % · max / 100⌋`), no en el tick de la muerte ni en el de la
   victoria.
3. **Reaparición**: temporizador por hueco, "otra celda" = distinta de la celda de muerte (se quita
   `minDeathCells`), distancia al jugador en **px** (`minPlayerDistance`, antes `minPlayerCells`), reintento por tick
   sin consumir azar, sin separación entre ovejas; en generados con las distancias de colocación. Sin huecos por
   ovejas no colocadas.
4. **Capacidad en declarados** = número de declaradas; reaparecen (con el `random` que el escenario pasa siempre).
5. **Carne en `resources.json`** (antes `sheep.json`): la spec `resources` la pone en "Contenido de recursos
   validado" y cambia el escenario de campo desconocido a `meatPerHouse`.
6. **Arte**: dos hojas por spec (§10, §13.1).
7. **Balance**: igualdad con la línea base solo con tope 0; banda 25–35 con ovejas (§12).
8. **Deambular**: pasto/paseo con origen y radio de pasto, primer pasto aleatorio en generados, azar del flujo (antes
   hash sin estado con 8 rumbos por época).
9. **Orden del tick**: ovejas en el paso 1 tras el jugador (antes 2.5) y reaparición en 9.2.
10. **Colocación**: no excluye vetas ni montones (antes sí); `maxAlive` ≥ 0 sin máximo (antes [1, 16]).
11. **Proposal**: sus criterios de éxito cuadran con las specs. Dos matices: "barra de vida de la oveja si el patrón
    lo aplica" se resuelve en no (`sprite-rendering`); y el criterio de balance se reparte entre `sheep` (banda con
    ovejas) y `resources` (igualdad con tope 0).

## ADRs
- `docs/adr/0022-ovejas-entidad-neutral-y-flujo-de-azar-en-partida.md` (propuesta, actualizada tras el contraste):
  entidad neutral fuera de `Horde`, `SHEEP_STREAM` 5 con fases ordenadas y consumo en partida, deambular por estados
  con el flujo y reserva de las armas por niveles. Numeración confirmada libre en `origin/main` por el orquestador.
