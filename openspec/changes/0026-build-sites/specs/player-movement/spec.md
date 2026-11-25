# Spec delta · player-movement

## MODIFIED Requirements

### Requirement: Colisión con el mapa
El sistema SHALL impedir que el círculo del jugador solape una celda no caminable (`trunk`, `water`, `castle` o una
celda de un edificio construido, ver `procedural-map` y "Edificios que bloquean el paso" en `build-sites`). Solapar es
que la distancia del centro del jugador al punto más cercano del rectángulo cerrado de la celda sea menor que su radio;
la tangencia (distancia igual al radio) no es solape. En cada tick:
- si la posición a la que llevaría el movimiento sin obstáculos es legal (dentro de los límites del mundo y sin
  solape), el jugador llega exactamente a ella;
- si no, el jugador avanza lo máximo posible sin solapar: contra una cara de celda, la componente del movimiento
  perpendicular a la cara se anula y queda tangente, y la componente paralela se conserva entera (deslizamiento);
- el jugador MUST NOT rebotar: cada componente del desplazamiento del tick tiene el signo de la del movimiento sin
  obstáculos o vale 0, y su módulo no es mayor;
- el jugador MUST NOT atravesar una celda no caminable ni pasar entre dos celdas no caminables que solo se tocan por
  una esquina.

La colisión se aplica en el paso de movimiento del jugador, junto con los límites del mundo (ver "Límites de la
arena"), y MUST NOT consumir azar. El castillo y los edificios construidos bloquean al jugador como un tronco; un solar
sin construir no lo bloquea. Los enemigos no tienen colisión física con el mapa, pero navegan evitando las celdas no
caminables, construidas incluidas (ver `enemy-behavior`).

<!-- Escenarios vivos sin cambios: todos los de este requisito. -->

#### Scenario: Choque con una torre construida a velocidad máxima
- **GIVEN** el solar de prueba (`build-sites`) con una torre construida, `shortcuts` en nivel 5 (5 px/tick) y el jugador
  a 100 px de una cara de la huella de la torre, con input perpendicular a esa cara
- **WHEN** se ejecutan 60 ticks
- **THEN** el jugador queda tangente a esa cara (error ≤ 0,001) y en ningún tick solapa una celda de la huella

#### Scenario: Partida larga sin solapes con edificios
- **GIVEN** el contenido por defecto salvo una vida máxima suficiente para no llegar a 0 en 36.000 ticks, la semilla 7
  con su mapa generado, los 6 solares construidos antes del tick 1 (3 casas y 3 torres) y un input aleatorio generado
  por una semilla fija
- **WHEN** se ejecutan 36.000 ticks
- **THEN** en ningún tick el círculo del jugador solapa una celda no caminable, construidas incluidas
