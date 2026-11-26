# Spec delta · castle-shop

<!-- Change 0034-upgrade-icons. Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test.
     Decisiones de design pendientes (no las fija esta spec): posición del icono en la fila y su tamaño base, cómo se
     detecta en el DOM que una imagen no cargó (precarga o el propio elemento) y si la curación usa la reserva de arma
     o una propia ("la reserva de la curación" en los escenarios). -->

## ADDED Requirements

### Requirement: Icono en las filas de la tienda
La vista SHALL mostrar en cada fila de producto del overlay de la tienda (las 6 mejoras de arma y la curación)
exactamente un icono, resuelto con "Resolución del icono" (`sprite-rendering`): el del id del producto, la reserva de
su categoría (arma para las mejoras; la de la curación para `heal`) o ninguno. El icono es un elemento de imagen del
DOM que:
- usa una URL del mismo origen bajo `/tfm-survivors/assets/`, nunca `http:`, `https:`, `//`, `data:` ni `blob:`
  (la CSP `img-src 'self' data:` no cambia);
- es decorativo: texto alternativo vacío, de modo que el nombre accesible de la fila sigue siendo el de antes del
  change;
- no tiene atributo `style`, se escala sin suavizado (`image-rendering: pixelated`) y mide lo mismo en ancho y en alto,
  proporcional a la escala de UI DOM (`--ui-scale`; 1 en modo móvil);
- queda dentro del área útil de la pieza de su fila y no cambia el texto, el orden ni las tintas del nombre, la
  descripción, el nivel, el precio ni el aviso.

Si la imagen del icono de una fila no está disponible, la fila MUST mostrar la reserva; si tampoco lo está, la fila
MUST ocultar el icono sin cambiar nada más. Un clic sobre el icono MUST comportarse como un clic en su fila (intenta la
compra). Mostrar o cambiar un icono MUST NOT cambiar el snapshot. En modo móvil cada fila sigue midiendo ≥ 44 × 44 px
CSS (ver "Paneles DOM en modo móvil" en `mobile-display`).

#### Scenario: Siete filas con su icono
- **GIVEN** un snapshot en tienda con el contenido por defecto, todas las imágenes de iconos disponibles y la base
  `/tfm-survivors/`, montado en un DOM de prueba
- **WHEN** se pinta el overlay
- **THEN** cada una de las 7 filas (`strict-rules`, `fast-ci`, `wide-analysis`, `hard-asserts`, `watch-mode`,
  `coverage` y `heal`, en ese orden) tiene exactamente 1 elemento de imagen, con la URL del icono de su id bajo
  `/tfm-survivors/assets/`, texto alternativo vacío y sin atributo `style`
- **AND** el nombre, la descripción, el nivel y el precio de cada fila son los mismos textos que antes del change

#### Scenario: Producto sin icono propio
- **GIVEN** el contenido por defecto sin la entrada de `watch-mode` y, en otro caso, sin la de `heal` en el mapa de
  iconos, con un snapshot en tienda
- **WHEN** se pinta el overlay
- **THEN** la fila de `watch-mode` usa la URL de la reserva de arma, y en el otro caso la de `heal` usa la de la
  reserva de la curación

#### Scenario: Imagen que no carga
- **GIVEN** un snapshot en tienda con oro 12 y `strict-rules` a precio 10, con la imagen de `strict-rules` no
  disponible y, en otro caso, tampoco la reserva de arma
- **WHEN** se pinta el overlay, se hace clic en la fila de `strict-rules` y se pinta el frame siguiente
- **THEN** en el primer caso la fila muestra la reserva de arma y en el segundo no muestra ningún icono, con sus textos
  iguales
- **AND** en ambos casos el overlay muestra oro 2 y `strict-rules` en nivel 1, sin errores no capturados

#### Scenario: Reglas del icono de fila
- **GIVEN** la hoja de estilos del repositorio
- **WHEN** se leen las reglas del icono de las filas de la tienda, también bajo `.is-mobile`
- **THEN** declaran `image-rendering: pixelated`, el mismo ancho que alto, proporcional a `--ui-scale`, y no contienen
  ningún `url(` literal
- **AND** en modo móvil el alto del icono es ≤ el alto mínimo de la fila (44 px CSS), de modo que la fila sigue
  midiendo ≥ 44 × 44 px CSS

#### Scenario: Clic sobre el icono
- **GIVEN** el overlay con oro 12 y `strict-rules` a precio 10
- **WHEN** se hace clic en el icono de la fila de `strict-rules` y se pinta el frame siguiente
- **THEN** el overlay muestra oro 2 y `strict-rules` en nivel 1

## MODIFIED Requirements

### Requirement: Overlay de la tienda
La vista SHALL mostrar, si y solo si el snapshot está en tienda, un overlay centrado en la ventana con el oro
disponible, una fila por producto en el orden de la tienda (icono, ver "Icono en las filas de la tienda"; nombre,
descripción, nivel actual / máximo y precio, o "máximo" sin precio) y un botón `Salir`. Un producto cuyo precio supera
el oro, o la curación con la vida llena, MUST mostrarse como no comprable, con el aviso `Oro insuficiente` (o de vida
llena) visible en esa fila. Hacer clic en un producto (también sobre su icono) MUST intentar comprarlo con el caso de
uso de compra: si la compra falla, no cambia nada. Pulsar Esc o el botón `Salir` MUST salir de la tienda con el caso de
uso de salida, sin abrir la pausa (ver "Pausa con Esc" en `main-menu`). Mientras el overlay se ve, el input de
movimiento no llega a la simulación y las teclas 1, 2, 3 y R no tienen efecto. Tras cada compra, el overlay y el HUD
muestran el oro, los niveles y la vida del snapshot nuevo desde el siguiente frame pintado.

#### Scenario: Overlay con oro justo
- **GIVEN** un snapshot en tienda con oro 12, `strict-rules` a precio 10 y `fast-ci` a precio 15
- **WHEN** se pinta
- **THEN** el overlay es visible con oro 12, 7 filas en el orden de la tienda, cada una con 1 icono, y el botón `Salir`
- **AND** la fila de `strict-rules` es comprable y la de `fast-ci` muestra `Oro insuficiente`

#### Scenario: Clic en un producto
- **GIVEN** el overlay del escenario anterior
- **WHEN** se hace clic en la fila de `strict-rules` y se pinta el frame siguiente
- **THEN** el overlay muestra oro 2 y `strict-rules` en nivel 1, y la fila de `strict-rules` muestra `Oro insuficiente`

#### Scenario: Clic sin oro
- **GIVEN** el overlay del escenario "Overlay con oro justo"
- **WHEN** se hace clic en la fila de `fast-ci`
- **THEN** el snapshot no cambia y el overlay sigue visible

#### Scenario: Salir con Esc o con el botón
- **GIVEN** el overlay visible en el tick n, una vez, y otra vez el mismo estado
- **WHEN** en la primera se pulsa Esc y en la segunda se pulsa `Salir`, y en ambas se pinta 1 frame de 16,667 ms
- **THEN** en ambas el overlay no es visible, el overlay de pausa no se ha visto y `snapshot.tick` vale n + 1

#### Scenario: Sin overlay fuera de la tienda
- **GIVEN** snapshots en curso, eligiendo mejora, en pausa y terminado
- **WHEN** se pintan
- **THEN** el overlay de la tienda no es visible en ninguno

## REMOVED Requirements
<!-- Ninguno. -->
