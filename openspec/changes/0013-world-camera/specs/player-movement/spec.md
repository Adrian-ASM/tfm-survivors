# Spec delta · player-movement

<!-- Ruta: openspec/changes/0013-world-camera/specs/player-movement/spec.md
     La "arena" de esta spec es el mundo de `world-camera` (1.920 × 1.080 por defecto). Los escenarios con posiciones
     explícitas como (480, 270) siguen valiendo: no dependen del tamaño del mundo. -->

## ADDED Requirements

### Requirement: Posición inicial en el centro del mundo
El sistema SHALL crear cada partida nueva con el jugador en el centro del mundo (ancho / 2, alto / 2), también tras R
y tras `Volver al menú` + `Jugar`.

#### Scenario: Partida nueva con el mundo por defecto
- **GIVEN** el contenido por defecto
- **WHEN** se crea una partida y se lee el snapshot del tick 0
- **THEN** el jugador está exactamente en (960, 540)

#### Scenario: Partida nueva tras acabar en una esquina
- **GIVEN** una partida terminada con el jugador en (16, 16)
- **WHEN** se pulsa R y se lee el snapshot del tick 0 de la partida nueva
- **THEN** el jugador está exactamente en (960, 540)

## MODIFIED Requirements

### Requirement: Límites de la arena
El sistema SHALL mantener el círculo del jugador entero dentro de la arena (el mundo, ver `world-camera`): su centro
MUST quedar en [radio, ancho − radio] × [radio, alto − radio]. Con el contenido por defecto (mundo de 1.920 × 1.080 y
radio 16) ese rango es [16, 1.904] × [16, 1.064]. El tamaño de la vista MUST NOT limitar el movimiento.

#### Scenario: Choque con el borde derecho
- **GIVEN** un jugador en (1.900, 540) con radio 16 en una arena de 1.920 × 1.080
- **WHEN** se ejecutan 60 ticks con input (1, 0)
- **THEN** el jugador está en (1.904, 540)

#### Scenario: Choque con el borde inferior
- **GIVEN** un jugador en (960, 1.060) con radio 16 en una arena de 1.920 × 1.080
- **WHEN** se ejecutan 60 ticks con input (0, 1)
- **THEN** el jugador está en (960, 1.064)

#### Scenario: Esquina superior izquierda
- **GIVEN** un jugador en (20, 20) con radio 16
- **WHEN** se ejecutan 60 ticks con input (-1, -1)
- **THEN** el jugador está en (16, 16)

#### Scenario: Esquina inferior derecha
- **GIVEN** un jugador en (1.900, 1.060) con radio 16 en una arena de 1.920 × 1.080
- **WHEN** se ejecutan 60 ticks con input (1, 1)
- **THEN** el jugador está en (1.904, 1.064)

#### Scenario: Deslizar por la pared
- **GIVEN** un jugador en (1.904, 540) con radio 16 pegado al borde derecho de una arena de 1.920 × 1.080
- **WHEN** se ejecutan 30 ticks con input (1, 1)
- **THEN** x sigue en 1.904 y y ha aumentado 70,711 px (error ≤ 0,001 px)

#### Scenario: El borde de la vista no es una pared
- **GIVEN** el contenido por defecto (velocidad 200 px/s, radio 16) y un jugador en (940, 270)
- **WHEN** se ejecutan 60 ticks con input (1, 0)
- **THEN** el jugador está en (1.140, 270) con un error ≤ 0,001 px

#### Scenario: Partida larga dentro del mundo
- **GIVEN** el contenido por defecto salvo una vida máxima suficiente para no llegar a 0 en 36.000 ticks, semilla 7 y
  un input aleatorio generado por una semilla fija
- **WHEN** se ejecutan 36.000 ticks
- **THEN** en ningún tick el centro del jugador queda fuera de [16, 1.904] × [16, 1.064]
