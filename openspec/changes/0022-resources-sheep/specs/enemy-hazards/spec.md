# Spec delta · enemy-hazards

<!-- La madera del barril vive aquí porque la regla depende de si el barril explota o no (decisión del gate,
     2026-11-24: el barril que detona su propia mecha NO suelta madera). `enemy-behavior` no cambia: la mecha, su
     duración y sus transiciones son las de antes. Vocabulario de recogibles en `resources`. -->

## ADDED Requirements

### Requirement: Madera del barril abatido
El sistema SHALL crear, por cada `goblin-barrel` dado de baja en un tick **sin haber explotado** en ese tick, además
de su gema, exactamente un recogible `wood` con el valor de madera por barril del contenido (ver "Contenido de
recursos validado" en `resources`), en la misma posición que su gema (recolocación incluida, ver "Recolocación de gemas
en celdas no caminables" en `xp-gems`) y creado justo después de ella. Un barril queda dado de baja sin explotar cuando
su vida llega a 0:
- en el paso de armas, por proyectiles o pulsos, esté en persecución o en mecha, también en el tick en que su mecha
  terminaría (las armas actúan antes que la mecha: no explota);
- en el paso de peligros, por la explosión de otro barril o de una dinamita, si su propia mecha no termina en ese
  tick.

Un barril que **explota** (su mecha termina en ese tick y está vivo al empezar el paso de peligros) MUST NOT soltar
madera, aunque en ese mismo tick otra explosión le deje a vida 0: solo suelta su gema. Soltar o no madera MUST NOT
cambiar la baja, su gema, el contador de bajas, la explosión ni el daño de nadie, y MUST NOT consumir azar. Ningún
otro tipo de enemigo suelta madera.

#### Scenario: Barril abatido por armas
- **GIVEN** madera por barril 2, un jugador quieto lejos y un `goblin-barrel` en persecución con vida 4 que muere por
  un impacto del Linter en el tick n en (780, 270), en una partida con 5 bajas
- **WHEN** se ejecuta el tick n
- **THEN** hay 1 gema nueva de valor 2 y 1 recogible `wood` nuevo de valor 2, ambos en (780, 270), con la gema creada
  antes, y las bajas valen 6

#### Scenario: Barril que detona su mecha
- **GIVEN** el barril de "Mecha y explosión con el jugador quieto" (`enemy-behavior`), que explota en el tick 82
- **WHEN** se ejecuta el tick 82
- **THEN** hay exactamente 1 gema nueva de ese barril y ningún recogible `wood` nuevo

#### Scenario: Barril en mecha abatido por armas en el tick de su explosión
- **GIVEN** un `goblin-barrel` con vida 4 cuya mecha termina en el tick n y que recibe un impacto mortal del Linter en
  el tick n
- **WHEN** se ejecuta el tick n
- **THEN** no hay explosión y hay 1 gema y 1 recogible `wood` nuevos de ese barril

#### Scenario: Barril en mecha abatido por una explosión ajena
- **GIVEN** un barril de vida 20 en mecha que explotaría en el tick n + 10, dentro del radio de una dinamita de daño 25
  que explota en el tick n
- **WHEN** se ejecuta el tick n
- **THEN** queda dado de baja sin explotar, con 1 gema y 1 recogible `wood` nuevos

#### Scenario: Barril que explota y recibe daño mortal en el mismo tick
- **GIVEN** dos barriles de vida 20 en mecha cuya mecha termina en el tick n, cada uno dentro del radio de explosión
  del otro, con daño de explosión 25
- **WHEN** se ejecuta el tick n
- **THEN** hay 2 explosiones, 2 gemas nuevas y ningún recogible `wood` nuevo

#### Scenario: Otros tipos no sueltan madera
- **GIVEN** un `goblin-torch`, un `goblin-tnt` y un `goblin-tnt-guard` que mueren por armas en el tick n y otro
  `goblin-torch` que muere por una explosión en ese tick
- **WHEN** se ejecuta el tick n
- **THEN** hay 4 gemas nuevas y ningún recogible `wood` nuevo

#### Scenario: La madera no consume azar
- **GIVEN** dos partidas con la semilla 7 y el mismo estado salvo que en una el `goblin-barrel` que muere en el tick n
  lo hace por armas (suelta madera) y en la otra explota por su mecha
- **WHEN** ambas ejecutan el tick n sin oferta de mejora ni aparición
- **THEN** el estado del `RandomGenerator` de la partida es el mismo en las dos tras el tick
