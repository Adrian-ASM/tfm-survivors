# Spec delta · hud

> Change 0032-ui-kit. Términos (pieza, rol, márgenes, tintas, k, esquina en pantalla, área útil y aspecto actual)
> según las convenciones del delta de `sprite-rendering` de este change. El contenido, los valores mostrados, las
> barras, el anclaje y la escala por escalones del HUD no cambian; con la fuente pixel y los paneles siguen valiendo
> "HUD entero y sin solapes", "Mismo anclaje con dos ventanas" y "Tamaños proporcionales al factor" (los paneles no
> cuentan como elementos del HUD en esas comprobaciones de solape).

## ADDED Requirements

### Requirement: Paneles del HUD con piezas de UI
La vista SHALL pintar detrás de los elementos del HUD, cuando existe la textura de `panel` y el renderizador es WebGL,
**exactamente tres** piezas nine-slice de `panel`: la izquierda, que contiene la barra y el número de vida y la barra de
XP y el nivel; la central, que contiene el tiempo restante; y la derecha, que contiene las bajas y los contadores de oro,
madera y piedra. Cada panel MUST contener entero cada elemento que le toca con un margen ≥ (margen de la pieza × k) px
por cada lado, con esquinas en pantalla de (margen × k) px exactos; los tres paneles MUST quedar enteros dentro de la
ventana con una ventana ≥ 960 × 540 y no solaparse entre sí. El tamaño de cada panel depende solo de la ventana y de k,
nunca del snapshot: se calcula para el número de caracteres de reserva de cada texto (de modo que vida `120/120`, nivel
99, 12.345 bajas, oro 123.456, madera 12.345 y piedra 12.345 caben) y no cambia entre frames. Los textos del HUD (vida,
tiempo, nivel, bajas y los números de oro, madera y piedra) MUST usar la fuente pixel y, con paneles, la tinta `text` de
`panel`. Al actualizar el HUD cada frame y al redimensionar, los paneles existentes MUST recolocarse sin crear otros: el
número de objetos del HUD no crece con los frames ni con los RESIZE. Sin la textura de `panel` o sin WebGL, el HUD se
pinta sin paneles y con su texto `#ffffff` (ver "Reserva de las piezas de UI y de la fuente" en `sprite-rendering`), con
el mismo layout.

#### Scenario: Tres paneles con su contenido
- **GIVEN** la textura de `panel` cargada, un renderizador WebGL y el snapshot de una partida recién creada, pintado con
  ventanas de 960 × 540 (k = 1) y de 2.560 × 1.440 (k = 2)
- **WHEN** se pinta el HUD con dobles de Phaser
- **THEN** hay exactamente 3 piezas nine-slice de `panel`; la izquierda contiene las barras de vida y de XP con sus
  textos, la central el tiempo y la derecha las bajas y los 3 contadores, cada elemento a ≥ margen × k px de cada borde
  de su panel
- **AND** los 3 paneles están enteros en la ventana y no se solapan entre sí

#### Scenario: Paneles independientes del snapshot
- **GIVEN** el HUD con paneles pintado con una ventana de 1.280 × 720 para el snapshot de una partida recién creada y
  para otro con vida `120/120`, nivel 99, 12.345 bajas, oro 123.456, madera 12.345 y piedra 12.345
- **WHEN** se miden los 3 paneles en ambos frames
- **THEN** tienen la misma posición y el mismo tamaño (error ≤ 1 px) y en el segundo cada elemento sigue entero dentro
  de su panel

#### Scenario: Seiscientos frames sin crear objetos
- **GIVEN** una partida en curso con el HUD pintado con dobles de Phaser
- **WHEN** se pintan 600 frames con vida, XP, tiempo, bajas y recursos que cambian, y la ventana pasa de 1.280 × 720 a
  2.560 × 1.440 y a 960 × 540 en los frames 200 y 400
- **THEN** el número de objetos creados por el HUD tras el primer frame es el mismo que en el frame 600, con las 3
  piezas de `panel` del primer frame
- **AND** en el frame 600 cada panel está en su rectángulo para 960 × 540 y k = 1

#### Scenario: Fuente pixel en los textos del HUD
- **GIVEN** el contenido por defecto
- **WHEN** se crea el HUD con dobles de Phaser
- **THEN** cada texto del HUD se crea con la familia `"Departure Mono", monospace`
