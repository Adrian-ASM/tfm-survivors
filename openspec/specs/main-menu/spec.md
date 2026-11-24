# Main menu · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
El menú de inicio (Jugar, Exportar, Importar, Borrar datos), el arranque de la partida bajo demanda, el arranque
directo con `?e2e` y la pausa con Esc (Reanudar, Volver al menú). La pausa no es un estado de la partida.

> Convenciones de esta spec:
> - "Modo menú" es la situación en la que el menú de inicio está visible y no existe partida.
> - "Partida en pausa" es una partida en curso cuyo avance está detenido por la pausa. La pausa **no** es un estado de
>   la partida (ver `run-state`): el snapshot de una partida en pausa tiene estado en curso.
> - Etiquetas visibles exactas: `Jugar`, `Exportar`, `Importar`, `Borrar datos`, `Confirmar`, `Cancelar`, `Reanudar`
>   y `Volver al menú`. El overlay de pausa contiene el texto `Pausa`.
> - Los escenarios con `?e2e` pueden usar la sonda `window.__sprint`; los que cargan sin `?e2e` solo observan lo que
>   ve el jugador (elementos visibles, ficheros descargados, consola y `localStorage`).

## Requirements

### Requirement: Menú de inicio al cargar
El sistema SHALL mostrar, al cargar la página sin `?e2e`, un menú de inicio con exactamente cuatro opciones
visibles y pulsables con el ratón, en este orden: `Jugar`, `Exportar`, `Importar` y `Borrar datos`. En modo menú
MUST NOT existir ninguna partida: no se ejecuta ningún tick, no se ve el HUD, ni el overlay de elección, ni el de
resultados, ni el de pausa, ni ningún sprite de jugador, enemigo, proyectil, pulso o gema. En modo menú las teclas
Esc, R, 1, 2 y 3 y el input de movimiento MUST NOT tener efecto.

#### Scenario: Carga sin parámetros
- **GIVEN** la build de producción servida sin parámetros en la URL
- **WHEN** termina la carga y se pintan 300 frames sin pulsar nada
- **THEN** el menú de inicio es visible con `Jugar`, `Exportar`, `Importar` y `Borrar datos`, en ese orden
- **AND** el HUD, el overlay de resultados y el overlay de pausa no son visibles

#### Scenario: Carga con semilla y sin e2e
- **GIVEN** la URL `?seed=42`
- **WHEN** termina la carga
- **THEN** el menú de inicio es visible y no ha empezado ninguna partida

#### Scenario: Teclas sin efecto en el menú
- **GIVEN** el modo menú
- **WHEN** se pulsan Esc, R, 1, 2 y 3 y se mantiene el input (1, 1) durante 60 frames
- **THEN** el menú sigue visible, no ha empezado ninguna partida y el overlay de pausa no es visible

#### Scenario: El progreso guardado no cambia al cargar el menú
- **GIVEN** un progreso válido G guardado en `localStorage`
- **WHEN** se carga la página sin `?e2e` y se pintan 300 frames en el menú
- **THEN** el valor guardado sigue siendo G byte a byte

### Requirement: Jugar arranca la partida
El sistema SHALL, al pulsar `Jugar` en modo menú, ocultar el menú y empezar exactamente una partida nueva con el
contenido por defecto, en estado inicial (igual que "Partida nueva tras reiniciar" de `run-results`) y con la semilla
que corresponda según "Semilla de la partida" (`simulation-loop`). El tiempo pasado en el menú MUST NOT contar para la
partida (ver `simulation-loop`). Desde el primer frame de la partida se ven el HUD y los elementos de su snapshot, y
el menú no se ve.

#### Scenario: Primer Jugar
- **GIVEN** el modo menú tras 600 frames de 16,667 ms
- **WHEN** se pulsa `Jugar` y se lee el snapshot antes del primer tick
- **THEN** existe exactamente 1 partida, en curso, con tick 0, vida 100 de 100, nivel 1, XP 0 y 0 bajas
- **AND** el menú no es visible y el HUD sí, con vida `100/100`, tiempo `10:00`, nivel 1 y 0 bajas

