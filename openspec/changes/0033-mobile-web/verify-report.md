# Verify report · 0033-mobile-web

Resultado: `npm run verify` verde (345 ficheros, 4.109 tests). `npm run test:e2e` verde (19 tests del proyecto `logic`, 32,6 s).
Dominio y aplicación sin cambios (`git diff` no los toca). Tareas 3.1–7.2 marcadas y 5 commits de apply (grupos A–E), uno por grupo (ADR-0018).
E2E nuevos: 2 (móvil táctil; escritorio sin controles táctiles), en manual, sin fps ni reloj (`logicGuard` en verde).

## Escenario → Test → Estado

| Bloque de escenarios | Test | Estado |
|---|---|---|
| MD activación (6) | `resolve-mobile.test.ts` | OK |
| MD contenido validado (6) | `content.test.ts`, `content-boot.test.ts` | OK |
| MD tamaño lógico (7) | `scale-config.test.ts`, `watch-screen.test.ts`, `camera-rig.test.ts`, E2E móvil | OK |
| MD escala UI (6) | `mobile-frame.test.ts`, `upgrade-overlay.test.ts`, `watch-screen.test.ts` | OK |
| MD paneles DOM (3) | `mobile-css.test.ts` | OK |
| MD documento táctil: arrastre sin desplazar, meta viewport | E2E móvil, `csp.test.ts`, `mobile-css.test.ts` | OK |
| MD "Sin estilos inline" | `mobile-wiring.test.ts` (2 tests) + E2E móvil (solo `#game`) | Parcial (W2) |
| MD sonda (2), escritorio sin cambios, misma partida | `viewport-probe.test.ts`, `mobile-wiring.test.ts`, E2E escritorio, `mobile-determinism.test.ts` | OK |
| TC joystick, bloqueo, multitoque, precedencia, indicación (≈20) | `touch-joystick.test.ts`, `joystick-view.test.ts`, `game-scene-touch.test.ts`; "Arrastre que mueve" en E2E | OK |
| TC barra, pantalla completa (≈11) | `touch-bar.test.ts`, `fullscreen-control.test.ts`, `mobile-css.test.ts`, `pause-gate.test.ts`, `shop-gate`/`build-gate.test.ts` | OK |
| TC aviso de orientación (8) | `rotate-notice.test.ts`, `pause-gate.test.ts`, `game-scene-touch.test.ts`; "Aviso que detiene step" en E2E | OK |
| HUD fraccionario y misma ventana (2) | `mobile-frame.test.ts`, `watch-screen.test.ts` | OK |
| WC misma ventana y dpr 3 (2) | `scale-config.test.ts`, `camera-rig.test.ts` | OK |
| SL sobrante descartado y step con aviso (2) | `pause-gate.test.ts`, E2E móvil | OK |
| Escenarios copiados de changes previos (MODIFIED) | Tests previos de 0017/0014 | OK, sin cambios |

## Desviaciones declaradas

1. Tests existentes modificados (`smoke.spec`, `gameplay.spec`, `viewport-probe.test.ts`): **no requiere delta de spec**. La spec "Sonda en escritorio" exige los campos nuevos (`mobile`, `domScale`, `displayScale`, `hint`), así que esos `toEqual` debían ampliarse. Los cambios son mecánicos, mantienen la intención (`DESKTOP_VIEWPORT_EXTRA`) y no debilitan nada. Lo incorrecto es el texto de `tasks.md` 7.1 y del design ("Ningún test actual cambia"): corregirlo (S1).
2. `#game` con `style` de variables `--*`: **requiere delta de spec**. La spec dice "ningún elemento salvo el lienzo del motor tiene atributo `style`", y eso es falso desde 0017/0032. El E2E lo acepta, y es lo correcto técnicamente (CSSOM, sin violación de CSP). El texto debe pasar a "salvo el lienzo y `#game`, solo con propiedades `--*`" (W1).

## Hallazgos

**Critical (0)**: ninguno.

**Warning (2)**
- W1: la spec `mobile-display` "Sin estilos inline" no refleja `#game` con variables `--*`. Hay que ajustar el requisito y el escenario (delta de spec) antes de archivar. Hoy el test y la spec discrepan.
- W2: el E2E de "Sin estilos inline" comprueba `[style]` una sola vez, en la partida móvil tras el redimensionado. El escenario pide recorrer menú, pausa, aviso y resultados, y repetirlo en escritorio. Lo cubren en parte los tests unitarios de `mobile-wiring.test.ts` (código sin estilos), pero ningún test recorre esas pantallas en navegador. Ampliar el E2E existente o registrar la limitación.

**Suggestion (2)**
- S1: corregir `tasks.md` 7.1 y design ("ningún test actual cambia") para reflejar la ampliación de sondas.
- S2: el diario `docs/ai-log/2026-11-26-0033-mobile-web.md` ya recoge ambas desviaciones. Añadir el veredicto de este verify (delta de spec solo para la 2).

C: 0 · W: 2 · S: 2

## Re-verify (c937228 E2E, b5a1352 spec/design/tasks/diario)

- W1 resuelto: el requisito "Documento táctil" y el escenario "Sin estilos inline" exceptúan ahora el lienzo y `#game` (solo propiedades `--*`), igual que el E2E.
- W2 resuelto: `expectNoInlineStyles` se ejecuta en partida, pausa, aviso, redimensionado, resultados y menú en móvil, y en partida, pausa, resultados y menú en escritorio (con CSP vigilada). Sigue habiendo 2 E2E nuevos, en manual, sin fps.
- S1 y S2 resueltos: `tasks.md`, design y diario actualizados.
- `npm run test:e2e` tras c937228: 19 passed (35,8 s). `verify` no repetido (en verde según el coordinador; el diff solo toca E2E y documentos).

Recuento final: C: 0 · W: 0 · S: 0
