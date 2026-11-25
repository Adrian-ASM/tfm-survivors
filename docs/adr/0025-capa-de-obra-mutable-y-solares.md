# ADR-0025 · Capa de obra mutable sobre el mapa y solares como fase

- **Estado**: aceptada (change 0026-build-sites, apply 2026-11-25; pendiente de verify y archive)
- **Fecha**: 2026-11-25

## Contexto
En el change 0026 lo construido bloquea el paso al jugador y a los enemigos, y el campo de flujo tiene que
recalcularse (criterio del GDD que viene de 0019). Hasta ahora el mapa era inmutable durante la partida
(ADR-0013). `FlowField` copiaba los códigos una vez y cacheaba `blocked` (ADR-0017), y los `GuardPost`
compartían esa copia (ADR-0020). Además, unos 8 lectores consultan `GameMap.isWalkable`: el barrido del jugador
y de las ovejas, `nearestWalkable`, `placeSpawn`, la línea libre y la legalidad de las ovejas.

## Opciones
1. **Capa de obra dentro de `GameMap`**: terreno inmutable más una copia viva de códigos con `BUILT` y un
   contador `revision`. Los campos de flujo leen la copia viva y se invalidan cuando cambia la revisión.
2. Un objeto `Passability` aparte que se pasa junto al mapa a cada lector.
3. Un `GameMap` nuevo por cada obra (`withBlocked`) y volver a cablear `Run`, `FlowField` y los `GuardPost`.
4. Que no bloquee, como las estructuras goblin. Descartada por decisión del usuario.

## Decisión
Se elige la opción 1.
- **Terreno**: `typeAt`, `MapSnapshot` y las firmas no cambian.
- **Obra**: la única mutación es `GameMap.build(huella)`, que solo llama `Run` entre ticks. Sube `revision`.
- **Lectura**: `isWalkable`, los barridos y `nearestWalkable` leen la copia viva.
- **Campos de flujo**: `FlowField` lee `liveCodes`, compara la revisión en cada consulta y recalcula la BFS y
  `blocked` de forma perezosa. Los campos de guardia se invalidan solos.
- **Fase `building`**: segunda fase modal con el patrón de la tienda (extiende ADR-0023). `build` y `leaveSite` no
  consumen azar, y la puerta por proximidad se extrae a `ProximityGate`.
- **Solares**: salen de un séptimo flujo `SITE_STREAM` 7, con candidatas y 1 valor por solar (patrón de
  ADR-0021). Cada huella tiene un anillo de hierba que ninguna otra huella toca, lo que garantiza la
  conectividad.
- **Torres**: `TowerBattery` con su propio pool de proyectiles. `Arsenal` y el tope del jugador no cambian.

La opción 2 duplica parámetros en todos los lectores. La 3 rompe referencias compartidas y obliga a reconstruir
los `GuardPost`.

## Consecuencias
- Positivas:
  - Un solo punto de verdad para la caminabilidad.
  - Recalcular sale casi gratis: es perezoso y ocurre como mucho 6 veces por partida.
  - Con 0 obras todo es idéntico (`BALANCE_BASELINE` y las cinco firmas).
- Negativas / costes:
  - `GameMap` deja de ser un value object congelado: es una entidad con una capa mutable.
  - Las frases "el mapa no cambia durante la partida" de ADR-0013, ADR-0017 y ADR-0020 quedan enmendadas: el
    terreno no cambia, la obra sí.
  - Hay un código interno de celda (`BUILT`) que no es un `CellType`.
- Cómo revertirla: quitar `build`/`revision` y volver a la copia en `FlowField`. Los solares podrían seguir sin
  bloquear (opción 4).

## Addendum · resultados del apply (2026-11-25)
- Con 0 obras todo es idéntico: `BALANCE_BASELINE` (bot v4, 30/50) y las cinco firmas sin regenerar.
- Bot v5 (`builderBot`): 29/50, 1,22 casas y 0,56 torres por partida, 12,8 de oro de casas y ~5,8 bajas por flechas
  (estimación) por partida. Sin recalibrar la torre.
- Bench (local, informativo): 300 vivos + 6 torres 0,12 ms/tick frente a 0,135 sin solares; construir una casa más el
  primer tick (recálculo de campos) 0,015 ms.
- `RunSetup.sites` (tick 0) para escenarios preparados: el núcleo no puede construir sin llegar al acceso.
