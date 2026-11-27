# Spec delta · build-sites

<!-- Change 0036-ui-polish. Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test.
     Motivo: el panel de obra se cierra con un botón × en la esquina superior derecha (nombre accesible `Salir`) y
     ya no tiene `Salir` abajo; cada fila gana el icono de su edificio y una explicación breve con cifras tomadas del
     contenido; los iconos de recurso del panel son mayores. El aspecto común de la × está en "Botón × de cierre de
     los modales" (`sprite-rendering`) y el centrado en "Texto centrado en los botones DOM" (`sprite-rendering`).
     "Salir no reabre" (apertura) y "Salir y seguir" / "Salir fuera de la obra" (caso de uso) no cambian.
     Nota: el escenario vivo "Panel con una opción" decía «1 fila», en contradicción con «siempre dos filas» desde
     0027; se corrige al copiarlo. -->

## ADDED Requirements

### Requirement: Explicación de los edificios en el panel de obra
La vista SHALL mostrar en cada una de las dos filas del panel de obra, además del nombre y del coste:
- el **icono del edificio**: un elemento de imagen con el primer frame de la hoja con la que se pinta ese edificio
  construido (ver "Pintado de los solares y de los edificios" en `sprite-rendering`: `House_Blue` para la casa y
  `Tower_Blue` para la torre, de `content/appearance.json`), con URL del mismo origen bajo `/tfm-survivors/assets/`
  (nunca `http:`, `https:`, `//`, `data:` ni `blob:`), texto alternativo vacío (es decorativo), sin atributo `style`,
  escalado sin suavizado (`image-rendering: pixelated`) y con la proporción de su frame (ancho / alto del frame, error
  ≤ 1 px en pantalla); su alto en pantalla MUST ser ≥ el lado de los iconos de recurso de esa fila;
- una **explicación** de una línea con lo que hace el edificio, como elemento de texto distinto del nombre y del coste,
  con la tinta `muted` de la pieza de su fila. Con el contenido por defecto, la de la casa MUST mostrarse exactamente
  `+1 oro cada 30 s` y la de la torre `Dispara flechas a los enemigos cercanos`.

El texto crudo de cada explicación vive en contenido de presentación (el fichero lo fija el design), nunca en el
código, y sus cifras salen de marcadores del catálogo de "Cifras de la guía tomadas del contenido" (`menu-guide`), con
sus mismas fuentes y formatos: la de la casa es `+{buildings.house.incomeGold} oro cada
{buildings.house.incomeSeconds} s` y la de la torre no tiene marcadores. El icono y la explicación MUST NOT cambiar
el orden de las filas, su estado (asequible o no), el coste, el «faltan N», el saldo ni lo que hace el clic: un clic
sobre el icono o la explicación de una fila asequible la construye, y sobre los de una no asequible no llama a ningún
caso de uso. Si la imagen de un edificio no está disponible, su fila MUST ocultar el icono sin cambiar nada más, sin
errores no capturados. Mostrar el icono y la explicación MUST NOT cambiar el snapshot.

#### Scenario: Filas con icono y explicación
- **GIVEN** un snapshot en obra con madera 30 y piedra 15, el contenido por defecto, las hojas disponibles y la base
  `/tfm-survivors/`, montado en un DOM de prueba
- **WHEN** se pinta el panel
- **THEN** la fila de la casa tiene exactamente 1 imagen de edificio con la URL de `House_Blue.png` y la de la torre
  exactamente 1 con la de `Tower_Blue.png`, ambas bajo `/tfm-survivors/assets/`, con texto alternativo vacío y sin
  atributo `style`
- **AND** la explicación de la casa es `+1 oro cada 30 s` y la de la torre `Dispara flechas a los enemigos cercanos`,
  cada una en un elemento distinto del nombre y del coste

#### Scenario: Proporción del icono del edificio
- **GIVEN** el panel del escenario anterior con la hoja de estilos del repositorio a k = 1
- **WHEN** se leen las reglas de las imágenes de edificio y del icono de recurso
- **THEN** la imagen de la casa mide en pantalla en proporción 128 : 192 y la de la torre 128 : 256 (error ≤ 1 px), y
  el alto de cada una es ≥ el lado del icono de recurso de su fila

