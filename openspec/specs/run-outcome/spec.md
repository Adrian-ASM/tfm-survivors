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
dificultad medida sobre el conjunto de semillas 1..50 (ver "Semillas de los tests de balance"), cada partida con el
mapa que genera su semilla, castillo y puerta de la tienda, casas, torres, guardias, recursos y ovejas incluidos, el
jugador en su punto de salida (ver `procedural-map` y "Posición inicial en el punto de salida del mapa" en
`player-movement`), los enemigos navegando por ese mapa y con su comportamiento por tipo (ver `enemy-behavior`) y sus
peligros (ver `enemy-hazards`), con el tope de vivos por defecto (ver `enemy-spawning`):
- **Ganable**: el bot de referencia v4 (ver "Bot de referencia para el balance") MUST llegar vivo al tick 36.000
  (resultado victoria) con **al menos 25 y como mucho 35** de las 50 semillas (del 50 % al 70 %, ambos incluidos).
  Una semilla cuenta como victoria solo si la partida termina con resultado victoria en el tick 36.000; cualquier
  otra, como derrota.
- **Perdible**: con input (0, 0) en todos los ticks, la política de elección fija y la política de tienda fija (ver
  `simulation-loop`), la partida MUST terminar con resultado derrota en un tick < 10.800 (antes de 180 s) con **cada
  una** de las 50 semillas, tanto con el mapa generado como con el mapa vacío. Un jugador quieto MUST NOT ganar con
  ninguna semilla del conjunto (0 quietos supervivientes).

La dificultad MUST ser la misma con cualquier tamaño de ventana: los tests de balance no reciben ventana ni vista.
Los números de contenido que producen esta dificultad viven en `content/*.json` y no se fijan en esta spec. En este
change (0024):
- MUST NOT cambiar el presupuesto de oleadas de `content/waves.json` (tramos, `fromSecond`, `types`,
  `budgetPerSecond` y `maxBudget`), `maxAlive`, el anillo de aparición, `player.speed`, los stats, comportamientos y
  peligros de los tipos de enemigo, las armas base (`content/weapons.json`), la progresión de XP (`baseXp` 9,
  `xpGrowth` 4), las estructuras salvo su oro, las vetas, los montones ni los parámetros de las ovejas y la carne;
- MUST NOT cambiar las 6 mejoras de arma ni `guardrail`, `shortcuts` y `context-window` salvo `name` y `description`
  (ver "Mejoras de arma y de personaje sin cambios" en `upgrades`);
- la calibración MUST hacerse solo con: los precios por nivel de las mejoras de arma, el precio y la porción de la
  curación de pago, el radio de interacción y la distancia de re-armado, el oro por baja de cada tipo, el oro por casa
  y por torre (por encima de 5 y de 8), el tope de oro en el suelo, el `perLevel` y el `maxLevel` de las 6 mejoras de
  personaje nuevas, el intervalo de regeneración, la curación por subida sin mejoras y los parámetros del bot v4
  (lista de prioridad de personaje, orden de compra de arma, umbral de vida y radio de peligro);
- todo valor de contenido que una spec viva o una spec delta de este change fije de forma explícita y que la
  calibración cambie MUST actualizarse en una spec delta de este change antes de verify;
- los plazos de las specs vivas para el jugador quieto con el contenido por defecto (primer golpe, primer pulso y
  primera oferta en ≤ 4.800 ticks; primera baja en ≤ 900) MUST seguir cumpliéndose con el contenido final, y los ticks
  medidos (incluida la primera oferta de la semilla 7) MUST anotarse en el design o en el verify-report;
- el tiempo del lote del bot (50 partidas de hasta 36.000 ticks) MUST anotarse en el verify-report, en local y
  multiplicado por 2,8 como equivalente de CI (solo anotado, sin objetivo); el lote MUST caber en el tiempo máximo
  del lote en los tests (180 s), que no se sube; si el CI real lo desmiente, se optimiza en otro change.

La banda y las reglas mandan sobre cualquier valor concreto y MUST NOT relajarse en este change: si ninguna
combinación de esas palancas devuelve a la vez la banda 25–35 y 0 quietos supervivientes (con ambos mapas), el change
MUST detenerse antes de verify y la decisión vuelve al usuario. Si el contenido cambia en apply, el balance MUST
volver a medirse con el contenido final antes de verify.

#### Scenario: Tasa de victoria del bot de referencia
- **GIVEN** el contenido por defecto, cada mapa generado con sus estructuras, recursos, ovejas y puerta, y el bot de
  referencia v4
- **WHEN** se juega una partida con cada semilla de 1 a 50, cada una hasta que termina o hasta el tick 36.000
- **THEN** el número de partidas terminadas con resultado victoria en el tick 36.000 es ≥ 25 y ≤ 35

#### Scenario: Toda partida del bot termina
- **GIVEN** el contenido por defecto y el bot de referencia v3
- **WHEN** se juega cada semilla de 1 a 50, con su mapa generado, hasta el tick 36.000
- **THEN** las 50 partidas están terminadas, con resultado victoria o derrota, en un tick ≤ 36.000

