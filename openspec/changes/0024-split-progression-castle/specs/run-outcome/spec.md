# Spec delta · run-outcome

## MODIFIED Requirements

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
  multiplicado por 2,8 como equivalente de CI, con el objetivo de ≤ 90 s equivalentes (margen objetivo ≤ 81 s); el
  tiempo máximo del lote en los tests no se sube salvo decisión registrada en el design.

La banda y las reglas mandan sobre cualquier valor concreto y MUST NOT relajarse en este change: si ninguna
combinación de esas palancas devuelve a la vez la banda 25–35 y 0 quietos supervivientes (con ambos mapas), el change
MUST detenerse antes de verify y la decisión vuelve al usuario. Si el contenido cambia en apply, el balance MUST
volver a medirse con el contenido final antes de verify.

<!-- Escenarios vivos sin cambios: "Toda partida del bot termina" (con el bot v4), "Jugador quieto pierde con todas las
     semillas", "Jugador quieto pierde también con el mapa vacío", "Muerte quieta en el límite de 180 s" y "Plazos del
     jugador quieto con el contenido final" (todos con la política de tienda fija). -->

#### Scenario: Tasa de victoria del bot de referencia
- **GIVEN** el contenido por defecto, cada mapa generado con sus estructuras, recursos, ovejas y puerta, y el bot de
  referencia v4
- **WHEN** se juega una partida con cada semilla de 1 a 50, cada una hasta que termina o hasta el tick 36.000
- **THEN** el número de partidas terminadas con resultado victoria en el tick 36.000 es ≥ 25 y ≤ 35

#### Scenario: Presupuesto de oleadas y stats intactos
- **GIVEN** el contenido por defecto tras el change y el de `main` antes del change
- **WHEN** se comparan `content/waves.json`, `player.speed`, la progresión de XP, `content/weapons.json`, los stats,
  comportamientos y peligros de los tipos de enemigo, las estructuras sin su oro, las vetas, los montones, las ovejas y
  la carne
- **THEN** son iguales campo a campo
- **AND** las 9 mejoras que existían antes del change son iguales salvo `name`, `description`, el catálogo y los
  precios

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

<!-- Escenarios vivos sin cambios (con oro 0 o sin puerta): "Huida sin amenazas", "Salida ante la puerta con el mapa
     generado" (oro 0 en el tick 0), "Huida de un enemigo", "Enemigo fuera de rango", "Repulsión de la pared derecha
     del mundo", "El borde de la vista no es una pared", "Pared a exactamente 64 px", "Esquina del mundo", "Repulsión
     de un tronco, del agua y del castillo", "Celda a exactamente 64 px", "Puente sin repulsión", "Dirección bloqueada
     por un tronco", "Dirección bloqueada por el castillo", "La esquiva gana a la huida", "Aviso no amenazante", "Dos
     avisos que se anulan", "Esquiva bloqueada por un tronco" y "Bot reproducible" (con la lista de compras además de
     la de mejoras). Se retiran "Elige por prioridad, no por posición", "La prioridad más alta gana" y "Ningún id
     priorizado en la oferta" (usaban ids de arma, que ya no salen en la oferta); los sustituyen los de abajo. -->

#### Scenario: Elige por prioridad de personaje, no por posición
- **GIVEN** la lista de prioridad de personaje del bot y una oferta cuyas opciones son, en este orden, dos ids fuera
  de la lista y el id de mayor prioridad de la lista
- **WHEN** el bot de referencia elige
- **THEN** elige el índice 2

#### Scenario: Ningún id priorizado en la oferta
- **GIVEN** una oferta abierta de 3 opciones, ninguna en la lista de prioridad de personaje del bot
- **WHEN** el bot de referencia elige
- **THEN** elige el índice 0

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
