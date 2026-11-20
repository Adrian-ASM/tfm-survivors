# Spec delta · progress-persistence

<!-- Ruta: openspec/changes/0009-main-menu/specs/progress-persistence/spec.md
     Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test. -->

> Motivo: el menú de inicio (ver `main-menu`) añade Borrar datos y un segundo sitio desde el que exportar e
> importar. "Panel de origen" es el sitio donde se pulsó el botón: el overlay de resultados o el menú de inicio.
> La "Política de seguridad de contenido" no cambia aquí (su última versión es la del delta de 0008).

## ADDED Requirements

### Requirement: Borrado del progreso
El sistema SHALL, al confirmar `Borrar datos` en el menú de inicio (ver `main-menu`), dejar el progreso en uso igual
al progreso vacío y borrar el progreso guardado, de modo que una carga posterior obtenga el progreso vacío sin avisos.
El menú MUST mostrar un mensaje que contiene `borrado`. El borrado:
- con datos guardados dañados, MUST eliminar también esos datos: la carga siguiente no emite el aviso que menciona
  `progress` y el overlay de la primera partida terminada de la carga actual MUST NOT mostrar el aviso `dañados`;
- sin almacenamiento disponible (no existe o lanza al leer), deja vacío el progreso en uso, muestra el mensaje con
  `borrado` y no produce errores no capturados;
- si el almacenamiento lanza al borrar o escribir, deja vacío el progreso en uso, el valor guardado no cambia, el menú
  muestra un mensaje que contiene `no se ha podido borrar` en lugar del de `borrado` y no hay errores no capturados.

Cancelar el diálogo MUST dejar el progreso en uso y el guardado idénticos (el guardado, byte a byte), sin escrituras
ni borrados del almacenamiento, también con datos guardados dañados. Borrar MUST NOT afectar a la semilla, la
velocidad ni a ninguna partida.

#### Scenario: Borrado confirmado
- **GIVEN** un progreso guardado con récords (300, 8, 120) y 3 entradas de historial
- **WHEN** se confirma `Borrar datos` y se lee el progreso en uso
- **THEN** vale `schemaVersion` 1, récords (0, 0, 0) e historial vacío y el menú muestra el mensaje con `borrado`
- **AND** tras recargar la página, el progreso cargado es el vacío y no hay avisos que mencionen `progress`

#### Scenario: Partida tras borrar
- **GIVEN** un progreso con récords (300, 8, 120) borrado con confirmación en el menú
- **WHEN** se pulsa `Jugar` y la partida termina con derrota en el tick 1.259, nivel 3 y 41 bajas
- **THEN** el overlay de resultados muestra `Mejor tiempo` `00:20`, `Mejor nivel` 3 y `Máx. bajas` 41
- **AND** el progreso guardado tiene exactamente 1 entrada de historial

#### Scenario: Cancelar sin cambios
- **GIVEN** un progreso guardado G con 3 entradas
- **WHEN** se pulsa `Borrar datos` y `Cancelar`
- **THEN** el progreso en uso es igual campo a campo al de antes, el valor guardado es G byte a byte y se han hecho 0
  escrituras y 0 borrados del almacenamiento

#### Scenario: Borrar datos dañados
- **GIVEN** el almacenamiento con el valor guardado `{"schemaVersion":1,"records":` (JSON truncado), que emitió 1
  aviso que menciona `progress` al cargar
- **WHEN** se confirma `Borrar datos`, se pulsa `Jugar` y la partida termina
- **THEN** el overlay de resultados no muestra el aviso con `dañados`
- **AND** en una carga posterior sin partidas intermedias el progreso es el vacío y no se emite ningún aviso que
  mencione `progress`

#### Scenario: Cancelar con datos dañados
- **GIVEN** el almacenamiento con el valor guardado `{"schemaVersion":1,"records":`
- **WHEN** se pulsa `Borrar datos`, `Cancelar`, `Jugar` y la partida termina
- **THEN** el overlay de resultados muestra el aviso con `dañados`
- **AND** antes de terminar la partida el valor guardado sigue siendo `{"schemaVersion":1,"records":`

