# World Camera · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
El mundo mayor que la vista, la cámara que sigue al jugador dentro de sus límites, el HUD fijo en pantalla y la sonda E2E de cámara, sin que la cámara cambie la simulación.

## Requirements

### Requirement: Tamaño del mundo y de la vista validados
El sistema SHALL leer el tamaño del mundo (`width`, `height`) y el tope de vista (`maxView.width`, `maxView.height`)
de `content/arena.json`, validados con zod antes de llegar al dominio. Los cuatro valores MUST ser > 0 y el mundo MUST
ser al menos tan grande como el tope en cada eje (`width` ≥ `maxView.width` y `height` ≥ `maxView.height`). Un
contenido inválido MUST impedir que se muestre el menú o empiece una partida, con un error que nombre el campo
inválido. El contenido MUST NOT fijar un tamaño de vista (el campo `view` desaparece: si está, la carga falla con un
error que lo nombra). El contenido por defecto MUST definir un mundo de 3.840 × 2.160 y un tope de vista de
2.560 × 1.440. El tope solo llega a la presentación: el núcleo de simulación MUST NOT recibir el tope ni el tamaño de
la ventana.

#### Scenario: Contenido por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** el dominio recibe un mundo de 3.840 × 2.160 y la presentación un tope de vista de 2.560 × 1.440

#### Scenario: Mundo más estrecho que el tope
- **GIVEN** `content/arena.json` con `"width": 2559`, `"height": 2160` y tope 2.560 × 1.440
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `width`
- **AND** no se muestra el menú ni se crea ninguna partida

#### Scenario: Mundo más bajo que el tope
- **GIVEN** `content/arena.json` con `"width": 3840`, `"height": 1439` y tope 2.560 × 1.440
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `height`

#### Scenario: Mundo igual al tope
- **GIVEN** `content/arena.json` con mundo 2.560 × 1.440 y tope 2.560 × 1.440
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito

#### Scenario: Dimensiones no positivas
- **GIVEN** `content/arena.json` con, en un caso cada vez, `"width": 0`, `"height": -1` o `"maxView": { "width": 0,
  "height": 1440 }`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona el campo inválido

#### Scenario: Vista fija heredada
- **GIVEN** el contenido por defecto con un campo extra `"view": { "width": 960, "height": 540 }`
- **WHEN** se carga el contenido
- **THEN** la carga falla con un error que menciona `view`

