# Spec delta · procedural-map

<!-- Montones de madera y vetas de oro colocados por semilla con un cuarto flujo de azar propio (`RESOURCE_STREAM`,
     el design fija su valor; la proposal propone 4). No tocan celdas ni estructuras: `MAP_GOLDEN` y
     `STRUCTURE_GOLDEN` no cambian. Vocabulario en `resources`. -->

## ADDED Requirements

### Requirement: Recursos en el mapa generado
El sistema SHALL colocar, en cada mapa generado, vetas de oro y montones de madera hasta el número por mapa de cada uno
del contenido (ver "Contenido de recursos validado" en `resources`), en un **orden fijo** (el de la lista de vetas y el
de los montones iniciales de la partida), con estas reglas:
- cada veta y cada montón ocupa una celda, y su posición es el centro de esa celda;
- la celda es `grass`, no pertenece a la huella de ninguna estructura ni es la puerta de una casa (ver "Estructuras en
  el mapa generado" en `goblin-structures`);
- la distancia en celdas de la celda a las celdas de la zona de inicio y a la huella del castillo es ≥ el parámetro
  respectivo de colocación de recursos, medida igual que en la colocación de estructuras;
- dos recursos (vetas o montones) no comparten celda y la distancia en celdas entre ellos es ≥ la separación mínima de
  recursos;
- con el contenido por defecto, el centro de cada veta y de cada montón está a > 308 px del punto de salida
  (`startRadius` 180 + `pickupRadius` 128): un jugador quieto en la salida nunca atrae un montón ni toca una veta.

Si con un contenido dado no caben todos, el sistema coloca los que quepan, sin error y sin incumplir ninguna regla. Con
el contenido por defecto MUST colocarse exactamente el número de vetas y de montones con toda semilla de 1 a 1.000, la
0 y la 4.294.967.295. Las vetas y los montones no bloquean a nadie ni cambian el tipo de ninguna celda.

#### Scenario: Reglas de colocación con las semillas del conjunto
- **GIVEN** el contenido por defecto
- **WHEN** se genera el mapa de cada semilla de 1 a 1.000, de la 0 y de la 4.294.967.295 y se colocan sus recursos
- **THEN** cada mapa tiene exactamente el número de vetas y de montones del contenido
- **AND** cada uno está en el centro de una celda `grass` fuera de toda huella y puerta, sin compartir celda, y se
  cumplen las distancias a la zona de inicio y al castillo y la separación mínima
- **AND** cada centro está a > 308 px de (1.950, 1.170)

#### Scenario: Contenido sin hueco suficiente
- **GIVEN** el contenido por defecto con 2.000 vetas por mapa
- **WHEN** se genera el mapa de la semilla 7 y se crea la partida
- **THEN** la partida se crea sin error, con < 2.000 vetas, y todas cumplen las reglas de colocación

#### Scenario: Sin recursos
- **GIVEN** el contenido por defecto con 0 vetas y 0 montones por mapa
- **WHEN** se crea una partida con la semilla 42
- **THEN** la lista de vetas y la de recogibles del tick 0 están vacías

#### Scenario: Celdas intactas con recursos
- **GIVEN** el mapa de la semilla 42 con sus recursos colocados
- **WHEN** se leen las celdas de cada veta y de cada montón
- **THEN** todas son `grass` y el mapa es igual celda a celda al generado sin recursos

### Requirement: Colocación de recursos determinista con azar propio
El sistema SHALL colocar las vetas y los montones a partir de la semilla con un flujo de azar propio derivado de ella,
distinto del de las celdas del mapa, del de la decoración, del de las estructuras y del de la partida. La misma semilla
y el mismo contenido MUST dar los mismos recursos (tipo, posición y orden) en dos generaciones y en dos partidas.
Colocar recursos MUST NOT cambiar ninguna celda del mapa, ninguna estructura ni la secuencia de valores que recibe el
resto de la partida. Las firmas de referencia de celdas (`tests/support/mapGolden.ts`) y de estructuras que versionan
los tests MUST NOT cambiar en este change; los tests MUST versionar además una firma de referencia de los recursos de un
conjunto de semillas, que corresponde al contenido por defecto vigente.

#### Scenario: Misma semilla, mismos recursos
- **GIVEN** el contenido por defecto y la semilla 42
- **WHEN** se crean dos partidas
- **THEN** sus listas de vetas y de montones iniciales son iguales: mismo orden, posiciones y valores

#### Scenario: Semillas distintas, recursos distintos
- **GIVEN** el contenido por defecto
- **WHEN** se colocan los recursos de las semillas 1 a 50
- **THEN** no hay dos semillas con la misma lista de posiciones de vetas y montones

#### Scenario: Los recursos no cambian celdas ni estructuras
- **GIVEN** el contenido por defecto y, en otra configuración, el mismo contenido con el doble de vetas y 0 montones
- **WHEN** se genera el mapa y se colocan las estructuras de cada semilla de 1 a 50 con ambas configuraciones
- **THEN** cada semilla da las mismas celdas y las mismas estructuras (tipo, huella y orden) con las dos
- **AND** la firma de celdas de `tests/support/mapGolden.ts` y la de estructuras son las de antes del change

#### Scenario: Firma de referencia de los recursos
- **GIVEN** el contenido por defecto y la firma de recursos versionada en los tests
- **WHEN** se colocan los recursos de las semillas de la firma y se calcula su firma
- **THEN** coincide con la versionada

#### Scenario: Colocar recursos no consume el azar de la partida
- **GIVEN** dos partidas con la semilla 7, input (0, 0) y la política de elección fija, una con el contenido por
  defecto y otra con 0 vetas y 0 montones
- **WHEN** se compara el estado del `RandomGenerator` de la partida al crearlas
- **THEN** es el mismo en las dos

## MODIFIED Requirements

### Requirement: Azar del mapa independiente del de la partida
El sistema SHALL generar el mapa con un flujo de azar propio derivado de la semilla, distinto del que consumen
oleadas y ofertas, colocar las estructuras con otro flujo propio (ver "Colocación determinista con azar propio" en
`goblin-structures`) y colocar las vetas y los montones con otro (ver "Colocación de recursos determinista con azar
propio"): generar el mapa, colocar las estructuras o colocar los recursos MUST NOT cambiar la secuencia de valores que
recibe el resto de la partida. Con la misma semilla y el mismo punto de salida, una partida con el mapa generado y otra
con un mapa todo `grass` consumen el azar de la partida igual mientras sigan el mismo curso: recolocar una aparición,
calcular el campo de distancias, navegar por él, hacer nacer, patrullar, alertar o volver a un guardia, o crear, atraer
o recoger recogibles y agotar vetas no consume azar (cada intento de aparición gasta 1 valor en ambos mapas; ver
`enemy-spawning`). Para comparar con el mapa generado se usa el **mapa vacío con salida** (1.950, 1.170): todo `grass`,
con ese punto de salida declarado y sin estructuras ni recursos (ver "Mapa explícito y mapa vacío").

Como los enemigos navegan por el mapa (ver `enemy-behavior`) y solo el mapa generado tiene casas que hacen nacer
guardias, las dos partidas pueden divergir en contactos, bajas, gemas, ofertas y, por tanto, en el azar consumido
después; la igualdad solo se exige mientras no haya divergido nada que consuma azar. Los guardias toman identificadores
de la misma secuencia que las apariciones del director, así que la comparación de apariciones del director no exige
el mismo identificador.

#### Scenario: Mismos spawns con y sin mapa
- **GIVEN** dos partidas con el contenido por defecto, la semilla 7, input (0, 0) y la política de elección fija, una
  con el mapa generado y otra con el mapa vacío con salida (1.950, 1.170)
- **WHEN** ambas ejecutan ticks hasta que una de las dos abre su primera oferta de mejoras o termina, o hasta el tick
  1.200, lo que ocurra antes
- **THEN** las apariciones del director (sin contar los `goblin-tnt-guard` nacidos en casas) son las mismas en ambas,
  en el mismo orden: mismo tipo y mismo tick de aparición
- **AND** la posición de aparición es la misma en las dos, salvo en las apariciones del mapa generado cuyo punto cae en
  una celda no caminable, que están en la recolocación de la posición del mapa vacío (ver "Posición de aparición fuera
  de la vista" en `enemy-spawning`)
- **AND** en la partida con el mapa vacío no nace ningún `goblin-tnt-guard`

#### Scenario: Primera oferta en plazo con y sin mapa
<!-- Reformulado en apply de 0017 (decisión del usuario): con el mundo nuevo el jugador quieto ya no abre la primera
     oferta en el mismo tick con ambos mapas (semilla 7: tick 1.527 con el generado, 1.846 con el vacío con salida),
     porque el mapa cambia qué gemas alcanza. Se exige el plazo de primera subida, no la igualdad de tick ni de
     opciones. En 0019 los ticks medidos se vuelven a anotar en apply; en 0021, también (casas y guardias). En 0022
     los recursos no cambian el tick: se anota igualmente. -->
- **GIVEN** las dos partidas del escenario anterior (semilla 7, input (0, 0), política de elección fija; una con el
  mapa generado y otra con el mapa vacío con salida (1.950, 1.170))
- **WHEN** cada una se ejecuta hasta abrir su primera oferta de mejoras o hasta el tick 4.800
- **THEN** ambas abren su primera oferta en un tick ≤ 4.800 (plazo de primera subida)
- **AND** no se exige que lo hagan en el mismo tick ni con las mismas opciones

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
veta o el montón. El mapa vacío no tiene estructuras, vetas ni montones.

Un mapa dado puede declarar su punto de salida. Si no lo declara, la salida es el centro del mundo (ancho / 2,
alto / 2), sin comprobar si es legal. Si lo declara, la salida MUST ser una posición legal del jugador en ese mapa
(dentro de los límites de la arena y sin solapar celdas no caminables); si no, la partida no se crea y el error
menciona el punto de salida. El mapa vacío no declara salida: con él la partida se comporta como antes del change
0015 en movimiento, gemas, spawns y posición inicial.

Convención para todas las specs: un escenario que coloca elementos en posiciones explícitas y no declara mapa se
entiende con el mapa vacío; un escenario que usa "el contenido por defecto" y una semilla sin posiciones explícitas
juega con el mapa generado para esa semilla (con castillo, salida ante la puerta, casas, torres, guardias, vetas y
montones), salvo que diga otra cosa.

#### Scenario: Partida con mapa vacío
- **GIVEN** el contenido por defecto, la semilla 7 y el mapa vacío
- **WHEN** se crea la partida
- **THEN** sus 2.304 celdas son `grass`, ninguna es `castle`, la salida es (1.920, 1.080), no hay estructuras ni vetas
  y la lista de recogibles está vacía

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

### Requirement: Sonda del mapa para E2E
El sistema SHALL exponer, solo con `?e2e` y como parte de la sonda `window.__sprint`, el mapa de la partida en curso:
columnas, filas, `cellSize`, la lista completa de tipos de celda en orden de filas (fila 0 de izquierda a derecha,
luego la fila 1…), el recuento de celdas por tipo (incluido `castle`), la zona de inicio (centro y radio), el punto de
salida, la huella del castillo (primera y última columna y fila; `null` con el mapa vacío o explícito), si el mapa
vacío está forzado, la lista de estructuras de la partida (tipo, huella y, si es una casa, puerta), en el orden del
snapshot, y las posiciones de las vetas y de los montones iniciales, en el orden de colocación. En modo menú el mapa de
la sonda MUST valer `null`. Sin `?e2e` MUST NOT existir. Leer la sonda MUST NOT cambiar la simulación ni lo que se
pinta.

#### Scenario: Sonda coherente con el núcleo
- **GIVEN** la URL `?e2e&manual&seed=42`
- **WHEN** arranca la partida al cargar y se lee la sonda del mapa
- **THEN** informa de 64 columnas, 36 filas, `cellSize` 60, 2.304 tipos iguales uno a uno a los del mapa que genera el
  núcleo para la semilla 42, recuentos por tipo que suman 2.304 y coinciden con la lista, y zona de inicio de centro
  (1.950, 1.170) y radio 180
- **AND** su lista de estructuras es igual, una a una, a la que coloca el núcleo para la semilla 42
- **AND** sus posiciones de vetas y de montones son iguales, una a una, a las que coloca el núcleo para la semilla 42

#### Scenario: Sonda con castillo y salida [E2E]
- **GIVEN** la build de producción con `?e2e&manual&seed=42` (mapa real)
- **WHEN** arranca la partida, se pinta 1 frame y se leen la sonda del mapa y el snapshot
- **THEN** la sonda informa de 20 celdas `castle`, huella de columnas 30–34 y filas 15–18 y salida (1.950, 1.170)
- **AND** el jugador del snapshot está en (1.950, 1.170)

#### Scenario: Sonda con el mapa vacío
- **GIVEN** la URL `?e2e&map=empty&seed=42`
- **WHEN** arranca la partida al cargar y se lee la sonda del mapa
- **THEN** informa de 2.304 celdas `grass`, 0 `castle`, huella `null`, salida (1.920, 1.080), zona de inicio de
  centro (1.920, 1.080) y listas de estructuras, vetas y montones vacías

#### Scenario: Sonda en el menú
- **GIVEN** `?e2e&seed=42` y el menú tras `Volver al menú`
- **WHEN** se pinta 1 frame y se lee la sonda
- **THEN** el mapa de la sonda vale `null`
- **AND** tras pulsar `Jugar` vuelve a informar del mapa de la partida nueva

#### Scenario: Sin sonda fuera de E2E
- **GIVEN** la URL `?seed=42`
- **WHEN** termina la carga y se pulsa `Jugar`
- **THEN** `window.__sprint` es `undefined`
