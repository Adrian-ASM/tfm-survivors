# Spec delta · castle-shop

<!-- Change 0036-ui-polish. Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test.
     Motivo: la tienda se cierra con un botón × en la esquina superior derecha de su recuadro (nombre accesible
     `Salir`) y ya no tiene el botón `Salir` abajo. El aspecto común de la × (posición, tamaño, foco, móvil) está en
     "Botón × de cierre de los modales" (`sprite-rendering`). "Salir no reabre", "Salir y seguir", "Salir fuera de la
     tienda" y "Visita sin compras" hablan del caso de uso de salida y no cambian. -->

## ADDED Requirements
<!-- Ninguno. -->

## MODIFIED Requirements

### Requirement: Overlay de la tienda
La vista SHALL mostrar, si y solo si el snapshot está en tienda, un overlay centrado en la ventana con el oro
disponible, una fila por producto en el orden de la tienda (icono, ver "Icono en las filas de la tienda"; nombre,
descripción, nivel actual / máximo y precio, o "máximo" sin precio) y un botón **×** de cierre en la esquina superior
derecha de su recuadro (ver "Botón × de cierre de los modales" en `sprite-rendering`), cuyo texto visible es `×`
(U+00D7) y cuyo nombre accesible es `Salir`. El overlay MUST NOT tener ningún otro botón ni texto visible `Salir`. Un
producto cuyo precio supera el oro, o la curación con la vida llena, MUST mostrarse como no comprable, con el aviso
`Oro insuficiente` (o de vida llena) visible en esa fila. Hacer clic en un producto (también sobre su icono) MUST
intentar comprarlo con el caso de uso de compra: si la compra falla, no cambia nada. Pulsar Esc o la × MUST salir de la
tienda con el caso de uso de salida, sin abrir la pausa (ver "Pausa con Esc" en `main-menu`): ambos gestos producen
exactamente el mismo estado. Mientras el overlay se ve, el input de movimiento no llega a la simulación y las teclas 1,
2, 3 y R no tienen efecto. Tras cada compra, el overlay y el HUD muestran el oro, los niveles y la vida del snapshot
nuevo desde el siguiente frame pintado.

#### Scenario: Overlay con oro justo
- **GIVEN** un snapshot en tienda con oro 12, `strict-rules` a precio 10 y `fast-ci` a precio 15
- **WHEN** se pinta
- **THEN** el overlay es visible con oro 12, 7 filas en el orden de la tienda, cada una con 1 icono, y exactamente 1
  botón con nombre accesible `Salir`, cuyo texto visible es `×`
- **AND** la fila de `strict-rules` es comprable y la de `fast-ci` muestra `Oro insuficiente`
- **AND** ningún elemento del overlay tiene el texto visible `Salir`

#### Scenario: Clic en un producto
- **GIVEN** el overlay del escenario anterior
- **WHEN** se hace clic en la fila de `strict-rules` y se pinta el frame siguiente
- **THEN** el overlay muestra oro 2 y `strict-rules` en nivel 1, y la fila de `strict-rules` muestra `Oro insuficiente`

#### Scenario: Clic sin oro
- **GIVEN** el overlay del escenario "Overlay con oro justo"
- **WHEN** se hace clic en la fila de `fast-ci`
- **THEN** el snapshot no cambia y el overlay sigue visible

#### Scenario: Salir con Esc o con la ×
- **GIVEN** el overlay visible en el tick n, una vez, y otra vez el mismo estado
- **WHEN** en la primera se pulsa Esc y en la segunda se hace clic en la ×, y en ambas se pinta 1 frame de 16,667 ms
- **THEN** en ambas, tras el frame, el overlay no es visible, el overlay de pausa no se ha visto, la partida está en
  curso y `snapshot.tick` vale n + 1
- **AND** los snapshots de las dos son iguales campo a campo

#### Scenario: La × con el teclado
- **GIVEN** el overlay visible en el tick n con el foco de teclado en la ×
- **WHEN** se pulsa Intro y se pinta 1 frame de 16,667 ms
- **THEN** el overlay no es visible, el overlay de pausa no se ha visto y `snapshot.tick` vale n + 1

