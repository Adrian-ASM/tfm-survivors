# Spec delta · upgrades

<!-- Ruta: openspec/changes/0012-sprite-rendering/specs/upgrades/spec.md
     Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test. -->

> Cambios: solo renombrado de ids de enemigo, sin cambio de comportamiento. `goblin-torch` y `goblin-barrel`
> heredan, en ese orden, los stats de `bug` y `merge-conflict`. Los ids de las mejoras
> (`strict-rules`, `coverage`…) no cambian.

## ADDED Requirements
<!-- Ninguno. -->

## MODIFIED Requirements

### Requirement: Efectos de las mejoras
El sistema SHALL aplicar el efecto de una mejora en el momento de elegirla, de modo que rige desde el siguiente tick
ejecutado. Cada estadística afectada pasa a ser su valor efectivo (base + suma de nivel × `perLevel` de las mejoras
que la cambian). El contenido base no cambia: una partida nueva con el mismo contenido empieza sin mejoras. Reglas
por estadística:
- `damage` de un arma: lo usan los disparos desde el siguiente tick (un proyectil ya en vuelo conserva el daño con
  que se creó, ver `auto-weapons`);
- `cooldownTicks` de un arma: el arma conserva su estado de carga actual; el nuevo intervalo rige desde su siguiente
  disparo;
- `range` y `radius` del criterio de un arma: la selección de objetivo y el pulso los usan desde el siguiente tick
  (un pulso ya visible conserva su radio);
- `maxHealth` del jugador: sube la vida máxima y la vida actual en la misma cantidad (ver `player-health`);
- `speed` y `pickupRadius` del jugador: rigen desde el siguiente tick.

#### Scenario: Más daño del Linter
- **GIVEN** `strict-rules` en nivel 1 (Linter con `damage` 9)
- **WHEN** un proyectil del Linter creado después de la elección impacta a un `goblin-torch` con vida 10
- **THEN** el `goblin-torch` queda con vida 1

#### Scenario: Mejoras acumuladas que matan de un impacto
- **GIVEN** `strict-rules` en nivel 5 (Linter con `damage` 21)
- **WHEN** un proyectil del Linter impacta a un `goblin-torch` con vida 10 y otro a un `goblin-barrel` con vida 20
- **THEN** ambos quedan dados de baja con un solo impacto

#### Scenario: Cadencia mejorada sin reiniciar la carga
- **GIVEN** un objetivo permanente a 50 px que no muere y un Linter que dispara en el tick 1 (cargado de nuevo en el
  tick 31), y `fast-ci` elegido durante una oferta abierta en el tick 10 (`cooldownTicks` 26)
- **WHEN** se ejecutan los ticks hasta el 90
- **THEN** el Linter dispara exactamente en los ticks 1, 31, 57 y 83

#### Scenario: Más alcance
- **GIVEN** `wide-analysis` en nivel 1 (`range` 460) y un único enemigo vivo a 450 px del jugador
- **WHEN** el Linter cargado actúa
- **THEN** el objetivo es ese enemigo y se crea 1 proyectil

#### Scenario: Más radio del pulso
- **GIVEN** `coverage` en nivel 1 (`radius` 105) y dos `goblin-torch` de radio 10 a distancias 114 y 115 del jugador
- **WHEN** Tests dispara
- **THEN** el de 114 pierde 4 de vida y el de 115 no pierde vida

#### Scenario: Más daño de Tests
- **GIVEN** `hard-asserts` en nivel 1 (Tests con `damage` 6) y un `goblin-torch` con vida 10 en el radio del pulso
- **WHEN** Tests dispara
- **THEN** el `goblin-torch` queda con vida 4

#### Scenario: Cadencia de Tests mejorada
- **GIVEN** `watch-mode` en nivel 1 (`cooldownTicks` 78) elegido antes del tick 1 y un objetivo permanente en el
  radio que no muere
- **WHEN** se ejecutan 157 ticks
- **THEN** Tests dispara exactamente en los ticks 1, 79 y 157

#### Scenario: Más velocidad
- **GIVEN** `shortcuts` en nivel 1 (`speed` 220) y un jugador en (480, 270)
- **WHEN** se ejecutan 60 ticks con input (1, 0)
- **THEN** el jugador está en (700, 270) con un error ≤ 0,001

#### Scenario: Más radio de recogida
- **GIVEN** `pickupRadius` base 64, `context-window` en nivel 1 (efectivo 96), un jugador quieto en (480, 270) y una
  gema en (570, 270) (distancia 90)
- **WHEN** se ejecuta 1 tick
- **THEN** la gema está atraída y en (564, 270)

#### Scenario: El contenido base no cambia
- **GIVEN** una partida con `strict-rules` en nivel 3
- **WHEN** se crea otra partida con el mismo contenido
- **THEN** la nueva empieza sin mejoras y su Linter tiene `damage` 6

## REMOVED Requirements
<!-- Ninguno. -->
