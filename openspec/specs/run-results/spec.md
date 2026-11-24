# Run results · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
El overlay de resultados al terminar la partida y el reinicio con la tecla R sin recargar la página.

## Requirements

### Requirement: Overlay de resultados
La vista SHALL mostrar un overlay de resultados si y solo si existe una partida y el último snapshot pintado la tiene
terminada. El overlay MUST mostrar:
- un título según el resultado: `Victoria` si el resultado es victoria y `Derrota` si es derrota;
- el tiempo sobrevivido en formato `mm:ss` (ver "Tiempo sobrevivido");
- el nivel alcanzado (el nivel del snapshot);
- las bajas de la partida (ver `run-outcome`);
- una indicación de que la tecla R empieza una partida nueva;
- los récords del progreso en uso, que ya incluyen la partida recién terminada (ver `progress-persistence`), con
  las etiquetas `Mejor tiempo` (en formato `mm:ss`, igual que "Tiempo sobrevivido"), `Mejor nivel` y `Máx. bajas`;
- dos botones visibles y pulsables con el ratón, `Exportar` e `Importar`;
- tras un import, su mensaje: de éxito (contiene `importado`) o de rechazo (contiene `64 KiB` o `no válido`, ver
  `progress-persistence`); tras un import válido, los récords mostrados pasan a ser los fusionados;
- si el progreso no se puede guardar en esta carga (almacenamiento no disponible o fallo al escribir), un aviso que
  contiene `no se guarda`;
- en la primera partida terminada de una carga cuyos datos guardados estaban dañados, un aviso que contiene
  `dañados`, salvo que en esa carga se haya confirmado `Borrar datos` antes de terminarla.

El overlay de resultados MUST NOT ofrecer `Volver al menú`. Con la partida en curso, en pausa o eligiendo mejora, o
en el menú de inicio, el overlay de resultados no se ve, ni tampoco sus botones, mensajes y avisos. El overlay solo
depende del snapshot y del progreso en uso: no cambia la simulación.

#### Scenario: Overlay tras una derrota
- **GIVEN** un snapshot terminado con resultado derrota en el tick 1.259, nivel 3 y 41 bajas
- **WHEN** se pinta
- **THEN** el overlay de resultados es visible con el título `Derrota`, tiempo `00:20`, nivel 3, 41 bajas y la
  indicación de la tecla R
- **AND** no muestra ningún botón `Volver al menú`

#### Scenario: Overlay tras una victoria
- **GIVEN** un snapshot terminado con resultado victoria en el tick 36.000, nivel 18 y 2.150 bajas
- **WHEN** se pinta
- **THEN** el overlay de resultados es visible con el título `Victoria`, tiempo `10:00`, nivel 18 y 2150 bajas

#### Scenario: Sin overlay durante la partida
- **GIVEN** un snapshot en curso, otro eligiendo mejora y una partida en curso en pausa
- **WHEN** se pinta cada uno
- **THEN** el overlay de resultados no es visible en ninguno de los tres, ni los botones `Exportar` e `Importar` del
  overlay

#### Scenario: Sin overlay en el menú
- **GIVEN** el menú de inicio al cargar y, en otra carga, el menú tras `Volver al menú`
- **WHEN** se pintan 60 frames en cada caso
- **THEN** el overlay de resultados no es visible en ningún frame

#### Scenario: Aparece en el mismo frame en que termina la partida
- **GIVEN** un snapshot pintado en curso en el tick n − 1 y el siguiente terminado en el tick n
- **WHEN** se pinta el segundo
- **THEN** el overlay de resultados es visible en ese frame

#### Scenario: Récords en la primera partida
- **GIVEN** un navegador sin progreso guardado y una partida terminada con derrota en el tick 1.259, nivel 3 y
  41 bajas
- **WHEN** se pinta el overlay de resultados
- **THEN** muestra `Mejor tiempo` `00:20`, `Mejor nivel` 3 y `Máx. bajas` 41, y los botones `Exportar` e `Importar`
- **AND** no muestra el aviso `no se guarda` ni el aviso `dañados`

