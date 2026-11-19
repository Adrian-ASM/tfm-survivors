# Spec delta · player-health

<!-- Change 0006-run-lifecycle-hud. Cambio menor: llegar a vida 0 ya no solo "termina" la partida, sino que la termina
     con resultado derrota (ver `run-state` y `run-outcome`), incluso en el tick de la duración objetivo. -->

## MODIFIED Requirements

### Requirement: Vida mínima 0
El sistema SHALL impedir que la vida del jugador baje de 0: si el daño de un golpe es mayor o igual que la vida
restante, la vida queda exactamente en 0. Llegar a 0 termina la partida con resultado derrota según `run-state`,
también si ocurre en el tick de la duración objetivo (la derrota gana a la victoria, ver `run-outcome`).

#### Scenario: Daño exactamente igual a la vida restante
- **GIVEN** un jugador con vida 10, no invulnerable, y un enemigo con damage 10 en contacto
- **WHEN** se ejecuta 1 tick
- **THEN** la vida vale exactamente 0 y la partida está terminada con resultado derrota

#### Scenario: Daño mayor que la vida restante
- **GIVEN** un jugador con vida 10, no invulnerable, y un enemigo con damage 25 en contacto
- **WHEN** se ejecuta 1 tick
- **THEN** la vida vale exactamente 0, no −15, y el resultado es derrota

#### Scenario: Vida que no llega a 0
- **GIVEN** un jugador con vida 11, no invulnerable, y un enemigo con damage 10 en contacto
- **WHEN** se ejecuta 1 tick
- **THEN** la vida vale 1, la partida sigue en curso y no hay resultado

#### Scenario: Vida 1 en el tick de la victoria
- **GIVEN** una partida con duración objetivo de 120 ticks y un jugador con vida 11, no invulnerable, con un enemigo
  de damage 10 en contacto en el tick 120
- **WHEN** se ejecuta el tick 120
- **THEN** la vida vale 1 y la partida está terminada con resultado victoria
