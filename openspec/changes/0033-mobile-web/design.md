# Design · 0033-mobile-web

## Resumen
El modo móvil se decide **una sola vez al cargar** (`resolveMobile`: `?mobile=1|0` gana; sin él, `?e2e` apaga la
autodetección; si no, `matchMedia('(pointer: coarse)')`). Con el modo móvil, la composición arranca Phaser con
`Scale.EXPAND` sobre una base de `minWidth × baseHeight` (960 × 640, `content/arena.json` → `arena.mobile`). Phaser ya
calcula así el tamaño lógico de la propuesta. La composición también monta los controles táctiles DOM (barra ⏸ ↻ ⛶,
aviso «Gira el móvil») y da a `GameScene` tres dependencias opcionales: regla de frame, joystick y retención por
orientación. Sin modo móvil, `GameScene` recibe exactamente las dependencias de hoy y `scaleConfig` devuelve el mismo
objeto `RESIZE`. `domain` y `application` no cambian (ADR-0029).

Vía de consulta de la API: MCP `phaser-docs` (páginas citadas en §8) y, para el comportamiento exacto de la 4.2.1,
el código instalado `node_modules/phaser/src/scale/ScaleManager.js` y `phaser.d.ts`, que mandan.

## Piezas por capa
| Capa | Pieza | Nueva/Mod. | Notas |
|---|---|---|---|
| domain | (ninguna) | — | `PlayerInput.of(x, y)` ya admite módulo ≤ 1. Ningún fichero cambia. |
| application | (ninguna) | — | Ningún fichero cambia. |
| infrastructure | `content/schemas.ts` · `MobileSchema` dentro de `ArenaSchema` | Mod. | §2. Reglas cruzadas con `maxView` en el `superRefine` de la arena. |
| infrastructure | `content/loadRunConfig.ts` · `parseContent` | Mod. | `const { maxView, mobile, ...world } = arena`; `ParsedContent.mobile: MobileDisplay`. No entra en `RunConfig`. |
| infrastructure | `url/resolveMobile.ts` · `resolveMobile(search, coarse)` | Nueva | Pura (patrón `resolveMapMode`): `{ on, warning? }`. |
| infrastructure | `phaser/ui/mobileFrame.ts` · `mobileUiScale`, `fitsAt`, `maxUiScale`, `mobileFrameRule`, `displayScale` | Nueva | Puras, sin motor (§3). |
| infrastructure | `phaser/ui/watchScreen.ts` | Mod. | Recibe una `FrameRule` (por defecto `screenFrame`) y lee `displaySize`; `apply(frame, cssPerUnit)`. |
| infrastructure | `phaser/touch/stickVector.ts` | Nueva | Función pura del vector del joystick (§4.1). |
| infrastructure | `phaser/touch/TouchJoystick.ts` | Nueva | Adaptador hermano de `KeyboardInput`, con costuras estructurales `InputLike`/`PointerLike` (sin importar el motor). |
| infrastructure | `phaser/touch/JoystickView.ts` | Nueva | Un `Graphics` y un `Text` creados una vez; se repinta solo si cambia el estado. |
| infrastructure | `phaser/touch/preferKeyboard.ts` | Nueva | Combinador `MoveSource`: el teclado manda si no es nulo. |
| infrastructure | `phaser/PauseGate.ts` | Mod. | Retención externa `hold(on, run)`, `held` y `halted` (§5). |
| infrastructure | `phaser/GameScene.ts` | Mod. | Dependencias opcionales `frameRule`, `touch` y `hold`. Sin ellas, el `update` de hoy. |
| infrastructure | `dom/TouchBar.ts` + `dom/touchIcons.ts` | Nueva | Botones ⏸ ↻ ⛶ con SVG `data:`, colas `takePause`/`takeRestart` (patrón `PausePanel`). |
| infrastructure | `dom/RotateNotice.ts` | Nueva | `<div role="alert" hidden>` con «Gira el móvil». Solo alterna `hidden`. |
| infrastructure | `dom/FullscreenControl.ts` | Nueva | Costura `FullscreenLike` (documento y `screen.orientation`). Bloqueo en `try/catch`. |
| infrastructure | `e2e/viewportProbe.ts` | Mod. | Añade `mobile`, `domScale`, `displayScale` y `hint`. `uiScale` es el k del frame activo (en escritorio, el de siempre). |
| composition | `scaleConfig.ts` | Mod. | `scaleConfig(maxView, mobile?)`. Con `mobile`, `mode: 6` (EXPAND), base `minWidth × baseHeight`. |
| composition | `contentBoot.ts` | Mod. | `BootedContent.mobile`. |
| composition | `mobileWiring.ts` | Nueva | Lo monta todo solo con el modo móvil (clase `is-mobile`, barra, aviso, pantalla completa, retención, `input.activePointers: 2`). |
| composition | `main.ts` | Mod. | Resuelve el modo una vez, elige ruta de escala y regla de frame y pone `--ui-scale` = 1 en móvil. |
| contenido/web | `content/arena.json`, `index.html`, `src/styles.css` | Mod. | §2 y §6. La CSP no cambia. |
| docs | `docs/gdd.md` | Mod. | Regla «`?e2e` solo desactiva la autodetección» (decisión 5). |

