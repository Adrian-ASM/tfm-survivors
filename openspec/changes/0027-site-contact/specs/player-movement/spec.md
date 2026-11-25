# Spec delta · player-movement

## MODIFIED Requirements

### Requirement: Colisión con el mapa
El sistema SHALL impedir que el círculo del jugador solape una celda no caminable (`trunk`, `water`, `castle` o una
celda de obra: de la huella de un solar libre o de un edificio construido, ver `procedural-map`, "Solar libre que
bloquea el paso" y "Edificios que bloquean el paso" en `build-sites`). Solapar es que la distancia del centro del
jugador al punto más cercano del rectángulo cerrado de la celda sea menor que su radio; la tangencia (distancia igual
al radio) no es solape. En cada tick:
- si la posición a la que llevaría el movimiento sin obstáculos es legal (dentro de los límites del mundo y sin
  solape), el jugador llega exactamente a ella;
- si no, el jugador avanza lo máximo posible sin solapar: contra una cara de celda, la componente del movimiento
  perpendicular a la cara se anula y queda tangente, y la componente paralela se conserva entera (deslizamiento);
- el jugador MUST NOT rebotar: cada componente del desplazamiento del tick tiene el signo de la del movimiento sin
  obstáculos o vale 0, y su módulo no es mayor;
- el jugador MUST NOT atravesar una celda no caminable ni pasar entre dos celdas no caminables que solo se tocan por
  una esquina.

La colisión se aplica en el paso de movimiento del jugador, junto con los límites del mundo (ver "Límites de la
arena"), y MUST NOT consumir azar. El castillo, los solares libres (desde el tick 0) y los edificios construidos
bloquean al jugador como un tronco. Los enemigos no tienen colisión física con el mapa, pero navegan evitando las celdas
no caminables, las de obra incluidas (ver `enemy-behavior`).

<!-- Escenarios vivos sin cambios: todos los de este requisito. "Partida larga sin solapes" (semilla 7, mapa generado)
     incluye ahora las huellas de sus solares libres entre las celdas no caminables. -->

#### Scenario: Choque con un solar libre a velocidad máxima
- **GIVEN** el solar de prueba (`build-sites`) en `free`, `shortcuts` en nivel 5 (5 px/tick), la política de obra fija
  y el jugador en (1.100, 660), a 100 px de la cara izquierda de la huella, con input (1, 0)
- **WHEN** se ejecutan 60 ticks
- **THEN** el jugador está en (1.184, 660) (error ≤ 0,001), tangente a la cara izquierda, y en ningún tick solapa una
  celda de la huella

#### Scenario: Partida larga sin solapes con los solares libres
- **GIVEN** el contenido por defecto salvo una vida máxima suficiente para no llegar a 0 en 36.000 ticks, la semilla 7
  con su mapa generado y sus 6 solares en `free`, un input aleatorio generado por una semilla fija y las políticas de
  elección, tienda y obra fijas
- **WHEN** se ejecutan 36.000 ticks
- **THEN** en ningún tick el círculo del jugador solapa una celda de la huella de un solar
