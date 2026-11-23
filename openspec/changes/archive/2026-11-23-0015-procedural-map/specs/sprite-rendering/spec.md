# Spec delta · sprite-rendering

<!-- Ruta: openspec/changes/0015-procedural-map/specs/sprite-rendering/spec.md
     En este change el mapa se pinta con colores lisos por tipo de celda, sin arte nuevo ni cambios en
     `asset-provenance`. El arte del mapa (agua, orillas, árboles, puente) llega en un change posterior. -->

## ADDED Requirements

### Requirement: Pintado del mapa
El sistema SHALL pintar, mientras existe una partida, cada celda `trunk`, `water` y `bridge` de su mapa (ver
`procedural-map`) como un rectángulo relleno que cubre exactamente el rectángulo de mundo de la celda (error ≤ 1 px),
con el color de su tipo. Las celdas `grass` no se pintan: en ellas se ve el fondo de hierba. Las celdas pintadas
quedan por encima del fondo y por debajo del jugador, los enemigos, los cadáveres, los proyectiles, los pulsos y las
gemas, y están fijas en el mundo como el fondo. Los colores viven en los datos de aspecto, uno por tipo (`trunk`,
`water`, `bridge`), en formato `#RRGGBB`, y son distintos dos a dos; se validan con zod en el arranque como el resto
de datos de aspecto: un color ausente, con otro formato, repetido o de un tipo desconocido MUST hacer fallar el
arranque con un error que nombre el campo. El pintado del mapa no depende de ninguna hoja, no cuenta como sprite de
fondo ni como aspecto de reserva y MUST NOT cambiar la simulación.

Al empezar una partida nueva (R o `Volver al menú` + `Jugar`) se pinta su mapa y no queda visible ninguna celda del
mapa anterior. En modo menú no se ve ninguna celda del mapa.

#### Scenario: Colores del repositorio
- **GIVEN** los datos de aspecto del repositorio
- **WHEN** se carga el contenido
- **THEN** hay un color `#RRGGBB` para `trunk`, `water` y `bridge`, y los tres son distintos

#### Scenario: Colores inválidos
- **GIVEN** los datos de aspecto del repositorio con, en un caso cada vez: el color de `water` igual a `"#12345"`,
  `"blue"` o `"#GGGGGG"`; sin el color de `bridge`; el color de `bridge` igual al de `trunk`; o un color extra para
  `lava`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que nombra `water`, `bridge`, `bridge` y `lava` respectivamente
- **AND** no se muestra el menú ni empieza ninguna partida

#### Scenario: Celda pintada en su sitio y en su capa
- **GIVEN** un mapa de hierba con un tronco en (10, 4) y, con la rejilla por defecto, un snapshot con un enemigo en
  (630, 270)
- **WHEN** se pinta el snapshot
- **THEN** hay 1 rectángulo del color de `trunk` que cubre (600, 240)–(660, 300) en coordenadas de mundo
- **AND** está por encima del fondo y por debajo del sprite del enemigo

#### Scenario: Celdas pintadas iguales al mapa
- **GIVEN** la build de producción con `?e2e&manual&seed=42` (mapa real)
- **WHEN** arranca la partida, se pinta 1 frame y se leen la sonda de render y la del mapa
- **THEN** las celdas pintadas de `trunk`, `water` y `bridge` son, en número, iguales a los recuentos de esos tipos
  en el mapa de la sonda

#### Scenario: Mapa vacío
- **GIVEN** la build de producción con `?e2e&map=empty&seed=42`
- **WHEN** se pinta 1 frame de la partida
- **THEN** la sonda informa de 0 celdas pintadas de cada tipo y de 1 sprite de fondo

#### Scenario: Partida nueva con otro mapa
- **GIVEN** la build de producción con `?e2e&manual&seed=42` y la partida terminada
- **WHEN** se pulsa R y se pinta el primer frame de la partida nueva
- **THEN** las celdas pintadas por tipo coinciden con los recuentos del mapa de la partida nueva en la sonda

#### Scenario: Mapa sobre el fondo de reserva
- **GIVEN** la build de producción con `?e2e&manual&seed=42` y una prueba que hace fallar la petición de la hoja del
  fondo
- **WHEN** arranca la partida y se pinta 1 frame
- **THEN** el fondo usa aspecto de reserva, las celdas pintadas por tipo coinciden con el mapa de la sonda y no hay
  errores no capturados

## MODIFIED Requirements

