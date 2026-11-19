# Spec delta · enemy-spawning

<!-- Change 0004-auto-weapons. La baja de enemigos deja de ser solo de tests: las armas dañan a los enemigos en
     juego (ver auto-weapons). La vida por tipo de content/enemies.json no cambia (bug 10, merge-conflict 20,
     memory-leak 45). El contacto con el jugador sigue sin quitar vida al enemigo. -->

## MODIFIED Requirements

### Requirement: Vida y baja de enemigos
El sistema SHALL dar a cada enemigo, al aparecer, una vida igual al `health` de su tipo. Aplicar a un enemigo
vivo un daño d > 0 MUST reducir su vida en d, sin bajar de 0. Cuando su vida llega a 0, el enemigo queda dado de
baja: deja de estar vivo de forma irreversible y desde ese momento:
- no aparece en ningún snapshot;
- no se mueve ni hace contacto con el jugador;
- no es objetivo ni recibe daño de ningún arma;
- no cuenta para `maxAlive`;
- su identificador no se reutiliza para ningún otro enemigo de la partida.

Aplicar daño a un enemigo ya dado de baja no tiene efecto. En juego, el único mecanismo que daña a los enemigos son
las armas (ver `auto-weapons`): cada impacto resta el `damage` base del arma que golpea. El contacto con el jugador
no les quita vida.

#### Scenario: Vida inicial del tipo
- **GIVEN** un tipo `bug` con `health` 5
- **WHEN** aparece un enemigo `bug`
- **THEN** su vida vale 5

#### Scenario: Vida por defecto de cada tipo
- **GIVEN** el contenido por defecto
- **WHEN** aparece un enemigo de cada tipo
- **THEN** `bug` tiene vida 10, `merge-conflict` 20 y `memory-leak` 45

#### Scenario: Daño que no mata
- **GIVEN** un enemigo vivo con vida inicial 5 y un arma con `damage` 3
- **WHEN** el arma le golpea una vez en el tick n
- **THEN** sigue vivo, con vida 2, y sigue en el snapshot del tick n

#### Scenario: Daño exactamente igual a la vida
- **GIVEN** un enemigo vivo con identificador X y vida 5 en el snapshot del tick n − 1, y un arma con `damage` 5
- **WHEN** el arma le golpea una vez en el tick n
- **THEN** el snapshot del tick n no contiene ningún enemigo con identificador X

#### Scenario: Daño mayor que la vida
- **GIVEN** un enemigo vivo con vida 5 y un arma con `damage` 7
- **WHEN** el arma le golpea una vez
- **THEN** queda dado de baja igual que con un daño de 5

#### Scenario: Daño a un enemigo ya dado de baja
- **GIVEN** un enemigo dado de baja y un proyectil en vuelo cuya trayectoria pasa por la última posición que tuvo
- **WHEN** el proyectil llega a esa posición
- **THEN** no se produce ningún error, el número de enemigos vivos no cambia y el proyectil sigue en vuelo

#### Scenario: Identificador no reutilizado
- **GIVEN** `maxAlive` 1, un único tramo con `budgetPerSecond` 60, `bug` con coste 1 y un enemigo vivo con
  identificador X
- **WHEN** X queda dado de baja y se ejecutan 60 ticks
- **THEN** hay exactamente 1 enemigo vivo y su identificador es distinto de X

#### Scenario: Golpear al jugador no quita vida al enemigo
- **GIVEN** una partida sin armas equipadas y un enemigo con vida inicial 5 en contacto continuo con el jugador
- **WHEN** se ejecutan 600 ticks con la partida en curso
- **THEN** el enemigo sigue vivo con vida 5
