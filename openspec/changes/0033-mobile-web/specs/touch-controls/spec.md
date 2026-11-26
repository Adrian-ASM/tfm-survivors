# Spec delta · touch-controls

<!-- Ruta: openspec/changes/0033-mobile-web/specs/touch-controls/spec.md
     Capacidad nueva. Todo lo de esta spec existe solo en modo móvil (ver "Activación del modo móvil" en
     `mobile-display`); sin modo móvil no hay ningún control táctil. Los escenarios usan, salvo que digan otra cosa,
     el modo móvil, una ventana de 844 × 390 px CSS con pantalla táctil y un contenido de escenario con radio del
     joystick R = 60 px CSS, zona muerta z = 0,2 (12 px) y fracción de la zona de arrastre 0,5. Las distancias del
     dedo se miden en px CSS. -->

## ADDED Requirements

### Requirement: Joystick flotante en la zona de arrastre
En modo móvil, con la partida en curso y sin pausa, oferta, tienda, obra ni aviso de orientación, el sistema SHALL
crear un joystick cuando un dedo se apoya en la zona de arrastre (la parte izquierda del lienzo de ancho
fracción × ancho del lienzo, 0,5 por defecto) sobre un punto que no es un objeto interactivo. Su centro c es el punto
donde se apoyó el dedo y no se mueve mientras el dedo siga apoyado, aunque el dedo salga de la zona de arrastre. Con el
dedo en p y d = p − c, el joystick da un `PlayerInput` de dirección d / |d| y módulo
m = clamp((|d| − z × R) / (R − z × R), 0, 1): m = 0 (input (0, 0)) si |d| ≤ z × R y m = 1 si |d| ≥ R. Un dedo que se
apoya fuera de la zona de arrastre MUST NOT crear joystick ni mover al jugador. Al levantar el dedo (o al cancelarse el
toque), el input del joystick vuelve a (0, 0) desde la siguiente lectura y el jugador se para. El joystick se pinta
mientras está activo, en posición de pantalla (no se desplaza con la cámara). El input se lee cuando se lee el del
teclado: en tiempo real, una vez por frame; en modo manual, una vez al empezar cada `step(n)` (ver "Avance manual con
step" en `simulation-loop`), así que el dedo tiene que seguir apoyado mientras dura la llamada. El joystick MUST NOT
consumir azar ni cambiar el núcleo.

#### Scenario: Vector a media distancia
- **GIVEN** una partida en curso y un dedo apoyado en (200, 250) px CSS, dentro de la zona de arrastre
- **WHEN** el dedo se mueve a (230, 250) y se lee el input
- **THEN** el input vale (0,375, 0) (error ≤ 0,001)

#### Scenario: Vector en diagonal
- **GIVEN** un joystick con centro en (200, 250)
- **WHEN** el dedo se mueve a (230, 290) (|d| = 50) y se lee el input
- **THEN** el input vale (0,475, 0,6333) (error ≤ 0,001)

#### Scenario: Zona muerta y su borde
- **GIVEN** un joystick con centro en (200, 250)
- **WHEN** el dedo se mueve, en lecturas sucesivas, a (205, 250), (212, 250) y (212,5, 250)
- **THEN** el input vale (0, 0), (0, 0) y (0,0104, 0) (error ≤ 0,001) respectivamente

#### Scenario: Saturación en el radio y más allá
- **GIVEN** un joystick con centro en (200, 250)
- **WHEN** el dedo se mueve a (260, 250) y después a (200, 50)
- **THEN** el input vale (1, 0) y después (0, −1) (error ≤ 0,001), con módulo nunca > 1

#### Scenario: El dedo cruza la mitad del lienzo
- **GIVEN** un joystick con centro en (400, 200) (la zona de arrastre acaba en x = 422)
- **WHEN** el dedo se mueve a (600, 200) sin levantarse
- **THEN** el joystick sigue activo con el mismo centro y el input vale (1, 0)

#### Scenario: Toque fuera de la zona de arrastre
- **GIVEN** una partida en curso con el jugador en P
- **WHEN** un dedo se apoya en (600, 200), se arrastra hasta (300, 200) y se mantiene durante 60 frames de 16,667 ms
- **THEN** no se crea joystick, el input leído es (0, 0) en todos esos frames y el jugador sigue en P si ningún otro
  efecto lo mueve

#### Scenario: Soltar para el jugador
- **GIVEN** un joystick que da (1, 0) y el jugador moviéndose a la derecha
- **WHEN** se levanta el dedo y el motor informa de 1 frame de 16,667 ms
- **THEN** el input de ese frame es (0, 0) y el jugador no cambia de posición en ese tick

#### Scenario: Toque cancelado
- **GIVEN** un joystick que da (1, 0)
- **WHEN** el navegador cancela el toque y se lee el input
- **THEN** el input vale (0, 0) y no hay joystick activo

#### Scenario: Arrastre que mueve al jugador [E2E]
- **GIVEN** la build de producción con `?e2e&manual&mobile=1&seed=42` (mapa vacío de los E2E), una ventana de
  844 × 390 con pantalla táctil y la partida en curso con el jugador en (x0, y0)
- **WHEN** un dedo se apoya en la mitad izquierda del lienzo, se arrastra 100 px hacia la derecha, se mantiene apoyado
  durante `step(60)` y se suelta
- **THEN** `step(60)` devuelve 60 (si no se abre oferta ni termina) y el jugador del snapshot tiene x > x0 e y = y0
  (error ≤ 0,001)
- **AND** no hay errores no capturados

### Requirement: Joystick fuera de las pantallas que lo bloquean
El sistema SHALL ignorar el joystick en el menú de inicio, con la guía o el diálogo de `Borrar datos`, en pausa,
eligiendo mejora, en tienda, en obra, con la partida terminada y con el aviso de orientación visible: un dedo apoyado
en esas pantallas MUST NOT crear joystick, y un toque sobre un objeto interactivo del lienzo (las cartas) MUST NOT
crearlo nunca. Si un joystick está activo cuando se abre cualquiera de ellas, se suelta (input (0, 0)) en ese mismo
frame y MUST NOT reactivarse al cerrarse aunque el dedo siga apoyado: hace falta un toque nuevo.

#### Scenario: Oferta con el joystick activo
- **GIVEN** un joystick que da (1, 0) y una partida cuya oferta se abre en el tick n
- **WHEN** se elige la opción de índice 0 tocando su carta con otro dedo, mientras el primero sigue apoyado, y el motor
  informa de 60 frames de 16,667 ms
- **THEN** en esos 60 ticks el input leído es (0, 0) y el jugador no se mueve por el joystick
- **AND** tras levantar el primer dedo y apoyar uno nuevo en la zona de arrastre, el joystick vuelve a dar input

#### Scenario: Toque en una carta de la zona de arrastre
- **GIVEN** una oferta de 3 opciones abierta, con la carta de índice 0 en la mitad izquierda
- **WHEN** se toca el centro de esa carta
- **THEN** se elige la opción de índice 0 y no se crea joystick

#### Scenario: Pantallas que bloquean el joystick
- **GIVEN** en casos distintos el menú, la pausa, la tienda abierta, el panel de obra abierto y la partida terminada
- **WHEN** un dedo se apoya en (200, 250), se arrastra a (260, 250) y se mantiene 60 frames
- **THEN** no se crea joystick y, en las pantallas con partida, el snapshot no recibe ningún input no nulo del joystick

#### Scenario: Reanudar con el dedo apoyado
- **GIVEN** un joystick activo y la partida puesta en pausa con ⏸ desde otro dedo
- **WHEN** se reanuda con ⏸ manteniendo el primer dedo apoyado y el motor informa de 30 frames de 16,667 ms
- **THEN** el input leído es (0, 0) en esos 30 frames

### Requirement: Multitoque
El sistema SHALL atender varios dedos a la vez: con un joystick activo, otro dedo MUST poder tocar las cartas, la barra
táctil y los botones de los paneles con su efecto normal, sin mover ni soltar el joystick. Solo el dedo que creó el
joystick lo controla: un segundo dedo que se apoya en la zona de arrastre con el joystick activo MUST NOT crear otro
joystick ni cambiar su centro ni su input.

#### Scenario: Pausar sin soltar el joystick
- **GIVEN** una partida en curso y un joystick que da (1, 0)
- **WHEN** un segundo dedo toca ⏸
- **THEN** la partida queda en pausa con el overlay de pausa visible (y el joystick se suelta por "Joystick fuera de
  las pantallas que lo bloquean")

#### Scenario: Segundo dedo en la zona de arrastre
- **GIVEN** un joystick con centro en (200, 250) y el dedo en (230, 250), input (0,375, 0)
- **WHEN** un segundo dedo se apoya en (100, 100) y se arrastra a (40, 100)
- **THEN** el input sigue valiendo (0,375, 0) y el centro sigue en (200, 250)
- **AND** al levantar el primer dedo el input vale (0, 0) aunque el segundo siga apoyado

### Requirement: Precedencia del teclado
Con el modo móvil, el teclado SHALL seguir funcionando como en escritorio (movimiento, Esc, R, 1, 2 y 3). Si en una
lectura del input hay alguna tecla de movimiento pulsada, el `PlayerInput` es el del teclado y el joystick se ignora en
esa lectura; si no, es el del joystick (o (0, 0) sin joystick).

#### Scenario: Teclado y joystick a la vez
- **GIVEN** un joystick que da (0, 1) y la flecha derecha pulsada
- **WHEN** se lee el input
- **THEN** vale (1, 0)
- **AND** al soltar la flecha, la siguiente lectura vale (0, 1)

#### Scenario: Teclado solo
- **GIVEN** ningún dedo apoyado y las teclas W y D pulsadas
- **WHEN** se lee el input
- **THEN** es el mismo que sin modo móvil con esas teclas

### Requirement: Indicación en reposo
En modo móvil, el sistema SHALL mostrar al empezar cada partida una indicación en reposo: un joystick tenue en la zona
de arrastre con el texto en reposo del contenido (`Arrastra aquí para moverte` por defecto). Se ve mientras la partida
está en curso sin pausa, oferta, tienda, obra ni aviso de orientación, hasta el primer input no nulo de la partida
(del joystick o del teclado), y desde el frame siguiente MUST NOT volver a verse en esa partida. Cada partida nueva
(tras R, tras ↻ y tras `Volver al menú` + `Jugar`) la muestra de nuevo. La indicación MUST NOT impedir que un toque
sobre ella cree el joystick. Sin modo móvil no existe.

#### Scenario: Indicación al empezar
- **GIVEN** la URL `?e2e&manual&mobile=1&seed=42` y la partida recién arrancada en el tick 0
- **WHEN** se pinta 1 frame
- **THEN** la indicación en reposo es visible con el texto `Arrastra aquí para moverte`

#### Scenario: Desaparece con el primer movimiento
- **GIVEN** una partida con la indicación visible
- **WHEN** un dedo crea un joystick sobre la indicación, da un input no nulo, se suelta y se pintan 60 frames
- **THEN** desde el frame siguiente al primer input no nulo la indicación no es visible en ningún frame

#### Scenario: Toque en la zona muerta no la quita
- **GIVEN** una partida con la indicación visible
- **WHEN** un dedo se apoya, se mueve 5 px y se suelta
- **THEN** la indicación sigue visible

#### Scenario: Vuelve en cada partida nueva
- **GIVEN** una partida en la que la indicación ya desapareció y que termina con derrota
- **WHEN** se toca ↻ y se pinta 1 frame, y en otra carga se pausa, se pulsa `Volver al menú`, `Jugar` y se pinta
  1 frame
- **THEN** en ambos casos la indicación es visible en la partida nueva

### Requirement: Barra táctil
En modo móvil, el sistema SHALL mostrar una barra de botones DOM en la esquina inferior derecha de la ventana, con
iconos de imagen (no glifos de texto) y estos botones:
- ⏸ visible si y solo si existe una partida no terminada (en curso, en pausa, eligiendo mejora, en tienda o en obra);
  cada toque equivale a **una** pulsación de Esc (ver "Pausa con Esc" en `main-menu`): pausa y reanuda, sale de la
  tienda y de la obra sin abrir la pausa y no tiene efecto eligiendo mejora;
- ↻ visible si y solo si la partida está terminada; cada toque equivale a **una** pulsación de R (ver "Reinicio con la
  tecla R" en `run-results`);
- ⛶ visible si y solo si el navegador ofrece la API de pantalla completa, en el menú y con partida (ver "Pantalla
  completa y orientación").

Un toque de ⏸ y una pulsación de Esc en el mismo frame cuentan como una sola pulsación (lo mismo ↻ y R). Cada botón
MUST medir ≥ 44 × 44 px CSS y quedar dentro de la ventana fuera de las zonas seguras del dispositivo (los márgenes
`safe-area-inset` derecho e inferior). La barra MUST NOT tapar ningún botón de los paneles DOM ni ninguna carta: el
toque en el centro de cada uno llega a ese botón o carta. Con el aviso de orientación visible, la barra no es
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

#### Scenario: Barra en el menú
- **GIVEN** el menú de inicio en un navegador con API de pantalla completa y, en otra carga, sin ella
- **WHEN** se pinta 1 frame
- **THEN** ⏸ y ↻ no son visibles; ⛶ es visible en la primera carga y no existe en la segunda

#### Scenario: Tamaño y zonas seguras
- **GIVEN** un dispositivo con márgenes seguros de 47 px a la derecha y 21 px abajo
- **WHEN** se muestra la barra con ⏸ y ⛶ visibles
- **THEN** cada botón mide ≥ 44 × 44 px CSS, su borde derecho está a ≥ 47 px del borde derecho de la ventana y su
  borde inferior a ≥ 21 px del borde inferior

#### Scenario: La barra no tapa los paneles
- **GIVEN** una ventana de 844 × 390 y, en casos distintos, la pausa, la tienda, el panel de obra, los resultados, el
  menú y una oferta de 3 opciones
- **WHEN** se toca el centro de cada botón visible del panel (tras desplazarlo si hace falta) y de cada carta
- **THEN** cada toque llega a ese botón o carta y no a la barra

### Requirement: Pantalla completa y orientación
Al tocar ⛶ fuera de pantalla completa, el sistema SHALL pedir la pantalla completa del documento y, si se concede,
intentar bloquear la orientación en horizontal. Al tocarlo en pantalla completa, MUST salir de ella. El bloqueo de
orientación es *best effort*: si no existe, se rechaza o lanza un error, y si se rechaza la pantalla completa, MUST NOT
haber errores no capturados ni cambiar el estado de la partida, la pausa ni el menú. Sin API de pantalla completa (p. ej.
iPhone) el botón no existe. Entrar y salir de pantalla completa cambia el tamaño de la ventana y sigue "Redimensionado
de la ventana" (`world-camera`) y "Tamaño lógico del lienzo en modo móvil" (`mobile-display`).

#### Scenario: Entrar en pantalla completa
- **GIVEN** un navegador con API de pantalla completa y bloqueo de orientación, y una partida en curso
- **WHEN** se toca ⛶
- **THEN** se pide la pantalla completa exactamente 1 vez y, tras concederse, se pide el bloqueo en horizontal
  exactamente 1 vez
- **AND** el estado de la partida no cambia por el toque

#### Scenario: Bloqueo rechazado o ausente
- **GIVEN** un navegador con API de pantalla completa cuyo bloqueo de orientación se rechaza y, en otro caso, no existe
- **WHEN** se toca ⛶
- **THEN** la página entra en pantalla completa, no hay errores no capturados y la partida sigue en el mismo estado

#### Scenario: Pantalla completa rechazada
- **GIVEN** un navegador cuya petición de pantalla completa se rechaza
- **WHEN** se toca ⛶ en el menú
- **THEN** no se pide el bloqueo de orientación, no hay errores no capturados y el menú sigue operativo

#### Scenario: Salir de pantalla completa
- **GIVEN** la página en pantalla completa y una partida en pausa en el tick 500
- **WHEN** se toca ⛶
- **THEN** la página sale de pantalla completa, la partida sigue en pausa en el tick 500 y el overlay de pausa es
  visible en la ventana nueva

### Requirement: Aviso de orientación vertical
En modo móvil, mientras la ventana está en vertical (P_h > P_w), el sistema SHALL mostrar un aviso a pantalla
completa con el texto `Gira el móvil` que tapa el juego y los paneles. El aviso es una **pausa externa**, distinta de
la pausa del jugador: mientras se ve, no se ejecuta ningún tick ni se acumula tiempo (en tiempo real y con
`step(n)`, ver `simulation-loop`), no se abre el overlay de pausa y el joystick se suelta. En modo manual
(`?e2e&manual`, 0014), el reloj de render solo avanza n × `TICK_MS` con cada `step(n)`; como `step(n)` devuelve 0
con el aviso, ese reloj no avanza. Al volver a horizontal (P_w ≥ P_h), el aviso desaparece desde el primer frame
pintado tras el cambio y la partida vuelve exactamente al estado en que estaba: en curso y sin pausa, en pausa con su
overlay, eligiendo mejora con la misma oferta, en tienda, en obra o terminada, sin ráfaga de ticks por el tiempo
pasado en vertical. En el menú, la guía o el diálogo de `Borrar datos`, el aviso también se ve y al volver siguen
abiertos en el mismo estado. El teclado conserva sus efectos con el aviso visible (Esc cambia la pausa del jugador, R
reinicia una partida terminada), pero sin ejecutar ticks hasta volver a horizontal. Una ventana cuadrada (P_w = P_h)
no muestra el aviso. Sin modo móvil no existe, sea cual sea la forma de la ventana.

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

#### Scenario: Aviso en el menú
- **GIVEN** el menú de inicio con la guía abierta en la página 3
- **WHEN** la ventana pasa a 390 × 844 y vuelve a 844 × 390
- **THEN** mientras está en vertical el aviso es visible; al volver, la guía sigue abierta con el indicador `3 de 7` y
  no existe ninguna partida

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
