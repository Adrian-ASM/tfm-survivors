# Spec delta · run-results

<!-- Ruta: openspec/changes/0009-main-menu/specs/run-results/spec.md
     Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test. -->

> Motivo: con el menú de inicio y la pausa (ver `main-menu`), R tampoco actúa en pausa ni en el menú, el overlay de
> resultados nunca convive con el de pausa ni con el menú, y Exportar/Importar existen en dos sitios cuyos mensajes
> no se mezclan. `Volver al menú` no se ofrece desde el overlay de resultados (decisión 3 de la propuesta).

## ADDED Requirements
<!-- Ninguno. -->

## MODIFIED Requirements

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

## REMOVED Requirements
<!-- Ninguno. -->
