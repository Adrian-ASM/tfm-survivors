# Spec delta · run-outcome

<!-- Change 0017-fullscreen-view. Mundo por defecto de 3.840 × 2.160, anillo de aparición de contenido
     (`ringRadius` 1.500), salida del mapa generado (1.950, 1.170), centro del mundo (1.920, 1.080). Huella del
     castillo en columnas 30–34 y filas 15–18. -->

## MODIFIED Requirements

### Requirement: Partida ganable y perdible con el contenido por defecto
El sistema SHALL permitir, con el contenido por defecto, tanto ganar como perder una partida sin motor, con una
dificultad medida sobre el conjunto de semillas 1..50 (ver "Semillas de los tests de balance"), cada partida con el
mapa que genera su semilla, castillo incluido, y el jugador en su punto de salida (ver `procedural-map` y
"Posición inicial en el punto de salida del mapa" en `player-movement`):
- **Ganable**: el bot de referencia (ver "Bot de referencia para el balance") MUST llegar vivo al tick 36.000
  (resultado victoria) con **al menos 25 y como mucho 35** de las 50 semillas (del 50 % al 70 %, ambos incluidos).
  Una semilla cuenta como victoria solo si la partida termina con resultado victoria en el tick 36.000; cualquier
  otra, como derrota.
- **Perdible**: con input (0, 0) en todos los ticks y la política de elección fija (ver `simulation-loop`), la
  partida MUST terminar con resultado derrota en un tick < 10.800 (antes de 180 s) con **cada una** de las 50
  semillas, tanto con el mapa generado como con el mapa vacío. Un jugador quieto MUST NOT ganar con ninguna semilla
  del conjunto.

La dificultad MUST ser la misma con cualquier tamaño de ventana: los tests de balance no reciben ventana ni vista.
Los números de contenido que producen esta dificultad viven en `content/*.json` y no se fijan en esta spec. En este
change el ajuste se hace en la tabla de oleadas (`content/waves.json`), que MUST seguir cumpliendo "Oleadas que
crecen con el contenido por defecto" de `enemy-spawning`; `player.speed` sigue en 215. La banda manda sobre cualquier
valor concreto: si el mundo, el anillo de aparición, la huella del castillo o la tabla de oleadas cambian en apply, el
balance MUST volver a medirse con el contenido final antes de verify.

#### Scenario: Tasa de victoria del bot de referencia
- **GIVEN** el contenido por defecto (mundo de 3.840 × 2.160, `ringRadius` 1.500) y el bot de referencia
- **WHEN** se juega una partida con cada semilla de 1 a 50, con su mapa generado (castillo incluido) y el jugador en
  su salida, cada una hasta que termina o hasta el tick 36.000
- **THEN** el número de partidas terminadas con resultado victoria en el tick 36.000 es ≥ 25 y ≤ 35

#### Scenario: Toda partida del bot termina
- **GIVEN** el contenido por defecto y el bot de referencia
- **WHEN** se juega cada semilla de 1 a 50, con su mapa generado, hasta el tick 36.000
- **THEN** las 50 partidas están terminadas, con resultado victoria o derrota, en un tick ≤ 36.000

#### Scenario: Jugador quieto pierde con todas las semillas
- **GIVEN** el contenido por defecto, input (0, 0) en todos los ticks y la política de elección fija
- **WHEN** se juega una partida con cada semilla de 1 a 50, con su mapa generado y el jugador quieto en
  (1.950, 1.170), cada una hasta que termina o hasta el tick 10.800
- **THEN** las 50 partidas están terminadas con resultado derrota, cada una en un tick < 10.800

