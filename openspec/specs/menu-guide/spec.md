# Menu guide · Spec viva

> Fuente de verdad del comportamiento actual. Solo se modifica al archivar un change (skill `sdd-archive`).

## Purpose
La guía «Cómo jugar» del menú de inicio: un modal de 7 páginas que explica las mecánicas, navegable con ratón y
teclado, con textos de `content/guide.json` y cifras tomadas del contenido cargado.

> Convenciones de esta spec:
> - "La guía" es el modal que abre el botón `Cómo jugar` del menú de inicio (ver `main-menu`). "Guía abierta" es
>   el modo menú con la guía visible.
> - Etiquetas visibles exactas de sus controles: `Anterior`, `Siguiente` y `Cerrar`. El indicador de página es el texto
>   `n de 7`, con n la página visible (1..7).
> - "Página n" es la n-ésima página de `content/guide.json` (n de 1 a 7). Los temas, en este orden, son:
>   (1) movimiento y armas automáticas, (2) XP y mejoras de personaje, (3) recursos (oro, madera, carne, piedra y
>   gemas), (4) castillo-tienda, (5) solares de obra (casa y torre), (6) enemigos y campamentos, (7) victoria y derrota.
>   Cada página tiene un título, uno o más párrafos (su "texto") y, opcionalmente, la lista de recursos que cita.
> - "Marcador" es un nombre entre llaves (`{nombre}`) dentro de un texto de `guide.json` que se sustituye por un valor
>   del contenido ya cargado y validado. "Texto crudo" es el de `guide.json`; "texto mostrado", el que ve el jugador.
> - "Pulsación" de una tecla es un `keydown` sin repetición y sin Alt, Ctrl ni Meta; los `keydown` de repetición de
>   una tecla mantenida no cuentan como pulsaciones nuevas.
> - "Recursos" de la guía: `xp` (gemas), `gold` (oro), `wood` (madera), `meat` (carne) y `stone` (piedra).
> - Los escenarios sin `[E2E]` se verifican sin navegador (tests unitarios o de infraestructura en Node). Los que
>   cargan sin `?e2e` solo observan lo que ve el jugador (DOM visible, foco, consola y `localStorage`).

## Requirements

### Requirement: Abrir la guía desde el menú
El sistema SHALL, al pulsar `Cómo jugar` en modo menú con el menú operativo (sin el diálogo de `Borrar datos`
abierto), mostrar la guía sobre el menú en la página 1, con el título y el texto de esa página, el indicador `1 de 7`
y los controles `Siguiente` y `Cerrar`. Abrir la guía MUST NOT crear ninguna partida ni ejecutar ningún tick, y el
menú de inicio MUST seguir en modo menú. Al abrirse, el foco del documento MUST quedar en un elemento de la guía.
Cada apertura MUST empezar en la página 1, sea cual sea la página en que se cerró la anterior. Con la guía abierta,
pulsar de nuevo `Cómo jugar` MUST NOT tener efecto: existe como mucho una guía visible.

#### Scenario: Primera apertura
- **GIVEN** el modo menú sin `?e2e` y la guía no visible
- **WHEN** se pulsa `Cómo jugar`
- **THEN** la guía es visible con el título y el texto mostrado de la página 1, el indicador `1 de 7` y los botones
  `Siguiente` y `Cerrar`, y no hay botón `Anterior` visible
- **AND** el elemento con el foco está dentro de la guía, no existe ninguna partida y el HUD no es visible

#### Scenario: Reabrir empieza en la página 1
- **GIVEN** la guía abierta en la página 5
- **WHEN** se pulsa `Cerrar` y después `Cómo jugar`
- **THEN** la guía es visible con el indicador `1 de 7` y el título de la página 1

#### Scenario: Doble pulsación de Cómo jugar
- **GIVEN** el modo menú con la guía no visible
- **WHEN** se pulsa `Cómo jugar` dos veces seguidas
- **THEN** hay exactamente 1 guía visible, en la página 1

