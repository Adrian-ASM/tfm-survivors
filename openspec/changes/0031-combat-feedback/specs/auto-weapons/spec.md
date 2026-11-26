# Spec delta · auto-weapons

<!-- Change 0031-combat-feedback. Solo cambia la frase que prohibía los números de daño sobre los enemigos: ahora
     salen de "Números de daño" (`sprite-rendering`). Las reglas de daño, el destello (`hitFlashTicks` 4) y los pulsos
     no cambian. -->

## ADDED Requirements
(ninguno)

## MODIFIED Requirements

### Requirement: Indicación visual de daño, proyectiles y pulsos
El sistema SHALL exponer lo necesario para que el jugador vea que las armas actúan:
- cada enemigo del snapshot indica si ha recibido daño en los últimos `hitFlashTicks` ticks ejecutados: dañado en
  el tick T, lo indica en los snapshots de T a T + `hitFlashTicks` − 1;
- un pulso disparado en el tick T aparece en los snapshots de T a T + `visualTicks` − 1, con el arma que lo
  disparó, el tick T, el centro (posición del jugador en T, fija aunque el jugador se mueva) y el radio efectivo del
  criterio en T (fijo aunque después se elija una mejora de radio);
- cada arma equipada indica si está cargada;
- cada impacto que quita vida queda en los golpes de combate del snapshot (ver "Registro de golpes de combate" en
  `simulation-loop`).

El adaptador de render MUST pintar, en cada frame, una indicación visual de daño en cada enemigo que lo indique y
solo en ellos (por ejemplo, un tinte o destello sobre su sprite animado, sin detener su animación ni cambiar su
tamaño o posición), un anillo por cada pulso del snapshot y un sprite de flecha por cada proyectil del snapshot en
su posición (ver `sprite-rendering`), sin dejar visible ningún sprite de un proyectil desaparecido. En el frame en
que un enemigo deja de indicar daño, su sprite vuelve a su aspecto normal. La indicación de daño se aplica igual a
un enemigo pintado con aspecto de reserva. Sobre los enemigos no hay barras de vida; el daño que reciben se muestra con
los números de "Números de daño" (`sprite-rendering`), además del destello, y el contador de bajas se muestra en el HUD
(ver `hud`).

#### Scenario: Duración del destello
- **GIVEN** un enemigo que recibe daño en el tick T y no vuelve a recibirlo
- **WHEN** se leen los snapshots de T a T + 4
- **THEN** indica daño reciente en T, T + 1, T + 2 y T + 3, y no en T + 4

#### Scenario: Destello renovado
- **GIVEN** un enemigo que recibe daño en los ticks T y T + 2
- **WHEN** se leen los snapshots de T a T + 6
- **THEN** indica daño reciente de T a T + 5, y no en T + 6

#### Scenario: Indicación de daño fiel al snapshot
- **GIVEN** 3 `goblin-torch` que se mueven, de los que solo el segundo indica daño en los snapshots de T a T + 3
- **WHEN** se pintan los snapshots de T a T + 4
- **THEN** de T a T + 3 el segundo sprite muestra la indicación de daño y el primero y el tercero no
- **AND** en T + 4 ninguno la muestra y los 3 se pintan con su aspecto normal
- **AND** la animación `walk` del segundo sigue avanzando de T a T + 4 y su tamaño y posición son los mismos que
  sin indicación

#### Scenario: Indicación de daño con aspecto de reserva
- **GIVEN** la hoja de `goblin-tnt` sin cargar y un `goblin-tnt` que indica daño en los snapshots de T a T + 3
- **WHEN** se pintan los snapshots de T a T + 4
- **THEN** su aspecto de reserva muestra la indicación de daño de T a T + 3 y no en T + 4

#### Scenario: Duración del pulso
- **GIVEN** un pulso de Tests disparado en el tick T con el jugador en (480, 270), que luego se mueve
- **WHEN** se leen los snapshots de T a T + 8
- **THEN** el pulso aparece de T a T + 7 con centro (480, 270) y radio 90, y no en T + 8

#### Scenario: Pulso visible durante una mejora de radio
- **GIVEN** un pulso de Tests disparado en el tick T con radio 90 y `coverage` elegido en una oferta abierta en T
- **WHEN** se leen los snapshots de T a T + 7
- **THEN** el pulso figura con radio 90 en todos ellos
- **AND** el siguiente pulso de Tests figura con radio 105

#### Scenario: Sprites de proyectiles
- **GIVEN** un snapshot con 3 proyectiles ya pintado
- **WHEN** se pinta un snapshot en el que 1 de ellos ha desaparecido y se ha creado otro
- **THEN** hay exactamente 3 sprites de flecha visibles, cada uno en la posición de un proyectil distinto del
  snapshot (error ≤ 0,001)

#### Scenario: Destello y número del mismo impacto
- **GIVEN** un `goblin-torch` con vida 10 que recibe un impacto del Linter en el tick T y ningún otro
- **WHEN** se pintan los snapshots de T a T + 4
- **THEN** el destello se ve de T a T + 3 y no en T + 4, como sin números, y desde el frame de T hay exactamente 1
  número de daño de clase `enemy` con el texto `6`, creado una sola vez
- **AND** el enemigo no tiene ninguna barra de vida en ningún frame

## REMOVED Requirements
(ninguno)
