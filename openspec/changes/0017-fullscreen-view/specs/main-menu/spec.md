# Spec delta · main-menu

<!-- Change 0017-fullscreen-view. "Ventana" como en el delta de `world-camera`. El tamaño de los botones y si escalan
     con la ventana los fija el design. -->

## ADDED Requirements

### Requirement: Menú y pausa centrados en la ventana
La vista SHALL centrar en la ventana el menú de inicio (título, sus cuatro opciones y sus mensajes), el diálogo de
`Borrar datos` y el overlay de pausa: el centro horizontal de cada uno MUST coincidir con el de la ventana (error
≤ 1 px) y su contenido MUST quedar centrado en vertical dentro de la ventana (la distancia de su borde superior al de
la ventana y la de su borde inferior al de la ventana difieren ≤ 1 px). Con una ventana ≥ 960 × 540 en ambos ejes,
todos sus botones y textos MUST quedar enteros dentro de la ventana y sin solaparse. Al redimensionar, se reubican
desde el primer frame pintado tras el cambio y cada botón MUST responder al clic en su posición nueva, sin cambiar el
estado: el menú sigue en modo menú, el diálogo sigue abierto y la partida sigue en pausa (ver "Redimensionado de la
ventana" en `world-camera`). El fondo del menú, si lo hay, MUST cubrir la ventana entera.

#### Scenario: Menú centrado en dos ventanas
- **GIVEN** el menú de inicio con una ventana de 1.280 × 720, y en otra carga con una de 2.560 × 1.440
- **WHEN** se pinta 1 frame
- **THEN** el título y los botones `Jugar`, `Exportar`, `Importar` y `Borrar datos` tienen su centro horizontal en
  x = 640 y x = 1.280 respectivamente (error ≤ 1 px), en ese orden de arriba abajo y enteros dentro de la ventana

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
- **THEN** antes del clic el overlay de pausa, con `Pausa`, `Reanudar` y `Volver al menú`, tiene su centro horizontal
  en x = 500 (error ≤ 1 px) y el snapshot sigue en el tick 500
- **AND** tras el clic y 1 frame de 16,667 ms el overlay de pausa no es visible y el snapshot tiene tick 501

#### Scenario: Ventana menor que 960 × 540
- **GIVEN** el menú de inicio con una ventana de 640 × 360
- **WHEN** se pinta 1 frame
- **THEN** el menú tiene su centro horizontal en x = 320 (error ≤ 1 px) y no hay errores no capturados

<!-- historial: 0017-fullscreen-view (pendiente de archivar) -->