#### Scenario: Abrir no toca el progreso
- **GIVEN** un progreso válido G guardado en `localStorage` y el modo menú
- **WHEN** se abre la guía, se avanza hasta la página 7, se vuelve a la 1 y se cierra
- **THEN** el valor guardado sigue siendo G byte a byte y se han hecho 0 escrituras de progreso

### Requirement: Páginas y topes de la guía
El sistema SHALL mostrar en la guía exactamente una página a la vez, de las 7 de `content/guide.json`, en su orden.
`Siguiente` MUST pasar de la página n a la n + 1 y `Anterior` de la n a la n − 1. En la página 1 MUST NOT verse
`Anterior` y en la página 7 MUST NOT verse `Siguiente`; `Cerrar` MUST verse en todas. El indicador MUST mostrar
`n de 7` con la página visible. Cada página MUST mostrar su título y su texto mostrado completos. Tras pulsar
`Anterior` o `Siguiente`, el foco MUST seguir dentro de la guía, también cuando el botón pulsado deja de verse en un
tope.

#### Scenario: Recorrido hacia delante
- **GIVEN** la guía abierta en la página 1
- **WHEN** se pulsa `Siguiente` 6 veces, comprobando la guía tras cada pulsación
- **THEN** tras la pulsación k (1..6) el indicador es `k+1 de 7` y se ven el título y el texto de la página k + 1
- **AND** en la página 7 se ven `Anterior` y `Cerrar` y no se ve `Siguiente`

#### Scenario: Recorrido hacia atrás
- **GIVEN** la guía abierta en la página 7
- **WHEN** se pulsa `Anterior` 6 veces
- **THEN** el indicador es `1 de 7`, se ve el título de la página 1 y no se ve `Anterior`

#### Scenario: Páginas intermedias con ambos controles
- **GIVEN** la guía abierta
- **WHEN** se visita cada página de la 2 a la 6
- **THEN** en cada una se ven `Anterior`, `Siguiente` y `Cerrar`

#### Scenario: Foco tras llegar al tope
- **GIVEN** la guía abierta en la página 6
- **WHEN** se pulsa `Siguiente` con el ratón
- **THEN** el indicador es `7 de 7`, `Siguiente` no se ve y el elemento con el foco está dentro de la guía
- **AND** una pulsación de Esc a continuación cierra la guía

#### Scenario: Una sola página visible
- **GIVEN** la guía abierta en la página 4
- **WHEN** se cuentan los títulos de página visibles
- **THEN** hay exactamente 1, el de la página 4

### Requirement: Cerrar la guía
El sistema SHALL cerrar la guía al pulsar `Cerrar` o al pulsar Esc con la guía abierta, desde cualquier página.
Al cerrarse, la guía MUST dejar de verse, el menú de inicio MUST seguir visible en modo menú, sin partida, con sus
cinco opciones operativas, y el foco MUST quedar en el botón `Cómo jugar`. Cada pulsación de Esc MUST cerrar la guía
como mucho una vez y MUST NOT tener ningún otro efecto, aunque la tecla se mantenga pulsada. Tras cerrar la guía,
`Jugar` MUST seguir empezando una partida con una sola pulsación y Esc MUST pausar esa partida con una sola pulsación.

#### Scenario: Cerrar con el botón
- **GIVEN** la guía abierta en la página 4
- **WHEN** se pulsa `Cerrar`
- **THEN** la guía no es visible, el menú es visible con sus 5 opciones, no existe ninguna partida y el foco está en
  `Cómo jugar`

#### Scenario: Cerrar con Esc
- **GIVEN** la guía abierta en la página 7
- **WHEN** se pulsa Esc una vez
- **THEN** la guía no es visible, el menú es visible, no existe ninguna partida y el foco está en `Cómo jugar`

#### Scenario: Esc mantenido
- **GIVEN** la guía abierta en la página 2
- **WHEN** se pulsa Esc, llegan 20 `keydown` de repetición de Esc y se suelta
- **THEN** la guía no es visible, el menú es visible, no existe ninguna partida, el overlay de pausa no es visible y
  el diálogo de `Borrar datos` no es visible

