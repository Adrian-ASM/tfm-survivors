# Spec delta · run-outcome

<!-- Change 0020-enemy-behaviors. Las bajas por explosión cuentan (D1); el balance se recalibra con el bot de
     referencia v3, que esquiva los avisos; palancas permitidas: parámetros de comportamiento y de peligros y, solo si
     no basta, la curva de XP. Oleadas, `player.speed`, `maxAlive` y anillo intactos. -->

## ADDED Requirements

<!-- Ninguno. -->

## MODIFIED Requirements

### Requirement: Contador de bajas
El sistema SHALL contar las bajas de la partida: cada enemigo que queda dado de baja (su vida llega a 0 por armas o
por explosiones, o explota al terminar su mecha, ver `enemy-spawning`) suma exactamente 1. Una partida recién creada
MUST empezar con 0 bajas. El contador no se reinicia al subir de nivel ni al elegir mejora, no baja nunca y no cambia
mientras la partida está eligiendo mejora o terminada. Aplicar daño a un enemigo ya dado de baja MUST NOT sumar otra
baja. Las bajas producidas en el paso de armas y en el paso de peligros del tick en que la partida termina (por
derrota o por victoria) sí cuentan. El snapshot MUST exponer las bajas.

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

#### Scenario: Explosión letal para el jugador y para el barril
- **GIVEN** una partida con 3 bajas, el jugador a vida 20, no invulnerable, y un `goblin-barrel` cuya explosión de
  daño ≥ 20 le alcanza en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** el snapshot del tick n tiene resultado derrota, vida 0, 4 bajas y la gema del barril

#### Scenario: Una explosión que mata a varios
- **GIVEN** una partida con 0 bajas y una explosión en el tick n que deja a vida 0 a 3 enemigos, además del barril que
  explota
- **WHEN** se ejecuta el tick n
- **THEN** las bajas valen 4

