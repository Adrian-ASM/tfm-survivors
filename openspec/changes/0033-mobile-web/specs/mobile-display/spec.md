# Spec delta · mobile-display

<!-- Ruta: openspec/changes/0033-mobile-web/specs/mobile-display/spec.md
     Capacidad nueva. Palabras normativas: SHALL / MUST. Escenarios GIVEN/WHEN/THEN verificables por test.
     Notación: P_w × P_h es el tamaño de la ventana en px CSS; W × H el tamaño lógico del lienzo en modo móvil;
     T_w × T_h el tope de vista (`arena.maxView`, 2.560 × 1.440 por defecto). Los nombres de los campos de contenido
     y de la sonda los fija el design; aquí se citan por su significado. -->

## ADDED Requirements

### Requirement: Activación del modo móvil
El sistema SHALL decidir **una sola vez, al cargar la página**, si el modo móvil está activo, con estas reglas en este
orden:
1. Si la URL incluye `mobile=1`, el modo móvil está activo; si incluye `mobile=0`, no lo está (el forzado gana a la
   detección, con o sin `?e2e`).
2. Si la URL incluye `mobile` con cualquier otro valor (vacío, `true`, `abc`, `2`…), se emite exactamente 1 aviso por
   consola que menciona `mobile` en toda la carga y se sigue con la regla 3.
3. Si la URL incluye `?e2e`, el modo móvil no está activo (`?e2e` solo desactiva la autodetección).
4. En otro caso, el modo móvil está activo si y solo si el puntero primario es grueso (consulta de medios
   `(pointer: coarse)`), lo que incluye las tablets. Un portátil táctil con ratón (puntero primario fino) no lo activa.

Un cambio posterior del resultado de la consulta de medios (p. ej. al conectar un ratón) MUST NOT cambiar el modo
hasta la siguiente carga. El modo se aplica a todas las pantallas de esa carga (menú, guía, partidas tras R y tras
`Volver al menú` + `Jugar`). El modo móvil MUST NOT llegar al núcleo de simulación.

#### Scenario: Puntero grueso sin parámetros
- **GIVEN** un navegador cuyo puntero primario es grueso y la URL sin parámetros
- **WHEN** termina la carga
- **THEN** el modo móvil está activo y no se emite ningún aviso que mencione `mobile`

#### Scenario: Puntero fino sin parámetros
- **GIVEN** un navegador cuyo puntero primario es fino (también con pantalla táctil secundaria) y la URL sin parámetros
- **WHEN** termina la carga
- **THEN** el modo móvil no está activo

#### Scenario: Forzado por URL
- **GIVEN** un puntero fino con la URL `?mobile=1` y, en otra carga, un puntero grueso con `?mobile=0`
- **WHEN** termina cada carga
- **THEN** el modo móvil está activo en la primera y no activo en la segunda, sin avisos que mencionen `mobile`

#### Scenario: E2E desactiva solo la autodetección
- **GIVEN** un puntero grueso con la URL `?e2e&seed=42` y, en otra carga, un puntero fino con `?e2e&mobile=1&seed=42`
- **WHEN** termina cada carga
- **THEN** el modo móvil no está activo en la primera y sí en la segunda
- **AND** en ambas el menú no se ha visto y la partida está en curso (ver "Arranque directo con e2e" en `main-menu`)

#### Scenario: Valor de mobile inválido
- **GIVEN** un puntero grueso con la URL `?mobile=abc` y, en otra carga, un puntero grueso con `?e2e&mobile=true`
- **WHEN** termina cada carga
- **THEN** en la primera el modo móvil está activo (autodetección) y en la segunda no (regla de `?e2e`)
- **AND** en cada carga se ha emitido exactamente 1 aviso que menciona `mobile`

#### Scenario: Cambio del puntero tras la carga
- **GIVEN** una carga con puntero grueso y el modo móvil activo
- **WHEN** la consulta `(pointer: coarse)` pasa a no cumplirse, se pintan 60 frames, se pulsa R tras terminar la
  partida y se pintan 60 frames más