Por qué en estas capas:
- Todo es presentación o fuente de input, así que va en `infrastructure`.
- Lo que solo sabe la composición (qué ruta de escala, qué widgets existen) va en `composition`.
- No se crea ningún puerto. El joystick y el teclado son dos adaptadores de input que la escena combina; un puerto
  `MoveInput` en el dominio no tendría más consumidores que la escena. Las costuras (`InputLike`, `FullscreenLike`,
  `ScaleLike`) son tipos estructurales de infraestructura para los dobles, como `ScaleLike` u `OverlayPart` hoy.

## 1. Detección y ruta de escalado (cierra el riesgo «cambio en caliente»)
`resolveMobile(search: string, coarse: () => boolean): { on: boolean; warning?: string }`:
1. `mobile=1` → `on`. `mobile=0` → `off`. El forzado gana siempre, también con `?e2e`.
2. Cualquier otro valor, también `mobile` sin valor, `true` o `2` → exactamente 1 aviso (`console.warn`, como
   `resolveMapMode`) que menciona `mobile`, y se sigue en 3 (spec `mobile-display`, «Valor de mobile inválido»).
3. Con `e2e` → `off` (`?e2e` solo desactiva la **auto**detección).
4. Si no, `coarse()`, que la composición implementa con `window.matchMedia('(pointer: coarse)').matches`.

**Se resuelve una sola vez en `bootstrap()`**, antes de `new Phaser.Game`, igual que `resolveAdvance` y
`resolveMapMode`. No hay escucha de `change` en el `MediaQueryList`: conectar o quitar un ratón, rotar o entrar en
pantalla completa no cambian de ruta ni de controles hasta recargar. No existe una ruta de vuelta en caliente porque
el `ScaleManager` lee `mode` y la base en `parseConfig`, al construir el juego. Cambiar de ruta exigiría destruir y
recrear el `Phaser.Game`, con escenas, texturas y partida. Queda escrito en ADR-0029.

`scaleConfig(maxView, mobile?)`:
- Sin `mobile`: el objeto de hoy, idéntico (test de igualdad estricta con el de 0017).
- Con `mobile`: `{ mode: 6, width: minWidth, height: baseHeight, min: 1 × 1, max: maxView, snap: 1 × 1, autoCenter: 0 }`.
  `EXPAND_MODE = 6` es literal, como `RESIZE_MODE` (`SCALE_MODE_CONST.js`, `EXPAND: 6`).

Cómo calcula Phaser 4.2.1 el tamaño lógico (`ScaleManager.updateScale`, rama EXPAND, líneas 1088–1147), con base
B = (960, 640) y padre P:
- Si P_w/B_w < P_h/B_h (aspecto < 1,5): W = 960 y H = 960 · P_h / P_w.
- Si no: H = 640 y W = 640 · P_w / P_h.
- Es la fórmula de la spec, H = max(640, ⌈960 · P_h/P_w⌉), pero **sin `⌈ ⌉`**. La diferencia es menor que
  1 unidad, dentro del error ≤ 1 de los escenarios (800 × 600 y 1.024 × 768 dan 720 exactos). El `gameSize` puede
  ser fraccionario (844 × 390 → 1.385,03 × 640), y `screenFrame` y `CameraRig` lo redondean hacia abajo.
- Cada eje se recorta a `max` (`maxView`), y el tamaño **mostrado** se reduce en la misma proporción: el lienzo se
  queda en el tope y la rejilla de `#game` lo centra con bandas del fondo de la página, como en escritorio. Con
  2.000 × 400 el lienzo mide 2.560 × 640 mostrado a 1.600 × 400, no 3.200 × 640 (ver «Choques con las specs»). En
  vertical, 390 × 844 → 960 × 1.440 recortado, y además se ve el aviso.

No se duplica la fórmula en `src`: la única implementación es la de Phaser. Una copia sería una segunda verdad que
podría divergir, y el entorno de Vitest (`node`) no carga el motor. Los escenarios de tamaño se cubren así:
- test de `scaleConfig`: modo, base y tope;
- `followView` (pura) con la vista lógica: «Cámara con el tamaño lógico»;
- el E2E móvil recorre una tabla de ventanas con `setViewportSize` y lee la sonda de cámara. Sondea con
  `expect.poll` sobre `camera`, nunca sobre el tick, así que lo admite `logicGuard`.

`input.activePointers: 2` solo en móvil (multitoque: joystick y otro dedo; `InputManager` crea `pointersTotal`
punteros táctiles). En escritorio la config del juego no cambia.

