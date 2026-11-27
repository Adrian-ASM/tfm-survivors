# Spec delta · main-menu

<!-- Change 0036-ui-polish. Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test.
     Motivo: la guía y el panel `Sonido` se cierran con una × en la esquina superior derecha (nombres accesibles
     `Cerrar`; ver `menu-guide` y `audio`). Se actualiza la regla de centrado y maquetación que enumera sus controles.
     Revisadas sin cambios: "Menú de inicio al cargar" (Esc cierra la guía o el panel, como la ×), "Pausa con Esc"
     (Esc en la tienda y en la obra sale sin pausar; la × hace lo mismo, ver `castle-shop` y `build-sites`) y
     "Aspecto del menú, la pausa y el diálogo con piezas de UI": el menú, la pausa, el diálogo de `Borrar datos` y los
     resultados no tienen ×. -->

## ADDED Requirements
<!-- Ninguno. -->

## MODIFIED Requirements

### Requirement: Menú y pausa centrados en la ventana
La vista SHALL centrar en la ventana el menú de inicio (título, sus seis opciones y sus mensajes), el diálogo de
`Borrar datos`, la guía, el panel `Sonido` y el overlay de pausa: el centro horizontal de cada uno MUST coincidir con el
de la ventana (error ≤ 1 px) y su contenido MUST quedar centrado en vertical dentro de la ventana (la distancia de su
borde superior al de la ventana y la de su borde inferior al de la ventana difieren ≤ 1 px). Con una ventana
≥ 960 × 540 en ambos ejes, con cualquier escala de UI, todos sus botones y textos (y los deslizadores, la casilla y la ×
del panel `Sonido`) MUST quedar enteros dentro de la ventana y sin solaparse; en la guía, el recuadro, su título de
página, el indicador y los controles `Anterior`, `Siguiente` y la × (nombre accesible `Cerrar`) MUST quedar enteros
dentro de la ventana, y el texto de la página MUST quedar dentro del recuadro de la guía, visible entero o alcanzable
desplazándolo dentro del recuadro. La × de la guía y la del panel `Sonido` siguen "Botón × de cierre de los modales"
(`sprite-rendering`). Al redimensionar, se reubican desde el primer frame pintado tras el cambio y cada botón (la ×
incluida) MUST responder al clic en su posición nueva, sin cambiar el estado: el menú sigue en modo menú, el diálogo
sigue abierto, la guía sigue abierta en la misma página, el panel `Sonido` sigue abierto con los mismos ajustes y la
partida sigue en pausa (ver "Redimensionado de la ventana" en `world-camera`). El fondo del menú, si lo hay, MUST
cubrir la ventana entera.

#### Scenario: Menú centrado en dos ventanas
- **GIVEN** el menú de inicio con una ventana de 1.280 × 720, y en otra carga con una de 2.560 × 1.440
- **WHEN** se pinta 1 frame
- **THEN** el título y los botones `Jugar`, `Cómo jugar`, `Sonido`, `Exportar`, `Importar` y `Borrar datos` tienen su
  centro horizontal en x = 640 y x = 1.280 respectivamente (error ≤ 1 px), en ese orden de arriba abajo y enteros
  dentro de la ventana

#### Scenario: Jugar tras redimensionar el menú
- **GIVEN** el menú de inicio con una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 960 × 540, se pinta 1 frame y se hace clic en el centro de `Jugar` en su posición nueva
- **THEN** se crea exactamente 1 partida en curso y el menú deja de verse

#### Scenario: Diálogo abierto al redimensionar
- **GIVEN** el diálogo de `Borrar datos` abierto sobre un progreso guardado G con una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 1.600 × 900 y se pinta 1 frame
- **THEN** el diálogo sigue visible y centrado en x = 800 (error ≤ 1 px), el valor guardado sigue siendo G byte a byte
- **AND** al pulsar `Cancelar` en su posición nueva el diálogo se cierra y el menú vuelve a estar operativo

#### Scenario: Pausa centrada y operativa tras redimensionar
- **GIVEN** una partida en pausa en el tick 500 con una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 1.000 × 600, se pinta 1 frame y se pulsa `Reanudar` en su posición nueva
- **THEN** antes del clic el overlay de pausa, con `Pausa`, `Reanudar`, `Sonido` y `Volver al menú`, tiene su centro
  horizontal en x = 500 (error ≤ 1 px) y el snapshot sigue en el tick 500
- **AND** tras el clic y 1 frame de 16,667 ms el overlay de pausa no es visible y el snapshot tiene tick 501

#### Scenario: Ventana menor que 960 × 540
- **GIVEN** el menú de inicio con una ventana de 640 × 360
- **WHEN** se pinta 1 frame
- **THEN** el menú tiene su centro horizontal en x = 320 (error ≤ 1 px) y no hay errores no capturados

#### Scenario: Guía entera en la ventana mínima y con escala ×2
- **GIVEN** la guía abierta con una ventana de 960 × 540 y, en otra carga, con una de 1.920 × 1.080, cada una con la
  escala de UI que le corresponda
- **WHEN** se visita cada una de las 7 páginas y se pinta 1 frame en cada una
- **THEN** en cada página el recuadro de la guía tiene su centro horizontal en x = 480 y x = 960 respectivamente
  (error ≤ 1 px), está centrado en vertical (diferencia ≤ 1 px) y el recuadro, el título, el indicador y los
  controles visibles (la × incluida) están enteros dentro de la ventana y sin solaparse entre sí
- **AND** el texto de la página no sobresale del recuadro de la guía

#### Scenario: Guía abierta al redimensionar
- **GIVEN** la guía abierta en la página 4 con una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 960 × 540, se pinta 1 frame y se pulsa `Siguiente` en su posición nueva
- **THEN** antes del clic la guía sigue visible con el indicador `4 de 7` y centrada en x = 480 (error ≤ 1 px)
- **AND** tras el clic el indicador es `5 de 7` y no existe ninguna partida

#### Scenario: Cerrar la guía con la × tras redimensionar
- **GIVEN** la guía abierta en la página 2 con una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 960 × 540, se pinta 1 frame y se hace clic en la × en su posición nueva
- **THEN** la guía no es visible, el menú está en modo menú, no existe ninguna partida y el foco está en `Cómo jugar`

#### Scenario: Panel Sonido abierto al redimensionar
- **GIVEN** el panel `Sonido` abierto desde la pausa con música 30, con una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 960 × 540, se pinta 1 frame y se hace clic en la × (nombre accesible `Cerrar`) en su
  posición nueva
- **THEN** antes del clic el panel está centrado en x = 480 (error ≤ 1 px) y muestra `30 %`
- **AND** tras el clic el panel no es visible y el overlay de pausa sí, con la partida en el mismo tick

## REMOVED Requirements
<!-- Ninguno. -->
