# Goblin structures · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
Casas y torres goblin colocadas por semilla en el mapa generado, lejos de la salida, del castillo y del río. Las armas
del jugador las destruyen y quedan como ruina; una casa viva hace nacer guardias. No bloquean a nadie ni cambian la
rejilla.

## Requirements

### Requirement: Contenido de estructuras validado
El sistema SHALL leer de `content/*.json`, validados con zod antes de llegar al dominio, los tipos de estructura y los
parámetros de su colocación. El contenido por defecto MUST tener exactamente dos tipos, `goblin-house` (casa) y
`goblin-tower` (torre). Cada tipo tiene:
- una **huella** en celdas: columnas y filas, enteros ≥ 1, que caben en la rejilla del contenido;
- una **vida** > 0;
- un **radio de impacto** > 0 (el círculo con el que lo alcanzan las armas, centrado en el centro de la huella);
- el **número** de estructuras de ese tipo por mapa generado: entero ≥ 0.

La casa tiene además el **tipo de guardia** que hace nacer, el **tope de guardias** vivos por casa (entero ≥ 1) y el
**intervalo de nacimiento** (N ≥ 1 ticks enteros). El tipo de guardia MUST existir en el catálogo de enemigos y su
estado inicial MUST ser de clase patrulla (ver "Comportamiento por tipo en contenido" en `enemy-behavior`). La torre
MUST NOT tener tipo de guardia, tope ni intervalo (decisión D4: solo estructura destruible).

Los parámetros de colocación son enteros ≥ 0, en celdas: la distancia mínima de cada huella a la zona de inicio, al
castillo y al río (celdas `water` y `bridge`), y la separación mínima entre huellas de estructuras distintas.

Un valor fuera de rango, un campo ausente, un campo desconocido, un tipo de guardia inexistente o sin patrulla
inicial, o un campo de guardia en la torre MUST impedir que se muestre el menú o empiece una partida, con un error que
nombre el tipo de estructura y el campo.

#### Scenario: Contenido por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** hay exactamente 2 tipos de estructura, `goblin-house` y `goblin-tower`, cada uno con huella de ≥ 1 × 1
  celdas, vida > 0, radio de impacto > 0 y número por mapa ≥ 1
- **AND** `goblin-house` hace nacer `goblin-tnt-guard`, con tope ≥ 1 e intervalo ≥ 1 tick, y `goblin-tower` no tiene
  tipo de guardia

#### Scenario: Valores fuera de rango
- **GIVEN** el contenido por defecto con, en un caso cada vez: la vida de `goblin-house` 0 o −1; el radio de impacto
  de `goblin-tower` 0; la huella de `goblin-house` con 0 columnas, con 2,5 filas o con 65 columnas (rejilla de
  64 × 36); el número de torres −1 o 1,5; el tope de guardias 0 o 1,5; el intervalo de nacimiento 0 o equivalente a
  2,5 ticks; o la separación mínima −1
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo y, si es de un tipo, el tipo
- **AND** no se muestra el menú ni se crea ninguna partida

#### Scenario: Límites válidos
- **GIVEN** el contenido por defecto con, en un caso cada vez: el número de casas 0; el tope de guardias 1; el
  intervalo de nacimiento 1 tick; o las cuatro distancias de colocación 0
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito

#### Scenario: Guardia inválido
- **GIVEN** el contenido por defecto con, en un caso cada vez: el tipo de guardia de `goblin-house` igual a
  `goblin-ogre` (no está en el catálogo); igual a `goblin-torch` (su estado inicial es de persecución); o
  `goblin-tower` con un tipo de guardia
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra `goblin-ogre`, `goblin-torch` y `goblin-tower` respectivamente

#### Scenario: Campos ausentes o desconocidos
- **GIVEN** el contenido por defecto con `goblin-house` sin vida, en otro caso sin tope de guardias, y en otro con un
  campo extra `fireRate` en `goblin-tower`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra el campo ausente o `fireRate`

### Requirement: Estructuras en el mapa generado
El sistema SHALL colocar, en cada mapa generado, estructuras de cada tipo hasta el número de su contenido, en un
**orden fijo** (el de la lista de estructuras de la partida), con estas reglas:
- toda celda de la huella es `grass`;
- la **puerta** de una casa es el centro de la celda (c0 + ⌊columnas / 2⌋, r0 + filas), siendo c0 y r0 la primera
  columna y la primera fila de su huella: la celda justo debajo de la fila inferior, en la columna central. La celda
  de la puerta MUST estar dentro de la rejilla, ser `grass` y no pertenecer a ninguna huella. La torre no tiene puerta;
