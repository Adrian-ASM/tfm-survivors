# Spec delta · simulation-loop

<!-- Ruta: openspec/changes/0009-main-menu/specs/simulation-loop/spec.md
     Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test. -->

> Dependencia de archivado: este delta usa "velocidad N" y "Avance acelerado por frame" del change
> `0008-e2e-fast-sim`, ya fusionado pero aún sin archivar. 0008 MUST archivarse antes que 0009.
> Convención: "un frame de d ms a velocidad N" como en el delta de 0008; sin `?e2e`, N vale 1.

## ADDED Requirements

### Requirement: Sin tiempo acumulado durante la pausa ni antes de jugar
El sistema SHALL no ejecutar ticks ni acumular tiempo real mientras la partida está en pausa (ver `main-menu`): los
frames que el motor informe con la partida en pausa MUST ejecutar 0 ticks, sea cual sea su duración (incluidos
frames largos por una pestaña oculta), y el acumulador MUST quedar a 0 desde el momento de pausar, descartando el
tiempo sobrante que tuviera. Al reanudar no se pierde ni se gana tiempo simulado: el snapshot es el mismo que al
pausar y el bucle sigue con las reglas de "Paso fijo de simulación" y "Avance acelerado por frame", sin ráfaga de
ticks de recuperación por el tiempo pasado en pausa. Del mismo modo, la partida que empieza al pulsar `Jugar` MUST
empezar con el acumulador a 0, sin ráfaga por el tiempo pasado en el menú. Esto vale con cualquier velocidad N en
`1..15`.

#### Scenario: Frames durante la pausa
- **GIVEN** una partida en curso en el tick n
- **WHEN** se pulsa Esc y el motor informa de 300 frames de 16,667 ms
- **THEN** se ejecutan 0 ticks y el snapshot sigue igual campo a campo al del tick n

#### Scenario: Primer frame tras reanudar
- **GIVEN** la partida del escenario anterior tras sus 300 frames en pausa
- **WHEN** se pulsa Esc de nuevo y el motor informa de 16,667 ms
- **THEN** se ejecuta exactamente 1 tick y el snapshot tiene tick n + 1

#### Scenario: Frame largo durante la pausa
- **GIVEN** una partida en pausa en el tick n
- **WHEN** el motor informa de 1 frame de 5.000 ms, se reanuda y el motor informa de 16,667 ms
- **THEN** el frame de 5.000 ms ejecuta 0 ticks y el primer frame tras reanudar ejecuta exactamente 1 tick (tick
  n + 1)

#### Scenario: Sobrante descartado al pausar
- **GIVEN** un bucle con una partida en curso que, tras un frame de 25 ms, ha ejecutado 1 tick y tiene 8,333 ms
  sobrantes
- **WHEN** se pulsa Esc, se reanuda sin que el motor informe de ningún frame y el motor informa de 8,334 ms
- **THEN** ese frame ejecuta 0 ticks
- **AND** un segundo frame de 8,334 ms ejecuta exactamente 1 tick

#### Scenario: Reanudar a velocidad 8
- **GIVEN** la URL `?e2e&speed=8` y una partida en pausa en el tick n que no abre ofertas ni termina en los próximos
  16 ticks
- **WHEN** el motor informa de 300 frames de 16,667 ms, se reanuda y el motor informa de 2 frames de 16,667 ms
- **THEN** durante la pausa se ejecutan 0 ticks y tras reanudar el snapshot tiene tick n + 8 después del primer
  frame y n + 16 después del segundo

#### Scenario: Pausa a velocidad 15 con frame largo
- **GIVEN** la URL `?e2e&speed=15` y una partida en pausa en el tick n
- **WHEN** el motor informa de 1 frame de 5.000 ms
- **THEN** se ejecutan 0 ticks y el snapshot sigue en el tick n

#### Scenario: Primer frame tras Jugar
- **GIVEN** el modo menú sobre el que el motor ha informado de 600 frames de 16,667 ms y, después, de 1 frame de
  5.000 ms
- **WHEN** se pulsa `Jugar` y el motor informa de 16,667 ms
- **THEN** la partida ejecuta exactamente 1 tick y su snapshot tiene tick 1
- **AND** si en su lugar el motor informa de 8,334 ms, la partida ejecuta 0 ticks

