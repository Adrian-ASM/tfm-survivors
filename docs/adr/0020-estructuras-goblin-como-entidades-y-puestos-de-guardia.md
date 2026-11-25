# ADR-0020 · Estructuras goblin como entidades del núcleo, puestos de guardia y flujo de azar propio

- **Estado**: aceptada (change 0021-goblin-camps, verify C0 W0 S5, PR #51)
- **Fecha**: 2026-11-24

## Contexto
El GDD pide casas y torres goblin destruibles en el mapa generado, y un TNT de guardia que patrulla, se alerta y
vuelve a su puesto (parte B de 0020). Fuerzas en juego:
- La rejilla es inmutable durante la partida ("Mapa de la partida de solo lectura"). `FlowField` la copia una vez y
  el recálculo del campo por edificios está reservado a 0025 build-sites.
- La firma dorada de celdas y el balance de las 50 semillas dependen del orden de consumo de `MAP_STREAM`
  (ADR-0013).
- El comportamiento de los enemigos es una unión cerrada de clases en contenido (ADR-0019), que ya preveía `patrol`,
  `alert` y `return`.
- Núcleo puro y determinista, sin asignaciones en el tick (ADR-0003) y ≤ 0,25 ms/tick en el peor caso.
- El bot de referencia no explora y no se puede cambiar en el mismo paso que el mapa sin perder la atribución de
  causas.

## Opciones
Representación:
1. **Entidades sin celda**: la rejilla y el campo no cambian y nadie colisiona con ellas.
2. Celdas sólidas nuevas: la rejilla muta al destruirse, hay que recalcular el campo y se adelanta 0025.
3. Sólidas solo para el jugador (máscara aparte): hay que ampliar la colisión del jugador y el bot.

Azar de la colocación:
- a. **Flujo propio** `STRUCT_STREAM`, derivado de la semilla.
- b. Seguir consumiendo `MAP_STREAM` después de los troncos.

Guardia:
- i. **Tipo nuevo `goblin-tnt-guard`** con clases `patrol`/`alert`/`return`, un puesto por casa con una ruta fija y un
  campo de distancias calculado una vez.
- ii. Reutilizar el tipo `goblin-tnt` de oleada.
- iii. Patrulla con azar propio.

## Decisión
**1 + a + i.**
- `Structure` es una entidad del núcleo (vida escalar mutable) y la posee `StructureField`, dentro de `Run`. Las
  ruinas se quedan en la lista hasta el final de la partida. Cumple `WeaponTarget`. Las armas solo eligen una
  estructura si su criterio no encuentra ningún enemigo. Un proyectil lanzado contra un enemigo atraviesa las
  estructuras. Las explosiones no las dañan y no dan recompensa.
- La colocación es `placeStructures(map, rules, random)`, pura, con
  `Mulberry32(deriveSeed(seed, STRUCT_STREAM = 3))`. Consume 2 valores por intento (columna y luego fila) y recorre
  los tipos en orden de contenido. Se ejecuta después de `generateMap`, que no cambia.
- `GuardPost` (en `enemy/`) contiene el puesto (la puerta de la casa), los 4 puntos de patrulla, una `FlowField`
  por punto (calculada una vez, porque el mapa no cambia) y el contador de guardias vivos. Los puntos son las esquinas
  de un cuadrado de radio de contenido, en orden fijo y en bucle, recolocadas a celda caminable. Para ir a un punto
  fijo se aplica la regla de la persecución con el campo de la celda del punto (ADR-0017). Todas las transiciones de
  las clases nuevas se comprueban después de moverse: `detect`, `lose`, `exit`, la llegada exacta al punto o al
  puesto. Nada consume azar.
- Orden del tick: el de ADR-0019, más el nacimiento de guardias después del director, con las casas en orden de
  lista. La primera guardia nace cuando han pasado ≥ el intervalo desde el tick 0. Las armas usan las estructuras como
  reserva en el paso 3.
- Render: cada estructura aporta al plan del mapa un aspecto intacto y otro de ruina. Una máscara de "habilitado" en
  `MapCuller` decide cuál se ve.

## Consecuencias
- Positivas:
  - La rejilla, el campo, la conectividad y la firma de celdas no cambian.
  - Las estructuras tienen su propia firma dorada.
  - La colocación queda desacoplada de futuros cambios del generador.
  - La patrulla y la vuelta mantienen el invariante "centro en celda caminable" sin pathfinding por tick.
  - El coste añadido es O(estructuras + guardias).
- Negativas / costes:
  - Las estructuras no bloquean: el jugador y los enemigos las atraviesan. Es menos creíble, y es deliberado hasta
    0025.
  - Entran en el **contrato de determinismo**: el orden de consumo de `STRUCT_STREAM`, el criterio de aceptación, el
    nacimiento de guardias y su lugar en el tick, la regla de reserva de las armas y las transiciones de las clases
    nuevas. Si cambian, cambian las partidas y hay que volver a medir el balance.
  - Unos 18 KB por punto con campo (hasta 5 por casa, unos 360 KB con 4 casas).
  - Los guardias desplazan los ids de enemigo con el mapa generado.
- Cómo revertirla: quitar `StructureField`, `GuardPost`, las clases nuevas y `STRUCT_STREAM` devuelve las partidas
  de 0020 (salvo los stats del barril de A3) y obliga a recalibrar. Pasar a las opciones 2 o 3 es el trabajo previsto
  de 0025.

## Addendum · resultados del apply
Balance por pasos (design §11) con `measureBalance` y el bot v3 sobre `BALANCE_SEEDS` 1..50. Los pasos 1 y 2 se
midieron con configuraciones de test no versionadas sobre el contenido final (sin estructuras con
`NO_STRUCTURES`; sin guardias con `everyTicks` 10⁶). La fila base usa el barril de 0020 (40/20/64) y reproduce la
línea base de la propuesta, lo que valida el rastro de mechas y explosiones.

| Paso | Victorias | Quietos vivos (gen./vacío) | Mechas/partida | Explosiones/partida | Oferta s7 | Lote local |
|---|---|---|---|---|---|---|
| Base (barril de 0020, sin estructuras) | 27 | 0 / 0 | 16,30 | 6,56 | 2.082 | 30,2 s |
| 1 · barril A3 (60/25/80), sin estructuras | 29 | 0 / 0 | 28,96 | 16,40 | 2.082 | 28,0 s |
| 2 · estructuras sin guardias | 27 | 0 / 0 | 28,84 | 16,26 | 2.082 | 28,0 s |
| **3 · contenido final** | **27** | **0 / 0** | **26,88** | **14,64** | **2.082** | **30,4 s** |

- No se recalibró nada: el contenido final está en la banda (27/50) con 0 quietos en los dos mapas. Las estructuras
  cuestan 2 victorias (dentro del margen de §11; sin guardias, el efecto esperado es la puntería sobre ellas cuando no
  hay enemigos en el criterio) y los guardias, 0 en el total (cambian las semillas ganadas, no la cuenta).
- Mechas por partida ×1,65 respecto a la base (> 16,3, test "Mechas por partida") y explosiones ×2,2.
- Firma W3 (daño de dinamita de guardia con v3 en `NONE` y ≥ 1 aviso amenazante): 0 en las 50 semillas de los tres
  pasos. El bot sigue en v3 y A2 no se aplica.
- Lote con rastro: 30,4 s en local, ≈ 85 s equivalentes en CI (×2,8) ≤ 90; `BOT_BATCH_TIMEOUT_MS` sigue en 180 s.
- Bench "peor caso con estructuras y guardias" (semilla 42, 300 guardias con cada casa en su tope, 150 en patrulla y
  150 en alerta): media 0,06–0,07 ms por tick, frente a 2 ms (gate del bench) y 0,25 ms (objetivo).
- Objetos del mapa: 695 (42) y 778 (123), ≤ 1.000. Firma de celdas sin cambios; `STRUCTURE_GOLDEN` nueva.
- El estado pasa a "aceptada" tras verify.

## Nota (0026)
"El mapa no cambia durante la partida" queda enmendado por ADR-0025: el terreno sigue inmutable, pero la capa de obra
de `GameMap` cambia al construir y los campos de flujo se invalidan por su revisión.
