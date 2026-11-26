# Spec delta · upgrades

<!-- Change 0034-upgrade-icons. Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test.
     Decisiones de design pendientes (no las fija esta spec): posición del hueco del icono en la carta (arriba o al
     lado), su tamaño base s a k = 1 y si la carta cambia de tamaño. Las garantías de layout de este requisito y de
     "Escala de la UI del lienzo en modo móvil" (`mobile-display`) siguen valiendo con cualquier elección. -->

## ADDED Requirements

### Requirement: Icono en la carta de mejora
La vista SHALL mostrar en cada carta del overlay de elección el icono de su mejora, resuelto con "Resolución del
icono" (`sprite-rendering`): su icono, la reserva de personaje o ningún icono. El icono ocupa un **hueco** cuadrado del
layout puro de la carta (posición y tamaño base s × s a k = 1: decisión de design) que MUST:
- existir en toda carta, con icono o sin él: el layout de la carta y de sus textos no depende de qué imágenes cargaron;
- quedar dentro del área útil de la carta definida en "Cartas de mejora con piezas de UI" (a ≥ max(16, l)·k px del
  borde izquierdo y a ≥ max(16, r)·k px del derecho, a ≥ t·k px del superior y a ≥ b·k px del inferior);
- no solaparse con los rectángulos del nombre, de la descripción ajustada ni de "nivel actual → siguiente";
- medir y estar a una distancia del origen de la carta k veces lo que a k = 1 (error ≤ 1 px), con k entero en escritorio
  (×1, ×2) y fraccionario en modo móvil (ver `mobile-display`).

La imagen del icono MUST pintarse sin suavizado (filtro `NEAREST`) y llenar el hueco. El icono no tiene zona de clic
propia: un clic sobre él elige la opción de su carta. Al redimensionar o cambiar de k, los iconos existentes MUST
cambiar de tamaño y posición sin crear otros (el número de iconos creados por el overlay no crece con los RESIZE). Con
la carta en la reserva de "Reserva de las piezas de UI y de la fuente" (sin textura de `button` o sin WebGL) el icono se
muestra igual, en el mismo hueco. Siguen valiendo, con el icono, "Ventana mínima con cartas enteras" y "Descripción más
larga del catálogo" (todo el texto dentro del área útil, cartas enteras y sin solaparse) y, en modo móvil, "Texto mínimo
en un móvil horizontal" (factor 1,4066 a 844 × 390 y cartas ≥ 44 × 44 px CSS).

#### Scenario: Un icono por carta
- **GIVEN** todas las imágenes de iconos cargadas y una oferta de 3 opciones `guardrail`, `shortcuts` y `hunter`,
  pintada con dobles de Phaser con una ventana de 1.280 × 720 (k = 1) y otra de 2.560 × 1.440 (k = 2)
- **WHEN** se pinta el overlay de elección
- **THEN** hay exactamente 3 iconos, uno por carta, con la textura del icono de `guardrail`, `shortcuts` y `hunter`
  respectivamente y filtro `NEAREST`
- **AND** en cada carta el icono ocupa su hueco del layout (error ≤ 1 px), dentro del área útil y sin solaparse con el
  nombre, la descripción ni "nivel actual → siguiente"

#### Scenario: Hueco escalado con k entero y fraccionario
- **GIVEN** el layout de una carta con k = 1, con k = 2 y, en modo móvil con texto mínimo 12 px CSS y una ventana de
  844 × 390, con k = 1,4066
- **WHEN** se calcula el rectángulo del hueco del icono relativo al origen de su carta
- **THEN** con k = 2 su posición y su lado son 2 veces los de k = 1, y con k = 1,4066 son 1,4066 veces los de k = 1
  (error ≤ 1 px)
- **AND** con k = 1,4066 las 3 cartas están enteras dentro del lienzo, no se solapan y cada una mide ≥ 44 × 44 px CSS

#### Scenario: Descripción más larga con icono
- **GIVEN** una oferta de 3 opciones cuyas cartas muestran las 3 descripciones más largas del catálogo de personaje
  por defecto, pintada con ventanas de 960 × 540 (k = 1) y de 2.560 × 1.440 (k = 2), con la pieza de `button` del
  repositorio
- **WHEN** se calcula el layout de las cartas, de sus textos y de su hueco de icono con el ancho por carácter de la
  fuente
