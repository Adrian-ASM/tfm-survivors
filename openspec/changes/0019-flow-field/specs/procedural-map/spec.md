# Spec delta · procedural-map

<!-- Change 0019-flow-field. El mapa ofrece un campo de distancias 4-vecino hacia una celda (lo usa la persecución de
     `enemy-behavior`) y la aparición de enemigos se recoloca en celdas caminables (`enemy-spawning`). El mapa sigue
     inmutable durante la partida; el recálculo por edificios nuevos se difiere a build-sites (0024).
     Purpose nuevo (al archivar): "... Es la base de la colisión del jugador, de la recolocación de gemas y apariciones
     y del campo de flujo de los enemigos." -->

## ADDED Requirements

### Requirement: Campo de distancias hacia una celda
El sistema SHALL ofrecer en el núcleo, para el mapa de una partida y una celda objetivo T, el **campo de distancias**:
para cada celda, el menor número de pasos entre celdas caminables vecinas por un lado (arriba, abajo, izquierda o
derecha; sin diagonales) necesarios para ir de ella a T. T tiene distancia 0. Una celda no caminable, o caminable pero
sin camino 4-vecino hasta T, no tiene distancia; si T no es caminable, ninguna celda la tiene. El campo:
- MUST depender solo del mapa y de T: el mismo mapa y la misma T dan el mismo campo celda a celda, sea cual sea el
  momento, la historia de la partida, la posición del jugador dentro de T o la ventana;
