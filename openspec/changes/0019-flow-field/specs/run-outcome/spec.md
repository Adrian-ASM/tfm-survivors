# Spec delta · run-outcome

<!-- Change 0019-flow-field. La navegación por el mapa (línea libre + campo 4-vecino + recolocación de apariciones)
     dejó el balance en 18/50 en el prototipo. Gate humano (2026-11-24): la banda y las reglas no se relajan; no se
     tocan el presupuesto de oleadas ni `player.speed`; si ninguna otra palanca de contenido devuelve la banda, el
     apply se detiene y vuelve al usuario. "Bot de referencia para el balance" y "Semillas de los tests de balance" no
     cambian: el bot v2 sigue siendo la única referencia y no se modifica en este change. -->

## MODIFIED Requirements

### Requirement: Partida ganable y perdible con el contenido por defecto
El sistema SHALL permitir, con el contenido por defecto, tanto ganar como perder una partida sin motor, con una
dificultad medida sobre el conjunto de semillas 1..50 (ver "Semillas de los tests de balance"), cada partida con el
mapa que genera su semilla, castillo incluido, el jugador en su punto de salida (ver `procedural-map` y "Posición
inicial en el punto de salida del mapa" en `player-movement`) y los enemigos navegando por ese mapa (ver
`enemy-behavior`), con el tope de vivos por defecto (ver `enemy-spawning`):
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
  `budgetPerSecond` y `maxBudget`) ni `player.speed` (215); `maxAlive` es 300 (ver `enemy-spawning`) y el anillo de
  aparición no cambia;
- la calibración MUST hacerse con otras palancas de contenido (valores de los tipos de enemigo, de las armas, de las
  mejoras o de la progresión de XP), validadas por sus esquemas;
- todo valor de contenido que una spec viva fije de forma explícita y que la calibración cambie MUST actualizarse en
  una spec delta de este change antes de verify;
- los plazos de las specs vivas para el jugador quieto con el contenido por defecto (primer golpe, primer pulso y
  primera oferta en ≤ 4.800 ticks; primera baja en ≤ 900) MUST seguir cumpliéndose con el contenido final, y los ticks
  medidos MUST anotarse en el design o en el verify-report.

La banda y las reglas mandan sobre cualquier valor concreto y MUST NOT relajarse en este change: si ninguna
combinación de esas palancas devuelve a la vez la banda 25–35 y 0 quietos supervivientes (con ambos mapas), el change
MUST detenerse antes de verify y la decisión vuelve al usuario. Si el mundo, el anillo, la huella del castillo, la
navegación o el contenido cambian en apply, el balance MUST volver a medirse con el contenido final antes de verify.

#### Scenario: Tasa de victoria del bot de referencia
- **GIVEN** el contenido por defecto (mundo de 3.840 × 2.160, `ringRadius` 1.500, `maxAlive` 300), la navegación de
  los enemigos por el mapa y el bot de referencia
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

#### Scenario: Presupuesto de oleadas intacto
- **GIVEN** el contenido por defecto tras el change y el de `main` antes del change
- **WHEN** se comparan `content/waves.json` y `player.speed`
- **THEN** los tramos (`fromSecond`, `types`, `budgetPerSecond`), `maxBudget`, `ringRadius` y `player.speed` son
  iguales; solo `maxAlive` pasa de 200 a 300

#### Scenario: Plazos del jugador quieto con el contenido final
- **GIVEN** el contenido por defecto final, input (0, 0), la política de elección fija y la semilla 7 con su mapa
  generado
- **WHEN** se ejecutan hasta 4.800 ticks
- **THEN** el jugador recibe su primer golpe, se emite el primer pulso de Tests y se abre la primera oferta, cada uno en
  un tick ≤ 4.800, y la primera baja ocurre en un tick ≤ 900

<!-- historial: 0019-flow-field (pendiente de archivar) -->
