# Spec delta · simulation-loop

<!-- Change 0003-collisions-and-damage. Se fija el orden de los pasos del tick, el snapshot crece con la vida del
     jugador, su invulnerabilidad y el estado de la partida, la lista de enemigos admite bajas sin reordenarse,
     el adaptador pinta exactamente los vivos y el rendimiento se revalida con colisiones activas.
     Cómo se dan de baja los enemigos y cómo se asocian los sprites lo decide el design; esta spec solo exige
     que el orden relativo de los vivos sea el de aparición. -->

## ADDED Requirements

### Requirement: Orden de los pasos del tick
El sistema SHALL ejecutar cada tick de una partida en curso en este orden:
1. movimiento del jugador según el input;
2. persecución de los enemigos vivos hacia la nueva posición del jugador;
3. contacto y daño al jugador (ver `player-health`); si la vida llega a 0, la partida termina y el tick acaba aquí;
4. director de oleadas (spawns).

En una partida terminada no se ejecuta ningún paso (ver `run-state`).

#### Scenario: El contacto usa las posiciones tras moverse ambos
- **GIVEN** un jugador en (480, 270) con radio 16, velocidad 200, vida 100 e input (1, 0), y un enemigo con
  radio 10, velocidad 60 y damage 10 en (510, 270) (distancia inicial 30 > 26)
- **WHEN** se ejecuta 1 tick (jugador en 483,333; enemigo en 509; distancia 25,667 < 26)
- **THEN** la vida del jugador vale 90

#### Scenario: Solo el movimiento del jugador no basta
- **GIVEN** un jugador en (480, 270) con radio 16, velocidad 200, vida 100 e input (1, 0), y un enemigo con
  radio 10, velocidad 60 y damage 10 en (512, 270)
- **WHEN** se ejecuta 1 tick (jugador en 483,333; enemigo en 511; distancia 27,667 > 26)
- **THEN** la vida del jugador sigue valiendo 100

#### Scenario: Un enemigo recién aparecido no golpea en su tick de aparición
- **GIVEN** el contenido de spawn por defecto (`minDistance` 200) y un jugador quieto
- **WHEN** aparece un enemigo en el tick n
- **THEN** la vida del jugador tras el tick n es la misma que tras el tick n − 1, si ningún otro enemigo le toca

### Requirement: Pintado de los enemigos vivos
El adaptador de render SHALL mostrar en cada frame exactamente un sprite visible por cada enemigo del último
snapshot, en su posición y con la apariencia y el tamaño de su tipo, también después de bajas. MUST NOT quedar
visible ningún sprite de un enemigo dado de baja.

#### Scenario: Bajas en medio de la lista
- **GIVEN** un snapshot con 10 enemigos de identificadores 1 a 10 y tipos mezclados ya pintado
- **WHEN** se pinta un snapshot en el que los enemigos 3 y 7 se han dado de baja y el resto no se ha movido
- **THEN** hay exactamente 8 sprites de enemigo visibles
- **AND** para cada enemigo del snapshot hay un sprite visible en su posición (error ≤ 0,001) con la apariencia
  y el tamaño de su tipo

#### Scenario: Todos dados de baja
- **GIVEN** un snapshot con 200 enemigos ya pintado
- **WHEN** se pinta un snapshot sin enemigos
- **THEN** no hay ningún sprite de enemigo visible

#### Scenario: Reposición tras bajas
- **GIVEN** un snapshot con 200 enemigos ya pintado
- **WHEN** se pinta un snapshot con 150 de esos enemigos y 50 enemigos nuevos de otro tipo
- **THEN** hay exactamente 200 sprites visibles, cada uno con la posición, apariencia y tamaño de un enemigo
  distinto del snapshot

## MODIFIED Requirements

### Requirement: Determinismo
El sistema SHALL producir exactamente el mismo `RunSnapshot`, enemigos, vida, invulnerabilidad y estado de la
partida incluidos, a partir del mismo estado inicial, la misma semilla y la misma secuencia de inputs por tick.
El núcleo MUST NOT depender de reloj del sistema, aleatoriedad global ni APIs del navegador: toda la aleatoriedad
MUST venir del puerto `RandomGenerator` inicializado con la semilla de la partida.

#### Scenario: Dos partidas idénticas
- **GIVEN** dos partidas creadas con el mismo contenido y la semilla 42
- **WHEN** ambas reciben la misma secuencia de 600 inputs (10 s) generada por una seed fija
- **THEN** sus snapshots son iguales campo a campo en cada tick, enemigos, vida, invulnerabilidad y estado
  incluidos (comparación estricta, sin tolerancia)

#### Scenario: Semillas distintas
- **GIVEN** dos partidas creadas con el mismo contenido y las semillas 1 y 2
- **WHEN** ambas reciben la misma secuencia de 600 inputs
- **THEN** la posición de aparición de al menos 1 enemigo difiere entre las dos partidas

#### Scenario: Partida con contactos reproducible
- **GIVEN** dos partidas con el contenido por defecto y la semilla 42, con input (0, 0) en todos los ticks
- **WHEN** ambas ejecutan 3.600 ticks y en ese tiempo el jugador recibe ≥ 1 golpe
- **THEN** sus snapshots son iguales campo a campo en cada tick, incluidos la vida, la invulnerabilidad, el
  estado y, si la hay, el tick en que la partida termina