- MUST NOT consumir azar ni modificar el mapa (es una consulta de solo lectura, ver "Mapa de la partida de solo
  lectura");
- MUST NOT recalcularse por cambios del mapa durante la partida, porque el mapa no cambia.

#### Scenario: Mapa vacío
- **GIVEN** el mapa vacío de 64 × 36 y la celda objetivo (32, 18)
- **WHEN** se calcula el campo
- **THEN** cada celda (c, r) tiene distancia |c − 32| + |r − 18|; la (0, 0) tiene 50 y la (63, 35) tiene 48

#### Scenario: Río con un único puente
- **GIVEN** un mapa de hierba con toda la columna 10 de `water` salvo la celda (10, 20), que es `bridge`, y la celda
  objetivo (15, 4)
- **WHEN** se calcula el campo
- **THEN** la (10, 20) tiene distancia 21, la (9, 20) 22 y la (5, 4) 42
- **AND** ninguna celda `water` tiene distancia

#### Scenario: Celda encerrada
- **GIVEN** un mapa de hierba con troncos en (10, 4), (9, 5), (11, 5) y (10, 6) y la celda objetivo (20, 5)
- **WHEN** se calcula el campo
- **THEN** la celda caminable (10, 5) no tiene distancia y los cuatro troncos tampoco

#### Scenario: Objetivo no caminable
- **GIVEN** un mapa de hierba con un tronco en (10, 4) y la celda objetivo (10, 4)
- **WHEN** se calcula el campo
- **THEN** ninguna celda tiene distancia

#### Scenario: Toda celda caminable con distancia en el mapa generado
- **GIVEN** el contenido por defecto y, para cada semilla de 1 a 50, su mapa generado y como objetivo la celda de su
  salida, (32, 19)
- **WHEN** se calcula el campo
- **THEN** todas las celdas caminables tienen distancia y ninguna celda `trunk`, `water` o `castle` la tiene

#### Scenario: Mismo campo, misma celda
- **GIVEN** una partida con el contenido por defecto y la semilla 42
- **WHEN** se calcula el campo hacia la celda (40, 10) en el tick 0, después de 3.600 ticks y en otra partida nueva con
  la misma semilla
- **THEN** los tres campos son iguales celda a celda y el estado del `RandomGenerator` de la partida no ha cambiado
  por calcularlos

## MODIFIED Requirements

### Requirement: Rejilla de celdas tipadas
El sistema SHALL representar el mapa de cada partida como una rejilla de ⌈ancho / `cellSize`⌉ columnas por
⌈alto / `cellSize`⌉ filas que cubre el mundo entero; las celdas de la última columna y la última fila se recortan al
borde del mundo si el tamaño no es múltiplo de `cellSize`. Cada celda tiene exactamente un tipo: `grass` (hierba),
`trunk` (tronco), `water` (agua), `bridge` (puente) o `castle` (castillo). Son caminables `grass` y `bridge`; no
caminables `trunk`, `water` y `castle`. El núcleo MUST ofrecer, sin consumir azar ni depender del jugador:
- el tipo de una celda (c, r) y si es caminable; una celda fuera de la rejilla MUST considerarse no caminable;
- la celda que contiene un punto (x, y) del mundo: (⌊x / `cellSize`⌋, ⌊y / `cellSize`⌋), con x = ancho y y = alto
  asignados a la última columna y la última fila;
- el punto de salida del mapa (ver "Castillo en el mapa generado" y "Mapa explícito y mapa vacío");
- el campo de distancias hacia una celda (ver "Campo de distancias hacia una celda").

Todo lo que dependa de "no caminable" (colisión del jugador, recolocación de gemas y de apariciones, línea libre y
navegación de los enemigos, campo de distancias, conectividad, bot de referencia) MUST tratar una celda `castle` igual
que una `trunk` o una `water`.

#### Scenario: Rejilla por defecto
- **GIVEN** el contenido por defecto
- **WHEN** se crea una partida
- **THEN** su mapa tiene 64 columnas, 36 filas y 2.304 celdas, todas de 60 × 60 px

#### Scenario: Mundo no múltiplo de la celda
- **GIVEN** el contenido por defecto salvo una arena explícita de 4.000 × 4.000
- **WHEN** se crea una partida
- **THEN** su mapa tiene 67 × 67 celdas y las de la columna 66 ocupan x en [3.960, 4.000] (40 px de ancho)

#### Scenario: Celda de un punto
- **GIVEN** el contenido por defecto
- **WHEN** se pide la celda de (1.919,9; 1.079,9), de (1.920, 1.080), de (0, 0) y de (3.840, 2.160)
- **THEN** son (31, 17), (32, 18), (0, 0) y (63, 35) respectivamente

#### Scenario: Caminabilidad por tipo y fuera de la rejilla
- **GIVEN** un mapa explícito de 64 × 36 con la celda (3, 3) `trunk`, la (4, 3) `water`, la (5, 3) `bridge`, la
  (6, 3) `castle` y el resto `grass`
- **WHEN** se consulta la caminabilidad de (3, 3), (4, 3), (5, 3), (6, 3), (7, 3), (−1, 0), (64, 0) y (0, 36)
- **THEN** son no caminable, no caminable, caminable, no caminable, caminable, no caminable, no caminable y no
  caminable

### Requirement: Azar del mapa independiente del de la partida
El sistema SHALL generar el mapa con un flujo de azar propio derivado de la semilla, distinto del que consumen
oleadas y ofertas: generar el mapa MUST NOT cambiar la secuencia de valores que recibe el resto de la partida. Con la
misma semilla y el mismo punto de salida, una partida con el mapa generado y otra con un mapa todo `grass` consumen el
azar de la partida igual mientras sigan el mismo curso: recolocar una aparición, calcular el campo de distancias o
navegar por él no consume azar (cada intento de aparición gasta 1 valor en ambos mapas; ver `enemy-spawning`). Para
comparar con el mapa generado se usa el **mapa vacío con salida** (1.950, 1.170): todo `grass`, con ese punto de
salida declarado (ver "Mapa explícito y mapa vacío").

Como los enemigos navegan por el mapa (ver `enemy-behavior`), las dos partidas pueden divergir en contactos, bajas,
gemas, ofertas y, por tanto, en el azar consumido después; la igualdad solo se exige mientras no haya divergido nada
que consuma azar.

#### Scenario: Mismos spawns con y sin mapa
- **GIVEN** dos partidas con el contenido por defecto, la semilla 7, input (0, 0) y la política de elección fija, una
  con el mapa generado y otra con el mapa vacío con salida (1.950, 1.170)
- **WHEN** ambas ejecutan ticks hasta que una de las dos abre su primera oferta de mejoras o termina, o hasta el tick
  1.200, lo que ocurra antes
- **THEN** en cada uno de esos ticks aparecen los mismos enemigos en ambas: mismo identificador, mismo tipo y mismo
  tick de aparición
- **AND** la posición de aparición es la misma en las dos, salvo en las apariciones del mapa generado cuyo punto cae en
  una celda no caminable, que están en la recolocación de la posición del mapa vacío (ver "Posición de aparición fuera
  de la vista" en `enemy-spawning`)

#### Scenario: Primera oferta en plazo con y sin mapa
<!-- Reformulado en apply de 0017 (decisión del usuario): con el mundo nuevo el jugador quieto ya no abre la primera
     oferta en el mismo tick con ambos mapas (semilla 7: tick 1.527 con el generado, 1.846 con el vacío con salida),
     porque el mapa cambia qué gemas alcanza. Se exige el plazo de primera subida, no la igualdad de tick ni de
     opciones. En 0019 los ticks medidos se vuelven a anotar en apply. -->
- **GIVEN** las dos partidas del escenario anterior (semilla 7, input (0, 0), política de elección fija; una con el
  mapa generado y otra con el mapa vacío con salida (1.950, 1.170))
- **WHEN** cada una se ejecuta hasta abrir su primera oferta de mejoras o hasta el tick 4.800
- **THEN** ambas abren su primera oferta en un tick ≤ 4.800 (plazo de primera subida)
- **AND** no se exige que lo hagan en el mismo tick ni con las mismas opciones

<!-- historial: 0019-flow-field (pendiente de archivar) -->
