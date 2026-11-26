# Tasks · 0033-mobile-web

<!-- Sin núcleo: `src/domain` y `src/application` no cambian (design, ADR-0029). Todas las tareas son de
     infraestructura, composición, contenido o docs: test-after (ADR-0018), sin rojo obligatorio. Cada tarea cierra
     con `npm run verify:fast`; cada grupo es una unidad de commit con `npm run verify` completo en verde (seis
     firmas, `BALANCE_BASELINE` 34/50, `BUILDER_REFERENCE` 34/50, 0 quietos, 820/904 objetos del mapa). Specs:
     MD = mobile-display, TC = touch-controls, WC = world-camera, HUD = hud, SL = simulation-loop. -->

## 1. Dominio
- (sin tareas: el change no toca `src/domain`)

## 2. Aplicación
- (sin tareas: el change no toca `src/application`)

## 3. Infraestructura: contenido y detección (grupo A, un commit)
- [x] 3.1 `arena.mobile` en `content/arena.json`, `MobileSchema` dentro de `ArenaSchema` (reglas cruzadas con
  `maxView`, mensajes exportados), `parseContent` → `ParsedContent.mobile` y `BootedContent.mobile`. Además, el bloque
  en `tests/support/builders.ts` y en los fixtures de arena.
  - Escenarios MD: "Contenido por defecto", "Alto base fuera de rango", "Alto base en los límites", "Joystick
    inválido", "Zona muerta y fracción en sus límites válidos", "Ancho mínimo inválido" y "Misma partida con y sin
    modo móvil" (igualdad de `RunConfig` y 3.600 ticks con semilla 7 e inputs de módulo 0, 0,375 y 1).
  - Tests: `tests/infrastructure/content.test.ts`, `tests/composition/content-boot.test.ts` y
    `tests/composition/mobile-determinism.test.ts`.
- [x] 3.2 `src/infrastructure/url/resolveMobile.ts`: `?mobile=1|0` gana; cualquier otro valor (también vacío) da
  1 aviso; `?e2e` apaga la autodetección; si no, `pointer: coarse`, leído **una vez** de un `{ matches }`.
  - Escenarios MD: "Puntero grueso sin parámetros", "Puntero fino sin parámetros", "Forzado por URL", "E2E desactiva
    solo la autodetección", "Valor de mobile inválido" y "Cambio del puntero tras la carga" (el doble cambia `matches`
    después y el modo no cambia).
  - Test: `tests/infrastructure/resolve-mobile.test.ts`.

## 4. Infraestructura: escala y vista (grupo B, un commit)
- [x] 4.1 `src/infrastructure/phaser/ui/mobileFrame.ts`: `displayScale`, `fitsAt`, `maxUiScale` (bisección),
  `mobileUiScale` = min(k_max, max(1, k_min)) sin redondeo, k = 1 si s ≤ 0, y `mobileFrameRule`. Incluye la prueba
  de cartas con k fraccionario en `UpgradeOverlay`.
  - Escenarios MD: "Texto mínimo en un móvil horizontal", "Pantalla grande con factor 1", "Texto mínimo
    inalcanzable", "HUD entero en móvil" y "Toque en una carta escalada" (clic en la tercera carta → índice 2).
  - Escenarios HUD: "Factor fraccionario en modo móvil" y "El mismo tamaño de ventana con y sin modo móvil".
  - Tests: `tests/infrastructure/mobile-frame.test.ts` y `tests/infrastructure/upgrade-overlay.test.ts` (ampliado).
- [x] 4.2 `watchScreen` con `FrameRule` y `displaySize` (`apply(frame, cssPerUnit)`); `scaleConfig(maxView, mobile?)`
  con la rama EXPAND (modo 6, base `minWidth × baseHeight`, tope) y la de escritorio idéntica; `viewportProbe` con
  `mobile`, `domScale`, `displayScale` y `hint`; `followView` con la vista lógica.
  - Escenarios MD: "Cámara con el tamaño lógico", "Factor al redimensionar", "Redimensionado en móvil" (parte de
    relayout), "Ventana a cero en móvil" (sin errores, k = 1), "Sonda en móvil" y "Sonda en escritorio" (forma de la
    sonda).
  - Escenarios WC: "Misma ventana con y sin modo móvil" (config) y "Modo móvil con densidad de píxeles 3" (la config
    no depende del dpr).
  - Tests: `tests/infrastructure/watch-screen.test.ts`, `tests/composition/scale-config.test.ts`,
    `tests/infrastructure/viewport-probe.test.ts` y `tests/infrastructure/camera-rig.test.ts` (ampliados).

