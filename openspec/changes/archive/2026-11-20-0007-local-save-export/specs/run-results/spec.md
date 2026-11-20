# Spec delta · run-results

<!-- Ruta: openspec/changes/0007-local-save-export/specs/run-results/spec.md
     Delta sobre openspec/specs/run-results/spec.md. El comportamiento de guardado, export, import y validación
     vive en progress-persistence; aquí solo lo que muestra y permite el overlay de resultados. -->

## ADDED Requirements

### Requirement: Acciones de progreso sin efecto en la partida
El sistema SHALL tratar los botones **Exportar** e **Importar** del overlay de resultados como acciones sobre el
progreso (ver `progress-persistence`): pulsarlos, elegir o cancelar un fichero y cualquier mensaje resultante MUST
NOT cambiar el snapshot de la partida terminada ni empezar una partida nueva. Tras usar cualquiera de los dos
botones, la tecla R MUST seguir reiniciando con una sola pulsación. Los mensajes del import y el aviso de datos
dañados MUST NOT verse en el overlay de la partida siguiente salvo que se vuelvan a producir.

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

## MODIFIED Requirements

### Requirement: Overlay de resultados
La vista SHALL mostrar un overlay de resultados si y solo si el último snapshot pintado tiene la partida terminada.
El overlay MUST mostrar:
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
  `dañados`.

Con la partida en curso o eligiendo mejora el overlay de resultados no se ve, ni tampoco sus botones, mensajes y
avisos. El overlay solo depende del snapshot y del progreso en uso: no cambia la simulación.

#### Scenario: Overlay tras una derrota
- **GIVEN** un snapshot terminado con resultado derrota en el tick 1.259, nivel 3 y 41 bajas
- **WHEN** se pinta
- **THEN** el overlay de resultados es visible con el título `Derrota`, tiempo `00:20`, nivel 3, 41 bajas y la
  indicación de la tecla R

#### Scenario: Overlay tras una victoria
- **GIVEN** un snapshot terminado con resultado victoria en el tick 36.000, nivel 18 y 2.150 bajas
- **WHEN** se pinta
- **THEN** el overlay de resultados es visible con el título `Victoria`, tiempo `10:00`, nivel 18 y 2150 bajas

#### Scenario: Sin overlay durante la partida
- **GIVEN** un snapshot en curso y otro eligiendo mejora
- **WHEN** se pinta cada uno
- **THEN** el overlay de resultados no es visible en ninguno de los dos, ni los botones `Exportar` e `Importar`

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

## REMOVED Requirements
<!-- Ninguno. -->