- **THEN** el modo móvil sigue activo en todos esos frames y en la partida nueva

### Requirement: Contenido del modo móvil validado
El sistema SHALL leer de `content/` las constantes del modo móvil, validadas con zod antes de usarse: alto base
(entero, 540 ≤ alto base ≤ `maxView.height`), ancho mínimo (entero, 1 ≤ ancho mínimo ≤ `maxView.width`), tamaño mínimo
del texto en px CSS (> 0), radio del joystick en px CSS (> 0), zona muerta (fracción del radio en [0, 1)), fracción del
ancho del lienzo que ocupa la zona de arrastre (en (0, 1]) y texto en reposo (cadena no vacía). Un contenido inválido
MUST impedir que se muestre el menú o empiece una partida, con un error que nombre el campo inválido. El contenido por
defecto MUST definir alto base 640, ancho mínimo 960, fracción de la zona de arrastre 0,5 y el texto en reposo
`Arrastra aquí para moverte`. Estas constantes solo llegan a la presentación: MUST NOT formar parte de la `RunConfig`
ni de ningún dato que reciba el núcleo, también sin modo móvil.

#### Scenario: Contenido por defecto
- **GIVEN** el contenido por defecto del repositorio
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito, la presentación recibe alto base 640, ancho mínimo 960, fracción 0,5 y el texto
  `Arrastra aquí para moverte`
- **AND** la `RunConfig` es igual campo a campo a la que se obtiene sin las constantes del modo móvil

#### Scenario: Alto base fuera de rango
- **GIVEN** el contenido por defecto con alto base 539, en otro caso 1.441 (tope 1.440) y en otro 640,5
- **WHEN** se carga el contenido
- **THEN** en los tres casos la carga falla con un error que nombra el alto base y no se muestra el menú

#### Scenario: Alto base en los límites
- **GIVEN** el contenido por defecto con alto base 540 y, en otro caso, 1.440
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito en ambos

#### Scenario: Joystick inválido
- **GIVEN** el contenido por defecto con, en un caso cada vez, radio 0, zona muerta 1, zona muerta −0,1, fracción de
  zona 0, fracción de zona 1,5 o texto en reposo vacío
- **WHEN** se carga el contenido
- **THEN** cada carga falla con un error que nombra el campo inválido

#### Scenario: Zona muerta y fracción en sus límites válidos
- **GIVEN** el contenido por defecto con zona muerta 0 y fracción de zona 1
- **WHEN** se carga el contenido
- **THEN** la carga tiene éxito

#### Scenario: Ancho mínimo inválido
- **GIVEN** el contenido por defecto con ancho mínimo 0 y, en otro caso, 2.561 (tope 2.560)
- **WHEN** se carga el contenido
- **THEN** ambas cargas fallan con un error que nombra el ancho mínimo

### Requirement: Tamaño lógico del lienzo en modo móvil
En modo móvil, el lienzo SHALL ocupar la ventana entera (sin barras de desplazamiento del documento) y medir, en
unidades del lienzo, H = max(alto base, ⌈ancho mínimo × P_h / P_w⌉) de alto y W = H × P_w / P_h de ancho, de modo que
1 unidad del lienzo mide P_h / H px CSS en los dos ejes (error ≤ 1 %). Con el contenido por defecto, W ≥ 960 y H ≥ 640
en cualquier ventana horizontal. La vista (área de mundo visible) MUST medir min(W, T_w) × min(H, T_h) unidades de
mundo, con 1 unidad de mundo = 1 unidad del lienzo, y MUST cumplir "Cámara que sigue al jugador dentro del mundo"
(`world-camera`) con ese tamaño de vista. Si W o H superan el tope, el lienzo lógico se recorta al tope y se centra en
la ventana, y el espacio de la ventana fuera de él MUST NOT mostrar mundo, como en escritorio. El tamaño lógico se recalcula en cada cambio de tamaño de la ventana, desde el primer
frame pintado tras el cambio, con las mismas garantías de "Redimensionado de la ventana" (`world-camera`). En vertical
(P_h > P_w) se muestra el aviso de orientación (ver `touch-controls`) y esta spec no fija la vista bajo él. Una ventana
con ancho o alto 0 MUST NOT producir errores no capturados ni cambiar la simulación. La elección entre esta ruta y la
de escritorio se hace una vez al cargar, con el modo móvil.