#### Scenario: Récords anteriores mejores que la partida
- **GIVEN** un progreso guardado con récords (`bestTimeSeconds` 300, `bestLevel` 8, `maxKills` 120) y una partida
  terminada con derrota en el tick 1.259, nivel 10 y 41 bajas
- **WHEN** se pinta el overlay de resultados
- **THEN** muestra `Mejor tiempo` `05:00`, `Mejor nivel` 10 y `Máx. bajas` 120

#### Scenario: Récords tras importar
- **GIVEN** el overlay de resultados mostrando récords (20, 3, 41) y un fichero válido con récords (250, 10, 90)
- **WHEN** se importa el fichero
- **THEN** el overlay muestra `Mejor tiempo` `04:10`, `Mejor nivel` 10, `Máx. bajas` 90 y el mensaje con `importado`

#### Scenario: Aviso sin persistencia
- **GIVEN** un almacenamiento del navegador que lanza `SecurityError`
- **WHEN** termina una partida y se pinta el overlay de resultados
- **THEN** el overlay muestra el aviso con `no se guarda`, los récords de la partida y los botones `Exportar` e
  `Importar`

#### Scenario: Aviso de datos dañados solo en la primera partida
- **GIVEN** una carga con datos guardados dañados y almacenamiento que escribe bien
- **WHEN** terminan la primera y la segunda partida de esa carga
- **THEN** el overlay de la primera muestra el aviso con `dañados` y el de la segunda no

#### Scenario: Aviso de datos dañados tras una partida abandonada
- **GIVEN** una carga sin `?e2e` con datos guardados dañados y almacenamiento que escribe bien
- **WHEN** se pulsa `Jugar`, se abandona la partida con Esc y `Volver al menú`, se pulsa `Jugar` y esa partida
  termina
- **THEN** su overlay de resultados muestra el aviso con `dañados` (es la primera partida terminada de la carga)

### Requirement: Tiempo sobrevivido
La vista SHALL calcular el tiempo sobrevivido como los segundos enteros completos del tiempo de partida:
⌊`snapshot.tick` / 60⌋, en formato `mm:ss` con `ss` de 2 dígitos (00–59) y `mm` de al menos 2 dígitos, sin acotar
a 59.

#### Scenario: Valores de borde
- **GIVEN** snapshots terminados en los ticks 59, 60, 1.259, 35.999 y 36.000
- **WHEN** se calcula el tiempo sobrevivido de cada uno
- **THEN** vale `00:00`, `00:01`, `00:20`, `09:59` y `10:00` respectivamente

#### Scenario: Más de una hora
- **GIVEN** un snapshot terminado en el tick 360.000 (partida con `durationSeconds` 6.000)
- **WHEN** se calcula el tiempo sobrevivido
- **THEN** vale `100:00`

### Requirement: Reinicio con la tecla R
El sistema SHALL, al pulsar la tecla R con la partida terminada (victoria o derrota), descartar la partida terminada
y empezar exactamente una partida nueva con el mismo contenido y una semilla nueva (ver `simulation-loop`), sin
recargar la página. Con la partida en curso (con o sin pausa) o eligiendo mejora, y en el menú de inicio (incluido el
diálogo de `Borrar datos`), la tecla R MUST NOT hacer nada. Con la partida terminada, las teclas 1, 2 y 3, la tecla
Esc y el input de movimiento no hacen nada (ver `run-state`, `upgrades` y `main-menu`).

#### Scenario: Reinicio tras una derrota
- **GIVEN** una partida terminada con derrota y el overlay de resultados visible
- **WHEN** se pulsa la tecla R
- **THEN** el siguiente snapshot pintado es el de una partida nueva en curso, sin resultado
- **AND** el overlay de resultados deja de verse

#### Scenario: Reinicio tras una victoria
- **GIVEN** una partida terminada con victoria en el tick 36.000
- **WHEN** se pulsa la tecla R
- **THEN** el siguiente snapshot pintado es el de una partida nueva en curso, sin resultado y con tick ≤ 15