- la distancia en celdas de cada huella (y de la celda de la puerta) a las celdas de la zona de inicio, a la huella
  del castillo y a las celdas `water` y `bridge` es ≥ el parámetro respectivo de colocación;
- la distancia en celdas entre las huellas de dos estructuras distintas es ≥ la separación mínima, y ninguna huella
  contiene la puerta de otra casa.

La posición de una estructura es el centro del rectángulo de mundo de su huella. Si con un contenido dado no caben
todas, el sistema coloca las que quepan, sin error y sin incumplir ninguna regla. Con el contenido por defecto MUST
colocarse exactamente el número de cada tipo con toda semilla de 1 a 1.000, la 0 y la 4.294.967.295. El mapa vacío no
tiene estructuras; un mapa explícito solo tiene las que declare el escenario (ver "Mapa explícito y mapa vacío" en
`procedural-map`).

#### Scenario: Reglas de colocación con las semillas del conjunto
- **GIVEN** el contenido por defecto
- **WHEN** se genera el mapa de cada semilla de 1 a 1.000, de la 0 y de la 4.294.967.295
- **THEN** cada mapa tiene exactamente el número de casas y de torres del contenido
- **AND** toda celda de cada huella y de cada puerta es `grass`, ninguna huella se solapa con otra ni contiene una
  puerta, y se cumplen las distancias mínimas a la zona de inicio, al castillo y al río y la separación mínima

#### Scenario: Puerta de una casa
- **GIVEN** una casa con huella de 2 columnas × 3 filas que empieza en la columna 20 y la fila 10 (x en
  [1.200, 1.320], y en [600, 780])
- **WHEN** se calculan su posición y su puerta
- **THEN** su posición es (1.260, 690) y su puerta es (1.290, 810), centro de la celda (21, 13)

#### Scenario: Contenido sin hueco suficiente
- **GIVEN** el contenido por defecto con 500 casas por mapa
- **WHEN** se genera el mapa de la semilla 7 y se crea la partida
- **THEN** la partida se crea sin error, con < 500 casas, y todas cumplen las reglas de colocación

#### Scenario: Sin casas ni torres
- **GIVEN** el contenido por defecto con número 0 de casas y 0 de torres
- **WHEN** se crea una partida con la semilla 42 y se ejecutan 3.600 ticks
- **THEN** la lista de estructuras está vacía en todos los snapshots y ningún enemigo de tipo `goblin-tnt-guard`
  aparece

#### Scenario: Mapa vacío sin estructuras
- **GIVEN** el contenido por defecto, la semilla 42 y el mapa vacío
- **WHEN** se crea la partida
- **THEN** la lista de estructuras del snapshot está vacía

### Requirement: Colocación determinista con azar propio
El sistema SHALL colocar las estructuras a partir de la semilla con un flujo de azar propio derivado de ella, distinto
del que genera las celdas del mapa, del de la decoración y del de la partida. La misma semilla y el mismo contenido
MUST dar las mismas estructuras (tipo, huella y orden) en dos generaciones y en dos partidas. Colocar estructuras MUST
NOT cambiar ninguna celda del mapa ni la secuencia de valores que recibe el resto de la partida: las celdas de un mapa
generado son las mismas con cualquier contenido de estructuras. La firma de referencia de celdas que versionan los
tests (`tests/support/mapGolden.ts`) MUST NOT cambiar en este change; los tests MUST versionar además una firma de
referencia de las estructuras de un conjunto de semillas, que corresponde al contenido por defecto vigente.

#### Scenario: Misma semilla, mismas estructuras
- **GIVEN** el contenido por defecto y la semilla 42
- **WHEN** se crean dos partidas
- **THEN** sus listas de estructuras son iguales: mismo orden, tipos, huellas, posiciones, radios y vidas

#### Scenario: Las estructuras no cambian las celdas
- **GIVEN** el contenido por defecto y, en otra configuración, el mismo contenido con el doble de casas y 0 torres
- **WHEN** se genera el mapa de cada semilla de 1 a 50 con ambas configuraciones
- **THEN** cada semilla da las mismas celdas, celda a celda, con las dos configuraciones
- **AND** la firma de celdas de `tests/support/mapGolden.ts` es la de antes del change

#### Scenario: Firma de referencia de las estructuras
- **GIVEN** el contenido por defecto y la firma de estructuras versionada en los tests
- **WHEN** se colocan las estructuras de las semillas de la firma y se calcula su firma
- **THEN** coincide con la versionada

