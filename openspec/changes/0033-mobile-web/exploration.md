# Exploración 0033 · mobile-web

Intención: jugar en el navegador del móvil con controles táctiles (joystick flotante, botones de pausa/salir,
reiniciar y pantalla completa). Núcleo (`domain`, `application`) intacto. Base: `main` 630ce53 (0032 ya fusionado).
Limitación: no se pudo leer el código de `spike/mobile` (sin acceso a git); se parte del diario
`docs/ai-log/2026-11-26-spike-mobile.md`.

## Contexto actual
- Escala: `src/composition/scaleConfig.ts` fija `Scale.RESIZE` (5) recortado a `arena.maxView` (2.560 × 1.440,
  `content/arena.json`, `ArenaSchema` en `src/infrastructure/content/schemas.ts`), zoom 1. `main.ts` aplica
  `applyUiScale(root.style, screenFrame(w, h))` en cada RESIZE y expone `__sprint.viewport` (`viewportProbe`).
- `screenFrame` (`src/infrastructure/phaser/ui/screenFrame.ts`): `uiScale` entero ≥ 1 sobre base 960 × 540. HUD
  (`hudLayout`, fuente 14), cartas (`cardLayout`, 240 × 170, fuente 14) y `veilLayout` se recolocan en
  `GameScene.relayout` vía `watchScreen`. `CameraRig.resize(frame)` y el recorte 0018 usan el tamaño del lienzo.
- DOM (`src/styles.css`, `src/infrastructure/dom/*Panel.ts`): menú, pausa, tienda, obra, guía, resultados con
  `font: calc(14|16px * var(--ui-scale))`, `max-height: calc(100vh - 2em)`; botones con `border-image` de 0032.
- Entrada: `KeyboardInput.read()` -> `PlayerInput.of(x, y)` (ya admite analógico, módulo ≤ 1); Esc = `PauseKey`
  -> `PauseGate`/`ShopGate`/`BuildGate`; R = `RestartKey` (`RestartRun` solo procede con la partida terminada).
  DOM -> escena por cola `takeAction()` (patrón `PausePanel`, `ShopPanel`, `BuildPanel`). Cartas: `Rectangle`
  interactivo con `pointerdown` (`sceneWidgets.ts`), ya válido con toque.
- `index.html`: viewport sin `viewport-fit`; CSP `style-src 'self'` (clases CSS y CSSOM sí, `style=""` no).
  Playwright: proyecto `logic` con `...devices['Desktop Chrome']`, 1.280 × 720; no hay nada de táctil.

## Specs afectadas
- `world-camera` "Vista a ventana completa con tope": exige zoom 1 (L unidades = L px CSS) y vista = min(ventana,
  tope). EXPAND lo rompe: hay que **MODIFICAR** con excepción explícita del modo móvil (vista lógica de alto base).
  "Redimensionado" y "HUD/overlays fijos" siguen valiendo con el tamaño lógico.
- `hud` "Escala por escalones" (k entero; k = 1 hasta 1.280 × 720) y "anclado": si el lienzo lógico es ≥ 960 × 540
  se cumple tal cual; si la escala móvil es fraccionaria, MODIFICAR.
