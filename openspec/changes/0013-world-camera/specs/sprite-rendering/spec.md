# Spec delta · sprite-rendering

<!-- Ruta: openspec/changes/0013-world-camera/specs/sprite-rendering/spec.md
     La cámara y la conversión de mundo a pantalla viven en la capacidad nueva `world-camera`; aquí solo cambia lo
     que cubre el fondo. Las posiciones de los escenarios de esta spec son de mundo. -->

## MODIFIED Requirements

### Requirement: Proyectiles, gemas, pulso y fondo
El sistema SHALL pintar un sprite de flecha por cada proyectil del snapshot y un sprite de gema por cada gema, en su
posición (error ≤ 0,001) y con el aspecto del repositorio, ambos en `idle`. El pulso de Tests no usa datos de
aspecto: conserva su anillo (ver `auto-weapons`). Mientras existe una partida, el fondo de hierba MUST cubrir el mundo
entero, (0, 0)–(ancho, alto) en coordenadas de mundo ((0, 0)–(1.920, 1.080) con el contenido por defecto), quedar por
debajo de todos los demás elementos y estar fijo en el mundo: su posición de mundo no cambia entre snapshots y su
posición en pantalla solo cambia con el rectángulo visible de la cámara (ver `world-camera`). En ningún frame de una
partida MUST verse dentro del rectángulo visible una zona sin fondo. Esta spec no fija si el fondo se ve en modo menú.

#### Scenario: Flechas y gemas
- **GIVEN** un snapshot con 3 proyectiles y 4 gemas
- **WHEN** se pinta el snapshot
- **THEN** hay 3 sprites de proyectil con el aspecto del proyectil y 4 de gema con el aspecto de la gema, cada uno
  en la posición de un elemento distinto del snapshot

#### Scenario: Pulso sin sprite
- **GIVEN** un snapshot con 1 pulso de radio 90 en (480, 270)
- **WHEN** se pinta el snapshot
- **THEN** hay 1 anillo de radio 90 centrado en (480, 270) y ningún sprite de hoja para el pulso

#### Scenario: Fondo de hierba en el mundo entero
- **GIVEN** el mundo por defecto y una partida en curso con el jugador en (960, 540) y, después, en (100, 100)
- **WHEN** se pinta cada snapshot
- **THEN** en ambos el fondo cubre el rectángulo de mundo (0, 0)–(1.920, 1.080), está por debajo del jugador, los
  enemigos, los cadáveres, los proyectiles, los pulsos y las gemas, y su posición de mundo es la misma

#### Scenario: Fondo en las cuatro esquinas
- **GIVEN** la build de producción con `?e2e&seed=7` y un input que lleva al jugador a las cuatro esquinas del mundo
- **WHEN** se pintan los frames hasta que el jugador ha tocado las cuatro esquinas
- **THEN** en cada frame el rectángulo visible de la cámara está entero dentro del rectángulo que cubre el fondo y
  la sonda informa de fondo visible

### Requirement: Aspecto de reserva ante un fallo de carga
El sistema SHALL, si la hoja de un aspecto falla al cargar o no contiene algún frame referenciado por sus animaciones,
pintar los elementos de ese aspecto con su aspecto de reserva: una forma rellena centrada en la posición del elemento
y de diámetro 2 × el radio del elemento en el snapshot, sin volteo ni rotación (en el fondo, un relleno liso del mundo
entero, (0, 0)–(ancho, alto) en coordenadas de mundo). El fallo MUST NOT romper la partida ni producir errores no
capturados, y los aspectos cuya hoja carga bien siguen con su arte. El aspecto de reserva conserva el resto del
comportamiento de esta spec (duración del cadáver, parpadeo e indicación de daño) y MUST NOT depender de ficheros ni
de recursos `blob:`.

#### Scenario: Hoja que no carga
- **GIVEN** la build de producción con `?e2e&seed=42` y una prueba que hace fallar la petición de la hoja de
  `goblin-torch`
- **WHEN** termina la carga y se pintan 600 frames
- **THEN** la sonda informa de que todos los sprites de `goblin-torch` usan aspecto de reserva y ningún sprite de
  otro aspecto lo usa
- **AND** la partida sigue avanzando (tick 600) y no hay errores no capturados

#### Scenario: Frame fuera de la hoja
- **GIVEN** un aspecto de `goblin-tnt` con frame de 32 × 32 px, una hoja de 128 × 32 px (frames 0 a 3) y `walk` con
  frames `[0, 1, 2, 7]`
- **WHEN** se pinta un `goblin-tnt`
- **THEN** se pinta con su aspecto de reserva y no hay errores no capturados

#### Scenario: Tamaño del aspecto de reserva
- **GIVEN** la hoja de `goblin-torch` sin cargar y un `goblin-torch` de radio 10 en (300, 200)
- **WHEN** se pinta el snapshot
- **THEN** su sprite es una forma de 20 px de diámetro centrada en (300, 200) (error ≤ 0,001)

#### Scenario: Fondo de reserva en el mundo entero
- **GIVEN** la build de producción con `?e2e&seed=7`, una prueba que hace fallar la petición de la hoja del fondo y
  un input que lleva al jugador a las cuatro esquinas del mundo
- **WHEN** se pintan los frames hasta que el jugador ha tocado las cuatro esquinas
- **THEN** la sonda informa de que el fondo usa aspecto de reserva y en cada frame el rectángulo visible de la cámara
  está entero dentro del rectángulo de mundo que cubre ese relleno, (0, 0)–(1.920, 1.080)
- **AND** no hay errores no capturados
