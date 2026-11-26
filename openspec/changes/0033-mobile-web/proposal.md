# Proposal · 0033-mobile-web

- **Estado**: aprobada por el autor (2026-11-26)
- **Issue**: (sin issue)
- **Rama / worktree**: `change/0033-mobile-web` (`.claude/worktrees/fix-e2e-solares-1c8a2f`)

## Problema
El juego se publica en Pages y carga en el navegador del móvil, pero no se puede jugar ahí. Solo hay teclado
(WASD/flechas, Esc, R). En un móvil en horizontal (p. ej. 844 × 390 px CSS), `Scale.RESIZE` a zoom 1 enseña unas
3 veces menos mundo que a 1.280 × 720. Un dedo no puede mover al arquero, pausar ni reiniciar. Nada avisa de que el
juego se juega en horizontal. El spike desechable `spike/mobile` (`docs/ai-log/2026-11-26-spike-mobile.md`)
demostró que basta con infraestructura, composición, CSS e `index.html`. En un Pixel 7 Pro va fluido, y
`PlayerInput.of(x, y)` ya admite una dirección analógica de módulo ≤ 1 (historia Should 0033 del GDD).

## Objetivo
En un dispositivo táctil en horizontal se juega una partida completa: menú → partida → mejoras → tienda y obra →
resultados → reinicio. El jugador usa un joystick flotante en la mitad izquierda y una barra de botones abajo a la
derecha. La vista enseña al menos tanto mundo como el mínimo de escritorio (960 × 540), y el HUD y las cartas tienen
un tamaño de texto mínimo legible. En vertical, un aviso «Gira el móvil» detiene la partida, y la partida vuelve sola
al girar a horizontal. En escritorio sin modo móvil no cambia nada de lo que se ve ni de lo que se prueba hoy. El
núcleo (`src/domain`, `src/application`), las firmas doradas y `BALANCE_BASELINE` no cambian.

## Decisiones cerradas por el autor
1. **Escalado del lienzo en modo móvil: `Scale.EXPAND` con alto base en `content/`** (zod), con un suelo de ancho
   lógico de 960. Es la opción 1A de la exploración, la probada en el spike: no toca `CameraRig` ni el recorte de
   0018, y Phaser reescala el toque. **Decisión de esta propuesta** sobre los aspectos < 1,5 (la exploración avisa de
   que, en tablets, 640 × aspecto queda por debajo de 960): el alto lógico es
   H = max(`baseHeight`, ⌈`minWidth` × P_h / P_w⌉) y el ancho lógico es W = H × P_w / P_h. Así W ≥ 960 y H ≥ 640
   siempre, y la vista nunca enseña menos de 960 × 540. Por ejemplo, 844 × 390 da unos 1.385 × 640 y
   1.024 × 768 (4:3) da 960 × 720. Como en escritorio, la vista se recorta al tope `maxView` (2.560 × 1.440).
   `minWidth` (960) también va en `content/` para no dejar un número mágico.
2. **HUD y cartas: `uiScale` fraccionario solo en modo móvil**, con un tamaño mínimo de texto en px CSS en
   `content/`. El factor se calcula para que el texto base (14) se vea al menos a ese mínimo, y queda acotado para
   que las 3 cartas y el HUD quepan enteros en el lienzo lógico. En escritorio, "Escala del HUD por escalones"
   (k entero, k = 1 hasta 1.280 × 720) sigue igual. Se modifica la spec `hud`.
3. **Paneles DOM en móvil** (menú, diálogo de borrado, guía, pausa, tienda, obra y resultados): se muestran en px
   CSS nativos, con `--ui-scale` = 1 y nunca > 1. Donde no quepan se desplazan, y toda zona táctil mide ≥ 44 × 44 px
   CSS.
4. **Activación**: `matchMedia('(pointer: coarse)')`, que incluye las tablets, más un forzado por URL con
   `?mobile=1` / `?mobile=0` (el forzado gana). Un portátil táctil con ratón tiene puntero primario `fine` y no lo
   activa.
5. **`?e2e` solo desactiva la autodetección.** `?e2e&mobile=1` activa el modo móvil a propósito para el E2E táctil.
   Como tarea del change, se cambia en el GDD la frase «`?e2e` nunca activa el modo móvil» por esta regla.
