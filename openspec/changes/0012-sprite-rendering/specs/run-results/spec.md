# Spec delta · run-results

<!-- Ruta: openspec/changes/0012-sprite-rendering/specs/run-results/spec.md
     Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test. -->

> Cambios: la vista limpia tras reiniciar con R incluye los cadáveres de enemigos (ver `sprite-rendering`) y el
> estado del sprite del jugador, y se verifica con la sonda de render.

## ADDED Requirements
<!-- Ninguno. -->

## MODIFIED Requirements

### Requirement: Vista limpia tras reiniciar
La vista SHALL pintar, desde el primer frame de la partida nueva, exactamente los elementos de su snapshot: MUST
NOT quedar visible ningún sprite de enemigo, cadáver (aunque su animación de muerte no haya terminado, ver
`sprite-rendering`), proyectil, pulso o gema de la partida terminada, ni el overlay de resultados ni el de elección.
El jugador de la partida nueva se pinta en su posición inicial, sin la animación de muerte de la partida terminada y
sin heredar su orientación. El HUD muestra los valores de la partida nueva. Reiniciar varias veces seguidas MUST NOT
dejar sprites visibles que no correspondan al snapshot.

#### Scenario: Primer frame tras reiniciar
- **GIVEN** una partida terminada ya pintada con 200 enemigos, 32 proyectiles, 1 pulso, 300 gemas y 10 cadáveres en
  curso
- **WHEN** se pulsa la tecla R y se pinta el snapshot de la partida nueva en el tick 0
- **THEN** hay 0 sprites visibles de enemigo, cadáver, proyectil, pulso y gema, y el overlay de resultados no es
  visible
- **AND** el jugador es visible en su posición inicial, reproduce `idle` y no está volteado (ver `sprite-rendering`)
- **AND** el HUD muestra vida `100/100`, tiempo `10:00`, nivel 1 y 0 bajas

#### Scenario: Cinco reinicios seguidos
- **GIVEN** una sesión con `?e2e` en la que se juegan y terminan 5 partidas seguidas, reiniciando con R tras cada
  una, cada una con ≥ 1 enemigo y ≥ 1 gema al terminar
- **WHEN** se pinta cada snapshot de la sexta partida durante 600 ticks
- **THEN** en cada frame la sonda de render informa de un número de sprites visibles de enemigo, proyectil, pulso y
  gema igual al número de enemigos, proyectiles, pulsos y gemas del snapshot pintado
- **AND** en el primer frame de cada una de las 5 partidas nuevas la sonda informa de 0 cadáveres

## REMOVED Requirements
<!-- Ninguno. -->
