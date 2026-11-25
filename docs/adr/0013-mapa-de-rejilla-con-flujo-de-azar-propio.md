# ADR-0013 · Mapa de rejilla en el núcleo, con un flujo de azar propio derivado de la semilla

- **Estado**: aceptada (change 0015-procedural-map, archivado 2026-11-23)
- **Fecha**: 2026-11-23

## Contexto
El change 0015 añade un mapa procedural (hierba, troncos, agua, puentes) que bloquea al jugador. Los changes
siguientes (campo de flujo, campamentos, recursos, solares) se apoyarán en él. Dos fuerzas:
- **Determinismo y balance**: el balance se mide con el bot de referencia sobre las semillas 1..50
  (`run-outcome`). Si el mapa consume del mismo `RandomGenerator` que las oleadas, cualquier cambio del generador
  del mapa desplaza la secuencia de spawns y ofertas de todas las semillas.
- **Forma del mapa**: el flow-field necesita consultas por celda baratas y deterministas; la colisión del jugador
  y la conectividad necesitan una geometría simple y verificable.

`Run.start` recibe hoy un `RandomGenerator` ya sembrado (ADR-0002), no una semilla.

## Opciones
1. **Mismo flujo**: `Run.start` genera el mapa con el `random` de la partida. Sin cambios de API; acopla mapa y
   oleadas (cada retoque del generador reordena las 50 semillas).
2. **Semilla numérica al dominio**: `Run.start(config, seed)` y el dominio crea sus generadores. Rompe ADR-0002
   (el núcleo conocería el PRNG concreto).
3. **Dos instancias del puerto**: la composición siembra el mapa con `deriveSeed(seed, MAP_STREAM)` (mezcla entera
   uint32 junto a Mulberry32) y pasa un `TerrainSource` a `Run.start`; el dominio sigue sin conocer la semilla.
4. Mapa continuo (polígonos) en lugar de rejilla: colisión y conectividad más caras y difíciles de probar; el
   flow-field acabaría rasterizándolo.

## Decisión
**Opción 3 con rejilla**: `GameMap` inmutable de celdas cuadradas (⌈W/s⌉ × ⌈H/s⌉, última columna y fila
recortadas; un byte por celda), generado por una función pura del dominio con su propio `RandomGenerator`.
`TerrainSource` (`open` | `generated` | `cells`) es un valor, no un puerto; `open` es el defecto para que los tests que asumen mundo libre sigan siendo
válidos. Invariante `cellSize ≥ 2 · radio del jugador`: hace que la BFS 4-vecina por celdas equivalga a la
alcanzabilidad del círculo del jugador. Prototipo: generación ≤ 0,15 ms/mapa, colisión ~0,04 µs/tick,
conectividad 100 % en 1..1000 con rechazo.

## Consecuencias
- Positivas: el mapa se puede retocar sin reordenar las oleadas de ninguna semilla; el flow-field hereda
  `isWalkable(col, row)`; la sonda E2E y los récords reproducen el mapa desde la semilla, sin persistir nada nuevo.
- Negativas / costes: `deriveSeed`, `MAP_STREAM` y el orden de consumo del generador pasan a formar parte del
  contrato de determinismo: cambiarlos cambia todos los mapas y exige re-medir el balance. El defecto `open` puede
  ocultar una ruta de producción sin mapa (se cierra con `seededRun` como única ruta de la composición y un test de
  firma).
- Cómo revertirla: pasar a la opción 1 es local (`Run.start` genera con su `random`), pero reordena todas las
  semillas y obliga a recalibrar el balance; cambiar la rejilla por otra geometría obliga a rehacer colisión,
  conectividad, sonda y flow-field.

## Addendum · change 0016-map-art (2026-11-23, aceptado)
Contexto: el usuario pide un castillo **sólido** en la zona de inicio y el arte de Tiny Swords para el mapa.

Decisiones:
1. **Castillo en el núcleo como celda** `castle` (código 4, no caminable) con huella fija por contenido
   (`map.json` `castle`), colocada por una regla derivada del centro del mundo y escrita solo por `generateMap`.
   Alternativa descartada: castillo solo visual (el jugador nacería encima y no bloquearía).
2. **La salida es propiedad de cada `GameMap`**, no de `MapRules`: puerta del castillo en el generado; centro del
   mundo en `open` y `cells` salvo que declaren una salida (validada como posición legal del jugador). Así el
   castillo solo existe con mapa real y la simulación sin mapa no cambia.
3. **Flujo de decoración `DECOR_STREAM`** (variedad de árboles), en el adaptador: semilla de decoración
   `deriveSeed(semilla, DECOR_STREAM)` que la composición entrega a la escena (la semilla ya vive allí para la sonda
   y los récords), con un hash por celda. `StartedRun` y `RestartRun` siguen sin exponer la semilla. No forma parte
   del contrato de determinismo de la simulación (cambiarlo solo cambia el aspecto).
4. **Render del mapa con sprites en dos `Layer`** (bajo y sobre las entidades), sin textura del tamaño del mundo.
   Si el tope de 300 objetos del mapa no se cumple, la palanca es `Blitter` (un objeto por capa y hoja, con `Bob`
   por elemento) dentro del mismo adaptador, sin cambiar el plan puro.

Consecuencias: cambian todos los mapas generados (bandas del río) y la firma dorada; el balance se re-mide
(`player.speed` 215). Revertir el castillo es quitar el tipo y la huella; la salida por mapa puede quedarse.
Los enemigos siguen ignorando el mapa, castillo incluido (deuda para 0018 flow-field; saldada en 0019 por ADR-0017).

Resultado en apply: balance 27/50 con 215 (banda 25..35) y 0 quietos vivos; 196 y 245 objetos del mapa con las
semillas 42 y 123 (máximo 258 en 1..50), sin necesidad del `Blitter`; puerta visual aprobada por el usuario.

## Nota (0026)
"El mapa no cambia durante la partida" queda enmendado por ADR-0025: el terreno sigue inmutable, pero la capa de obra
de `GameMap` cambia al construir y los campos de flujo se invalidan por su revisión.