#### Scenario: Colocar no consume el azar de la partida
- **GIVEN** dos partidas con la semilla 7, input (0, 0) y la política de elección fija, una con el contenido por
  defecto y otra con 0 casas y 0 torres
- **WHEN** se compara el estado del `RandomGenerator` de la partida al crearlas
- **THEN** es el mismo en las dos

### Requirement: Estructuras sin colisión
El sistema SHALL tratar las estructuras como no sólidas (decisión D1-A): el jugador las atraviesa, los enemigos las
ignoran al perseguir, navegar, patrullar o volver, y las gemas que caen sobre una huella no se recolocan. Las celdas de
una huella siguen siendo `grass` a todos los efectos (colisión del jugador, campo de distancias, línea libre,
conectividad y bot de referencia).

#### Scenario: El jugador atraviesa una casa
- **GIVEN** una casa explícita con huella en columnas 20–21 y filas 10–12, y el jugador con velocidad 215 en
  (1.260, 560) con input (0, 1)
- **WHEN** se ejecutan 60 ticks
- **THEN** el jugador está en (1.260, 775) (error ≤ 0,001), igual que sin la casa

#### Scenario: Un enemigo cruza una torre
- **GIVEN** una torre explícita con huella en columnas 10–11 y filas 4–5, un jugador quieto en (900, 300) y un
  `goblin-torch` (velocidad 90) en (600, 300)
- **WHEN** se ejecutan 60 ticks
- **THEN** el `goblin-torch` está en (690, 300) (error ≤ 0,001), dentro de la huella e igual que sin la torre

### Requirement: Vida, destrucción y ruina
El sistema SHALL dar a cada estructura, al crear la partida, la vida de su tipo. Solo las armas del jugador le quitan
vida (ver "Objetivo del más cercano dentro de alcance", "Proyectiles" y "Pulso de área" en `auto-weapons`); las
explosiones de barriles y dinamitas MUST NOT dañarla (ver "Explosión de área" en `enemy-hazards`) y el contacto de
los enemigos tampoco. La vida no baja de 0. Una estructura cuya vida llega a 0 queda **destruida** en el paso de armas
de ese tick, de forma irreversible, y desde ese momento es una **ruina**:
- sigue en la lista de estructuras del snapshot hasta el final de la partida, con vida 0 y marcada como destruida;
- no es objetivo de ningún arma ni recibe daño; aplicarle daño no tiene efecto;
- una casa destruida no hace nacer más guardias (los que ya viven siguen vivos con su puesto).

Al quedar destruida, una estructura suelta **exactamente un** recogible `gold` (ver "Recogibles con tipo" en
`xp-gems`) en su posición (centro de su huella), con el oro de su tipo del contenido (oro por casa u oro por torre,
ver `resources`). Los recogibles de oro de las estructuras destruidas en un mismo tick se crean en el orden de la lista
de estructuras y después de los recogibles de las bajas del paso de armas de ese tick; participan en el paso de
recogibles de ese mismo tick. Una ruina no vuelve a soltar oro. Destruir una estructura MUST NOT soltar gema, sumar XP
ni sumar al contador de bajas, que sigue contando solo enemigos (decisión D6), y MUST NOT consumir azar. Ninguna
estructura se crea ni se repara durante la partida.

#### Scenario: Daño que no destruye
- **GIVEN** una casa explícita con vida 30 y radio de impacto 40 en (1.260, 690) y un proyectil del Linter de daño 6
  que la solapa en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** la casa sigue sin destruir con vida 24, el proyectil desaparece y no hay ningún recogible `gold` nuevo

#### Scenario: Destrucción sin XP ni baja
- **GIVEN** una partida con 5 bajas, XP 3 y 2 gemas en el suelo, y una casa explícita con vida 6 que recibe en el
  tick n un impacto del Linter de daño 6
- **WHEN** se ejecuta el tick n
- **THEN** en el snapshot del tick n la casa figura destruida con vida 0, en la misma posición de la lista
- **AND** las bajas siguen en 5, la XP en 3 y hay 2 gemas

#### Scenario: Oro de una casa destruida
- **GIVEN** oro por casa 25, el jugador quieto en (300, 900) con oro 0 y una casa explícita en columnas 20–21 y filas
  10–12 (posición (1.260, 690)) con vida 6 que recibe en el tick n un impacto del Linter de daño 6
