# Spec delta · progress-persistence

<!-- Ruta: openspec/changes/0007-local-save-export/specs/progress-persistence/spec.md
     Capacidad nueva. Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test.
     Decisiones aprobadas (2026-11-20): duplicado = coincidencia en todos los campos; fecha en ms desde epoch;
     sin contadores de partidas; datos guardados corruptos -> vacío + aviso sin sobrescribir; import sin confirmación. -->

## Purpose
Conservar entre cargas de la página las mejores marcas y las últimas partidas del jugador, y permitirle llevarse esos
datos a otro navegador con un fichero JSON (exportar / importar con fusión), tratando todo dato externo como no
confiable y sin que la falta de almacenamiento impida jugar (ADR-0004, fase 1 local-first).

## ADDED Requirements

### Requirement: Modelo de progreso
El sistema SHALL representar el progreso del jugador como un documento versionado con exactamente estos campos:
- `schemaVersion`: el entero `1` (única versión existente);
- `records`: `bestTimeSeconds` (mejor tiempo sobrevivido, en segundos enteros), `bestLevel` (mejor nivel alcanzado)
  y `maxKills` (máximo de bajas en una partida). Cada récord es independiente: pueden venir de partidas distintas;
- `history`: de 0 a 10 partidas, de más reciente a más antigua. Cada entrada tiene `playedAt` (fecha de fin de la
  partida en milisegundos desde epoch, entero), `seed` (semilla de la partida), `outcome` (`victory` o `defeat`),
  `timeSeconds` (tiempo sobrevivido en segundos enteros), `level` (nivel alcanzado) y `kills` (bajas).

El progreso **vacío** tiene `schemaVersion` 1, los tres récords a 0 y el historial vacío. Este documento es también
el formato del fichero exportado. El progreso MUST NOT incluir contadores de partidas jugadas o ganadas.

#### Scenario: Progreso vacío
- **GIVEN** un navegador sin progreso guardado
- **WHEN** se obtiene el progreso inicial
- **THEN** vale `schemaVersion` 1, `bestTimeSeconds` 0, `bestLevel` 0, `maxKills` 0 y `history` vacío

#### Scenario: Orden del historial
- **GIVEN** un progreso con 3 entradas de `playedAt` 1.000, 3.000 y 2.000 (en ese orden de llegada)
- **WHEN** se lee su historial
- **THEN** las entradas aparecen con `playedAt` 3.000, 2.000 y 1.000, en ese orden

### Requirement: Registro de una partida terminada
El sistema SHALL, al registrar una partida terminada en el progreso:
- calcular `timeSeconds` como ⌊`snapshot.tick` / 60⌋ (el mismo valor que "Tiempo sobrevivido" de `run-results`);
- tomar `level`, `kills`, `outcome` y `seed` de la partida terminada;
- tomar `playedAt` del reloj de pared del sistema, inyectado como puerto (nunca leído directamente por el núcleo);
- actualizar cada récord al máximo entre su valor anterior y el de la partida;
- añadir la entrada al principio del historial y conservar como mucho las 10 más recientes.

#### Scenario: Primera derrota
- **GIVEN** el progreso vacío y un reloj de pared que marca 1.763.596.800.000 ms
- **WHEN** se registra una partida terminada con derrota en el tick 1.259, nivel 3, 41 bajas y semilla 42
- **THEN** los récords valen `bestTimeSeconds` 20, `bestLevel` 3 y `maxKills` 41
- **AND** el historial tiene 1 entrada: `playedAt` 1.763.596.800.000, `seed` 42, `outcome` `defeat`,
  `timeSeconds` 20, `level` 3, `kills` 41

#### Scenario: Récords independientes
- **GIVEN** un progreso con récords (300, 8, 120) para (`bestTimeSeconds`, `bestLevel`, `maxKills`)
- **WHEN** se registra una derrota en el tick 15.000 (250 s), nivel 10 y 90 bajas
- **THEN** los récords valen (300, 10, 120)