#### Scenario: Jugar y pausa tras cerrar la guía
- **GIVEN** el modo menú en el que se ha abierto la guía y se ha cerrado con Esc
- **WHEN** se pulsa `Jugar` una vez con el ratón, se pintan 30 frames y se pulsa Esc una vez, sin otro clic
- **THEN** existe exactamente 1 partida en curso y el overlay de pausa es visible

### Requirement: Teclado en la guía
El sistema SHALL, con la guía abierta, pasar a la página siguiente con cada pulsación de flecha derecha y a la
anterior con cada pulsación de flecha izquierda, con los mismos topes que `Siguiente` y `Anterior`: flecha derecha en
la página 7 y flecha izquierda en la página 1 MUST NOT cambiar nada. Los `keydown` de repetición de una flecha
mantenida MUST NOT cambiar de página. Esc y las flechas pulsadas junto con Alt, Ctrl o Meta MUST NOT tener efecto
en la guía (ni cambian de página ni la cierran). Con la guía abierta, las teclas R, 1, 2 y 3 y el input de
movimiento MUST NOT tener efecto: no crean partida, no cambian de página ni cierran la guía. Esc y las flechas MUST
NOT desplazar la página del navegador mientras la guía está abierta. No hay focus trap: el foco puede salir de la guía
con el tabulador sin que la guía se cierre.

#### Scenario: Flechas hacia delante hasta el tope
- **GIVEN** la guía abierta en la página 1
- **WHEN** se pulsa flecha derecha 6 veces y después 1 vez más
- **THEN** tras la sexta pulsación el indicador es `7 de 7` y tras la séptima sigue siendo `7 de 7`, con la guía
  visible

#### Scenario: Flecha izquierda en la primera página
- **GIVEN** la guía abierta en la página 1
- **WHEN** se pulsa flecha izquierda 3 veces
- **THEN** el indicador sigue siendo `1 de 7` y la guía sigue visible

#### Scenario: Ida y vuelta con flechas
- **GIVEN** la guía abierta en la página 1
- **WHEN** se pulsan flecha derecha 4 veces y flecha izquierda 2 veces
- **THEN** el indicador es `3 de 7`

#### Scenario: Flecha mantenida
- **GIVEN** la guía abierta en la página 2
- **WHEN** se pulsa flecha derecha, llegan 30 `keydown` de repetición de flecha derecha y se suelta
- **THEN** el indicador es `3 de 7`

#### Scenario: Teclas con modificador
- **GIVEN** la guía abierta en la página 3
- **WHEN** se pulsan Alt + flecha izquierda, Ctrl + flecha derecha, Meta + flecha derecha y Ctrl + Esc
- **THEN** la guía sigue visible con el indicador `3 de 7` y no existe ninguna partida

#### Scenario: Teclas de juego con la guía abierta
- **GIVEN** la guía abierta en la página 3
- **WHEN** se pulsan R, 1, 2 y 3 y se mantiene el input (1, 1) durante 60 frames
- **THEN** la guía sigue visible con el indicador `3 de 7` y no existe ninguna partida

#### Scenario: Flechas y Esc en el mismo frame
- **GIVEN** la guía abierta en la página 3
- **WHEN** llegan, en este orden y en el mismo frame, una pulsación de flecha derecha y una de Esc
- **THEN** la guía no es visible, el menú es visible y no existe ninguna partida
- **AND** al volver a pulsar `Cómo jugar` la guía está en la página 1

### Requirement: Escucha de teclado solo con la guía abierta
El sistema SHALL tener registrado su escuchador de `keydown` de la guía solo mientras la guía está abierta: con la
guía cerrada MUST haber 0 escuchadores de la guía registrados, y con la guía abierta exactamente 1. Cada apertura MUST
registrar como mucho uno y cada cierre (por `Cerrar` o por Esc) MUST quitarlo. Con la guía cerrada, Esc y las flechas
en el menú MUST NOT tener efecto (ver "Menú de inicio al cargar" en `main-menu`).

#### Scenario: Sin escuchador antes de abrir
- **GIVEN** el modo menú recién cargado sin `?e2e`
- **WHEN** se cuentan los escuchadores de `keydown` de la guía registrados
- **THEN** hay 0

