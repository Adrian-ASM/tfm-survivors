# Spec delta · menu-guide

> Change 0032-ui-kit. Términos (pieza, rol, márgenes, k, área útil, contraste y aspecto actual) según las
> convenciones del delta de `sprite-rendering` de este change. La navegación, el teclado, el foco y los textos de la
> guía no cambian.

## ADDED Requirements

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

## MODIFIED Requirements

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

#### Scenario: Iconos sin hojas propias
- **GIVEN** el repositorio tras este change
- **WHEN** se compone cada icono de recurso de las 7 páginas
- **THEN** cada icono con hoja apunta a la hoja de un recogible de `appearance.json` que ya figuraba en la nota de
  procedencia antes de 0032, ninguno apunta a la hoja de una pieza de la interfaz, y el de las gemas es una forma
  `data:` sin fichero

#### Scenario: Hoja de icono que no carga
- **GIVEN** la guía abierta en la página 3 y la hoja del icono de la madera que no carga
- **WHEN** se pinta la página
- **THEN** el título, el texto, el indicador `3 de 7` y los controles son visibles y no hay errores no capturados