#### Scenario: Doble clic en Jugar
- **GIVEN** el modo menú
- **WHEN** se pulsa `Jugar` dos veces en el mismo frame o en dos frames consecutivos
- **THEN** se ha creado exactamente 1 partida y, tras 60 frames de 16,667 ms, su snapshot tiene tick 60

#### Scenario: Esc funciona tras pulsar Jugar con el ratón
- **GIVEN** el modo menú
- **WHEN** se pulsa `Jugar` con el ratón, se pintan 30 frames y se pulsa Esc una vez, sin otro clic
- **THEN** el overlay de pausa es visible

### Requirement: Arranque directo con e2e
El sistema SHALL, cuando la URL incluye `?e2e`, saltarse el menú de inicio al cargar y empezar directamente la
primera partida, con el mismo comportamiento observable que antes de este change: la partida existe desde la carga,
la sonda `window.__sprint` está disponible y la semilla y la velocidad se resuelven como hasta ahora (ver
`simulation-loop`). El bypass solo afecta a la carga: con `?e2e`, `Volver al menú` muestra el menú de inicio igual
que sin `?e2e`. Sin `?e2e`, la sonda `window.__sprint` MUST NOT existir.

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
- **THEN** el menú de inicio es visible con sus cuatro opciones y la sonda no informa de ninguna partida en curso

#### Scenario: Sin sonda fuera de E2E
- **GIVEN** la URL `?seed=42`
- **WHEN** termina la carga y se pulsa `Jugar`
- **THEN** `window.__sprint` es `undefined`

### Requirement: Exportar e Importar desde el menú
El sistema SHALL ofrecer en el menú de inicio `Exportar` e `Importar` con el mismo comportamiento que en el overlay
de resultados (ver `progress-persistence`): mismo fichero, mismas validaciones, misma fusión y mismos textos de
mensaje (`importado`, `64 KiB`, `no válido`). Los mensajes se muestran en el menú. Usarlos MUST NOT empezar una
partida, y tras usarlos `Jugar` MUST seguir empezando una partida con una sola pulsación.

#### Scenario: Exportar sin progreso
- **GIVEN** un navegador sin progreso guardado y el modo menú
- **WHEN** se pulsa `Exportar`
- **THEN** se descarga exactamente 1 fichero `sprint-survivors-progress.json` igual campo a campo al progreso vacío
- **AND** sigue sin existir ninguna partida

#### Scenario: Importar desde el menú
- **GIVEN** un progreso guardado con récords (20, 3, 41) y el modo menú
- **WHEN** se importa un fichero válido con récords (250, 10, 90)
- **THEN** el menú muestra un mensaje que contiene `importado` y un `Exportar` posterior tiene récords (250, 10, 90)

#### Scenario: Import rechazado desde el menú
- **GIVEN** un progreso guardado G y el modo menú
- **WHEN** se importa un fichero con el texto `hola` y después uno de 65.537 bytes
- **THEN** el menú muestra el mensaje con `no válido` tras el primero y el mensaje con `64 KiB` tras el segundo
- **AND** el valor guardado sigue siendo G y un `Exportar` posterior es igual campo a campo a G

#### Scenario: Jugar tras usar los botones
- **GIVEN** el modo menú en el que se ha pulsado `Exportar` y después `Importar` con un fichero válido
- **WHEN** se pulsa `Jugar` una vez
- **THEN** se crea exactamente 1 partida en curso y el menú deja de verse, junto con sus mensajes

### Requirement: Confirmación de Borrar datos
El sistema SHALL, al pulsar `Borrar datos` en modo menú, mostrar dentro del juego un diálogo de confirmación con
`Confirmar` y `Cancelar`, sin usar diálogos nativos del navegador (`window.confirm`, `window.alert` ni
`window.prompt`). Mientras el diálogo está abierto, `Jugar`, `Exportar`, `Importar` y `Borrar datos` MUST NOT tener
efecto, y el diálogo solo se cierra con `Confirmar` o `Cancelar`. `Cancelar` cierra el diálogo sin cambiar nada.
`Confirmar` cierra el diálogo y borra el progreso (ver "Borrado del progreso" en `progress-persistence`). En ambos
casos el menú vuelve a estar operativo.

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
- **WHEN** se pulsan `Jugar` y `Exportar`
- **THEN** no empieza ninguna partida, no se descarga ningún fichero y el diálogo sigue visible

