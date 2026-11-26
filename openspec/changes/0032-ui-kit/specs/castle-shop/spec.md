# Spec delta · castle-shop

> Change 0032-ui-kit. Términos (pieza, rol, márgenes, tintas, relleno, k, área útil, contraste, aspecto actual y reserva
> de un panel DOM) según las convenciones del delta de `sprite-rendering` de este change. Los productos, la compra, la
> salida y la sonda `window.__sprint.shop` no cambian.

## ADDED Requirements

### Requirement: Aspecto del overlay de la tienda con piezas de UI
La vista SHALL pintar el overlay de la tienda (`.shop-panel`) con las piezas de "Piezas de UI en los paneles DOM"
(`sprite-rendering`): marco de `panel`; el título (`h2`) con la cabecera `header`; cada fila de producto comprable con la
pieza de `button` (y `buttonHover` / `buttonPressed` según su estado); cada fila no comprable (`Oro insuficiente` o vida
llena) con la de `buttonDisabled`, sin dejar de responder al clic igual que antes (el clic intenta la compra, que falla
sin cambiar nada); `Salir` con la de `button`; y la fuente pixel. Sobre cada pieza, el nombre, el nivel y el precio usan
su tinta `text`, la descripción su tinta `muted` y el aviso `Oro insuficiente` (o el de vida llena) su tinta `danger`;
el oro disponible, la tinta `text` de `panel`. Con una ventana ≥ 960 × 540 y cualquier k, el overlay MUST quedar entero
dentro de la ventana; el oro, el título y `Salir` MUST verse siempre enteros dentro del área útil del marco, y la lista
de productos MUST quedar dentro del área útil, entera o alcanzable desplazándola dentro del panel (desplazamiento
interno de la lista, como el texto de la guía), sin solaparse con el oro ni con `Salir`. Desplazar la lista MUST NOT
cambiar el snapshot ni cerrar la tienda, y cada fila MUST responder al clic en su posición desplazada. Si una pieza o la
fuente no carga, el overlay se pinta con su reserva (borde de 1 px `#f5c542`) y la compra y la salida funcionan igual.

#### Scenario: Filas comprables y no comprables
- **GIVEN** un snapshot en tienda con oro 12, `strict-rules` a precio 10 y `fast-ci` a precio 15
- **WHEN** se pinta el overlay
- **THEN** la fila de `strict-rules` usa la pieza de `button` y la de `fast-ci` la de `buttonDisabled`, con
  `Oro insuficiente` en la tinta `danger` de `buttonDisabled`
- **AND** un clic en la fila de `fast-ci` no cambia el snapshot y el overlay sigue visible

#### Scenario: Tienda con desplazamiento interno a ×1 en 1.280 × 720
- **GIVEN** un snapshot en tienda con las 7 filas, cada una con nombre, descripción, nivel y precio o aviso, pintado con
  una ventana de 1.280 × 720 (k = 1) y con las piezas de `panel` y `button` del repositorio
- **WHEN** se leen las reglas de `.shop-panel` y de su lista de productos
- **THEN** el alto máximo del overlay es menor que el alto de la ventana, su relleno interior es ≥ (l, t, r, b) px de
  `panel`, y la lista tiene desplazamiento vertical interno con alto mínimo 0, de modo que el oro, el título y `Salir`
  quedan fuera de la zona que se desplaza
- **AND** con el contenido del escenario, si las 7 filas no caben a la vez, la última fila se alcanza desplazando la
  lista y un clic en ella intenta su compra

#### Scenario: Tienda entera a ×2
- **GIVEN** un snapshot en tienda con las 7 filas, pintado con una ventana de 2.560 × 1.440 (k = 2), con la pieza de
  `panel` del repositorio
- **WHEN** se leen las reglas del overlay
- **THEN** su relleno interior es ≥ (l·2, t·2, r·2, b·2) px y su alto máximo es menor que el de la ventana

#### Scenario: Compra con las piezas en reserva
- **GIVEN** el overlay con oro 12, `strict-rules` a precio 10 y las piezas de `panel` y `button` sin cargar
- **WHEN** se hace clic en la fila de `strict-rules` y se pinta el frame siguiente
- **THEN** el overlay muestra oro 2 y `strict-rules` en nivel 1, igual que con las piezas cargadas, sin errores no
  capturados
