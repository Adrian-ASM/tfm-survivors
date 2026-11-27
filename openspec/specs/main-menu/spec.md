# Main menu · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
El menú de inicio (Jugar, Cómo jugar, Sonido, Exportar, Importar, Borrar datos), el arranque de la partida bajo
demanda, el arranque directo con `?e2e` y la pausa con Esc (Reanudar, Sonido, Volver al menú). La pausa no es un
estado de la partida.

> Convenciones de esta spec:
> - "Modo menú" es la situación en la que el menú de inicio está visible y no existe partida.
> - "Partida en pausa" es una partida en curso cuyo avance está detenido por la pausa. La pausa **no** es un estado de
>   la partida (ver `run-state`): el snapshot de una partida en pausa tiene estado en curso.
> - Etiquetas visibles exactas: `Jugar`, `Cómo jugar`, `Sonido`, `Exportar`, `Importar`, `Borrar datos`, `Confirmar`,
>   `Cancelar`, `Reanudar` y `Volver al menú`. El overlay de pausa contiene el texto `Pausa`.
> - "La guía" es el modal de `Cómo jugar` (ver `menu-guide`).
> - Los escenarios con `?e2e` pueden usar la sonda `window.__sprint`; los que cargan sin `?e2e` solo observan lo que
>   ve el jugador (elementos visibles, ficheros descargados, consola y `localStorage`).

## Requirements

### Requirement: Menú de inicio al cargar
El sistema SHALL mostrar, al cargar la página sin `?e2e`, un menú de inicio con exactamente seis opciones
visibles y pulsables con el ratón, en este orden: `Jugar`, `Cómo jugar`, `Sonido`, `Exportar`, `Importar` y
`Borrar datos`. En modo menú MUST NOT existir ninguna partida: no se ejecuta ningún tick, no se ve el HUD, ni el overlay
de elección, ni el de resultados, ni el de pausa, ni el panel `Sonido`, ni ningún sprite de jugador, enemigo,
proyectil, pulso o gema. En modo menú con la guía y el panel `Sonido` cerrados, las teclas Esc, R, 1, 2 y 3, las
flechas izquierda y derecha y el input de movimiento MUST NOT tener efecto, y M solo conmuta el silencio (ver "Tecla M"
en `audio`). Con la guía abierta, Esc y las flechas solo actúan sobre la guía y R, 1, 2, 3 y el input de movimiento
siguen sin efecto (ver "Cerrar la guía" y "Teclado en la guía" en `menu-guide`). Con el panel `Sonido` abierto, Esc
solo lo cierra, las flechas solo actúan sobre el deslizador con el foco y R, 1, 2, 3 y el input de movimiento siguen
sin efecto (ver "Panel Sonido" en `audio`).

#### Scenario: Carga sin parámetros
- **GIVEN** la build de producción servida sin parámetros en la URL
- **WHEN** termina la carga y se pintan 300 frames sin pulsar nada
- **THEN** el menú de inicio es visible con exactamente 6 botones, `Jugar`, `Cómo jugar`, `Sonido`, `Exportar`,
  `Importar` y `Borrar datos`, en ese orden de arriba abajo
- **AND** el HUD, el overlay de resultados, el overlay de pausa, la guía y el panel `Sonido` no son visibles

#### Scenario: Carga con semilla y sin e2e
- **GIVEN** la URL `?seed=42`
- **WHEN** termina la carga
- **THEN** el menú de inicio es visible y no ha empezado ninguna partida

#### Scenario: Teclas sin efecto en el menú
- **GIVEN** el modo menú con la guía y el panel `Sonido` cerrados
- **WHEN** se pulsan Esc, R, 1, 2 y 3, flecha izquierda y flecha derecha y se mantiene el input (1, 1) durante
  60 frames
- **THEN** el menú sigue visible, no ha empezado ninguna partida y ni el overlay de pausa, ni la guía, ni el panel
  `Sonido` son visibles

#### Scenario: El progreso guardado no cambia al cargar el menú
- **GIVEN** un progreso válido G guardado en `localStorage`
- **WHEN** se carga la página sin `?e2e` y se pintan 300 frames en el menú
- **THEN** el valor guardado sigue siendo G byte a byte