#### Scenario: Confirmar dos veces
- **GIVEN** el diálogo de `Borrar datos` abierto sobre un progreso con 3 entradas
- **WHEN** se pulsa `Confirmar` dos veces seguidas
- **THEN** el diálogo deja de verse tras la primera pulsación, el progreso queda vacío y no hay errores no
  capturados en la consola

#### Scenario: Teclas con el diálogo abierto
- **GIVEN** el diálogo de `Borrar datos` abierto
- **WHEN** se pulsan Esc y R
- **THEN** el diálogo sigue visible, el progreso no ha cambiado y no ha empezado ninguna partida

### Requirement: Pausa con Esc
El sistema SHALL, al pulsar Esc con la partida en curso y sin pausa, poner la partida en pausa y mostrar un overlay
de pausa con el texto `Pausa` y los botones `Reanudar` y `Volver al menú`, pulsables con el ratón. Con la partida en
pausa, pulsar Esc o `Reanudar` quita la pausa y oculta el overlay. Cada pulsación de Esc MUST cambiar la pausa como
mucho una vez, aunque la tecla se mantenga pulsada. Con la partida eligiendo mejora o terminada, Esc MUST NOT tener
efecto. Mientras la partida está en pausa:
- no se ejecuta ningún tick ni se acumula tiempo (ver `simulation-loop`), y el snapshot no cambia;
- el estado de la partida sigue siendo en curso (la pausa no es un estado de `run-state`);
- el HUD sigue visible con los valores del snapshot de la pausa (ver `hud`);
- las teclas R, 1, 2 y 3 y el input de movimiento MUST NOT tener efecto, ni durante la pausa ni al reanudar;
- no se ven el overlay de elección ni el de resultados.

Pausar y reanudar MUST NOT cambiar la simulación: una partida pausada y reanudada que recibe la misma secuencia de
inputs por tick que otra sin pausa produce los mismos snapshots en cada tick.

#### Scenario: Pausar y reanudar con Esc
- **GIVEN** una partida en curso en el tick 500
- **WHEN** se pulsa Esc, el motor informa de 300 frames de 16,667 ms y se vuelve a pulsar Esc
- **THEN** durante los 300 frames el overlay de pausa es visible y el snapshot sigue igual campo a campo al del
  tick 500, con estado en curso
- **AND** tras la segunda pulsación el overlay de pausa no es visible

#### Scenario: Reanudar con el botón
- **GIVEN** una partida en pausa en el tick 500
- **WHEN** se pulsa `Reanudar` y el motor informa de 1 frame de 16,667 ms
- **THEN** el overlay de pausa no es visible y el snapshot tiene tick 501

#### Scenario: Esc mantenido
- **GIVEN** una partida en curso sin pausa
- **WHEN** se pulsa Esc, se mantiene pulsada 60 frames y se suelta
- **THEN** la partida está en pausa (un único cambio) y el overlay de pausa es visible

#### Scenario: Esc mientras se elige mejora
- **GIVEN** una partida eligiendo mejora en el tick n con el overlay de elección visible
- **WHEN** se pulsa Esc y después la tecla 1
- **THEN** el overlay de pausa no se ha visto, se elige la opción de índice 0 y, tras 1 frame de 16,667 ms, el
  snapshot tiene tick n + 1

#### Scenario: Esc con la partida terminada
- **GIVEN** una partida terminada en el tick n con el overlay de resultados visible
- **WHEN** se pulsa Esc y después R una vez
- **THEN** el overlay de pausa no se ha visto y R crea exactamente 1 partida nueva en curso

#### Scenario: Teclas sin efecto en pausa
- **GIVEN** una partida en pausa en el tick n con el jugador en la posición P
- **WHEN** se pulsan R, 1, 2 y 3 y se mantiene el input (1, 1) durante 60 frames, se suelta y se pulsa Esc
- **THEN** durante la pausa el snapshot sigue igual campo a campo al del tick n
- **AND** tras reanudar sigue siendo la misma partida (no se ha reiniciado) y, con input (0, 0), el jugador sigue en
  P tras 1 frame de 16,667 ms