#### Scenario: La explicación sigue al contenido
- **GIVEN** el contenido por defecto salvo el ingreso de la casa: 4 oro cada 2.400 ticks, y en otro caso 1 oro cada
  1.350 ticks
- **WHEN** se pinta un snapshot en obra
- **THEN** la explicación de la casa es `+4 oro cada 40 s` en el primer caso y `+1 oro cada 22,5 s` en el segundo

#### Scenario: Explicación en una fila no asequible
- **GIVEN** un snapshot en obra con madera 10 y piedra 0
- **WHEN** se pinta y se hace clic en la imagen de la torre y en su explicación
- **THEN** las 2 filas muestran su icono y su explicación con la tinta `muted` de `buttonDisabled`, conservan sus
  cifras en rojo y sus «faltan», y ningún clic llama al caso de uso de construcción

#### Scenario: Clic en el icono de la casa
- **GIVEN** un snapshot en obra con madera 30 y piedra 15 en el tick n
- **WHEN** se hace clic en la imagen de la casa y se pinta 1 frame de 16,667 ms
- **THEN** el panel no es visible, el solar está en `house` y `snapshot.tick` vale n + 1

#### Scenario: Imagen de edificio que no carga
- **GIVEN** un snapshot en obra con madera 30 y piedra 15 con la imagen de `Tower_Blue` no disponible
- **WHEN** se pinta el panel
- **THEN** la fila de la torre no muestra ninguna imagen de edificio y conserva su nombre, su explicación, su coste y
  su estado; la de la casa muestra la suya, sin errores no capturados

