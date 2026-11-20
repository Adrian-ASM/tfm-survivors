# Spec delta · simulation-loop

<!-- Ruta: openspec/changes/0008-e2e-fast-sim/specs/simulation-loop/spec.md
     Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test. -->

> Convención de este delta: "un frame de d ms a velocidad N" es un frame que el motor informa con d ms
> transcurridos mientras la velocidad de simulación resuelta para la carga vale N. "Velocidad 1" es el
> comportamiento actual descrito en "Paso fijo de simulación", "Protección contra la espiral de la muerte",
> "Sin tiempo acumulado durante la elección" y "Sin tiempo acumulado con la partida terminada".

## ADDED Requirements

### Requirement: Velocidad de simulación en modo E2E
El sistema SHALL resolver, una sola vez por carga de la página, una velocidad de simulación N entera en `1..15`
a partir de la URL:
- Si la URL **no** incluye `?e2e`, N vale 1 y el parámetro `speed` se ignora por completo, sin avisos, aunque esté
  presente y sea válido.
- Si la URL incluye `?e2e` y no incluye `speed`, N vale 1, sin avisos.
- Si la URL incluye `?e2e` y `speed=<valor>`, el valor MUST validarse con zod antes de usarse: si es un entero en
  `[1, 15]`, N vale ese entero; si no, se ignora, N vale 1 y se emite exactamente 1 aviso por consola que menciona
  `speed`.

La velocidad resuelta MUST aplicarse a la primera partida de la carga y a cada partida nueva obtenida al reiniciar
(ver `run-results`); el reinicio no vuelve a leer la URL ni emite avisos. La resolución de la velocidad corresponde a
la composición y su efecto al adaptador del motor: el núcleo (`src/domain`, `src/application`) MUST NOT recibir ni
conocer la velocidad, y la semilla, el contenido y las reglas del tick no cambian con ella.

#### Scenario: Velocidad válida en modo E2E
- **GIVEN** la URL `?e2e&speed=8`
- **WHEN** arranca la partida
- **THEN** la velocidad resuelta vale 8 y no se emite ningún aviso que mencione `speed`

#### Scenario: Límites del rango
- **GIVEN** la URL `?e2e&speed=1` y, en otra carga, `?e2e&speed=15`
- **WHEN** arranca la partida
- **THEN** la velocidad resuelta vale 1 y 15 respectivamente, sin avisos que mencionen `speed`

#### Scenario: Velocidad inválida en modo E2E
- **GIVEN** la URL `?e2e&speed=0`, `?e2e&speed=16`, `?e2e&speed=-1`, `?e2e&speed=2.5`, `?e2e&speed=abc` o
  `?e2e&speed=`
- **WHEN** arranca la partida
- **THEN** la velocidad resuelta vale 1
- **AND** se emite exactamente 1 aviso por consola que menciona `speed`

#### Scenario: Sin velocidad en modo E2E
- **GIVEN** la URL `?e2e&seed=42`
- **WHEN** arranca la partida
- **THEN** la velocidad resuelta vale 1 y no se emite ningún aviso que mencione `speed`

#### Scenario: Velocidad ignorada fuera de E2E
- **GIVEN** la URL `?speed=8` y, en otra carga, `?seed=42&speed=8`
- **WHEN** arranca la partida y el motor informa de 1 frame de 16,667 ms con la partida en curso
- **THEN** se ejecuta exactamente 1 tick
- **AND** no se emite ningún aviso que mencione `speed`

#### Scenario: Velocidad inválida ignorada fuera de E2E
- **GIVEN** la URL `?speed=abc` y, en otra carga, `?speed=16`
- **WHEN** arranca la partida
- **THEN** la velocidad resuelta vale 1 y no se emite ningún aviso que mencione `speed`

#### Scenario: Avisos independientes de seed y speed
- **GIVEN** la URL `?e2e&seed=abc&speed=abc`
- **WHEN** arranca la partida
- **THEN** se emite exactamente 1 aviso que menciona `seed` y exactamente 1 aviso que menciona `speed`