### Requirement: Velocidad en todas las partidas de la carga
El sistema SHALL aplicar la velocidad de simulación resuelta para la carga (ver "Velocidad de simulación en modo
E2E", change 0008) a todas las partidas de esa carga: la primera, las obtenidas al reiniciar con R y las que empiezan
al pulsar `Jugar` tras `Volver al menú`. Ninguna de ellas vuelve a leer la URL ni emite avisos que mencionen `speed`.

#### Scenario: Velocidad tras volver al menú
- **GIVEN** la URL `?e2e&speed=8`, la primera partida abandonada con `Volver al menú`
- **WHEN** se pulsa `Jugar` y el motor informa de 1 frame de 16,667 ms
- **THEN** la partida nueva ejecuta exactamente 8 ticks y su snapshot tiene tick 8

#### Scenario: Velocidad inválida y varios Jugar
- **GIVEN** la URL `?e2e&speed=abc`, que emitió 1 aviso al cargar
- **WHEN** se abandona la partida con `Volver al menú` y se pulsa `Jugar`, 3 veces seguidas
- **THEN** cada partida nueva ejecuta 1 tick por frame de 16,667 ms y el total de avisos que mencionan `speed` sigue
  siendo 1

## MODIFIED Requirements

### Requirement: Semilla de la partida
El sistema SHALL arrancar cada partida con una semilla que sea un entero sin signo de 32 bits
(de 0 a 4.294.967.295). La URL se lee una sola vez por carga. La **primera partida de la carga** es la que empieza al
pulsar `Jugar` por primera vez en el menú de inicio o, si la URL incluye `?e2e`, la que empieza directamente al
cargar (ver `main-menu`). Para la primera partida de la carga, cuando la URL incluye `?seed=<valor>`, el valor MUST
validarse con zod antes de usarse:
- Si es un entero en ese rango, la partida usa esa semilla.
- Si falta, la partida usa una semilla aleatoria del mismo rango, sin avisos.
- Si está presente pero no es válido, se ignora, la partida usa una semilla aleatoria del mismo rango y se emite
  exactamente 1 aviso por consola que menciona `seed` en toda la carga, como muy tarde cuando empieza la primera
  partida.

Cada partida posterior de la misma carga, tanto la obtenida al reiniciar con R (ver `run-results`) como la que
empieza al pulsar `Jugar` tras `Volver al menú` (ver `main-menu`), MUST usar una semilla aleatoria nueva del mismo
rango, obtenida en el momento en que empieza, aunque la URL incluya `?seed=`; no vuelve a leer la URL ni emite
avisos. Una partida abandonada con `Volver al menú` cuenta como partida de la carga: el siguiente `Jugar` no
reutiliza la semilla de la URL. La elección de la semilla corresponde a la composición: el núcleo MUST recibir la
semilla ya resuelta y no conocer su origen.

#### Scenario: Semilla válida por URL
- **GIVEN** la URL `?seed=42`
- **WHEN** se pulsa `Jugar` en el menú de inicio
- **THEN** la partida usa la semilla 42 y no se emite ningún aviso

#### Scenario: Semilla válida por URL en modo E2E
- **GIVEN** la URL `?e2e&seed=42`
- **WHEN** arranca la partida al cargar
- **THEN** la partida usa la semilla 42 y no se emite ningún aviso

#### Scenario: Límites del rango
- **GIVEN** la URL `?seed=0` y, en otra carga, `?seed=4294967295`
- **WHEN** arranca la primera partida de la carga
- **THEN** la partida usa la semilla 0 y 4.294.967.295 respectivamente, sin avisos

#### Scenario: Semilla inválida
- **GIVEN** la URL `?seed=-1`, `?seed=4294967296`, `?seed=1.5`, `?seed=abc` o `?seed=`
- **WHEN** arranca la primera partida de la carga
- **THEN** la partida arranca con una semilla entera en [0, 4.294.967.295]
- **AND** se ha emitido exactamente 1 aviso por consola que menciona `seed`

#### Scenario: Sin semilla en la URL
- **GIVEN** una URL sin el parámetro `seed`
- **WHEN** arranca la primera partida de la carga
- **THEN** la partida arranca con una semilla entera en [0, 4.294.967.295] y no se emite ningún aviso

#### Scenario: Semilla nueva al reiniciar
- **GIVEN** la URL `?seed=42`, una primera partida terminada y una fuente aleatoria de la composición que en el
  siguiente sorteo da la semilla 123
- **WHEN** se pulsa R
- **THEN** la partida nueva usa la semilla 123, no la 42

#### Scenario: Semilla nueva tras volver al menú
- **GIVEN** la URL `?seed=42`, una primera partida (semilla 42) abandonada con `Volver al menú` y una fuente
  aleatoria de la composición que en el siguiente sorteo da la semilla 123
- **WHEN** se pulsa `Jugar`
- **THEN** la partida nueva usa la semilla 123, no la 42, y no se emite ningún aviso

#### Scenario: Reinicio tras una semilla inválida
- **GIVEN** la URL `?seed=abc`, que emitió 1 aviso al arrancar la primera partida, y esa partida terminada
- **WHEN** se pulsa R 3 veces, terminando cada partida antes del siguiente reinicio
- **THEN** cada partida nueva arranca con una semilla entera en [0, 4.294.967.295] y el total de avisos que mencionan
  `seed` sigue siendo 1

#### Scenario: Varios Jugar tras una semilla inválida
- **GIVEN** la URL `?seed=abc` y una carga en la que se repite 3 veces: `Jugar`, Esc, `Volver al menú`
- **WHEN** se pulsa `Jugar` una cuarta vez
- **THEN** cada una de las 4 partidas arranca con una semilla entera en [0, 4.294.967.295] y el total de avisos que
  mencionan `seed` en la carga es 1

#### Scenario: Semilla inválida antes y después de Jugar
- **GIVEN** la URL `?seed=abc` sin `?e2e`
- **WHEN** termina la carga, se pintan 300 frames en el menú sin pulsar `Jugar` y después se pulsa `Jugar`
- **THEN** durante los 300 frames no existe ninguna partida y se han emitido como mucho 1 aviso que mencione `seed`
- **AND** tras pulsar `Jugar` el total de avisos que mencionan `seed` es exactamente 1

## REMOVED Requirements
<!-- Ninguno. -->
