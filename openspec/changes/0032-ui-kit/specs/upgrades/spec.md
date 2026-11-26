# Spec delta · upgrades

> Change 0032-ui-kit. Términos (pieza, rol, márgenes, tintas, k, esquina en pantalla, área útil, contraste y aspecto
> actual) según las convenciones del delta de `sprite-rendering` de este change. La oferta, la elección (teclas 1, 2 y
> 3 y clic) y el centrado del overlay no cambian.

## ADDED Requirements

### Requirement: Cartas de mejora con piezas de UI
La vista SHALL pintar cada carta del overlay de elección, cuando existe la textura de `button` y el renderizador es
WebGL, con **exactamente una** pieza nine-slice de `button` del tamaño y en la posición de la carta que da el layout del
overlay ("Overlay de elección en la ventana"), con esquinas en pantalla de (margen × k) px exactos. El nombre, la
descripción y "nivel actual → siguiente" MUST usar la fuente pixel y la tinta `text` de `button`, y quedar dentro del
área útil de la carta, con un margen horizontal de al menos 16·k px: su borde izquierdo a ≥ max(16, l)·k px del de la
carta, su ancho de ajuste ≤ ancho de la carta − (max(16, l) + max(16, r))·k, su borde superior a ≥ t·k px del de la
carta y su borde inferior a ≥ b·k px del inferior de la carta. La zona de clic de cada carta MUST ser el rectángulo
entero de la carta (márgenes incluidos): un clic dentro elige su opción y uno fuera de todas no elige nada. Al
redimensionar la ventana o cambiar de k, las piezas existentes MUST cambiar de tamaño y de posición sin crear otras: el
número de piezas creadas por el overlay no crece con los RESIZE. Sin la textura de `button` o sin WebGL, cada carta se
pinta con el rectángulo del aspecto actual (ver "Reserva de las piezas de UI y de la fuente" en `sprite-rendering`) con
el mismo layout, la misma zona de clic y el mismo comportamiento.

#### Scenario: Una pieza por carta
- **GIVEN** la textura de `button` cargada, un renderizador WebGL y un snapshot con una oferta de 3 opciones, y en otro
  caso de 2
- **WHEN** se pinta el overlay de elección con dobles de Phaser
- **THEN** hay exactamente 3 piezas nine-slice de `button` (2 en el otro caso), una por carta, cada una en el
  rectángulo de su carta del layout (error ≤ 1 px)
- **AND** el rectángulo de clic de cada carta no tiene relleno ni trazo visibles y los textos usan la tinta `text` de
  `button`

#### Scenario: Esquinas y texto de la carta a ×1 y a ×2
- **GIVEN** una pieza de prueba de `button` con márgenes (l, t, r, b) = (20, 12, 20, 28) y una oferta de 3 opciones con
  `guardrail`, `shortcuts` y `hunter`, pintada con una ventana de 1.280 × 720 (k = 1) y otra de 2.560 × 1.440 (k = 2)
- **WHEN** se calcula el layout de las cartas y de sus textos
- **THEN** las esquinas en pantalla miden 20 × 12, 20 × 12, 20 × 28 y 20 × 28 px con k = 1 y 40 × 24, 40 × 24,
  40 × 56 y 40 × 56 px con k = 2
- **AND** en cada carta el texto empieza a ≥ 20·k px de su borde izquierdo y a ≥ 12·k px del superior, termina a
  ≥ 28·k px del inferior, y su ancho de ajuste es ≤ ancho de la carta − 40·k

#### Scenario: Descripción más larga del catálogo
- **GIVEN** una oferta de 3 opciones cuyas cartas muestran las 3 descripciones más largas del catálogo por defecto,
  pintada con ventanas de 960 × 540 (k = 1) y de 2.560 × 1.440 (k = 2), con la pieza de `button` del repositorio
- **WHEN** se calcula el layout de las cartas y de sus textos con el ancho por carácter de la fuente
- **THEN** en cada carta el bloque de texto (nombre, descripción ajustada y "nivel actual → siguiente") cabe en el área
  útil de la carta, y las 3 cartas están enteras dentro de la ventana y sin solaparse

#### Scenario: Clic en el margen de la carta
- **GIVEN** el overlay visible con 3 cartas con piezas de `button` de márgenes (20, 12, 20, 28) y k = 1
- **WHEN** se hace clic 4 px dentro de la esquina superior izquierda de la tercera carta, y en otro caso 1 px fuera de
  su borde derecho
- **THEN** en el primero se elige la opción de índice 2 y en el segundo no se elige nada y la oferta sigue abierta

#### Scenario: Redimensionar sin crear piezas
- **GIVEN** el overlay visible con 3 cartas y una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 1.000 × 600, después a 2.560 × 1.440 y después a 960 × 540, pintando 1 frame tras cada
  cambio
- **THEN** el overlay ha creado 3 piezas en total, las mismas 3 en los 4 frames, cada una con el tamaño y la posición
  de su carta en el layout de ese frame (error ≤ 1 px)
- **AND** un clic en el centro de la carta de índice 1 tras el último cambio elige la opción de índice 1
