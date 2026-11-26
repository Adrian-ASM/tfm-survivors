# Spec delta · main-menu

> Change 0032-ui-kit. Términos (pieza, rol, márgenes, tintas, relleno, k, esquina en pantalla, área útil, contraste,
> aspecto actual y reserva de un panel DOM) según las convenciones del delta de `sprite-rendering` de este change. Los
> requisitos de comportamiento del menú, la pausa y el diálogo no cambian.

## ADDED Requirements

### Requirement: Aspecto del menú, la pausa y el diálogo con piezas de UI
La vista SHALL pintar el menú de inicio (`.menu-panel`), el overlay de pausa (`.pause-panel`) y el diálogo de
`Borrar datos` (`.confirm-dialog`) con las piezas de "Piezas de UI en los paneles DOM" (`sprite-rendering`): marco de
`panel`; `Jugar`, `Cómo jugar`, `Exportar`, `Importar`, `Borrar datos`, `Reanudar`, `Volver al menú` y `Cancelar` con
las piezas de botón según su estado; `Confirmar` con `buttonDanger` (`buttonDangerPressed` al pulsarlo); el título
`Greentide Vanguard` (`h1`) y `Pausa` (`h2`) con la cabecera `header`; y todos los textos con la fuente pixel. Los
mensajes `importado`, `no válido`, `64 KiB` y `borrado` usan la tinta `accent` de `panel`. Con una ventana ≥ 960 × 540 y
cualquier k, los cinco botones del menú, su título y sus mensajes MUST quedar dentro del área útil del marco, además de
enteros en la ventana y sin solaparse ("Menú y pausa centrados en la ventana"). Si una pieza o la fuente no carga, cada
superficie se pinta con su reserva y el flujo menú → `Jugar` → pausa → `Volver al menú` → `Borrar datos` sigue
funcionando igual (ver "Reserva de las piezas de UI y de la fuente" en `sprite-rendering`).

#### Scenario: Menú con piezas en el navegador [E2E]
- **GIVEN** la build de producción servida sin `?e2e` con una ventana de 1.280 × 720 (k = 1), en el test de humo que ya
  abre el menú y vigila la CSP (ampliado, sin test nuevo)
- **WHEN** termina la carga y se lee el estilo calculado de `.menu-panel`
- **THEN** su imagen de borde contiene `UI/Banners/Carved_9Slides.png` servida bajo `/tfm-survivors/` y sus anchos de
  borde de imagen son los márgenes de `panel` × 1 px (12 px con los datos del repositorio)
- **AND** `document.fonts.check('16px "Departure Mono"')` es verdadero
- **AND** se registran 0 eventos `securitypolicyviolation` y 0 errores no capturados, y los roles y textos de los
  botones son los de siempre

#### Scenario: Botón deshabilitado, botón con foco y botón de borrado
- **GIVEN** el menú de inicio con un botón con el atributo `disabled`, el foco de teclado en `Jugar` y el diálogo de
  `Borrar datos` abierto
- **WHEN** se leen las reglas que se aplican a cada uno
- **THEN** el desactivado usa la pieza de `buttonDisabled`, `Jugar` con foco visible la de `buttonHover` y un contorno
  de 2 px, `Confirmar` la de `buttonDanger` y `Cancelar` la de `button`

#### Scenario: Diálogo con texto legible
- **GIVEN** el diálogo de `Borrar datos` abierto con los datos de `ui` del repositorio
- **WHEN** se leen los colores de su texto y de sus botones
- **THEN** el del texto es la tinta `text` de `panel`, el de `Cancelar` la de `button` y el de `Confirmar` la de
  `buttonDanger`, cada uno con contraste ≥ 4,5 con el relleno de su pieza

#### Scenario: Flujo del menú con las piezas en reserva
- **GIVEN** el menú con las piezas de `panel`, `button` y `header` y la fuente sin cargar
- **WHEN** se pulsa `Jugar`, Esc, `Volver al menú`, `Borrar datos` y `Cancelar`
- **THEN** cada paso tiene el mismo resultado que con las piezas cargadas, sin errores no capturados
