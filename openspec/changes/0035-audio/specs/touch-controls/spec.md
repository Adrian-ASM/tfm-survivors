# Spec delta · touch-controls

<!-- Change 0035-audio. Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test.
     Cambios: botón de silencio en la barra táctil (equivale a una pulsación de M, ver "Tecla M" en `audio`), la tecla
     M en la precedencia del teclado y en el aviso de orientación, la música en pausa con el aviso y el panel `Sonido`
     entre los paneles que la barra no tapa y que siguen abiertos tras girar. Al archivar, el Purpose de la spec viva
     debe citar el botón de silencio. Convenciones de escenario de la spec viva sin cambios (844 × 390, R = 60…). -->

## ADDED Requirements
<!-- Ninguno. -->

## MODIFIED Requirements

### Requirement: Precedencia del teclado
Con el modo móvil, el teclado SHALL seguir funcionando como en escritorio (movimiento, Esc, R, M, 1, 2 y 3). Si en una
lectura del input hay alguna tecla de movimiento pulsada, el `PlayerInput` es el del teclado y el joystick se ignora en
esa lectura; si no, es el del joystick (o (0, 0) sin joystick). M no es tecla de movimiento.

#### Scenario: Teclado y joystick a la vez
- **GIVEN** un joystick que da (0, 1) y la flecha derecha pulsada
- **WHEN** se lee el input
- **THEN** vale (1, 0)
- **AND** al soltar la flecha, la siguiente lectura vale (0, 1)

#### Scenario: Teclado solo
- **GIVEN** ningún dedo apoyado y las teclas W y D pulsadas
- **WHEN** se lee el input
- **THEN** es el mismo que sin modo móvil con esas teclas

#### Scenario: M con el joystick activo
- **GIVEN** un joystick que da (1, 0) y sin silencio
- **WHEN** se pulsa M y se lee el input
- **THEN** el input vale (1, 0) y el silencio está activado

### Requirement: Barra táctil
En modo móvil, el sistema SHALL mostrar una barra de botones DOM en la esquina inferior derecha de la ventana, con
iconos de imagen (no glifos de texto) y estos botones:
- ⏸ visible si y solo si existe una partida no terminada (en curso, en pausa, eligiendo mejora, en tienda o en obra);
  cada toque equivale a **una** pulsación de Esc (ver "Pausa con Esc" en `main-menu`): pausa y reanuda, sale de la
  tienda y de la obra sin abrir la pausa, cierra el panel `Sonido` sin quitar la pausa y no tiene efecto eligiendo
  mejora;
