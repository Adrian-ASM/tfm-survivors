# Spec delta · leveling

<!-- Change 0006-run-lifecycle-hud. Cambio de texto: la barra de XP pasa a formar parte del HUD (ver `hud`). Se
     retira la frase que excluía el resto del HUD; los escenarios no cambian. -->

## MODIFIED Requirements

### Requirement: Barra de XP y nivel en la vista
La vista SHALL mostrar en todo momento una barra de XP cuyo relleno es XP actual / XP para el siguiente nivel del
último snapshot (de 0 a 1) y el número del nivel actual. La barra solo depende del snapshot: no cambia la simulación.
La barra y el nivel forman parte del HUD (ver `hud`).

#### Scenario: Barra vacía al empezar
- **GIVEN** el snapshot de una partida recién creada
- **WHEN** se pinta
- **THEN** la barra de XP tiene relleno 0 y el nivel mostrado es 1

#### Scenario: Relleno parcial
- **GIVEN** un snapshot con nivel 2, XP 3 y XP para el siguiente nivel 10
- **WHEN** se pinta
- **THEN** la barra tiene relleno 0,3 (error ≤ 0,001) y el nivel mostrado es 2

#### Scenario: Tras subir de nivel
- **GIVEN** un snapshot pintado con nivel 1 y XP 4, y el siguiente con nivel 2 y XP 0
- **WHEN** se pinta el segundo
- **THEN** la barra tiene relleno 0 y el nivel mostrado es 2