#### Scenario: Móvil en horizontal
- **GIVEN** el modo móvil, el contenido por defecto y una ventana de 844 × 390 px CSS
- **WHEN** se pinta un frame de una partida
- **THEN** el lienzo ocupa la ventana entera y mide 1.385,03 × 640 unidades (error ≤ 1)
- **AND** la vista mide 1.385,03 × 640 unidades de mundo (error ≤ 1) y un segmento de 640 unidades de mundo mide 390 px
  CSS en pantalla (error ≤ 1 px)

#### Scenario: Cámara con el tamaño lógico
- **GIVEN** el modo móvil, el contenido por defecto, una ventana de 844 × 390 y el jugador en (1.950, 1.170)
- **WHEN** se pinta el snapshot
- **THEN** la esquina superior izquierda del rectángulo visible es (1.257,5, 850) (error ≤ 1)

#### Scenario: Tablet 4:3
- **GIVEN** el modo móvil y una ventana de 1.024 × 768, y en otro caso de 800 × 600
- **WHEN** se pinta un frame de una partida
- **THEN** en ambos casos el lienzo y la vista miden 960 × 720 unidades (error ≤ 1)

#### Scenario: Aspecto 1,5 exacto
- **GIVEN** el modo móvil y una ventana de 960 × 640
- **WHEN** se pinta un frame de una partida
- **THEN** la vista mide 960 × 640 unidades (error ≤ 1)

#### Scenario: Aspecto muy alargado con tope
- **GIVEN** el modo móvil y una ventana de 3.200 × 640 px CSS (tamaño lógico sin tope 3.200 × 640)
- **WHEN** se pinta un frame de una partida
- **THEN** el lienzo lógico se recorta al tope y mide 2.560 × 640 unidades, centrado en horizontal en la ventana, y la
  vista mide 2.560 × 640 unidades de mundo
- **AND** ningún píxel de la ventana fuera del lienzo muestra mundo

#### Scenario: Nunca menos mundo que el mínimo de escritorio
- **GIVEN** el modo móvil y las ventanas horizontales 640 × 360, 844 × 390, 915 × 412, 1.024 × 768, 1.180 × 820 y
  1.366 × 1.024
- **WHEN** se calcula la vista de cada una
- **THEN** en todas mide al menos 960 × 540 unidades de mundo

#### Scenario: Redimensionado en móvil
- **GIVEN** el modo móvil, una partida en curso con una ventana de 844 × 390 y el jugador en (1.950, 1.170)
- **WHEN** la ventana pasa a 915 × 412 y se pinta el siguiente frame
- **THEN** la vista mide 1.421,36 × 640 (error ≤ 1) y cumple la fórmula de la cámara con la posición del jugador
- **AND** el snapshot es igual campo a campo al de una partida idéntica sin redimensionar en ese mismo tick y no se ha
  creado ninguna partida

#### Scenario: Ventana a cero en móvil
- **GIVEN** el modo móvil y una partida en curso con una ventana de 844 × 390
- **WHEN** la ventana pasa a 0 × 0 y vuelve a 844 × 390
- **THEN** no hay errores no capturados y, al volver, la vista mide 1.385,03 × 640 (error ≤ 1)