#### Scenario: Borrar sin almacenamiento
- **GIVEN** un almacenamiento que lanza `SecurityError` al leer, escribir y borrar, y una partida terminada en esta
  carga con récords (20, 3, 41) seguida de `R`, Esc y `Volver al menú`
- **WHEN** se confirma `Borrar datos` y se pulsa `Exportar`
- **THEN** el fichero exportado es igual campo a campo al progreso vacío y el menú muestra el mensaje con `borrado`
- **AND** no hay errores no capturados en la consola

#### Scenario: Fallo al borrar
- **GIVEN** un almacenamiento que lee bien un progreso G y lanza `QuotaExceededError` al escribir y al borrar
- **WHEN** se confirma `Borrar datos`
- **THEN** el progreso en uso es el vacío, el valor guardado sigue siendo G y el menú muestra el mensaje con
  `no se ha podido borrar`
- **AND** no hay errores no capturados en la consola

#### Scenario: Borrar el progreso vacío
- **GIVEN** un navegador sin progreso guardado
- **WHEN** se confirma `Borrar datos` dos veces seguidas (dos diálogos)
- **THEN** el progreso en uso es el vacío, el menú muestra el mensaje con `borrado` y una carga posterior obtiene el
  progreso vacío sin avisos

## MODIFIED Requirements

### Requirement: Guardado automático al terminar la partida
El sistema SHALL registrar y guardar en el almacenamiento del navegador cada partida terminada (victoria o derrota)
exactamente una vez, antes de que el reinicio con la tecla R pueda empezar la partida siguiente. Una partida en curso,
en pausa, eligiendo mejora o abandonada sin terminar (cerrar o recargar la pestaña, o `Volver al menú` desde la
pausa, ver `main-menu`) MUST NOT guardarse ni registrarse en el historial ni en los récords. Guardar MUST NOT cambiar
la simulación.

#### Scenario: Un guardado por partida
- **GIVEN** una partida que termina con derrota en el tick n
- **WHEN** el overlay de resultados se pinta durante 300 frames sin pulsar R
- **THEN** se ha hecho exactamente 1 escritura de progreso y el historial guardado tiene 1 entrada más que antes

#### Scenario: Reinicio inmediato
- **GIVEN** una partida que termina en el tick n
- **WHEN** se pulsa la tecla R en el primer frame en que el overlay de resultados es visible
- **THEN** el progreso guardado contiene la partida terminada antes de que la partida nueva ejecute su tick 1
- **AND** se ha hecho exactamente 1 escritura de progreso por esa partida

#### Scenario: Varias partidas en la misma carga
- **GIVEN** una carga en la que se terminan 3 partidas seguidas reiniciando con R
- **WHEN** se lee el progreso guardado
- **THEN** el historial tiene 3 entradas más que al cargar, una por partida, de la más reciente a la más antigua

#### Scenario: Partida sin terminar
- **GIVEN** una partida en curso en el tick 5.000
- **WHEN** se recarga la página
- **THEN** el progreso guardado es el mismo que antes de empezar esa partida

#### Scenario: Partida abandonada con Volver al menú
- **GIVEN** un progreso en uso y guardado P, y una partida en pausa en el tick 5.000 con nivel 6 y 41 bajas
- **WHEN** se pulsa `Volver al menú`
- **THEN** se han hecho 0 escrituras de progreso y el progreso en uso y el guardado siguen siendo P
- **AND** si después se pulsa `Jugar` y esa partida termina, el historial tiene exactamente 1 entrada más que P

#### Scenario: Pausa sin guardado
- **GIVEN** una partida en curso en el tick 500
- **WHEN** se pausa, el motor informa de 300 frames y se reanuda
- **THEN** se han hecho 0 escrituras de progreso

### Requirement: Carga del progreso guardado
El sistema SHALL, al cargar la página, leer el progreso guardado y validarlo (ver "Validación del progreso"):
- si no hay nada guardado, usa el progreso vacío sin avisar;
- si es válido, lo usa;
- si está dañado (no es JSON, no cumple el esquema o tiene una `schemaVersion` desconocida), usa el progreso vacío,
  emite exactamente 1 aviso por consola que menciona `progress` y MUST NOT sobrescribir ni borrar los datos dañados
  hasta el siguiente guardado (fin de partida, import válido o `Borrar datos` confirmado). El overlay de resultados
  de la primera partida terminada de esa carga MUST mostrar el aviso de datos dañados (ver `run-results`), salvo que
  antes se haya confirmado `Borrar datos` (ver "Borrado del progreso").

