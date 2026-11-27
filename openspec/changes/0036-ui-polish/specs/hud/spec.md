# Spec delta · hud

<!-- Change 0036-ui-polish. Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test.
     Motivo: el contador de bajas pasa a icono de calavera + número (sin la palabra «Bajas»); los iconos de los cuatro
     contadores de la derecha (bajas, oro, madera y piedra) son mayores y sus filas se separan más. Las medidas exactas
     (lado del icono y paso entre filas a ×1) son valores de aspecto que fija el design; esta spec exige relaciones
     verificables. La pantalla de resultados conserva «Bajas: N» (`run-results`, sin cambios).
     Revisados sin cambios: "Contenido y visibilidad del HUD" (siete elementos; "0 bajas" se lee como el número 0
     junto a la calavera), "Oro y madera en el HUD" y "Piedra en el HUD" (contenido, hojas y reserva; el tamaño de su
     icono pasa a "Iconos de los contadores del HUD") y "Escala del HUD por escalones". La sonda
     `window.__sprint.hud` no cambia (`gold`, `wood`, `stone`). -->

## ADDED Requirements

### Requirement: Iconos de los contadores del HUD
La vista SHALL pintar, en la columna derecha del HUD y de arriba abajo, cuatro contadores con icono y número: bajas,
oro, madera y piedra. Con factor de escala k (ver "Escala del HUD por escalones"):
- los cuatro iconos MUST ser cuadrados del mismo lado s·k en pantalla, con s (lado a ×1) un valor de aspecto que fija
  el design y **s > 16** (el lado de antes de este change);
- los cuatro iconos MUST tener el mismo centro x (error ≤ 1 px) y su número MUST ir junto a su icono, en el mismo
  lado para los cuatro, con su centro vertical a ≤ 1 px del centro vertical de su icono;
- el paso vertical p·k entre los centros de dos filas consecutivas MUST ser el mismo para los cuatro contadores
  (error ≤ 1 px), con p (paso a ×1) un valor de aspecto que fija el design y **p > 18** (el paso de antes) y p ≥ s;
