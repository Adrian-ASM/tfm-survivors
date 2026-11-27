# Spec delta · menu-guide

<!-- Change 0036-ui-polish. Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test.
     Motivo: la guía se cierra con un botón × en la esquina superior derecha de su recuadro, cuyo nombre accesible es
     `Cerrar`; ya no hay un `Cerrar` visible abajo. Los iconos de recurso son mayores y el texto de la página de la
     tienda nombra la ×. El aspecto común de la × está en "Botón × de cierre de los modales" (`sprite-rendering`).

     Convenciones de la spec viva (se sustituyen al archivar):
     - Antes: «Etiquetas visibles exactas de sus controles: `Anterior`, `Siguiente` y `Cerrar`.»
     - Ahora: «Etiquetas visibles exactas de sus controles: `Anterior` y `Siguiente`. El control de cierre es la ×
       (texto visible `×`, U+00D7) en la esquina superior derecha del recuadro, con nombre accesible `Cerrar`; en esta
       spec, "pulsar `Cerrar`" significa pulsar la × y "se ve `Cerrar`" que la × es visible.»
     Con esa convención siguen valiendo sin cambio de texto "Abrir la guía desde el menú", "Páginas y topes de la
     guía", "Escucha de teclado solo con la guía abierta" (ciclos `Cerrar`/Esc) y "Opciones del menú bloqueadas con la
     guía abierta"; sus escenarios buscan el control por nombre accesible. -->

## ADDED Requirements

### Requirement: Texto de la tienda en la guía
El sistema SHALL describir en la página 4 (castillo-tienda) la salida de la tienda con la × y con Esc, sin nombrar
ningún botón `Salir`. Con el contenido por defecto, el último párrafo mostrado de la página 4 MUST ser exactamente
`Con oro mejoras tus armas (6 mejoras en total) o compras una cura por 8 de oro. Sal de la tienda con la × de su
esquina o con Esc.` (en una línea, con un espacio entre `su` y `esquina`). El texto crudo sigue las reglas de
"Contenido de la guía validado" y de "Cifras de la guía tomadas del contenido": sin dígitos y con las cifras en
marcadores.

#### Scenario: Página de la tienda con la ×
- **GIVEN** el contenido por defecto
- **WHEN** se compone el texto mostrado de la página 4
- **THEN** su último párrafo es `Con oro mejoras tus armas (6 mejoras en total) o compras una cura por 8 de oro. Sal
  de la tienda con la × de su esquina o con Esc.`
- **AND** ningún título ni párrafo mostrado de las 7 páginas contiene la palabra `Salir`

## MODIFIED Requirements