#### Scenario: Partida larga reproducible
- **GIVEN** dos partidas con el contenido por defecto y la semilla 7
- **WHEN** ambas reciben la misma secuencia de 36.000 inputs (10 min)
- **THEN** sus snapshots finales son iguales campo a campo

#### Scenario: Snapshot no mutable desde fuera
- **GIVEN** una partida en el tick 10 con ≥ 1 enemigo vivo
- **WHEN** el adaptador modifica el objeto `RunSnapshot` que ha recibido, incluidas la posición de un enemigo,
  la lista de enemigos, la vida del jugador, su invulnerabilidad y el estado de la partida
- **THEN** el siguiente tick parte del estado interno, no del objeto modificado

### Requirement: Snapshot para el motor
El sistema SHALL exponer tras cada frame un `RunSnapshot` con lo único que el adaptador de render necesita para
pintar:
- el número de tick;
- la posición y el radio del jugador;
- la vida actual y la vida máxima del jugador;
- si el jugador está invulnerable (ver `player-health`);
- el estado de la partida: en curso o terminada (ver `run-state`);
- la lista de enemigos vivos.

Cada enemigo del snapshot MUST incluir:
- un identificador único dentro de la partida, que no cambia mientras vive y no se reutiliza tras su baja;
- su tipo;
- su posición;
- su radio;
- su vida actual (> 0, ya que solo se listan enemigos vivos).

La lista contiene solo enemigos vivos y va ordenada por orden de aparición. Una baja MUST quitar al enemigo de la
lista sin cambiar el orden relativo de los demás.

#### Scenario: Contador de ticks
- **GIVEN** una partida recién creada
- **WHEN** se ejecutan 90 ticks
- **THEN** `snapshot.tick` vale 90

#### Scenario: Partida recién creada
- **GIVEN** una partida recién creada con vida máxima 100
- **WHEN** se lee el snapshot antes del primer tick
- **THEN** la lista de enemigos está vacía
- **AND** la vida actual y la máxima valen 100, el jugador no está invulnerable y el estado es en curso

#### Scenario: Enemigos en el snapshot
- **GIVEN** un único tramo con `budgetPerSecond` 1 y `types: ["bug"]`, y `bug` con coste 1 y radio 10
- **WHEN** se ejecutan 615 ticks
- **THEN** el snapshot lista 10 enemigos de tipo `bug` con radio 10 e identificadores distintos
- **AND** cada uno tiene una vida actual igual al `health` de `bug`
- **AND** el orden de la lista coincide con el orden de aparición

#### Scenario: Identificador estable
- **GIVEN** un enemigo vivo con identificador X en el snapshot del tick n
- **WHEN** se ejecuta 1 tick más sin que X se dé de baja
- **THEN** el snapshot del tick n + 1 contiene un enemigo con identificador X, del mismo tipo y radio

#### Scenario: Bajas sin reordenar
- **GIVEN** un snapshot con 10 enemigos vivos cuyos identificadores, en orden de aparición, son a1 … a10
- **WHEN** a3 y a7 quedan dados de baja y se ejecuta 1 tick sin nuevos spawns
- **THEN** la lista del snapshot es exactamente a1, a2, a4, a5, a6, a8, a9, a10, en ese orden

#### Scenario: Reposición al final de la lista
- **GIVEN** la partida del escenario anterior
- **WHEN** aparecen 2 enemigos nuevos b1 y b2, en ese orden
- **THEN** la lista del snapshot es a1, a2, a4, a5, a6, a8, a9, a10, b1, b2

#### Scenario: Baja del primero y del último
- **GIVEN** un snapshot con 200 enemigos vivos a1 … a200
- **WHEN** a1 y a200 quedan dados de baja y se ejecuta 1 tick sin nuevos spawns
- **THEN** la lista del snapshot es a2 … a199, en ese orden

### Requirement: Rendimiento con el tope de enemigos
El sistema SHALL ejecutar un tick de simulación con 200 enemigos vivos y la detección de contacto activa en
≤ 2 ms de media, medido con un benchmark de Vitest sobre el núcleo, sin motor ni render. La partida medida MUST
seguir en curso durante todos los ticks medidos, de modo que se midan los pasos completos del tick.

#### Scenario: Tope de vivos alcanzado
- **GIVEN** una partida con el contenido por defecto, semilla fija, exactamente 200 enemigos vivos y una
  vida del jugador suficiente para no llegar a 0 en 600 ticks
- **WHEN** el benchmark mide 600 ticks consecutivos con input (1, 0)
- **THEN** la media es ≤ 2 ms por tick

#### Scenario: 200 enemigos encima del jugador
- **GIVEN** una partida con semilla fija, 200 enemigos vivos en contacto con el jugador y una vida del jugador
  suficiente para no llegar a 0 en 600 ticks
- **WHEN** el benchmark mide 600 ticks consecutivos
- **THEN** la media es ≤ 2 ms por tick y la partida sigue en curso al terminar la medición