La carga del progreso ocurre igual con o sin menú de inicio y con o sin `?e2e`; mostrar el menú no escribe en el
almacenamiento.

#### Scenario: Recarga tras una partida
- **GIVEN** un progreso guardado con récords (20, 3, 41) y 1 entrada de historial
- **WHEN** se recarga la página y se lee el progreso
- **THEN** los récords valen (20, 3, 41) y el historial tiene esa misma entrada campo a campo

#### Scenario: Datos guardados dañados
- **GIVEN** el almacenamiento con el valor guardado `{"schemaVersion":1,"records":` (JSON truncado)
- **WHEN** se carga la página
- **THEN** el progreso en uso es el vacío y se emite exactamente 1 aviso por consola que menciona `progress`
- **AND** el valor guardado sigue siendo `{"schemaVersion":1,"records":` mientras no termine ninguna partida, no se
  importe un fichero válido ni se confirme `Borrar datos`

#### Scenario: Datos dañados con el menú abierto
- **GIVEN** el almacenamiento con el valor guardado `{"schemaVersion":1,"records":` y una carga sin `?e2e`
- **WHEN** se pintan 300 frames en el menú, se pulsa `Exportar` y se cancela un `Borrar datos`
- **THEN** el valor guardado sigue siendo `{"schemaVersion":1,"records":` y el fichero exportado es el progreso vacío

#### Scenario: Versión futura guardada
- **GIVEN** el almacenamiento con un progreso por lo demás válido con `schemaVersion` 2
- **WHEN** se carga la página
- **THEN** el progreso en uso es el vacío, hay 1 aviso por consola y el valor guardado no cambia

#### Scenario: Primer guardado tras datos dañados
- **GIVEN** una carga con datos guardados dañados
- **WHEN** termina una partida con derrota en el tick 1.259, nivel 3 y 41 bajas
- **THEN** el progreso guardado es válido, con récords (20, 3, 41) y 1 entrada de historial

### Requirement: Exportar el progreso
El sistema SHALL, al pulsar el botón **Exportar** del overlay de resultados o del menú de inicio, descargar un fichero
llamado `sprint-survivors-progress.json` con el progreso en uso en ese momento (incluidas las partidas terminadas de
la carga, los imports válidos y el efecto de un `Borrar datos` confirmado) en el formato del "Modelo de progreso",
sin pedir confirmación. Exportar MUST NOT modificar el progreso guardado ni la partida, y desde el menú MUST NOT
empezar ninguna partida.

#### Scenario: Exportar tras una partida
- **GIVEN** el overlay de resultados visible tras una derrota y un progreso en uso con récords (20, 3, 41) y 1 entrada
- **WHEN** se pulsa **Exportar**
- **THEN** se descarga exactamente 1 fichero `sprint-survivors-progress.json`, válido según "Validación del
  progreso", igual campo a campo al progreso en uso

#### Scenario: Exportar desde el menú
- **GIVEN** el menú de inicio visible y un progreso guardado G válido con 2 entradas
- **WHEN** se pulsa **Exportar**
- **THEN** se descarga exactamente 1 fichero `sprint-survivors-progress.json` igual campo a campo a G y no empieza
  ninguna partida

#### Scenario: Mismo fichero desde los dos sitios
- **GIVEN** una partida terminada con el overlay de resultados visible, en la que se pulsa **Exportar** (E1), y la
  misma carga tras pulsar R, Esc y `Volver al menú`
- **WHEN** se pulsa **Exportar** en el menú (E2)
- **THEN** E2 es igual byte a byte a E1

#### Scenario: Ida y vuelta
- **GIVEN** un fichero exportado desde el progreso P
- **WHEN** se importa ese fichero sobre el progreso vacío
- **THEN** el progreso resultante es igual campo a campo a P

