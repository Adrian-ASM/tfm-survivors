# Spec delta · auto-weapons

<!-- Ruta: openspec/changes/0012-sprite-rendering/specs/auto-weapons/spec.md
     Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test. -->

> Cambios: el snapshot de proyectil expone el arma que lo disparó (`weapon`), solo de lectura y sin efecto en la
> simulación; el destello de daño deja de ser un cambio de color de relleno y pasa a ser cualquier indicación visual
> fiel a `damaged` sobre el sprite animado; los proyectiles se pintan con el aspecto de su arma (ver
> `sprite-rendering`). Valores por defecto como en la spec viva.

## ADDED Requirements
<!-- Ninguno. -->

## MODIFIED Requirements

### Requirement: Indicación visual de daño, proyectiles y pulsos
El sistema SHALL exponer lo necesario para que el jugador vea que las armas actúan:
- cada enemigo del snapshot indica si ha recibido daño en los últimos `hitFlashTicks` ticks ejecutados: dañado en
  el tick T, lo indica en los snapshots de T a T + `hitFlashTicks` − 1;
- un pulso disparado en el tick T aparece en los snapshots de T a T + `visualTicks` − 1, con el arma que lo
  disparó, el tick T, el centro (posición del jugador en T, fija aunque el jugador se mueva) y el radio efectivo del
  criterio en T (fijo aunque después se elija una mejora de radio);
- cada proyectil del snapshot indica el arma que lo disparó (`weapon`, el `id` del arma en `content/weapons.json`),
  que no cambia mientras vive;
- cada arma equipada indica si está cargada.

El campo `weapon` de los proyectiles es solo de lectura: MUST NOT cambiar la simulación ni el determinismo (mismas
posiciones, impactos, identificadores y consumo de azar que sin él).

El adaptador de render MUST pintar, en cada frame, una indicación visual de daño en cada enemigo que lo indique y
solo en ellos (por ejemplo, un tinte o destello sobre su sprite animado, sin detener su animación), un anillo por
cada pulso del snapshot y un sprite por cada proyectil del snapshot en su posición, con el aspecto de su arma (ver
`sprite-rendering`), sin dejar visible ningún sprite de un proyectil desaparecido. Cuando un enemigo deja de indicar
daño, su sprite vuelve a su aspecto normal (con el `tint` de su aspecto, si lo tiene) en ese mismo frame. La
indicación de daño se aplica igual a un enemigo pintado con placeholder. Sobre los enemigos no hay barras de vida ni
números de daño; el contador de bajas se muestra en el HUD (ver `hud`).

#### Scenario: Duración del destello
- **GIVEN** un enemigo que recibe daño en el tick T y no vuelve a recibirlo
- **WHEN** se leen los snapshots de T a T + 4
- **THEN** indica daño reciente en T, T + 1, T + 2 y T + 3, y no en T + 4

#### Scenario: Destello renovado
- **GIVEN** un enemigo que recibe daño en los ticks T y T + 2
- **WHEN** se leen los snapshots de T a T + 6
- **THEN** indica daño reciente de T a T + 5, y no en T + 6

#### Scenario: Indicación de daño fiel al snapshot
- **GIVEN** 3 `bug` que se mueven, pintados con un aspecto `enemies.bug` con `tint` `#ffeeaa`, de los que solo el
  segundo indica daño en los snapshots de T a T + 3
- **WHEN** se pintan los snapshots de T a T + 4
- **THEN** de T a T + 3 el segundo sprite muestra la indicación de daño y el primero y el tercero no (se pintan con
  el tinte `#ffeeaa`)
- **AND** en T + 4 ninguno la muestra y los 3 se pintan con el tinte `#ffeeaa`
- **AND** la animación `walk` del segundo sigue avanzando de T a T + 4

#### Scenario: Indicación de daño con placeholder
- **GIVEN** la hoja de `enemies.bug` ausente y un `bug` que indica daño en los snapshots de T a T + 3
- **WHEN** se pintan los snapshots de T a T + 4
- **THEN** su placeholder muestra la indicación de daño de T a T + 3 y no en T + 4

#### Scenario: Duración del pulso
- **GIVEN** un pulso de Tests disparado en el tick T con el jugador en (480, 270), que luego se mueve
- **WHEN** se leen los snapshots de T a T + 8
- **THEN** el pulso aparece de T a T + 7 con centro (480, 270) y radio 90, y no en T + 8

#### Scenario: Pulso visible durante una mejora de radio
- **GIVEN** un pulso de Tests disparado en el tick T con radio 90 y `coverage` elegido en una oferta abierta en T
- **WHEN** se leen los snapshots de T a T + 7
- **THEN** el pulso figura con radio 90 en todos ellos
- **AND** el siguiente pulso de Tests figura con radio 105

#### Scenario: Arma del proyectil en el snapshot
- **GIVEN** el contenido por defecto, semilla 7 e input (0, 0) en todos los ticks
- **WHEN** se ejecutan 600 ticks
- **THEN** cada proyectil de cada snapshot tiene `weapon` `linter`, igual en todos los snapshots en que aparece

#### Scenario: Dos armas de proyectil
- **GIVEN** un contenido con dos armas de proyectil válidas, `linter` y `formatter` (`cooldownTicks` 45), y un
  objetivo permanente a 50 px que no muere
- **WHEN** se ejecutan 46 ticks
- **THEN** los proyectiles creados en el tick 1 son uno con `weapon` `linter` y otro con `weapon` `formatter`, y el
  creado en el tick 31 tiene `weapon` `linter`
- **AND** el creado en el tick 46 tiene `weapon` `formatter`

#### Scenario: El campo weapon no cambia la simulación
- **GIVEN** dos partidas con el contenido por defecto, la semilla 42, la misma secuencia de 1.200 inputs por tick y
  la política de elección fija
- **WHEN** se ejecutan 1.200 ticks
- **THEN** sus snapshots son iguales campo a campo en cada tick
- **AND** los escenarios de "Proyectiles", "Tope de proyectiles" y "Jugador quieto con el contenido por defecto"
  siguen cumpliéndose con los mismos valores

#### Scenario: Sprites de proyectiles
- **GIVEN** un snapshot con 3 proyectiles ya pintado
- **WHEN** se pinta un snapshot en el que 1 de ellos ha desaparecido y se ha creado otro
- **THEN** hay exactamente 3 sprites de proyectil visibles, cada uno en la posición de un proyectil distinto del
  snapshot (error ≤ 0,001)

#### Scenario: Aspecto del proyectil por arma
- **GIVEN** un manifiesto con `projectiles.linter` y un snapshot con 2 proyectiles de `weapon` `linter`
- **WHEN** se pinta el snapshot
- **THEN** los 2 sprites de proyectil usan el aspecto `projectiles.linter`

## REMOVED Requirements
<!-- Ninguno. -->
