# Spec delta · enemy-behavior

<!-- Ruta: openspec/changes/0012-sprite-rendering/specs/enemy-behavior/spec.md
     Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test. -->

> Cambios: solo renombrado de ids de enemigo, sin cambio de comportamiento. Los tres goblins se mueven igual que los
> tipos a los que sustituyen (persecución en línea recta); los comportamientos propios de cada goblin son del change
> 0016. `goblin-torch` y `goblin-tnt` heredan, en ese orden, los stats de `bug` y
> `memory-leak`.

## ADDED Requirements
<!-- Ninguno. -->

## MODIFIED Requirements

### Requirement: Velocidad por tipo
El sistema SHALL mover cada enemigo a la velocidad de su tipo, definida en contenido. Dos enemigos de tipos con
distinta velocidad recorren distancias distintas en el mismo número de ticks.

#### Scenario: Dos tipos, dos velocidades
- **GIVEN** un jugador quieto en (900, 270), un `goblin-torch` con velocidad 90 en (100, 100) y un `goblin-tnt`
  con velocidad 45 en (100, 440)
- **WHEN** se ejecutan 60 ticks
- **THEN** el `goblin-torch` ha recorrido 90 unidades y el `goblin-tnt` 45, ambos con un error ≤ 0,001

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

## REMOVED Requirements
<!-- Ninguno. -->
