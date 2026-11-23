# Spec delta · enemy-spawning

<!-- Ruta: openspec/changes/0016-map-art/specs/enemy-spawning/spec.md
     Cobertura (e2e-lite): solo cambia el escenario E2E existente "Fuera de pantalla en una partida real" (posición
     inicial y rectángulo visible con el mapa real); ningún E2E nuevo. Si ese E2E se retiró en e2e-lite, el escenario
     se acepta cubierto por "Jugador ante la puerta del castillo" (unitario). -->

## MODIFIED Requirements

### Requirement: Posición de aparición fuera de la vista
El sistema SHALL colocar cada enemigo nuevo así:
1. Toma un punto a una distancia del jugador igual al radio del anillo, en un ángulo elegido con el
   `RandomGenerator`. El radio del anillo es la mitad de la diagonal de la vista más `margin`:
   √(960² + 540²) / 2 + 32 ≈ 582,727 con los valores por defecto. Depende solo de la vista, no del tamaño del mundo.
2. Recorta ese punto a la arena (el mundo) con la misma regla que al jugador, de modo que el centro quede en
   [radio, ancho − radio] × [radio, alto − radio] usando el radio del enemigo.
3. Acepta la posición solo si, tras el recorte, su distancia al jugador es ≥ `minDistance`.

Si la posición no se acepta, se repite el proceso hasta un total de `maxAttempts` intentos por enemigo. Si ningún
intento es válido, ese enemigo no aparece en este tick, el presupuesto no se gasta y el tipo pendiente se
mantiene. El sistema MUST NOT colocar nunca un enemigo a menos de `minDistance` del jugador ni fuera del mundo. La
posición de aparición no tiene en cuenta el mapa: un enemigo puede aparecer sobre cualquier tipo de celda, también
`castle`.

Un punto del anillo que no necesita recorte queda siempre fuera del rectángulo de la vista centrado en el jugador.
Cuando el recorte actúa (jugador a menos del radio del anillo de algún borde del mundo), el enemigo puede aparecer
dentro del rectángulo visible de la cámara; esto se acepta y solo se garantizan el mundo y `minDistance`.

#### Scenario: Arena mayor que la vista
- **GIVEN** una arena de 4.000 × 4.000, el jugador en (2.000, 2.000), una vista de 960 × 540 y `margin` 32
- **WHEN** aparecen 100 enemigos
- **THEN** cada uno está a 582,727 ± 0,001 unidades del jugador
- **AND** ninguno está dentro del rectángulo de la vista centrado en el jugador

#### Scenario: Jugador en el centro del mundo por defecto
- **GIVEN** el contenido por defecto (mundo de 1.920 × 1.080, vista de 960 × 540) y el jugador en (960, 540)
- **WHEN** aparecen 200 enemigos
- **THEN** el centro de cada uno queda en [radio, 1.920 − radio] × [radio, 1.080 − radio]
- **AND** ninguno tiene el centro dentro del rectángulo visible de la cámara, (480, 270)–(1.440, 810)
- **AND** los que no tocan el borde superior ni el inferior del mundo están a 582,727 ± 0,001 unidades del jugador

#### Scenario: Jugador ante la puerta del castillo
- **GIVEN** el contenido por defecto, la semilla 42 y el jugador quieto en su salida (990, 630), con rectángulo
  visible de la cámara (510, 360)–(1.470, 900)
- **WHEN** aparecen 200 enemigos
- **THEN** el centro de cada uno queda en [radio, 1.920 − radio] × [radio, 1.080 − radio], a ≥ 200 unidades del
  jugador y fuera de (510, 360)–(1.470, 900)

#### Scenario: Arena igual a la vista
- **GIVEN** una arena explícita de 960 × 540 (no la del contenido por defecto), el jugador en (480, 270) y el
  contenido de spawn por defecto
- **WHEN** aparecen 200 enemigos
- **THEN** el centro de cada uno queda en [radio, 960 − radio] × [radio, 540 − radio]
- **AND** cada uno está a ≥ 200 unidades del jugador
- **AND** cada uno toca un borde de la arena: x = radio, x = 960 − radio, y = radio o y = 540 − radio

#### Scenario: Jugador en una esquina
- **GIVEN** el mundo de 1.920 × 1.080, el jugador quieto en (16, 16) con una vida máxima suficiente para no llegar a
  0 en 3.600 ticks, y el contenido de spawn por defecto
- **WHEN** se ejecutan 3.600 ticks con un tramo de `budgetPerSecond` 5
- **THEN** cada enemigo aparecido está dentro del mundo y a ≥ 200 unidades del jugador en el tick de su
  aparición

#### Scenario: Jugador en la esquina opuesta
- **GIVEN** el mundo de 1.920 × 1.080, el jugador quieto en (1.904, 1.064) con una vida máxima suficiente para no
  llegar a 0 en 3.600 ticks, y el contenido de spawn por defecto
- **WHEN** se ejecutan 3.600 ticks con un tramo de `budgetPerSecond` 5
- **THEN** cada enemigo aparecido está dentro del mundo y a ≥ 200 unidades del jugador en el tick de su
  aparición

#### Scenario: Ninguna posición válida
- **GIVEN** el mundo de 1.920 × 1.080, `minDistance` 2.500 (mayor que su diagonal, ≈ 2.202,9) y `maxAttempts` 8
- **WHEN** se ejecutan 600 ticks con un tramo de `budgetPerSecond` 5
- **THEN** no hay ningún enemigo vivo y la partida sigue avanzando sin error
- **AND** en cada tick se hacen como mucho 8 intentos de posición

#### Scenario: El presupuesto no se pierde al aplazar
- **GIVEN** un tramo con `budgetPerSecond` 1 y coste 1, `maxBudget` ≥ 2, y un generador aleatorio de prueba con
  el que todos los intentos son inválidos en los ticks 1 a 120 y todos son válidos a partir del tick 121
- **WHEN** se ejecuta el tick 121
- **THEN** aparecen 2 enemigos en ese tick

#### Scenario: Partida larga sin spawns ilegales
- **GIVEN** el contenido por defecto salvo una vida máxima del jugador suficiente para no llegar a 0 en
  36.000 ticks, semilla 7 y un input aleatorio generado por una semilla fija
- **WHEN** se ejecutan 36.000 ticks (10 min)
- **THEN** ningún enemigo aparece fuera de [radio, 1.920 − radio] × [radio, 1.080 − radio] ni a menos de 200
  unidades del jugador

#### Scenario: Fuera de pantalla en una partida real
- **GIVEN** la build de producción con `?e2e&seed=42` (mapa real) y sin input de movimiento (el jugador queda en su
  salida (990, 630) y el rectángulo visible de la sonda en (510, 360)–(1.470, 900))
- **WHEN** se pintan 600 frames y se leen las posiciones de aparición de los enemigos nuevos
- **THEN** ninguna posición de aparición queda dentro del rectángulo visible