### Requirement: Escala de la UI del lienzo en modo móvil
En modo móvil, el HUD (ver `hud`) y las cartas del overlay de elección (ver `upgrades`) SHALL pintarse con un factor
de escala k fraccionario que depende solo del tamaño de la ventana y del contenido (nunca del snapshot):
k = min(k_max, max(1, k_min)), donde k_min = m × H / (14 × P_h) es el factor con el que el texto base (14 unidades con
factor 1) mide m px CSS, siendo m el tamaño mínimo del texto del contenido, y k_max es el mayor factor con el que las 3
cartas de una oferta y los ocho elementos del HUD quedan enteros dentro del lienzo y sin solaparse. Si k_min > k_max,
gana que las cartas y el HUD queden enteros (k = k_max) aunque el texto mida menos de m. Con factor k, cada elemento del
HUD y cada carta MUST medir k veces lo que mide con factor 1 y su distancia al anclaje MUST ser k veces la de factor 1
(error ≤ 1 unidad). Cada carta MUST medir ≥ 44 × 44 px CSS en pantalla. El factor se recalcula en cada cambio de tamaño
de la ventana desde el primer frame pintado tras el cambio y MUST NOT cambiar la simulación ni los valores mostrados.
Sin modo móvil rige "Escala del HUD por escalones" (`hud`), con k entero.

#### Scenario: Texto mínimo en un móvil horizontal
- **GIVEN** el modo móvil, un contenido con texto mínimo 12 px CSS y una ventana de 844 × 390 (lienzo 1.385,03 × 640)
- **WHEN** se pinta el HUD y una oferta de 3 opciones
- **THEN** el factor vale 1,4066 (error ≤ 0,001) y el texto base del HUD y de las cartas mide 12 px CSS en pantalla
  (error ≤ 0,1 px)
- **AND** las 3 cartas están enteras dentro del lienzo, no se solapan y cada una mide ≥ 44 × 44 px CSS

#### Scenario: Pantalla grande con factor 1
- **GIVEN** el modo móvil, un contenido con texto mínimo 12 px CSS y una ventana de 1.024 × 768 (lienzo 960 × 720)
- **WHEN** se pinta el HUD
- **THEN** el factor vale 1 (k_min ≈ 0,80 < 1) y las 3 cartas de una oferta caben enteras en los 960 de ancho

#### Scenario: Texto mínimo inalcanzable
- **GIVEN** el modo móvil, un contenido con texto mínimo 20 px CSS y una ventana de 844 × 390 (k_min ≈ 2,344)
- **WHEN** se pinta una oferta de 3 opciones y el HUD con vida `120/120`, nivel 99, 12.345 bajas, oro 123.456, madera
  12.345 y piedra 12.345
- **THEN** el factor es < 2,344 y es el mayor con el que las 3 cartas y los ocho elementos del HUD están enteros dentro
  del lienzo sin solaparse (con un factor 0,01 mayor alguno de ellos ya no lo estaría)

#### Scenario: HUD entero en móvil
- **GIVEN** el modo móvil, el contenido por defecto y el snapshot de "HUD entero y sin solapes" (`hud`)
- **WHEN** se pinta con ventanas de 844 × 390, 915 × 412, 1.024 × 768 y 1.366 × 1.024
- **THEN** en cada una los ocho elementos del HUD están enteros dentro del lienzo y no se solapan entre sí

#### Scenario: Factor al redimensionar
- **GIVEN** el modo móvil, un contenido con texto mínimo 12 y una partida en pausa pintada con 844 × 390
- **WHEN** la ventana pasa a 1.024 × 768 y se pinta el siguiente frame
- **THEN** el HUD se pinta con factor 1, muestra los mismos valores y el snapshot no ha cambiado

#### Scenario: Toque en una carta escalada
- **GIVEN** el modo móvil, una ventana de 844 × 390 y una oferta de 3 opciones abierta
- **WHEN** se toca el centro de la tercera carta en su posición de pantalla
- **THEN** se elige la opción de índice 2

