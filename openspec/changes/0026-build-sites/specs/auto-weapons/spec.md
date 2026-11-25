# Spec delta · auto-weapons

## MODIFIED Requirements

### Requirement: Tope de proyectiles
El sistema SHALL impedir que haya más de `maxProjectiles` proyectiles del jugador vivos. Un arma de proyectiles
cargada, con objetivo y con el tope lleno MUST NOT disparar y MUST conservar la carga. Los proyectiles que desaparecen
en un tick liberan su plaza para los disparos de ese mismo tick. Las flechas de las torres (ver "Torre que dispara sola"
en `build-sites`) tienen su propia reserva y su propio tope: MUST NOT contar para `maxProjectiles` ni ocupar sus
plazas, y los proyectiles del jugador no ocupan plazas de la reserva de las torres.

<!-- Escenarios vivos sin cambios: todos los de este requisito. -->

#### Scenario: Tope lleno con torres disparando
- **GIVEN** `maxProjectiles` 2, un Linter con `cooldownTicks` 1 y `lifetimeTicks` 60, un objetivo en alcance durante
  todos los ticks que ningún proyectil alcanza y una torre construida que crea 1 flecha en el tick 1
- **WHEN** se ejecutan 61 ticks
- **THEN** el Linter crea proyectiles exactamente en los ticks 1, 2 y 61, como sin la torre
- **AND** en ningún snapshot hay más de 2 proyectiles del jugador