#### Scenario: M en el menú
- **GIVEN** el modo menú con la guía y el panel `Sonido` cerrados y sin silencio
- **WHEN** se pulsa M
- **THEN** el silencio está activado, el menú sigue visible con sus 6 opciones y no ha empezado ninguna partida

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
que sin `?e2e`, con la guía y el panel `Sonido` cerrados. Sin `?e2e`, la sonda `window.__sprint` MUST NOT existir
(tampoco `window.__sprint.audio`, ver `audio`).

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
- **THEN** el menú de inicio es visible con sus seis opciones, la guía y el panel `Sonido` no son visibles y la sonda
  no informa de ninguna partida en curso

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
El sistema SHALL, al pulsar `Borrar datos` en modo menú con la guía y el panel `Sonido` cerrados, mostrar dentro del
juego un diálogo de confirmación con `Confirmar` y `Cancelar`, sin usar diálogos nativos del navegador
(`window.confirm`, `window.alert` ni `window.prompt`). Mientras el diálogo está abierto, `Jugar`, `Cómo jugar`,
`Sonido`, `Exportar`, `Importar` y `Borrar datos` MUST NOT tener efecto, y el diálogo solo se cierra con `Confirmar` o
`Cancelar`. `Cancelar` cierra el diálogo sin cambiar nada. `Confirmar` cierra el diálogo y borra el progreso (ver
"Borrado del progreso" en `progress-persistence`), sin tocar los ajustes de audio (ver "Ajustes de audio guardados" en
`audio`). En ambos casos el menú vuelve a estar operativo. Con la guía abierta, `Borrar datos` MUST NOT abrir el
diálogo (ver "Opciones del menú bloqueadas con la guía abierta" en `menu-guide`), y tampoco con el panel `Sonido`
abierto (ver "Panel Sonido" en `audio`).

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
- **WHEN** se pulsan `Jugar`, `Cómo jugar`, `Sonido` y `Exportar`
- **THEN** no empieza ninguna partida, no se descarga ningún fichero, ni la guía ni el panel `Sonido` son visibles y
  el diálogo sigue visible

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

### Requirement: Pausa con Esc
El sistema SHALL, al pulsar Esc con la partida en curso y sin pausa, poner la partida en pausa y mostrar un overlay
de pausa con el texto `Pausa` y los botones `Reanudar`, `Sonido` y `Volver al menú`, en ese orden y pulsables con el
ratón. Con la partida en pausa y el panel `Sonido` cerrado, pulsar Esc o `Reanudar` quita la pausa y oculta el
overlay. Con la partida en pausa y el panel `Sonido` abierto, Esc MUST cerrar solo el panel: la partida sigue en pausa
con su overlay, y solo una pulsación posterior la reanuda (ver "Panel Sonido" en `audio`). Cada pulsación de Esc MUST
cambiar la pausa, la tienda, la obra o el panel `Sonido` como mucho una vez, aunque la tecla se mantenga pulsada. Con
la partida eligiendo mejora o terminada, Esc MUST NOT tener efecto. Con la partida en tienda, Esc MUST salir de la
tienda (ver "Overlay de la tienda" en `castle-shop`) y, con la partida en obra, Esc MUST salir de la obra sin
construir (ver "Panel de obra" en `build-sites`); en ambos casos MUST NOT abrir la pausa: la partida queda en curso y
sin pausa, y solo una pulsación posterior la pausa. Mientras la partida está en pausa:
- no se ejecuta ningún tick ni se acumula tiempo (ver `simulation-loop`), y el snapshot no cambia;
- el estado de la partida sigue siendo en curso (la pausa no es un estado de `run-state`);
- el HUD sigue visible con los valores del snapshot de la pausa (ver `hud`);
- las teclas R, 1, 2 y 3 y el input de movimiento MUST NOT tener efecto, ni durante la pausa ni al reanudar; M solo
  conmuta el silencio (ver "Tecla M" en `audio`);
- no se ven el overlay de elección, el de la tienda, el panel de obra ni el de resultados;
- la música está en pausa (ver "El audio se detiene con la pausa, la retención y la pestaña oculta" en `audio`).

Pausar y reanudar MUST NOT cambiar la simulación: una partida pausada y reanudada que recibe la misma secuencia de
inputs por tick que otra sin pausa produce los mismos snapshots en cada tick.

