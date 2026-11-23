# Verify report · 0017-fullscreen-view

Commit verificado: `e7acfb0f110436c4c80a7356bb4493a1b910aa6d` (rama `change/0017-fullscreen-view`, 24 commits sobre `origin/main`).

## Resultados de ejecución
- `npm run verify`: verde (lint, typecheck, guard 710 ficheros, vitest 170 ficheros / 1.925 tests).
- `npm run test:e2e` (proyecto `logic`): 13/13 verdes.
- `tasks.md`: 22/22 marcadas; 24 commits con `refs: 0017-fullscreen-view` y `Assisted-by`.

## Escenarios -> Test -> Estado
Verificación por muestreo dirigido a los puntos pedidos; el resto de escenarios del change se apoyan en los tests nuevos o ampliados del diff (`tests/domain`, `tests/infrastructure`, `tests/e2e`).

| Escenario (spec) | Test | Estado |
|---|---|---|
| Núcleo sin vista (`View` eliminado; `RunRules` sin `view`) | `tests/infrastructure/content.test.ts`, `tests/domain/spawn-rules.test.ts`; `View.ts` y `view.test.ts` borrados; sin `View` en `src/domain`/`src/application` | Cubierto |
| Radio del anillo por defecto / fuera de rango / en el límite / margen heredado | `content.test.ts` (1.468 y 1.468,6 error; 1.468,61 ok); `content/waves.json` 1.500 > hypot(2560,1440)/2 = 1.468,6 | Cubierto |
| Mismas apariciones con cualquier ventana | `spawn-rules.test.ts`, `run-spawning.test.ts` | Cubierto |
| Mundo estrecho/bajo/igual al tope, `view` heredado | `content.test.ts` | Cubierto |
| Rejilla 64 x 36, castillo 30–34 x 15–18, salida (1.950, 1.170), firma de semilla 42 | `tests/domain/map/*`, `tests/support/mapGolden.ts`, `gameplay.spec` "Mapa real" | Cubierto |
| HUD anclado, escala por escalones, monotonía, cambio de escalón | `ui-layout.test.ts`, `screen-frame.test.ts`, `apply-ui-scale.test.ts`, `hud.test.ts` | Cubierto |
| Menú/pausa centrados, diálogo abierto al redimensionar | `watch-screen.test.ts`, `smoke.spec`, `gameplay.spec` | Cubierto |
| Oferta abierta al redimensionar (1.000 x 600, mismo tick, clic central) | `gameplay.spec` "Redimensionado con la oferta abierta", `upgrade-overlay.test.ts`, `card-layout.test.ts` | Cubierto |
| Cámara sigue al jugador y recortada al mundo con vista variable | `camera-rig.test.ts`, `gameplay.spec` "Cámara" | Cubierto |
| Sonda `viewport` | `viewport-probe.test.ts`, `smoke.spec` | Cubierto |
| Tabla de oleadas no decreciente (1,2/2,4/2,4/3,0/4,2) | `content.test.ts` / `balance.test` | Cubierto |
| Tasa de victoria 25–35, quieto pierde con 1..50 (ambos mapas), primera oferta <= 4.800 | `balance.test`, `tests/support/balanceMeasure.ts` (medidas en tasks 2.1: 25/50, 0/0, tick 1.527) | Cubierto |
| Tope de objetos del mapa 1.000 (semillas 42 y 123) | `plan-map-fallback.test.ts` | Cubierto |
| Limpieza de `resize` al cambiar de escena | `watch-screen.test.ts`; `watchScreen.ts` quita la escucha en `shutdown`; `GameScene`/`MenuScene` usan `once(SHUTDOWN)` | Cubierto |

## Contraste con el design
- Capas y pureza: sin `Math.random`/`Date.now`/`window`/`document` en `domain`/`application`; la vista solo existe en infraestructura y composición. Conforme con AGENTS §3.
- Contenido: mundo, tope y anillo solo en `content/*.json`, validados con zod. Hay test guardarraíl de fuente única (`single-arena-source.test.ts`).
- Desviación `parseContent` que separa `{config, maxView}`: coherente con D2 (el núcleo no recibe el tope). Aceptada.
- Desviación del título en el h1 de `MenuPanel`: sin impacto en arquitectura. Aceptada.
- Literales de Phaser comprobados contra `node_modules/phaser` 4.2.1: `RESIZE = 5` (`SCALE_MODE_CONST.js`), `NO_CENTER = 0` (`CENTER_CONST.js`), evento `'resize'` (`RESIZE_EVENT.js`) y `'shutdown'` (`SHUTDOWN_EVENT.js`). Correctos.
- La escucha de `scale.on(RESIZE)` de `main.ts` es del juego entero y vive lo mismo que él; no es una fuga.

## Hallazgos

### Critical
Ninguno.

### Warning
- W1 · Balance en el límite inferior de la banda: **25/50** victorias (banda 25–35). Cualquier cambio futuro en `maxBudget`, la tabla o el bot rompe el gate. Registrado en design D9; la fragilidad es conocida y la tabla se obtuvo en la 2.ª ronda de calibración.
- W2 · `tests/e2e/realtime.spec.ts:63` mantiene `MAX_MAP_OBJECTS = 300`, mientras el tope del change es 1.000 (`plan-map-fallback.test.ts`). El proyecto `realtime` es a demanda y no corre en `verify` ni CI, pero fallará o quedará incoherente con el mundo de 3.840 x 2.160. Actualizar o registrar como deuda.
  - **Resuelto** por el orquestador tras el gate (corrección trivial pedida por el usuario): `MAX_MAP_OBJECTS = 1000`. W1 y S1–S2 quedan registrados como deuda.

### Suggestion
- S1 · `generateMap` tarda 4,15 ms frente a los <= 2,3 ms estimados (informativo; sigue siendo una sola vez por partida).
- S2 · Las constantes duplicadas de Phaser (`RESIZE_MODE`, `NO_CENTER`, `'resize'`, `'shutdown'`) están documentadas con su origen; considerar un test que las compare con `Phaser.Scale.*` si el módulo se pudiera importar en el entorno de test.

## Revisión manual pendiente (sin test automático por e2e-lite; no es hallazgo)
- Ventana mayor que el tope (> 2.560 x 1.440).
- DPR 2.
- Paneles DOM a ×2.
- Ventana minimizada.
- Contenido máximo a 960 x 540.

## Recuento
C: 0 · W: 2 · S: 2