## 2. Contenido: `arena.mobile` (zod) y su recorrido
```json
"mobile": {
  "baseHeight": 640,
  "minWidth": 960,
  "minTextPx": 12,
  "joystick": { "radiusPx": 44, "deadZone": 0.15, "zoneFraction": 0.5, "hint": "Arrastra aquí para moverte" }
}
```
- Va en `arena.json` porque sus reglas cruzadas son con `maxView`, que ya vive ahí. Además, `parseContent` ya separa
  `maxView` del núcleo: se añade `mobile` a esa misma desestructuración. Un fichero aparte obligaría a una nueva
  entrada en `RawContentFiles` y a repetir la regla cruzada fuera de su esquema.
- `MobileSchema` (`strictObject`, mensajes exportados como el resto):
  - `baseHeight`: entero, 540 ≤ x, y x ≤ `maxView.height` (en el `superRefine` de la arena).
  - `minWidth`: entero, 1 ≤ x ≤ `maxView.width` (spec). Que la vista nunca baje de 960 × 540 lo garantiza el valor
    por defecto 960, no el esquema. El 540 de `baseHeight` sale de `UI_REFERENCE.height`.
  - `minTextPx`: número > 0.
  - `joystick.radiusPx`: > 0. Va en **px CSS**, para que el dedo note el mismo radio en cualquier pantalla; equivale
    a los ~70 px lógicos del spike en el Pixel 7 Pro (44 · 640/390 ≈ 72).
  - `joystick.deadZone`: en [0, 1).
  - `joystick.zoneFraction`: en (0, 1].
  - `joystick.hint`: cadena no vacía.
- Recorrido: `parseContent` → `ParsedContent.mobile` → `BootedContent.mobile` → `main.ts`/`mobileWiring.ts`. Ni
  `RunConfig`, ni `buildRunRules`, ni la huella del contenido de combate lo ven. Las firmas y `BALANCE_BASELINE` no
  pueden cambiar.
- Coste en tests: `tests/support/builders.ts` y los fixtures crudos de arena ganan el bloque `mobile` (test-after).
  El test de «fuente única de la arena» se revisa para que acepte el nuevo campo de presentación.
- Si la spec fija otros valores (p. ej. `minTextPx`), manda la spec: solo cambia el JSON.

## 3. Escala de la UI en móvil (`mobileFrame.ts`)
Sea G el `gameSize` (lógico) y D el `displaySize` (px CSS mostrados). Entonces s = D_h / G_h son los px CSS por
unidad lógica (1 en escritorio).
Es la fórmula de la spec: k = min(k_max, max(1, k_min)).
- `k_min = minTextPx / (HUD_BASE.fontSize · s)`, **sin redondeo**. Es la k_min = m · H / (14 · P_h) de la spec,
  que pide 1,4066 ± 0,001 a 844 × 390.
- `k_max = maxUiScale(W, H)`: el mayor k con el que se cumple el predicado puro `fitsAt(W, H, k)`. Se busca por
  bisección en [1, 8] con tolerancia 1e-4. El predicado pide dos cosas:
  - las 3 cartas de `cardLayout` quedan enteras dentro del lienzo y no se solapan entre sí;
  - los 8 elementos de `hudBoxes(hudLayout(frame), HUD_RESERVE_TEXTS)` quedan enteros dentro del lienzo y no se
    solapan entre sí.
- Es la definición literal de la spec, que exige que con k_max + 0,01 algo deje de caber. Por eso **no** entran los
  paneles 9-slice del HUD (0032), que no son elementos, ni el solape carta–HUD. El layout es lineal en k con anclajes
  a los bordes, así que el predicado es monótono y la bisección vale. Sin cifras nuevas: todo sale de `HUD_BASE`,
  `CARD_*` y los textos de reserva.
- Como W ≥ 960 y H ≥ 640, k_max ≥ 1, porque a ×1 todo cabe en 960 × 540. A 844 × 390, k_max ≈ 1,80 (lo limita el
  ancho de la fila de cartas, 768 · k ≤ 1.385).
- Con s ≤ 0 o no finito (ventana a 0), k = 1, sin errores.
- Si k_min > k_max, gana «enteras» (texto bajo el mínimo). Por encima de k ≈ 1,78, los paneles 9-slice izquierdo y
  central pueden tocarse aunque los elementos no se solapen. Con el `minTextPx` 12 por defecto no pasa en ningún
  móvil horizontal habitual; se anota como riesgo.
- Ejemplos:

  | Pantalla | Lienzo lógico | k | Texto (px CSS) |
  |---|---|---|---|
  | 844 × 390 | 1.385 × 640 | 1,4066 | 12,0 |
  | 1.024 × 768 | 960 × 720 | 1 | 14,9 |
  | 1.280 × 720 con `?mobile=1` | 1.137,78 × 640 | 1 | 15,75 |

- `mobileFrameRule(minTextPx): FrameRule` devuelve `{ width: ⌊G_w⌋, height: ⌊G_h⌋, uiScale }`: el **mismo**
  `ScreenFrame`, sin campos nuevos. `hudLayout`, `cardLayout`, `veilLayout`, `UpgradeOverlay` y `NineSlicePanel` ya
  admiten k fraccionario (multiplican, y `setScale(k)` en el 9-slice). En escritorio la regla es `screenFrame` tal
  cual: «Escala del HUD por escalones» no cambia.