### Requirement: Partida ganable y perdible con el contenido por defecto
El sistema SHALL permitir, con el contenido por defecto, tanto ganar como perder una partida sin motor, con una
dificultad medida sobre el conjunto de semillas 1..50 (ver "Semillas de los tests de balance"), cada partida con el
mapa que genera su semilla, castillo incluido, el jugador en su punto de salida (ver `procedural-map` y "Posición
inicial en el punto de salida del mapa" en `player-movement`), los enemigos navegando por ese mapa y con su
comportamiento por tipo (ver `enemy-behavior`) y sus peligros (ver `enemy-hazards`), con el tope de vivos por defecto
(ver `enemy-spawning`):
- **Ganable**: el bot de referencia (ver "Bot de referencia para el balance") MUST llegar vivo al tick 36.000
  (resultado victoria) con **al menos 25 y como mucho 35** de las 50 semillas (del 50 % al 70 %, ambos incluidos).
  Una semilla cuenta como victoria solo si la partida termina con resultado victoria en el tick 36.000; cualquier
  otra, como derrota.
- **Perdible**: con input (0, 0) en todos los ticks y la política de elección fija (ver `simulation-loop`), la
  partida MUST terminar con resultado derrota en un tick < 10.800 (antes de 180 s) con **cada una** de las 50
  semillas, tanto con el mapa generado como con el mapa vacío. Un jugador quieto MUST NOT ganar con ninguna semilla
  del conjunto (0 quietos supervivientes).

La dificultad MUST ser la misma con cualquier tamaño de ventana: los tests de balance no reciben ventana ni vista.
Los números de contenido que producen esta dificultad viven en `content/*.json` y no se fijan en esta spec. En este
change:
- MUST NOT cambiar el presupuesto de oleadas de `content/waves.json` (tramos, `fromSecond`, `types`,
  `budgetPerSecond` y `maxBudget`), `maxAlive` (300), el anillo de aparición (`ringRadius` 1.500) ni `player.speed`
  (215), ni la velocidad, el radio, el coste, la vida, el daño por contacto ni la XP de los tipos de enemigo (ver
  "Stats por defecto" en `enemy-spawning`), ni las armas ni las mejoras;
- la calibración MUST hacerse primero con los parámetros de comportamiento y de peligros (distancias, duraciones,
  radios y daños de explosión, tope de dinamitas), dentro de las cotas de "Comportamiento por defecto legible y
  esquivable" (`enemy-behavior`), y, solo si eso no basta, también con la progresión de XP, validadas por sus
  esquemas;
- todo valor de contenido que una spec viva o una spec delta de este change fije de forma explícita y que la
  calibración cambie MUST actualizarse en una spec delta de este change antes de verify;
- los plazos de las specs vivas para el jugador quieto con el contenido por defecto (primer golpe, primer pulso y
  primera oferta en ≤ 4.800 ticks; primera baja en ≤ 900) MUST seguir cumpliéndose con el contenido final, y los ticks
  medidos (incluida la primera oferta de la semilla 7, 2.082 antes del change) MUST anotarse en el design o en el
  verify-report.

La banda y las reglas mandan sobre cualquier valor concreto y MUST NOT relajarse en este change: si ninguna
combinación de esas palancas devuelve a la vez la banda 25–35 y 0 quietos supervivientes (con ambos mapas), el change
MUST detenerse antes de verify y la decisión vuelve al usuario (también si hiciera falta tocar oleadas, `maxAlive`,
stats de los tipos, armas o mejoras). Si el mundo, el anillo, la huella del castillo, la navegación, los
comportamientos o el contenido cambian en apply, el balance MUST volver a medirse con el contenido final antes de
verify.

#### Scenario: Tasa de victoria del bot de referencia
- **GIVEN** el contenido por defecto (mundo de 3.840 × 2.160, `ringRadius` 1.500, `maxAlive` 300), la navegación y
  los comportamientos de los enemigos y el bot de referencia v3
- **WHEN** se juega una partida con cada semilla de 1 a 50, con su mapa generado (castillo incluido) y el jugador en
  su salida, cada una hasta que termina o hasta el tick 36.000
- **THEN** el número de partidas terminadas con resultado victoria en el tick 36.000 es ≥ 25 y ≤ 35

#### Scenario: Toda partida del bot termina
- **GIVEN** el contenido por defecto y el bot de referencia v3
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

#### Scenario: Presupuesto de oleadas y stats intactos
- **GIVEN** el contenido por defecto tras el change y el de `main` antes del change
- **WHEN** se comparan `content/waves.json`, `player.speed`, las armas, las mejoras y los stats de los tipos de enemigo
- **THEN** los tramos (`fromSecond`, `types`, `budgetPerSecond`), `maxBudget`, `maxAlive` (300), `ringRadius`,
  `player.speed`, las armas, las mejoras y la velocidad, el radio, el coste, la vida, la XP y el `damage` de
  `goblin-torch` y `goblin-tnt` son iguales; el único cambio de stats es que `goblin-barrel` ya no tiene `damage`

#### Scenario: Plazos del jugador quieto con el contenido final
- **GIVEN** el contenido por defecto final, input (0, 0), la política de elección fija y la semilla 7 con su mapa
  generado
- **WHEN** se ejecutan hasta 4.800 ticks
- **THEN** el jugador recibe su primer golpe, se emite el primer pulso de Tests y se abre la primera oferta, cada uno en
  un tick ≤ 4.800, y la primera baja ocurre en un tick ≤ 900

### Requirement: Bot de referencia para el balance
El proyecto SHALL tener un **bot de referencia** (versión **v3**) versionado como helper de test (`tests/support/`),
puro y determinista, que es la única referencia de dificultad de los tests de balance. El bot MUST jugar así:
- **Esquiva** (nuevo en v3): en cada tick, a partir del snapshot anterior, un aviso (ver "Aviso en el suelo" en
  `enemy-hazards`) es **amenazante** si la distancia entre su centro y el centro del jugador es estrictamente menor
  que radio del aviso + radio del jugador + s, con s = velocidad efectiva del jugador × 1/60 (un tick de movimiento).
  Si hay ≥ 1 aviso amenazante, el bot suma, por cada uno, el vector unitario que va del centro del aviso al centro del
  jugador; cuantiza la suma a una de las 8 direcciones y aplica la regla de direcciones bloqueadas del paso 3 de
  **Movimiento**. Si la suma es el vector nulo (o el jugador está exactamente en el centro de todos los avisos
  amenazantes), usa el input de **Movimiento**. Sin avisos amenazantes, el input es el de **Movimiento**.
- **Movimiento**: el input es el de la política de huida `fleeInput` aplicada al snapshot anterior y al mapa de la
  partida:
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

El bot solo lee el snapshot y el mapa: no conoce el tick de explosión ni el daño de los avisos más allá de lo que
expone el snapshot, ni las dinamitas que aún no se han lanzado. El castillo no añade lógica al bot: sus celdas
cuentan como cualquier otra celda no caminable. El bot no recibe la vista ni la ventana. El bot de referencia es un
concepto aparte de la "política de elección fija" de `simulation-loop`, que sigue valiendo para los escenarios que no
dicen nada de elecciones. Cualquier cambio de su esquiva, de su movimiento o de su lista de prioridad MUST hacerse con
un change que revise los requisitos de balance de esta spec. Los escenarios de este requisito con posiciones
explícitas y sin mapa declarado usan el mapa vacío, el jugador con radio 16 y velocidad efectiva 215 (s = 3,5833).

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

#### Scenario: La esquiva gana a la huida
- **GIVEN** un snapshot con el jugador en (1.920, 1.080), un aviso de radio 50 centrado en (1.960, 1.080) (a 40 px,
  < 50 + 16 + 3,5833) y un único enemigo vivo en (1.870, 1.080) (la huida empujaría hacia +x)
- **WHEN** el bot de referencia calcula el input
- **THEN** el input es (−1, 0)

#### Scenario: Aviso no amenazante
- **GIVEN** un snapshot con el jugador en (1.920, 1.080), ningún enemigo vivo y un aviso de radio 50 centrado en
  (1.989,5833; 1.080) (a exactamente 50 + 16 + 3,5833 px)
- **WHEN** el bot de referencia calcula el input
- **THEN** el input es (0, 0)

#### Scenario: Dos avisos que se anulan
- **GIVEN** un snapshot con el jugador en (1.920, 1.080), dos avisos de radio 50 centrados en (1.880, 1.080) y
  (1.960, 1.080) y un único enemigo vivo en (1.920, 1.180) (a 100 px por debajo)
- **WHEN** el bot de referencia calcula el input
- **THEN** la suma de la esquiva es nula y el input es el de la huida, (0, −1)

#### Scenario: Esquiva bloqueada por un tronco
- **GIVEN** el mapa con el tronco en (10, 4), velocidad 200 px/s, un snapshot con el jugador en (584, 270), tangente
  a la cara izquierda del tronco, y un aviso de radio 50 centrado en (560, 270)
- **WHEN** el bot de referencia calcula el input
- **THEN** la dirección de esquiva (1, 0) está bloqueada, también la girada +45° y −45°, y el input es (0, 1)

#### Scenario: Bot reproducible
- **GIVEN** dos partidas con el contenido por defecto y la semilla 7, con su mapa generado, ambas jugadas por el bot
  de referencia
- **WHEN** ambas se ejecutan hasta que terminan o hasta el tick 36.000
- **THEN** ambas terminan con el mismo resultado, en el mismo tick, con las mismas bajas y la misma lista de
  mejoras adquiridas con sus niveles

## REMOVED Requirements

<!-- Ninguno. -->