#### Scenario: La velocidad se mantiene al reiniciar
- **GIVEN** la URL `?e2e&speed=8` y una primera partida terminada
- **WHEN** se pulsa R y el motor informa de 1 frame de 16,667 ms
- **THEN** la partida nueva ejecuta exactamente 8 ticks y su snapshot tiene tick 8

#### Scenario: Reinicio tras una velocidad inválida
- **GIVEN** la URL `?e2e&speed=abc`, que emitió 1 aviso al arrancar la primera partida, y esa partida terminada
- **WHEN** se pulsa R 3 veces, terminando cada partida antes del siguiente reinicio
- **THEN** cada partida nueva ejecuta 1 tick por frame de 16,667 ms y el total de avisos que mencionan `speed`
  sigue siendo 1

### Requirement: Avance acelerado por frame
Con velocidad N, el sistema SHALL procesar cada frame que el motor informe con d ms como N avances consecutivos del
bucle de paso fijo, cada uno con d ms y con las reglas de velocidad 1 (incluido el tope de 250 ms por avance), de
modo que un frame de velocidad N ejecute los mismos ticks que N frames consecutivos de d ms a velocidad 1. El input
del jugador MUST leerse una vez por frame y aplicarse a todos los ticks de ese frame. En cuanto la partida deja de
estar en curso (se abre una oferta de mejora o la partida termina con victoria o derrota), los avances y ticks
restantes del frame MUST descartarse y el acumulador MUST quedar a 0. Mientras la partida está eligiendo mejora o
terminada, los frames MUST ejecutar 0 ticks y dejar el acumulador a 0 con cualquier N. Con N = 1 el comportamiento
MUST ser idéntico al actual.

#### Scenario: Un frame de 1/60 s a velocidad 8
- **GIVEN** un bucle recién creado con acumulador a 0, velocidad 8 y una partida en curso que no abre ofertas ni
  termina en los próximos 8 ticks
- **WHEN** el motor informa de 16,667 ms
- **THEN** se ejecutan exactamente 8 ticks y el snapshot tiene tick 8

#### Scenario: Monitor de 120 Hz a velocidad 8
- **GIVEN** un bucle recién creado, velocidad 8 y una partida en curso que no abre ofertas ni termina en los
  próximos 8 ticks
- **WHEN** el motor informa de 1 frame de 8,334 ms
- **THEN** se ejecutan exactamente 4 ticks (igual que 8 frames de 8,334 ms a velocidad 1)

#### Scenario: Velocidad máxima con frame congelado
- **GIVEN** un bucle recién creado, velocidad 15 y una partida en curso que no abre ofertas ni termina en los
  próximos 225 ticks
- **WHEN** el motor informa de 5.000 ms en un solo frame
- **THEN** se ejecutan exactamente 225 ticks (15 avances × 15 ticks)

#### Scenario: Tiempo negativo o no numérico a velocidad 8
- **GIVEN** un bucle recién creado y velocidad 8
- **WHEN** el motor informa de −10 ms o de `NaN`
- **THEN** se ejecutan 0 ticks y el acumulador no cambia

#### Scenario: Velocidad 1 sin cambios
- **GIVEN** dos bucles recién creados con el mismo estado inicial, uno sin velocidad configurada y otro con
  velocidad 1, e input (1, 0) constante
- **WHEN** ambos reciben la misma secuencia de 600 frames de 16,667 ms
- **THEN** ambos ejecutan 600 ticks y sus snapshots son iguales campo a campo tras cada frame

#### Scenario: Oferta a mitad de frame acelerado
- **GIVEN** un bucle con acumulador a 0, velocidad 8 y una partida que abrirá una oferta en el 3.er tick que ejecute
- **WHEN** el motor informa de 16,667 ms
- **THEN** se ejecutan exactamente 3 ticks, la partida está eligiendo mejora y el acumulador queda a 0
- **AND** tras elegir, un frame de 8,334 ms ejecuta 4 ticks (no hay ráfaga de los 5 ticks descartados)

#### Scenario: Fin de partida a mitad de frame acelerado
- **GIVEN** un bucle con acumulador a 0, velocidad 15 y una partida que terminará en el 1.er tick que ejecute
- **WHEN** el motor informa de 50 ms
- **THEN** se ejecuta exactamente 1 tick, la partida está terminada y el acumulador queda a 0

