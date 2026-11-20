# Run outcome · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
La duración objetivo de la partida, su resultado (victoria al llegar vivo al final, derrota con vida 0) y el contador de bajas.

## Requirements

### Requirement: Duración objetivo validada
El sistema SHALL leer la duración objetivo de la partida desde `content/*.json`, en el campo `durationSeconds`,
validada con zod antes de llegar al dominio. `durationSeconds` MUST ser un entero ≥ 1; un valor ausente, 0,
negativo o no entero MUST impedir que la partida arranque, con un error que mencione `durationSeconds`. La duración
en ticks es `durationSeconds × 60` (60 ticks = 1 s). El contenido por defecto MUST fijar `durationSeconds` a 600.

#### Scenario: Contenido por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito, `durationSeconds` vale 600 y la duración objetivo equivale a 36.000 ticks

#### Scenario: Duración mínima válida
- **GIVEN** un contenido con `"durationSeconds": 1`
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito y la duración objetivo equivale a 60 ticks

#### Scenario: Duración cero o negativa
- **GIVEN** un contenido con `"durationSeconds": 0` o con `"durationSeconds": -60`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `durationSeconds`
- **AND** no se crea ninguna partida

#### Scenario: Duración no entera o ausente
- **GIVEN** un contenido con `"durationSeconds": 600.5`, con `"durationSeconds": "600"` o sin el campo
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `durationSeconds`
- **AND** no se crea ninguna partida

### Requirement: Tiempo de partida por ticks ejecutados
El sistema SHALL medir el tiempo de partida como el número de ticks ejecutados (`snapshot.tick`), sin reloj del
sistema. Los ticks pedidos mientras la partida está eligiendo mejora o terminada no se ejecutan (ver `run-state`) y
MUST NOT hacer avanzar el tiempo de partida ni acercar la victoria.

#### Scenario: La elección de mejora no consume tiempo de partida
- **GIVEN** una partida con duración objetivo de 60 ticks (`durationSeconds` 1) y vida suficiente para no llegar a
  0, que abre una oferta en el tick 30
- **WHEN** se piden 600 ticks durante la oferta, se elige la opción 0 y se ejecutan 29 ticks más
- **THEN** el snapshot tiene tick 59, la partida está en curso y no hay resultado
- **AND** tras 1 tick más el snapshot tiene tick 60 y la partida está terminada con victoria

### Requirement: Victoria al alcanzar la duración objetivo
El sistema SHALL terminar la partida con resultado **victoria** en el tick ejecutado cuyo número es igual a la
duración objetivo en ticks (36.000 con el contenido por defecto), siempre que la vida del jugador no haya llegado a
0 en ese tick ni antes. Antes de ese tick la partida MUST NOT tener resultado. La victoria termina la partida en
ese mismo tick (que cuenta en `snapshot.tick`) y la congela igual que la derrota (ver `run-state`).

#### Scenario: Victoria exacta en el tick 36.000
- **GIVEN** el contenido por defecto salvo una vida máxima del jugador suficiente para no llegar a 0 en
  36.000 ticks, semilla 7 y la política de elección fija (ver `simulation-loop`)
- **WHEN** se ejecutan 36.000 ticks
- **THEN** el snapshot del tick 35.999 está en curso o eligiendo mejora y sin resultado
- **AND** el snapshot del tick 36.000 está terminado con resultado victoria y la vida es > 0

#### Scenario: Victoria con duración corta
- **GIVEN** una partida con `durationSeconds` 2, sin enemigos (`budgetPerSecond` 0) y sin ofertas
- **WHEN** se ejecutan 119 ticks y después 1 tick más
- **THEN** tras 119 ticks la partida está en curso y sin resultado
- **AND** tras 120 ticks está terminada con resultado victoria y `snapshot.tick` vale 120

#### Scenario: Ticks pedidos tras la victoria
- **GIVEN** la partida del escenario anterior, terminada con victoria en el tick 120
- **WHEN** se piden 600 ticks más con input (1, 1)
- **THEN** `snapshot.tick` sigue en 120 y el resultado sigue siendo victoria

