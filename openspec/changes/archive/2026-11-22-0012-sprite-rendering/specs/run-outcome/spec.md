# Spec delta · run-outcome

<!-- Ruta: openspec/changes/0012-sprite-rendering/specs/run-outcome/spec.md
     Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test. -->

> Cambios: solo renombrado de ids de enemigo, sin cambio de comportamiento ni de balance. `goblin-torch` hereda los stats
> de `bug`. "Partida ganable y perdible con el contenido por defecto", "Bot de
> referencia para el balance" y "Semillas de los tests de balance" no citan ids y siguen vigentes sin recalibrar:
> entre 25 y 35 victorias del bot sobre las semillas 1..50 y "quieto pierde antes de 180 s" con todas ellas.

## ADDED Requirements
<!-- Ninguno. -->

## MODIFIED Requirements

### Requirement: Prioridades en el tick de la victoria
El sistema SHALL resolver el tick cuyo número es igual a la duración objetivo así: se ejecutan el movimiento, la
persecución, las armas (con sus bajas y las gemas que sueltan) y el contacto con el jugador. Si en ese contacto la
vida llega a 0, el resultado MUST ser **derrota** (la derrota gana a la victoria). Si no, el resultado es victoria
y en ese tick MUST NOT recogerse ninguna gema, sumarse XP, registrarse subidas de nivel, aparecer enemigos ni
abrirse ninguna oferta de mejoras (misma regla que el tick de la muerte, ver `run-state`).

#### Scenario: Muerte y victoria en el mismo tick
- **GIVEN** una partida con duración objetivo 36.000 ticks, el jugador a vida 10, no invulnerable, y un enemigo con
  damage 10 en contacto en el tick 36.000
- **WHEN** se ejecuta el tick 36.000
- **THEN** la partida está terminada con resultado derrota y vida 0

#### Scenario: Victoria y subida de nivel en el mismo tick
- **GIVEN** una partida con duración objetivo de 120 ticks, el jugador vivo en nivel 1 con XP 4 y una gema de valor
  1 que se recogería en el tick 120
- **WHEN** se ejecuta el tick 120
- **THEN** la partida está terminada con resultado victoria y no hay oferta abierta
- **AND** el nivel sigue en 1 con XP 4 y la gema sigue en el snapshot

#### Scenario: Sin spawns en el tick de la victoria
- **GIVEN** una partida con duración objetivo de 120 ticks y un director cuyo presupuesto alcanza el coste del tipo
  pendiente en el tick 120
- **WHEN** se ejecuta el tick 120
- **THEN** ningún enemigo del snapshot del tick 120 tiene un identificador que no estuviera en el del tick 119

#### Scenario: Una baja en el tick de la victoria cuenta y deja su gema
- **GIVEN** una partida con duración objetivo de 120 ticks, 5 bajas acumuladas y un `goblin-torch` con vida 4 que muere
  por un impacto del Linter en el tick 120
- **WHEN** se ejecuta el tick 120
- **THEN** la partida está terminada con victoria, las bajas valen 6 y el snapshot contiene la gema de ese
  `goblin-torch`

### Requirement: Contador de bajas
El sistema SHALL contar las bajas de la partida: cada enemigo que queda dado de baja (su vida llega a 0, ver
`enemy-spawning`) suma exactamente 1. Una partida recién creada MUST empezar con 0 bajas. El contador no se
reinicia al subir de nivel ni al elegir mejora, no baja nunca y no cambia mientras la partida está eligiendo mejora
o terminada. Aplicar daño a un enemigo ya dado de baja MUST NOT sumar otra baja. Las bajas producidas en el paso de
armas del tick en que la partida termina (por derrota o por victoria) sí cuentan. El snapshot MUST exponer las
bajas.

#### Scenario: Partida recién creada
- **GIVEN** una partida recién creada con el contenido por defecto
- **WHEN** se lee el snapshot antes del primer tick
- **THEN** las bajas valen 0

#### Scenario: Varias bajas en un tick
- **GIVEN** una partida con 2 bajas y 3 `goblin-torch` con vida 4 dentro del radio de un pulso de Tests con `damage` 4
- **WHEN** Tests dispara en el tick n
- **THEN** el snapshot del tick n tiene 5 bajas y ninguno de esos 3 enemigos

#### Scenario: Una baja cuenta una sola vez
- **GIVEN** un `goblin-torch` con vida 4 que recibe en el mismo tick 2 impactos del Linter con `damage` 6
- **WHEN** se ejecuta ese tick
- **THEN** las bajas suben exactamente en 1

#### Scenario: El contacto no cuenta como baja
- **GIVEN** una partida sin armas equipadas y 3 enemigos en contacto continuo con un jugador de vida 1.000
- **WHEN** se ejecutan 600 ticks
- **THEN** las bajas siguen valiendo 0

#### Scenario: Las bajas sobreviven a la subida de nivel
- **GIVEN** una partida con 12 bajas en nivel 1 que abre una oferta en el tick n
- **WHEN** se elige la opción 0 y se ejecuta 1 tick sin bajas nuevas
- **THEN** las bajas siguen valiendo 12 en el snapshot del tick n y en el del tick n + 1

#### Scenario: Baja en el tick de la muerte
- **GIVEN** una partida con 7 bajas, el jugador a vida 10 con un enemigo de damage 10 en contacto en el tick n y un
  `goblin-torch` con vida 4 a 300 px que muere por el Linter en el tick n
- **WHEN** se ejecuta el tick n y después se piden 600 ticks más
- **THEN** el snapshot del tick n tiene 8 bajas y resultado derrota, y tras los 600 ticks las bajas siguen en 8

## REMOVED Requirements
<!-- Ninguno. -->
