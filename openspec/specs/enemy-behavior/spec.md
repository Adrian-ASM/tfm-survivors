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
- **GIVEN** un jugador quieto en (900, 270), un `goblin-torch` con velocidad 90 en (100, 100) y un `goblin-tnt`
  con velocidad 45 en (100, 440)
- **WHEN** se ejecutan 60 ticks
- **THEN** el `goblin-torch` ha recorrido 90 unidades y el `goblin-tnt` 45, ambos con un error ≤ 0,001

### Requirement: Enemigos dentro de la arena
El sistema SHALL mantener el círculo de cada enemigo entero dentro de la arena (el mundo, ver `world-camera`) en todo
momento: su centro MUST quedar en [radio, ancho − radio] × [radio, alto − radio], usando el radio del enemigo. Aplica
la misma regla que al jugador. El tamaño de la vista MUST NOT limitar a los enemigos.

#### Scenario: Enemigo más grande que el jugador junto a un borde
- **GIVEN** una arena de 1.920 × 1.080, un jugador quieto en (1.904, 540) con radio 16 y un enemigo con radio 22 y
  velocidad 120 en (1.860, 540)
- **WHEN** se ejecutan 60 ticks
- **THEN** el enemigo está en (1.898, 540)

#### Scenario: Enemigo junto al borde inferior
- **GIVEN** una arena de 1.920 × 1.080, un jugador quieto en (960, 1.064) con radio 16 y un enemigo con radio 22 y
  velocidad 120 en (960, 1.020)
- **WHEN** se ejecutan 60 ticks
- **THEN** el enemigo está en (960, 1.058)

#### Scenario: Persecución más allá del borde de la vista
- **GIVEN** una arena de 1.920 × 1.080, un jugador quieto en (1.500, 270) y un enemigo con velocidad 60 en
  (900, 270)
- **WHEN** se ejecutan 120 ticks
- **THEN** el enemigo está en (1.020, 270) con un error ≤ 0,001

#### Scenario: Partida larga
- **GIVEN** el contenido por defecto salvo una vida máxima del jugador suficiente para no llegar a 0 en
  36.000 ticks, semilla 7 y un input aleatorio generado por una semilla fija
- **WHEN** se ejecutan 36.000 ticks
- **THEN** en ningún tick hay un enemigo cuyo centro quede fuera de [radio, 1.920 − radio] × [radio, 1.080 − radio]

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
- **GIVEN** dos partidas idénticas con un jugador quieto en (480, 270) y un `goblin-torch` de vida 10 en (380, 270), en
  las que en una el `goblin-torch` recibe un impacto del Linter en el tick n (vida 4) y en la otra no recibe daño
- **WHEN** se ejecutan los ticks n a n + 10
- **THEN** la posición del `goblin-torch` es la misma en ambas partidas en cada uno de esos ticks (error ≤ 0,001)

#### Scenario: El impacto no empuja
- **GIVEN** un `goblin-torch` en la posición P al terminar la persecución del tick n
- **WHEN** recibe un impacto del Linter o un pulso de Tests en el paso de armas del tick n
- **THEN** en el snapshot del tick n sigue exactamente en P

### Requirement: Los enemigos ignoran el mapa
El sistema SHALL mover a los enemigos sin tener en cuenta el mapa (ver `procedural-map`): atraviesan celdas `trunk`,
`water` y `castle` y su persecución, su velocidad y su permanencia dentro de la arena MUST ser exactamente las mismas
que con un mapa todo `grass` con el mismo punto de salida. Los enemigos MUST NOT consultar el mapa ni consumir azar
por él. Sus posiciones de aparición tampoco tienen en cuenta el mapa (ver "Azar del mapa independiente del de la
partida" en `procedural-map`). Un enemigo puede estar, aparecer o morir sobre una celda `castle`: ningún requisito ni
test MUST suponer lo contrario.

#### Scenario: Persecución a través del agua
- **GIVEN** un mapa de hierba con las celdas (3, 4), (4, 4), (5, 4) y (6, 4) de `water` (x en [180, 420], y en
  [240, 300]), un jugador quieto en (480, 270) y un enemigo con velocidad 60 en (100, 270)
- **WHEN** se ejecutan 60 ticks
- **THEN** el enemigo está en (160, 270) con un error ≤ 0,001
- **AND** tras 240 ticks está en (340, 270) (error ≤ 0,001), dentro de la celda de agua (5, 4)

#### Scenario: Persecución a través del castillo
- **GIVEN** un mapa de hierba con las celdas de columnas 14–18 y filas 6–9 `castle` (x en [840, 1.140], y en
  [360, 600]), un jugador quieto en (990, 700) y un enemigo con velocidad 60 en (990, 300)
- **WHEN** se ejecutan 180 ticks
- **THEN** el enemigo está en (990, 480) (error ≤ 0,001), dentro de la celda `castle` (16, 8)
- **AND** tras 330 ticks está en (990, 630) (error ≤ 0,001): ha cruzado la huella entera

#### Scenario: Misma trayectoria con mapa generado y vacío
- **GIVEN** dos partidas con el contenido por defecto, la semilla 7, input (0, 0) y la política de elección fija, una
  con el mapa generado y otra con el mapa vacío con salida (990, 630) (ver `procedural-map`)
- **WHEN** ambas ejecutan 1.200 ticks
- **THEN** en cada tick la lista de enemigos (identificador, tipo, posición y vida) es igual en las dos

<!-- historial: 0002-enemy-spawning (2026-11-19) -->
<!-- historial: 0003-collisions-and-damage (2026-11-19) -->
<!-- historial: 0004-auto-weapons (2026-11-19) -->
<!-- historial: 0012-sprite-rendering (2026-11-22) -->
<!-- historial: 0013-world-camera (2026-11-23) -->
<!-- historial: 0015-procedural-map (2026-11-23) -->
<!-- historial: 0016-map-art (2026-11-23) -->