#### Scenario: Victoria
- **GIVEN** el progreso vacío
- **WHEN** se registra una victoria en el tick 36.000, nivel 18 y 2.150 bajas
- **THEN** los récords valen (600, 18, 2150) y la entrada tiene `outcome` `victory` y `timeSeconds` 600

#### Scenario: Historial lleno
- **GIVEN** un progreso con 10 entradas con `playedAt` 1 a 10
- **WHEN** se registra una partida con `playedAt` 11
- **THEN** el historial tiene 10 entradas con `playedAt` 11, 10, …, 2 (la de `playedAt` 1 desaparece)
- **AND** los récords siguen considerando la partida descartada del historial (no bajan)

### Requirement: Guardado automático al terminar la partida
El sistema SHALL registrar y guardar en el almacenamiento del navegador cada partida terminada (victoria o derrota)
exactamente una vez, antes de que el reinicio con la tecla R pueda empezar la partida siguiente. Una partida en curso,
eligiendo mejora o abandonada sin terminar (cerrar o recargar la pestaña) MUST NOT guardarse. Guardar MUST NOT
cambiar la simulación.

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

### Requirement: Carga del progreso guardado
El sistema SHALL, al cargar la página, leer el progreso guardado y validarlo (ver "Validación del progreso"):
- si no hay nada guardado, usa el progreso vacío sin avisar;
- si es válido, lo usa;
- si está dañado (no es JSON, no cumple el esquema o tiene una `schemaVersion` desconocida), usa el progreso vacío,
  emite exactamente 1 aviso por consola que menciona `progress` y MUST NOT sobrescribir ni borrar los datos dañados
  hasta el siguiente guardado (fin de partida o import válido). El overlay de resultados de la primera partida
  terminada de esa carga MUST mostrar el aviso de datos dañados (ver `run-results`).

#### Scenario: Recarga tras una partida
- **GIVEN** un progreso guardado con récords (20, 3, 41) y 1 entrada de historial
- **WHEN** se recarga la página y se lee el progreso
- **THEN** los récords valen (20, 3, 41) y el historial tiene esa misma entrada campo a campo

#### Scenario: Datos guardados dañados
- **GIVEN** el almacenamiento con el valor guardado `{"schemaVersion":1,"records":` (JSON truncado)
- **WHEN** se carga la página
- **THEN** el progreso en uso es el vacío y se emite exactamente 1 aviso por consola que menciona `progress`
- **AND** el valor guardado sigue siendo `{"schemaVersion":1,"records":` mientras no termine ninguna partida

#### Scenario: Versión futura guardada
- **GIVEN** el almacenamiento con un progreso por lo demás válido con `schemaVersion` 2
- **WHEN** se carga la página
- **THEN** el progreso en uso es el vacío, hay 1 aviso por consola y el valor guardado no cambia

#### Scenario: Primer guardado tras datos dañados
- **GIVEN** una carga con datos guardados dañados
- **WHEN** termina una partida con derrota en el tick 1.259, nivel 3 y 41 bajas
- **THEN** el progreso guardado es válido, con récords (20, 3, 41) y 1 entrada de historial

### Requirement: Validación del progreso
El sistema SHALL validar con un esquema estricto todo progreso que venga de fuera del núcleo (lectura del
almacenamiento del navegador e import de fichero) antes de usarlo. Un progreso es válido si y solo si:
- es un objeto JSON con exactamente los campos del "Modelo de progreso", sin campos extra en ningún nivel y sin
  campos ausentes;
- `schemaVersion` es el número `1`;
- todos los números son enteros finitos entre 0 y 9.007.199.254.740.991 (2⁵³ − 1), salvo `seed`, entre 0 y
  4.294.967.295, y `level` del historial, que es ≥ 1;
- `outcome` es `victory` o `defeat`;
- `history` tiene como mucho 10 entradas.

