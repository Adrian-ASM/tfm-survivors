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
El sistema SHALL permitir, con el contenido por defecto, tanto ganar como perder una partida sin motor, con una
dificultad medida sobre el conjunto de semillas 1..50 (ver "Semillas de los tests de balance"):
- **Ganable**: el bot de referencia (ver "Bot de referencia para el balance") MUST llegar vivo al tick 36.000
  (resultado victoria) con **al menos 25 y como mucho 35** de las 50 semillas (del 50 % al 70 %, ambos incluidos).
  Una semilla cuenta como victoria solo si la partida termina con resultado victoria en el tick 36.000; cualquier
  otra, como derrota.
- **Perdible**: con input (0, 0) en todos los ticks y la política de elección fija (ver `simulation-loop`), la
  partida MUST terminar con resultado derrota en un tick < 10.800 (antes de 180 s) con **cada una** de las 50
  semillas. Un jugador quieto MUST NOT ganar con ninguna semilla del conjunto.

Los números de contenido que producen esta dificultad viven en `content/*.json` y no se fijan en esta spec.

#### Scenario: Tasa de victoria del bot de referencia
- **GIVEN** el contenido por defecto y el bot de referencia
- **WHEN** se juega una partida con cada semilla de 1 a 50, cada una hasta que termina o hasta el tick 36.000
- **THEN** el número de partidas terminadas con resultado victoria en el tick 36.000 es ≥ 25 y ≤ 35

#### Scenario: Toda partida del bot termina
- **GIVEN** el contenido por defecto y el bot de referencia
- **WHEN** se juega cada semilla de 1 a 50 hasta el tick 36.000
- **THEN** las 50 partidas están terminadas, con resultado victoria o derrota, en un tick ≤ 36.000

#### Scenario: Jugador quieto pierde con todas las semillas
- **GIVEN** el contenido por defecto, input (0, 0) en todos los ticks y la política de elección fija
- **WHEN** se juega una partida con cada semilla de 1 a 50, cada una hasta que termina o hasta el tick 10.800
- **THEN** las 50 partidas están terminadas con resultado derrota, cada una en un tick < 10.800

#### Scenario: Muerte quieta en el límite de 180 s
- **GIVEN** el contenido por defecto, input (0, 0), la política de elección fija y una semilla de 1..50 cuya partida
  sigue en curso o eligiendo mejora en el tick 10.799
- **WHEN** se evalúa el requisito "Perdible" para esa semilla
- **THEN** el test de "quieto pierde" falla, aunque la partida termine con derrota en el tick 10.800 o después

### Requirement: Bot de referencia para el balance
El proyecto SHALL tener un **bot de referencia** versionado como helper de test (`tests/support/`), puro y
determinista, que es la única referencia de dificultad de los tests de balance. El bot MUST jugar así:
- **Movimiento**: en cada tick, el input es el de la política de huida `fleeInput` aplicada al snapshot anterior:
  suma una repulsión 1/d² de cada enemigo vivo a menos de 150 px y de cada pared de la arena a menos de 64 px, y la
  cuantiza a una de las 8 direcciones; si la suma es el vector nulo, el input es (0, 0).
- **Elección**: cada vez que se abre una oferta, antes del siguiente tick, elige la opción cuyo id aparece antes en
  la lista de prioridad `guardrail` > `strict-rules` > `fast-ci` > `hard-asserts` > `watch-mode`, sea cual sea su
  posición en la oferta; si la oferta no contiene ninguno de esos ids, elige la opción de índice 0.

El bot de referencia es un concepto aparte de la "política de elección fija" de `simulation-loop`, que sigue
valiendo para los escenarios que no dicen nada de elecciones. Cualquier cambio de su movimiento o de su lista de
prioridad MUST hacerse con un change que revise los requisitos de balance de esta spec.

#### Scenario: Elige por prioridad, no por posición
- **GIVEN** una oferta abierta con las opciones `watch-mode`, `fast-ci` y una tercera que no está en la lista de
  prioridad, en ese orden
- **WHEN** el bot de referencia elige
- **THEN** elige el índice 1 (`fast-ci`)