6. **Aviso «Gira el móvil» en vertical** (P_h > P_w): el aviso es una **pausa externa** en `PauseGate` y no abre el
   overlay de pausa. La partida se reanuda sola al volver a horizontal. Si el jugador ya estaba en pausa, o en
   oferta, tienda u obra, vuelve exactamente a ese estado.
7. **iOS best effort**: el botón de pantalla completa se oculta si no existe la Fullscreen API (iPhone). En Android
   se intenta `screen.orientation.lock('landscape')` tras entrar en pantalla completa, dentro de un `try/catch`.
   iOS queda «no verificado».
8. **Barra táctil**: ⏸ siempre visible durante la partida. Hace lo mismo que Esc: pausar y reanudar, y salir de la
   tienda y de la obra. ↻ solo es visible con la partida terminada y hace lo mismo que R. ⛶ solo aparece si hay API.
   Los iconos son SVG `data:` (Departure Mono no trae esos glifos; la CSP admite `img-src data:`).
9. **Sin contador de fps** en el change. Los fps se miden por USB con las DevTools remotas (`chrome://inspect`).
10. **Alta densidad (dpr > 1)**: se acepta que el lienzo se vea algo blando. Solo se anota y se mide en verify, fuera
    del gate.
11. **Un solo change y sin núcleo**: `domain` y `application` no cambian, y las firmas y el balance son idénticos.

Constantes en `content/`, validadas con zod: alto base (entero, 540 ≤ `baseHeight` ≤ `maxView.height`), ancho
mínimo, texto mínimo, radio del joystick (> 0), zona muerta en [0, 1), fracción de la zona de arrastre (0,5) y
texto en reposo («Arrastra aquí para moverte»). Llegan a la presentación por `parseContent`, junto a `maxView`, y
**no entran en `RunConfig`**. El fichero y los nombres de campo los fija el design (la exploración propone
`arena.mobile`).

## Alcance
- **Dentro**:
  - Detección del modo móvil (decisiones 4 y 5) y su exposición en la sonda `window.__sprint.viewport` (indicador
    `mobile` y escala móvil), sin romper los campos actuales.
  - Lienzo EXPAND con el alto lógico de la decisión 1, solo en modo móvil. En escritorio sigue `Scale.RESIZE` a
    zoom 1.
  - `uiScale` fraccionario del HUD y las cartas en móvil (decisión 2), y paneles DOM a escala 1 con desplazamiento
    y zonas ≥ 44 px (decisión 3).
  - Joystick flotante (`TouchJoystick`, adaptador hermano de `KeyboardInput`):
    - nace donde se apoya el dedo dentro de la mitad izquierda del lienzo;
    - da un `PlayerInput` de módulo ≤ 1, que es 0 dentro de la zona muerta y llega a 1 en el radio;
    - al soltar, el jugador se para;
    - el teclado manda si hay teclas pulsadas;
    - se ignora con menú, pausa, oferta, tienda, obra, resultados o aviso de orientación, y cuando el toque cae
      sobre un objeto interactivo (las cartas);
    - es multitoque: con el joystick activo se puede tocar otra cosa.
  - Indicación en reposo: un joystick tenue con el texto en reposo. Desaparece tras el primer movimiento de cada
    partida y vuelve a verse en cada partida nueva (tras R o `Volver al menú` + `Jugar`).
  - Barra táctil DOM abajo a la derecha (decisión 8), apartada de las safe areas y alimentando las mismas colas que
    `PauseKey`/`RestartKey`.
  - Aviso de orientación (decisión 6) y pantalla completa (decisión 7).
  - `index.html` (`viewport-fit=cover`, sin zoom del usuario) y CSS táctil: `100dvh`, `touch-action: none`,
    `overscroll-behavior: none`, sin selección de texto y márgenes `env(safe-area-inset-*)`. Todo con la CSP
    actual: clases y CSSOM, nunca `style=""`.
  - Tests: unitarios de los adaptadores con dobles. Cubren el cálculo puro del tamaño lógico y de la escala, la
    detección (doble de `matchMedia`, `?mobile`, `?e2e`), el vector del joystick (zona muerta, saturación,
    precedencia del teclado, ignorado en overlays), la barra (colas de Esc y R, visibilidad de ↻ y ⛶), la pausa
    externa y el esquema zod. Además, **como máximo 1–2 E2E** en el proyecto `logic`, en modo manual
    (`?e2e&manual&mobile=1`) con `hasTouch` y sin umbrales de fps. Comprueban que arrastrar en la mitad izquierda
    mueve al jugador tras `step(n)` y que el aviso vertical deja `step(n)` en 0.
  - Ajuste del texto del GDD (decisión 5).
