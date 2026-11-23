# Spec delta · run-results

<!-- Change 0017-fullscreen-view. "Ventana" como en el delta de `world-camera`. El tamaño del overlay y si escala
     con la ventana los fija el design. -->

## ADDED Requirements

### Requirement: Overlay de resultados centrado en la ventana
La vista SHALL centrar en la ventana el overlay de resultados (título, tiempo, nivel, bajas, indicación de R, récords,
botones `Exportar` e `Importar`, mensajes y avisos): su centro horizontal MUST coincidir con el de la ventana (error
≤ 1 px) y su contenido MUST quedar centrado en vertical (la distancia de su borde superior al de la ventana y la de su
borde inferior al de la ventana difieren ≤ 1 px). Con una ventana ≥ 960 × 540 en ambos ejes, todo su contenido MUST
quedar entero dentro de la ventana y sin solaparse, también con el aviso `no se guarda`, el de `dañados` y un mensaje
de import a la vez. Al redimensionar, se reubica desde el primer frame pintado tras el cambio, los botones responden al
clic en su posición nueva y la partida terminada no cambia (ver "Redimensionado de la ventana" en `world-camera`).

#### Scenario: Resultados centrados
- **GIVEN** una partida terminada con derrota en el tick 1.259, nivel 3 y 41 bajas, pintada con una ventana de
  1.280 × 720, y en otra carga con una de 2.560 × 1.440
- **WHEN** se pinta el overlay de resultados
- **THEN** su centro horizontal está en x = 640 y x = 1.280 respectivamente (error ≤ 1 px) y su contenido está entero
  dentro de la ventana

#### Scenario: Contenido máximo en la ventana mínima
- **GIVEN** una ventana de 960 × 540 y una partida terminada cuyo overlay muestra, a la vez, el aviso `no se guarda`,
  el aviso `dañados` y el mensaje de import con `no válido`
- **WHEN** se pinta el overlay de resultados
- **THEN** el título, el tiempo, el nivel, las bajas, la indicación de R, los tres récords, los dos botones, el
  mensaje y los dos avisos están enteros dentro de la ventana y no se solapan

#### Scenario: Botones tras redimensionar
- **GIVEN** una partida terminada en el tick n con el overlay de resultados visible y una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 1.000 × 600, se pinta 1 frame y se pulsa `Exportar` en su posición nueva
- **THEN** se descarga exactamente 1 fichero `sprint-survivors-progress.json` y el snapshot sigue igual campo a campo
  al del tick n
- **AND** la tecla R sigue empezando exactamente 1 partida nueva con una sola pulsación

<!-- historial: 0017-fullscreen-view (pendiente de archivar) -->