#### Scenario: Pausar y reanudar con Esc
- **GIVEN** una partida en curso en el tick 500
- **WHEN** se pulsa Esc, el motor informa de 300 frames de 16,667 ms y se vuelve a pulsar Esc
- **THEN** durante los 300 frames el overlay de pausa es visible, con `Reanudar`, `Sonido` y `Volver al menú` en ese
  orden, y el snapshot sigue igual campo a campo al del tick 500, con estado en curso
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

#### Scenario: Esc en la tienda
- **GIVEN** una partida en tienda en el tick n con el overlay de la tienda visible
- **WHEN** se pulsa Esc, se mantiene pulsada 60 frames y se suelta
- **THEN** el overlay de la tienda no es visible, el de pausa no se ha visto y la partida está en curso sin pausa
- **AND** una segunda pulsación de Esc pone la partida en pausa

#### Scenario: Esc en la obra
- **GIVEN** una partida en obra en el tick n con el panel de obra visible
- **WHEN** se pulsa Esc, se mantiene pulsada 60 frames y se suelta
- **THEN** el panel de obra no es visible, el de pausa no se ha visto, el solar sigue en `free` y la partida está en
  curso sin pausa
- **AND** una segunda pulsación de Esc pone la partida en pausa

#### Scenario: Esc con el panel Sonido abierto
- **GIVEN** una partida en pausa en el tick 500 con el panel `Sonido` abierto desde la pausa
- **WHEN** se pulsa Esc, se mantiene pulsada 60 frames y se suelta
- **THEN** el panel `Sonido` no es visible, el overlay de pausa sí y el snapshot sigue en el tick 500
- **AND** una segunda pulsación de Esc quita la pausa

### Requirement: Volver al menú
El sistema SHALL, al pulsar `Volver al menú` con la partida en pausa y el panel `Sonido` cerrado, descartar la partida
en pausa y mostrar el menú de inicio en modo menú, con la guía y el panel `Sonido` cerrados y la música parada (ver
"Música de fondo en bucle" en `audio`). La partida descartada no está terminada: MUST NOT registrarse en el historial
ni en los récords ni provocar ninguna escritura del progreso (ver `progress-persistence`). Desde el primer frame del
menú MUST NOT quedar visible ningún sprite de jugador, enemigo, cadáver (aunque su animación de muerte no haya
terminado, ver `sprite-rendering`), proyectil, pulso ni gema, ni el HUD, el overlay de pausa ni el de resultados. El
siguiente `Jugar` empieza una partida nueva desde cero con una semilla aleatoria nueva (ver `simulation-loop`), cuya
vista contiene solo los elementos de su snapshot. En esta spec, "sprites de enemigo" son los de enemigos vivos; los
cadáveres se cuentan aparte.

#### Scenario: Volver al menú desde la pausa
- **GIVEN** `?e2e` y una partida en pausa en el tick 3.000 con ≥ 1 enemigo, ≥ 1 proyectil y ≥ 1 gema en el snapshot
- **WHEN** se pulsa `Volver al menú` y se pinta el siguiente frame
- **THEN** el menú de inicio es visible con sus seis opciones y la sonda de render informa de 0 sprites visibles
  de jugador, enemigo, cadáver, proyectil, pulso y gema
- **AND** el HUD, la guía, el panel `Sonido` y los overlays de pausa y de resultados no son visibles

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