#### Scenario: R durante la partida
- **GIVEN** una partida en curso en el tick 500 con 4 bajas
- **WHEN** se pulsa la tecla R y el motor informa de 1 frame de 16,667 ms
- **THEN** el snapshot tiene tick 501, las bajas valen ≥ 4 y la partida no se ha reiniciado

#### Scenario: R mientras se elige mejora
- **GIVEN** una partida eligiendo mejora en el tick n con el overlay de elección visible
- **WHEN** se pulsa la tecla R
- **THEN** el snapshot sigue en el tick n con la misma oferta y el overlay de elección sigue visible
- **AND** al pulsar después la tecla 1 se elige la opción de índice 0 de esa oferta

#### Scenario: R en pausa
- **GIVEN** una partida en pausa en el tick 500 con 4 bajas
- **WHEN** se pulsa la tecla R, se pintan 60 frames y se reanuda con Esc
- **THEN** durante esos 60 frames el snapshot sigue igual campo a campo al del tick 500 y el overlay de pausa sigue
  visible
- **AND** tras reanudar y 1 frame de 16,667 ms el snapshot tiene tick 501 y 4 bajas o más (no se ha reiniciado)

#### Scenario: R en el menú
- **GIVEN** el menú de inicio al cargar y, en otra carga, el menú tras `Volver al menú`
- **WHEN** se pulsa la tecla R y se pintan 60 frames
- **THEN** el menú sigue visible y no existe ninguna partida

#### Scenario: Una pulsación, una partida nueva
- **GIVEN** una partida terminada
- **WHEN** se pulsa la tecla R, se mantiene pulsada 60 frames y se suelta
- **THEN** se ha creado exactamente 1 partida nueva y su snapshot avanza con normalidad (tick ≥ 45 tras esos 60
  frames de 16,667 ms)

#### Scenario: Teclas sin efecto con la partida terminada
- **GIVEN** una partida terminada en el tick n
- **WHEN** se pulsan las teclas 1, 2, 3 y Esc y se mantiene input (1, 1) durante 60 frames, sin pulsar R
- **THEN** el snapshot sigue igual campo a campo al del tick n, el overlay de resultados sigue visible y el overlay
  de pausa no es visible

### Requirement: Partida nueva tras reiniciar
El sistema SHALL empezar la partida nueva desde cero, sin arrastrar nada de la terminada: tick 0, estado en curso,
sin resultado, vida y vida máxima iguales a la vida máxima base del contenido (sin mejoras), jugador no
invulnerable y en la posición inicial, nivel 1, XP 0, XP para el siguiente nivel la del nivel 1, 0 bajas, ninguna
mejora adquirida, sin oferta, sin enemigos, proyectiles, pulsos ni gemas, todas las armas cargadas y el director en
su estado inicial (presupuesto 0 y tramo inicial).

#### Scenario: Estado inicial tras reiniciar una partida avanzada
- **GIVEN** una partida terminada con derrota en el tick 20.000, nivel 15, `guardrail` en nivel 2 (vida máxima
  140), 900 bajas, ≥ 1 enemigo, ≥ 1 proyectil y ≥ 1 gema en el snapshot
- **WHEN** se pulsa la tecla R y se lee el snapshot de la partida nueva antes de su primer tick
- **THEN** tick 0, estado en curso, sin resultado, vida 100 de 100, no invulnerable, nivel 1, XP 0, XP para el
  siguiente nivel 5, 0 bajas, sin mejoras adquiridas, sin oferta y listas de enemigos, proyectiles, pulsos y gemas
  vacías
- **AND** la lista de armas es `linter` y `tests`, en ese orden, ambas cargadas

#### Scenario: La partida nueva juega con normalidad
- **GIVEN** la partida nueva del escenario anterior
- **WHEN** se ejecutan 600 ticks
- **THEN** `snapshot.tick` vale 600 y la partida avanza según las reglas de una partida recién creada (aparecen
  enemigos y las armas disparan)