- `main-menu`, `menu-guide`, `upgrades`, `run-results`, `castle-shop`, `build-sites` (centrado y "enteros en la
  ventana ≥ 960 × 540"): tocar solo si cambia la escala DOM en móvil.
- Nuevas: `touch-controls` (joystick, barra, precedencia del teclado, orientación, pantalla completa) y
  `mobile-display` (detección, EXPAND, contenido). `player-movement`: añadir fuente táctil de `PlayerInput`.
- Sin cambios: simulación, firmas, balance, `sprite-rendering` (recorte 0018 en unidades de mundo).

## Opciones
1. Pantalla móvil
   - A. EXPAND con alto base en `content/` (lo del spike). Pro: probado en Pixel 7 Pro, no toca `CameraRig` ni 0018,
     Phaser reescala el toque. Contra: segunda ruta de escalado junto a RESIZE; ancho lógico = 640 × aspecto, y con
     aspecto < 1,5 (tablet) queda < 960 de ancho.
   - B. `Scale.NONE` con `setGameSize(W/k, H/k)` y tamaño CSS del canvas por CSSOM. Pro: control total, puro y
     testable; Contra: reimplementa lo que ya hace Phaser y el cálculo de entrada.
   - C. Dejar RESIZE a zoom 1. Pro: cero código de escala. Contra: unas 3 veces menos mundo que a 1.280 × 720.
2. Escala del HUD/cartas en móvil (EXPAND a 844 × 390 deja la fuente 14 en ~8,5 px CSS)
   - A. `uiScale` fraccionario solo en móvil, con texto mínimo en px CSS (`content/`); cartas 3 × 240 × k caben a
     k ≈ 1,6 en 1.385 de ancho.
   - B. Dejar ×1 (ilegible). C. HUD/cartas de móvil con diseño propio (trabajo grande, separaría el change).
3. Detección: `pointer: coarse` (incluye tablets), solo teléfono (ancho/alto CSS), o `?mobile` / `?mobile=0`
   manual. Portátil táctil con ratón: `pointer` primario `fine`, no se activa.
4. Aviso en vertical: DOM encima, y la partida no avanza por (a) pausa externa en `PauseGate` o (b) dormir el bucle
   de Phaser. (a) conserva los ticks acotados y reanuda sola; (b) arriesga un delta enorme al despertar.

## Riesgos e incógnitas
- Contenido (zod): `arena.mobile.baseHeight` (entero, ≥ 540 y ≤ `maxView.height`), joystick (`radius` > 0, `deadZone`
  en [0, 1), fracción de zona 0,5, texto de reposo), botones (≥ 44 px CSS). Sin pasar por `RunConfig`: llegan por
  `parseContent` junto a `maxView`.
- Joystick: debe ignorarse con oferta, pausa, tienda, obra o resultados abiertos, y si el toque cae sobre un objeto
  interactivo (cartas, que ocupan ambas mitades); multitoque (`addPointer`) para soltar el joystick y tocar cartas.
- Teclado manda sobre joystick (híbridos). ↻ solo sirve con la partida terminada (`RestartRun`): en móvil es la única
  forma de reiniciar, así que mostrarlo al terminar; el menú se alcanza con pausa.
- Pantalla completa: iPhone sin Fullscreen API ni `orientation.lock` (Android solo en pantalla completa y con
  `try/catch`); ocultar el botón sin la API. iOS sin probar. Safe areas con `viewport-fit=cover` y `env(safe-area-*)`.
- Iconos de botones: Departure Mono no trae ⏸ ↻ ⛶; usar SVG `data:` (CSP admite `img-src data:`) o piezas del pack.
- Zonas de pulsación DOM a 14 px * `--ui-scale` en 390 px de alto: tienda y guía ya desplazan, el menú de 5 botones
  y los resultados (5 líneas) hay que revisarlos; cartas ≥ 44 px CSS comprobar tras la escala.
- Rendimiento con horda llena y `devicePixelRatio` > 1 (lienzo blando): sin medir. Móvil real solo por USB.
- Sonda: `viewport.uiScale` hoy sale de `screenFrame`; añadir `mobile` y escala móvil sin romper los E2E actuales.

## Mediciones previas
No aplican (sin balance ni ritmo). Sí conviene, en la verificación, 1 captura de fps con la horda llena en el
móvil real (solo anotada, fuera del gate).

## Estrategia de tests
Unitarios con dobles: cálculo de tamaño lógico y escala (puro), detección (`matchMedia` doble, `?mobile`, `?e2e`),
joystick (vector, zona muerta, precedencia, ignorado en overlays), barra (colas Esc/R), schema zod. Un E2E en `logic`
con `hasTouch` y `?e2e&manual&mobile`: arrastrar mueve al jugador y el aviso vertical detiene los ticks.

## Preguntas para el usuario
Ver las decisiones numeradas del resumen devuelto al orquestador.
