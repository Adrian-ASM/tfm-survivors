# Spec delta · sprite-rendering

## ADDED Requirements

### Requirement: Pintado de los solares y de los edificios
El sistema SHALL pintar, mientras existe una partida, cada solar de su snapshot (ver `build-sites`) fijo en el mundo,
con el origen y la escala que fije el design respecto a la huella (error ≤ 1 px):
- un solar `free`, con el aspecto **en obra** común a todos los solares libres, `House_Construction`;
- un solar `house`, con `House_Blue` sobre la huella de la casa, y un solar `tower`, con `Tower_Blue` sobre la huella de
  la torre, desde el primer frame que pinta un snapshot en el que figura construido y hasta el final de la partida, sin
  dejar visible su aspecto en obra.

Los dibujos se separan en parte baja y parte alta con la regla de "Pintado de las estructuras" y van en las capas de
"Capas del mapa y de las entidades". **Reserva**: si la hoja de un aspecto de solar falla al cargar o no contiene su
frame, los solares con ese aspecto, y solo ellos, se pintan como un rectángulo relleno sobre la huella que corresponda,
sin parte alta, con un color de los datos de aspecto para el solar en obra, otro para la casa y otro para la torre,
`#RRGGBB`, distintos entre sí y de los colores del mapa y de las estructuras; un color ausente, con otro formato o
repetido MUST hacer fallar el arranque con un error que nombre el campo. Los objetos de escena de los solares cuentan
como objetos del mapa en la sonda y se recortan con "Recorte del arte del mapa por cámara". Con el contenido por defecto
y las semillas 42 y 123, el total de objetos del mapa, solares incluidos, MUST ser ≤ 1.000 (test sin navegador del
plan de pintado). Con el mapa vacío no se pinta ningún solar; en modo menú no se ve ninguno; al empezar una partida
nueva no queda visible ninguno de la anterior. Pintar los solares MUST NOT cambiar la simulación.

La sonda de render (ver "Sonda de render para E2E") SHALL exponer `sprites.sites`: cuántos solares se pintan en obra,
como casa y como torre, y cuántos de ellos con reserva; 0 en modo menú. Los recuentos de celdas, de elementos del mapa,
de estructuras y de vetas no cambian por los solares.

#### Scenario: Solar en obra y casa construida
- **GIVEN** la semilla 42 con su mapa real y todas las hojas cargadas
- **WHEN** se pinta el frame del tick 0, se construye una casa en el primer solar y se pinta el frame siguiente
- **THEN** en el primero `sprites.sites` informa de 6 en obra, 0 casas y 0 torres, sin reserva
- **AND** en el segundo de 5 en obra y 1 casa, y el primer solar se pinta con `House_Blue` y no con su aspecto en obra

#### Scenario: Reserva de los edificios
- **GIVEN** un solar con una torre construida y la hoja `Tower_Blue` sin cargar
- **WHEN** se pinta el snapshot
- **THEN** la torre es 1 rectángulo del color de la torre sobre su huella (error ≤ 1 px), sin parte alta, la sonda
  cuenta 1 torre con reserva y no hay errores no capturados

#### Scenario: Colores de los solares inválidos
- **GIVEN** los datos de aspecto del repositorio con, en un caso cada vez: el color de la torre igual a `"#12345"`; sin
  el color del solar en obra; o el color de la casa igual al de `goblin-house`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra ese campo
- **AND** no se muestra el menú ni empieza ninguna partida

#### Scenario: Presupuesto de objetos con solares
- **GIVEN** el contenido por defecto y las semillas 42 y 123
- **WHEN** se calcula el plan de pintado del mapa sin navegador
- **THEN** en ambas el número de objetos del mapa, solares incluidos, es ≤ 1.000, y se anota en el verify-report

#### Scenario: Pintar los solares no cambia la simulación
- **GIVEN** dos partidas con la semilla 42, la misma secuencia de 1.200 inputs y las mismas construcciones, una con las
  hojas de los solares cargadas y otra sin cargar
- **WHEN** se ejecutan 1.200 ticks
- **THEN** sus snapshots son iguales campo a campo en cada tick

### Requirement: Pintado de las flechas de torre
El sistema SHALL pintar cada flecha de torre del snapshot con la hoja de la flecha del arquero (la misma que los
proyectiles del jugador), orientada según su dirección, y con su aspecto de reserva si la hoja no carga. La sonda de
render SHALL contarlas aparte (`sprites.towerArrows`, visibles y con reserva), sin sumarlas al recuento de proyectiles;
0 en modo menú.

<!-- Regla e2e-lite: estos escenarios se cubren sin navegador (plan y capas con snapshots preparados) o ampliando el
     único E2E nuevo de `build-sites` ("Construir una casa en el juego real"), que lee `sprites.sites`. -->

#### Scenario: Flechas coherentes con el snapshot
- **GIVEN** una serie de 60 snapshots con ≥ 1 torre construida disparando y el Linter disparando
- **WHEN** se pintan en orden y tras cada uno se lee la sonda de render
- **THEN** en cada frame `sprites.towerArrows` es igual al número de flechas de torre del snapshot y el recuento de
  proyectiles al de proyectiles del jugador