#### Scenario: Equivalente a una partida recién creada
- **GIVEN** una partida nueva obtenida al reiniciar con la semilla S y otra partida recién creada en otra carga con
  la misma semilla S y el mismo contenido
- **WHEN** ambas reciben la misma secuencia de 600 inputs con la política de elección fija
- **THEN** sus snapshots son iguales campo a campo en cada tick

### Requirement: Vista limpia tras reiniciar
La vista SHALL pintar, desde el primer frame de la partida nueva, exactamente los elementos de su snapshot: MUST
NOT quedar visible ningún sprite de enemigo, cadáver (aunque su animación de muerte no haya terminado, ver
`sprite-rendering`), proyectil, pulso o gema de la partida terminada, ni el overlay de resultados ni el de elección.
El jugador de la partida nueva se pinta en su posición inicial, en `idle` y sin heredar la orientación de la partida
terminada. El HUD muestra los valores de la partida nueva. Reiniciar varias veces seguidas MUST NOT dejar sprites
visibles que no correspondan al snapshot.

#### Scenario: Primer frame tras reiniciar
- **GIVEN** una partida terminada ya pintada con 200 enemigos, 32 proyectiles, 1 pulso, 300 gemas y 10 cadáveres en
  curso
- **WHEN** se pulsa la tecla R y se pinta el snapshot de la partida nueva en el tick 0
- **THEN** hay 0 sprites visibles de enemigo, cadáver, proyectil, pulso y gema, y el overlay de resultados no es
  visible
- **AND** el jugador es visible en su posición inicial, reproduce `idle` y no está volteado (ver `sprite-rendering`)
- **AND** el HUD muestra vida `100/100`, tiempo `10:00`, nivel 1 y 0 bajas

#### Scenario: Cinco reinicios seguidos
- **GIVEN** una sesión con `?e2e` en la que se juegan y terminan 5 partidas seguidas, reiniciando con R tras cada
  una, cada una con ≥ 1 enemigo y ≥ 1 gema al terminar
- **WHEN** se pinta cada snapshot de la sexta partida durante 600 ticks
- **THEN** en cada frame la sonda de render informa de un número de sprites visibles de enemigo, proyectil, pulso y
  gema igual al número de enemigos, proyectiles, pulsos y gemas del snapshot pintado
- **AND** en el primer frame de cada una de las 5 partidas nuevas la sonda informa de 0 cadáveres

### Requirement: Bucle completo observable en el navegador
El sistema SHALL permitir, en el juego real, recorrer el bucle jugar → perder → ver resultados → reiniciar → volver
a jugar sin recargar la página, y el bucle jugar → perder → exportar → recargar → importar conservando los récords y
el historial. La victoria no se comprueba en el navegador (solo en el núcleo, ver `run-outcome`).

#### Scenario: Derrota y reinicio en el navegador
- **GIVEN** la build de producción servida con `?seed=42` y sin input de movimiento del jugador
- **WHEN** una prueba E2E deja jugar, pulsando la tecla 1 cada vez que aparece el overlay de elección, hasta que la
  partida termina (como mucho 120 s de juego; plazo provisional, a medir en apply)
- **THEN** la partida está terminada con resultado derrota y el overlay de resultados es visible con el título
  `Derrota`, el tiempo sobrevivido ⌊tick / 60⌋ en `mm:ss`, el nivel y las bajas del snapshot
- **AND** tras pulsar la tecla R, en el primer segundo de la partida nueva (tick ≤ 60) el estado es en curso, sin
  resultado, con 0 bajas, nivel 1, XP 0 y el overlay de resultados no visible

#### Scenario: Exportar, recargar e importar en el navegador
- **GIVEN** la build de producción servida con `?seed=42`, sin progreso guardado, y una partida jugada como en el
  escenario anterior hasta la derrota, con el overlay mostrando los récords R