- `watchScreen(scale, events, apply, rule = desktopRule)`. `ScaleLike` gana `displaySize`, y `apply(frame, cssPerUnit)`
  da al joystick los px CSS por unidad (`displayScale(G, D)`). La escucha y el `off` en `SHUTDOWN` no cambian.
- Paneles DOM: en móvil `main.ts` aplica `--ui-scale` = 1 siempre (decisión 3), y no el k del HUD. En escritorio,
  `applyUiScale(root.style, screenFrame(...))` como hoy.
- Sonda `viewport`: `{ width, height, uiScale, mobile, domScale, displayScale }`.
  - `width`/`height` siguen siendo el padre en px CSS.
  - `uiScale` es el factor del HUD y las cartas: en escritorio, el entero de siempre (mismo valor y significado).
  - `domScale` es la escala DOM: 1 en móvil e igual a `uiScale` en escritorio.
  - Con esto el E2E comprueba `14 · uiScale · displayScale ≥ minTextPx`.
- La spec `world-camera` ya deja la «Sonda de cámara para E2E» como está, con una nota en su delta: no hay que
  aclararla.

## 4. Controles táctiles
### 4.1 Joystick (`TouchJoystick`, `stickVector`)
- `stickVector(origin, point, radius, deadZone): { x, y }`, pura y en **px CSS** (spec `touch-controls`):
  - d = point − origin;
  - m = clamp((|d| − z·R)/(R − z·R), 0, 1), así que m = 0 si |d| ≤ z·R y m = 1 si |d| ≥ R;
  - el vector es d/|d| · m, o (0, 0) si |d| = 0.
  - El adaptador pasa a px CSS las coordenadas lógicas de Phaser (multiplica d por `cssPerUnit`) antes de llamarla.
    Así R = `radiusPx` y los escenarios (R 60, z 0,2: (230, 250) → 0,375) se prueban tal cual.
- `TouchJoystick(input: InputLike, settings)`:
  - **Captura por evento**: se suscribe a `pointerdown` del `InputPlugin`, que recibe `(pointer, currentlyOver)`.
    Captura el puntero solo si está habilitado, si no hay otro capturado, si `currentlyOver.length === 0` (no hay
    ningún objeto interactivo debajo, como las cartas) y si `pointer.x < zoneFraction · frame.width`. El origen es
    `(pointer.x, pointer.y)`: coordenadas lógicas, que Phaser ya reescala desde el toque.
  - **Lectura por sondeo**: `read()` mira cada frame `isDown`, `x` e `y` del puntero capturado. Si ya no está
    apoyado, lo suelta y da `PlayerInput.NONE`. El sondeo hace el valor independiente del orden en que lleguen los
    eventos y del frame en que `ManualStepper.plan` lee el input.
  - `setEnabled(false)` suelta el puntero (input nulo). Un dedo que sigue apoyado no se adopta al volver a `true`:
    hace falta un `pointerdown` nuevo.
  - `relayout(frame, cssPerUnit)`: guarda `cssPerUnit` y zona = `zoneFraction · frame.width`. El centro no se
    mueve aunque el dedo salga de la zona.
- Indicación en reposo (`JoystickView`):
  - `resetHint()` al empezar cada partida (`create` y `restart` de la escena; ↻ pasa por `restart`).
  - «Primer movimiento» (spec) es el primer `PlayerInput` **no nulo** que lee la escena en esa partida, sea del
    joystick o del teclado (salida de `preferKeyboard`). La escena llama a `noteInput(input)`. Un toque en la zona
    muerta da (0, 0) y no la quita.
  - Visible si y solo si no se ha movido y la partida está en curso sin `halted` ni oferta, tienda u obra.
  - No es interactiva, así que tocarla crea el joystick.
  - Multitoque: solo se captura un puntero. Los demás (2.º dedo en el lienzo y toques en el DOM) no lo afectan.
- `preferKeyboard(keyboard, touch): MoveSource`: si `keyboard.read()` no es nulo lo devuelve; si no, `touch.read()`.
  Los dos se leen cada frame, así que la captura táctil se mantiene aunque mande el teclado.
- `JoystickView`: un `Graphics` (base y pomo) y un `Text` con `hint` en la capa del HUD, con `scrollFactor` 0 y
  creados en `create`. En reposo se ve tenue abajo a la izquierda (margen del HUD × k más el radio) y con el texto
  encima; activo, base en el origen y pomo en origen + vector · radio. Solo se repinta si cambia la clave
  (estado, origen, vector redondeado). El texto usa `HUD_BASE.fontSize · k`, que cumple el mínimo.
- Habilitado solo si `!gate.halted && status === 'running'`. Con oferta (`choosing`), tienda, obra, pausa, fin o
  retención de orientación, queda deshabilitado y suelta el puntero. En el menú no existe: `GameScene` no está activa.