#### Scenario: Volver al menú bloqueado con el panel Sonido
- **GIVEN** una partida en pausa en el tick 500 con el panel `Sonido` abierto
- **WHEN** se pulsa `Volver al menú` en su posición
- **THEN** el panel sigue visible, la partida sigue en pausa en el tick 500 y el menú de inicio no es visible

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
La vista SHALL centrar en la ventana el menú de inicio (título, sus seis opciones y sus mensajes), el diálogo de
`Borrar datos`, la guía, el panel `Sonido` y el overlay de pausa: el centro horizontal de cada uno MUST coincidir con el
de la ventana (error ≤ 1 px) y su contenido MUST quedar centrado en vertical dentro de la ventana (la distancia de su
borde superior al de la ventana y la de su borde inferior al de la ventana difieren ≤ 1 px). Con una ventana
≥ 960 × 540 en ambos ejes, con cualquier escala de UI, todos sus botones y textos (y los deslizadores, la casilla y la ×
del panel `Sonido`) MUST quedar enteros dentro de la ventana y sin solaparse; en la guía, el recuadro, su título de
página, el indicador y los controles `Anterior`, `Siguiente` y la × (nombre accesible `Cerrar`) MUST quedar enteros
dentro de la ventana, y el texto de la página MUST quedar dentro del recuadro de la guía, visible entero o alcanzable
desplazándolo dentro del recuadro. La × de la guía y la del panel `Sonido` siguen "Botón × de cierre de los modales"
(`sprite-rendering`). Al redimensionar, se reubican desde el primer frame pintado tras el cambio y cada botón (la ×
incluida) MUST responder al clic en su posición nueva, sin cambiar el estado: el menú sigue en modo menú, el diálogo
sigue abierto, la guía sigue abierta en la misma página, el panel `Sonido` sigue abierto con los mismos ajustes y la
partida sigue en pausa (ver "Redimensionado de la ventana" en `world-camera`). El fondo del menú, si lo hay, MUST
cubrir la ventana entera.

#### Scenario: Menú centrado en dos ventanas
- **GIVEN** el menú de inicio con una ventana de 1.280 × 720, y en otra carga con una de 2.560 × 1.440
- **WHEN** se pinta 1 frame
- **THEN** el título y los botones `Jugar`, `Cómo jugar`, `Sonido`, `Exportar`, `Importar` y `Borrar datos` tienen su
  centro horizontal en x = 640 y x = 1.280 respectivamente (error ≤ 1 px), en ese orden de arriba abajo y enteros
  dentro de la ventana

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
- **THEN** antes del clic el overlay de pausa, con `Pausa`, `Reanudar`, `Sonido` y `Volver al menú`, tiene su centro
  horizontal en x = 500 (error ≤ 1 px) y el snapshot sigue en el tick 500
- **AND** tras el clic y 1 frame de 16,667 ms el overlay de pausa no es visible y el snapshot tiene tick 501

#### Scenario: Ventana menor que 960 × 540
- **GIVEN** el menú de inicio con una ventana de 640 × 360
- **WHEN** se pinta 1 frame
- **THEN** el menú tiene su centro horizontal en x = 320 (error ≤ 1 px) y no hay errores no capturados

#### Scenario: Guía entera en la ventana mínima y con escala ×2
- **GIVEN** la guía abierta con una ventana de 960 × 540 y, en otra carga, con una de 1.920 × 1.080, cada una con la
  escala de UI que le corresponda
- **WHEN** se visita cada una de las 7 páginas y se pinta 1 frame en cada una
- **THEN** en cada página el recuadro de la guía tiene su centro horizontal en x = 480 y x = 960 respectivamente
  (error ≤ 1 px), está centrado en vertical (diferencia ≤ 1 px) y el recuadro, el título, el indicador y los
  controles visibles (la × incluida) están enteros dentro de la ventana y sin solaparse entre sí
- **AND** el texto de la página no sobresale del recuadro de la guía

#### Scenario: Guía abierta al redimensionar
- **GIVEN** la guía abierta en la página 4 con una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 960 × 540, se pinta 1 frame y se pulsa `Siguiente` en su posición nueva
- **THEN** antes del clic la guía sigue visible con el indicador `4 de 7` y centrada en x = 480 (error ≤ 1 px)
- **AND** tras el clic el indicador es `5 de 7` y no existe ninguna partida

#### Scenario: Panel Sonido abierto al redimensionar
- **GIVEN** el panel `Sonido` abierto desde la pausa con música 30, con una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 960 × 540, se pinta 1 frame y se hace clic en la × (nombre accesible `Cerrar`) en su
  posición nueva
- **THEN** antes del clic el panel está centrado en x = 480 (error ≤ 1 px) y muestra `30 %`
- **AND** tras el clic el panel no es visible y el overlay de pausa sí, con la partida en el mismo tick

#### Scenario: Cerrar la guía con la × tras redimensionar
- **GIVEN** la guía abierta en la página 2 con una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 960 × 540, se pinta 1 frame y se hace clic en la × en su posición nueva
- **THEN** la guía no es visible, el menú está en modo menú, no existe ninguna partida y el foco está en `Cómo jugar`

