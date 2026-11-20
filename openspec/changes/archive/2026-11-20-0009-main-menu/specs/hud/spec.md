# Spec delta · hud

<!-- Ruta: openspec/changes/0009-main-menu/specs/hud/spec.md
     Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test. -->

> Motivo: con el menú de inicio puede no existir partida, y la pausa (ver `main-menu`) congela el snapshot. Solo
> cambia la visibilidad del HUD; su contenido y formato no cambian.

## ADDED Requirements
<!-- Ninguno. -->

## MODIFIED Requirements

### Requirement: Contenido y visibilidad del HUD
La vista SHALL mostrar un HUD con cuatro elementos: la vida del jugador (barra y número), el tiempo restante de la
partida, el nivel y la XP (la barra de XP de `leveling`) y las bajas de la partida (ver `run-outcome`). El HUD MUST
verse si y solo si existe una partida: en todos sus estados (en curso, eligiendo mejora y terminada) y también con la
partida en pausa. En el menú de inicio (ver `main-menu`), donde no existe partida, el HUD MUST NOT verse. El HUD
muestra siempre los valores del último snapshot pintado: mientras la partida está en pausa, eligiendo mejora o
terminada, sus valores no cambian. El HUD solo depende del snapshot: no cambia la simulación.

#### Scenario: HUD al empezar
- **GIVEN** el snapshot de una partida recién creada con el contenido por defecto
- **WHEN** se pinta
- **THEN** el HUD es visible y muestra vida `100/100` con la barra de vida llena (relleno 1), tiempo `10:00`, nivel
  1 con la barra de XP vacía y 0 bajas

#### Scenario: HUD con la partida terminada
- **GIVEN** una partida terminada con derrota en el tick 1.259 con nivel 3 y 41 bajas
- **WHEN** se pinta su snapshot y 60 frames más
- **THEN** el HUD sigue visible en todos ellos con vida `0/100`, tiempo `09:40`, nivel 3 y 41 bajas

#### Scenario: HUD en pausa
- **GIVEN** una partida con duración objetivo 36.000 ticks, en curso en el tick 600 con vida 75 de 100, nivel 2 y
  9 bajas
- **WHEN** se pausa y el motor informa de 600 frames de 16,667 ms
- **THEN** el HUD es visible en todos esos frames con vida `75/100`, tiempo `09:50`, nivel 2 y 9 bajas

#### Scenario: Sin HUD en el menú
- **GIVEN** el menú de inicio al cargar sin `?e2e`
- **WHEN** se pintan 60 frames
- **THEN** el HUD no es visible en ningún frame

#### Scenario: HUD tras volver al menú y jugar
- **GIVEN** una partida en pausa en el tick 3.000 con nivel 5 y 200 bajas
- **WHEN** se pulsa `Volver al menú`, se pinta 1 frame, se pulsa `Jugar` y se pinta el snapshot del tick 0
- **THEN** el HUD no es visible en el frame del menú
- **AND** en el frame de la partida nueva es visible con vida `100/100`, tiempo `10:00`, nivel 1 y 0 bajas

#### Scenario: El HUD no altera la simulación
- **GIVEN** dos partidas idénticas con la misma semilla, inputs y elecciones, una pintada con HUD y otra sin pintar
- **WHEN** ambas ejecutan 600 ticks con ≥ 1 golpe y ≥ 1 baja
- **THEN** sus snapshots son iguales campo a campo en cada tick

## REMOVED Requirements
<!-- Ninguno. -->