#### Scenario: Jugador quieto pierde con todas las semillas
- **GIVEN** el contenido por defecto, input (0, 0) en todos los ticks y la política de elección fija
- **WHEN** se juega una partida con cada semilla de 1 a 50, con su mapa generado (estructuras y guardias incluidos) y
  el jugador quieto en (1.950, 1.170), cada una hasta que termina o hasta el tick 10.800
- **THEN** las 50 partidas están terminadas con resultado derrota, cada una en un tick < 10.800

#### Scenario: Jugador quieto pierde también con el mapa vacío
- **GIVEN** el contenido por defecto, el mapa vacío (jugador en (1.920, 1.080), sin estructuras), input (0, 0) en
  todos los ticks y la política de elección fija
- **WHEN** se juega una partida con cada semilla de 1 a 50, cada una hasta que termina o hasta el tick 10.800
- **THEN** las 50 partidas están terminadas con resultado derrota, cada una en un tick < 10.800

#### Scenario: Muerte quieta en el límite de 180 s
- **GIVEN** el contenido por defecto, input (0, 0), la política de elección fija y una semilla de 1..50 cuya partida
  sigue en curso o eligiendo mejora en el tick 10.799
- **WHEN** se evalúa el requisito "Perdible" para esa semilla
- **THEN** el test de "quieto pierde" falla, aunque la partida termine con derrota en el tick 10.800 o después

#### Scenario: Presupuesto de oleadas y stats intactos
- **GIVEN** el contenido por defecto tras el change y el de `main` antes del change
- **WHEN** se comparan `content/waves.json`, `player.speed`, la progresión de XP, `content/weapons.json`, los stats,
  comportamientos y peligros de los tipos de enemigo, las estructuras sin su oro, las vetas, los montones, las ovejas y
  la carne
- **THEN** son iguales campo a campo
- **AND** las 9 mejoras que existían antes del change son iguales salvo `name`, `description`, el catálogo y los
  precios

#### Scenario: Plazos del jugador quieto con el contenido final
- **GIVEN** el contenido por defecto final, input (0, 0), la política de elección fija y la semilla 7 con su mapa
  generado
- **WHEN** se ejecutan hasta 4.800 ticks
- **THEN** el jugador recibe su primer golpe, se emite el primer pulso de Tests y se abre la primera oferta, cada uno en
  un tick ≤ 4.800, y la primera baja ocurre en un tick ≤ 900

### Requirement: Bot de referencia para el balance
El proyecto SHALL tener un **bot de referencia** (versión **v4**) versionado como helper de test (`tests/support/`),
puro y determinista, que es la única referencia de dificultad de los tests de balance. Sus parámetros (lista de
prioridad de personaje, orden de compra de arma, umbral de vida como fracción de la vida máxima y radio de peligro) son
constantes del bot, fijadas en `tests/support/` y anotadas en el design. El bot MUST jugar así:
- **Esquiva**: igual que en v3. En cada tick, a partir del snapshot anterior, un aviso (ver "Aviso en el suelo" en
  `enemy-hazards`) es **amenazante** si la distancia entre su centro y el centro del jugador es estrictamente menor
  que radio del aviso + radio del jugador + s, con s = velocidad efectiva del jugador × 1/60 (un tick de movimiento).
  Si hay ≥ 1 aviso amenazante, el bot suma, por cada uno, el vector unitario que va del centro del aviso al centro del
  jugador; cuantiza la suma a una de las 8 direcciones y aplica la regla de direcciones bloqueadas del paso 3 de
  **Movimiento**. Si la suma es el vector nulo (o el jugador está exactamente en el centro de todos los avisos
  amenazantes), usa el input de **Movimiento**. Sin avisos amenazantes, el input es el de **Movimiento**.
- **Movimiento**: si el bot **quiere comprar** (ver **Ir a la tienda**), la tienda está armada y no hay ningún enemigo
  vivo a menos del radio de peligro, el input es el de **Ir a la tienda**; si no, es el de la política de huida
  `fleeInput` de v3, aplicada al snapshot anterior y al mapa de la partida:
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
- **Ir a la tienda**: el bot quiere comprar si su oro es ≥ el precio de algún producto que compraría (una mejora de
  arma por debajo de su `maxLevel` o, con la vida por debajo del umbral, la curación). Para ir, sigue el campo de
  distancias hacia la celda de la puerta (ver "Campo de distancias hacia una celda" en `procedural-map`): con línea
  libre, en recta hacia la puerta; si no, hacia el centro del vecino con distancia − 1; cuantiza a una de las 8
  direcciones y aplica la regla de direcciones bloqueadas.
- **Compra**: cada vez que se abre la tienda, antes del siguiente tick, repite hasta que no pueda comprar nada: si la
  vida está por debajo del umbral y le alcanza el oro, compra la curación; si no, compra la primera mejora de arma de
  su orden de compra que no esté en su `maxLevel` y cuyo precio le alcance. Después sale de la tienda.