## 5. Infraestructura: controles táctiles y retención (grupo C, un commit)
- [x] 5.1 Joystick:
  - `phaser/touch/stickVector.ts` (px CSS, m = clamp((|d| − zR)/(R − zR), 0, 1));
  - `TouchJoystick` (captura en `pointerdown` sin `currentlyOver` y dentro de la zona; sondeo de `isDown`/`x`/`y`;
    un solo puntero; `setEnabled`);
  - `preferKeyboard`;
  - `JoystickView` (indicación en reposo, `noteInput`, `resetHint` y repintado solo al cambiar).
  - Escenarios TC:
    - "Vector a media distancia", "Vector en diagonal", "Zona muerta y su borde", "Saturación en el radio y más
      allá", "El dedo cruza la mitad del lienzo", "Toque fuera de la zona de arrastre", "Soltar para el jugador",
      "Toque cancelado";
    - "Toque en una carta de la zona de arrastre", "Pantallas que bloquean el joystick", "Oferta con el joystick
      activo", "Reanudar con el dedo apoyado", "Segundo dedo en la zona de arrastre", "Joystick activo al girar";
    - "Teclado y joystick a la vez", "Teclado solo";
    - "Indicación al empezar", "Desaparece con el primer movimiento", "Toque en la zona muerta no la quita", "Vuelve
      en cada partida nueva".
  - Tests: `tests/infrastructure/touch-joystick.test.ts` y `tests/infrastructure/joystick-view.test.ts` (dobles
    `FakeInput`/`FakePointer` y los de `tests/support/feedback.ts`).
- [x] 5.2 `dom/TouchBar.ts` + `dom/touchIcons.ts` (SVG `data:`, colas, `sync({ inRun, ended })`) y
  `dom/FullscreenControl.ts` (costura `FullscreenLike`, alternar, bloqueo en `try/catch`). Lectura combinada «las dos
  fuentes y luego OR» en una función pura (`pressedOnce`).
  - Escenarios TC: "Barra en el menú", "Reiniciar con ↻" (visibilidad y cola), "⏸ y Esc en el mismo frame",
    "Entrar en pantalla completa", "Bloqueo rechazado o ausente", "Pantalla completa rechazada" y "Salir de pantalla
    completa".
  - Tests: `tests/infrastructure/touch-bar.test.ts` (con `tests/support/fakeDom.ts`) y
    `tests/infrastructure/fullscreen-control.test.ts`.
- [x] 5.3 Retención externa en `PauseGate` (`hold`, `held`, `halted`; `step` sin cambios; `discardPending` al
  empezar la retención), `dom/RotateNotice.ts` y `isPortrait` (estricto). `GameScene` gana las dependencias opcionales
  `frameRule`, `touch` y `hold`:
  - lecturas combinadas de Esc/⏸ y R/↻;
  - `setEnabled`, `noteInput` y `bar.sync`;
  - `halted` en el reloj de render y en `served`;
  - sin las dependencias, el `update` de hoy.
  - Escenarios SL: "Sobrante descartado con el aviso de orientación" y "Step con el aviso de orientación" (parte de
    `manualFrame`).
  - Escenarios TC: "Girar en mitad de la partida", "Girar con la partida en pausa", "Girar con la oferta, la tienda o
    la obra abiertas", "Esc con el aviso visible", "Ventana cuadrada", "Aviso en el menú" (el aviso no toca el estado
    del menú), "Pausar y reanudar con ⏸", "⏸ en la tienda y en la obra", "⏸ eligiendo mejora" y "Pausar sin soltar el
    joystick".
  - Tests: `tests/infrastructure/pause-gate.test.ts` (ampliado, con `advanceFrame`), `rotate-notice.test.ts` y
    `shop-gate.test.ts`/`build-gate.test.ts` (ampliados con ⏸ como fuente de Esc).