- **WHEN** la prueba pulsa `Exportar`, guarda el fichero descargado, borra el almacenamiento del navegador, recarga
  la página, juega de nuevo hasta la derrota e importa el fichero guardado
- **THEN** el fichero descargado se llama `sprint-survivors-progress.json` y su historial contiene 1 entrada con
  `seed` 42, `outcome` `defeat` y el tiempo, nivel y bajas de la primera partida
- **AND** tras importar, el overlay muestra el mensaje con `importado` y unos récords iguales campo a campo al
  máximo de R y de los de la segunda partida, y un nuevo `Exportar` contiene las 2 entradas

#### Scenario: Imports rechazados en el navegador
- **GIVEN** la build de producción con una partida terminada y el overlay mostrando los récords R
- **WHEN** la prueba importa un fichero con el texto `hola` y después uno de 65.537 bytes
- **THEN** el overlay muestra el mensaje con `no válido` tras el primero y el mensaje con `64 KiB` tras el segundo
- **AND** los récords mostrados siguen siendo R y un nuevo `Exportar` devuelve el mismo progreso que antes de
  ambos imports

### Requirement: Acciones de progreso sin efecto en la partida
El sistema SHALL tratar los botones **Exportar** e **Importar** del overlay de resultados y los botones **Exportar**,
**Importar** y **Borrar datos** del menú de inicio como acciones sobre el progreso (ver `progress-persistence`):
pulsarlos, elegir o cancelar un fichero, confirmar o cancelar el borrado y cualquier mensaje resultante MUST NOT
cambiar el snapshot de la partida terminada ni empezar una partida nueva. Tras usar los botones del overlay, la tecla
R MUST seguir reiniciando con una sola pulsación; tras usar los del menú, `Jugar` MUST seguir empezando una partida
con una sola pulsación y Esc MUST pausar esa partida con una sola pulsación. Los mensajes del import, del borrado y
el aviso de datos dañados MUST NOT verse en el overlay de la partida siguiente ni pasar del menú al overlay de
resultados o del overlay al menú, salvo que se vuelvan a producir en ese sitio.

#### Scenario: Exportar no cambia la partida
- **GIVEN** una partida terminada en el tick n con el overlay de resultados visible
- **WHEN** se pulsa **Exportar** y se pintan 60 frames
- **THEN** el snapshot sigue igual campo a campo al del tick n y el overlay de resultados sigue visible

#### Scenario: R tras usar los botones
- **GIVEN** una partida terminada en la que se ha pulsado **Exportar** y después **Importar** con un fichero válido
- **WHEN** se pulsa la tecla R una vez
- **THEN** se crea exactamente 1 partida nueva en curso y el overlay de resultados deja de verse

#### Scenario: Mensajes que no se arrastran
- **GIVEN** una partida terminada en la que un import rechazado mostró el mensaje con `no válido`
- **WHEN** se reinicia con R y la partida nueva termina
- **THEN** su overlay de resultados no muestra el mensaje con `no válido` ni el de éxito del import

#### Scenario: Mensajes del menú que no pasan al overlay
- **GIVEN** el menú de inicio en el que un import mostró el mensaje con `importado`, otro el de `no válido` y un
  borrado confirmado el de `borrado`
- **WHEN** se pulsa `Jugar` y la partida termina
- **THEN** el overlay de resultados no muestra ninguno de esos tres mensajes

#### Scenario: Mensajes del overlay que no pasan al menú
- **GIVEN** una partida terminada en la que un import rechazado mostró el mensaje con `no válido`
- **WHEN** se pulsa R, se pausa con Esc y se pulsa `Volver al menú`
- **THEN** el menú de inicio no muestra el mensaje con `no válido` ni el de éxito del import

#### Scenario: Jugar y Esc tras usar los botones del menú
- **GIVEN** el menú de inicio en el que se ha pulsado **Exportar**, **Importar** con un fichero válido y **Borrar
  datos** con `Cancelar`
