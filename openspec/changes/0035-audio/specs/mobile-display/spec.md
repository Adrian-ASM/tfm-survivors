# Spec delta · mobile-display

<!-- Change 0035-audio. Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test.
     Motivo: el panel `Sonido` (ver `audio`) es un panel DOM más y sigue las reglas de los paneles en modo móvil. -->

## ADDED Requirements
<!-- Ninguno. -->

## MODIFIED Requirements

### Requirement: Paneles DOM en modo móvil
En modo móvil, los paneles DOM (menú de inicio, diálogo de `Borrar datos`, guía, panel `Sonido`, pausa, tienda, panel
de obra y resultados) SHALL mostrarse a escala de UI 1 en px CSS sea cual sea la ventana (la escala de UI DOM nunca
vale > 1), centrados en horizontal en la ventana como fijan `main-menu`, `menu-guide`, `audio`, `castle-shop`,
`build-sites` y `run-results`. Si el contenido de un panel no cabe en el alto de la ventana, el panel MUST poder
desplazarse dentro de sí mismo hasta mostrar entero cada uno de sus botones y textos, sin que se desplace el documento.
Cada botón o zona pulsable de esos paneles (también los deslizadores y la casilla del panel `Sonido`) MUST medir
≥ 44 × 44 px CSS. Las garantías de esas specs para ventanas ≥ 960 × 540 siguen valiendo en modo móvil con escala 1. Sin
modo móvil, la escala DOM y el tamaño de los paneles no cambian.

#### Scenario: Paneles en un móvil horizontal
- **GIVEN** el modo móvil y una ventana de 844 × 390
- **WHEN** se abre, en cada caso, el menú, el diálogo de `Borrar datos`, la guía en cada una de sus 7 páginas, el
  panel `Sonido` desde el menú y desde la pausa, la pausa, la tienda con todos sus productos, el panel de obra y los
  resultados con el aviso `no se guarda`, el de `dañados` y un mensaje de import a la vez
- **THEN** en cada panel la escala de UI DOM vale 1, cada botón (y cada deslizador y casilla) mide ≥ 44 × 44 px CSS y,
  desplazando el panel, cada control y cada texto se ve entero dentro de la ventana
- **AND** el documento no tiene barras de desplazamiento

#### Scenario: Botones operativos tras desplazar
- **GIVEN** el modo móvil, una ventana de 844 × 390 y el menú de inicio
- **WHEN** se desplaza el menú hasta ver entero `Borrar datos` y se toca su centro
- **THEN** se abre el diálogo de confirmación y no existe ninguna partida

#### Scenario: Deslizador táctil del panel Sonido
- **GIVEN** el modo móvil, una ventana de 844 × 390 y el panel `Sonido` abierto con música 50
- **WHEN** se arrastra con el dedo el deslizador `Música` hasta su extremo izquierdo y se suelta
- **THEN** el panel muestra música `0 %`, no se ha creado joystick y se ha escrito 1 vez el ajuste

#### Scenario: Escala DOM sin crecer en pantallas grandes
- **GIVEN** la URL `?mobile=1` y una ventana de 2.560 × 1.440, y en otra carga la misma ventana sin `mobile`
- **WHEN** se muestra el menú de inicio
- **THEN** la escala de UI DOM vale 1 en la primera y la de escritorio (≥ 2) en la segunda

## REMOVED Requirements
<!-- Ninguno. -->
