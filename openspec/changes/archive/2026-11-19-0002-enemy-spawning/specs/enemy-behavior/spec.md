# Spec delta · enemy-behavior

<!-- Change 0002-enemy-spawning. Persecución en su forma más simple: línea recta hacia el jugador, a la velocidad
     del tipo, sin separación entre enemigos, sin colisiones ni daño (llegan en 0003).
     Arena 960 × 540, paso fijo 1/60 s. En los escenarios el jugador no se mueve (input (0, 0)) salvo que
     se indique otra cosa. Las velocidades se fijan en cada escenario. -->

## ADDED Requirements

### Requirement: Persecución en línea recta
El sistema SHALL mover cada enemigo vivo, en cada tick, una distancia `velocidad del tipo × 1/60` en línea recta
hacia el centro del jugador. Esa posición es la del jugador después de aplicar su movimiento en ese mismo tick.
Un enemigo MUST NOT sobrepasar el centro del jugador: si está a una distancia ≤ `velocidad × 1/60`, termina
exactamente en el centro del jugador. Un enemigo que ya está en el centro del jugador no se mueve.

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

### Requirement: Velocidad por tipo
El sistema SHALL mover cada enemigo a la velocidad de su tipo, definida en contenido. Dos enemigos de tipos con
distinta velocidad recorren distancias distintas en el mismo número de ticks.

#### Scenario: Dos tipos, dos velocidades
- **GIVEN** un jugador quieto en (900, 270), un `bug` con velocidad 90 en (100, 100) y un `memory-leak` con
  velocidad 45 en (100, 440)
- **WHEN** se ejecutan 60 ticks
- **THEN** el `bug` ha recorrido 90 unidades y el `memory-leak` 45, ambos con un error ≤ 0,001

### Requirement: Enemigos dentro de la arena
El sistema SHALL mantener el círculo de cada enemigo entero dentro de la arena en todo momento: su centro MUST
quedar en [radio, ancho − radio] × [radio, alto − radio], usando el radio del enemigo. Aplica la misma regla que
al jugador.

#### Scenario: Enemigo más grande que el jugador junto a un borde
- **GIVEN** un jugador quieto en (944, 270) con radio 16 y un enemigo con radio 22 y velocidad 120 en (900, 270)
- **WHEN** se ejecutan 60 ticks
- **THEN** el enemigo está en (938, 270)

#### Scenario: Partida larga
- **GIVEN** el contenido por defecto, semilla 7 y un input aleatorio generado por una semilla fija
- **WHEN** se ejecutan 36.000 ticks
- **THEN** en ningún tick hay un enemigo cuyo centro quede fuera de [radio, 960 − radio] × [radio, 540 − radio]

### Requirement: Sin separación entre enemigos
El sistema SHALL permitir que los enemigos se solapen entre sí. En este change no hay separación, empuje ni
colisión entre enemigos, ni entre enemigos y jugador.

#### Scenario: Dos enemigos idénticos se superponen
- **GIVEN** un jugador quieto en (480, 270) y dos enemigos del mismo tipo en (100, 270)
- **WHEN** se ejecutan 60 ticks
- **THEN** ambos enemigos tienen exactamente la misma posición

### Requirement: Sin movimiento en el tick de aparición
El sistema SHALL mostrar a un enemigo, en el snapshot del tick en que aparece, en su posición de aparición. Empieza
a perseguir al jugador en el tick siguiente.

#### Scenario: Primer tick de vida
- **GIVEN** una partida en la que un enemigo aparece en el tick n en la posición P
- **WHEN** se lee el snapshot del tick n
- **THEN** ese enemigo está exactamente en P
- **AND** en el snapshot del tick n + 1 su distancia a P es `velocidad × 1/60` con un error ≤ 0,001, salvo que
  haya llegado al centro del jugador
