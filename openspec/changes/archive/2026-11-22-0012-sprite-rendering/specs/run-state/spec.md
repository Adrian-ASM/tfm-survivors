# Spec delta · run-state

<!-- Ruta: openspec/changes/0012-sprite-rendering/specs/run-state/spec.md
     Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test. -->

> Cambios: solo renombrado de ids de enemigo, sin cambio de comportamiento. `goblin-torch` hereda los stats
> de `bug`.

## ADDED Requirements
<!-- Ninguno. -->

## MODIFIED Requirements

### Requirement: Fin de partida al llegar a vida 0
El sistema SHALL pasar la partida a terminada con resultado derrota en el mismo tick en que la vida del jugador
llega a 0, también si ese tick es el de la duración objetivo (la derrota gana a la victoria, ver `run-outcome`).
Ese tick cuenta: el contador de ticks del snapshot lo incluye. En ese tick MUST NOT aparecer ningún enemigo nuevo,
recogerse ninguna gema ni abrirse ninguna oferta de mejoras: ni el paso de gemas ni el director ni la apertura de
ofertas actúan en el tick en que la partida termina. Las gemas soltadas por las bajas de ese tick sí quedan en el
suelo y esas bajas cuentan en el contador de bajas.

#### Scenario: Golpe que deja la vida en 0
- **GIVEN** una partida en el tick 99 con el jugador a vida 10, no invulnerable, y un enemigo con damage 10 que
  estará en contacto en el tick 100
- **WHEN** se ejecuta 1 tick
- **THEN** el snapshot tiene tick 100, vida 0, estado terminada y resultado derrota

#### Scenario: Varios contactos en el tick de la muerte
- **GIVEN** un jugador con vida 10, no invulnerable, y dos enemigos con damage 10 y 25 en contacto en el mismo
  tick
- **WHEN** se ejecuta 1 tick
- **THEN** la vida vale 0 (no negativa), el estado es terminada y el resultado es derrota

#### Scenario: Sin spawns en el tick de la muerte
- **GIVEN** una partida con el jugador a vida 10 y un enemigo con damage 10 que estará en contacto en el tick n,
  y un director cuyo presupuesto alcanza el coste del tipo pendiente en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** el número de enemigos vivos del snapshot del tick n es igual al del tick n − 1

#### Scenario: Muerte y subida de nivel en el mismo tick
- **GIVEN** un jugador en nivel 1 con XP 4 y vida 10, no invulnerable, una gema de valor 1 que se recogería en el
  tick n y un enemigo con damage 10 en contacto en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** el estado es terminada con resultado derrota, la vida vale 0 y no hay oferta abierta
- **AND** el nivel sigue en 1 con XP 4 y la gema sigue en el snapshot

#### Scenario: Una baja en el tick de la muerte deja su gema
- **GIVEN** un jugador con vida 10, no invulnerable, un enemigo con damage 10 en contacto en el tick n y un
  `goblin-torch` con vida 4 a 300 px que muere por el Linter en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** el estado es terminada y el snapshot del tick n contiene la gema de ese `goblin-torch` y cuenta su baja

#### Scenario: Muerte en el tick de la duración objetivo
- **GIVEN** una partida con duración objetivo de 36.000 ticks, el jugador a vida 10, no invulnerable, y un enemigo
  con damage 10 en contacto en el tick 36.000
- **WHEN** se ejecuta el tick 36.000
- **THEN** el estado es terminada, el resultado es derrota y la vida vale 0

## REMOVED Requirements
<!-- Ninguno. -->