### Requirement: Cámara que sigue al jugador dentro del mundo
Mientras existe una partida, la vista SHALL mostrar en cada frame un rectángulo del mundo de V_w × V_h (ver "Vista a
ventana completa con tope") centrado en la posición del jugador del snapshot pintado y desplazado lo mínimo para quedar
entero dentro del mundo (W × H). Su esquina superior izquierda MUST ser
(clamp(x − V_w / 2, 0, W − V_w), clamp(y − V_h / 2, 0, H − V_h)), con un error ≤ 1 px, usando el tamaño de ventana de
ese mismo frame. El seguimiento es directo: el rectángulo corresponde al snapshot pintado en ese mismo frame, sin
retraso, suavizado ni zona muerta. La vista MUST NOT mostrar en ningún frame ninguna zona fuera de (0, 0)–(W, H). En
el primer frame de cada partida (la primera, tras R y tras `Volver al menú` + `Jugar`) el rectángulo ya corresponde a
la posición inicial del jugador, sin heredar el de la partida anterior. Salvo que digan otra cosa, los escenarios de
este requisito usan una ventana de 1.280 × 720 (vista de 1.280 × 720).

#### Scenario: Jugador en el centro del mundo
- **GIVEN** el mundo por defecto y el jugador en (1.920, 1.080)
- **WHEN** se pinta el snapshot
- **THEN** el rectángulo visible es (1.280, 720)–(2.560, 1.440)

#### Scenario: Las cuatro esquinas
- **GIVEN** el mundo por defecto y el jugador, en cuatro snapshots distintos, en (16, 16), (3.824, 16), (16, 2.144)
  y (3.824, 2.144)
- **WHEN** se pinta cada snapshot
- **THEN** el rectángulo visible es, respectivamente, (0, 0)–(1.280, 720), (2.560, 0)–(3.840, 720),
  (0, 1.440)–(1.280, 2.160) y (2.560, 1.440)–(3.840, 2.160)

#### Scenario: Límite exacto del recorte
- **GIVEN** el mundo por defecto y el jugador, en dos snapshots, en (640, 360) y en (3.200, 1.800)
- **WHEN** se pinta cada snapshot
- **THEN** el rectángulo visible es (0, 0)–(1.280, 720) y (2.560, 1.440)–(3.840, 2.160) respectivamente

#### Scenario: Recorte en un solo eje
- **GIVEN** el mundo por defecto y el jugador en (100, 1.080)
- **WHEN** se pinta el snapshot
- **THEN** el rectángulo visible es (0, 720)–(1.280, 1.440)

#### Scenario: Seguimiento sin retraso
- **GIVEN** el mundo por defecto, un snapshot pintado con el jugador en (1.920, 1.080) y el siguiente con el jugador
  en (1.960, 1.080)
- **WHEN** se pinta el segundo snapshot
- **THEN** en ese mismo frame el rectángulo visible es (1.320, 720)–(2.600, 1.440)

#### Scenario: Ventana en el tope
- **GIVEN** el mundo por defecto, una ventana de 3.840 × 2.160 (vista 2.560 × 1.440) y el jugador en (1.920, 1.080) y
  después en (16, 16)
- **WHEN** se pinta cada snapshot
- **THEN** el rectángulo visible es (640, 360)–(3.200, 1.800) y (0, 0)–(2.560, 1.440) respectivamente

#### Scenario: Ventana de 960 × 540
- **GIVEN** el mundo por defecto, una ventana de 960 × 540 y el jugador en (1.920, 1.080)
- **WHEN** se pinta el snapshot
- **THEN** el rectángulo visible es (1.440, 810)–(2.400, 1.350)

#### Scenario: Mundo igual al tope
- **GIVEN** un mundo de 2.560 × 1.440, una ventana de 2.560 × 1.440 y el jugador en (16, 16) y después en
  (2.544, 1.424)
- **WHEN** se pinta cada snapshot
- **THEN** en ambos el rectángulo visible es (0, 0)–(2.560, 1.440)

#### Scenario: Nada fuera del mundo con el mapa real
- **GIVEN** la build de producción con `?e2e&manual&seed=7` (mapa real), una ventana de 1.280 × 720 y la flecha
  derecha mantenida
- **WHEN** se llama a `step(60)` 20 veces, eligiendo la opción 0 si se abre una oferta, y se lee la sonda tras cada
  llamada
- **THEN** en cada lectura el rectángulo visible mide 1.280 × 720, está dentro de (0, 0)–(3.840, 2.160) y cumple la
  fórmula de este requisito con la posición del jugador del snapshot (error ≤ 1 px)

#### Scenario: Partida nueva tras acabar en una esquina
- **GIVEN** una partida terminada ya pintada con el jugador en (3.824, 2.144) y el mapa vacío
- **WHEN** se pulsa R y se pinta el primer frame de la partida nueva (tick ≤ 60, sin input; como en `run-results`)
- **THEN** el rectángulo visible de ese primer frame es (1.280, 720)–(2.560, 1.440)

### Requirement: Elementos de la partida en coordenadas de mundo
La vista SHALL pintar jugador, enemigos, cadáveres, proyectiles, pulsos, recogibles (gemas incluidas), mapa y fondo en
su posición de mundo: un elemento en (x, y) se ve en la ventana en (o_x + x − izquierda, o_y + y − arriba), siendo
(izquierda, arriba) la esquina del rectángulo visible y (o_x, o_y) la posición en la ventana de la esquina superior
izquierda de la vista ((0, 0) si la ventana no supera el tope; si lo supera, la que fije el design), con un error
≤ 1 px. En un recogible, (x, y) es su posición pintada: la del snapshot más su desplazamiento de flote (ver "Flote de los
recogibles" en `sprite-rendering`), o la del snapshot durante su aparición y con aspecto de reserva. Un elemento fuera
del rectángulo visible no se ve en pantalla, pero sigue en el snapshot.

#### Scenario: Enemigo a la derecha del jugador
- **GIVEN** el mundo por defecto, una ventana de 1.280 × 720, el jugador en (1.920, 1.080) y un enemigo en
  (2.160, 1.140)
- **WHEN** se pinta el snapshot
- **THEN** el enemigo se ve en la posición de pantalla (880, 420)

#### Scenario: Jugador junto a una esquina
- **GIVEN** el mundo por defecto, una ventana de 1.280 × 720 y el jugador en (16, 2.144)
- **WHEN** se pinta el snapshot
- **THEN** el jugador se ve en la posición de pantalla (16, 704)

#### Scenario: Ventana mayor que el tope
- **GIVEN** el mundo por defecto, una ventana de 3.840 × 2.160, el jugador en (1.920, 1.080) y un enemigo en
  (1.920 + 1.300, 1.080)
- **WHEN** se pinta el snapshot
- **THEN** el jugador se ve en (o_x + 1.280, o_y + 720) y el enemigo, fuera del rectángulo visible
  (640, 360)–(3.200, 1.800), no se ve en pantalla

#### Scenario: Gema que flota
- **GIVEN** el mundo por defecto, una ventana de 1.280 × 720, el jugador en (1.920, 1.080), unos datos de aspecto con
  A 4, T 1.600 y s 200, y una gema de id 0 en (2.160, 1.140)
- **WHEN** se pinta el snapshot con el reloj de render R = 400
- **THEN** la gema se ve en la posición de pantalla (880, 424) (error ≤ 1 px)

### Requirement: HUD y overlays fijos en pantalla
La vista SHALL pintar el HUD (ver `hud`), el overlay de elección (ver `upgrades`), el de pausa, el de resultados y el
menú de inicio en coordenadas de la ventana: con un mismo tamaño de ventana, su posición y su tamaño en pantalla MUST
ser los mismos sea cual sea el rectángulo visible. Su anclaje a la ventana y su reubicación al redimensionar los fijan
`hud`, `upgrades`, `main-menu` y `run-results`. Sus zonas de clic MUST seguir donde se pintan.

#### Scenario: HUD con la cámara movida
- **GIVEN** el mundo por defecto, una ventana de 1.280 × 720 y dos snapshots con el jugador en (640, 360) y en
  (3.824, 2.144)
- **WHEN** se pinta cada snapshot
- **THEN** la barra de vida, el tiempo restante, la barra de XP, el nivel y las bajas tienen la misma posición y el
  mismo tamaño en pantalla en ambos frames (error ≤ 1 px)

#### Scenario: Overlay de elección con la cámara movida
- **GIVEN** el mundo por defecto, una ventana de 1.280 × 720, el jugador en (3.824, 2.144) y una oferta abierta de 3
  opciones
- **WHEN** se pinta el snapshot y se hace clic en la tercera carta en su posición de pantalla
- **THEN** las 3 cartas están en la misma posición de pantalla que con el jugador en (640, 360)
- **AND** se elige la opción de índice 2

#### Scenario: Resultados y pausa con la cámara movida
- **GIVEN** el mundo por defecto, una ventana de 1.280 × 720 y el jugador en (3.824, 16)
- **WHEN** se pausa con Esc y, en otra partida en la misma posición, termina la partida
- **THEN** el overlay de pausa y el de resultados ocupan la misma posición de pantalla que con el jugador en
  (640, 360), y `Volver al menú` responde al clic en su posición de pantalla

### Requirement: Sonda de cámara para E2E
El sistema SHALL exponer, solo con `?e2e` y como parte de la sonda `window.__sprint`, en el último frame pintado: el
rectángulo visible en coordenadas de mundo (izquierda, arriba, ancho y alto), el tamaño del mundo y el tamaño de
ventana usado en ese frame (ancho y alto en px CSS). En modo menú el rectángulo visible MUST valer `null`. Sin `?e2e`
MUST NOT existir. Leer la sonda MUST NOT cambiar la simulación ni lo que se pinta. Los E2E MUST ejecutarse con una
ventana fija de 1.280 × 720 salvo los que declaren otra o la cambien en el propio escenario.

#### Scenario: Rectángulo coherente con el jugador [E2E]
- **GIVEN** la build de producción con `?e2e&manual&seed=42` en una ventana de 1.280 × 720 y una partida en curso
- **WHEN** se llama a `step(60)` 10 veces, eligiendo la opción 0 si se abre una oferta, y tras cada llamada se leen la
  sonda de cámara y la posición del jugador del snapshot
- **THEN** en cada lectura la ventana vale 1.280 × 720, el ancho y el alto del rectángulo valen 1.280 y 720, el mundo
  vale 3.840 × 2.160 y la esquina superior izquierda cumple la fórmula de "Cámara que sigue al jugador dentro del
  mundo" (error ≤ 1 px)

#### Scenario: Sonda en el menú
- **GIVEN** `?e2e&seed=42` y el menú tras `Volver al menú`
- **WHEN** se pinta 1 frame y se lee la sonda
- **THEN** el rectángulo visible vale `null`, el mundo vale 3.840 × 2.160 y la ventana, 1.280 × 720

#### Scenario: Sin sonda fuera de E2E
- **GIVEN** la URL `?seed=42`
- **WHEN** termina la carga y se pulsa `Jugar`
- **THEN** `window.__sprint` es `undefined`

### Requirement: La cámara no cambia la simulación
La cámara, el tamaño de la ventana y sus cambios SHALL ser solo de presentación: MUST NOT cambiar ningún snapshot, el
orden del tick ni el consumo del `RandomGenerator`. La misma semilla, el mismo contenido y los mismos inputs por tick
MUST producir la misma partida tick a tick en cualquier tamaño de ventana.

#### Scenario: Misma partida con y sin pintar
- **GIVEN** dos partidas con el contenido por defecto, la semilla 7 y los mismos inputs durante 3.600 ticks, una
  pintada por la vista con la cámara y otra sin pintar
- **WHEN** se comparan sus snapshots tick a tick
- **THEN** son iguales

#### Scenario: Misma partida con ventanas distintas
- **GIVEN** tres partidas con el contenido por defecto, la semilla 7, los mismos inputs por tick y la política de
  elección fija, pintadas con una ventana de 960 × 540, otra de 2.560 × 1.440 y la tercera con una ventana que cambia
  cada 60 ticks entre 320 × 180, 1.280 × 720 y 3.840 × 2.160
- **WHEN** se ejecutan 3.600 ticks y se comparan sus snapshots tick a tick
- **THEN** son iguales campo a campo

### Requirement: Vista a ventana completa con tope
Mientras el juego está cargado (menú, partida en curso, en pausa, eligiendo mejora o terminada), el lienzo del juego
SHALL ocupar la ventana entera, sin barras de desplazamiento del documento, a zoom 1: un segmento de L unidades de
mundo MUST medir L px CSS en pantalla (error ≤ 1 px), sea cual sea la densidad de píxeles del dispositivo. El área de
mundo visible en cada frame (la vista) MUST medir V_w × V_h = min(P_w, T_w) × min(P_h, T_h). Si la ventana supera el
tope en algún eje, el espacio de la ventana fuera de la vista MUST NOT mostrar ninguna zona del mundo ni de fuera de
él; cómo se rellena ese espacio no lo fija esta spec. No hay tamaño mínimo de ventana: una ventana menor que
960 × 540 sigue ocupada entera y ve menos mundo. Una ventana con ancho o alto 0 (p. ej. minimizada) MUST NOT producir
errores no capturados ni cambiar la simulación.

#### Scenario: Ventana de las pruebas
- **GIVEN** una ventana de 1.280 × 720 y una partida en curso
- **WHEN** se pinta un frame
- **THEN** el lienzo mide 1.280 × 720 px CSS, el documento no tiene barras de desplazamiento y la vista mide
  1.280 × 720 unidades de mundo

#### Scenario: Ventana igual al tope
- **GIVEN** una ventana de 2.560 × 1.440
- **WHEN** se pinta un frame de una partida
- **THEN** la vista mide 2.560 × 1.440

#### Scenario: Ventana mayor que el tope
- **GIVEN** una ventana de 3.840 × 2.160, y en otro caso de 2.561 × 1.441
- **WHEN** se pinta un frame de una partida
- **THEN** en ambos casos la vista mide 2.560 × 1.440 y ningún píxel de la ventana fuera de la vista muestra mundo

#### Scenario: Ventana mayor que el tope en un solo eje
- **GIVEN** una ventana de 3.000 × 800
- **WHEN** se pinta un frame de una partida
- **THEN** la vista mide 2.560 × 800

#### Scenario: Ventana pequeña
- **GIVEN** una ventana de 800 × 450, y en otro caso de 320 × 180
- **WHEN** se pinta un frame de una partida
- **THEN** la vista mide 800 × 450 y 320 × 180 respectivamente y el lienzo ocupa la ventana entera

#### Scenario: Densidad de píxeles 2
- **GIVEN** una ventana de 1.280 × 720 px CSS con densidad de píxeles 2
- **WHEN** se pinta un frame de una partida
- **THEN** la vista mide 1.280 × 720 unidades de mundo, igual que con densidad 1

#### Scenario: Ventana minimizada
- **GIVEN** una partida en curso en el tick 600 con una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 0 × 0 y después vuelve a 1.280 × 720
- **THEN** no hay errores no capturados y, al volver, la vista mide 1.280 × 720 y cumple "Cámara que sigue al jugador
  dentro del mundo"

### Requirement: Redimensionado de la ventana
El sistema SHALL adaptarse a cada cambio de tamaño de la ventana en cualquier pantalla del juego (menú con o sin el
diálogo de `Borrar datos` o la guía, partida en curso, en pausa, eligiendo mejora y terminada) sin recargar la página.
Desde el primer frame pintado tras el cambio, la vista, el HUD (ver `hud`) y los overlays (ver `upgrades`,
`main-menu`, `menu-guide` y `run-results`) MUST corresponder al tamaño nuevo, con sus zonas de clic donde se pintan.
Redimensionar MUST NOT:
- cambiar el snapshot, el estado de la partida, la pausa, la oferta abierta, la página visible de la guía ni el
  progreso guardado;
- ejecutar ni saltar ticks (con la partida en pausa, eligiendo mejora o terminada no se ejecuta ninguno);
- crear ni reiniciar ninguna partida, ni cerrar el menú, el diálogo, la guía ni ningún overlay;
- dejar elementos duplicados: tras cualquier secuencia de cambios hay exactamente un elemento de cada tipo del HUD y
  de cada overlay visible.

Un cambio a un tamaño igual al actual MUST NOT cambiar nada de lo pintado.

#### Scenario: Redimensionado en mitad de la partida
- **GIVEN** una ventana de 1.280 × 720 y una partida en curso con el jugador en (1.920, 1.080)
- **WHEN** la ventana pasa a 800 × 450 y se pinta el siguiente frame
- **THEN** la vista mide 800 × 450 y su esquina superior izquierda es (1.520, 855)
- **AND** el snapshot es igual campo a campo al de una partida idéntica sin redimensionar en ese mismo tick

#### Scenario: Muchos cambios seguidos
- **GIVEN** una partida en curso con una ventana de 1.280 × 720
- **WHEN** la ventana cambia 50 veces de tamaño en 60 frames, alternando entre 1.280 × 720, 1.000 × 600 y
  2.560 × 1.440, y termina en 1.000 × 600
- **THEN** en el último frame la vista mide 1.000 × 600 y hay exactamente 1 barra de vida, 1 tiempo restante, 1 barra
  de XP, 1 nivel y 1 contador de bajas
- **AND** no hay errores no capturados

#### Scenario: Redimensionado en pausa
- **GIVEN** una partida en pausa en el tick 500
- **WHEN** la ventana pasa de 1.280 × 720 a 1.600 × 900 y el motor informa de 60 frames de 16,667 ms
- **THEN** el snapshot sigue igual campo a campo al del tick 500, la partida sigue en pausa y el overlay de pausa es
  visible con `Reanudar` y `Volver al menú` pulsables en su posición nueva

#### Scenario: Redimensionado con la oferta abierta [E2E]
- **GIVEN** la build de producción con `?e2e&manual&seed=7` en una ventana de 1.280 × 720 y una partida que, tras
  llamadas a `step(60)` sin input, tiene una oferta de 3 opciones abierta en el tick n
- **WHEN** la ventana pasa a 1.000 × 600, se pinta 1 frame, se lee la sonda y se hace clic en el centro de la ventana,
  (500, 300)
- **THEN** la sonda informa de una vista de 1.000 × 600 que cumple la fórmula de "Cámara que sigue al jugador dentro
  del mundo" con la posición del jugador del snapshot (error ≤ 1 px) y de un snapshot todavía en el tick n
- **AND** el clic elige la opción de índice 1 (ver "Overlay de elección en la ventana" en `upgrades`)

#### Scenario: Redimensionado en el menú y con resultados
- **GIVEN** el menú de inicio, y en otra carga una partida terminada con el overlay de resultados visible, con una
  ventana de 1.280 × 720
- **WHEN** la ventana pasa a 960 × 540 y se pintan 60 frames
- **THEN** el menú sigue visible con sus cinco opciones (o el overlay de resultados con sus botones), centrado en la
  ventana nueva, y no existe ninguna partida nueva

#### Scenario: Mismo tamaño
- **GIVEN** una partida en curso con una ventana de 1.280 × 720
- **WHEN** se notifica un cambio de tamaño a 1.280 × 720
- **THEN** la vista, el HUD y los overlays tienen la misma posición y tamaño en pantalla que antes (error ≤ 1 px)

#### Scenario: Redimensionado con la guía abierta
- **GIVEN** el menú de inicio con la guía abierta en la página 6 y una ventana de 1.280 × 720
- **WHEN** la ventana cambia 10 veces de tamaño, alternando entre 960 × 540 y 2.560 × 1.440, termina en 960 × 540 y
  se pintan 60 frames
- **THEN** hay exactamente 1 guía visible, con el indicador `6 de 7`, centrada en x = 480 (error ≤ 1 px), y no existe
  ninguna partida

<!-- historial: 0013-world-camera (2026-11-23) -->
<!-- historial: 0015-procedural-map (2026-11-23) -->
<!-- historial: 0017-fullscreen-view (2026-11-24) -->
<!-- historial: 0028-menu-guide (2026-11-25) -->
<!-- historial: 0030-pickup-visibility (2026-11-26) -->