### Requirement: Derrota antes de la duración objetivo
El sistema SHALL terminar la partida con resultado **derrota** en el tick en que la vida del jugador llega a 0 (ver
`run-state` y `player-health`), sea cual sea el tiempo de partida restante. Una partida terminada con derrota MUST
NOT pasar después a victoria aunque se pidan ticks hasta superar la duración objetivo.

#### Scenario: Derrota temprana
- **GIVEN** una partida con duración objetivo 36.000 ticks y el jugador a vida 10, no invulnerable, con un enemigo
  de damage 10 en contacto en el tick 1.200
- **WHEN** se ejecuta el tick 1.200
- **THEN** la partida está terminada con resultado derrota, vida 0 y `snapshot.tick` 1.200

#### Scenario: La derrota no se convierte en victoria
- **GIVEN** la partida del escenario anterior
- **WHEN** se piden 36.000 ticks más
- **THEN** el resultado sigue siendo derrota y `snapshot.tick` sigue en 1.200

#### Scenario: Derrota en el tick anterior a la victoria
- **GIVEN** una partida con duración objetivo 36.000 ticks y un golpe letal en el tick 35.999
- **WHEN** se ejecutan los ticks 35.999 y 36.000
- **THEN** la partida termina con derrota en el tick 35.999 y `snapshot.tick` no llega a 36.000

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
- **GIVEN** una partida con duración objetivo de 120 ticks, 5 bajas acumuladas y un bug con vida 4 que muere por un
  impacto del Linter en el tick 120
- **WHEN** se ejecuta el tick 120
- **THEN** la partida está terminada con victoria, las bajas valen 6 y el snapshot contiene la gema de ese bug

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
- **GIVEN** una partida con 2 bajas y 3 bugs con vida 4 dentro del radio de un pulso de Tests con `damage` 4
- **WHEN** Tests dispara en el tick n
- **THEN** el snapshot del tick n tiene 5 bajas y ninguno de esos 3 bugs

#### Scenario: Una baja cuenta una sola vez
- **GIVEN** un bug con vida 4 que recibe en el mismo tick 2 impactos del Linter con `damage` 6
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
  bug con vida 4 a 300 px que muere por el Linter en el tick n
- **WHEN** se ejecuta el tick n y después se piden 600 ticks más
- **THEN** el snapshot del tick n tiene 8 bajas y resultado derrota, y tras los 600 ticks las bajas siguen en 8

### Requirement: Invariante entre estado y resultado
El sistema SHALL mantener en todo snapshot que el resultado está definido (victoria o derrota) si y solo si la
partida está terminada. Una partida en curso o eligiendo mejora MUST NOT tener resultado, y una partida terminada
MUST tener exactamente uno, que no cambia nunca.

#### Scenario: Invariante durante una partida completa
- **GIVEN** el contenido por defecto, semilla 42, input (0, 0) y la política de elección fija
- **WHEN** se ejecutan ticks hasta que la partida termina o hasta el tick 36.000
- **THEN** en cada snapshot el resultado está vacío si el estado es en curso o eligiendo mejora, y es victoria o
  derrota si el estado es terminada

#### Scenario: Sin resultado mientras se elige mejora
- **GIVEN** una partida que abre una oferta en el tick n
- **WHEN** se lee el snapshot del tick n
- **THEN** el estado es eligiendo mejora y no hay resultado

### Requirement: Partida ganable y perdible con el contenido por defecto
El sistema SHALL permitir, con el contenido por defecto, tanto ganar como perder una partida sin motor: existe al
menos una semilla y una estrategia reproducible de input y elecciones (fijadas y documentadas en apply) con la que
el jugador llega vivo al tick 36.000, y un jugador quieto pierde antes.

#### Scenario: Partida ganada con estrategia documentada
- **GIVEN** el contenido por defecto, la semilla y la estrategia de input y elecciones documentadas en apply
  (provisional, a medir al inicio de apply)
- **WHEN** se ejecutan 36.000 ticks
- **THEN** la partida está terminada con resultado victoria en el tick 36.000

#### Scenario: Jugador quieto pierde
- **GIVEN** el contenido por defecto, semilla 42, input (0, 0) en todos los ticks y la política de elección fija
- **WHEN** se ejecutan ticks hasta el 36.000
- **THEN** la partida termina con resultado derrota en algún tick < 36.000

<!-- historial: 0006-run-lifecycle-hud (2026-11-20) -->