#### Scenario: Un escuchador con la guía abierta
- **GIVEN** el modo menú
- **WHEN** se pulsa `Cómo jugar` y se cuentan los escuchadores de `keydown` de la guía
- **THEN** hay exactamente 1

#### Scenario: Diez aperturas y cierres
- **GIVEN** el modo menú
- **WHEN** se repite 10 veces: `Cómo jugar` y cerrar, alternando `Cerrar` (ciclos impares) y Esc (ciclos pares)
- **THEN** tras cada cierre hay 0 escuchadores de `keydown` de la guía, y durante cada apertura exactamente 1
- **AND** tras el décimo cierre, una pulsación de Esc, una de flecha derecha y una de flecha izquierda dejan el menú
  visible, la guía no visible y ninguna partida

### Requirement: Opciones del menú bloqueadas con la guía abierta
El sistema SHALL, mientras la guía está abierta, hacer que `Jugar`, `Cómo jugar`, `Exportar`, `Importar` y
`Borrar datos` no tengan efecto: no empieza ninguna partida, no se descarga ni se importa ningún fichero, no se abre
el diálogo de `Borrar datos` y la guía sigue abierta en la misma página. Mientras el diálogo de `Borrar datos` está
abierto, `Cómo jugar` MUST NOT tener efecto (ver "Confirmación de Borrar datos" en `main-menu`). Al cerrarse la guía
o el diálogo, el menú vuelve a estar operativo.

#### Scenario: Pulsaciones del menú con la guía abierta
- **GIVEN** la guía abierta en la página 2 y un progreso guardado G
- **WHEN** se pulsan `Jugar`, `Exportar`, `Importar` y `Borrar datos`
- **THEN** no existe ninguna partida, se han descargado 0 ficheros, no se ha abierto ningún selector de fichero, el
  diálogo de `Borrar datos` no es visible y la guía sigue visible con el indicador `2 de 7`
- **AND** el valor guardado sigue siendo G byte a byte

#### Scenario: Cómo jugar con el diálogo de Borrar datos abierto
- **GIVEN** el diálogo de `Borrar datos` abierto
- **WHEN** se pulsa `Cómo jugar`
- **THEN** la guía no es visible y el diálogo sigue visible con `Confirmar` y `Cancelar`
- **AND** tras pulsar `Cancelar` y después `Cómo jugar`, la guía es visible en la página 1

#### Scenario: Jugar en el mismo frame que se abre la guía
- **GIVEN** el modo menú con la guía no visible
- **WHEN** en el mismo frame se pulsa `Cómo jugar` y después `Jugar`
- **THEN** la guía es visible y no existe ninguna partida

#### Scenario: Menú operativo tras cerrar
- **GIVEN** la guía abierta y cerrada con `Cerrar`
- **WHEN** se pulsa `Exportar`
- **THEN** se descarga exactamente 1 fichero `sprint-survivors-progress.json` y no existe ninguna partida

### Requirement: La guía nunca aparece sola
El sistema SHALL mostrar la guía solo como respuesta a una pulsación de `Cómo jugar` en modo menú. La guía MUST NOT
verse al cargar (con o sin `?e2e`), al volver al menú con `Volver al menú`, ni en ninguna pantalla con partida (en
curso, en pausa, eligiendo mejora, en tienda, en obra o terminada). Pulsar `Jugar` desde el menú no puede ocurrir con
la guía abierta (ver "Opciones del menú bloqueadas con la guía abierta"), de modo que ninguna partida empieza con la
guía visible.

#### Scenario: Carga sin parámetros
- **GIVEN** la build de producción servida sin parámetros
- **WHEN** termina la carga y se pintan 300 frames sin pulsar nada
- **THEN** el menú es visible y la guía no es visible

#### Scenario: Carga en modo E2E
- **GIVEN** la URL `?e2e&manual&seed=42`
- **WHEN** termina la carga y se llama a `step(15)`
- **THEN** la guía no es visible y la sonda informa de una partida en curso en el tick 15

#### Scenario: Volver al menú en modo E2E
- **GIVEN** la URL `?e2e&manual&seed=42` y la partida en pausa
- **WHEN** se pulsa `Volver al menú`
- **THEN** el menú de inicio es visible con sus 5 opciones y la guía no es visible