- **WHEN** se pulsa `Jugar` una vez, se pintan 30 frames y se pulsa Esc una vez
- **THEN** existe exactamente 1 partida y está en pausa con el overlay de pausa visible

### Requirement: Nombre del juego en los mensajes de resultados
El sistema SHALL usar `Greentide Vanguard` cuando un mensaje del overlay de resultados, del menú de inicio o un aviso
por consola sobre el progreso nombra el juego: el mensaje de import rechazado (el que contiene `no válido`) y el
aviso de datos dañados (el que menciona `progress`). Ninguno de esos mensajes MUST contener `Sprint Survivors`. Los
fragmentos que fijan otras specs (`importado`, `no válido`, `64 KiB`, `borrado`, `progress`) se conservan.

#### Scenario: Import rechazado
- **GIVEN** una partida terminada con el overlay de resultados visible
- **WHEN** se importa un fichero con el texto `hola`
- **THEN** el overlay muestra un mensaje que contiene `no válido` y `Greentide Vanguard` y no contiene
  `Sprint Survivors`

#### Scenario: Aviso de datos dañados
- **GIVEN** un valor `{ roto` guardado en `sprint-survivors/progress`
- **WHEN** se carga la página
- **THEN** se emite 1 aviso por consola que menciona `progress` y ningún aviso ni mensaje visible contiene
  `Sprint Survivors`

### Requirement: Overlay de resultados centrado en la ventana
La vista SHALL centrar en la ventana el overlay de resultados (título, tiempo, nivel, bajas, indicación de R, récords,
botones `Exportar` e `Importar`, mensajes y avisos): su centro horizontal MUST coincidir con el de la ventana (error
≤ 1 px) y su contenido MUST quedar centrado en vertical (la distancia de su borde superior al de la ventana y la de su
borde inferior al de la ventana difieren ≤ 1 px). Con una ventana ≥ 960 × 540 en ambos ejes, todo su contenido MUST
quedar entero dentro de la ventana y sin solaparse, también con el aviso `no se guarda`, el de `dañados` y un mensaje
de import a la vez. Al redimensionar, se reubica desde el primer frame pintado tras el cambio, los botones responden al
clic en su posición nueva y la partida terminada no cambia (ver "Redimensionado de la ventana" en `world-camera`).

#### Scenario: Resultados centrados
- **GIVEN** una partida terminada con derrota en el tick 1.259, nivel 3 y 41 bajas, pintada con una ventana de
  1.280 × 720, y en otra carga con una de 2.560 × 1.440
- **WHEN** se pinta el overlay de resultados
- **THEN** su centro horizontal está en x = 640 y x = 1.280 respectivamente (error ≤ 1 px) y su contenido está entero
  dentro de la ventana

#### Scenario: Contenido máximo en la ventana mínima
- **GIVEN** una ventana de 960 × 540 y una partida terminada cuyo overlay muestra, a la vez, el aviso `no se guarda`,
  el aviso `dañados` y el mensaje de import con `no válido`
- **WHEN** se pinta el overlay de resultados
- **THEN** el título, el tiempo, el nivel, las bajas, la indicación de R, los tres récords, los dos botones, el
  mensaje y los dos avisos están enteros dentro de la ventana y no se solapan

#### Scenario: Botones tras redimensionar
- **GIVEN** una partida terminada en el tick n con el overlay de resultados visible y una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 1.000 × 600, se pinta 1 frame y se pulsa `Exportar` en su posición nueva
- **THEN** se descarga exactamente 1 fichero `sprint-survivors-progress.json` y el snapshot sigue igual campo a campo
  al del tick n
- **AND** la tecla R sigue empezando exactamente 1 partida nueva con una sola pulsación

<!-- historial: 0006-run-lifecycle-hud (2026-11-20) -->
<!-- historial: 0007-local-save-export (2026-11-20) -->
<!-- historial: 0009-main-menu (2026-11-20) -->
<!-- historial: 0012-sprite-rendering (2026-11-22) -->
<!-- historial: 0017-fullscreen-view (2026-11-24) -->
