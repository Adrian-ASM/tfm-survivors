# Spec delta · audio

<!-- Change 0036-ui-polish. Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test.
     Motivo: el panel `Sonido` se cierra con un botón × en la esquina superior derecha de su recuadro (nombre
     accesible `Cerrar`) y ya no tiene `Cerrar` abajo. El aspecto común de la × está en "Botón × de cierre de los
     modales" (`sprite-rendering`).

     Convención de la spec viva (se sustituye al archivar):
     - Antes: «**Panel `Sonido`**: overlay DOM con el título `Sonido`, los deslizadores `Música` y `Efectos` (…), la
       casilla `Silenciar todo` y el botón `Cerrar`.»
     - Ahora: «… la casilla `Silenciar todo` y el botón × de cierre (texto visible `×`, U+00D7, nombre accesible
       `Cerrar`) en la esquina superior derecha. En esta spec, "cerrar con `Cerrar`" significa pulsar la ×.»
     Con esa convención "Panel Sonido sin sonda" (`Audio observable en el navegador`) sigue valiendo sin cambio de
     texto: el E2E busca el botón por nombre accesible exacto. -->

## ADDED Requirements
<!-- Ninguno. -->

## MODIFIED Requirements

### Requirement: Panel Sonido
El sistema SHALL abrir el panel `Sonido` al pulsar el botón `Sonido` del menú de inicio (ver `main-menu`) o del overlay
de pausa, mostrando los ajustes en uso. Mover un deslizador cambia su ajuste en pasos de 5 dentro de 0..100 y su valor
visible `N %`; marcar o desmarcar `Silenciar todo` cambia el silencio. Se cierra con la × de su esquina superior
derecha (nombre accesible `Cerrar`, ver "Botón × de cierre de los modales" en `sprite-rendering`) o con una pulsación
de Esc (también ⏸ en modo móvil, que equivale a Esc), y los dos gestos producen exactamente el mismo resultado; el panel
MUST NOT tener ningún otro botón ni texto visible `Cerrar`. Al cerrarse, el foco queda en el botón `Sonido` que lo abrió
y se vuelve exactamente a la pantalla de antes: el menú en modo menú o la partida en pausa con su overlay. Al abrirse,
el foco queda dentro del panel. Mientras está abierto:
- solo hay 1 panel `Sonido` visible;
- los botones del menú o de la pausa que quedan debajo MUST NOT tener efecto, y R, 1, 2, 3 y el input de movimiento
  tampoco;
- abrirlo, usarlo y cerrarlo MUST NOT crear partida, ejecutar ticks, quitar la pausa ni cambiar el progreso.

El panel se pinta con las piezas de "Piezas de UI en los paneles DOM" (`sprite-rendering`): marco de `panel`, título con
`header`, la × con las piezas de botón y textos con la fuente pixel, con reserva si una pieza no carga. La × no se
solapa con el título, los deslizadores ni la casilla. Va centrado en la ventana como "Menú y pausa centrados en la
ventana" (`main-menu`) y, en modo móvil, a escala 1 y desplazable (ver "Paneles DOM en modo móvil" en
`mobile-display`). Ningún elemento del panel MUST tener atributo `style` ni provocar violaciones de la CSP.

#### Scenario: Abrir desde el menú y cerrar con Esc
- **GIVEN** el modo menú
- **WHEN** se pulsa `Sonido`, se pulsa Esc y se pulsa `Jugar`
- **THEN** tras `Sonido` el panel es visible con `Música`, `Efectos`, `Silenciar todo` y la × (nombre accesible
  `Cerrar`, texto visible `×`), y el foco está dentro; tras Esc no es visible, el foco está en `Sonido` y no existe
  partida; tras `Jugar` hay 1 partida en curso

#### Scenario: Cerrar con la × desde el menú y desde la pausa
- **GIVEN** el panel abierto desde el menú y, en otro caso, desde una partida en pausa en el tick 500
- **WHEN** se hace clic en la × y se pintan 60 frames
- **THEN** el panel no es visible y el foco está en el botón `Sonido` que lo abrió
- **AND** en el primer caso el menú sigue en modo menú sin partida; en el segundo la partida sigue en pausa en el tick
  500 con el overlay de pausa visible, y una pulsación de Esc quita la pausa

#### Scenario: Una sola × y ningún Cerrar visible
- **GIVEN** el panel abierto desde el menú
- **WHEN** se cuentan sus botones
- **THEN** hay exactamente 1 botón con nombre accesible `Cerrar`, con texto visible `×`, y ningún elemento del panel
  tiene el texto visible `Cerrar`

#### Scenario: Abrir desde la pausa
- **GIVEN** una partida en pausa en el tick 500
- **WHEN** se pulsa `Sonido`, se pulsa Esc y se pintan 60 frames
- **THEN** la partida sigue en pausa en el tick 500 con el overlay de pausa visible y el panel cerrado
- **AND** una pulsación más de Esc quita la pausa

#### Scenario: Botones de debajo bloqueados
- **GIVEN** el panel abierto desde la pausa y, en otro caso, desde el menú
- **WHEN** se pulsan `Reanudar` y `Volver al menú` (o `Jugar`, `Cómo jugar` y `Borrar datos`), R y 1
- **THEN** el panel sigue visible, la partida sigue en pausa (o no existe ninguna), la guía y el diálogo no se ven

#### Scenario: Límites del deslizador
- **GIVEN** el panel abierto con música 100 y efectos 0
- **WHEN** se pulsa flecha derecha sobre `Música` y flecha izquierda sobre `Efectos`
- **THEN** siguen en `100 %` y `0 %` y se han hecho 0 escrituras

#### Scenario: Panel centrado
- **GIVEN** el panel abierto con una ventana de 1.280 × 720 y, en otra carga, de 960 × 540
- **WHEN** se pinta 1 frame
- **THEN** su centro horizontal está en x = 640 y x = 480 respectivamente (error ≤ 1 px), está centrado en vertical
  (diferencia ≤ 1 px) y sus controles (la × incluida) están enteros dentro de la ventana y sin solaparse

## REMOVED Requirements
<!-- Ninguno. -->
