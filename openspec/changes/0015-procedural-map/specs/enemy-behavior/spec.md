# Spec delta · enemy-behavior

<!-- Ruta: openspec/changes/0015-procedural-map/specs/enemy-behavior/spec.md
     Hasta el change del campo de flujo los enemigos no usan el mapa. Este requisito lo hace explícito para que el
     campo de flujo lo modifique de forma consciente. Mapas explícitos con la rejilla por defecto (celdas de 60 px). -->

## ADDED Requirements

### Requirement: Los enemigos ignoran el mapa
El sistema SHALL mover a los enemigos sin tener en cuenta el mapa (ver `procedural-map`): atraviesan celdas `trunk` y
`water` y su persecución, su velocidad y su permanencia dentro de la arena MUST ser exactamente las mismas que con el
mapa vacío. Los enemigos MUST NOT consultar el mapa ni consumir azar por él. Sus posiciones de aparición tampoco
tienen en cuenta el mapa (ver "Azar del mapa independiente del de la partida" en `procedural-map`).

#### Scenario: Persecución a través del agua
- **GIVEN** un mapa de hierba con las celdas (3, 4), (4, 4), (5, 4) y (6, 4) de `water` (x en [180, 420], y en
  [240, 300]), un jugador quieto en (480, 270) y un enemigo con velocidad 60 en (100, 270)
- **WHEN** se ejecutan 60 ticks
- **THEN** el enemigo está en (160, 270) con un error ≤ 0,001
- **AND** tras 240 ticks está en (340, 270) (error ≤ 0,001), dentro de la celda de agua (5, 4)

#### Scenario: Misma trayectoria con mapa generado y vacío
- **GIVEN** dos partidas con el contenido por defecto, la semilla 7, input (0, 0) y la política de elección fija, una
  con el mapa generado y otra con el mapa vacío
- **WHEN** ambas ejecutan 1.200 ticks
- **THEN** en cada tick la lista de enemigos (identificador, tipo, posición y vida) es igual en las dos