### 4.2 Barra (`TouchBar`, DOM)
- `<nav class="touch-bar">` con tres `<button>` (`aria-label` «Pausa», «Reiniciar», «Pantalla completa»), cada uno
  con un `<img alt="">`. Los `src` son SVG `data:` (`touchIcons.ts`), que la CSP admite con `img-src data:`.
- La barra ofrece las colas `takePause()` y `takeRestart()`, que consumen la pulsación.
- `sync({ inRun, ended })` alterna `hidden`:
  - ⏸ se ve con `inRun && !ended`;
  - ↻ se ve con `ended`;
  - ⛶ se ve si `FullscreenControl.available`, también en el menú.
- `GameScene` lee **las dos** fuentes y luego combina: `const k = escKey.read(); const b = bar.takePause();
  esc = k || b`, y lo mismo con R y ↻. Con `||` directo se dejaría de consumir la cola de la barra, y su pulsación
  cambiaría la pausa un frame después. Así, ⏸ y Esc en el mismo frame son una sola pulsación (spec). Después van
  `ShopGate` → `BuildGate` → `PauseGate`. Así ⏸ hace exactamente lo que hace Esc, sin reglas nuevas: pausa y reanuda,
  y sale de la tienda y de la obra. ↻ hace lo que hace R, y `RestartRun` solo procede con la partida terminada.
  `leave()` llama a `sync({ inRun: false, ended: false })`.

### 4.3 Pantalla completa (`FullscreenControl`)
- `FullscreenLike` = `{ enabled, element, request(), exit(), lockLandscape?() }`. La composición lo construye con
  `document.fullscreenEnabled`, `document.documentElement.requestFullscreen`, `document.exitFullscreen` y
  `screen.orientation`.
- `lock` se detecta con `'lock' in screen.orientation`, porque los tipos de `lib.dom` no lo garantizan.
- El destino es `documentElement`, para que la barra y los paneles DOM sigan visibles.
- `available = enabled && typeof request === 'function'`. En iPhone es `false` y ⛶ no se crea visible.
- `toggle()`: si ya hay `element`, `exit()`. Si no, `await request()` y luego `lockLandscape()`. Todo va dentro de
  `try/catch` que se tragan el rechazo (best effort); nunca lanza.

## 5. Aviso de orientación como retención externa (`PauseGate`)
- `RotateNotice.setVisible(portrait)`. `portrait = parent.height > parent.width` (estricto). La composición lo
  evalúa con `scale.parentSize` al cargar y en cada `Scale.Events.RESIZE`, en la escucha `onCanvas` que ya existe.
  Phaser 4.2.1 refresca en `resize` de la ventana y en `screen.orientation` `change`. El aviso es DOM con z-index
  máximo y cubre también el menú.
- `PauseGate` añade la retención externa:
  - `hold(on, run)`: al pasar de `false` a `true` llama a `run.discardPending()`, como al pausar, para que al
    reanudar no haya ráfaga.
  - `held` es la retención; `halted` = `paused || held`.
  - `frame` y `manualFrame` usan `halted`: 0 ticks y el snapshot sin tocar.
  - `step()` **no cambia** con la retención. La spec manda que el teclado conserve sus efectos con el aviso visible:
    Esc cambia la pausa del jugador, R reinicia una partida terminada, 1–3 eligen y Esc sale de la tienda y de la
    obra. La retención solo quita ticks. Si Esc pausa una partida retenida, el `discardPending` del pausado no tiene
    efecto, porque el acumulador ya está a 0.
  - `paused` (la pausa del jugador, la que abre el overlay) solo la cambia `step()`. Volver a horizontal devuelve la
    escena al estado exacto: en pausa sigue en pausa con su overlay (que estaba debajo del aviso), y en oferta,
    tienda u obra el `status` del núcleo no se ha movido.
- La barra y las cartas no se pueden tocar con el aviso (lo cubre con z-index máximo), así que no hace falta
  descartar nada a mano.
- `GameScene` pasa `this.gate.halted` (y no `paused`) al reloj de render (`layers.advance`) y al `served` del modo
  manual: con el aviso, `step(n)` resuelve con 0 y el reloj de render no avanza. `showPause` sigue usando `paused`:
  el aviso no abre el overlay de pausa.
- La dependencia `hold?: () => boolean` solo existe en móvil. En escritorio vale `false` y el gate se comporta como
  hoy (los tests actuales de `PauseGate` no cambian).

## Flujo de un frame de `GameScene.update` (móvil)
1. `held = deps.hold?.() ?? false` y `gate.hold(held, tickRun)`.
2. Lecturas, que siempre consumen las dos fuentes antes de combinarlas:
   - `esc = escKey || ⏸`;
   - `restart = R || ↻`;
   - la elección (teclas 1–3 y clic en carta);
   - las acciones de pausa, tienda y obra.