#### Scenario: Jugador quieto pierde también con el mapa vacío
- **GIVEN** el contenido por defecto, el mapa vacío (jugador en (1.920, 1.080)), input (0, 0) en todos los ticks y la
  política de elección fija
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
- **Movimiento**: en cada tick, el input es el de la política de huida `fleeInput` aplicada al snapshot anterior y al
  mapa de la partida:
  1. suma una repulsión 1/d² de cada enemigo vivo a menos de 150 px, de cada pared del mundo a menos de 64 px y de
     cada celda no caminable (`trunk`, `water` o `castle`) a menos de 64 px. La distancia a una pared se mide desde el
     centro del jugador; la distancia a una celda, desde el centro del jugador hasta el punto más cercano del
     rectángulo cerrado de la celda, y su repulsión apunta de ese punto al centro del jugador. Las paredes son los
     bordes del mundo del contenido con el que se juega la partida (3.840 × 2.160 por defecto) y las celdas, las del
     mapa de esa partida, nunca un tamaño ni un mapa fijos del bot;
  2. cuantiza la suma a una de las 8 direcciones; si la suma es el vector nulo, el input es (0, 0);
  3. si la dirección elegida está bloqueada, prueba en este orden la dirección girada +45°, −45°, +90°, −90°, +135° y
     −135° (ángulo positivo = sentido horario en pantalla, de +x hacia +y) y usa la primera no bloqueada; si todas lo
     están, el input es (0, 0). Una dirección está bloqueada si un tick de movimiento sin obstáculos en ella, a la
     velocidad efectiva y desde la posición del snapshot, dejaría el círculo del jugador solapando una celda no
     caminable (ver "Colisión con el mapa" en `player-movement`). Las paredes del mundo no bloquean.
- **Elección**: cada vez que se abre una oferta, antes del siguiente tick, elige la opción cuyo id aparece antes en
  la lista de prioridad `guardrail` > `strict-rules` > `fast-ci` > `hard-asserts` > `watch-mode`, sea cual sea su
  posición en la oferta; si la oferta no contiene ninguno de esos ids, elige la opción de índice 0.

El castillo no añade lógica al bot: sus celdas cuentan como cualquier otra celda no caminable. El bot no recibe la
vista ni la ventana. El bot de referencia es un concepto aparte de la "política de elección fija" de
`simulation-loop`, que sigue valiendo para los escenarios que no dicen nada de elecciones. Cualquier cambio de su
movimiento o de su lista de prioridad MUST hacerse con un change que revise los requisitos de balance de esta spec. Los
escenarios de este requisito con posiciones explícitas y sin mapa declarado usan el mapa vacío.

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
- **GIVEN** un snapshot con el jugador en (1.920, 1.080) en el mundo de 3.840 × 2.160 y ningún enemigo vivo
- **WHEN** el bot de referencia calcula el input
- **THEN** el input es (0, 0)

#### Scenario: Salida ante la puerta con el mapa generado
- **GIVEN** el contenido por defecto y, para cada semilla de 1 a 50, su mapa generado y el snapshot del tick 0
  (jugador en la salida (1.950, 1.170), a 30 px de la celda `castle` (32, 18) y a 42,426 px de las esquinas de la
  (31, 18) y la (33, 18); sin enemigos)
- **WHEN** el bot de referencia calcula el input
- **THEN** el input es (0, 1) con las 50 semillas: la repulsión de la fachada apunta hacia +y y sus componentes x se
  anulan

#### Scenario: Huida de un enemigo
- **GIVEN** un snapshot con el jugador en (1.920, 1.080) en el mundo de 3.840 × 2.160 y un único enemigo vivo en
  (2.020, 1.080) (a 100 px, dentro de 150)
- **WHEN** el bot de referencia calcula el input
- **THEN** el input es (−1, 0)

#### Scenario: Enemigo fuera de rango
- **GIVEN** un snapshot con el jugador en (1.920, 1.080) en el mundo de 3.840 × 2.160 y un único enemigo vivo en
  (2.070, 1.080) (a 150 px, no menos de 150)
- **WHEN** el bot de referencia calcula el input
- **THEN** el input es (0, 0)

