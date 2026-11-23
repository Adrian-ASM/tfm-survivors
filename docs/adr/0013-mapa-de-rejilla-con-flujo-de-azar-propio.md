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