El orden del historial y las entradas repetidas dentro del mismo documento no lo invalidan: el sistema lo normaliza
(orden de "Modelo de progreso" y sin duplicados, ver "Import con fusión"). Ningún valor del progreso se interpreta
como HTML ni como código, y la semilla guardada o importada MUST NOT usarse para arrancar una partida.

#### Scenario: Documento válido
- **GIVEN** `{"schemaVersion":1,"records":{"bestTimeSeconds":20,"bestLevel":3,"maxKills":41},"history":[{"playedAt":
  1763596800000,"seed":42,"outcome":"defeat","timeSeconds":20,"level":3,"kills":41}]}`
- **WHEN** se valida
- **THEN** es válido

#### Scenario: Valores en los límites
- **GIVEN** un documento válido con `seed` 0 en una entrada y 4.294.967.295 en otra, `kills` 0 y
  `maxKills` 9.007.199.254.740.991, y 10 entradas de historial
- **WHEN** se valida
- **THEN** es válido

#### Scenario: Documentos inválidos
- **GIVEN** cada una de estas variantes del documento válido:
  `schemaVersion` `"1"`, 0 o 2; sin `records`; un campo extra `"note":"<script>"` en la raíz, en `records` o en una
  entrada; `bestLevel` −1; `timeSeconds` 1,5; `kills` `1e400` (infinito al leerlo); `maxKills`
  9.007.199.254.740.992; `seed` −1 o 4.294.967.296; `level` 0 en una entrada; `outcome` `"win"`; 11 entradas de
  historial; el valor `null`; un array `[]`; un texto vacío
- **WHEN** se valida cada una
- **THEN** todas son inválidas

### Requirement: Exportar el progreso
El sistema SHALL, al pulsar el botón **Exportar** del overlay de resultados, descargar un fichero llamado
`sprint-survivors-progress.json` con el progreso en uso (incluida la partida recién terminada) en el formato del
"Modelo de progreso", sin pedir confirmación. Exportar MUST NOT modificar el progreso guardado ni la partida.

#### Scenario: Exportar tras una partida
- **GIVEN** el overlay de resultados visible tras una derrota y un progreso en uso con récords (20, 3, 41) y 1 entrada
- **WHEN** se pulsa **Exportar**
- **THEN** se descarga exactamente 1 fichero `sprint-survivors-progress.json`, válido según "Validación del
  progreso", igual campo a campo al progreso en uso

#### Scenario: Ida y vuelta
- **GIVEN** un fichero exportado desde el progreso P
- **WHEN** se importa ese fichero sobre el progreso vacío
- **THEN** el progreso resultante es igual campo a campo a P

#### Scenario: Tamaño del fichero máximo
- **GIVEN** un progreso con 10 entradas de historial y todos los números en su valor máximo válido
- **WHEN** se exporta
- **THEN** el fichero ocupa menos de 65.536 bytes y se puede importar sin rechazo

### Requirement: Import con fusión
El sistema SHALL, al elegir un fichero válido con el botón **Importar** del overlay de resultados, fusionarlo con el
progreso en uso sin pedir confirmación, usar el resultado como progreso en uso, guardarlo y mostrar en el overlay
los récords fusionados y un mensaje de éxito. La fusión MUST cumplir:
- cada récord es el máximo entre el valor en uso y el importado;
- el historial es la unión de ambos sin duplicados, ordenada de más reciente a más antigua por `playedAt` y
  recortada a las 10 más recientes. Dos entradas son duplicadas si y solo si coinciden en sus 6 campos;
- el resultado no depende del orden de los operandos (fusionar A con B da lo mismo que B con A), también con
  entradas distintas de igual `playedAt`;
- fusionar un progreso consigo mismo, o importar dos veces el mismo fichero, no cambia nada.

Si se cancela el selector de fichero, nada cambia y no se muestra ningún mensaje.

#### Scenario: Récords máximos
- **GIVEN** un progreso en uso con récords (300, 8, 120) y un fichero con récords (250, 10, 90)
- **WHEN** se importa
- **THEN** los récords en uso y guardados valen (300, 10, 120) y el overlay muestra esos valores y el mensaje de éxito

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
- ocupa más de 65.536 bytes (64 × 1.024): se comprueba antes de leer su contenido y el overlay muestra un mensaje que
  contiene `64 KiB`;