- **Fuera**:
  - Cambios en `src/domain` o `src/application`, de balance o de contenido de combate.
  - Diseño para vertical: en vertical solo se muestra el aviso.
  - Un HUD o unas cartas con diseño propio para móvil: es la opción 2C de la exploración y queda como candidato si
    el `uiScale` fraccionario no basta.
  - App nativa, PWA (sigue en *Could*) y gamepad (*Could*).
  - Contador de fps (decisión 9) y tope de resolución por `devicePixelRatio` (decisión 10).
  - Verificación en iOS (decisión 7).
  - Cambios en el comportamiento de escritorio: sin modo móvil, todos los E2E actuales a 1.280 × 720 siguen
    iguales.

## Capacidades afectadas
- `openspec/specs/mobile-display` (nueva):
  - detección y forzado (`pointer: coarse`, `?mobile`, `?e2e`);
  - tamaño lógico EXPAND, con alto base, suelo de ancho y tope;
  - contenido móvil validado con zod, fuera de `RunConfig`;
  - escala de la UI en móvil y paneles DOM a escala 1 con desplazamiento y zonas ≥ 44 px;
  - CSS e `index.html` táctiles con la CSP;
  - sonda `viewport` con `mobile`;
  - escritorio intacto sin modo móvil.
- `openspec/specs/touch-controls` (nueva):
  - joystick flotante (vector, zona muerta, radio, mitad izquierda, soltar);
  - indicación en reposo por partida;
  - precedencia del teclado;
  - ignorado en overlays y sobre objetos interactivos, y multitoque;
  - barra ⏸/↻/⛶ con sus equivalencias con Esc y R y su visibilidad;
  - pantalla completa y bloqueo de orientación best effort;
  - aviso «Gira el móvil» como pausa externa que se reanuda sola.
- `openspec/specs/world-camera` (modificada): "Vista a ventana completa con tope" gana una excepción explícita para
  el modo móvil. La vista mide el tamaño lógico (W × H recortado al tope), y L unidades de mundo miden
  L × P_h / H px CSS. "Redimensionado de la ventana", "HUD y overlays fijos" y la fórmula de la cámara siguen
  valiendo con el tamaño lógico. El design debe confirmar si "Sonda de cámara para E2E" necesita aclarar que la
  ventana se informa en px CSS y el rectángulo en unidades de mundo.
- `openspec/specs/hud` (modificada): en "Escala del HUD por escalones", el factor entero se queda para escritorio, y
  en modo móvil el factor es fraccionario con el texto mínimo del contenido. "HUD anclado a la ventana" se
  modifica solo si su garantía de «entero y sin solapes con ventana ≥ 960 × 540» necesita formularse sobre el
  lienzo lógico.
- `openspec/specs/player-movement` (modificada, solo si hace falta): "Movimiento del jugador por input" no
  menciona el módulo del input. Si se añade un escenario con input analógico de módulo 0,5 (media distancia), solo
  documenta un comportamiento que ya existe, sin código nuevo en el núcleo. La fuente táctil se especifica en
  `touch-controls`.
- Sin cambios, salvo que la fase de spec encuentre una contradicción: `main-menu` ("Arranque directo con e2e",
  "Pausa con Esc", "Menú y pausa centrados"), `menu-guide`, `upgrades` ("Overlay de elección en la ventana"),
  `run-results` ("Reinicio con la tecla R"), `castle-shop`, `build-sites`, `simulation-loop`, `sprite-rendering`
  (el recorte de 0018 trabaja en unidades de mundo) y todas las del núcleo. Sus garantías son para ventanas
  ≥ 960 × 540 o para el teclado, y siguen valiendo. Lo propio del móvil va como requisitos nuevos en
  `mobile-display` y `touch-controls`.

