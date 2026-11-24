# Spec delta · hud

## MODIFIED Requirements

### Requirement: Contenido y visibilidad del HUD
La vista SHALL mostrar un HUD con seis elementos: la vida del jugador (barra y número), el tiempo restante de la
partida, el nivel y la XP (la barra de XP de `leveling`), las bajas de la partida (ver `run-outcome`), el oro y la
madera (ver "Oro y madera en el HUD"). El HUD MUST verse si y solo si existe una partida: en todos sus estados (en
curso, eligiendo mejora, en tienda y terminada) y también con la partida en pausa. En el menú de inicio (ver
`main-menu`), donde no existe partida, el HUD MUST NOT verse. El HUD muestra siempre los valores del último snapshot
pintado: mientras la partida está en pausa, eligiendo mejora o terminada, sus valores no cambian; en la tienda solo
cambian el oro y la vida, por las compras. No hay ningún botón ni indicador de tienda en el HUD. El HUD solo depende
del snapshot: no cambia la simulación.

<!-- Escenarios vivos sin cambios: todos los de este requisito. -->

#### Scenario: HUD en la tienda
- **GIVEN** una partida con duración objetivo 36.000 ticks que abre la tienda en el tick 600 con vida 40 de 100 y oro
  30
- **WHEN** el motor informa de 600 frames de 16,667 ms, se compra una curación de porción 25 y precio 10 y se pinta 1
  frame
- **THEN** durante los 600 frames el HUD es visible con tiempo `09:50`, vida `40/100` y oro 30
- **AND** tras la compra muestra vida `65/100`, oro 20 y tiempo `09:50`
