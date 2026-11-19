# Enemy behavior · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
Los enemigos persiguen al jugador en línea recta a la velocidad de su tipo, sin salir de la arena.

## Requirements

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

### Requirement: Sin movimiento en el tick de aparición
El sistema SHALL mostrar a un enemigo, en el snapshot del tick en que aparece, en su posición de aparición. Empieza
a perseguir al jugador en el tick siguiente.

#### Scenario: Primer tick de vida
- **GIVEN** una partida en la que un enemigo aparece en el tick n en la posición P
- **WHEN** se lee el snapshot del tick n
- **THEN** ese enemigo está exactamente en P
- **AND** en el snapshot del tick n + 1 su distancia a P es `velocidad × 1/60` con un error ≤ 0,001, salvo que
  haya llegado al centro del jugador

### Requirement: Un enemigo dañado sigue persiguiendo
El sistema SHALL mantener la persecución de un enemigo vivo tras recibir daño de cualquier arma: su velocidad y su
dirección hacia el jugador MUST ser las mismas que si no hubiera recibido daño. Recibir daño no desplaza al enemigo.

#### Scenario: Misma trayectoria con y sin daño
- **GIVEN** dos partidas idénticas con un jugador quieto en (480, 270) y un bug de vida 10 en (380, 270), en las que
  en una el bug recibe un impacto del Linter en el tick n (vida 4) y en la otra no recibe daño
- **WHEN** se ejecutan los ticks n a n + 10
- **THEN** la posición del bug es la misma en ambas partidas en cada uno de esos ticks (error ≤ 0,001)

#### Scenario: El impacto no empuja
- **GIVEN** un bug en la posición P al terminar la persecución del tick n
- **WHEN** recibe un impacto del Linter o un pulso de Tests en el paso de armas del tick n
- **THEN** en el snapshot del tick n sigue exactamente en P

<!-- historial: 0002-enemy-spawning (2026-11-19) -->
<!-- historial: 0003-collisions-and-damage (2026-11-19) -->
<!-- historial: 0004-auto-weapons (2026-11-19) -->