### Requirement: Cerrar la guía
El sistema SHALL cerrar la guía al pulsar la × de su esquina superior derecha (nombre accesible `Cerrar`, ver "Botón ×
de cierre de los modales" en `sprite-rendering`) o al pulsar Esc con la guía abierta, desde cualquier página; los dos
gestos producen exactamente el mismo resultado. La guía MUST NOT tener ningún otro botón ni texto visible `Cerrar`.
Al cerrarse, la guía MUST dejar de verse, el menú de inicio MUST seguir visible en modo menú, sin partida, con sus
seis opciones operativas, y el foco MUST quedar en el botón `Cómo jugar`. Cada pulsación de Esc MUST cerrar la guía
como mucho una vez y MUST NOT tener ningún otro efecto, aunque la tecla se mantenga pulsada. Tras cerrar la guía,
`Jugar` MUST seguir empezando una partida con una sola pulsación y Esc MUST pausar esa partida con una sola pulsación.

#### Scenario: Cerrar con el botón
- **GIVEN** la guía abierta en la página 4
- **WHEN** se hace clic en la × (botón con nombre accesible `Cerrar`)
- **THEN** la guía no es visible, el menú es visible con sus 6 opciones, no existe ninguna partida y el foco está en
  `Cómo jugar`

#### Scenario: Una sola × en cada página
- **GIVEN** la guía abierta
- **WHEN** se visita cada página de la 1 a la 7
- **THEN** en cada una hay exactamente 1 botón visible con nombre accesible `Cerrar`, su texto visible es `×`, y ningún
  elemento de la guía tiene el texto visible `Cerrar`

#### Scenario: Cerrar con Esc
- **GIVEN** la guía abierta en la página 7
- **WHEN** se pulsa Esc una vez
- **THEN** la guía no es visible, el menú es visible, no existe ninguna partida y el foco está en `Cómo jugar`

#### Scenario: La × y Esc dejan el mismo estado
- **GIVEN** la guía abierta en la página 3, una vez, y otra vez el mismo estado
- **WHEN** en la primera se hace clic en la × y en la segunda se pulsa Esc
- **THEN** en ambas la guía no es visible, el menú está en modo menú con sus 6 opciones, no existe ninguna partida, hay
  0 escuchadores de `keydown` de la guía y el foco está en `Cómo jugar`
- **AND** al pulsar `Cómo jugar` en ambas la guía está en la página 1

#### Scenario: Esc mantenido
- **GIVEN** la guía abierta en la página 2
- **WHEN** se pulsa Esc, llegan 20 `keydown` de repetición de Esc y se suelta
- **THEN** la guía no es visible, el menú es visible, no existe ninguna partida, el overlay de pausa no es visible y
  ni el diálogo de `Borrar datos` ni el panel `Sonido` son visibles

#### Scenario: Jugar y pausa tras cerrar la guía
- **GIVEN** el modo menú en el que se ha abierto la guía y se ha cerrado con Esc
- **WHEN** se pulsa `Jugar` una vez con el ratón, se pintan 30 frames y se pulsa Esc una vez, sin otro clic
- **THEN** existe exactamente 1 partida en curso y el overlay de pausa es visible

### Requirement: Iconos de recurso en la guía
La vista SHALL mostrar, en cada página que declara recursos, un icono por cada recurso declarado, en el orden
declarado y con un texto alternativo con el nombre del recurso. Los iconos de oro, madera, carne y piedra usan el
primer frame de la hoja de su recogible en `content/appearance.json` (la de la piedra, la de la roca `medium`, la
misma que el contador del HUD); el de las gemas usa la hoja de la gema si la tiene y, si la gema se pinta como forma
de color, una forma con el color de la gema de `appearance.json`. Cada icono MUST medir en pantalla un cuadrado de lado
mayor que 2 veces el tamaño de letra del texto de la guía (antes del change medía 2em; el valor lo fija el design en
los datos de aspecto o en la hoja de estilos), y los iconos de una página MUST NOT solaparse entre sí ni con el texto,
el título, el indicador ni los controles. Con el contenido por defecto, la página 3 MUST mostrar los cinco iconos y la
página 5 al menos los de madera y piedra; una página que no declara recursos MUST NOT mostrar ningún icono de recurso.
Los iconos MUST respetar la CSP (sin estilos ni scripts en línea). Los iconos MUST NOT usar ninguna hoja que no sea la
de un recogible de `appearance.json` (ni una pieza de la interfaz) ni añadir por sí mismos entradas a
`content/asset-provenance.json`; el marco y los botones de la guía usan las piezas de la interfaz (ver "Aspecto de la
guía con piezas de UI"). Si la hoja de un icono no carga, la página MUST seguir mostrando su título, su texto y sus
controles, sin errores no capturados.

#### Scenario: Iconos de las páginas de recursos y de obra
- **GIVEN** el contenido por defecto y la guía abierta
- **WHEN** se visitan las páginas 3 y 5
- **THEN** la 3 muestra exactamente 5 iconos de recurso (gemas, oro, madera, carne y piedra, en el orden declarado)
  y la 5 al menos los de madera y piedra
- **AND** los de oro, madera, carne y piedra apuntan a las hojas `G_Idle`, `W_Idle`, `M_Idle` y `Deco/05` de
  `appearance.json`, y el de las gemas es una forma con el color de la gema de `appearance.json`

#### Scenario: Iconos de la guía mayores
- **GIVEN** la hoja de estilos del repositorio
- **WHEN** se leen las reglas de los iconos de recurso de la guía
- **THEN** su ancho y su alto son iguales y mayores que 2em (o, si el valor sale de los datos de aspecto, mayor que 2
  veces el tamaño de letra del texto de la guía)

#### Scenario: Iconos mayores en el navegador [E2E]
- **GIVEN** la build de producción sin `?e2e` con una ventana de 1.280 × 720 (k = 1), en el recorrido de la guía del
  smoke (ampliado, sin test nuevo)
- **WHEN** se abre la guía y se pasa a la página 3
- **THEN** cada uno de los 5 iconos mide > 32 × 32 px (más que los 2em de antes del change con la letra de 16 px) y
  ninguno se solapa con otro icono, con el texto de la página ni con el título

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
- **THEN** el título, el texto, el indicador `3 de 7` y los controles (la × incluida) son visibles y no hay errores no
  capturados

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
- **WHEN** una prueba E2E comprueba los 6 botones del menú, pulsa `Cómo jugar`, pulsa flecha derecha 7 veces,
  comprueba la guía con ventanas de 960 × 540 y de 1.920 × 1.080 y después pulsa Esc
- **THEN** al abrir la guía es visible con `1 de 7` y sin `Anterior`; tras 6 pulsaciones muestra `7 de 7` sin
  `Siguiente` y la séptima la deja en `7 de 7`
- **AND** con cada una de las dos ventanas el recuadro de la guía y sus botones visibles (la × incluida) están enteros
  dentro de la ventana, la × está en la esquina superior derecha del recuadro según "Botón × de cierre de los modales"
  (`sprite-rendering`) sin solaparse con el título de página ni con el indicador, y el recuadro tiene su centro en el
  de la ventana (error ≤ 1 px en cada eje)
- **AND** tras Esc la guía no es visible, el menú es visible con sus 6 botones, el HUD no es visible y el foco está en
  `Cómo jugar`
- **AND** no hay errores no capturados, se han abierto 0 diálogos nativos y no se registra ningún evento
  `securitypolicyviolation`

### Requirement: Aspecto de la guía con piezas de UI
La vista SHALL pintar la guía (`.guide-modal`) con las piezas de "Piezas de UI en los paneles DOM" (`sprite-rendering`):
el recuadro con el marco de `panel`; `Anterior`, `Siguiente` y la × con las piezas de botón según su estado; el
título de página (`.guide-modal__header h2`) con la cabecera `header`; el texto con la tinta `text` de `panel` y el
indicador `n de 7` con la tinta `accent`; todo con la fuente pixel. `Anterior` y `Siguiente` cumplen "Texto centrado
en los botones DOM" (`sprite-rendering`) y la × cumple además "Botón × de cierre de los modales". Con una ventana
≥ 960 × 540 y cualquier k, el título, el indicador, `Anterior`, `Siguiente` y la × MUST quedar dentro del recuadro, sin
solaparse entre sí, y el texto de la página dentro del área útil, entero o alcanzable desplazándolo dentro del
recuadro, sin que la barra de desplazamiento tape el marco; la × queda fuera de la zona que se desplaza. Si la pieza o
la fuente no carga, la guía se pinta con el aspecto de reserva y su navegación y su cierre no cambian.

#### Scenario: Guía dentro del marco a ×1 y a ×2
- **GIVEN** la hoja de estilos del repositorio y los datos de `ui`, con k = 1 (ventana de 960 × 540) y k = 2 (ventana de
  2.560 × 1.440)
- **WHEN** se leen las reglas de `.guide-modal` y de su cuerpo
- **THEN** el relleno interior del recuadro es ≥ (l·k, t·k, r·k, b·k) px y ≥ 12 px en cada lado, y el cuerpo de la
  página conserva su desplazamiento vertical interno, de modo que el texto queda en el área útil, entero o alcanzable
  desplazándolo, y la × queda fuera del cuerpo que se desplaza
- **AND** siguen valiendo "Guía entera en la ventana mínima y con escala ×2" (`main-menu`) y "Recorrido de la guía en
  el smoke"

#### Scenario: Controles de la guía con piezas de botón
- **GIVEN** la hoja de estilos del repositorio
- **WHEN** se leen las reglas de los botones de `.guide-modal`
- **THEN** `Anterior`, `Siguiente` y la × usan la pieza de `button`, con `buttonHover` en `:hover` y `:focus-visible`
  y `buttonPressed` en `:active`

## REMOVED Requirements
<!-- Ninguno. -->