- ↻ visible si y solo si la partida está terminada; cada toque equivale a **una** pulsación de R (ver "Reinicio con la
  tecla R" en `run-results`);
- silencio, visible siempre en modo móvil (en el menú y con partida, en cualquier estado); cada toque equivale a
  **una** pulsación de M (ver "Tecla M" en `audio`). Su icono y su etiqueta accesible indican el estado: sin silencio,
  icono de altavoz y etiqueta `Silenciar`; con silencio, icono de altavoz tachado y etiqueta `Activar sonido`; su
  atributo `aria-pressed` vale `true` si y solo si el silencio está activado;
- ⛶ visible si y solo si el navegador ofrece la API de pantalla completa, en el menú y con partida (ver "Pantalla
  completa y orientación").

Un toque de ⏸ y una pulsación de Esc en el mismo frame cuentan como una sola pulsación (lo mismo ↻ y R, y silencio y
M). Cada botón MUST medir ≥ 44 × 44 px CSS y quedar dentro de la ventana fuera de las zonas seguras del dispositivo (los
márgenes `safe-area-inset` derecho e inferior). La barra MUST NOT tapar ningún botón de los paneles DOM ni ninguna
carta: el toque en el centro de cada uno llega a ese botón o carta. Con el aviso de orientación visible, la barra no es
alcanzable. Sin modo móvil la barra no existe.

#### Scenario: Pausar y reanudar con ⏸
- **GIVEN** una partida en curso en el tick 500 con ⏸ visible y ↻ oculto
- **WHEN** se toca ⏸, el motor informa de 300 frames de 16,667 ms, se toca ⏸ otra vez y el motor informa de 1 frame
- **THEN** durante los 300 frames el overlay de pausa es visible y el snapshot sigue en el tick 500
- **AND** tras el segundo toque el overlay no es visible y el snapshot tiene tick 501

#### Scenario: ⏸ en la tienda y en la obra
- **GIVEN** una partida en tienda y, en otro caso, en obra con el solar en `free`
- **WHEN** se toca ⏸ una vez
- **THEN** el overlay de la tienda (o el panel de obra) deja de verse, la pausa no se ha visto, el solar sigue en
  `free` y la partida está en curso sin pausa
- **AND** un segundo toque de ⏸ pone la partida en pausa

#### Scenario: ⏸ con el panel Sonido abierto
- **GIVEN** una partida en pausa en el tick 500 con el panel `Sonido` abierto
- **WHEN** se toca ⏸ una vez
- **THEN** el panel no es visible, el overlay de pausa sí y el snapshot sigue en el tick 500

#### Scenario: ⏸ eligiendo mejora
- **GIVEN** una partida eligiendo mejora en el tick n
- **WHEN** se toca ⏸
- **THEN** la oferta sigue abierta, la pausa no se ha visto y el snapshot sigue en el tick n

#### Scenario: ⏸ y Esc en el mismo frame
- **GIVEN** una partida en curso sin pausa
- **WHEN** se toca ⏸ y se pulsa Esc en el mismo frame
- **THEN** la partida queda en pausa (un único cambio)

#### Scenario: Reiniciar con ↻
- **GIVEN** una partida terminada con derrota, el overlay de resultados visible, ↻ visible y ⏸ oculto
- **WHEN** se toca ↻ dos veces seguidas y el motor informa de 60 frames de 16,667 ms
- **THEN** se ha creado exactamente 1 partida nueva, en curso y con tick ≥ 45, el overlay de resultados no es visible,
  ↻ está oculto y ⏸ visible

#### Scenario: Silenciar con la barra
- **GIVEN** una partida en curso en el tick 500, sin silencio, con el botón de silencio con etiqueta `Silenciar` y
  `aria-pressed` `false`
- **WHEN** se toca el botón de silencio, el motor informa de 1 frame de 16,667 ms y se vuelve a tocar
- **THEN** tras el primer toque el silencio está activado, la etiqueta es `Activar sonido`, `aria-pressed` vale `true`
  y el snapshot tiene tick 501 (la partida no se ha pausado)
- **AND** tras el segundo el silencio está desactivado y la etiqueta vuelve a ser `Silenciar`

#### Scenario: Silencio y M en el mismo frame
- **GIVEN** una partida en curso sin silencio
- **WHEN** se toca el botón de silencio y se pulsa M en el mismo frame
- **THEN** el silencio está activado (un único cambio) y se ha escrito 1 vez

#### Scenario: Barra en el menú
- **GIVEN** el menú de inicio en un navegador con API de pantalla completa y, en otra carga, sin ella
- **WHEN** se pinta 1 frame
- **THEN** ⏸ y ↻ no son visibles; el botón de silencio es visible en las dos cargas; ⛶ es visible en la primera
  carga y no existe en la segunda

#### Scenario: Tamaño y zonas seguras
- **GIVEN** un dispositivo con márgenes seguros de 47 px a la derecha y 21 px abajo
- **WHEN** se muestra la barra con ⏸, silencio y ⛶ visibles
- **THEN** cada botón mide ≥ 44 × 44 px CSS, su borde derecho está a ≥ 47 px del borde derecho de la ventana y su
  borde inferior a ≥ 21 px del borde inferior

#### Scenario: La barra no tapa los paneles
- **GIVEN** una ventana de 844 × 390 y, en casos distintos, la pausa, el panel `Sonido`, la tienda, el panel de obra,
  los resultados, el menú y una oferta de 3 opciones
- **WHEN** se toca el centro de cada botón, deslizador y casilla visibles del panel (tras desplazarlo si hace falta) y
  de cada carta
- **THEN** cada toque llega a ese control o carta y no a la barra

### Requirement: Aviso de orientación vertical
En modo móvil, mientras la ventana está en vertical (P_h > P_w), el sistema SHALL mostrar un aviso a pantalla
completa con el texto `Gira el móvil` que tapa el juego y los paneles. El aviso es una **pausa externa**, distinta de
la pausa del jugador: mientras se ve, no se ejecuta ningún tick ni se acumula tiempo (en tiempo real y con
`step(n)`, ver `simulation-loop`), no se abre el overlay de pausa, el joystick se suelta y la música está en pausa
(ver "El audio se detiene con la pausa, la retención y la pestaña oculta" en `audio`). En modo manual
(`?e2e&manual`, 0014), el reloj de render solo avanza n × `TICK_MS` con cada `step(n)`; como `step(n)` devuelve 0
con el aviso, ese reloj no avanza. Al volver a horizontal (P_w ≥ P_h), el aviso desaparece desde el primer frame
pintado tras el cambio y la partida vuelve exactamente al estado en que estaba: en curso y sin pausa, en pausa con su
overlay, eligiendo mejora con la misma oferta, en tienda, en obra o terminada, sin ráfaga de ticks por el tiempo
pasado en vertical; la música vuelve a sonar si ese estado no la pausa. En el menú, la guía, el diálogo de `Borrar
datos` o el panel `Sonido`, el aviso también se ve y al volver siguen abiertos en el mismo estado. El teclado conserva
sus efectos con el aviso visible (Esc cambia la pausa del jugador, R reinicia una partida terminada, M conmuta el
silencio), pero sin ejecutar ticks hasta volver a horizontal. Una ventana cuadrada (P_w = P_h) no muestra el aviso.
Sin modo móvil no existe, sea cual sea la forma de la ventana.

#### Scenario: Girar en mitad de la partida
- **GIVEN** una partida en curso en el tick 500 con la ventana en 844 × 390
- **WHEN** la ventana pasa a 390 × 844, el motor informa de 300 frames de 16,667 ms y de 1 frame de 5.000 ms
- **THEN** el aviso `Gira el móvil` es visible, el overlay de pausa no se ha visto, se ejecutan 0 ticks y el snapshot
  sigue igual campo a campo al del tick 500
- **AND** al volver a 844 × 390 el aviso deja de verse y el primer frame de 16,667 ms ejecuta exactamente 1 tick
  (tick 501)

#### Scenario: Girar con la partida en pausa
- **GIVEN** una partida en pausa en el tick 500 con el overlay de pausa visible
- **WHEN** la ventana pasa a 390 × 844 y después a 844 × 390, y el motor informa de 60 frames de 16,667 ms
- **THEN** la partida sigue en pausa en el tick 500 con el overlay de pausa visible
- **AND** tras tocar `Reanudar` y 1 frame de 16,667 ms el snapshot tiene tick 501

#### Scenario: Girar con la oferta, la tienda o la obra abiertas
- **GIVEN** en casos distintos una oferta de 3 opciones abierta en el tick n, la tienda abierta y el panel de obra
  abierto
- **WHEN** la ventana pasa a 390 × 844, se pintan 60 frames y vuelve a 844 × 390
- **THEN** la oferta (con las mismas opciones), la tienda o el panel de obra siguen abiertos, el snapshot sigue en el
  tick n y la pausa no se ha visto
- **AND** en el caso de la oferta, tocar la carta de índice 1 elige la opción de índice 1

#### Scenario: Joystick activo al girar
- **GIVEN** un joystick que da (1, 0)
- **WHEN** la ventana pasa a 390 × 844 y vuelve a 844 × 390 con el dedo apoyado, y el motor informa de 30 frames
- **THEN** el input leído es (0, 0) en esos 30 frames, hasta un toque nuevo

#### Scenario: Esc con el aviso visible
- **GIVEN** una partida en curso en el tick 500 con el aviso visible
- **WHEN** se pulsa Esc, se pintan 60 frames y la ventana vuelve a 844 × 390
- **THEN** no se ejecuta ningún tick, y al volver la partida está en pausa con el overlay de pausa visible

#### Scenario: M con el aviso visible
- **GIVEN** una partida en curso en el tick 500 con el aviso visible, sin silencio
- **WHEN** se pulsa M y la ventana vuelve a 844 × 390
- **THEN** el silencio está activado, no se ha ejecutado ningún tick y la partida sigue en curso sin pausa

#### Scenario: Aviso en el menú
- **GIVEN** el menú de inicio con la guía abierta en la página 3 y, en otra carga, con el panel `Sonido` abierto con
  música 30
- **WHEN** la ventana pasa a 390 × 844 y vuelve a 844 × 390
- **THEN** mientras está en vertical el aviso es visible; al volver, la guía sigue abierta con el indicador `3 de 7`
  (o el panel `Sonido` sigue abierto mostrando `30 %`) y no existe ninguna partida

#### Scenario: Ventana cuadrada
- **GIVEN** una partida en curso con la ventana en 500 × 500
- **WHEN** el motor informa de 1 frame de 16,667 ms
- **THEN** el aviso no es visible y se ejecuta 1 tick

#### Scenario: Aviso que detiene step [E2E]
- **GIVEN** la build de producción con `?e2e&manual&mobile=1&seed=42`, una ventana de 844 × 390 con pantalla táctil y
  una partida en curso en el tick n que no abre oferta ni termina en los próximos 60 ticks
- **WHEN** la ventana pasa a 390 × 844, se llama a `step(60)`, la ventana vuelve a 844 × 390 y se llama a `step(60)`
- **THEN** con la ventana en vertical el aviso es visible, el primer `step(60)` devuelve 0 y el snapshot sigue en el
  tick n
- **AND** con la ventana en horizontal el aviso no es visible y el segundo `step(60)` devuelve 60 (tick n + 60), sin
  errores no capturados

## REMOVED Requirements
<!-- Ninguno. -->