#### Scenario: Repulsión de la pared derecha del mundo
- **GIVEN** un snapshot con el jugador en (3.820, 1.080) en el mundo de 3.840 × 2.160 (a 20 px de la pared derecha) y
  ningún enemigo vivo
- **WHEN** el bot de referencia calcula el input
- **THEN** el input es (−1, 0)

#### Scenario: El borde de la vista no es una pared
- **GIVEN** un snapshot con el jugador en (1.270, 270) en el mundo de 3.840 × 2.160 (junto al borde derecho de una
  vista de 1.280 × 720 anclada en (0, 0) y a ≥ 270 px de cada pared) y ningún enemigo vivo
- **WHEN** el bot de referencia calcula el input
- **THEN** el input es (0, 0)

#### Scenario: Pared a exactamente 64 px
- **GIVEN** un snapshot con el jugador en (64, 1.080) en el mundo de 3.840 × 2.160 y ningún enemigo vivo
- **WHEN** el bot de referencia calcula el input
- **THEN** el input es (0, 0)

#### Scenario: Esquina del mundo
- **GIVEN** un snapshot con el jugador en (3.824, 2.144) en el mundo de 3.840 × 2.160 y ningún enemigo vivo
- **WHEN** el bot de referencia calcula el input
- **THEN** el input apunta en la diagonal hacia −x y −y (componentes negativas y del mismo módulo)

#### Scenario: Repulsión de un tronco, del agua y del castillo
- **GIVEN** un mapa de hierba con un tronco en (10, 4) (x en [600, 660], y en [240, 300]), un snapshot con el jugador
  en (560, 270) (a 40 px del tronco) y ningún enemigo vivo; y en otros casos la misma celda de `water` o de `castle`
- **WHEN** el bot de referencia calcula el input
- **THEN** en los tres casos el input es (−1, 0)

#### Scenario: Celda a exactamente 64 px
- **GIVEN** el mapa del escenario anterior con el tronco y un snapshot con el jugador en (536, 270) y ningún enemigo
  vivo
- **WHEN** el bot de referencia calcula el input
- **THEN** el input es (0, 0)

#### Scenario: Puente sin repulsión
- **GIVEN** un mapa de hierba con la celda (10, 4) de `bridge` y un snapshot con el jugador en (560, 270) y ningún
  enemigo vivo
- **WHEN** el bot de referencia calcula el input
- **THEN** el input es (0, 0)

#### Scenario: Dirección bloqueada por un tronco
- **GIVEN** el mapa con el tronco en (10, 4), velocidad 200 px/s y un snapshot con el jugador en (584, 270), tangente
  a la cara izquierda del tronco, y un único enemigo vivo en (574, 270) (repulsión 1/100 hacia +x frente a 1/256 del
  tronco hacia −x)
- **WHEN** el bot de referencia calcula el input
- **THEN** la dirección cuantizada (1, 0) está bloqueada, también la girada +45° y −45°, y el input es (0, 1) (+90°)

#### Scenario: Dirección bloqueada por el castillo
- **GIVEN** un mapa de hierba con las celdas de columnas 30–34 y filas 15–18 `castle`, velocidad 200 px/s y un
  snapshot con el jugador en (1.950, 1.156), tangente a la fachada, y un único enemigo vivo en (1.950, 1.166)
  (repulsión 1/100 hacia −y frente a 1/256 de la celda (32, 18) hacia +y)
- **WHEN** el bot de referencia calcula el input
- **THEN** la dirección cuantizada (0, −1) está bloqueada, también la girada +45° y −45°, y el input es (1, 0)
  (+90° en sentido horario desde (0, −1))

#### Scenario: Bot reproducible
- **GIVEN** dos partidas con el contenido por defecto y la semilla 7, con su mapa generado, ambas jugadas por el bot
  de referencia