### Requirement: Textos de la obra validados
El sistema SHALL leer los textos crudos de las explicaciones de la casa y de la torre del contenido de presentación,
validado con zod al arrancar, antes de mostrar el menú, por la misma vía que los textos de la guía ("Contenido de la
guía validado" en `menu-guide`). Debe haber exactamente un texto por tipo de edificio (`house` y `tower`), no vacío
tras quitar espacios y sin dígitos (0–9); cada `{` y cada `}` MUST formar parte de un marcador cuyo nombre pertenezca
al catálogo de "Cifras de la guía tomadas del contenido" (`menu-guide`) y cuyo valor exista en el contenido cargado;
MUST NOT haber campos desconocidos. Un texto inválido MUST impedir que se muestre el menú o empiece una partida, con el
error de contenido de siempre (el mismo canal que el de la guía), que nombre el edificio y el campo (y, si es el caso,
el marcador). Las cifras de los textos de la obra MUST NOT estar escritas en `src/` ni repetidas en otro fichero del
contenido. La validación MUST NOT cambiar el resto del contenido ni la simulación.

#### Scenario: Textos de la obra por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se valida el contenido al arrancar
- **THEN** la validación es correcta, hay exactamente un texto para `house` y otro para `tower`, sin dígitos, y el de
  `house` usa los marcadores `buildings.house.incomeGold` y `buildings.house.incomeSeconds`

#### Scenario: Textos de la obra inválidos
- **GIVEN** el contenido por defecto con, en una carga cada vez: el texto de `house` `"  "`; el de `house`
  `+1 oro cada {buildings.house.incomeSeconds} s` (con un dígito escrito a mano); el de `tower` con el marcador
  `{buildings.tower.range}`, que no está en el catálogo; el de `tower` terminado en `cada {`; sin texto de `tower`; o
  con un campo extra `barracks`
- **WHEN** se valida el contenido al arrancar
- **THEN** en cada caso el arranque muestra el error de contenido, que nombra respectivamente `house`, `house`, `tower`
  y `buildings.tower.range`, `tower`, `tower` y `barracks`, y no se crea el menú ni ninguna partida

#### Scenario: Sin textos de la obra en el código
- **GIVEN** el repositorio tras este change
- **WHEN** se buscan en los ficheros de `src/` los textos `oro cada` y `Dispara flechas`
- **THEN** no aparece ninguno

## MODIFIED Requirements

### Requirement: Panel de obra
La vista SHALL mostrar, si y solo si el snapshot está en obra, un panel centrado en la ventana con:
- el saldo: la madera y la piedra disponibles, cada cifra con el **icono de su recurso** (la misma imagen que el
  contador del HUD de ese recurso, ver `hud`);
- **siempre dos filas**, la casa y después la torre, cada una con el icono del edificio, su nombre, su explicación (ver
  "Explicación de los edificios en el panel de obra") y su coste en elementos distintos, separados de forma que el texto
  no quede pegado; el coste se muestra por recurso como cifra con su icono, y un coste de 0 en un recurso no se muestra
  (la casa por defecto solo muestra madera);
- un botón **×** de cierre en la esquina superior derecha de su recuadro (ver "Botón × de cierre de los modales" en
  `sprite-rendering`), cuyo texto visible es `×` (U+00D7) y cuyo nombre accesible es `Salir`. El panel MUST NOT tener
  ningún otro botón ni texto visible `Salir`.

Cada icono de recurso MUST tener una alternativa de texto con el nombre del recurso (`madera`, `piedra`) y medir en
pantalla un cuadrado de lado mayor que 2 veces el tamaño de letra de su fila (antes del change medía 2em; el valor lo
fija el design en los datos de aspecto o en la hoja de estilos), igual en el saldo y en las filas. Una fila **asequible**
según la oferta es un botón activo: hacer clic en ella MUST construirla con el caso de uso de construcción. Una fila
**no asequible** se ve atenuada y está desactivada (hacer clic no llama a ningún caso de uso y el snapshot no cambia);
cada recurso cuyo coste supera el saldo muestra su cifra en rojo y el texto «faltan N», con N = coste − saldo de ese
recurso; los recursos que sí alcanzan se muestran como en una fila asequible. Ningún elemento del panel MUST tener
atributo `style` (CSP sin estilos inline); los iconos se cargan desde el propio origen o como `data:`. Pulsar Esc o la
× MUST salir de la obra con el caso de uso de salida, sin abrir la pausa (ver "Pausa con Esc" en `main-menu`): ambos
gestos producen exactamente el mismo estado. Mientras el panel se ve, el input de movimiento no llega a la simulación y
las teclas 1, 2, 3 y R no tienen efecto. Tras construir, el panel no se ve y el HUD muestra la madera y la piedra del
snapshot nuevo desde el siguiente frame pintado. El panel no cambia el HUD.

#### Scenario: Panel con una opción
- **GIVEN** un snapshot en obra con madera 30 y piedra 14
- **WHEN** se pinta
- **THEN** el panel es visible con madera 30, piedra 14, 2 filas (la casa, 15 madera, activa; la torre, desactivada) y
  exactamente 1 botón con nombre accesible `Salir`, cuyo texto visible es `×`

#### Scenario: Panel con dos opciones
- **GIVEN** un snapshot en obra con madera 30 y piedra 15
- **WHEN** se pinta
- **THEN** el panel tiene 2 filas, la casa primero y la torre después, cada una con su coste

#### Scenario: Clic en la casa
- **GIVEN** el panel del escenario "Panel con las dos opciones asequibles" en el tick n
- **WHEN** se hace clic en la fila de la casa y se pinta 1 frame de 16,667 ms
- **THEN** el panel no es visible, el HUD muestra madera 15 y piedra 15, el solar está en `house` y `snapshot.tick`
  vale n + 1

#### Scenario: Salir con Esc o con la ×
- **GIVEN** el panel visible en el tick n, una vez, y otra vez el mismo estado
- **WHEN** en la primera se pulsa Esc y en la segunda se hace clic en la ×, y en ambas se pinta 1 frame de 16,667 ms
- **THEN** en ambas, tras el frame, el panel no es visible, el overlay de pausa no se ha visto, la partida está en
  curso, el solar sigue en `free` y `snapshot.tick` vale n + 1
- **AND** los snapshots de las dos son iguales campo a campo

#### Scenario: Sin panel fuera de la obra
- **GIVEN** snapshots en curso, eligiendo mejora, en tienda, en pausa y terminado
- **WHEN** se pintan
- **THEN** el panel de obra no es visible en ninguno

#### Scenario: Panel con las dos opciones asequibles
- **GIVEN** un snapshot en obra con madera 30 y piedra 15
- **WHEN** se pinta
- **THEN** el panel es visible con el saldo 30 madera y 15 piedra con sus iconos, 2 filas activas (casa con 15 madera;
  torre con 30 madera y 15 piedra) y la ×
- **AND** ninguna cifra está en rojo ni hay ningún texto «faltan»

#### Scenario: Panel con la torre no asequible
- **GIVEN** un snapshot en obra con madera 30 y piedra 14
- **WHEN** se pinta y se hace clic en la fila de la torre
- **THEN** la fila de la casa está activa y la de la torre atenuada y desactivada, con 30 madera sin rojo y 15 piedra en
  rojo con «faltan 1»
- **AND** el clic no llama al caso de uso de construcción y el snapshot sigue en obra

#### Scenario: Panel sin nada asequible
- **GIVEN** un snapshot en obra con madera 10 y piedra 0
- **WHEN** se pinta
- **THEN** las 2 filas están atenuadas y desactivadas: la casa con 15 madera en rojo y «faltan 5»; la torre con 30
  madera en rojo y «faltan 20» y 15 piedra en rojo y «faltan 15»
- **AND** la × está activa y un clic en ella sale de la obra

#### Scenario: Nombre y coste separados
- **GIVEN** un snapshot en obra con madera 30 y piedra 15
- **WHEN** se pinta
- **THEN** en cada fila el nombre, la explicación y el coste están en elementos distintos y el texto de la fila, con
  los espacios colapsados, tiene ≥ 1 espacio entre el nombre y la explicación y entre la explicación y la primera cifra
  (no contiene «Casa15», «Torre30», «Casa+1», «TorreDispara», «s15» ni «cercanos30»)
- **AND** ningún elemento del panel tiene atributo `style` y cada icono de recurso tiene la alternativa `madera` o
  `piedra`

#### Scenario: Iconos de recurso mayores
- **GIVEN** la hoja de estilos del repositorio
- **WHEN** se leen las reglas de los iconos de recurso del panel de obra
- **THEN** su ancho y su alto son iguales y mayores que 2em (o, si el valor sale de los datos de aspecto, mayor que 2
  veces el tamaño de letra de su fila), en el saldo y en las filas

### Requirement: Solares observables en el navegador
La sonda E2E (`window.__sprint`) SHALL exponer, solo con `?e2e`, `sites`: por solar, en el orden del snapshot, su
identificador, su estado, si está armado y sus huellas de casa y torre, **sin acceso** (la clave `access` no existe);
si el panel de obra es visible y, con él, el solar abierto y sus dos opciones, cada una con su tipo, su coste y si es
asequible. En modo menú `sites` MUST valer `null`. Leer la sonda MUST NOT cambiar la simulación. El recorrido completo
MUST poder hacerse en el juego real en modo manual.

#### Scenario: Construir una casa en el juego real [E2E]
- **GIVEN** la build de producción con `?e2e&manual&seed=42` y `map: 'real'`, a 1.280 × 720, y un input que recoge ≥ 15
  de madera y < 15 de piedra y lleva al jugador a una celda caminable vecina de la huella de un solar y lo empuja contra
  ella (ruta calculada por el test con la sonda del mapa y de los solares, con las huellas libres como no caminables)
- **WHEN** se avanza con `step(n)` hasta que la partida está en obra, se hace clic en la casa y se llama a `step(1)`
- **THEN** con la obra abierta la sonda informa del panel visible, del solar abierto y de las opciones `house`
  (asequible) y `tower` (no asequible), sin clave `access` en ningún solar
- **AND** en el panel la fila de la torre está desactivada con «faltan», cada icono de recurso mide > 28 × 28 px (más
  que los 2em de antes del change con la letra de 14 px de la fila), entre el nombre y el coste de cada fila hay ≥ 8 px,
  y cada fila muestra su imagen de edificio cargada (ancho natural > 0) y su explicación
- **AND** hay exactamente 1 botón con nombre accesible `Salir` en el panel, la × de "Botón × de cierre de los modales"
  (`sprite-rendering`), y ninguno con el texto visible `Salir`
- **AND** tras el clic la sonda informa del solar en `house`, el panel no es visible, la madera ha bajado en 15,
  `sprites.sites` cuenta 1 casa y 5 solares en obra, y `step(1)` devuelve 1, sin errores no capturados

#### Scenario: Sonda de solares en el menú
- **GIVEN** `?e2e&seed=42` y el menú tras `Volver al menú`
- **WHEN** se pinta 1 frame y se lee la sonda
- **THEN** `sites` vale `null`

### Requirement: Aspecto del panel de obra con piezas de UI
La vista SHALL pintar el panel de obra (`.build-panel`) con las piezas de "Piezas de UI en los paneles DOM"
(`sprite-rendering`): marco de `panel`; el título (`h2`) con la cabecera `header`; cada fila asequible con la pieza de
`button` (y `buttonHover` / `buttonPressed` según su estado); cada fila no asequible, desactivada, con la de
`buttonDisabled`, que es su atenuación cuando la pieza carga (sin reducir además su opacidad, para no bajar el
contraste) y, en reserva, la opacidad de siempre; la × con las piezas de botón de "Botón × de cierre de los modales"
(`sprite-rendering`); y la fuente pixel. La "cifra en rojo" de "Panel de obra" y el texto «faltan N» usan la tinta
`danger` de la pieza de su fila (roja según "Datos de aspecto de la interfaz"); la explicación del edificio, su tinta
`muted`; el resto del texto de la fila, su tinta `text`, y el saldo, la tinta `text` de `panel`. Los iconos de madera
y piedra conservan su imagen y su alternativa de texto. Las filas de edificio conservan su disposición interna (no se
les aplica "Texto centrado en los botones DOM"); la × sí lo cumple. Ningún elemento del panel MUST tener atributo
`style`, tampoco por las piezas. Con una ventana ≥ 960 × 540 y cualquier k, el saldo, las 2 filas (con su icono de
edificio y su explicación) y la × MUST quedar dentro del recuadro, enteros en la ventana y sin solaparse entre sí ni
con el título. Si una pieza o la fuente no carga, el panel se pinta con su reserva y construir y salir funcionan igual.

#### Scenario: Torre no asequible con piezas
- **GIVEN** un snapshot en obra con madera 30 y piedra 14
- **WHEN** se pinta el panel
- **THEN** la fila de la casa usa la pieza de `button` y la de la torre la de `buttonDisabled`, desactivada
- **AND** la cifra 15 de piedra y «faltan 1» usan la tinta `danger` de `buttonDisabled`, y la cifra 30 de madera no

#### Scenario: Panel sin atributo style
- **GIVEN** un snapshot en obra con madera 10 y piedra 0
- **WHEN** se pinta el panel
- **THEN** ningún elemento del panel tiene atributo `style`, cada icono de recurso tiene la alternativa `madera` o
  `piedra` y cada imagen de edificio tiene texto alternativo vacío

#### Scenario: Panel entero dentro del marco
- **GIVEN** un snapshot en obra con madera 10 y piedra 0 (las dos filas con cifras en rojo y «faltan»), pintado con
  ventanas de 960 × 540 (k = 1) y de 2.560 × 1.440 (k = 2), con la pieza de `panel` del repositorio
- **WHEN** se leen las reglas del panel
- **THEN** su relleno interior es ≥ (l·k, t·k, r·k, b·k) px y el saldo, las 2 filas y la × caben en la ventana sin
  solaparse

#### Scenario: Construir con las piezas en reserva
- **GIVEN** un snapshot en obra con madera 30 y piedra 15 en el tick n y las piezas de `panel` y `button` sin cargar
- **WHEN** se hace clic en la fila de la casa y se pinta 1 frame de 16,667 ms
- **THEN** el panel no es visible, el solar está en `house` y `snapshot.tick` vale n + 1, sin errores no capturados

## REMOVED Requirements
<!-- Ninguno. -->
