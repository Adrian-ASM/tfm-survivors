# Spec delta · enemy-behavior

## ADDED Requirements

### Requirement: Navegación con edificios construidos
El sistema SHALL aplicar "Línea libre hasta el jugador", "Navegación por el campo de flujo" y "Navegación hacia un punto
fijo" con las celdas de los edificios construidos como no caminables (ver "Edificios que bloquean el paso" en
`build-sites`), desde el primer tick ejecutado tras la construcción: el campo hacia la celda del jugador y los campos
hacia los puntos fijos de los guardias tienen en cuenta todos los edificios construidos hasta ese momento. Un enemigo
que no tiene línea libre por un edificio rodea el edificio por el campo. Con el mismo mapa y los mismos edificios, el
movimiento MUST ser el mismo sea cual sea el tick en que se construyeron. Nada de esto consume azar.

#### Scenario: El campo se recalcula y el enemigo rodea
- **GIVEN** el solar de prueba (`build-sites`) con la casa construida en el tick n, un jugador quieto en P y un
  `goblin-torch` en E que antes del tick n tenía línea libre a través de la huella
- **WHEN** se ejecutan 1.200 ticks desde el n + 1
- **THEN** el enemigo no tiene línea libre en el tick n + 1, en ningún tick su centro está en una celda de la huella y
  llega a P (error ≤ 0,001)

#### Scenario: El guardia vuelve rodeando el edificio
- **GIVEN** el mapa vacío, el guardia de prueba en vuelta con su puesto Q y el solar de prueba con una torre construida
  cuya huella corta el segmento entre el guardia y Q, y un jugador quieto a > 1.000 px
- **WHEN** se ejecutan 1.200 ticks
- **THEN** en ningún tick el centro del guardia está en una celda de la huella y llega a Q (error ≤ 0,001)

#### Scenario: Mismo movimiento con la misma obra en otro momento
- **GIVEN** dos partidas iguales en el tick 2.000 con los mismos enemigos, el mismo jugador y la misma casa construida
  en el mismo solar, construida en una en el tick 500 y en la otra en el tick 1.500 (escenario preparado)
- **WHEN** ambas ejecutan 600 ticks con el mismo input
- **THEN** las posiciones de los enemigos son iguales en cada tick

## MODIFIED Requirements

### Requirement: Enemigos fuera de celdas no caminables en el mapa generado
El sistema SHALL mantener, con el mapa generado por cualquier semilla y el contenido por defecto, el centro de cada
enemigo vivo en una celda caminable en todos los ticks, desde el de su aparición (ver "Posición de aparición fuera de
la vista" en `enemy-spawning`), también en las celdas de los edificios construidos: al construir, un enemigo con el
centro en la huella se recoloca (ver "Huella despejada al construir" en `build-sites`) y después navega evitándola. El
círculo del enemigo sí puede solapar en parte una celda no caminable (no hay colisión física de los enemigos con el
mapa).

<!-- Escenarios vivos sin cambios: todos los de este requisito. -->

#### Scenario: Semillas del conjunto con edificios
- **GIVEN** el contenido por defecto salvo una vida máxima del jugador suficiente para no llegar a 0 en 7.200 ticks y,
  para cada semilla de 1 a 50, su mapa generado con sus 6 solares construidos en el tick 1.800 (3 casas y 3 torres,
  escenario preparado) y un input aleatorio generado por una semilla fija
- **WHEN** se ejecutan 7.200 ticks con cada semilla, con la política de elección fija
- **THEN** en ningún tick de ninguna semilla hay un enemigo vivo cuyo centro esté en una celda `trunk`, `water`,
  `castle` o construida
