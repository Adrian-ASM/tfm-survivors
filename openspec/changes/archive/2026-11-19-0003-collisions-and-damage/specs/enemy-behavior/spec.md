# Spec delta · enemy-behavior

<!-- Change 0003-collisions-and-damage. Solo persiguen los enemigos vivos y la persecución se detiene con la
     partida terminada. Golpear al jugador no detiene ni desvía al enemigo: sigue llegando al centro del jugador
     y no hay separación ni empuje. El resto de requisitos de la spec viva no cambia. -->

## MODIFIED Requirements

### Requirement: Persecución en línea recta
El sistema SHALL mover cada enemigo vivo, en cada tick de una partida en curso, una distancia
`velocidad del tipo × 1/60` en línea recta hacia el centro del jugador. Esa posición es la del jugador después de
aplicar su movimiento en ese mismo tick. Un enemigo MUST NOT sobrepasar el centro del jugador: si está a una
distancia ≤ `velocidad × 1/60`, termina exactamente en el centro del jugador. Un enemigo que ya está en el centro
del jugador no se mueve. Los enemigos dados de baja no se mueven, y su baja no altera la trayectoria de los demás.
Golpear al jugador MUST NOT cambiar la persecución del enemigo que golpea.

#### Scenario: Persecución horizontal durante un segundo
- **GIVEN** un jugador quieto en (480, 270) y un enemigo con velocidad 60 en (100, 270)
- **WHEN** se ejecutan 60 ticks
- **THEN** el enemigo está en (160, 270) con un error ≤ 0,001

#### Scenario: Persecución en diagonal
- **GIVEN** un jugador quieto en (480, 470) y un enemigo con velocidad 50 en (180, 70)
- **WHEN** se ejecutan 60 ticks
- **THEN** el enemigo está en (210, 110) con un error ≤ 0,001

#### Scenario: Llegada sin sobrepasar
- **GIVEN** un jugador quieto en (480, 270) y un enemigo con velocidad 120 en (470, 270)
- **WHEN** se ejecutan 5 ticks y después 55 ticks más
- **THEN** tras 5 ticks el enemigo está en (480, 270) con un error ≤ 0,001
- **AND** tras 60 ticks sigue en (480, 270) con un error ≤ 0,001

#### Scenario: Persigue la posición del jugador en el mismo tick
- **GIVEN** un jugador en (480, 270) con velocidad 200 e input (1, 0), y un enemigo con velocidad 60 en (480, 470)
- **WHEN** se ejecuta 1 tick
- **THEN** el jugador está en (483,333, 270) y la x del enemigo es 480,0167 con un error ≤ 0,001

#### Scenario: Sigue hasta el centro tras golpear
- **GIVEN** un jugador quieto en (480, 270) con radio 16 y vida 100, y un enemigo con radio 10, velocidad 60 y
  damage 10 en (530, 270)
- **WHEN** se ejecutan 60 ticks
- **THEN** el jugador ha recibido ≥ 1 golpe
- **AND** el enemigo está en (480, 270) con un error ≤ 0,001 y sigue vivo

#### Scenario: Un enemigo dado de baja deja de perseguir
- **GIVEN** un jugador quieto en (480, 270), un enemigo A con velocidad 60 en (100, 270) y un enemigo B con
  velocidad 60 en (100, 100)
- **WHEN** A queda dado de baja tras el tick 10 y se ejecutan 50 ticks más
- **THEN** A no aparece en el snapshot
- **AND** B está en la misma posición que en una partida idéntica en la que A no se da de baja

#### Scenario: Sin persecución con la partida terminada
- **GIVEN** una partida terminada con un enemigo vivo en (300, 270) y el jugador en (480, 270)
- **WHEN** se ejecutan 60 ticks
- **THEN** el enemigo sigue exactamente en (300, 270)

### Requirement: Enemigos dentro de la arena
El sistema SHALL mantener el círculo de cada enemigo entero dentro de la arena en todo momento: su centro MUST
quedar en [radio, ancho − radio] × [radio, alto − radio], usando el radio del enemigo. Aplica la misma regla que
al jugador.

#### Scenario: Enemigo más grande que el jugador junto a un borde
- **GIVEN** un jugador quieto en (944, 270) con radio 16 y un enemigo con radio 22 y velocidad 120 en (900, 270)
- **WHEN** se ejecutan 60 ticks
- **THEN** el enemigo está en (938, 270)

#### Scenario: Partida larga
- **GIVEN** el contenido por defecto salvo una vida máxima del jugador suficiente para no llegar a 0 en
  36.000 ticks, semilla 7 y un input aleatorio generado por una semilla fija
- **WHEN** se ejecutan 36.000 ticks
- **THEN** en ningún tick hay un enemigo cuyo centro quede fuera de [radio, 960 − radio] × [radio, 540 − radio]

### Requirement: Sin separación entre enemigos
El sistema SHALL permitir que los enemigos se solapen entre sí y con el jugador. No hay separación, empuje,
*knockback* ni colisión física entre enemigos, ni entre enemigos y jugador: el contacto con el jugador solo
produce daño (ver `player-health`) y no cambia la posición de nadie.

#### Scenario: Dos enemigos idénticos se superponen
- **GIVEN** un jugador quieto en (480, 270) y dos enemigos del mismo tipo en (100, 270)
- **WHEN** se ejecutan 60 ticks
- **THEN** ambos enemigos tienen exactamente la misma posición

#### Scenario: El contacto no empuja al jugador
- **GIVEN** un jugador quieto en (480, 270) con vida 1.000 y 50 enemigos con velocidad 60 a ≤ 20
  unidades de su centro
- **WHEN** se ejecutan 60 ticks con input (0, 0)
- **THEN** el jugador sigue exactamente en (480, 270)
- **AND** todos los enemigos están en (480, 270) con un error ≤ 0,001