3. `ShopGate` → `BuildGate` → `PauseGate`, como hoy y también con retención.
4. `joystick.setEnabled(!gate.halted && lastStatus === 'running')`.
5. Input: `preferKeyboard(keyboard, joystick).read()` y `joystickView.noteInput(input)`. En modo manual lo lee
   `ManualStepper.plan` en el primer frame de la petición.
6. `gate.frame` o `gate.manualFrame` (0 ticks con `halted`), render, `JoystickView.sync`,
   `bar.sync({ inRun: true, ended: status === 'over' })` y `showPause(gate.paused)`.

Sin modo móvil, los pasos 1, 4 y 6 (vista y barra) no existen y `preferKeyboard` es solo el teclado: el `update` hace
las mismas llamadas que hoy.

## 6. `index.html` y CSS (CSP intacta)
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1,
  user-scalable=no">`. Los navegadores de escritorio lo ignoran. La meta CSP no cambia (`csp.test.ts`).
- La composición pone `document.documentElement.classList.toggle('is-mobile', on)` (CSSOM). Todas las reglas nuevas
  van bajo `.is-mobile`, así que en escritorio la cascada es idéntica:
  - `html.is-mobile, .is-mobile body`: `height: 100dvh`, `overscroll-behavior: none`, `touch-action: none`,
    `user-select: none` (también `-webkit-`) y `-webkit-touch-callout: none`.
  - `.is-mobile body`: `box-sizing: border-box` y `padding: env(safe-area-inset-top) … env(safe-area-inset-left)`.
    `#game` (100 % del contenido) queda dentro de la zona segura. `getParentBounds` mide el `#game`, así que lienzo y
    HUD quedan fuera de la muesca. No se pone `padding` en `#game`, porque `getBoundingClientRect` lo incluiría.
  - Paneles (`.menu-panel` … `.build-panel`, `.guide-modal`, `.results-panel`): `max-height: calc(100dvh - 2em)`,
    `overflow-y: auto` y `touch-action: pan-y` (vuelven a desplazarse dentro).
  - Botones de paneles y barra: `min-width` y `min-height` de 44 px, y `touch-action: manipulation`.
  - La barra no tapa los paneles: en móvil, el `max-width` de cada panel se acota a
    `100vw − 2 × (reserva de la barra)`, con reserva = 3 × 44 + huecos + 12 px + `safe-area-inset-right`, en una
    variable CSS. Así ningún panel centrado llega a la columna de la barra. Las cartas acaban a ≈ 268 px CSS del borde
    superior a 844 × 390, por encima de la barra (≥ 313 px).
  - `.touch-bar`: `position: fixed`, abajo a la derecha a `env(safe-area-inset-*) + 12px`, `z-index: 4`.
  - `.rotate-notice`: `position: fixed; inset: 0; z-index: 5`, centrado.
- Phaser escribe `canvas.style.width/height` por CSSOM en EXPAND, algo que `style-src 'self'` permite (ya pasaba en
  el spike). Ojo: también en escritorio Phaser escribe hoy por CSSOM en el `<canvas>` (`TouchAction.js`,
  `UserSelect.js` y `marginLeft/Top` en `updateCenter`). El canvas ya tiene un atributo `style` en el DOM, y eso no es
  una violación de CSP. Nuestro código no escribe `style=""` ni `el.style` en ningún elemento propio: solo clases y
  `setProperty` en `#game`, como hoy.

## 7. E2E (cierra el riesgo del arrastre) y dobles
**Dos E2E nuevos** en `tests/e2e/gameplay.spec.ts` (proyecto `logic`, modo manual, sin umbrales de fps). Ningún test
actual cambia, como pide el criterio de éxito de la propuesta.

**E2E 1 · «Móvil táctil»**: `test.describe` con `test.use({ hasTouch: true, viewport: { width: 844, height: 390 } })`
y la URL `gameUrl` + `manual&mobile=1&seed=42` (`map=empty` por defecto). Pasos:
1. La sonda da `mobile === true`, `domScale` 1, `uiScale` ≈ 1,4066, cámara ≈ 1.385 × 640 y
   `14 · uiScale · displayScale ≥ 12`. La indicación en reposo es visible: la sonda `viewport` añade `hint: boolean`,
   y la escena se lo pasa como `hudView`.
2. Arrastre con `cdp = await page.context().newCDPSession(page)` (ya se usa en `fixtures.ts`):
   - `Input.dispatchTouchEvent` `touchStart` en (200, 250) px CSS;
   - `touchMove` a (300, 250);
   - **sin** `touchEnd`, `await __sprint.step(60)`. El dedo sigue apoyado durante toda la llamada, y el sondeo del
     joystick da el vector en el primer frame de la petición;
   - `touchEnd`.
   - Comprueba: devuelve 60, x > x0, y = y0, la indicación ya no se ve, `scrollX`/`scrollY` 0 y
     `visualViewport.scale` 1.
   - CDP se usa porque `page.touchscreen` solo tiene `tap`. Los eventos llegan como `TouchEvent` reales al
     `TouchManager` de Phaser.