#### Scenario: Guía cerrada antes de jugar
- **GIVEN** el modo menú en el que se ha abierto la guía, se ha llegado a la página 6 y se ha cerrado
- **WHEN** se pulsa `Jugar`, después Esc y después `Volver al menú`
- **THEN** en ningún paso es visible la guía y, en el menú final, la guía sigue no visible

### Requirement: Contenido de la guía validado
El sistema SHALL leer los textos de la guía de `content/guide.json`, validado al arrancar antes de mostrar el menú,
por la misma vía que el resto del contenido de presentación. El fichero MUST tener exactamente 7 páginas, cada una con
su tema, un título no vacío (tras quitar espacios) y al menos un párrafo, todos no vacíos (tras quitar espacios); los
temas MUST aparecer una vez cada uno y en el orden de las convenciones, y MUST NOT haber campos desconocidos. Cada
página MAY declarar los recursos que cita, solo de entre los cinco de las convenciones y sin repetir ninguno. Cada
`{` y cada `}` de un título o párrafo MUST formar parte de un marcador `{nombre}` cuyo nombre pertenezca al catálogo
de "Cifras de la guía tomadas del contenido" y cuyo valor exista en el contenido cargado. Ningún título ni párrafo de
página MUST estar escrito en el código. Un `guide.json` inválido MUST impedir que se muestre el menú o empiece una
partida, con el error de contenido de siempre, que nombre la página y el campo (y, si es el caso, el marcador); no se
crea el menú. La validación MUST NOT cambiar el resto del contenido ni la simulación.

#### Scenario: Contenido por defecto válido
- **GIVEN** el `content/guide.json` del repositorio y el resto del contenido por defecto
- **WHEN** se valida el contenido al arrancar
- **THEN** la validación es correcta, hay 7 páginas con los temas en el orden de las convenciones y todos sus
  marcadores pertenecen al catálogo

#### Scenario: Seis u ocho páginas
- **GIVEN** un `guide.json` con 6 páginas y, en otra carga, uno con 8 (la octava, copia válida de la séptima)
- **WHEN** se valida el contenido al arrancar
- **THEN** en ambos casos el arranque muestra el error de contenido, no se crea el menú y no existe ninguna partida

#### Scenario: Párrafo vacío o página sin párrafos
- **GIVEN** un `guide.json` por defecto en el que un párrafo de la página 4 es `"   "` y, en otra carga, uno en el que
  la página 4 no tiene ningún párrafo
- **WHEN** se valida el contenido al arrancar
- **THEN** en ambos casos el arranque muestra el error de contenido, que nombra la página 4, y no se crea el menú

#### Scenario: Título vacío
- **GIVEN** un `guide.json` por defecto en el que el título de la página 1 es `""`
- **WHEN** se valida el contenido al arrancar
- **THEN** el arranque muestra el error de contenido, que nombra la página 1, y no se crea el menú

#### Scenario: Páginas fuera de orden
- **GIVEN** un `guide.json` por defecto con las páginas 4 y 5 intercambiadas
- **WHEN** se valida el contenido al arrancar
- **THEN** el arranque muestra el error de contenido y no se crea el menú

#### Scenario: Marcador desconocido
- **GIVEN** un `guide.json` por defecto cuyo texto de la página 5 contiene el marcador `{tower.cost.gold}`, que no
  está en el catálogo
- **WHEN** se valida el contenido al arrancar
- **THEN** el arranque muestra el error de contenido, que nombra la página 5 y `tower.cost.gold`, y no se crea el menú

#### Scenario: Llave suelta
- **GIVEN** un `guide.json` por defecto con un párrafo de la página 2 que termina en `cada {` y, en otra carga, uno
  con un párrafo de la página 2 que contiene `cada }`
- **WHEN** se valida el contenido al arrancar
- **THEN** en ambos casos el arranque muestra el error de contenido, que nombra la página 2, y no se crea el menú

#### Scenario: Marcador sin valor en el contenido
- **GIVEN** un `guide.json` por defecto que usa `{structures.towerCount}` y un contenido de estructuras válido en el
  que no existe el tipo de la torre goblin