#### Scenario: Frames durante la elección a velocidad 15
- **GIVEN** velocidad 15 y una partida con una oferta abierta en el tick n
- **WHEN** el motor informa de 600 frames de 16,667 ms
- **THEN** se ejecutan 0 ticks y el snapshot sigue en el tick n

#### Scenario: Frames con la partida terminada a velocidad 15
- **GIVEN** velocidad 15 y una partida terminada en el tick n
- **WHEN** el motor informa de 600 frames de 16,667 ms
- **THEN** se ejecutan 0 ticks y el snapshot sigue en el tick n

#### Scenario: Input único por frame
- **GIVEN** velocidad 8, una partida en curso que no abre ofertas ni termina en los próximos 8 ticks, el jugador en
  (480, 270) con velocidad 200 y un input (1, 0) leído al empezar el frame que deja de estar activo antes de que el
  frame termine
- **WHEN** el motor informa de 16,667 ms
- **THEN** los 8 ticks del frame usan el input (1, 0) y el jugador queda en x = 480 + 8 × 3,333 (error ≤ 0,01),
  si no lo limita el borde del mundo

### Requirement: Mismo resultado con cualquier velocidad
El sistema SHALL producir el mismo desenlace de partida con cualquier velocidad N en `1..15` para la misma semilla,
el mismo contenido, input constante y la política de elección fija: resultado (victoria o derrota), tick en que
termina, nivel, bajas y lista de mejoras adquiridas con sus niveles MUST ser idénticos a los de velocidad 1. La
velocidad solo cambia cuántos ticks se ejecutan por frame, no cuáles ni en qué orden.

#### Scenario: Derrota equivalente con la semilla 42
- **GIVEN** cuatro partidas con el contenido por defecto, la semilla 42, input (0, 0) constante y la política de
  elección fija, a velocidades 1, 4, 8 y 15
- **WHEN** el motor informa de frames de 16,667 ms hasta que cada partida termina o hasta 36.000 ticks
- **THEN** las cuatro terminan con el mismo resultado, en el mismo tick, con el mismo nivel, las mismas bajas y la
  misma lista de mejoras adquiridas con sus niveles

#### Scenario: Derrota equivalente con la semilla 90
- **GIVEN** dos partidas con el contenido por defecto, la semilla 90, input (0, 0) constante y la política de
  elección fija, a velocidades 1 y 8
- **WHEN** el motor informa de frames de 16,667 ms hasta que cada partida termina o hasta 36.000 ticks
- **THEN** ambas terminan con el mismo resultado, en el mismo tick, con el mismo nivel, las mismas bajas y la misma
  lista de mejoras adquiridas con sus niveles

#### Scenario: Equivalencia con frames irregulares
- **GIVEN** dos partidas con el contenido por defecto, la semilla 7, input (1, 0) constante y la política de
  elección fija, una a velocidad 1 y otra a velocidad 8
- **WHEN** ambas reciben frames con duraciones que alternan 8,334 ms, 16,667 ms y 33,334 ms hasta que terminan o
  hasta 36.000 ticks
- **THEN** ambas terminan con el mismo resultado, en el mismo tick, con el mismo nivel, las mismas bajas y la misma
  lista de mejoras adquiridas con sus niveles

#### Scenario: Snapshots iguales tick a tick
- **GIVEN** dos partidas con el contenido por defecto, la semilla 42, input (0, 0) constante y la política de
  elección fija, a velocidades 1 y 8
- **WHEN** ambas avanzan hasta el tick 1.200
- **THEN** el snapshot de la partida a velocidad 8 en el tick 1.200 es igual campo a campo al de la partida a
  velocidad 1 en el tick 1.200

## MODIFIED Requirements
<!-- Ninguno. Los requisitos vivos describen la velocidad 1, que no cambia: "Avance acelerado por frame" los
     reutiliza por avance y exige comportamiento idéntico con N = 1. -->

## REMOVED Requirements
<!-- Ninguno. -->