#### Scenario: Esc y R en el mismo frame
- **GIVEN** una partida en curso en el tick 500
- **WHEN** se pulsan Esc y R en el mismo frame
- **THEN** la partida queda en pausa en el tick 500 y no se ha reiniciado

#### Scenario: La pausa no altera la simulación
- **GIVEN** dos partidas con el contenido por defecto, la semilla 42, la misma secuencia de 1.200 inputs por tick y
  la política de elección fija
- **WHEN** una se pausa en los ticks 100, 400 y 900 durante 300 frames cada vez y la otra no se pausa
- **THEN** sus snapshots son iguales campo a campo en cada uno de los 1.200 ticks

### Requirement: Volver al menú
El sistema SHALL, al pulsar `Volver al menú` con la partida en pausa, descartar la partida en pausa y mostrar el menú
de inicio en modo menú. La partida descartada no está terminada: MUST NOT registrarse en el historial ni en los
récords ni provocar ninguna escritura del progreso (ver `progress-persistence`). Desde el primer frame del menú MUST
NOT quedar visible ningún sprite de jugador, enemigo, cadáver (aunque su animación de muerte no haya terminado, ver
`sprite-rendering`), proyectil, pulso ni gema, ni el HUD, el overlay de pausa ni el de resultados. El siguiente
`Jugar` empieza una partida nueva desde cero con una semilla aleatoria nueva (ver `simulation-loop`), cuya vista
contiene solo los elementos de su snapshot. En esta spec, "sprites de enemigo" son los de enemigos vivos; los
cadáveres se cuentan aparte.

#### Scenario: Volver al menú desde la pausa
- **GIVEN** `?e2e` y una partida en pausa en el tick 3.000 con ≥ 1 enemigo, ≥ 1 proyectil y ≥ 1 gema en el snapshot
- **WHEN** se pulsa `Volver al menú` y se pinta el siguiente frame
- **THEN** el menú de inicio es visible con sus cuatro opciones y la sonda de render informa de 0 sprites visibles
  de jugador, enemigo, cadáver, proyectil, pulso y gema
- **AND** el HUD y los overlays de pausa y de resultados no son visibles

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

### Requirement: Flujo del menú observable en el navegador
El sistema SHALL permitir, en la build de producción y sin `?e2e`, recorrer el flujo menú → Jugar → pausa → Volver
al menú → Borrar datos (cancelar y confirmar) sin recargar la página, sin errores no capturados en la consola, sin
diálogos nativos del navegador y sin violaciones de la CSP (ver `progress-persistence`).

#### Scenario: Recorrido del menú sin sonda
- **GIVEN** la build de producción servida sin `?e2e`, con un progreso válido P0 de 2 entradas de historial guardado
  en `localStorage` antes de la carga
- **WHEN** una prueba E2E pulsa `Jugar`, espera 2 s, pulsa Esc, comprueba el overlay de pausa, pulsa `Volver al
  menú`, pulsa `Exportar` (E1), pulsa `Borrar datos` y `Cancelar`, pulsa `Exportar` (E2), pulsa `Borrar datos` y
  `Confirmar` y pulsa `Exportar` (E3)
- **THEN** tras `Jugar` el menú no es visible y el HUD sí; tras Esc el overlay de pausa es visible con `Reanudar` y
  `Volver al menú`; tras `Volver al menú` el menú es visible y el HUD no
- **AND** E1 es igual campo a campo a P0 (la partida abandonada no figura), E2 es igual byte a byte a E1 y E3 es
  igual campo a campo al progreso vacío
- **AND** se han abierto 0 diálogos nativos, no hay errores no capturados y no se registra ningún evento
  `securitypolicyviolation`

#### Scenario: Borrado que sobrevive a la recarga
- **GIVEN** el final del escenario anterior
- **WHEN** se recarga la página sin `?e2e` y se pulsa `Exportar` en el menú
- **THEN** el fichero exportado es igual campo a campo al progreso vacío y no hay avisos por consola que mencionen
  `progress`