### Requirement: Aspecto del menú, la pausa y el diálogo con piezas de UI
La vista SHALL pintar el menú de inicio (`.menu-panel`), el overlay de pausa (`.pause-panel`) y el diálogo de
`Borrar datos` (`.confirm-dialog`) con las piezas de "Piezas de UI en los paneles DOM" (`sprite-rendering`): marco de
`panel`; `Jugar`, `Cómo jugar`, `Sonido`, `Exportar`, `Importar`, `Borrar datos`, `Reanudar`, `Volver al menú` y
`Cancelar` con las piezas de botón según su estado; `Confirmar` con `buttonDanger` (`buttonDangerPressed` al pulsarlo);
el título `Greentide Vanguard` (`h1`) y `Pausa` (`h2`) con la cabecera `header`; y todos los textos con la fuente pixel.
Los mensajes `importado`, `no válido`, `64 KiB` y `borrado` usan la tinta `accent` de `panel`. Con una ventana
≥ 960 × 540 y cualquier k, los seis botones del menú, su título y sus mensajes MUST quedar dentro del área útil del
marco, además de enteros en la ventana y sin solaparse ("Menú y pausa centrados en la ventana"). Si una pieza o la
fuente no carga, cada superficie se pinta con su reserva y el flujo menú → `Jugar` → pausa → `Volver al menú` →
`Borrar datos` sigue funcionando igual (ver "Reserva de las piezas de UI y de la fuente" en `sprite-rendering`).

#### Scenario: Menú con piezas en el navegador [E2E]
- **GIVEN** la build de producción servida sin `?e2e` con una ventana de 1.280 × 720 (k = 1), en el test de humo que ya
  abre el menú y vigila la CSP (ampliado, sin test nuevo)
- **WHEN** termina la carga y se lee el estilo calculado de `.menu-panel`
- **THEN** su imagen de borde contiene `UI/Banners/Carved_9Slides.png` servida bajo `/tfm-survivors/` y sus anchos de
  borde de imagen son los márgenes de `panel` × 1 px (12 px con los datos del repositorio)
- **AND** `document.fonts.check('16px "Departure Mono"')` es verdadero
- **AND** se registran 0 eventos `securitypolicyviolation` y 0 errores no capturados, y los roles y textos de los
  botones son los de siempre más `Sonido`

#### Scenario: Botón deshabilitado, botón con foco y botón de borrado
- **GIVEN** el menú de inicio con un botón con el atributo `disabled`, el foco de teclado en `Jugar` y el diálogo de
  `Borrar datos` abierto
- **WHEN** se leen las reglas que se aplican a cada uno
- **THEN** el desactivado usa la pieza de `buttonDisabled`, `Jugar` con foco visible la de `buttonHover` y un contorno
  de 2 px, `Confirmar` la de `buttonDanger` y `Cancelar` la de `button`

#### Scenario: Diálogo con texto legible
- **GIVEN** el diálogo de `Borrar datos` abierto con los datos de `ui` del repositorio
- **WHEN** se leen los colores de su texto y de sus botones
- **THEN** el del texto es la tinta `text` de `panel`, el de `Cancelar` la de `button` y el de `Confirmar` la de
  `buttonDanger`, cada uno con contraste ≥ 4,5 con el relleno de su pieza

#### Scenario: Flujo del menú con las piezas en reserva
- **GIVEN** el menú con las piezas de `panel`, `button` y `header` y la fuente sin cargar
- **WHEN** se pulsa `Jugar`, Esc, `Volver al menú`, `Borrar datos` y `Cancelar`
- **THEN** cada paso tiene el mismo resultado que con las piezas cargadas, sin errores no capturados

<!-- historial: 0009-main-menu (2026-11-20) -->
<!-- historial: 0012-sprite-rendering (2026-11-22) -->
<!-- historial: 0017-fullscreen-view (2026-11-24) -->
<!-- historial: 0024-split-progression-castle (2026-11-25) -->
<!-- historial: 0026-build-sites (2026-11-25) -->
<!-- historial: 0028-menu-guide (2026-11-25) -->
<!-- historial: 0032-ui-kit (2026-11-26) -->
<!-- historial: 0035-audio (2026-11-27) -->
<!-- historial: 0036-ui-polish (2026-11-27) -->
