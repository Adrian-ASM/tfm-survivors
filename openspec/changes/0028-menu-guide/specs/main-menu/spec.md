# Spec delta · main-menu

> Cambios de cabecera al archivar (change 0028):
> - **Purpose**: "El menú de inicio (Jugar, Cómo jugar, Exportar, Importar, Borrar datos), …" (resto igual).
> - **Convenciones**: las etiquetas visibles exactas pasan a ser `Jugar`, `Cómo jugar`, `Exportar`, `Importar`,
>   `Borrar datos`, `Confirmar`, `Cancelar`, `Reanudar` y `Volver al menú`. "La guía" es el modal de `Cómo jugar`
>   (ver `menu-guide`).

## ADDED Requirements

(ninguno; la guía se especifica en `menu-guide`)

## MODIFIED Requirements

### Requirement: Menú de inicio al cargar
El sistema SHALL mostrar, al cargar la página sin `?e2e`, un menú de inicio con exactamente cinco opciones
visibles y pulsables con el ratón, en este orden: `Jugar`, `Cómo jugar`, `Exportar`, `Importar` y `Borrar datos`. En
modo menú MUST NOT existir ninguna partida: no se ejecuta ningún tick, no se ve el HUD, ni el overlay de elección, ni
el de resultados, ni el de pausa, ni ningún sprite de jugador, enemigo, proyectil, pulso o gema. En modo menú con la
guía cerrada, las teclas Esc, R, 1, 2 y 3, las flechas izquierda y derecha y el input de movimiento MUST NOT tener
efecto. Con la guía abierta, Esc y las flechas solo actúan sobre la guía y R, 1, 2, 3 y el input de movimiento siguen
sin efecto (ver "Cerrar la guía" y "Teclado en la guía" en `menu-guide`).

#### Scenario: Carga sin parámetros
- **GIVEN** la build de producción servida sin parámetros en la URL
- **WHEN** termina la carga y se pintan 300 frames sin pulsar nada
- **THEN** el menú de inicio es visible con exactamente 5 botones, `Jugar`, `Cómo jugar`, `Exportar`, `Importar` y
  `Borrar datos`, en ese orden de arriba abajo
- **AND** el HUD, el overlay de resultados, el overlay de pausa y la guía no son visibles

#### Scenario: Carga con semilla y sin e2e
- **GIVEN** la URL `?seed=42`
- **WHEN** termina la carga
- **THEN** el menú de inicio es visible y no ha empezado ninguna partida

#### Scenario: Teclas sin efecto en el menú
- **GIVEN** el modo menú con la guía cerrada
- **WHEN** se pulsan Esc, R, 1, 2 y 3, flecha izquierda y flecha derecha y se mantiene el input (1, 1) durante
  60 frames
- **THEN** el menú sigue visible, no ha empezado ninguna partida y ni el overlay de pausa ni la guía son visibles

#### Scenario: El progreso guardado no cambia al cargar el menú
- **GIVEN** un progreso válido G guardado en `localStorage`
- **WHEN** se carga la página sin `?e2e` y se pintan 300 frames en el menú
- **THEN** el valor guardado sigue siendo G byte a byte

### Requirement: Arranque directo con e2e
El sistema SHALL, cuando la URL incluye `?e2e`, saltarse el menú de inicio al cargar y empezar directamente la
primera partida, con el mismo comportamiento observable que antes de este change: la partida existe desde la carga,
la sonda `window.__sprint` está disponible y la semilla y la velocidad se resuelven como hasta ahora (ver
`simulation-loop`). El bypass solo afecta a la carga: con `?e2e`, `Volver al menú` muestra el menú de inicio igual
que sin `?e2e`, con la guía cerrada. Sin `?e2e`, la sonda `window.__sprint` MUST NOT existir.

#### Scenario: Carga en modo E2E
- **GIVEN** la URL `?e2e&seed=42`
- **WHEN** termina la carga y el motor informa de 15 frames de 16,667 ms
- **THEN** el menú de inicio no se ha visto en ningún frame
- **AND** la sonda informa de semilla 42, estado en curso y tick 15

