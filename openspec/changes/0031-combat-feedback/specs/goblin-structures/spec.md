# Spec delta · goblin-structures

<!-- Change 0031-combat-feedback. La barra de vida se pinta según "Barras de vida de las estructuras"
     (`sprite-rendering`) y el número de daño según "Registro de golpes de combate" (`simulation-loop`). Aquí solo
     cambia lo que el snapshot expone de cada estructura. -->

## ADDED Requirements
(ninguno)

## MODIFIED Requirements

### Requirement: Estructuras en el snapshot
El sistema SHALL exponer en el `RunSnapshot` la lista de estructuras de la partida, en el orden fijo de su colocación
(o de declaración, en un mapa explícito), incluidas las destruidas. Cada estructura MUST incluir un identificador único
en la partida, su tipo, su posición, su radio de impacto, su huella (primera columna, primera fila, columnas y filas),
su vida actual, su **vida máxima** y si está destruida. La vida máxima es la vida con la que se crea la estructura (la
de su tipo en `content/structures.json` en el mapa generado: casa 60 y torre 90 con el contenido por defecto; en un mapa
explícito, la declarada), es > 0 y no cambia durante la partida, tampoco en ruina; la vida actual está siempre en
[0, vida máxima]. La lista no cambia de orden ni de longitud durante la partida. Modificar desde fuera la lista leída
MUST NOT cambiar la simulación (ver "Snapshot no mutable desde fuera" en `simulation-loop`). Exponer la vida máxima MUST
NOT cambiar la colocación, la vida, la destrucción ni el oro de ninguna estructura, ni la firma `STRUCTURE_GOLDEN`.

#### Scenario: Lista inicial
- **GIVEN** el contenido por defecto y la semilla 42
- **WHEN** se lee el snapshot antes del primer tick
- **THEN** la lista tiene tantas estructuras como casas y torres del contenido, con identificadores distintos, cada una
  con la vida de su tipo y sin destruir
- **AND** cada `goblin-house` tiene vida máxima 60 y cada `goblin-tower` vida máxima 90, iguales a su vida actual

#### Scenario: Vida máxima tras el daño y en ruina
- **GIVEN** una casa explícita con vida 60 que recibe 5 impactos del Linter (daño 6) en ticks distintos y, en otra
  partida, una torre explícita con vida 90 que queda destruida en el tick n
- **WHEN** se leen los snapshots tras el 5.º impacto y de los ticks n a n + 600
- **THEN** la casa figura con vida 30 y vida máxima 60
- **AND** la torre figura destruida con vida 0 y vida máxima 90 en todos ellos

#### Scenario: Vida máxima de una estructura declarada
- **GIVEN** el mapa vacío con una casa declarada con vida 30
- **WHEN** se lee el snapshot del tick 0
- **THEN** la casa tiene vida 30 y vida máxima 30

#### Scenario: Orden estable tras destruir
- **GIVEN** una partida con 3 estructuras s1, s2 y s3, en ese orden
- **WHEN** s2 queda destruida y se ejecuta 1 tick
- **THEN** la lista es s1, s2, s3, con s2 destruida y vida 0

#### Scenario: Lista no mutable
- **GIVEN** una partida sin armas equipadas en el tick 10 con ≥ 1 estructura
- **WHEN** el adaptador cambia la vida de una estructura de la lista leída a 0, su vida máxima a 1, la marca como
  destruida y vacía la lista, y se ejecuta 1 tick
- **THEN** el snapshot del tick 11 tiene la misma lista que el del tick 10, con la vida y la vida máxima que tenía cada
  estructura

#### Scenario: Firma de estructuras intacta
- **GIVEN** el contenido por defecto y la firma de estructuras versionada en los tests antes de este change
- **WHEN** se colocan las estructuras de las semillas de la firma y se calcula su firma
- **THEN** coincide con la versionada

## REMOVED Requirements
(ninguno)