- **Elección**: cada vez que se abre una oferta, antes del siguiente tick, elige la opción cuyo id aparece antes en
  su lista de prioridad de personaje, sea cual sea su posición en la oferta; si la oferta no contiene ninguno de esos
  ids, elige la opción de índice 0.

El bot solo lee el snapshot y el mapa: no conoce el tick de explosión ni el daño de los avisos más allá de lo que
expone el snapshot, ni las dinamitas que aún no se han lanzado; los precios, los niveles, el estado de la puerta y su
posición los lee de los productos y de la tienda del snapshot. El bot no recibe la vista ni la ventana. El bot de
referencia es un concepto aparte de las políticas de elección y de tienda fijas de `simulation-loop`, que siguen
valiendo para los escenarios que no dicen nada. Cualquier cambio de su esquiva, de su movimiento, de sus compras o de
sus parámetros MUST hacerse con un change que revise los requisitos de balance de esta spec. Los escenarios de este
requisito con posiciones explícitas y sin mapa declarado usan el mapa vacío (sin puerta, así que el bot nunca quiere ir
a la tienda), el jugador con radio 16 y velocidad efectiva 215 (s = 3,5833).

#### Scenario: Ningún id priorizado en la oferta
- **GIVEN** una oferta abierta de 3 opciones, ninguna en la lista de prioridad de personaje del bot
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

#### Scenario: Elige por prioridad de personaje, no por posición
- **GIVEN** la lista de prioridad de personaje del bot y una oferta cuyas opciones son, en este orden, dos ids fuera
  de la lista y el id de mayor prioridad de la lista
- **WHEN** el bot de referencia elige
- **THEN** elige el índice 2

#### Scenario: Va a la tienda con oro y sin peligro
- **GIVEN** el mapa vacío con puerta declarada en (1.000, 1.000) y la tienda armada, un snapshot con el jugador en
  (1.400, 1.000), ningún enemigo ni aviso y oro igual al precio de la mejora de arma más barata
- **WHEN** el bot de referencia calcula el input
- **THEN** el input es (−1, 0)

#### Scenario: Sin oro suficiente no va
- **GIVEN** el escenario anterior con oro igual a ese precio − 1 y la vida llena
- **WHEN** el bot de referencia calcula el input
- **THEN** el input es (0, 0)

#### Scenario: El peligro gana a la tienda
- **GIVEN** el escenario "Va a la tienda con oro y sin peligro" con un enemigo vivo en (1.300, 1.000), a 100 px y
  dentro del radio de peligro y de los 150 px de la huida
- **WHEN** el bot de referencia calcula el input
- **THEN** el input es (1, 0) (huye)

#### Scenario: Orden de compra
- **GIVEN** una tienda abierta con la vida por debajo del umbral del bot, oro para la curación y para la primera
  mejora de su orden de compra, pero no para las dos
- **WHEN** el bot compra
- **THEN** compra solo la curación y sale de la tienda
- **AND** con la vida por encima del umbral compra solo esa mejora de arma y sale

#### Scenario: Compra hasta agotar el oro
- **GIVEN** una tienda abierta con la vida llena y oro para exactamente 3 compras sucesivas de su orden de compra
- **WHEN** el bot compra
- **THEN** hace 3 compras, sale de la tienda y el oro restante es menor que el precio de cualquier mejora de arma no
  agotada

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

### Requirement: Barril que cumple su papel
El sistema SHALL hacer que, con el contenido por defecto final, el `goblin-barrel` llegue a encender la mecha más a
menudo que antes del change: jugando con el bot de referencia cada semilla de 1 a 50 con su mapa generado hasta que
termina o hasta el tick 36.000, la media de barriles que entran en un estado de mecha por partida MUST ser > 16,3 (la
línea base medida antes del change con el mismo bot). La media de mechas y la de explosiones de barril por partida
MUST anotarse en el verify-report.

#### Scenario: Mechas por partida
- **GIVEN** el contenido por defecto final y el bot de referencia
- **WHEN** se juega cada semilla de 1 a 50, con su mapa generado, hasta que termina o hasta el tick 36.000, y se
  cuenta en cada una cuántos `goblin-barrel` entran en un estado de mecha
- **THEN** la suma de las 50 cuentas dividida entre 50 es > 16,3

<!-- historial: 0006-run-lifecycle-hud (2026-11-20) -->
<!-- historial: 0010-balance-pass (2026-11-20) -->
<!-- historial: 0012-sprite-rendering (2026-11-22) -->
<!-- historial: 0013-world-camera (2026-11-23) -->
<!-- historial: 0015-procedural-map (2026-11-23) -->
<!-- historial: 0016-map-art (2026-11-23) -->
<!-- historial: 0017-fullscreen-view (2026-11-24) -->
<!-- historial: 0019-flow-field (2026-11-24) -->
<!-- historial: 0020-enemy-behaviors (2026-11-24) -->
<!-- historial: 0021-goblin-camps (2026-11-24) -->
<!-- historial: 0024-split-progression-castle (2026-11-25) -->
