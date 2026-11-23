# Spec delta · run-outcome

<!-- Ruta: openspec/changes/0013-world-camera/specs/run-outcome/spec.md
     "Partida ganable y perdible con el contenido por defecto" NO se modifica: la banda sigue en 25..35 victorias de 50
     (decisión del gate, alternativa (a)) y el límite de 180 s del jugador quieto sigue igual. El "contenido por
     defecto" pasa a incluir el mundo de 1.920 × 1.080 (ver `world-camera`); no se tocan stats de armas, enemigos,
     mejoras ni oleadas. Medición previa con 1.920 × 1.080: 25 victorias y 0 quietos supervivientes. -->

## ADDED Requirements

### Requirement: Una sola fuente del tamaño del mundo en los tests
Los tests unitarios, los E2E, los helpers de `tests/support/` y los benchmarks SHALL obtener el tamaño del mundo y el
de la vista de `content/arena.json` (o del contenido ya validado), sin escribir sus dimensiones por su cuenta. Un test
que necesite otro tamaño para un caso concreto MUST declararlo en el propio escenario como arena explícita.

#### Scenario: Sin arena por defecto duplicada
- **GIVEN** el directorio `tests/` tras el change
- **WHEN** se busca `DEFAULT_ARENA`
- **THEN** no hay ninguna coincidencia

#### Scenario: El bot huye de las paredes del mundo real
- **GIVEN** una partida creada con el contenido por defecto salvo una arena explícita de 4.000 × 4.000, y un snapshot
  suyo con el jugador en (3.980, 2.000) y ningún enemigo vivo
- **WHEN** el bot de referencia calcula el input sin recibir ningún otro dato de tamaño
- **THEN** el input es (−1, 0) (la pared derecha está a 20 px), y con el jugador en (1.900, 2.000) es (0, 0)

## MODIFIED Requirements

### Requirement: Bot de referencia para el balance
El proyecto SHALL tener un **bot de referencia** versionado como helper de test (`tests/support/`), puro y
determinista, que es la única referencia de dificultad de los tests de balance. El bot MUST jugar así:
- **Movimiento**: en cada tick, el input es el de la política de huida `fleeInput` aplicada al snapshot anterior:
  suma una repulsión 1/d² de cada enemigo vivo a menos de 150 px y de cada pared del mundo a menos de 64 px, y la
  cuantiza a una de las 8 direcciones; si la suma es el vector nulo, el input es (0, 0). Las paredes son los bordes
  del mundo del contenido con el que se juega la partida (1.920 × 1.080 por defecto), nunca un tamaño fijo del bot.
  La distancia a una pared se mide desde el centro del jugador.
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
- **GIVEN** un snapshot con el jugador en (960, 540) en el mundo de 1.920 × 1.080 y ningún enemigo vivo
- **WHEN** el bot de referencia calcula el input
- **THEN** el input es (0, 0)

#### Scenario: Huida de un enemigo
- **GIVEN** un snapshot con el jugador en (960, 540) en el mundo de 1.920 × 1.080 y un único enemigo vivo en
  (1.060, 540) (a 100 px, dentro de 150)
- **WHEN** el bot de referencia calcula el input
- **THEN** el input es (−1, 0)

#### Scenario: Enemigo fuera de rango
- **GIVEN** un snapshot con el jugador en (960, 540) en el mundo de 1.920 × 1.080 y un único enemigo vivo en
  (1.110, 540) (a 150 px, no menos de 150)
- **WHEN** el bot de referencia calcula el input
- **THEN** el input es (0, 0)

#### Scenario: Repulsión de la pared derecha del mundo
- **GIVEN** un snapshot con el jugador en (1.900, 540) en el mundo de 1.920 × 1.080 (a 20 px de la pared derecha) y
  ningún enemigo vivo
- **WHEN** el bot de referencia calcula el input
- **THEN** el input es (−1, 0)

#### Scenario: El borde de la vista no es una pared
- **GIVEN** un snapshot con el jugador en (940, 270) en el mundo de 1.920 × 1.080 (a ≥ 270 px de cada pared) y
  ningún enemigo vivo
- **WHEN** el bot de referencia calcula el input
- **THEN** el input es (0, 0)

#### Scenario: Pared a exactamente 64 px
- **GIVEN** un snapshot con el jugador en (64, 540) en el mundo de 1.920 × 1.080 y ningún enemigo vivo
- **WHEN** el bot de referencia calcula el input
- **THEN** el input es (0, 0)

#### Scenario: Esquina del mundo
- **GIVEN** un snapshot con el jugador en (1.904, 1.064) en el mundo de 1.920 × 1.080 y ningún enemigo vivo
- **WHEN** el bot de referencia calcula el input
- **THEN** el input apunta en la diagonal hacia −x y −y (componentes negativas y del mismo módulo)

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
`content/*.json`, incluido el tamaño del mundo y de la vista: si usan una copia en código, la copia MUST ser igual
campo a campo al JSON validado. Los tests de balance de esta spec MUST ejecutarse dentro de la suite unitaria de
`npm run verify`.

#### Scenario: Sin semillas sueltas de balance
- **GIVEN** el directorio `tests/` tras el change
- **WHEN** se busca en los tests de balance una constante de semilla ganadora (`WIN_SEED`) o una aserción de
  victoria o derrota sobre la semilla 2 o la 90
- **THEN** no hay ninguna coincidencia

#### Scenario: Contenido de los tests igual al del juego
- **GIVEN** el contenido de oleadas, enemigos, armas, mejoras, progresión, jugador y arena (mundo y vista) cargado y
  validado desde `content/*.json` y la configuración por defecto que usan los tests de balance
- **WHEN** se comparan campo a campo, sin tener en cuenta el orden de las claves
- **THEN** son iguales

#### Scenario: Derrota E2E con una semilla del conjunto
- **GIVEN** la build de producción servida con `?e2e&seed=42` (42 pertenece a 1..50) y sin input de movimiento
- **WHEN** la partida avanza con la política de elección fija
- **THEN** termina con resultado derrota con como mucho 180 s de juego (10.800 ticks)