### Requirement: Paneles DOM en modo móvil
En modo móvil, los paneles DOM (menú de inicio, diálogo de `Borrar datos`, guía, pausa, tienda, panel de obra y
resultados) SHALL mostrarse a escala de UI 1 en px CSS sea cual sea la ventana (la escala de UI DOM nunca vale > 1),
centrados en horizontal en la ventana como fijan `main-menu`, `menu-guide`, `castle-shop`, `build-sites` y
`run-results`. Si el contenido de un panel no cabe en el alto de la ventana, el panel MUST poder desplazarse dentro de
sí mismo hasta mostrar entero cada uno de sus botones y textos, sin que se desplace el documento. Cada botón o zona
pulsable de esos paneles MUST medir ≥ 44 × 44 px CSS. Las garantías de esas specs para ventanas ≥ 960 × 540 siguen
valiendo en modo móvil con escala 1. Sin modo móvil, la escala DOM y el tamaño de los paneles no cambian.

#### Scenario: Paneles en un móvil horizontal
- **GIVEN** el modo móvil y una ventana de 844 × 390
- **WHEN** se abre, en cada caso, el menú, el diálogo de `Borrar datos`, la guía en cada una de sus 7 páginas, la
  pausa, la tienda con todos sus productos, el panel de obra y los resultados con el aviso `no se guarda`, el de
  `dañados` y un mensaje de import a la vez
- **THEN** en cada panel la escala de UI DOM vale 1, cada botón mide ≥ 44 × 44 px CSS y, desplazando el panel, cada
  botón y cada texto se ve entero dentro de la ventana
- **AND** el documento no tiene barras de desplazamiento

#### Scenario: Botones operativos tras desplazar
- **GIVEN** el modo móvil, una ventana de 844 × 390 y el menú de inicio
- **WHEN** se desplaza el menú hasta ver entero `Borrar datos` y se toca su centro
- **THEN** se abre el diálogo de confirmación y no existe ninguna partida

#### Scenario: Escala DOM sin crecer en pantallas grandes
- **GIVEN** la URL `?mobile=1` y una ventana de 2.560 × 1.440, y en otra carga la misma ventana sin `mobile`
- **WHEN** se muestra el menú de inicio
- **THEN** la escala de UI DOM vale 1 en la primera y la de escritorio (≥ 2) en la segunda

### Requirement: Documento táctil
En modo móvil, la página SHALL comportarse como una aplicación a pantalla entera:
- el documento MUST NOT hacer zoom por pellizco ni por doble toque, ni desplazarse, ni rebotar al arrastrar sobre el
  lienzo;
- mantener pulsado MUST NOT seleccionar texto ni abrir el menú contextual del navegador sobre el lienzo;
- el lienzo ocupa el alto visible dinámico de la ventana (sin quedar tapado por las barras del navegador);
- la página declara `viewport-fit=cover` y los controles táctiles quedan fuera de las zonas seguras del dispositivo
  (ver "Barra táctil" en `touch-controls`).

Todo ello MUST respetar la CSP actual y no se registra ninguna violación de CSP. Ningún elemento propio del documento
(barra táctil, aviso de orientación, paneles y sus contenedores) MUST tener atributo `style`, con dos excepciones que
ya existen en escritorio:
- el lienzo del motor, cuyos estilos escribe el motor por CSSOM;
- el contenedor `#game`, siempre que su atributo `style` contenga solo propiedades personalizadas `--*` (las variables
  de escala de UI y del kit de UI publicadas por CSSOM desde 0017 y 0032).

Sin modo móvil, lo que se ve y cómo responde la página al ratón y al teclado no cambia.

#### Scenario: Arrastre sin desplazar la página
- **GIVEN** el modo móvil, una ventana de 844 × 390 y una partida en curso
- **WHEN** se arrastra un dedo 200 px hacia arriba y después hacia abajo sobre el lienzo
- **THEN** el desplazamiento del documento sigue en (0, 0) y la escala visual de la página sigue en 1