- **THEN** en cada carta el bloque de texto y el hueco caben en el área útil sin solaparse entre sí, y las 3 cartas
  están enteras dentro de la ventana y sin solaparse

#### Scenario: Mejora sin icono propio
- **GIVEN** el contenido por defecto sin la entrada de `armor` en el mapa de iconos y una oferta de 3 opciones con
  `armor` en el índice 1
- **WHEN** se pinta el overlay de elección con dobles de Phaser
- **THEN** la carta de índice 1 muestra la reserva de personaje en su hueco, del mismo tamaño y en la misma posición
  que el icono de las otras dos

#### Scenario: Icono y reserva que no cargan
- **GIVEN** una oferta de 3 opciones con `shortcuts` en el índice 1, con la imagen de `shortcuts` sin cargar y, en otro
  caso, también la reserva de personaje sin cargar
- **WHEN** se pinta el overlay y se pulsa la tecla 2
- **THEN** en el primer caso la carta de índice 1 muestra la reserva de personaje; en el segundo no muestra ningún
  icono y su nombre, su descripción y "nivel actual → siguiente" están en las mismas posiciones que con icono
  (error ≤ 1 px)
- **AND** en ambos casos se elige la opción de índice 1 y no hay errores no capturados

#### Scenario: Icono en la carta de reserva
- **GIVEN** la textura de `button` ausente (y, en otro caso, un renderizador Canvas) y una oferta de 3 opciones con
  todas las imágenes de iconos cargadas
- **WHEN** se pinta el overlay de elección con dobles de Phaser
- **THEN** cada carta es el rectángulo de reserva y muestra su icono en su hueco del layout (error ≤ 1 px)

#### Scenario: Clic sobre el icono y RESIZE sin crear iconos
- **GIVEN** el overlay visible con 3 cartas y una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 1.000 × 600, después a 2.560 × 1.440 y después a 960 × 540, pintando 1 frame tras cada
  cambio, y se hace clic en el centro del icono de la carta de índice 2
- **THEN** el overlay ha creado 3 iconos en total, los mismos en los 4 frames, cada uno en el hueco de su carta en el
  layout de ese frame (error ≤ 1 px)
- **AND** el clic elige la opción de índice 2

## MODIFIED Requirements

### Requirement: Overlay de elección
La vista SHALL mostrar, mientras el snapshot tenga una oferta abierta, un overlay con una carta por opción, en el
orden de la oferta, con su icono (ver "Icono en la carta de mejora"), su nombre, su descripción y su nivel actual →
siguiente. Pulsar la tecla 1, 2 o 3, o hacer clic en una carta (también sobre su icono), MUST elegir la opción de
índice 0, 1 o 2 respectivamente, a través del caso de uso de elección. Una tecla sin carta (p. ej. 3 con 2 opciones)
no hace nada. Sin oferta abierta el overlay no se ve, no hay iconos de carta visibles y las teclas 1, 2 y 3 no hacen
nada. Mientras el overlay se ve, el input de movimiento no llega a la simulación.

#### Scenario: Tres cartas
- **GIVEN** un snapshot con una oferta de 3 opciones
- **WHEN** se pinta
- **THEN** el overlay es visible con 3 cartas, cada una con el icono resuelto, el nombre, la descripción y "nivel
  actual → siguiente" de su opción, en el orden de la oferta

#### Scenario: Elegir con tecla
- **GIVEN** el overlay visible con 3 cartas
- **WHEN** se pulsa la tecla 2
- **THEN** se elige la opción de índice 1 y, sin más subidas pendientes, el overlay deja de verse

#### Scenario: Elegir con clic
- **GIVEN** el overlay visible con 3 cartas
- **WHEN** se hace clic en la tercera
- **THEN** se elige la opción de índice 2

#### Scenario: Menos cartas
- **GIVEN** un snapshot con una oferta de 2 opciones
- **WHEN** se pinta y se pulsa la tecla 3
- **THEN** el overlay muestra 2 cartas con 2 iconos, no se elige nada y el overlay sigue visible

#### Scenario: Sin oferta
- **GIVEN** un snapshot sin oferta
- **WHEN** se pinta y se pulsan las teclas 1, 2 y 3
- **THEN** el overlay no es visible, no hay ningún icono de carta visible y la partida no cambia por esas teclas

## REMOVED Requirements
<!-- Ninguno. -->