### Requirement: Nombre visible del juego
El sistema SHALL mostrar como nombre del juego `Greentide Vanguard` en el título del menú de inicio y en el título del
documento (`<title>` de `index.html`). Ningún texto visible del menú ni el título del documento MUST contener
`Sprint Survivors`. El cambio de nombre MUST NOT cambiar la clave de `localStorage` `sprint-survivors/progress`, el
nombre del fichero exportado `sprint-survivors-progress.json` ni la sonda `window.__sprint`.

#### Scenario: Título en el menú y en el documento
- **GIVEN** la build de producción servida sin parámetros
- **WHEN** termina la carga y se ve el menú de inicio
- **THEN** el título del menú es `Greentide Vanguard` y `document.title` contiene `Greentide Vanguard`
- **AND** ni el texto visible del menú ni `document.title` contienen `Sprint Survivors`

#### Scenario: Claves técnicas sin cambios
- **GIVEN** un progreso con récords (300, 8, 120) guardado antes de este change en `sprint-survivors/progress`
- **WHEN** se carga la página tras el change y se pulsa `Exportar` en el menú
- **THEN** se descarga `sprint-survivors-progress.json` con récords (300, 8, 120), igual campo a campo al guardado

#### Scenario: Export antiguo importable
- **GIVEN** un fichero exportado antes de este change con 2 entradas de historial y un navegador sin progreso
- **WHEN** se importa desde el menú
- **THEN** el menú muestra un mensaje que contiene `importado` y un `Exportar` posterior contiene esas 2 entradas

### Requirement: Menú y pausa centrados en la ventana
La vista SHALL centrar en la ventana el menú de inicio (título, sus cuatro opciones y sus mensajes), el diálogo de
`Borrar datos` y el overlay de pausa: el centro horizontal de cada uno MUST coincidir con el de la ventana (error
≤ 1 px) y su contenido MUST quedar centrado en vertical dentro de la ventana (la distancia de su borde superior al de
la ventana y la de su borde inferior al de la ventana difieren ≤ 1 px). Con una ventana ≥ 960 × 540 en ambos ejes,
todos sus botones y textos MUST quedar enteros dentro de la ventana y sin solaparse. Al redimensionar, se reubican
desde el primer frame pintado tras el cambio y cada botón MUST responder al clic en su posición nueva, sin cambiar el
estado: el menú sigue en modo menú, el diálogo sigue abierto y la partida sigue en pausa (ver "Redimensionado de la
ventana" en `world-camera`). El fondo del menú, si lo hay, MUST cubrir la ventana entera.

#### Scenario: Menú centrado en dos ventanas
- **GIVEN** el menú de inicio con una ventana de 1.280 × 720, y en otra carga con una de 2.560 × 1.440
- **WHEN** se pinta 1 frame
- **THEN** el título y los botones `Jugar`, `Exportar`, `Importar` y `Borrar datos` tienen su centro horizontal en
  x = 640 y x = 1.280 respectivamente (error ≤ 1 px), en ese orden de arriba abajo y enteros dentro de la ventana

#### Scenario: Jugar tras redimensionar el menú
- **GIVEN** el menú de inicio con una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 960 × 540, se pinta 1 frame y se hace clic en el centro de `Jugar` en su posición nueva
- **THEN** se crea exactamente 1 partida en curso y el menú deja de verse

#### Scenario: Diálogo abierto al redimensionar
- **GIVEN** el diálogo de `Borrar datos` abierto sobre un progreso guardado G con una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 1.600 × 900 y se pinta 1 frame
- **THEN** el diálogo sigue visible y centrado en x = 800 (error ≤ 1 px), el valor guardado sigue siendo G byte a byte
- **AND** al pulsar `Cancelar` en su posición nueva el diálogo se cierra y el menú vuelve a estar operativo

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

<!-- historial: 0009-main-menu (2026-11-20) -->
<!-- historial: 0012-sprite-rendering (2026-11-22) -->
<!-- historial: 0017-fullscreen-view (2026-11-24) -->
