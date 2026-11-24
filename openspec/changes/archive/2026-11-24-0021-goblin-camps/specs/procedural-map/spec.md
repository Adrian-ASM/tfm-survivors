# Spec delta · procedural-map

<!-- Change 0021-goblin-camps. El mapa generado incluye casas y torres goblin (ver `goblin-structures`), que no son
     celdas: la rejilla, la composición, la zona de inicio, la conectividad, el campo de distancias y la firma de
     celdas no cambian (D1-A, D2). Se modifica a propósito "Mismos spawns con y sin mapa": los guardias de las casas solo
     existen con el mapa generado y toman identificadores de la misma secuencia que las apariciones del director. -->

## MODIFIED Requirements

### Requirement: Azar del mapa independiente del de la partida
El sistema SHALL generar el mapa con un flujo de azar propio derivado de la semilla, distinto del que consumen
oleadas y ofertas, y colocar las estructuras con otro flujo propio (ver "Colocación determinista con azar propio" en
`goblin-structures`): generar el mapa o colocar las estructuras MUST NOT cambiar la secuencia de valores que recibe el
resto de la partida. Con la misma semilla y el mismo punto de salida, una partida con el mapa generado y otra con un
mapa todo `grass` consumen el azar de la partida igual mientras sigan el mismo curso: recolocar una aparición,
calcular el campo de distancias, navegar por él o hacer nacer, patrullar, alertar o volver a un guardia no consume
azar (cada intento de aparición gasta 1 valor en ambos mapas; ver `enemy-spawning`). Para comparar con el mapa
generado se usa el **mapa vacío con salida** (1.950, 1.170): todo `grass`, con ese punto de salida declarado y sin
estructuras (ver "Mapa explícito y mapa vacío").

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
     opciones. En 0019 los ticks medidos se vuelven a anotar en apply; en 0021, también (casas y guardias). -->
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
puerta; si no, la partida no se crea y el error menciona la estructura. El mapa vacío no tiene estructuras.

Un mapa dado puede declarar su punto de salida. Si no lo declara, la salida es el centro del mundo (ancho / 2,
alto / 2), sin comprobar si es legal. Si lo declara, la salida MUST ser una posición legal del jugador en ese mapa
(dentro de los límites de la arena y sin solapar celdas no caminables); si no, la partida no se crea y el error
menciona el punto de salida. El mapa vacío no declara salida: con él la partida se comporta como antes del change
0015 en movimiento, gemas, spawns y posición inicial.

Convención para todas las specs: un escenario que coloca elementos en posiciones explícitas y no declara mapa se
entiende con el mapa vacío; un escenario que usa "el contenido por defecto" y una semilla sin posiciones explícitas
juega con el mapa generado para esa semilla (con castillo, salida ante la puerta, casas, torres y guardias), salvo
que diga otra cosa.

#### Scenario: Partida con mapa vacío
- **GIVEN** el contenido por defecto, la semilla 7 y el mapa vacío
- **WHEN** se crea la partida
- **THEN** sus 2.304 celdas son `grass`, ninguna es `castle`, la salida es (1.920, 1.080) y no hay estructuras

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

### Requirement: Sonda del mapa para E2E
El sistema SHALL exponer, solo con `?e2e` y como parte de la sonda `window.__sprint`, el mapa de la partida en curso:
columnas, filas, `cellSize`, la lista completa de tipos de celda en orden de filas (fila 0 de izquierda a derecha,
luego la fila 1…), el recuento de celdas por tipo (incluido `castle`), la zona de inicio (centro y radio), el punto de
salida, la huella del castillo (primera y última columna y fila; `null` con el mapa vacío o explícito), si el mapa
vacío está forzado y la lista de estructuras de la partida (tipo, huella y, si es una casa, puerta), en el orden del
snapshot. En modo menú el mapa de la sonda MUST valer `null`. Sin `?e2e` MUST NOT existir. Leer la sonda MUST NOT
cambiar la simulación ni lo que se pinta.

#### Scenario: Sonda coherente con el núcleo
- **GIVEN** la URL `?e2e&manual&seed=42`
- **WHEN** arranca la partida al cargar y se lee la sonda del mapa
- **THEN** informa de 64 columnas, 36 filas, `cellSize` 60, 2.304 tipos iguales uno a uno a los del mapa que genera el
  núcleo para la semilla 42, recuentos por tipo que suman 2.304 y coinciden con la lista, y zona de inicio de centro
  (1.950, 1.170) y radio 180
- **AND** su lista de estructuras es igual, una a una, a la que coloca el núcleo para la semilla 42

#### Scenario: Sonda con castillo y salida [E2E]
- **GIVEN** la build de producción con `?e2e&manual&seed=42` (mapa real)
- **WHEN** arranca la partida, se pinta 1 frame y se leen la sonda del mapa y el snapshot
- **THEN** la sonda informa de 20 celdas `castle`, huella de columnas 30–34 y filas 15–18 y salida (1.950, 1.170)
- **AND** el jugador del snapshot está en (1.950, 1.170)

#### Scenario: Sonda con el mapa vacío
- **GIVEN** la URL `?e2e&map=empty&seed=42`
- **WHEN** arranca la partida al cargar y se lee la sonda del mapa
- **THEN** informa de 2.304 celdas `grass`, 0 `castle`, huella `null`, salida (1.920, 1.080), zona de inicio de
  centro (1.920, 1.080) y una lista de estructuras vacía

#### Scenario: Sonda en el menú
- **GIVEN** `?e2e&seed=42` y el menú tras `Volver al menú`
- **WHEN** se pinta 1 frame y se lee la sonda
- **THEN** el mapa de la sonda vale `null`
- **AND** tras pulsar `Jugar` vuelve a informar del mapa de la partida nueva

#### Scenario: Sin sonda fuera de E2E
- **GIVEN** la URL `?seed=42`
- **WHEN** termina la carga y se pulsa `Jugar`
- **THEN** `window.__sprint` es `undefined`
