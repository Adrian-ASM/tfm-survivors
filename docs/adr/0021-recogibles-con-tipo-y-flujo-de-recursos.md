# ADR-0021 · Recogibles con tipo en una lista con tope por tipo y flujo de azar de recursos

- **Estado**: propuesta
- **Fecha**: 2026-11-24

## Contexto
Change 0022 introduce oro y madera como recursos de la partida (los gastarán 0023 y 0024) y convierte las gemas de XP
en un caso de "recogible con tipo". Hay tres fuerzas:
- El balance está calibrado (27/50 con el bot v3, 0 quietos) y depende de cómo se sueltan y se recogen las gemas,
  incluido el tope `maxGems` 300 y su relleno "suma a la más antigua".
- Montones de madera y vetas de oro se colocan por semilla sin mover `MAP_GOLDEN`, `STRUCTURE_GOLDEN` ni el azar de
  las 50 semillas de balance (ADR-0013, ADR-0020).
- Las specs piden una sola lista de recogibles en orden de creación, con tipo, valor e ids de una sola secuencia. Los
  changes siguientes (ovejas y carne, castillo-tienda, solares) añadirán tipos y leerán los contadores, así que cambiar
  el modelo después saldría caro.

## Opciones
1. Lista única con un tope **compartido** (`maxGems` para todo).
2. Lista única en orden de creación con tope y relleno **por tipo** ("suma al más antiguo de su tipo"), pool libre
   compartido de `Σ topes` e ids de una secuencia.
3. Un pool por tipo con ids propios y listas separadas en el snapshot.

Para la colocación: (a) seguir consumiendo `STRUCT_STREAM` tras las estructuras; (b) un flujo nuevo
`RESOURCE_STREAM` 4 derivado con `deriveSeed`, con intentos al azar; (c) el mismo flujo nuevo eligiendo entre las
celdas candidatas con 1 valor por recurso.

## Decisión
**Opción 2 + (c).** Con el tope por tipo, la XP nunca pierde plaza por oro o madera y su orden relativo, su tope y su
relleno se mantienen. Por eso el combate y el balance no cambian por construcción y solo se mueven los ids de las
gemas cuando hay otros tipos intercalados. La lista única cumple la spec (un snapshot, una secuencia de ids, orden de
creación sin agrupar) con una sola pasada por tick. Los contadores van en un `Stockpile` interno a `Run`.

La colocación usa su propio generador, `Mulberry32(deriveSeed(seed, RESOURCE_STREAM = 4))`. Para cada recurso, primero
las vetas y luego los montones, se elige al azar una celda de la lista de candidatas válidas en orden de filas, con un
solo valor del generador. Así se coloca el número pedido siempre que quepa, sin un número de intentos en el contenido.
Mapa, estructuras y partida nunca ven ese flujo; lo vigila `RESOURCE_GOLDEN`.

Se descartan: (1), porque la XP competiría por plaza con los recursos y el balance podría cambiar en partidas largas;
(3), porque contradice la spec (lista e ids únicos) y obliga a fusionar listas para el snapshot; (a), porque cualquier
cambio en las estructuras desplazaría los recursos y al revés; (b), porque con intentos no se garantiza el número
exacto de recursos en todas las semillas.

## Consecuencias
- Positivas: el gate de balance debe dar las mismas cifras exactas por semilla. Añadir `meat` en el change de ovejas
  es un tope más y un valor más en la unión cerrada. Colocar recursos no toca las firmas existentes.
- Negativas / costes: rellenar con el tope lleno barre la lista hasta el primer recogible de su tipo (O(n ≤ Σ topes),
  solo en desbordamiento). Hay que preasignar `Σ topes` registros. La vista `gems` del snapshot es deuda temporal.
  Cambiar `RESOURCE_STREAM`, el orden o el criterio de candidatas cambia los recursos de todas las semillas (hay que
  regenerar `RESOURCE_GOLDEN`).
- Cómo revertirla: los topes por tipo pueden fusionarse en uno sin tocar la interfaz de `PickupField`
  (`drop(kind, …)`, `step(…)`). El flujo de recursos se retira sin efecto sobre mapa ni estructuras.