#### Scenario: Modo E2E con velocidad
- **GIVEN** la URL `?e2e&seed=42&speed=8`
- **WHEN** termina la carga y el motor informa de 1 frame de 16,667 ms
- **THEN** la sonda informa de tick 8 y el menú de inicio no es visible

#### Scenario: Menú tras Volver al menú en modo E2E
- **GIVEN** la URL `?e2e&seed=42` y la partida en pausa
- **WHEN** se pulsa `Volver al menú`
- **THEN** el menú de inicio es visible con sus cinco opciones, la guía no es visible y la sonda no informa de
  ninguna partida en curso

#### Scenario: Sin sonda fuera de E2E
- **GIVEN** la URL `?seed=42`
- **WHEN** termina la carga y se pulsa `Jugar`
- **THEN** `window.__sprint` es `undefined`

### Requirement: Confirmación de Borrar datos
El sistema SHALL, al pulsar `Borrar datos` en modo menú con la guía cerrada, mostrar dentro del juego un diálogo de
confirmación con `Confirmar` y `Cancelar`, sin usar diálogos nativos del navegador (`window.confirm`, `window.alert`
ni `window.prompt`). Mientras el diálogo está abierto, `Jugar`, `Cómo jugar`, `Exportar`, `Importar` y
`Borrar datos` MUST NOT tener efecto, y el diálogo solo se cierra con `Confirmar` o `Cancelar`. `Cancelar` cierra el
diálogo sin cambiar nada. `Confirmar` cierra el diálogo y borra el progreso (ver "Borrado del progreso" en
`progress-persistence`). En ambos casos el menú vuelve a estar operativo. Con la guía abierta, `Borrar datos` MUST
NOT abrir el diálogo (ver "Opciones del menú bloqueadas con la guía abierta" en `menu-guide`).

#### Scenario: Diálogo propio
- **GIVEN** el modo menú y una prueba que cuenta los diálogos nativos del navegador
- **WHEN** se pulsa `Borrar datos`
- **THEN** el diálogo del juego es visible con `Confirmar` y `Cancelar` y se han abierto 0 diálogos nativos

#### Scenario: Cancelar no cambia nada
- **GIVEN** un progreso guardado G con récords (300, 8, 120) y 3 entradas, y un `Exportar` previo E1 en el menú
- **WHEN** se pulsa `Borrar datos`, después `Cancelar` y después `Exportar` (E2)
- **THEN** E2 es igual byte a byte a E1, el valor guardado sigue siendo G byte a byte y el diálogo no es visible

#### Scenario: Confirmar borra
- **GIVEN** un progreso guardado con récords (300, 8, 120) y 3 entradas
- **WHEN** se pulsa `Borrar datos`, después `Confirmar` y después `Exportar`
- **THEN** el fichero exportado es igual campo a campo al progreso vacío y el menú muestra un mensaje que contiene
  `borrado`

#### Scenario: Opciones bloqueadas con el diálogo abierto
- **GIVEN** el diálogo de `Borrar datos` abierto
- **WHEN** se pulsan `Jugar`, `Cómo jugar` y `Exportar`
- **THEN** no empieza ninguna partida, no se descarga ningún fichero, la guía no es visible y el diálogo sigue
  visible

#### Scenario: Confirmar dos veces
- **GIVEN** el diálogo de `Borrar datos` abierto sobre un progreso con 3 entradas
- **WHEN** se pulsa `Confirmar` dos veces seguidas
- **THEN** el diálogo deja de verse tras la primera pulsación, el progreso queda vacío y no hay errores no
  capturados en la consola

#### Scenario: Teclas con el diálogo abierto
- **GIVEN** el diálogo de `Borrar datos` abierto
- **WHEN** se pulsan Esc, R, flecha izquierda y flecha derecha
- **THEN** el diálogo sigue visible, la guía no es visible, el progreso no ha cambiado y no ha empezado ninguna
  partida