- **WHEN** ambas se ejecutan hasta que terminan o hasta el tick 36.000
- **THEN** ambas terminan con el mismo resultado, en el mismo tick, con las mismas bajas y la misma lista de
  mejoras adquiridas con sus niveles

### Requirement: Semillas de los tests de balance
Los tests de balance SHALL usar como conjunto fijo de semillas los enteros **1..50** (ambos incluidos) y medir sobre
el conjunto completo. Ningún test (unitario ni E2E) MUST afirmar que una semilla concreta gana o pierde salvo cuando
esa semilla pertenece al conjunto y la afirmación se deduce de un requisito que vale para todo el conjunto (por
ejemplo, "Jugador quieto pierde"). Los tests MUST NOT fijar la semilla 2 como semilla ganadora ni la semilla 90 como
semilla de derrota rápida. Los tests de balance MUST medir con el mismo contenido que carga el juego desde
`content/*.json`, incluidos el tamaño del mundo, el tope de vista, el radio del anillo de aparición y los parámetros
del mapa: si usan una copia en código, la copia MUST ser igual campo a campo al JSON validado. Los tests de balance de
esta spec MUST ejecutarse dentro de la suite unitaria de `npm run verify`.

#### Scenario: Sin semillas sueltas de balance
- **GIVEN** el directorio `tests/` tras el change
- **WHEN** se busca en los tests de balance una constante de semilla ganadora (`WIN_SEED`) o una aserción de
  victoria o derrota sobre la semilla 2 o la 90
- **THEN** no hay ninguna coincidencia

#### Scenario: Contenido de los tests igual al del juego
- **GIVEN** el contenido de oleadas (con `ringRadius`), enemigos, armas, mejoras, progresión, jugador, arena (mundo y
  tope de vista) y mapa cargado y validado desde `content/*.json` y la configuración por defecto que usan los tests de
  balance
- **WHEN** se comparan campo a campo, sin tener en cuenta el orden de las claves
- **THEN** son iguales

#### Scenario: Derrota E2E con una semilla del conjunto
- **GIVEN** la build de producción servida con `?e2e&map=empty&seed=42` (42 pertenece a 1..50) y sin input de
  movimiento
- **WHEN** la partida avanza con la política de elección fija
- **THEN** termina con resultado derrota con como mucho 180 s de juego (10.800 ticks)

### Requirement: Una sola fuente del tamaño del mundo en los tests
Los tests unitarios, los E2E, los helpers de `tests/support/` y los benchmarks SHALL obtener el tamaño del mundo, el
tope de vista, el radio del anillo de aparición y los parámetros del mapa de `content/*.json` (o del contenido ya
validado), sin escribirlos por su cuenta. Un test que necesite otro tamaño u otro mapa para un caso concreto MUST
declararlo en el propio escenario como arena o mapa explícitos. Los E2E que necesitan un tamaño de ventana lo toman de
la configuración de Playwright (1.280 × 720) o lo declaran en el escenario.

#### Scenario: Sin arena por defecto duplicada
- **GIVEN** el directorio `tests/` tras el change
- **WHEN** se busca `DEFAULT_ARENA`
- **THEN** no hay ninguna coincidencia

#### Scenario: Sin radio del anillo derivado de la vista
- **GIVEN** el directorio `tests/` tras el change
- **WHEN** se buscan los literales `582.7` y `582.727`
- **THEN** no hay ninguna coincidencia

#### Scenario: El bot huye de las paredes del mundo real
- **GIVEN** una partida creada con el contenido por defecto salvo una arena explícita de 4.000 × 4.000 y el mapa
  vacío, y un snapshot suyo con el jugador en (3.980, 2.000) y ningún enemigo vivo
- **WHEN** el bot de referencia calcula el input sin recibir ningún otro dato de tamaño
- **THEN** el input es (−1, 0) (la pared derecha está a 20 px), y con el jugador en (1.900, 2.000) es (0, 0)

<!-- historial: 0017-fullscreen-view (pendiente de archivar) -->