- **WHEN** se ejecuta el tick n
- **THEN** el snapshot del tick n tiene exactamente 1 recogible `gold` nuevo, de valor 25, en (1.260, 690), y el oro
  sigue en 0 hasta que el jugador lo recoja

#### Scenario: Oro de una torre recogido
- **GIVEN** oro por torre 15, una torre explícita destruida en el tick n con su recogible `gold` en el suelo y el
  jugador que llega a solaparlo en el tick m > n con oro 0
- **WHEN** se ejecuta el tick m
- **THEN** el recogible desaparece y el oro vale 15

#### Scenario: Dos estructuras destruidas en el mismo tick
- **GIVEN** una casa h (antes en la lista) y una torre t, ambas con vida 4, un `goblin-torch` de vida 4 y un pulso de
  Tests en el tick n que deja a vida 0 a los tres
- **WHEN** se ejecuta el tick n
- **THEN** se crean en este orden la gema del `goblin-torch`, el `gold` de h con el oro por casa y el `gold` de t con
  el oro por torre
- **AND** las bajas suben exactamente en 1

#### Scenario: Una ruina no suelta más oro
- **GIVEN** una casa destruida en el tick n, cuyo recogible `gold` se ha recogido, y proyectiles que pasan por su
  posición en los ticks n + 1 a n + 600
- **WHEN** se ejecutan esos 600 ticks
- **THEN** no se crea ningún recogible `gold` nuevo y la casa sigue destruida con vida 0

#### Scenario: Daño mayor que la vida
- **GIVEN** una torre explícita con vida 4 y un impacto del Linter de daño 6 en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** la torre figura destruida con vida 0 y suelta exactamente 1 recogible `gold`

#### Scenario: Ruina hasta el final
- **GIVEN** una casa destruida en el tick n de una partida que dura hasta el tick n + 3.600 con vida suficiente
- **WHEN** se leen los snapshots de n a n + 3.600
- **THEN** la casa figura destruida con vida 0 en todos ellos

#### Scenario: Las explosiones no dañan estructuras
- **GIVEN** una casa explícita con vida 30 y radio de impacto 40 en (1.260, 690) y una dinamita de radio 48 y daño 20
  con objetivo (1.260, 690) que explota en el tick n, y en otra partida un barril que explota en ese centro
- **WHEN** se ejecuta el tick n
- **THEN** en ambas la casa sigue con vida 30 y no hay ningún recogible `gold` nuevo

#### Scenario: El oro de las estructuras no consume azar
- **GIVEN** dos partidas con la semilla 7 y el mismo estado salvo que en una el Linter destruye una casa en el tick n y
  en la otra la casa sigue en pie
- **WHEN** ambas ejecutan el tick n sin oferta de mejora ni aparición
- **THEN** el estado del `RandomGenerator` de la partida es el mismo en las dos tras el tick

### Requirement: Estructuras en el snapshot
El sistema SHALL exponer en el `RunSnapshot` la lista de estructuras de la partida, en el orden fijo de su colocación
(o de declaración, en un mapa explícito), incluidas las destruidas. Cada estructura MUST incluir un identificador único
en la partida, su tipo, su posición, su radio de impacto, su huella (primera columna, primera fila, columnas y filas),
su vida actual y si está destruida. La lista no cambia de orden ni de longitud durante la partida. Modificar desde
fuera la lista leída MUST NOT cambiar la simulación (ver "Snapshot no mutable desde fuera" en `simulation-loop`).

#### Scenario: Lista inicial
- **GIVEN** el contenido por defecto y la semilla 42
- **WHEN** se lee el snapshot antes del primer tick
- **THEN** la lista tiene tantas estructuras como casas y torres del contenido, con identificadores distintos, cada una
  con la vida de su tipo y sin destruir

#### Scenario: Orden estable tras destruir
- **GIVEN** una partida con 3 estructuras s1, s2 y s3, en ese orden
- **WHEN** s2 queda destruida y se ejecuta 1 tick
- **THEN** la lista es s1, s2, s3, con s2 destruida y vida 0

#### Scenario: Lista no mutable
- **GIVEN** una partida sin armas equipadas en el tick 10 con ≥ 1 estructura
- **WHEN** el adaptador cambia la vida de una estructura de la lista leída a 0, la marca como destruida y vacía la
  lista, y se ejecuta 1 tick
- **THEN** el snapshot del tick 11 tiene la misma lista que el del tick 10, con la vida que tenía cada estructura

<!-- historial: 0021-goblin-camps (2026-11-24) -->
<!-- historial: 0022-resources-sheep (2026-11-24) -->
