# Spec delta · simulation-loop

<!-- Ruta: openspec/changes/0013-world-camera/specs/simulation-loop/spec.md
     Solo cambia el escenario "200 enemigos encima del jugador": con un mundo mayor que la vista, colocar los enemigos
     en un punto fijo deja de garantizar el contacto. El umbral de 2 ms no cambia. -->

## MODIFIED Requirements

### Requirement: Rendimiento con el tope de enemigos
El sistema SHALL ejecutar un tick de simulación con 200 enemigos vivos, la detección de contacto activa, las armas
activas y las gemas activas en ≤ 2 ms de media, medido con un benchmark de Vitest sobre el núcleo, sin motor ni
render. La partida medida MUST estar en curso en todos los ticks medidos, de modo que se midan los pasos completos
del tick: si se abre una oferta, el benchmark elige la opción 0 antes del siguiente tick y esa elección cuenta en
el tiempo medido. El camino caliente del tick MUST NOT crear objetos nuevos por tick para gemas (reserva de
`maxGems`). Los escenarios que piden enemigos "en contacto" MUST colocarlos respecto a la posición del jugador, de
modo que el contacto se mantenga sea cual sea el tamaño del mundo.

#### Scenario: Tope de vivos alcanzado
- **GIVEN** una partida con el contenido por defecto, semilla fija, exactamente 200 enemigos vivos y una
  vida del jugador suficiente para no llegar a 0 en 600 ticks
- **WHEN** el benchmark mide 600 ticks consecutivos con input (1, 0)
- **THEN** la media es ≤ 2 ms por tick

#### Scenario: 200 enemigos encima del jugador
- **GIVEN** una partida con semilla fija, 200 enemigos vivos en contacto con el jugador y una vida del jugador
  suficiente para no llegar a 0 en 600 ticks
- **WHEN** el benchmark mide 600 ticks consecutivos
- **THEN** la media es ≤ 2 ms por tick y la partida sigue en curso al terminar la medición
- **AND** en cada tick medido hay ≥ 1 enemigo en contacto con el jugador

#### Scenario: Contacto con cualquier tamaño de mundo
- **GIVEN** la preparación del escenario "200 enemigos encima del jugador", una vez con el mundo por defecto
  (1.920 × 1.080) y otra con una arena explícita de 4.000 × 4.000
- **WHEN** se ejecutan 600 ticks en cada una
- **THEN** en ambas, en cada tick, hay ≥ 1 enemigo en contacto con el jugador

#### Scenario: Peor caso con proyectiles
- **GIVEN** una partida con semilla fija, 200 enemigos vivos, `maxProjectiles` (32) proyectiles vivos en todos los
  ticks medidos y una vida del jugador suficiente para no llegar a 0 en 600 ticks
- **WHEN** el benchmark mide 600 ticks consecutivos
- **THEN** la media es ≤ 2 ms por tick

#### Scenario: Peor caso con gemas
- **GIVEN** una partida con semilla fija, 200 enemigos vivos, `maxProjectiles` (32) proyectiles vivos y `maxGems`
  (300) gemas atraídas, todas a ≥ 400 px del jugador para que ninguna se recoja durante la medición, y una vida del
  jugador suficiente para no llegar a 0
- **WHEN** el benchmark mide 60 ticks consecutivos (60 × 6 px = 360 px < 400)
- **THEN** la media es ≤ 2 ms por tick