- su contenido no es JSON, no cumple "Validación del progreso" o tiene una `schemaVersion` desconocida: el overlay
  muestra un mensaje que contiene `no válido`.

Un fichero de exactamente 65.536 bytes con contenido válido MUST aceptarse. Un rechazo MUST NOT afectar a la partida
ni impedir reiniciar con R.

#### Scenario: Fichero demasiado grande
- **GIVEN** un progreso guardado G y un fichero de 65.537 bytes
- **WHEN** se importa
- **THEN** el overlay muestra el mensaje con `64 KiB`, el contenido del fichero no se llega a leer y el progreso en
  uso y el guardado siguen siendo G

#### Scenario: Fichero en el límite
- **GIVEN** un fichero de exactamente 65.536 bytes con un progreso válido seguido de espacios en blanco
- **WHEN** se importa
- **THEN** se acepta y se fusiona

#### Scenario: Fichero no JSON o fuera de esquema
- **GIVEN** un progreso guardado G y, por separado, un fichero con el texto `hola`, uno con `schemaVersion` 2 y uno
  con un campo extra
- **WHEN** se importa cada uno
- **THEN** en los tres casos el overlay muestra el mensaje con `no válido` y el progreso en uso y el guardado siguen
  siendo G

### Requirement: Juego sin almacenamiento disponible
El sistema SHALL permitir jugar con normalidad cuando el almacenamiento del navegador no existe o falla al leer o al
escribir (por ejemplo `SecurityError` o `QuotaExceededError`): ningún fallo de almacenamiento MUST detener el juego,
la partida ni el reinicio con R. En ese caso el progreso se mantiene solo en memoria durante la carga (los récords y
el historial incluyen las partidas de esa carga y los imports válidos), Exportar e Importar siguen funcionando sobre
ese progreso en memoria y el overlay de resultados MUST mostrar el aviso de sin persistencia (ver `run-results`).

#### Scenario: Almacenamiento bloqueado
- **GIVEN** un navegador cuyo almacenamiento lanza `SecurityError` al leer y al escribir
- **WHEN** se juega una partida hasta la derrota y se pulsa R
- **THEN** el overlay de resultados se ve con los récords de esa partida y el aviso de sin persistencia, y tras R
  empieza una partida nueva en curso
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

### Requirement: Política de seguridad de contenido
La página del juego SHALL declarar una política de seguridad de contenido (CSP) con
`<meta http-equiv="Content-Security-Policy">` en `index.html` que:
- tenga `default-src 'self'` y `object-src 'none'`;
- MUST NOT permitir en `script-src` (ni en `default-src`) `'unsafe-inline'`, `'unsafe-eval'` ni orígenes distintos
  de `'self'`;
- MUST NOT permitir conexiones a orígenes externos.

Con esa política, la build de producción MUST arrancar, jugar, exportar e importar sin ninguna violación de CSP.

#### Scenario: CSP presente y restrictiva
- **GIVEN** el `index.html` de la build de producción
- **WHEN** se lee su `<meta http-equiv="Content-Security-Policy">`
- **THEN** existe exactamente una, contiene `default-src 'self'` y `object-src 'none'` y no contiene
  `'unsafe-eval'`, ni `'unsafe-inline'` en `script-src`, ni `http:`, `https:` o `*` como origen

#### Scenario: Sin violaciones en el bucle completo
- **GIVEN** la build de producción servida con `?seed=42`
- **WHEN** una prueba E2E juega hasta la derrota, exporta, recarga e importa el fichero exportado
- **THEN** no se registra ningún evento `securitypolicyviolation` ni mensaje de consola de violación de CSP

## MODIFIED Requirements
<!-- Ninguno: capacidad nueva. -->

## REMOVED Requirements
<!-- Ninguno. -->
