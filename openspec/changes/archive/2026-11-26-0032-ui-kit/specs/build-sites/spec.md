# Spec delta · build-sites

> Change 0032-ui-kit. Términos (pieza, rol, márgenes, tintas, relleno, k, área útil, contraste, aspecto actual y reserva
> de un panel DOM) según las convenciones del delta de `sprite-rendering` de este change. La oferta, la construcción,
> la salida y las sondas de obra no cambian.

## ADDED Requirements

### Requirement: Aspecto del panel de obra con piezas de UI
La vista SHALL pintar el panel de obra (`.build-panel`) con las piezas de "Piezas de UI en los paneles DOM"
(`sprite-rendering`): marco de `panel`; el título (`h2`) con la cabecera `header`; cada fila asequible con la pieza de
`button` (y `buttonHover` / `buttonPressed` según su estado); cada fila no asequible, desactivada, con la de
`buttonDisabled`, que es su atenuación cuando la pieza carga (sin reducir además su opacidad, para no bajar el
contraste) y, en reserva, la opacidad de siempre; `Salir` con la de `button`; y la fuente pixel. La "cifra en rojo" de
"Panel de obra" y el texto «faltan N» usan la tinta `danger` de la pieza de su fila (roja según "Datos de aspecto de la
interfaz"); el resto del texto de la fila, su tinta `text`, y el saldo, la tinta `text` de `panel`. Los iconos de madera
y piedra conservan su imagen y su alternativa de texto. Ningún elemento del panel MUST tener atributo `style`, tampoco
por las piezas. Con una ventana ≥ 960 × 540 y cualquier k, el saldo, las 2 filas y `Salir` MUST quedar dentro del área
útil del marco, enteros en la ventana y sin solaparse. Si una pieza o la fuente no carga, el panel se pinta con su
reserva y construir y salir funcionan igual.

#### Scenario: Torre no asequible con piezas
- **GIVEN** un snapshot en obra con madera 30 y piedra 14
- **WHEN** se pinta el panel
- **THEN** la fila de la casa usa la pieza de `button` y la de la torre la de `buttonDisabled`, desactivada
- **AND** la cifra 15 de piedra y «faltan 1» usan la tinta `danger` de `buttonDisabled`, y la cifra 30 de madera no

#### Scenario: Panel sin atributo style
- **GIVEN** un snapshot en obra con madera 10 y piedra 0
- **WHEN** se pinta el panel
- **THEN** ningún elemento del panel tiene atributo `style` y cada icono tiene la alternativa `madera` o `piedra`

#### Scenario: Panel entero dentro del marco
- **GIVEN** un snapshot en obra con madera 10 y piedra 0 (las dos filas con cifras en rojo y «faltan»), pintado con
  ventanas de 960 × 540 (k = 1) y de 2.560 × 1.440 (k = 2), con la pieza de `panel` del repositorio
- **WHEN** se leen las reglas del panel
- **THEN** su relleno interior es ≥ (l·k, t·k, r·k, b·k) px y el saldo, las 2 filas y `Salir` caben en la ventana sin
  solaparse

#### Scenario: Construir con las piezas en reserva
- **GIVEN** un snapshot en obra con madera 30 y piedra 15 en el tick n y las piezas de `panel` y `button` sin cargar
- **WHEN** se hace clic en la fila de la casa y se pinta 1 frame de 16,667 ms
- **THEN** el panel no es visible, el solar está en `house` y `snapshot.tick` vale n + 1, sin errores no capturados