- **WHEN** se valida el contenido al arrancar
- **THEN** el arranque muestra el error de contenido, que nombra `structures.towerCount`, y no se crea el menú

#### Scenario: Recurso citado desconocido o repetido
- **GIVEN** un `guide.json` por defecto cuya página 3 declara el recurso `diamante` y, en otra carga, uno cuya
  página 3 declara `gold` dos veces
- **WHEN** se valida el contenido al arrancar
- **THEN** en ambos casos el arranque muestra el error de contenido, que nombra la página 3, y no se crea el menú

#### Scenario: Campo desconocido
- **GIVEN** un `guide.json` por defecto en el que la página 6 tiene además el campo `image`
- **WHEN** se valida el contenido al arrancar
- **THEN** el arranque muestra el error de contenido, que nombra la página 6 y `image`, y no se crea el menú

### Requirement: Cifras de la guía tomadas del contenido
El sistema SHALL sustituir cada marcador de un texto de la guía por el valor correspondiente del contenido cargado y
validado, de modo que el texto mostrado coincide siempre con el balance real. El catálogo de marcadores es cerrado y
tiene exactamente estas 14 claves, con su fuente y su formato:

| Marcador | Fuente | Formato | Valor por defecto |
|---|---|---|---|
| `run.duration` | duración de la partida (`run.json`) | reloj `mm:ss`, igual que el tiempo del HUD | `10:00` |
| `upgrades.offerSize` | opciones de cada oferta de mejora | entero | `3` |
| `upgrades.characterCount` | mejoras del catálogo `character` | entero | `9` |
| `upgrades.weaponCount` | mejoras del catálogo `weapons` | entero | `6` |
| `progression.levelUpHealPercent` | cura al subir sin mejoras disponibles | entero | `10` |
| `resources.meat.healPercent` | cura de la carne | entero | `20` |
| `shop.heal.price` | precio de la cura de la tienda | entero | `8` |
| `buildings.house.wood` | coste en madera de la casa | entero | `15` |
| `buildings.house.incomeGold` | oro de cada ingreso de la casa | entero | `1` |
| `buildings.house.incomeSeconds` | intervalo de ingreso de la casa, en segundos (ticks / 60) | segundos | `30` |
| `buildings.tower.wood` | coste en madera de la torre | entero | `30` |
| `buildings.tower.stone` | coste en piedra de la torre | entero | `15` |
| `structures.houseCount` | casas goblin por mapa generado | entero | `4` |
| `structures.towerCount` | torres goblin por mapa generado | entero | `3` |

Formato "entero": sin decimales y con punto como separador de miles a partir de 1.000 (1800 se muestra `1.800`), igual
en cualquier navegador. Formato "segundos": el número de segundos con como mucho una decimal y coma decimal (`30`,
`22,5`). Las unidades y signos (`%`, `s`, `oro`) van en el texto crudo, fuera del marcador. Cada clave del catálogo
MUST usarse al menos una vez en `content/guide.json`. Ninguna cifra MUST estar escrita a mano en `guide.json`: sus
títulos y párrafos crudos MUST NOT contener ningún dígito (0–9); todas las cifras mostradas salen de marcadores.
Sustituir marcadores MUST NOT cambiar el contenido cargado.

#### Scenario: Cifras con el contenido por defecto
- **GIVEN** el contenido por defecto
- **WHEN** se componen los textos mostrados de las 7 páginas
- **THEN** cada aparición de cada marcador se muestra con el valor por defecto de la tabla (p. ej.
  `{buildings.house.wood}` como `15`, `{buildings.house.incomeSeconds}` como `30` y `{run.duration}` como `10:00`)
- **AND** ningún texto mostrado contiene `{` ni `}`

#### Scenario: Las cifras siguen al contenido
- **GIVEN** el contenido por defecto salvo casa con coste 1.800 madera e ingreso de 4 oro cada 2.400 ticks, torre con
  coste 37 madera y 19 piedra, carne 35 y `durationSeconds` 900