#### Scenario: Tamaño del fichero máximo
- **GIVEN** un progreso con 10 entradas de historial y todos los números en su valor máximo válido
- **WHEN** se exporta
- **THEN** el fichero ocupa menos de 65.536 bytes y se puede importar sin rechazo

### Requirement: Import con fusión
El sistema SHALL, al elegir un fichero válido con el botón **Importar** del overlay de resultados o del menú de
inicio, fusionarlo con el progreso en uso sin pedir confirmación, usar el resultado como progreso en uso, guardarlo y
mostrar un mensaje de éxito en el panel de origen. En el overlay de resultados se muestran además los récords
fusionados. La fusión MUST cumplir:
- cada récord es el máximo entre el valor en uso y el importado;
- el historial es la unión de ambos sin duplicados, ordenada de más reciente a más antigua por `playedAt` y
  recortada a las 10 más recientes. Dos entradas son duplicadas si y solo si coinciden en sus 6 campos;
- el resultado no depende del orden de los operandos (fusionar A con B da lo mismo que B con A), también con
  entradas distintas de igual `playedAt`;
- fusionar un progreso consigo mismo, o importar dos veces el mismo fichero, no cambia nada.

Si se cancela el selector de fichero, nada cambia y no se muestra ningún mensaje. Importar desde el menú MUST NOT
empezar ninguna partida.

#### Scenario: Récords máximos
- **GIVEN** un progreso en uso con récords (300, 8, 120) y un fichero con récords (250, 10, 90)
- **WHEN** se importa
- **THEN** los récords en uso y guardados valen (300, 10, 120) y el overlay muestra esos valores y el mensaje de éxito

#### Scenario: Importar desde el menú
- **GIVEN** el menú de inicio visible, un progreso en uso con récords (300, 8, 120) y un fichero con récords
  (250, 10, 90)
- **WHEN** se importa
- **THEN** los récords en uso y guardados valen (300, 10, 120), el menú muestra el mensaje con `importado` y no
  existe ninguna partida

#### Scenario: Importar tras borrar
- **GIVEN** el menú de inicio con un progreso borrado con confirmación y un fichero válido F
- **WHEN** se importa F
- **THEN** el progreso en uso y el guardado son iguales a F normalizado

#### Scenario: Cancelar el selector en el menú
- **GIVEN** el menú de inicio visible y un progreso guardado G
- **WHEN** se pulsa **Importar** y se cancela el selector de fichero
- **THEN** el valor guardado sigue siendo G byte a byte y el menú no muestra ningún mensaje de import

#### Scenario: Importar dos veces el mismo fichero
- **GIVEN** un progreso en uso P y un fichero F
- **WHEN** se importa F y después se vuelve a importar F
- **THEN** el progreso tras el segundo import es igual campo a campo al que había tras el primero

#### Scenario: Duplicado solo si coinciden todos los campos
- **GIVEN** una entrada en uso `{playedAt 5.000, seed 42, defeat, 20 s, nivel 3, 41 bajas}` y otra importada igual
  salvo `kills` 42
- **WHEN** se importa
- **THEN** el historial contiene ambas entradas
- **AND** si la importada fuera igual en los 6 campos, el historial contendría solo una

#### Scenario: Historial recortado al fusionar
- **GIVEN** 10 entradas en uso con `playedAt` 1, 3, …, 19 y un fichero con 10 entradas distintas con `playedAt`
  2, 4, …, 20
- **WHEN** se importa
- **THEN** el historial tiene exactamente 10 entradas, con `playedAt` 20, 19, 18, …, 11

#### Scenario: Fusión conmutativa con fechas empatadas
- **GIVEN** dos progresos A y B con entradas distintas que comparten `playedAt` 5.000
- **WHEN** se fusiona A con B y, por separado, B con A
- **THEN** ambos resultados son iguales campo a campo, incluido el orden del historial

#### Scenario: Import sobre datos guardados dañados
- **GIVEN** una carga con datos guardados dañados (progreso en uso vacío) y un fichero válido F
- **WHEN** se importa F
- **THEN** el progreso en uso y el guardado son iguales a F normalizado

