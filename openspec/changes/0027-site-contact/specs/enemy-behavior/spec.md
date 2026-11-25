# Spec delta · enemy-behavior

## MODIFIED Requirements

### Requirement: Enemigos fuera de celdas no caminables en el mapa generado
El sistema SHALL mantener, con el mapa generado por cualquier semilla y el contenido por defecto, el centro de cada
enemigo vivo en una celda caminable en todos los ticks, desde el de su aparición (ver "Posición de aparición fuera de
la vista" en `enemy-spawning`), también respecto a las celdas de obra: las huellas de los solares libres desde el tick 0
y las de los edificios construidos (ver "Solar libre que bloquea el paso" y "Edificios que bloquean el paso" en
`build-sites`). Un enemigo navega evitándolas y, si al construir queda uno con el centro en la huella, se recoloca (ver
"Huella despejada al construir" en `build-sites`). El círculo del enemigo sí puede solapar en parte una celda no
caminable (no hay colisión física de los enemigos con el mapa).

#### Scenario: Semillas del conjunto
- **GIVEN** el contenido por defecto salvo una vida máxima del jugador suficiente para no llegar a 0 en 7.200 ticks y,
  para cada semilla de 1 a 50, su mapa generado (con sus 6 solares en `free`) y un input aleatorio generado por una
  semilla fija
- **WHEN** se ejecutan 7.200 ticks con cada semilla, con las políticas de elección, tienda y obra fijas
- **THEN** en ningún tick de ninguna semilla hay un enemigo vivo cuyo centro esté en una celda `trunk`, `water`,
  `castle` o de la huella de un solar

#### Scenario: Jugador quieto junto al castillo
- **GIVEN** el contenido por defecto, la semilla 42, el jugador quieto en su salida (1.950, 1.170) con una vida
  suficiente para no llegar a 0 en 3.600 ticks y la política de elección fija
- **WHEN** se ejecutan 3.600 ticks
- **THEN** en ningún tick hay un enemigo vivo con el centro en una celda `castle`
- **AND** en algún tick hay ≥ 1 enemigo en contacto con el jugador

#### Scenario: Semillas del conjunto con edificios
- **GIVEN** el contenido por defecto salvo una vida máxima del jugador suficiente para no llegar a 0 en 7.200 ticks y,
  para cada semilla de 1 a 50, su mapa generado con sus 6 solares construidos en el tick 1.800 (3 casas y 3 torres,
  escenario preparado) y un input aleatorio generado por una semilla fija
- **WHEN** se ejecutan 7.200 ticks con cada semilla, con la política de elección fija
- **THEN** en ningún tick de ninguna semilla hay un enemigo vivo cuyo centro esté en una celda `trunk`, `water`,
  `castle` o de obra

### Requirement: Navegación con edificios construidos
El sistema SHALL aplicar "Línea libre hasta el jugador", "Navegación por el campo de flujo" y "Navegación hacia un punto
fijo" con las celdas de obra como no caminables: las de los solares libres desde el tick 0 y las de los edificios
construidos desde el primer tick ejecutado tras la construcción (ver "Solar libre que bloquea el paso" y "Edificios que
bloquean el paso" en `build-sites`). El campo hacia la celda del jugador y los campos hacia los puntos fijos de los
guardias tienen en cuenta todas las celdas de obra de ese momento. Un enemigo que no tiene línea libre por un solar o un
edificio lo rodea por el campo. Con el mismo mapa y las mismas celdas de obra, el movimiento MUST ser el mismo sea cual
sea el tick en que se construyeron los edificios. Nada de esto consume azar.

#### Scenario: El enemigo rodea un solar libre desde el tick 0
- **GIVEN** el solar de prueba (`build-sites`) en `free`, un jugador quieto en P y un `goblin-torch` en E cuyo segmento
  hasta P cruza la huella y ninguna otra celda no caminable
- **WHEN** se ejecutan 1.200 ticks desde el tick 1, con la política de obra fija
- **THEN** el enemigo no tiene línea libre en el tick 1, en ningún tick su centro está en una celda de la huella y llega
  a P (error ≤ 0,001)

#### Scenario: El guardia vuelve rodeando un solar
- **GIVEN** el mapa vacío, el guardia de prueba en vuelta con su puesto Q y el solar de prueba, en un caso en `free` y en
  otro con una torre construida, cuya huella corta el segmento entre el guardia y Q, y un jugador quieto a > 1.000 px
- **WHEN** se ejecutan 1.200 ticks
- **THEN** en los dos casos en ningún tick el centro del guardia está en una celda de la huella y llega a Q
  (error ≤ 0,001)

#### Scenario: Mismo movimiento con la misma obra en otro momento
- **GIVEN** dos partidas iguales en el tick 2.000 con los mismos enemigos, el mismo jugador y la misma casa construida
  en el mismo solar, construida en una en el tick 500 y en la otra en el tick 1.500 (escenario preparado)
- **WHEN** ambas ejecutan 600 ticks con el mismo input
- **THEN** las posiciones de los enemigos son iguales en cada tick