- las cajas de dos filas cualesquiera (icono y número de cada una, con los números de reserva de "Paneles del HUD con
  piezas de UI") MUST NOT solaparse.

El icono de cada contador puede mostrar un recorte del frame de su hoja (por ejemplo, la zona con dibujo) si el design
lo declara en los datos de aspecto; su lado en pantalla sigue siendo s·k. El tamaño de los iconos MUST NOT depender del
snapshot ni de la escala de los recogibles del mundo (ver "Iconos de recurso sin aparición ni flote" en
`sprite-rendering`), y cambiarlo MUST NOT cambiar la simulación.

#### Scenario: Iconos mayores a ×1 y a ×2
- **GIVEN** el snapshot de una partida recién creada pintado con ventanas de 1.280 × 720 (k = 1) y de 2.560 × 1.440
  (k = 2), con dobles de Phaser
- **WHEN** se miden los iconos de bajas, oro, madera y piedra
- **THEN** con k = 1 los cuatro miden s × s px con s > 16, y con k = 2 miden 2s × 2s px (error ≤ 1 px)
- **AND** en ambos los cuatro tienen el mismo centro x (error ≤ 1 px) y están en el orden bajas, oro, madera, piedra
  de arriba abajo

#### Scenario: Filas más separadas y sin solapes
- **GIVEN** un snapshot con 12.345 bajas, oro 123.456, madera 12.345 y piedra 12.345 pintado con una ventana de
  960 × 540 (k = 1)
- **WHEN** se miden las cajas de icono y número de los cuatro contadores
- **THEN** el paso entre los centros de filas consecutivas es el mismo en las tres parejas, es > 18 px y ≥ el lado del
  icono (error ≤ 1 px)
- **AND** ninguna caja de una fila se solapa con una caja de otra fila, y el centro vertical de cada número está a
  ≤ 1 px del de su icono

#### Scenario: Iconos del HUD en modo móvil
- **GIVEN** el modo móvil, un contenido con texto mínimo 12 px CSS, una ventana de 844 × 390 y el snapshot de "HUD
  entero y sin solapes"
- **WHEN** se pinta el HUD
- **THEN** cada icono mide s·k unidades del lienzo con el k de "Escala de la UI del lienzo en modo móvil"
  (`mobile-display`, error ≤ 1 unidad), los ocho elementos del HUD están enteros dentro del lienzo sin solaparse y el
  texto base mide ≥ 12 px CSS (error ≤ 0,1 px)

## MODIFIED Requirements

### Requirement: Bajas en el HUD
La vista SHALL mostrar el número de bajas del último snapshot como un entero completo, sin abreviar ni truncar, sin
separador de miles y sin ninguna etiqueta de texto (el HUD MUST NOT mostrar la palabra `Bajas`), junto a un **icono de
calavera**: un frame de la hoja del cadáver (`corpse`, `Factions/Knights/Troops/Dead/Dead.png`, ya en la nota de
procedencia) de `content/appearance.json`, cuyo índice declaran los datos de aspecto (ver "Datos de aspecto del icono de
bajas" en `sprite-rendering`). El icono y el número de bajas forman un solo elemento del HUD, con las reglas de
"Iconos de los contadores del HUD". Si la hoja no carga, el icono se pinta con el color de reserva del cadáver y el
número se sigue mostrando, sin errores no capturados. El icono no se anima ni cambia con el snapshot. La pantalla de
resultados conserva su texto `Bajas: N` (ver `run-results`).

#### Scenario: Sin bajas
- **GIVEN** un snapshot con 0 bajas
- **WHEN** se pinta
- **THEN** el HUD muestra el icono de calavera con el número `0`, y ningún texto del HUD contiene `Bajas`

#### Scenario: Bajas que cambian entre snapshots
- **GIVEN** un snapshot pintado con 9 bajas y el siguiente con 12
- **WHEN** se pinta el segundo
- **THEN** el HUD muestra `12` junto a la calavera, que conserva la misma textura, el mismo frame y la misma posición

#### Scenario: Muchas bajas
- **GIVEN** un snapshot con 12.345 bajas
- **WHEN** se pinta
- **THEN** el texto de las bajas del HUD es exactamente `12345`

#### Scenario: Calavera de la hoja del cadáver
- **GIVEN** el contenido por defecto y el snapshot de una partida recién creada, con dobles de Phaser
- **WHEN** se crea el HUD
- **THEN** el icono de bajas usa la textura de `Dead.png` en el frame declarado para el icono de bajas en los datos de
  aspecto, no flota ni reproduce ninguna animación

#### Scenario: Calavera que no carga
- **GIVEN** el snapshot de una partida recién creada y la hoja `Dead.png` sin cargar (las de oro, madera y piedra
  cargadas)
- **WHEN** se pinta el HUD
- **THEN** el contador de bajas es visible con un icono del color de reserva del cadáver (`#b0b4ba` con los datos del
  repositorio) y el número `0`, los de oro, madera y piedra con su icono de arte, y no hay errores no capturados

#### Scenario: Resultados sin cambios
- **GIVEN** una partida terminada con 41 bajas
- **WHEN** se muestra la pantalla de resultados
- **THEN** su línea de bajas es `Bajas: 41`, como antes del change

### Requirement: HUD anclado a la ventana
La vista SHALL anclar cada elemento del HUD (barra y número de vida, tiempo restante, barra de XP y nivel, bajas, oro,
madera y piedra) a un borde, una esquina o el centro de un borde de la ventana. Para un mismo factor de escala del HUD
(ver "Escala del HUD por escalones"), la distancia en pantalla de cada elemento a su anclaje MUST ser la misma sea cual
sea el tamaño de la ventana (error ≤ 1 px). Con una ventana ≥ 960 × 540 en ambos ejes, cada elemento MUST quedar entero
dentro de la ventana y ningún par de elementos del HUD MUST solaparse. Si la ventana supera el tope de vista, el HUD se
ancla a la ventana o a la vista según fije el design, con las mismas garantías. Al redimensionar, el HUD MUST
reubicarse desde el primer frame pintado tras el cambio (ver "Redimensionado de la ventana" en `world-camera`). El
icono y el número de cada contador de bajas, de oro, de madera y de piedra forman un solo elemento, con los iconos de
"Iconos de los contadores del HUD".

#### Scenario: Mismo anclaje con dos ventanas
- **GIVEN** el snapshot de una partida recién creada pintado con una ventana de 960 × 540 y otro igual pintado con una
  de 1.280 × 720 (ambas con el mismo factor de escala)
- **WHEN** se mide, para cada elemento del HUD, su distancia al borde o esquina de su anclaje
- **THEN** las distancias y los tamaños de cada elemento son iguales en ambas ventanas (error ≤ 1 px)

#### Scenario: Esquina opuesta que sigue a la ventana
- **GIVEN** un elemento del HUD anclado al borde derecho y una partida pintada con una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 1.000 × 600 y se pinta el siguiente frame
- **THEN** su borde derecho está a la misma distancia del borde derecho de la ventana que antes (error ≤ 1 px), es
  decir, se ha desplazado 280 px a la izquierda

#### Scenario: HUD entero y sin solapes
- **GIVEN** un snapshot con vida `120/120`, tiempo `10:00`, nivel 99, 12.345 bajas, oro 123.456, madera 12.345 y
  piedra 12.345
- **WHEN** se pinta con ventanas de 960 × 540, 1.280 × 720, 1.920 × 1.080, 2.560 × 1.440 y 3.840 × 2.160
- **THEN** en cada una los ocho elementos del HUD (vida, tiempo, barra de XP, nivel, bajas con su calavera, oro,
  madera y piedra, cada contador con su icono de lado s·k) están enteros dentro de la ventana y no se solapan entre sí

#### Scenario: Ventana menor que 960 × 540
- **GIVEN** una partida en curso pintada con una ventana de 640 × 360
- **WHEN** se pinta un frame
- **THEN** el HUD es visible con el factor de escala mínimo (× 1), cada elemento a la misma distancia de su anclaje que
  con 960 × 540, y no hay errores no capturados

#### Scenario: Contadores reubicados al redimensionar
- **GIVEN** una partida en pausa con 7 bajas, oro 15, madera 3 y piedra 4 pintada con una ventana de 1.280 × 720
- **WHEN** la ventana pasa a 960 × 540 y se pinta el siguiente frame, y después a 2.560 × 1.440
- **THEN** en cada frame los contadores de bajas, oro, madera y piedra están a la distancia de su anclaje que
  corresponde a su factor de escala (error ≤ 1 px), enteros dentro de la ventana, sin solapar otro elemento y con los
  mismos números

### Requirement: Paneles del HUD con piezas de UI
La vista SHALL pintar detrás de los elementos del HUD, cuando existe la textura de `panel` y el renderizador es WebGL,
**exactamente tres** piezas nine-slice de `panel`: la izquierda, que contiene la barra y el número de vida y la barra de
XP y el nivel; la central, que contiene el tiempo restante; y la derecha, que contiene los cuatro contadores con icono
(bajas, oro, madera y piedra). Cada panel MUST contener entero cada elemento que le toca (en la derecha, cada icono y
cada número) con un margen ≥ (margen de la pieza × k) px por cada lado, con esquinas en pantalla de (margen × k) px
exactos; los tres paneles MUST quedar enteros dentro de la ventana con una ventana ≥ 960 × 540 y no solaparse entre sí.
El tamaño de cada panel depende solo de la ventana y de k, nunca del snapshot: se calcula para el número de caracteres
de reserva de cada texto (de modo que vida `120/120`, nivel 99, las bajas `12345` sin etiqueta, oro 123.456, madera
12.345 y piedra 12.345 caben) y no cambia entre frames. Los textos del HUD (vida, tiempo, nivel, el número de bajas y los
números de oro, madera y piedra) MUST usar la fuente pixel y, con paneles, la tinta `text` de `panel`. Al actualizar el
HUD cada frame y al redimensionar, los paneles existentes MUST recolocarse sin crear otros: el número de objetos del HUD
no crece con los frames ni con los RESIZE. Sin la textura de `panel` o sin WebGL, el HUD se pinta sin paneles y con su
texto `#ffffff` (ver "Reserva de las piezas de UI y de la fuente" en `sprite-rendering`), con el mismo layout.

#### Scenario: Tres paneles con su contenido
- **GIVEN** la textura de `panel` cargada, un renderizador WebGL y el snapshot de una partida recién creada, pintado con
  ventanas de 960 × 540 (k = 1) y de 2.560 × 1.440 (k = 2)
- **WHEN** se pinta el HUD con dobles de Phaser
- **THEN** hay exactamente 3 piezas nine-slice de `panel`; la izquierda contiene las barras de vida y de XP con sus
  textos, la central el tiempo y la derecha los 4 contadores con su icono, cada elemento a ≥ margen × k px de cada
  borde de su panel
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
  piezas de `panel` del primer frame y los 4 iconos de contador del primer frame
- **AND** en el frame 600 cada panel está en su rectángulo para 960 × 540 y k = 1

#### Scenario: Fuente pixel en los textos del HUD
- **GIVEN** el contenido por defecto
- **WHEN** se crea el HUD con dobles de Phaser
- **THEN** cada texto del HUD se crea con la familia `"Departure Mono", monospace`

## REMOVED Requirements
<!-- Ninguno. -->