### Requirement: Rechazo de imports inválidos
El sistema SHALL rechazar el fichero elegido, sin modificar el progreso en uso ni el guardado, cuando:
- ocupa más de 65.536 bytes (64 × 1.024): se comprueba antes de leer su contenido y el panel de origen muestra un
  mensaje que contiene `64 KiB`;
- su contenido no es JSON, no cumple "Validación del progreso" o tiene una `schemaVersion` desconocida: el panel de
  origen muestra un mensaje que contiene `no válido`.

Un fichero de exactamente 65.536 bytes con contenido válido MUST aceptarse. Un rechazo MUST NOT afectar a la partida
ni impedir reiniciar con R desde el overlay de resultados ni pulsar `Jugar` desde el menú.

#### Scenario: Fichero demasiado grande
- **GIVEN** un progreso guardado G y un fichero de 65.537 bytes
- **WHEN** se importa
- **THEN** el panel de origen muestra el mensaje con `64 KiB`, el contenido del fichero no se llega a leer y el
  progreso en uso y el guardado siguen siendo G

#### Scenario: Fichero en el límite
- **GIVEN** un fichero de exactamente 65.536 bytes con un progreso válido seguido de espacios en blanco
- **WHEN** se importa
- **THEN** se acepta y se fusiona

#### Scenario: Fichero no JSON o fuera de esquema
- **GIVEN** un progreso guardado G y, por separado, un fichero con el texto `hola`, uno con `schemaVersion` 2 y uno
  con un campo extra
- **WHEN** se importa cada uno
- **THEN** en los tres casos el panel de origen muestra el mensaje con `no válido` y el progreso en uso y el
  guardado siguen siendo G

#### Scenario: Rechazo en el menú y Jugar
- **GIVEN** el menú de inicio en el que se ha rechazado un fichero con el texto `hola`
- **WHEN** se pulsa `Jugar` una vez
- **THEN** se crea exactamente 1 partida en curso

### Requirement: Juego sin almacenamiento disponible
El sistema SHALL permitir jugar con normalidad cuando el almacenamiento del navegador no existe o falla al leer, al
escribir o al borrar (por ejemplo `SecurityError` o `QuotaExceededError`): ningún fallo de almacenamiento MUST
detener el juego, el menú de inicio, la partida, la pausa, el reinicio con R ni `Jugar`. En ese caso el progreso se
mantiene solo en memoria durante la carga (los récords y el historial incluyen las partidas de esa carga y los
imports válidos, y un `Borrar datos` confirmado lo vacía), Exportar, Importar y Borrar datos siguen funcionando sobre
ese progreso en memoria y el overlay de resultados MUST mostrar el aviso de sin persistencia (ver `run-results`).

#### Scenario: Almacenamiento bloqueado
- **GIVEN** un navegador cuyo almacenamiento lanza `SecurityError` al leer y al escribir
- **WHEN** se juega una partida hasta la derrota y se pulsa R
- **THEN** el overlay de resultados se ve con los récords de esa partida y el aviso de sin persistencia, y tras R
  empieza una partida nueva en curso
- **AND** no hay errores no capturados en la consola

#### Scenario: Menú con almacenamiento bloqueado
- **GIVEN** un navegador cuyo almacenamiento lanza `SecurityError` al leer, escribir y borrar, y una carga sin `?e2e`
- **WHEN** se carga la página, se pulsa `Exportar` y después `Jugar`
- **THEN** el menú de inicio se ve, el fichero exportado es el progreso vacío y empieza una partida en curso
- **AND** no hay errores no capturados en la consola

#### Scenario: Progreso en memoria durante la carga
- **GIVEN** un almacenamiento que lanza `SecurityError` y dos partidas terminadas en la misma carga con récords
  (20, 3, 41) y (15, 5, 30)
- **WHEN** se pinta el overlay de resultados de la segunda
- **THEN** muestra los récords (20, 5, 41)

#### Scenario: Almacenamiento lleno al guardar
- **GIVEN** un almacenamiento que lee bien un progreso G y lanza `QuotaExceededError` al escribir
- **WHEN** termina una partida
- **THEN** el progreso en uso incluye la partida, el overlay muestra el aviso de sin persistencia y el valor guardado
  sigue siendo G

## REMOVED Requirements
<!-- Ninguno. -->