## Riesgos y dudas
- **Segunda ruta de escalado** (EXPAND junto a RESIZE): debe elegirse una sola vez al arrancar. Si el modo móvil
  cambia en caliente (p. ej. al conectar un ratón), no se cambia de ruta hasta recargar. Esto lo cierra el design.
- **Cartas en el lienzo lógico**: con k ≈ 1,6, las 3 cartas de 240 miden unas 1.150 unidades y caben en 1.385. En
  4:3 (W = 960) caben con un k menor. La cota superior del factor tiene que garantizar cartas enteras y zonas
  ≥ 44 px CSS. Si las dos cosas chocan en algún aspecto, gana «enteras» y se anota.
- **Joystick y cartas**: las cartas ocupan las dos mitades de la pantalla. Un toque sobre una carta nunca inicia
  el joystick. Un joystick activo al abrirse una oferta se suelta (input nulo) y no se reactiva hasta un toque
  nuevo.
- **E2E táctil**: Playwright no tiene un arrastre táctil de alto nivel (`touchscreen` solo hace `tap`), así que
  puede hacer falta CDP `Input.dispatchTouchEvent` o eventos de puntero sintéticos. El `step(n)` lee el input una
  vez al empezar (0014), así que el dedo tiene que seguir apoyado durante la llamada. El reloj de render no depende
  de los ticks salvo en modo manual (`?e2e&manual`, 0014): ahí avanza n × `TICK_MS` con cada `step(n)`. Con el
  aviso vertical, `step(n)` devuelve 0 y ese reloj no avanza. Los E2E nuevos deben respetar
  `tests/support/logicGuard.ts`.
- **Determinismo**: el modo móvil solo cambia la presentación y la fuente del `PlayerInput`, y no consume azar del
  núcleo. La invariancia de firmas y `BALANCE_BASELINE` es directa: no se toca la colocación de ovejas, solares ni
  decoración, ni ningún flujo de azar. Basta con `verify` sin cambios en las cifras.
- **iOS sin probar**, y el **rendimiento con la horda llena a dpr > 1** sin medir. Ambos quedan anotados para
  verify, fuera del gate.
- **Pausa externa y pausa del jugador**: si al girar a vertical el jugador ya estaba en pausa, volver a horizontal
  no debe reanudar. `PauseGate` tiene que distinguir las dos causas.
- **Acceso desde el móvil**: por USB con `chrome://inspect` y reenvío de puerto (la red local pide permisos), como
  en el spike.

## Criterio de éxito
- Todos los escenarios de `mobile-display`, `touch-controls` y de los requisitos modificados de `world-camera` y
  `hud` (y de `player-movement` si se toca) están en verde y cubiertos por tests: unitarios con dobles y como
  máximo 1–2 E2E nuevos en `logic`, en modo manual con `hasTouch`.
- Con `?e2e&manual&mobile=1&seed=42` en una ventana de 844 × 390 con `hasTouch`:
  - la sonda informa de `mobile` verdadero y de una vista de ≥ 960 × 540 unidades de mundo (unos 1.385 × 640);
  - un arrastre hacia la derecha en la mitad izquierda, mantenido durante `step(60)`, aumenta la x del jugador;
  - con la ventana a 390 × 844, el aviso es visible y `step(60)` devuelve 0;
  - al volver a 844 × 390, el aviso desaparece y `step(60)` vuelve a avanzar.
- En móvil a 844 × 390, el texto del HUD y de las cartas mide al menos el mínimo de `content/` en px CSS, y las 3
  cartas están enteras en pantalla. Los botones de la barra y de los paneles DOM miden ≥ 44 × 44 px CSS.
- Sin modo móvil (escritorio, `?e2e` sin `mobile`): la suite `logic` actual pasa sin cambiar ningún test, y no hay
  ningún control táctil en el DOM.
- `npm run verify` en verde con las seis firmas doradas, `BALANCE_BASELINE` (v4 34/50 desde 0027),
  `BUILDER_REFERENCE` (34/50), 0 quietos y los 820/904 objetos del mapa idénticos.
- No cambia ningún fichero de `src/domain` ni de `src/application`.
- Verify anota, fuera del gate, una partida completa jugada en un Android real por USB (Pixel 7 Pro o similar),
  con una captura de fps con la horda llena y una nota sobre la nitidez a dpr > 1. iOS queda como «no verificado».