### Requirement: Volver al menú
El sistema SHALL, al pulsar `Volver al menú` con la partida en pausa, descartar la partida en pausa y mostrar el menú
de inicio en modo menú, con la guía cerrada. La partida descartada no está terminada: MUST NOT registrarse en el
historial ni en los récords ni provocar ninguna escritura del progreso (ver `progress-persistence`). Desde el primer
frame del menú MUST NOT quedar visible ningún sprite de jugador, enemigo, cadáver (aunque su animación de muerte no
haya terminado, ver `sprite-rendering`), proyectil, pulso ni gema, ni el HUD, el overlay de pausa ni el de
resultados. El siguiente `Jugar` empieza una partida nueva desde cero con una semilla aleatoria nueva (ver
`simulation-loop`), cuya vista contiene solo los elementos de su snapshot. En esta spec, "sprites de enemigo" son los
de enemigos vivos; los cadáveres se cuentan aparte.

#### Scenario: Volver al menú desde la pausa
- **GIVEN** `?e2e` y una partida en pausa en el tick 3.000 con ≥ 1 enemigo, ≥ 1 proyectil y ≥ 1 gema en el snapshot
- **WHEN** se pulsa `Volver al menú` y se pinta el siguiente frame
- **THEN** el menú de inicio es visible con sus cinco opciones y la sonda de render informa de 0 sprites visibles
  de jugador, enemigo, cadáver, proyectil, pulso y gema
- **AND** el HUD, la guía y los overlays de pausa y de resultados no son visibles

#### Scenario: Volver al menú con cadáveres en curso
- **GIVEN** `?e2e&seed=7` y una partida en pausa en un frame en que la sonda de render informa de ≥ 1 cadáver
- **WHEN** se pulsa `Volver al menú` y se pintan 60 frames en el menú
- **THEN** en los 60 frames la sonda informa de 0 cadáveres y 0 sprites de jugador, enemigo, proyectil, pulso y gema
- **AND** al pulsar `Jugar`, en el primer frame de la partida nueva hay 0 cadáveres

#### Scenario: La partida abandonada no se guarda
- **GIVEN** un progreso guardado G y una partida en pausa en el tick 5.000 con 41 bajas y nivel 6
- **WHEN** se pulsa `Volver al menú` y después `Exportar`
- **THEN** el valor guardado sigue siendo G byte a byte, se han hecho 0 escrituras de progreso y el fichero
  exportado es igual campo a campo a G

#### Scenario: Jugar tras volver al menú
- **GIVEN** una partida abandonada con `Volver al menú` en el tick 3.000, nivel 5, 200 bajas y `guardrail` en nivel 2
- **WHEN** se pulsa `Jugar` y se lee el snapshot antes del primer tick
- **THEN** tick 0, estado en curso, vida 100 de 100, nivel 1, XP 0, 0 bajas, sin mejoras adquiridas, sin oferta y
  listas de enemigos, proyectiles, pulsos y gemas vacías
- **AND** el overlay de pausa no es visible y el HUD muestra tiempo `10:00`

#### Scenario: Cinco ciclos menú-partida
- **GIVEN** una carga con `?e2e&seed=7` en la que se repite 5 veces: `Jugar` (salvo en el primer ciclo, que empieza
  con la partida del arranque directo), 600 frames, Esc, `Volver al menú`
- **WHEN** se pulsa `Jugar` una sexta vez y se pintan 600 frames
- **THEN** en cada frame de los 6 ciclos con partida, la sonda de render informa de un número de sprites visibles de
  enemigo, proyectil, pulso y gema igual al número de enemigos, proyectiles, pulsos y gemas del snapshot pintado, y
  de 1 sprite de jugador salvo en los frames en que el parpadeo lo oculta
- **AND** en el primer frame del menú tras cada uno de los 5 `Volver al menú` la sonda informa de 0 sprites de
  jugador, enemigo, cadáver, proyectil, pulso y gema
- **AND** en el primer frame de cada partida hay 0 cadáveres, en ningún frame hay más de 64 y existe exactamente 1
  partida durante el sexto ciclo