- **WHEN** se componen los textos mostrados sin cambiar `guide.json`
- **THEN** `{buildings.house.wood}` se muestra `1.800`, `{buildings.house.incomeGold}` `4`,
  `{buildings.house.incomeSeconds}` `40`, `{buildings.tower.wood}` `37`, `{buildings.tower.stone}` `19`,
  `{resources.meat.healPercent}` `35` y `{run.duration}` `15:00`
- **AND** ningún texto mostrado contiene `{` ni `}` ni `10:00`

#### Scenario: Segundos con decimal
- **GIVEN** el contenido por defecto salvo el ingreso de la casa cada 1.350 ticks
- **WHEN** se compone el texto mostrado que usa `{buildings.house.incomeSeconds}`
- **THEN** el marcador se muestra como `22,5`

#### Scenario: Sin cifras escritas a mano
- **GIVEN** el `content/guide.json` del repositorio
- **WHEN** se buscan dígitos (0–9) en los títulos y párrafos crudos de sus 7 páginas
- **THEN** no hay ninguno

#### Scenario: Catálogo usado entero
- **GIVEN** el `content/guide.json` del repositorio
- **WHEN** se recogen los marcadores de todos sus títulos y párrafos
- **THEN** aparecen las 14 claves del catálogo, cada una al menos una vez, y ninguna otra

### Requirement: Iconos de recurso en la guía
La vista SHALL mostrar, en cada página que declara recursos, un icono por cada recurso declarado, en el orden
declarado y con un texto alternativo con el nombre del recurso. Los iconos de oro, madera, carne y piedra usan el
primer frame de la hoja de su recogible en `content/appearance.json` (la de la piedra, la de la roca `medium`, la
misma que el contador del HUD); el de las gemas usa la hoja de la gema si la tiene y, si la gema se pinta como forma
de color, una forma con el color de la gema de `appearance.json`. Con el contenido por defecto, la página 3 MUST
mostrar los cinco iconos y la página 5 al menos los de madera y piedra; una página que no declara recursos MUST NOT
mostrar ningún icono de recurso. Los iconos MUST respetar la CSP (sin estilos ni scripts en línea). Los iconos MUST
NOT usar ninguna hoja que no sea la de un recogible de `appearance.json` (ni una pieza de la interfaz) ni añadir por sí
mismos entradas a `content/asset-provenance.json`; el marco y los botones de la guía usan las piezas de la interfaz
(ver "Aspecto de la guía con piezas de UI"). Si la hoja de un icono no carga, la página MUST seguir mostrando su
título, su texto y sus controles, sin errores no capturados.

#### Scenario: Iconos de las páginas de recursos y de obra
- **GIVEN** el contenido por defecto y la guía abierta
- **WHEN** se visitan las páginas 3 y 5
- **THEN** la 3 muestra exactamente 5 iconos de recurso (gemas, oro, madera, carne y piedra, en el orden declarado)
  y la 5 al menos los de madera y piedra
- **AND** los de oro, madera, carne y piedra apuntan a las hojas `G_Idle`, `W_Idle`, `M_Idle` y `Deco/05` de
  `appearance.json`, y el de las gemas es una forma con el color de la gema de `appearance.json`

#### Scenario: Color de la gema desde el contenido
- **GIVEN** el contenido por defecto salvo el color de la gema cambiado a `#12AB34`
- **WHEN** se compone el icono de las gemas
- **THEN** su forma usa el color `#12AB34`

#### Scenario: Página sin recursos
- **GIVEN** el contenido por defecto y la guía abierta en la página 1
- **WHEN** se cuentan los iconos de recurso visibles en la guía
- **THEN** hay 0

#### Scenario: Sin assets nuevos
- **GIVEN** el repositorio tras este change
- **WHEN** se comparan los ficheros gráficos versionados y las entradas de `content/asset-provenance.json` con los de
  `main` antes del change
- **THEN** no hay ningún fichero gráfico nuevo ni ninguna entrada nueva

#### Scenario: Hoja de icono que no carga
- **GIVEN** la guía abierta en la página 3 y la hoja del icono de la madera que no carga
- **WHEN** se pinta la página
- **THEN** el título, el texto, el indicador `3 de 7` y los controles son visibles y no hay errores no capturados

