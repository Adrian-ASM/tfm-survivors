# Spec delta · simulation-loop

<!-- Change 0002-enemy-spawning. La partida pasa a depender de una semilla: el núcleo solo obtiene aleatoriedad
     del puerto RandomGenerator. La composición elige la semilla y el núcleo nunca lee la URL.
     El snapshot crece con la lista de enemigos vivos. Si el benchmark bloquea `npm run verify`/CI o va como
     informe aparte es una pregunta abierta de la propuesta y la decide el design; el umbral lo fija esta spec. -->

## ADDED Requirements

### Requirement: Semilla de la partida
El sistema SHALL arrancar cada partida con una semilla que sea un entero sin signo de 32 bits
(de 0 a 4.294.967.295). Cuando la URL incluye `?seed=<valor>`, el valor MUST validarse con zod antes de usarse:
- Si es un entero en ese rango, la partida usa esa semilla.
- Si falta, la partida usa una semilla aleatoria del mismo rango, sin avisos.
- Si está presente pero no es válido, se ignora, la partida usa una semilla aleatoria del mismo rango y se emite
  exactamente 1 aviso por consola que menciona `seed`.

El núcleo MUST recibir la semilla ya resuelta y no conocer su origen.

#### Scenario: Semilla válida por URL
- **GIVEN** la URL `?seed=42`
- **WHEN** arranca la partida
- **THEN** la partida usa la semilla 42 y no se emite ningún aviso

#### Scenario: Límites del rango
- **GIVEN** la URL `?seed=0` y, en otra carga, `?seed=4294967295`
- **WHEN** arranca la partida
- **THEN** la partida usa la semilla 0 y 4.294.967.295 respectivamente, sin avisos

#### Scenario: Semilla inválida
- **GIVEN** la URL `?seed=-1`, `?seed=4294967296`, `?seed=1.5`, `?seed=abc` o `?seed=`
- **WHEN** arranca la partida
- **THEN** la partida arranca con una semilla entera en [0, 4.294.967.295]
- **AND** se emite exactamente 1 aviso por consola que menciona `seed`

#### Scenario: Sin semilla en la URL
- **GIVEN** una URL sin el parámetro `seed`
- **WHEN** arranca la partida
- **THEN** la partida arranca con una semilla entera en [0, 4.294.967.295] y no se emite ningún aviso

### Requirement: Rendimiento con el tope de enemigos
El sistema SHALL ejecutar un tick de simulación con 200 enemigos vivos en ≤ 2 ms de media, medido con un
benchmark de Vitest sobre el núcleo, sin motor ni render.

#### Scenario: Tope de vivos alcanzado
- **GIVEN** una partida con el contenido por defecto, semilla fija y exactamente 200 enemigos vivos
- **WHEN** el benchmark mide 600 ticks consecutivos con input (1, 0)
- **THEN** la media es ≤ 2 ms por tick

## MODIFIED Requirements

### Requirement: Determinismo
El sistema SHALL producir exactamente el mismo `RunSnapshot`, enemigos incluidos, a partir del mismo estado
inicial, la misma semilla y la misma secuencia de inputs por tick. El núcleo MUST NOT depender de reloj del
sistema, aleatoriedad global ni APIs del navegador: toda la aleatoriedad MUST venir del puerto `RandomGenerator`
inicializado con la semilla de la partida.

#### Scenario: Dos partidas idénticas
- **GIVEN** dos partidas creadas con el mismo contenido y la semilla 42
- **WHEN** ambas reciben la misma secuencia de 600 inputs (10 s) generada por una seed fija
- **THEN** sus snapshots son iguales campo a campo en cada tick, enemigos incluidos (comparación estricta, sin
  tolerancia)

#### Scenario: Semillas distintas
- **GIVEN** dos partidas creadas con el mismo contenido y las semillas 1 y 2
- **WHEN** ambas reciben la misma secuencia de 600 inputs
- **THEN** la posición de aparición de al menos 1 enemigo difiere entre las dos partidas

#### Scenario: Partida larga reproducible
- **GIVEN** dos partidas con el contenido por defecto y la semilla 7
- **WHEN** ambas reciben la misma secuencia de 36.000 inputs (10 min)
- **THEN** sus snapshots finales son iguales campo a campo

#### Scenario: Snapshot no mutable desde fuera
- **GIVEN** una partida en el tick 10 con ≥ 1 enemigo vivo
- **WHEN** el adaptador modifica el objeto `RunSnapshot` que ha recibido, incluida la posición de un enemigo
  y la lista de enemigos
- **THEN** el siguiente tick parte del estado interno, no del objeto modificado

### Requirement: Snapshot para el motor
El sistema SHALL exponer tras cada frame un `RunSnapshot` con el número de tick, la posición y el radio del
jugador y la lista de enemigos vivos, que es lo único que el adaptador de render necesita para pintar. Cada
enemigo del snapshot MUST incluir:
- un identificador único dentro de la partida, que no cambia mientras vive;
- su tipo;
- su posición;
- su radio.

La lista va ordenada por orden de aparición.

#### Scenario: Contador de ticks
- **GIVEN** una partida recién creada
- **WHEN** se ejecutan 90 ticks
- **THEN** `snapshot.tick` vale 90

#### Scenario: Partida recién creada sin enemigos
- **GIVEN** una partida recién creada
- **WHEN** se lee el snapshot antes del primer tick
- **THEN** la lista de enemigos está vacía

#### Scenario: Enemigos en el snapshot
- **GIVEN** un único tramo con `budgetPerSecond` 1 y `types: ["bug"]`, y `bug` con coste 1 y radio 10
- **WHEN** se ejecutan 615 ticks
- **THEN** el snapshot lista 10 enemigos de tipo `bug` con radio 10 e identificadores distintos
- **AND** el orden de la lista coincide con el orden de aparición

#### Scenario: Identificador estable
- **GIVEN** un enemigo con identificador X en el snapshot del tick n
- **WHEN** se ejecuta 1 tick más
- **THEN** el snapshot del tick n + 1 contiene un enemigo con identificador X, del mismo tipo y radio