## 6. Composición y web (grupo D, un commit)
- [x] 6.1 `src/composition/mobileWiring.ts` y `main.ts`:
  - el modo se resuelve una vez; clase `is-mobile`;
  - EXPAND y `input.activePointers: 2` solo en móvil;
  - `--ui-scale` = 1 en móvil;
  - barra, aviso, pantalla completa y `hold` solo en móvil;
  - orientación en `onCanvas`.
  - Además, `index.html` (meta viewport con `viewport-fit=cover` y sin zoom; CSP intacta) y `src/styles.css` (reglas
    bajo `.is-mobile`: `100dvh`, `touch-action`, `overscroll-behavior`, `user-select`, safe areas en `body`, paneles
    desplazables con `max-width` acotado por la reserva de la barra, 44 px, barra y aviso).
  - Escenarios MD: "Escala DOM sin crecer en pantallas grandes", "Paneles en un móvil horizontal" y "Botones
    operativos tras desplazar" (reglas CSS), "Meta viewport", "Sin estilos inline" (CSP y ningún `style` propio) y
    "Arrastre sin desplazar la página" (reglas).
  - Escenarios TC: "Tamaño y zonas seguras" y "La barra no tapa los paneles" (reglas).
  - Tests: `tests/guardrails/csp.test.ts` (ampliado: meta viewport), `tests/infrastructure/mobile-css.test.ts` (con
    `tests/support/css.ts`) y `tests/composition/mobile-wiring.test.ts` (sin modo móvil no crea nodos táctiles).

## 7. E2E y documentación (grupo E, un commit)
- [ ] 7.1 Dos E2E nuevos en `tests/e2e/gameplay.spec.ts` (proyecto `logic`, `?e2e&manual`, sin fps ni reloj;
  `logicGuard` en verde). Ningún test actual cambia.
  - **Móvil táctil** (`hasTouch`, 844 × 390, `mobile=1&seed=42`):
    - sonda;
    - arrastre CDP `Input.dispatchTouchEvent` mantenido durante `step(60)`;
    - indicación oculta;
    - documento sin desplazar;
    - ⏸ → pausa con botones ≥ 44 → `Reanudar`;
    - vertical con `step(60)` = 0 y vuelta con `step(60)` = 60;
    - tabla de ventanas con `expect.poll` sobre `camera`;
    - 0 violaciones de CSP.
  - **Escritorio sin controles táctiles** (600 × 900, sin `mobile`): `mobile` falso, sin barra, aviso ni indicación,
    y `step(60)` = 60.
  - Escenarios MD: "Sonda en móvil", "Sonda en escritorio", "Móvil en horizontal", "Tablet 4:3", "Aspecto 1,5
    exacto", "Aspecto muy alargado con tope" (vista 2.560 × 640, según la corrección pedida a la spec), "Nunca menos
    mundo que el mínimo de escritorio", "Redimensionado en móvil", "Arrastre sin desplazar la página", "Sin estilos
    inline" y "Sin controles táctiles en escritorio".
  - Escenarios TC: "Arrastre que mueve al jugador [E2E]" y "Aviso que detiene step [E2E]".
  - Escenario SL: "Step con el aviso de orientación".
- [ ] 7.2 Docs:
  - `docs/gdd.md`: «`?e2e` nunca activa el modo móvil» pasa a «`?e2e` solo desactiva la autodetección; `?e2e&mobile=1`
    lo activa».
  - Línea de estado del change 0033 en `AGENTS.md` §1 (EXPAND solo en móvil, ADR-0029, `arena.mobile`, joystick,
    barra, aviso como retención, sondas `viewport.mobile`/`domScale`/`displayScale`/`hint`, 2 E2E nuevos, balance y
    firmas intactos).
  - ADR-0029 en estado aceptada al archivar.
  - Sin test (documentación).