#### Scenario: Iconos sin hojas propias
- **GIVEN** el repositorio tras este change
- **WHEN** se compone cada icono de recurso de las 7 páginas
- **THEN** cada icono con hoja apunta a la hoja de un recogible de `appearance.json` que ya figuraba en la nota de
  procedencia antes de 0032, ninguno apunta a la hoja de una pieza de la interfaz, y el de las gemas es una forma
  `data:` sin fichero

### Requirement: Guía observable en el navegador
El sistema SHALL permitir, en la build de producción y sin `?e2e`, abrir la guía, recorrer sus 7 páginas y cerrarla
sin recargar la página, sin errores no capturados en la consola, sin diálogos nativos del navegador y sin violaciones
de la CSP. La guía no añade ninguna sonda a `window.__sprint`.

#### Scenario: Recorrido de la guía en el smoke [E2E]
- **GIVEN** la build de producción servida sin `?e2e` y el menú de inicio visible
- **WHEN** una prueba E2E comprueba los 5 botones del menú, pulsa `Cómo jugar`, pulsa flecha derecha 7 veces,
  comprueba la guía con ventanas de 960 × 540 y de 1.920 × 1.080 y después pulsa Esc
- **THEN** al abrir la guía es visible con `1 de 7` y sin `Anterior`; tras 6 pulsaciones muestra `7 de 7` sin
  `Siguiente` y la séptima la deja en `7 de 7`
- **AND** con cada una de las dos ventanas el recuadro de la guía y sus botones visibles están enteros dentro de la
  ventana y el recuadro tiene su centro en el de la ventana (error ≤ 1 px en cada eje)
- **AND** tras Esc la guía no es visible, el menú es visible con sus 5 botones, el HUD no es visible y el foco está en
  `Cómo jugar`
- **AND** no hay errores no capturados, se han abierto 0 diálogos nativos y no se registra ningún evento
  `securitypolicyviolation`

### Requirement: Aspecto de la guía con piezas de UI
La vista SHALL pintar la guía (`.guide-modal`) con las piezas de "Piezas de UI en los paneles DOM" (`sprite-rendering`):
el recuadro con el marco de `panel`; `Anterior`, `Siguiente` y `Cerrar` con las piezas de botón según su estado; el
título de página (`.guide-modal__header h2`) con la cabecera `header`; el texto con la tinta `text` de `panel` y el
indicador `n de 7` con la tinta `accent`; todo con la fuente pixel. Con
una ventana ≥ 960 × 540 y cualquier k, el título, el indicador y los controles visibles MUST quedar dentro del área útil
del recuadro, y el texto de la página dentro del área útil, entero o alcanzable desplazándolo dentro del recuadro, sin
que la barra de desplazamiento tape el marco. Si la pieza o la fuente no carga, la guía se pinta con el aspecto actual y
su navegación no cambia.

#### Scenario: Guía dentro del marco a ×1 y a ×2
- **GIVEN** la hoja de estilos del repositorio y los datos de `ui`, con k = 1 (ventana de 960 × 540) y k = 2 (ventana de
  2.560 × 1.440)
- **WHEN** se leen las reglas de `.guide-modal` y de su cuerpo
- **THEN** el relleno interior del recuadro es ≥ (l·k, t·k, r·k, b·k) px y ≥ 12 px en cada lado, y el cuerpo de la
  página conserva su desplazamiento vertical interno, de modo que el texto queda en el área útil, entero o alcanzable
  desplazándolo
- **AND** siguen valiendo "Guía entera en la ventana mínima y con escala ×2" (`main-menu`) y "Recorrido de la guía en
  el smoke"

#### Scenario: Controles de la guía con piezas de botón
- **GIVEN** la hoja de estilos del repositorio
- **WHEN** se leen las reglas de los botones de `.guide-modal`
- **THEN** usan la pieza de `button`, con `buttonHover` en `:hover` y `:focus-visible` y `buttonPressed` en `:active`

<!-- historial: 0028-menu-guide (2026-11-25) -->
<!-- historial: 0032-ui-kit (2026-11-26) -->
