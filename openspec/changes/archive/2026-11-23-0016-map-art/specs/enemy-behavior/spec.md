# Spec delta · enemy-behavior

<!-- Ruta: openspec/changes/0016-map-art/specs/enemy-behavior/spec.md
     Cobertura (e2e-lite): todos los escenarios se cubren con tests unitarios o de aplicación. Ningún E2E nuevo.
     Deuda aceptada en el gate (decisión 2): los enemigos atraviesan el castillo hasta 0018 flow-field. -->

## MODIFIED Requirements

### Requirement: Los enemigos ignoran el mapa
El sistema SHALL mover a los enemigos sin tener en cuenta el mapa (ver `procedural-map`): atraviesan celdas `trunk`,
`water` y `castle` y su persecución, su velocidad y su permanencia dentro de la arena MUST ser exactamente las mismas
que con un mapa todo `grass` con el mismo punto de salida. Los enemigos MUST NOT consultar el mapa ni consumir azar
por él. Sus posiciones de aparición tampoco tienen en cuenta el mapa (ver "Azar del mapa independiente del de la
partida" en `procedural-map`). Un enemigo puede estar, aparecer o morir sobre una celda `castle`: ningún requisito ni
test MUST suponer lo contrario.

#### Scenario: Persecución a través del agua
- **GIVEN** un mapa de hierba con las celdas (3, 4), (4, 4), (5, 4) y (6, 4) de `water` (x en [180, 420], y en
  [240, 300]), un jugador quieto en (480, 270) y un enemigo con velocidad 60 en (100, 270)
- **WHEN** se ejecutan 60 ticks
- **THEN** el enemigo está en (160, 270) con un error ≤ 0,001
- **AND** tras 240 ticks está en (340, 270) (error ≤ 0,001), dentro de la celda de agua (5, 4)

#### Scenario: Persecución a través del castillo
- **GIVEN** un mapa de hierba con las celdas de columnas 14–18 y filas 6–9 `castle` (x en [840, 1.140], y en
  [360, 600]), un jugador quieto en (990, 700) y un enemigo con velocidad 60 en (990, 300)
- **WHEN** se ejecutan 180 ticks
- **THEN** el enemigo está en (990, 480) (error ≤ 0,001), dentro de la celda `castle` (16, 8)
- **AND** tras 330 ticks está en (990, 630) (error ≤ 0,001): ha cruzado la huella entera

#### Scenario: Misma trayectoria con mapa generado y vacío
- **GIVEN** dos partidas con el contenido por defecto, la semilla 7, input (0, 0) y la política de elección fija, una
  con el mapa generado y otra con el mapa vacío con salida (990, 630) (ver `procedural-map`)
- **WHEN** ambas ejecutan 1.200 ticks
- **THEN** en cada tick la lista de enemigos (identificador, tipo, posición y vida) es igual en las dos
