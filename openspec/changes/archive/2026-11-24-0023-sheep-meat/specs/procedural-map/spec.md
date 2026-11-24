# Spec delta · procedural-map

<!-- Change 0023-sheep-meat: colocación inicial de las ovejas en el mapa generado con un flujo de azar propio, su firma
     de referencia y ovejas declaradas en un mapa explícito. -->

## ADDED Requirements

### Requirement: Ovejas en el mapa generado
El sistema SHALL colocar, en cada mapa generado, ovejas hasta el tope de ovejas vivas del contenido (ver "Contenido de
las ovejas validado" en `sheep`), en un **orden fijo** (el de la lista de ovejas del tick 0), con estas reglas:
- cada oveja ocupa una celda y su posición inicial (y su punto de origen) es el centro de esa celda;
- la celda es `grass`, no pertenece a la huella de ninguna estructura ni es la puerta de una casa (ver "Estructuras en
  el mapa generado" en `goblin-structures`);
- la distancia en celdas de la celda a las celdas de la zona de inicio y a la huella del castillo es ≥ el parámetro
  respectivo de colocación de las ovejas, medida igual que en la colocación de estructuras;
- dos ovejas no comparten celda y la distancia en celdas entre ellas es ≥ la separación mínima entre ovejas;
- con el contenido por defecto, el centro de cada oveja está a más de radio de huida + radio de pasto + velocidad de
  paseo × duración de paseo / 60 del punto de salida: un jugador quieto en la salida nunca hace huir a una oveja que no
  ha huido.

La colocación no tiene en cuenta las vetas ni los montones (una oveja puede empezar en la celda de un recurso; no la
bloquea). Si con un contenido dado no caben todas, el sistema coloca las que quepan, sin error y sin incumplir ninguna
regla. Con el contenido por defecto MUST colocarse exactamente el tope con toda semilla de 1 a 1.000, la 0 y la
4.294.967.295. Las ovejas no cambian el tipo de ninguna celda.

#### Scenario: Reglas de colocación con las semillas del conjunto
- **GIVEN** el contenido por defecto
- **WHEN** se genera el mapa de cada semilla de 1 a 1.000, de la 0 y de la 4.294.967.295 y se colocan sus ovejas
- **THEN** cada mapa tiene exactamente el tope de ovejas vivas del contenido
- **AND** cada una está en el centro de una celda `grass` fuera de toda huella y puerta, sin compartir celda, y se
  cumplen las distancias a la zona de inicio y al castillo, la separación mínima y la distancia a la salida

#### Scenario: Contenido sin hueco suficiente
- **GIVEN** el contenido por defecto con tope de ovejas 2.000
- **WHEN** se genera el mapa de la semilla 7 y se crea la partida
- **THEN** la partida se crea sin error, con < 2.000 ovejas, y todas cumplen las reglas de colocación

#### Scenario: Sin ovejas
- **GIVEN** el contenido por defecto con tope de ovejas 0
- **WHEN** se crea una partida con la semilla 42 y se ejecutan 3.600 ticks
- **THEN** la lista de ovejas está vacía en todos los snapshots y no hay ningún recogible `meat`

#### Scenario: Celdas intactas con ovejas
- **GIVEN** el mapa de la semilla 42 con sus ovejas colocadas
- **WHEN** se leen las celdas de cada oveja
- **THEN** todas son `grass` y el mapa es igual celda a celda al generado sin ovejas

### Requirement: Colocación de ovejas determinista con azar propio
El sistema SHALL colocar las ovejas a partir de la semilla con un flujo de azar propio derivado de ella (parte del azar
de las ovejas, ver "Ovejas deterministas" en `sheep`), distinto del de las celdas del mapa, del de la decoración, del
de las estructuras, del de los recursos y del de la partida. La misma semilla y el mismo contenido MUST dar las mismas
ovejas iniciales (posición y orden) en dos generaciones y en dos partidas, sea cual sea lo que ocurra después en la
partida. Colocar ovejas MUST NOT cambiar ninguna celda del mapa, ninguna estructura, ningún recurso ni la secuencia de
valores que recibe el resto de la partida. Las firmas de referencia de celdas (`tests/support/mapGolden.ts`), de
estructuras y de recursos que versionan los tests MUST NOT cambiar en este change; los tests MUST versionar además una
firma de referencia de las ovejas iniciales de un conjunto de semillas que incluye la 42 y la 123, que corresponde al
contenido por defecto vigente.

#### Scenario: Misma semilla, mismas ovejas
- **GIVEN** el contenido por defecto y la semilla 42
- **WHEN** se crean dos partidas y en una se ejecutan 3.600 ticks con un input aleatorio
- **THEN** sus listas de ovejas del tick 0 son iguales: mismo orden y posiciones
- **AND** una tercera partida creada después con la semilla 42 tiene la misma lista en el tick 0

#### Scenario: Semillas distintas, ovejas distintas
- **GIVEN** el contenido por defecto
- **WHEN** se colocan las ovejas de las semillas 1 a 50
- **THEN** no hay dos semillas con la misma lista de posiciones iniciales de ovejas

#### Scenario: Las ovejas no cambian celdas, estructuras ni recursos
- **GIVEN** el contenido por defecto y, en otra configuración, el mismo contenido con tope de ovejas 0
- **WHEN** se genera el mapa y se colocan las estructuras y los recursos de cada semilla de 1 a 50 con ambas
  configuraciones
- **THEN** cada semilla da las mismas celdas, las mismas estructuras y los mismos recursos con las dos
- **AND** la firma de celdas de `tests/support/mapGolden.ts`, la de estructuras y la de recursos son las de antes del
  change

#### Scenario: Firma de referencia de las ovejas
- **GIVEN** el contenido por defecto y la firma de ovejas versionada en los tests
- **WHEN** se colocan las ovejas de las semillas de la firma (42 y 123 incluidas) y se calcula su firma
- **THEN** coincide con la versionada

#### Scenario: Colocar ovejas no consume el azar de la partida
- **GIVEN** dos partidas con la semilla 7, input (0, 0) y la política de elección fija, una con el contenido por
  defecto y otra con tope de ovejas 0
- **WHEN** se compara el estado del `RandomGenerator` de la partida al crearlas
- **THEN** es el mismo en las dos

## MODIFIED Requirements

### Requirement: Mapa explícito y mapa vacío
El sistema SHALL permitir crear una partida con un mapa dado en lugar del generado, en particular el **mapa vacío**
(todas las celdas `grass`, del tamaño de rejilla que dicte el contenido). Un mapa dado MUST tener las dimensiones de
rejilla del contenido; si no, la partida no se crea y el error lo dice. Un mapa dado no tiene que cumplir
"Composición del mapa", "Zona de inicio" ni "Conectividad" (lo usan los tests para fijar casos) y puede contener
celdas de cualquier tipo, también `castle`; al mapa dado no se le añade ningún castillo y no tiene huella (sus celdas
`castle` son celdas sueltas no caminables).

Un mapa dado no tiene estructuras salvo las que declare (tipo y huella de cada una, ver `goblin-structures`), sin
reglas de colocación: cada huella declarada MUST caber en la rejilla y, si es una casa, también la celda de su
puerta; si no, la partida no se crea y el error menciona la estructura. Del mismo modo, un mapa dado no tiene vetas ni
montones de madera salvo los que declare (posición de cada uno; el valor es el del contenido), sin reglas de
colocación: cada posición declarada MUST estar dentro del mundo; si no, la partida no se crea y el error menciona la
veta o el montón. Tampoco tiene ovejas salvo las que declare (posición de cada una, en el orden de la lista de ovejas;
la vida y el resto de parámetros son los del contenido, salvo los que fije el escenario), sin reglas de colocación ni
tope: cada posición declarada MUST ser una posición legal de una oveja (su círculo dentro de los límites del mundo y sin
solapar celdas no caminables); si no, la partida no se crea y el error menciona la oveja. Las ovejas declaradas
reaparecen con "Reaparición de ovejas" (`sheep`). El mapa vacío no tiene estructuras, vetas, montones ni ovejas.

Un mapa dado puede declarar su punto de salida. Si no lo declara, la salida es el centro del mundo (ancho / 2,
alto / 2), sin comprobar si es legal. Si lo declara, la salida MUST ser una posición legal del jugador en ese mapa
(dentro de los límites de la arena y sin solapar celdas no caminables); si no, la partida no se crea y el error
menciona el punto de salida. El mapa vacío no declara salida: con él la partida se comporta como antes del change
0015 en movimiento, gemas, spawns y posición inicial.

Convención para todas las specs: un escenario que coloca elementos en posiciones explícitas y no declara mapa se
entiende con el mapa vacío; un escenario que usa "el contenido por defecto" y una semilla sin posiciones explícitas
juega con el mapa generado para esa semilla (con castillo, salida ante la puerta, casas, torres, guardias, vetas,
montones y ovejas), salvo que diga otra cosa. Un escenario que coloca una oveja de prueba en el mapa vacío la declara
como oveja del mapa.

#### Scenario: Partida con mapa vacío
- **GIVEN** el contenido por defecto, la semilla 7 y el mapa vacío
- **WHEN** se crea la partida
- **THEN** sus 2.304 celdas son `grass`, ninguna es `castle`, la salida es (1.920, 1.080), no hay estructuras, vetas ni
  ovejas y la lista de recogibles está vacía

#### Scenario: Mapa de dimensiones incorrectas
- **GIVEN** el contenido por defecto y un mapa dado de 32 × 18 celdas (la rejilla anterior a este change)
- **WHEN** se intenta crear la partida
- **THEN** no se crea y el error menciona las dimensiones del mapa

#### Scenario: Mapa explícito con salida declarada
- **GIVEN** el contenido por defecto, la semilla 7 y el mapa vacío con salida (1.950, 1.170)
- **WHEN** se crea la partida
- **THEN** sus 2.304 celdas son `grass` y la salida es (1.950, 1.170)

#### Scenario: Salida declarada ilegal
- **GIVEN** el contenido por defecto y un mapa de hierba con un tronco en (10, 4) (x en [600, 660], y en [240, 300])
  que declara, en un caso cada vez, la salida (630, 270) (dentro del tronco), (590, 270) (a 10 px del tronco) o
  (10, 540) (a menos del radio del borde izquierdo)
- **WHEN** se intenta crear la partida
- **THEN** no se crea y el error menciona el punto de salida
- **AND** con la salida (584, 270), tangente al tronco, la partida se crea

#### Scenario: Mapa explícito con celdas de castillo
- **GIVEN** el contenido por defecto y un mapa de hierba con la celda (3, 3) `castle`, sin salida declarada
- **WHEN** se crea la partida
- **THEN** la (3, 3) es la única celda `castle` y la salida es (1.920, 1.080)

#### Scenario: Mapa explícito con estructuras declaradas
- **GIVEN** el contenido por defecto y el mapa vacío con una casa declarada en columnas 20–21 y filas 10–12 y una
  torre declarada en columnas 40–41 y filas 5–6
- **WHEN** se crea la partida
- **THEN** la lista de estructuras tiene exactamente esas 2, en ese orden, y las 2.304 celdas siguen siendo `grass`

#### Scenario: Estructura declarada fuera de la rejilla
- **GIVEN** el contenido por defecto y el mapa vacío con una casa declarada en columnas 63–64 y filas 10–12, y en
  otro caso en columnas 20–21 y filas 33–35 (su puerta caería en la fila 36)
- **WHEN** se intenta crear la partida
- **THEN** no se crea y el error menciona la estructura

#### Scenario: Mapa explícito con vetas y montones declarados
- **GIVEN** el contenido por defecto y el mapa vacío con una veta declarada en (1.000, 1.000) y dos montones en
  (600, 600) y (700, 600), en ese orden
- **WHEN** se crea la partida
- **THEN** la lista de vetas tiene exactamente esa veta, activa, con el oro por veta del contenido, y la de recogibles
  del tick 0 tiene exactamente 2 `wood`, en esas posiciones y en ese orden, con la madera por montón del contenido

#### Scenario: Recurso declarado fuera del mundo
- **GIVEN** el contenido por defecto y el mapa vacío con una veta declarada en (4.000, 1.000), y en otro caso un montón
  en (100, −5)
- **WHEN** se intenta crear la partida
- **THEN** no se crea y el error menciona la veta o el montón respectivamente

#### Scenario: Mapa explícito con ovejas declaradas
- **GIVEN** el contenido por defecto y el mapa vacío con ovejas declaradas en (1.000, 1.000) y (1.500, 600), en ese
  orden, y en otro caso 7 ovejas declaradas (más que el tope por defecto)
- **WHEN** se crea la partida
- **THEN** la lista de ovejas del tick 0 tiene exactamente las declaradas, en ese orden, cada una con la vida del
  contenido, en estado `graze` y con su punto de origen en su posición, y las 2.304 celdas siguen siendo `grass`

#### Scenario: Oveja declarada ilegal
- **GIVEN** el contenido por defecto, un radio de oveja 20 y un mapa de hierba con un tronco en (10, 4) que declara, en
  un caso cada vez, una oveja en (630, 270) (dentro del tronco), (590, 270) (a 10 px del tronco) o (10, 540) (a menos de
  su radio del borde izquierdo)
- **WHEN** se intenta crear la partida
- **THEN** no se crea y el error menciona la oveja
- **AND** con la oveja en (580, 270), tangente al tronco, la partida se crea
