# Spec delta · simulation-loop

<!-- Ruta: openspec/changes/0010-balance-pass/specs/simulation-loop/spec.md
     Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test. -->

## ADDED Requirements
<!-- Ninguno. -->

## MODIFIED Requirements

### Requirement: Mismo resultado con cualquier velocidad
El sistema SHALL producir el mismo desenlace de partida con cualquier velocidad N en `1..15` para la misma semilla,
el mismo contenido, input constante y la política de elección fija: resultado (victoria o derrota), tick en que
termina, nivel, bajas y lista de mejoras adquiridas con sus niveles MUST ser idénticos a los de velocidad 1. La
velocidad solo cambia cuántos ticks se ejecutan por frame, no cuáles ni en qué orden. Los escenarios de derrota usan
semillas del conjunto 1..50, en el que un jugador quieto pierde antes de 180 s con cualquier semilla (ver
`run-outcome`, "Partida ganable y perdible con el contenido por defecto"); no dependen de que una semilla concreta
pierda antes que otra.

#### Scenario: Derrota equivalente con la semilla 42
- **GIVEN** cuatro partidas con el contenido por defecto, la semilla 42, input (0, 0) constante y la política de
  elección fija, a velocidades 1, 4, 8 y 15
- **WHEN** el motor informa de frames de 16,667 ms hasta que cada partida termina o hasta 36.000 ticks
- **THEN** las cuatro terminan con el mismo resultado, en el mismo tick, con el mismo nivel, las mismas bajas y la
  misma lista de mejoras adquiridas con sus niveles

#### Scenario: Derrota equivalente con otra semilla del conjunto
- **GIVEN** dos partidas con el contenido por defecto, la semilla 7 (del conjunto 1..50), input (0, 0) constante y
  la política de elección fija, a velocidades 1 y 8
- **WHEN** el motor informa de frames de 16,667 ms hasta que cada partida termina o hasta 36.000 ticks
- **THEN** ambas terminan con resultado derrota antes del tick 10.800, en el mismo tick, con el mismo nivel, las
  mismas bajas y la misma lista de mejoras adquiridas con sus niveles

#### Scenario: Equivalencia con frames irregulares
- **GIVEN** dos partidas con el contenido por defecto, la semilla 7, input (1, 0) constante y la política de
  elección fija, una a velocidad 1 y otra a velocidad 8
- **WHEN** ambas reciben frames con duraciones que alternan 8,334 ms, 16,667 ms y 33,334 ms hasta que terminan o
  hasta 36.000 ticks
- **THEN** ambas terminan con el mismo resultado, en el mismo tick, con el mismo nivel, las mismas bajas y la misma
  lista de mejoras adquiridas con sus niveles

#### Scenario: Snapshots iguales tick a tick
- **GIVEN** dos partidas con el contenido por defecto, la semilla 42, input (0, 0) constante y la política de
  elección fija, a velocidades 1 y 8
- **WHEN** ambas avanzan hasta el tick 1.200
- **THEN** el snapshot de la partida a velocidad 8 en el tick 1.200 es igual campo a campo al de la partida a
  velocidad 1 en el tick 1.200

## REMOVED Requirements
<!-- Ninguno. El escenario "Derrota equivalente con la semilla 90" se sustituye en MODIFIED por "Derrota equivalente
     con otra semilla del conjunto" (semilla 7): la 90 no pertenece a 1..50 y se elegía por perder antes. -->
