# Spec delta · run-outcome

<!-- Change 0021-goblin-camps. Balance con casas, torres y guardias y palancas nuevas (A3: vida del `goblin-barrel`,
     solo de ese tipo). La distancia de lanzamiento del `goblin-tnt` (100) y la curva de XP 9/4 no se tocan (A1; su
     revisión va a balance-pass-2). El bot de referencia sigue en v3: solo pasa a v4 ("flee-nearest") si la medición
     con los guardias lo exige (A2); en ese caso este delta MUST añadir, antes de verify, el MODIFIED de "Bot de
     referencia para el balance" con la regla v4 de la propuesta y sus escenarios, y "Tasa de victoria del bot de
     referencia" pasará a citar v4. -->

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Partida ganable y perdible con el contenido por defecto
El sistema SHALL permitir, con el contenido por defecto, tanto ganar como perder una partida sin motor, con una
dificultad medida sobre el conjunto de semillas 1..50 (ver "Semillas de los tests de balance"), cada partida con el
mapa que genera su semilla, castillo, casas, torres y guardias incluidos, el jugador en su punto de salida (ver
`procedural-map` y "Posición inicial en el punto de salida del mapa" en `player-movement`), los enemigos navegando por
ese mapa y con su comportamiento por tipo (ver `enemy-behavior`) y sus peligros (ver `enemy-hazards`), con el tope de
vivos por defecto (ver `enemy-spawning`):
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
  (215), ni la velocidad, el radio, el coste, la vida, el daño por contacto ni la XP de `goblin-torch` y
  `goblin-tnt`, ni la velocidad, el radio, el coste, la XP ni la ausencia de daño por contacto de `goblin-barrel`
  (ver "Stats por defecto" en `enemy-spawning`), ni la distancia de lanzamiento del `goblin-tnt` ni la progresión de
  XP (`baseXp` 9, `xpGrowth` 4), ni las armas ni las mejoras. Los stats del `goblin-tnt-guard` son los del
  `goblin-tnt`;
- la calibración MUST hacerse con los parámetros de comportamiento y de peligros (distancias, duraciones, radios y
  daños de explosión, tope de dinamitas), salvo la distancia de lanzamiento del `goblin-tnt`; empezando por los del
  `goblin-barrel` (distancia de activación, duración de la mecha, radio y daño de su explosión); con la vida del
  `goblin-barrel`, que es el único stat de tipo autorizado (decisión A3); y con los parámetros de las estructuras y de los guardias (número por mapa, distancias de colocación,
  vida, tope e intervalo de nacimiento, radios de patrulla, detección y abandono, y parámetros de su carga y su
  espera), todo dentro de las cotas de "Comportamiento por defecto legible y esquivable" (`enemy-behavior`) y validado
  por sus esquemas. La candidata aprobada del barril es activación 60, vida 25 y radio de explosión 80, y se
  recalibra con las casas y los guardias presentes;
- todo valor de contenido que una spec viva o una spec delta de este change fije de forma explícita y que la
  calibración cambie MUST actualizarse en una spec delta de este change antes de verify;
- los plazos de las specs vivas para el jugador quieto con el contenido por defecto (primer golpe, primer pulso y
  primera oferta en ≤ 4.800 ticks; primera baja en ≤ 900) MUST seguir cumpliéndose con el contenido final, y los ticks
  medidos (incluida la primera oferta de la semilla 7, 2.082 antes del change) MUST anotarse en el design o en el
  verify-report;
- el tiempo del lote del bot (50 partidas de hasta 36.000 ticks) MUST anotarse en el verify-report, en local y
  multiplicado por 2,8 como equivalente de CI, con el objetivo de ≤ 90 s equivalentes; el tiempo máximo del lote en
  los tests no se sube salvo decisión registrada en el design.

La banda y las reglas mandan sobre cualquier valor concreto y MUST NOT relajarse en este change: si ninguna
combinación de esas palancas devuelve a la vez la banda 25–35 y 0 quietos supervivientes (con ambos mapas), el change
MUST detenerse antes de verify y la decisión vuelve al usuario (también si hiciera falta tocar oleadas, `maxAlive`,
otros stats de los tipos, la distancia de lanzamiento del `goblin-tnt`, la progresión de XP, armas o mejoras). Si el
mundo, el anillo, la huella del castillo, las estructuras, la navegación, los comportamientos o el contenido cambian
en apply, el balance MUST volver a medirse con el contenido final antes de verify.

#### Scenario: Tasa de victoria del bot de referencia
- **GIVEN** el contenido por defecto (mundo de 3.840 × 2.160, `ringRadius` 1.500, `maxAlive` 300), la navegación y
  los comportamientos de los enemigos, las casas, torres y guardias de cada mapa generado y el bot de referencia v3
- **WHEN** se juega una partida con cada semilla de 1 a 50, con su mapa generado (castillo y estructuras incluidos) y
  el jugador en su salida, cada una hasta que termina o hasta el tick 36.000
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
- **WHEN** se comparan `content/waves.json`, `player.speed`, la progresión de XP, las armas, las mejoras, los stats de
  los tipos de enemigo y la distancia de lanzamiento del `goblin-tnt`
- **THEN** los tramos (`fromSecond`, `types`, `budgetPerSecond`), `maxBudget`, `maxAlive` (300), `ringRadius`,
  `player.speed`, `baseXp` y `xpGrowth`, las armas, las mejoras, la distancia de lanzamiento del `goblin-tnt` y la
  velocidad, el radio, el coste, la vida, la XP y el `damage` de `goblin-torch` y `goblin-tnt` son iguales
- **AND** de `goblin-barrel` solo puede haber cambiado la vida (velocidad, radio, coste y XP iguales, y sigue sin
  `damage`)
- **AND** el único tipo nuevo es `goblin-tnt-guard`, con velocidad, radio, coste, vida, XP y `damage` iguales a los de
  `goblin-tnt`

#### Scenario: Plazos del jugador quieto con el contenido final
- **GIVEN** el contenido por defecto final, input (0, 0), la política de elección fija y la semilla 7 con su mapa
  generado
- **WHEN** se ejecutan hasta 4.800 ticks
- **THEN** el jugador recibe su primer golpe, se emite el primer pulso de Tests y se abre la primera oferta, cada uno en
  un tick ≤ 4.800, y la primera baja ocurre en un tick ≤ 900