#### Scenario: Sin overlay fuera de la tienda
- **GIVEN** snapshots en curso, eligiendo mejora, en pausa y terminado
- **WHEN** se pintan
- **THEN** el overlay de la tienda no es visible en ninguno

### Requirement: Aspecto del overlay de la tienda con piezas de UI
La vista SHALL pintar el overlay de la tienda (`.shop-panel`) con las piezas de "Piezas de UI en los paneles DOM"
(`sprite-rendering`): marco de `panel`; el título (`h2`) con la cabecera `header`; cada fila de producto comprable con la
pieza de `button` (y `buttonHover` / `buttonPressed` según su estado); cada fila no comprable (`Oro insuficiente` o vida
llena) con la de `buttonDisabled`, sin dejar de responder al clic igual que antes (el clic intenta la compra, que falla
sin cambiar nada); la × con las piezas de botón de "Botón × de cierre de los modales" (`sprite-rendering`); y la fuente
pixel. Sobre cada pieza, el nombre, el nivel y el precio usan su tinta `text`, la descripción su tinta `muted` y el aviso
`Oro insuficiente` (o el de vida llena) su tinta `danger`; el oro disponible, la tinta `text` de `panel`. Las filas de
producto conservan su disposición interna (icono, nombre, nivel y precio alineados como antes del change); la regla de
centrado de "Texto centrado en los botones DOM" (`sprite-rendering`) no se les aplica, pero sí a la ×. Con una ventana
≥ 960 × 540 y cualquier k, el overlay MUST quedar entero dentro de la ventana; el oro, el título y la × MUST verse
siempre enteros dentro del recuadro, fuera de la zona que se desplaza y sin solaparse entre sí, y la lista de productos
MUST quedar dentro del área útil, entera o alcanzable desplazándola dentro del panel (desplazamiento interno de la
lista, como el texto de la guía), sin solaparse con el oro, el título ni la ×. Desplazar la lista MUST NOT cambiar el
snapshot ni cerrar la tienda, ni mover la ×, y cada fila MUST responder al clic en su posición desplazada. Si una pieza
o la fuente no carga, el overlay se pinta con su reserva (borde de 1 px `#f5c542`) y la compra y la salida funcionan
igual.

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
  `panel`, y la lista tiene desplazamiento vertical interno con alto mínimo 0, de modo que el oro, el título y la ×
  quedan fuera de la zona que se desplaza
- **AND** con el contenido del escenario, si las 7 filas no caben a la vez, la última fila se alcanza desplazando la
  lista y un clic en ella intenta su compra, y la × sigue en la misma posición de pantalla (error ≤ 1 px) antes y
  después de desplazar

#### Scenario: Tienda entera a ×2
- **GIVEN** un snapshot en tienda con las 7 filas, pintado con una ventana de 2.560 × 1.440 (k = 2), con la pieza de
  `panel` del repositorio
- **WHEN** se leen las reglas del overlay
- **THEN** su relleno interior es ≥ (l·2, t·2, r·2, b·2) px y su alto máximo es menor que el de la ventana

#### Scenario: La × no pisa el título en la ventana mínima
- **GIVEN** un snapshot en tienda con las 7 filas pintado con una ventana de 960 × 540 (k = 1), en el E2E de la
  tienda (ampliado, sin test nuevo)
- **WHEN** se miden las cajas del título, del oro, de la × y de la lista
- **THEN** la × está entera dentro del recuadro y no se solapa con ninguna de las otras tres cajas

#### Scenario: Compra con las piezas en reserva
- **GIVEN** el overlay con oro 12, `strict-rules` a precio 10 y las piezas de `panel` y `button` sin cargar
- **WHEN** se hace clic en la fila de `strict-rules`, se pinta el frame siguiente, y después se hace clic en la × y se
  pinta otro frame
- **THEN** tras el primer frame el overlay muestra oro 2 y `strict-rules` en nivel 1, igual que con las piezas
  cargadas, y tras el segundo el overlay no es visible y la pausa no se ha visto, sin errores no capturados

## REMOVED Requirements
<!-- Ninguno. -->