3. `locator('.touch-bar [aria-label=Pausa]').tap()`: la pausa es visible. Cada botón visible de la pausa y de la
   barra mide ≥ 44 × 44 (`boundingBox`), y `tap()` en `Reanudar` llega al botón.
4. `setViewportSize(390 × 844)`: con `toBeVisible()` (sin reloj), `step(60)` devuelve 0 y el tick no cambia. Vuelta a
   844 × 390: el aviso ya no se ve y `step(60)` devuelve 60.
5. Tabla de ventanas con `setViewportSize` y `expect.poll` sobre `camera` (no sobre el tick):
   - 915 × 412 → 1.421,36 × 640;
   - 1.024 × 768 y 800 × 600 → 960 × 720;
   - 960 × 640 → 960 × 640;
   - 640 × 360 → ≥ 960 × 540;
   - 2.000 × 400 → vista 2.560 × 640.
6. Durante todo el test, una escucha `securitypolicyviolation` registrada con `addInitScript` cuenta 0 violaciones.

**E2E 2 · «Escritorio sin controles táctiles»** (`?e2e&manual&seed=42` a 600 × 900, puntero fino): `mobile === false`;
`.touch-bar`, `.rotate-notice` y la indicación tienen 0 nodos o `hint === false`; `step(60)` devuelve 60.

Sin `waitForTimeout`, sin `expect.poll` sobre el tick y sin fps, así que cumple `logicGuard`.

Dobles para los unitarios (test-after, infraestructura):

| Pieza | Doble |
|---|---|
| `resolveMobile` | `coarse` como función `() => boolean` (doble de `matchMedia`) |
| `TouchJoystick` | `FakeInput` (`on`/`off` y `emitDown(pointer, over)`) y `FakePointer` (`{ id, isDown, x, y }` mutable) |
| `JoystickView` | dobles de `Graphics`/`Text` de `tests/support/feedback.ts` |
| `TouchBar`, `RotateNotice` | `tests/support/fakeDom.ts` |
| `FullscreenControl` | `FakeFullscreen` con `request`/`lock` que resuelven o rechazan |
| `watchScreen` | `ScaleLike` con `displaySize` |

`PauseGate` (retención) se prueba con el doble de `TickRun` de sus tests actuales y con `advanceFrame` para los
escenarios de tiempo (frames de 16,667 / 5.000 / 8,334 ms).
`mobileUiScale`/`maxUiScale` se prueban con los valores de la spec:
- 1,4066 a 844 × 390;
- 1 a 1.024 × 768 y a 1.280 × 720 con modo móvil;
- k_max ajustado con texto 20 (k_max + 0,01 ya no cabe);
- la tabla de ventanas de «HUD entero en móvil».

Las reglas `.is-mobile` (44 px, `overflow-y`, `max-width` con la reserva de la barra, safe areas) se comprueban con
`tests/support/css.ts`. El desplazamiento real y las medidas en el navegador las cubre el paso 3 del E2E 1.

Determinismo («Misma partida con y sin modo móvil»): un test de composición comprueba que `parseContent` da la misma
`RunConfig` con cualquier `arena.mobile`. Además ejecuta 3.600 ticks con la semilla 7 y una secuencia de inputs de
módulos 0, 0,375 y 1. El núcleo no sabe del modo, así que basta con una partida y la igualdad de `RunConfig`.

## Dependencias nuevas
| Paquete | Versión exacta | Motivo | Alternativa descartada |
|---|---|---|---|
| (ninguna) | — | EXPAND, multitoque y `currentlyOver` vienen en Phaser 4.2.1; Fullscreen y Screen Orientation son APIs del navegador | `phaser3-rex-plugins` (joystick virtual): dependencia grande, no tipada para Phaser 4 y sin necesidad |

## Rendimiento y seguridad
- **Presupuesto**: el núcleo no cambia (0 ms/tick añadidos).
  - Por frame en móvil: un `stickVector`, una comparación de clave y, solo si cambia, un `clear` y dos círculos en un
    `Graphics` (< 0,05 ms). Ningún objeto del motor por frame. Los widgets táctiles se crean en `create`.
  - El lienzo lógico ≈ 1.385 × 640 (0,89 Mpx) cuesta menos que el 1.280 × 720 del gate (0,92 Mpx).
  - Bundle: unos 4–6 KB sin comprimir (SVG en línea y adaptadores).
  - dpr > 1: lienzo blando aceptado (decisión 10). Los fps con la horda llena se miden en verify por USB, fuera del
    gate.
- **Datos persistidos**: ninguno nuevo.
- **Entradas externas**: `?mobile` se valida con una lista cerrada (`1`, `0`); cualquier otro valor da 1 aviso.
  `arena.mobile` pasa por zod. Los toques llegan como coordenadas del motor y solo producen un `PlayerInput` acotado
  por `PlayerInput.of`.
- **CSP**: sin cambios. Iconos `data:` en `<img>` y CSSOM; ningún `style=""` ni script en línea.

