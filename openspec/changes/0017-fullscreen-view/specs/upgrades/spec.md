# Spec delta · upgrades

<!-- Change 0017-fullscreen-view. "Ventana" como en el delta de `world-camera`. El tamaño de las cartas y si escalan
     con la ventana los fija el design; esta spec fija centrado, contención y zonas de clic. -->

## ADDED Requirements

### Requirement: Overlay de elección en la ventana
La vista SHALL centrar el overlay de elección en la ventana: el centro del rectángulo que engloba sus cartas MUST
coincidir con el centro de la ventana (error ≤ 1 px), con las cartas en una fila en el orden de la oferta y
simétricas respecto a ese centro. Con 3 cartas, la de índice 1 MUST contener el centro de la ventana; con 1 carta, esa
carta. Con una ventana ≥ 960 × 540 en ambos ejes, todas las cartas MUST quedar enteras dentro de la ventana y no
solaparse. Al redimensionar, el overlay MUST reubicarse desde el primer frame pintado tras el cambio, sin cerrarse ni
cambiar la oferta, y el clic en cada carta MUST elegir su opción en la posición nueva (ver "Redimensionado de la
ventana" en `world-camera`). Un clic fuera de todas las cartas MUST NOT elegir nada.

#### Scenario: Tres cartas centradas
- **GIVEN** un snapshot con una oferta de 3 opciones pintado con una ventana de 1.280 × 720
- **WHEN** se pinta el overlay
- **THEN** el centro del rectángulo que engloba las 3 cartas es (640, 360) (error ≤ 1 px), la carta de índice 1
  contiene (640, 360) y las 3 están enteras dentro de la ventana

#### Scenario: Clic tras redimensionar
- **GIVEN** el overlay visible con 3 cartas y una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 1.000 × 600, se pinta 1 frame y se hace clic en el centro de la tercera carta en su
  posición nueva
- **THEN** se elige la opción de índice 2
- **AND** antes de ese clic, uno en (5, 5), fuera de todas las cartas, no elige nada y la oferta sigue abierta

#### Scenario: Dos cartas y una carta
- **GIVEN** una oferta de 2 opciones, y en otro caso de 1, pintada con una ventana de 960 × 540
- **WHEN** se pinta el overlay
- **THEN** el rectángulo que engloba las cartas está centrado en (480, 270) (error ≤ 1 px); con 1 opción, la carta
  contiene (480, 270)

#### Scenario: Ventana mínima con cartas enteras
- **GIVEN** una oferta de 3 opciones pintada con una ventana de 960 × 540, y en otro caso de 3.840 × 2.160
- **WHEN** se pinta el overlay
- **THEN** en ambos casos las 3 cartas están enteras dentro de la ventana, no se solapan y su texto (nombre,
  descripción y "nivel actual → siguiente") se ve entero

#### Scenario: Ventana menor que 960 × 540
- **GIVEN** una oferta de 3 opciones pintada con una ventana de 640 × 360
- **WHEN** se pinta el overlay y se pulsa la tecla 2
- **THEN** el overlay está centrado en (320, 180) (error ≤ 1 px), no hay errores no capturados y se elige la opción de
  índice 1

## MODIFIED Requirements

### Requirement: Progresión observable en el juego
El sistema SHALL permitir, en el juego real y con el contenido por defecto, recorrer el bucle completo matar →
recoger gemas → subir de nivel → elegir mejora → seguir jugando.

#### Scenario: Primera subida en el núcleo
- **GIVEN** el contenido por defecto (mundo de 3.840 × 2.160 y anillo de aparición de contenido), semilla 7 e input
  (0, 0) en todos los ticks
- **WHEN** se ejecutan ticks hasta el 4.800 (80 s), eligiendo la opción 0 en cada oferta
- **THEN** se abre ≥ 1 oferta en algún tick ≤ 4.800 (medido en apply de 0017: tick 1.527)

#### Scenario: Recorrido en el navegador
- **GIVEN** la build de producción servida con `?seed=7`
- **WHEN** una prueba E2E deja jugar sin input hasta que aparece el overlay y pulsa la tecla 1
- **THEN** antes del overlay el nivel mostrado es 1; tras pulsar, el overlay desaparece, el nivel mostrado es 2 y
  los ticks del snapshot vuelven a avanzar

<!-- historial: 0017-fullscreen-view (pendiente de archivar) -->