#### Scenario: Sin estilos inline
- **GIVEN** el modo móvil y, en otra carga, el modo de escritorio
- **WHEN** se recorren el menú, una partida (con la barra táctil en móvil), la pausa, el aviso de orientación (solo
  en móvil) y los resultados
- **THEN** en cada pantalla ningún elemento del documento tiene atributo `style` salvo el lienzo del motor y `#game`
- **AND** el atributo `style` de `#game`, si existe, solo contiene propiedades cuyo nombre empieza por `--`
- **AND** la barra, el aviso, los paneles y sus contenedores no tienen atributo `style` y no se registra ninguna
  violación de CSP

#### Scenario: Meta viewport
- **GIVEN** la build de producción
- **WHEN** se lee la etiqueta `viewport` de `index.html`
- **THEN** incluye `viewport-fit=cover` e impide el zoom del usuario

### Requirement: Sonda de pantalla con modo móvil
Con `?e2e`, la sonda `window.__sprint.viewport` SHALL exponer, además de sus campos actuales (tamaño de ventana en px
CSS y escala de UI), si el modo móvil está activo y, en modo móvil, el factor de escala del HUD y las cartas
(fraccionario) y la escala de UI DOM (1), en campos que se puedan leer por separado. Sin modo móvil, los campos
actuales MUST conservar su valor y significado y el indicador de modo móvil vale falso. La sonda de cámara
(`world-camera`) sigue informando de la ventana en px CSS y del rectángulo visible en unidades de mundo. Sin `?e2e`
la sonda MUST NOT existir.

#### Scenario: Sonda en móvil
- **GIVEN** la build de producción con `?e2e&manual&mobile=1&seed=42`, una ventana de 844 × 390 con pantalla táctil y
  una partida en curso
- **WHEN** se lee la sonda
- **THEN** informa de modo móvil activo, ventana 844 × 390, escala de UI DOM 1, un factor del HUD ≥ 1 y un rectángulo
  visible de 1.385 × 640 unidades de mundo (error ≤ 1), al menos 960 × 540

#### Scenario: Sonda en escritorio
- **GIVEN** la build de producción con `?e2e&manual&seed=42` y una ventana de 1.280 × 720
- **WHEN** se lee la sonda
- **THEN** informa de modo móvil no activo, ventana 1.280 × 720 y escala de UI 1, como antes del change

### Requirement: Escritorio sin cambios fuera del modo móvil
Sin modo móvil, el sistema SHALL comportarse exactamente como antes del change: lienzo a ventana completa a zoom 1
(`world-camera`), escala del HUD entera por escalones (`hud`), escala DOM y paneles sin cambios, y ningún control táctil
(joystick, indicación en reposo, barra táctil ni aviso de orientación) en el documento ni en el lienzo. En cualquier
modo, la fuente del input y la presentación MUST NOT cambiar la simulación: la misma semilla, el mismo contenido y los
mismos `PlayerInput` por tick producen los mismos snapshots con y sin modo móvil.

#### Scenario: Sin controles táctiles en escritorio
- **GIVEN** la build de producción con `?e2e&manual&seed=42` (puntero fino), una ventana de 1.280 × 720, y en otra
  carga la misma URL con una ventana de 600 × 900 (más alta que ancha)
- **WHEN** se recorren el menú, una partida en curso, la pausa y los resultados
- **THEN** no hay ningún botón de la barra táctil, ni joystick, ni indicación en reposo, ni aviso de orientación, y en
  la ventana de 600 × 900 la partida sigue avanzando con `step(60)` (devuelve 60 si no se abre oferta ni termina)

#### Scenario: Misma partida con y sin modo móvil
- **GIVEN** dos partidas con el contenido por defecto, la semilla 7, la misma secuencia de `PlayerInput` por tick
  (con módulos 0, 0,375 y 1) y la política de elección fija, una con modo móvil y otra sin él
- **WHEN** se ejecutan 3.600 ticks
- **THEN** sus snapshots son iguales campo a campo en cada tick