## 8. API de Phaser consultada
Por el MCP `phaser-docs`, contrastado con los tipos y el código de 4.2.1 instalados (mandan):
- `https://phaser.io/oss/docs/api-documentation/namespace/scale.md#expand-number` (EXPAND = 6).
- `https://phaser.io/oss/docs/api-documentation/class/scale-scalemanager.md` (`displaySize`, `parentSize`,
  `fullscreenTarget`, `resize`).
- `https://phaser.io/oss/docs/api-documentation/event/input-events.md#pointer_down` (`currentlyOver`).
- `https://phaser.io/oss/docs/api-documentation/class/input-inputplugin.md` (`addPointer`).
- Código 4.2.1:
  - `ScaleManager.js`: `updateScale` EXPAND (1088–1147), `refresh` → `RESIZE(gameSize, baseSize, displaySize)` (993),
    `getParentBounds` con `getBoundingClientRect` incluido el padding (658–702) y escuchas de `resize` y de
    `orientation change` (1526–1559).
  - `SCALE_MODE_CONST.js` (`EXPAND: 6`), `InputManager.js` (`pointersTotal = inputActivePointers`),
    `TouchManager.js` (escuchas `touchstart`/`touchmove`), `phaser.d.ts` (`input.activePointers?: number`).
- Nota: en 4.2.1, `windowResize` llama a `refresh()` de forma síncrona además de en `PRE_STEP`, así que RESIZE puede
  llegar fuera del paso. Es inocuo: `watchScreen` y `onCanvas` son idempotentes.

## Contraste con las specs delta (posterior al primer borrador)
Corregido en este design para alinearlo con las specs:
- `?mobile` vacío pasa a ser inválido (1 aviso y reglas normales).
- Módulo del joystick: m = clamp((|d| − zR)/(R − zR), 0, 1), en px CSS.
- k: sin redondeo de k_min. k_max es el ajustado de la spec (cartas y 8 elementos del HUD, sin los paneles 9-slice),
  calculado por bisección.
- El teclado conserva Esc, R y 1–3 con el aviso visible. Se quita `maskHeld`: la retención solo quita ticks.
- ⏸ y Esc se leen los dos antes de combinarlos (una sola pulsación).
- «Primer movimiento»: el primer input no nulo de la partida, de joystick o de teclado.
- Sonda: nuevos campos `domScale` y `hint`.
- Dos E2E nuevos (móvil y escritorio a 600 × 900) en lugar de ampliar un test de humo, porque la propuesta dice que
  ningún test actual cambia.

Choques que este design **no** puede cumplir tal como están escritos; se piden al spec-writer:
1. `mobile-display`, «Aspecto muy alargado con tope»: dice que el lienzo mide 3.200 × 640. Phaser 4.2.1 EXPAND
   recorta el lienzo al tope (2.560 × 640, mostrado a 1.600 × 400 y centrado con bandas de página), como en
   escritorio. Propuesta: «la vista mide 2.560 × 640 y ningún píxel de la **ventana** fuera de la vista muestra mundo».
   Igual en el texto del requisito («espacio del lienzo» → «espacio de la ventana»).
2. `mobile-display`, «Sin estilos inline»: Phaser ya escribe hoy por CSSOM en el `<canvas>`, también en escritorio
   (`touch-action`, `user-select`, márgenes y, con EXPAND, `width`/`height`). Ese elemento tiene atributo `style`
   aunque la CSP no se viole. Propuesta: «ningún elemento salvo el lienzo del motor tiene atributo `style`, y no se
   registra ninguna violación de CSP».

Huecos sin choque (decisión del design, sin cambiar specs):
- El texto «Pulsa R para jugar otra vez» de resultados no cambia en móvil (`run-results` no se toca). En móvil el
  reinicio es con ↻, que solo se ve con la partida terminada. Si se quiere otro texto, hace falta un delta de
  `run-results` (candidato fuera de este change).
- Criterios de éxito de la propuesta frente a specs: coinciden. La propuesta pide «x aumenta», y la spec además
  `step` = 60 e y = y0, que el E2E 1 comprueba. Escritorio sin controles táctiles va en el E2E 2.

## Riesgos que quedan
- **Texto < mínimo** en pantallas muy bajas, y paneles 9-slice que se tocan si k > ~1,78: gana «enteras». Se anota
  en verify.
- **CDP táctil en headless**: si `Input.dispatchTouchEvent` no llegara al `TouchManager`, la alternativa es despachar
  `TouchEvent` sintéticos sobre el `canvas` con `page.evaluate`, sin más E2E.
- **Escenarios de spec sin E2E** (multitoque con cartas, ⛶ real, safe areas de 47/21 px, paneles desplazados uno a
  uno): se cubren con unitarios con dobles y reglas CSS. El navegador solo se prueba en los dos E2E.
- **iOS no verificado**: `100dvh`, safe areas y la ausencia de la Fullscreen API.

## ADRs
- `docs/adr/0029-escalado-expand-solo-en-movil-elegido-al-cargar.md`