### Requirement: Menú y pausa centrados en la ventana
La vista SHALL centrar en la ventana el menú de inicio (título, sus cinco opciones y sus mensajes), el diálogo de
`Borrar datos`, la guía y el overlay de pausa: el centro horizontal de cada uno MUST coincidir con el de la ventana
(error ≤ 1 px) y su contenido MUST quedar centrado en vertical dentro de la ventana (la distancia de su borde superior
al de la ventana y la de su borde inferior al de la ventana difieren ≤ 1 px). Con una ventana ≥ 960 × 540 en ambos
ejes, con cualquier escala de UI, todos sus botones y textos MUST quedar enteros dentro de la ventana y sin
solaparse; en la guía, el recuadro, su título de página, el indicador y los controles `Anterior`, `Siguiente` y
`Cerrar` MUST quedar enteros dentro de la ventana, y el texto de la página MUST quedar dentro del recuadro de la guía,
visible entero o alcanzable desplazándolo dentro del recuadro. Al redimensionar, se reubican desde el primer frame
pintado tras el cambio y cada botón MUST responder al clic en su posición nueva, sin cambiar el estado: el menú sigue
en modo menú, el diálogo sigue abierto, la guía sigue abierta en la misma página y la partida sigue en pausa (ver
"Redimensionado de la ventana" en `world-camera`). El fondo del menú, si lo hay, MUST cubrir la ventana entera.

#### Scenario: Menú centrado en dos ventanas
- **GIVEN** el menú de inicio con una ventana de 1.280 × 720, y en otra carga con una de 2.560 × 1.440
- **WHEN** se pinta 1 frame
- **THEN** el título y los botones `Jugar`, `Cómo jugar`, `Exportar`, `Importar` y `Borrar datos` tienen su centro
  horizontal en x = 640 y x = 1.280 respectivamente (error ≤ 1 px), en ese orden de arriba abajo y enteros dentro de
  la ventana

#### Scenario: Jugar tras redimensionar el menú
- **GIVEN** el menú de inicio con una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 960 × 540, se pinta 1 frame y se hace clic en el centro de `Jugar` en su posición nueva
- **THEN** se crea exactamente 1 partida en curso y el menú deja de verse

#### Scenario: Diálogo abierto al redimensionar
- **GIVEN** el diálogo de `Borrar datos` abierto sobre un progreso guardado G con una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 1.600 × 900 y se pinta 1 frame
- **THEN** el diálogo sigue visible y centrado en x = 800 (error ≤ 1 px), el valor guardado sigue siendo G byte a byte
- **AND** al pulsar `Cancelar` en su posición nueva el diálogo se cierra y el menú vuelve a estar operativo

#### Scenario: Guía entera en la ventana mínima y con escala ×2
- **GIVEN** la guía abierta con una ventana de 960 × 540 y, en otra carga, con una de 1.920 × 1.080, cada una con la
  escala de UI que le corresponda
- **WHEN** se visita cada una de las 7 páginas y se pinta 1 frame en cada una
- **THEN** en cada página el recuadro de la guía tiene su centro horizontal en x = 480 y x = 960 respectivamente
  (error ≤ 1 px), está centrado en vertical (diferencia ≤ 1 px) y el recuadro, el título, el indicador y los
  controles visibles están enteros dentro de la ventana y sin solaparse entre sí
- **AND** el texto de la página no sobresale del recuadro de la guía

#### Scenario: Guía abierta al redimensionar
- **GIVEN** la guía abierta en la página 4 con una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 960 × 540, se pinta 1 frame y se pulsa `Siguiente` en su posición nueva
- **THEN** antes del clic la guía sigue visible con el indicador `4 de 7` y centrada en x = 480 (error ≤ 1 px)
- **AND** tras el clic el indicador es `5 de 7` y no existe ninguna partida

#### Scenario: Pausa centrada y operativa tras redimensionar
- **GIVEN** una partida en pausa en el tick 500 con una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 1.000 × 600, se pinta 1 frame y se pulsa `Reanudar` en su posición nueva
- **THEN** antes del clic el overlay de pausa, con `Pausa`, `Reanudar` y `Volver al menú`, tiene su centro horizontal
  en x = 500 (error ≤ 1 px) y el snapshot sigue en el tick 500
- **AND** tras el clic y 1 frame de 16,667 ms el overlay de pausa no es visible y el snapshot tiene tick 501

#### Scenario: Ventana menor que 960 × 540
- **GIVEN** el menú de inicio con una ventana de 640 × 360
- **WHEN** se pinta 1 frame
- **THEN** el menú tiene su centro horizontal en x = 320 (error ≤ 1 px) y no hay errores no capturados

## REMOVED Requirements

(ninguno)