#### Scenario: La prioridad más alta gana
- **GIVEN** una oferta abierta con las opciones `strict-rules`, `hard-asserts` y `guardrail`, en ese orden
- **WHEN** el bot de referencia elige
- **THEN** elige el índice 2 (`guardrail`)

#### Scenario: Ningún id priorizado en la oferta
- **GIVEN** una oferta abierta de 3 opciones, ninguna con id `guardrail`, `strict-rules`, `fast-ci`,
  `hard-asserts` ni `watch-mode`
- **WHEN** el bot de referencia elige
- **THEN** elige el índice 0

#### Scenario: Oferta de una sola opción
- **GIVEN** una oferta abierta con 1 sola opción, que no está en la lista de prioridad
- **WHEN** el bot de referencia elige
- **THEN** elige el índice 0

#### Scenario: Huida sin amenazas
- **GIVEN** un snapshot con el jugador en (480, 270) en la arena de 960 × 540 y ningún enemigo vivo
- **WHEN** el bot de referencia calcula el input
- **THEN** el input es (0, 0)

#### Scenario: Huida de un enemigo
- **GIVEN** un snapshot con el jugador en (480, 270) en la arena de 960 × 540 y un único enemigo vivo en (580, 270)
  (a 100 px, dentro de 150)
- **WHEN** el bot de referencia calcula el input
- **THEN** el input es (−1, 0)

#### Scenario: Enemigo fuera de rango
- **GIVEN** un snapshot con el jugador en (480, 270) en la arena de 960 × 540 y un único enemigo vivo en (630, 270)
  (a 150 px, no menos de 150)
- **WHEN** el bot de referencia calcula el input
- **THEN** el input es (0, 0)

#### Scenario: Bot reproducible
- **GIVEN** dos partidas con el contenido por defecto y la semilla 7, ambas jugadas por el bot de referencia
- **WHEN** ambas se ejecutan hasta que terminan o hasta el tick 36.000
- **THEN** ambas terminan con el mismo resultado, en el mismo tick, con las mismas bajas y la misma lista de
  mejoras adquiridas con sus niveles

### Requirement: Semillas de los tests de balance
Los tests de balance SHALL usar como conjunto fijo de semillas los enteros **1..50** (ambos incluidos) y medir sobre
el conjunto completo. Ningún test (unitario ni E2E) MUST afirmar que una semilla concreta gana o pierde salvo cuando
esa semilla pertenece al conjunto y la afirmación se deduce de un requisito que vale para todo el conjunto (por
ejemplo, "Jugador quieto pierde"). Los tests MUST NOT fijar la semilla 2 como semilla ganadora ni la semilla 90 como
semilla de derrota rápida. Los tests de balance MUST medir con el mismo contenido que carga el juego desde
`content/*.json`: si usan una copia en código, la copia MUST ser igual campo a campo al JSON validado. Los tests de
balance de esta spec MUST ejecutarse dentro de la suite unitaria de `npm run verify`.

#### Scenario: Sin semillas sueltas de balance
- **GIVEN** el directorio `tests/` tras el change
- **WHEN** se busca en los tests de balance una constante de semilla ganadora (`WIN_SEED`) o una aserción de
  victoria o derrota sobre la semilla 2 o la 90
- **THEN** no hay ninguna coincidencia

#### Scenario: Contenido de los tests igual al del juego
- **GIVEN** el contenido de oleadas, enemigos, armas, mejoras, progresión y jugador cargado y validado desde
  `content/*.json` y la configuración por defecto que usan los tests de balance
- **WHEN** se comparan campo a campo, sin tener en cuenta el orden de las claves
- **THEN** son iguales

#### Scenario: Derrota E2E con una semilla del conjunto
- **GIVEN** la build de producción servida con `?e2e&seed=42` (42 pertenece a 1..50) y sin input de movimiento
- **WHEN** la partida avanza con la política de elección fija
- **THEN** termina con resultado derrota con como mucho 180 s de juego (10.800 ticks)

<!-- historial: 0006-run-lifecycle-hud (2026-11-20) -->
<!-- historial: 0010-balance-pass (2026-11-20) -->
<!-- historial: 0012-sprite-rendering (2026-11-22) -->