### Requirement: Aspecto de reserva ante un fallo de carga
El sistema SHALL, si la hoja de un aspecto falla al cargar o no contiene algún frame referenciado por sus animaciones,
pintar los elementos de ese aspecto con su aspecto de reserva: una forma rellena centrada en la posición del elemento
y de diámetro 2 × el radio del elemento en el snapshot, sin volteo ni rotación (en el fondo, un relleno liso del mundo
entero, (0, 0)–(ancho, alto) en coordenadas de mundo). El fallo MUST NOT romper la partida ni producir errores no
capturados, y los aspectos cuya hoja carga bien siguen con su arte. El aspecto de reserva conserva el resto del
comportamiento de esta spec (duración del cadáver, parpadeo e indicación de daño) y MUST NOT depender de ficheros ni
de recursos `blob:`. Las celdas pintadas del mapa (ver "Pintado del mapa") no son aspecto de reserva y se pintan
igual falle o no la hoja del fondo.

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
- **GIVEN** la build de producción con `?e2e&map=empty&seed=7`, una prueba que hace fallar la petición de la hoja del
  fondo y un input que lleva al jugador a las cuatro esquinas del mundo
- **WHEN** se pintan los frames hasta que el jugador ha tocado las cuatro esquinas
- **THEN** la sonda informa de que el fondo usa aspecto de reserva y en cada frame el rectángulo visible de la cámara
  está entero dentro del rectángulo de mundo que cubre ese relleno, (0, 0)–(1.920, 1.080)
- **AND** no hay errores no capturados

### Requirement: Proyectiles, gemas, pulso y fondo
El sistema SHALL pintar un sprite de flecha por cada proyectil del snapshot y un sprite de gema por cada gema, en su
posición (error ≤ 0,001) y con el aspecto del repositorio, ambos en `idle`. El pulso de Tests no usa datos de
aspecto: conserva su anillo (ver `auto-weapons`). Mientras existe una partida, el fondo de hierba MUST cubrir el mundo
entero, (0, 0)–(ancho, alto) en coordenadas de mundo ((0, 0)–(1.920, 1.080) con el contenido por defecto), quedar por
debajo de todos los demás elementos, incluidas las celdas pintadas del mapa, y estar fijo en el mundo: su posición de
mundo no cambia entre snapshots y su posición en pantalla solo cambia con el rectángulo visible de la cámara (ver
`world-camera`). En ningún frame de una partida MUST verse dentro del rectángulo visible una zona sin fondo. Esta spec
no fija si el fondo se ve en modo menú.

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
- **THEN** en ambos el fondo cubre el rectángulo de mundo (0, 0)–(1.920, 1.080), está por debajo de las celdas
  pintadas del mapa, el jugador, los enemigos, los cadáveres, los proyectiles, los pulsos y las gemas, y su posición
  de mundo es la misma

#### Scenario: Fondo en las cuatro esquinas
- **GIVEN** la build de producción con `?e2e&map=empty&seed=7` y un input que lleva al jugador a las cuatro esquinas
  del mundo
- **WHEN** se pintan los frames hasta que el jugador ha tocado las cuatro esquinas
- **THEN** en cada frame el rectángulo visible de la cámara está entero dentro del rectángulo que cubre el fondo y
  la sonda informa de fondo visible

### Requirement: Sonda de render para E2E
El sistema SHALL exponer, solo con `?e2e` y como parte de la sonda `window.__sprint`, el recuento de sprites visibles
en el último frame pintado por tipo: fondo, jugador, enemigo vivo, cadáver, proyectil, pulso y gema; por tipo y
por aspecto de enemigo, cuántos usan aspecto de reserva; y el número de celdas del mapa pintadas por tipo (`trunk`,
`water`, `bridge`). Un sprite oculto por el parpadeo cuenta como no visible. En modo menú los recuentos de jugador,
enemigo, cadáver, proyectil, pulso, gema y celdas del mapa valen 0. Sin `?e2e` MUST NOT existir. Leer la sonda MUST
NOT cambiar la simulación ni lo que se pinta.

#### Scenario: Recuento coherente con el snapshot
- **GIVEN** `?e2e&seed=42` y una partida en curso
- **WHEN** se pintan 600 frames y en cada uno se leen la sonda de render y el snapshot pintado
- **THEN** en cada frame los sprites visibles de enemigo, proyectil, pulso y gema son iguales en número a los
  enemigos, proyectiles, pulsos y gemas del snapshot, y el de jugador vale 1 salvo en los frames en que el parpadeo
  lo oculta, que vale 0
- **AND** el recuento de cadáveres es ≤ 64 en todos
- **AND** las celdas del mapa pintadas por tipo son las mismas en los 600 frames e iguales a los recuentos del mapa
  de la sonda

#### Scenario: Sonda en el menú
- **GIVEN** `?e2e&seed=42` y el menú tras `Volver al menú`
- **WHEN** se pinta 1 frame y se lee la sonda de render
- **THEN** los recuentos de jugador, enemigo, cadáver, proyectil, pulso, gema y celdas del mapa valen 0

#### Scenario: Sin sonda fuera de E2E
- **GIVEN** la URL `?seed=42`
- **WHEN** termina la carga y se pulsa `Jugar`
- **THEN** `window.__sprint` es `undefined`
