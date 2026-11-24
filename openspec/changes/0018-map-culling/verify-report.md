# Verify report · 0018-map-culling

Auditor independiente (no ha escrito el código). Rama `change/0018-map-culling`, commits `6d4e106`..`7031c86`.

## Ejecución

| Comando | Resultado |
|---|---|
| `npm run verify` | Verde: eslint, tsc, guard:all (722 ficheros), vitest 171 ficheros / 1.991 tests |
| `npm run test:e2e` (proyecto `logic`) | Verde: 13 tests en 13,3 s (Cámara 4,2 s, Sprites 2,8 s, Mapa real 5,1 s) |
| Realtime | No relanzado, por encargo; cifras tomadas de `exploration.md` y del diario de IA |

## Escenarios → Test → Estado

Tests en `tests/infrastructure/` (`map-culling`, `camera-rig`, `plan-map-art`, `plan-map-fallback`, `render-layers`,
`terrain-view`, `map-art-canvas`) y `tests/e2e/`. No he leído cada aserción: he revisado el código de producción, el
diff de los E2E y que las suites estén en verde; la correspondencia exacta de los unitarios sale de las tareas 2.x y 3.x.

| Escenario | Test | Estado |
|---|---|---|
| Objeto dentro, fuera y en parte | `map-culling.test.ts` (regla pura) | OK |
| Caja que toca el borde | `map-culling.test.ts` (D, E, F, G y reflejos) | OK |
| Vista que crece con la ventana | `map-culling.test.ts` + `camera-rig.test.ts` | OK |
| Vista recortada al mundo en una esquina | `map-culling.test.ts` + `camera-rig.test.ts` | OK |
| Partes del castillo por separado | `plan-map-art.test.ts` | OK |
| Todo el plan se puede ver | `plan-map-art.test.ts` (semillas 42 y 123, 3 ventanas, rejilla de 60 px) | OK |
| Vista que cubre el mundo entero | `map-culling.test.ts` | OK |
| Movimiento continuo sin huecos | `render-layers.test.ts` (600 snapshots) | OK |
| Salto de varios ticks en un frame | `render-layers.test.ts` (15 ticks por frame) | OK |
| Espuma al reaparecer | `render-layers.test.ts` (f, f+1, f+40) | OK |
| Pausa, oferta y partida terminada | `render-layers.test.ts` | OK |
| R tras acabar en una esquina | `map-culling.test.ts` + `render-layers.test.ts` | OK |
| Redimensionado | `render-layers.test.ts` + `map-culling.test.ts` | OK |
| Volver al menú y jugar | `render-layers.test.ts` (capas nuevas) y sonda del menú en `probe.ts` | OK |
| Mapa vacío (recorte) | `render-layers.test.ts` / `map-culling.test.ts` (plan vacío, `drawn` 0) | OK |
| Recorte con aspecto de reserva | `plan-map-fallback.test.ts` + `render-layers.test.ts` | OK |
| Totales del mapa sin cambios | `render-layers.test.ts` (667 y 750) | OK |
| `drawn` igual al recorte | `render-layers.test.ts` | OK |
| Objetos dibujados con la cámara [E2E] | `gameplay.spec.ts` "Cámara" (ampliado; 0 E2E nuevos) | OK |
| Sonda en el menú | `probe.ts` (`drawn` junto a `objects`) + unitario `emptyCounts` | OK |
| Recuento coherente / Sin sonda fuera de E2E / Mapa real / Hojas bloqueadas / Partida nueva con otro mapa / Fondo de reserva | E2E existentes, sin cambios de intención; `toEqual` de "Mapa real" ajustado con `drawn: undefined` | OK |
| Objetos del mapa [realtime] | `realtime.spec.ts` `[map]` (0 < drawn < objects; ≤ 1.000 en `verify`) | OK |
| Fps con el mapa real [realtime] | `realtime.spec.ts` `[map]`, informativo | OK (medido, ver abajo) |

## Revisión de design.md y reglas de AGENTS.md

- Capas: no hay cambios en `src/domain`, `src/application`, `content/` ni `mapGolden`. Todo queda en
  `src/infrastructure/phaser/`. `mapCulling.ts` y `planMapArt.ts` no importan el motor.
- Pureza: sin `Math.random`, `Date.now` ni `window` en el código nuevo.
- Números mágicos: `CULL_MARGIN_CELLS = 1` es constante con nombre y la justifica el design (G3). `cellSize` sale del
  mapa (`plan.cellSize`). `BOX_GRID = 1024` también tiene nombre.
- e2e-lite: 0 tests E2E nuevos. Se amplía "Cámara" y se ajustan `probe.ts` y "Mapa real". Sin umbrales de fps ni de
  tiempo en el gate.
- Recorte exacto en cada frame (D1): `GameScene.render` llama a `cullMap(rig.nextView())` justo después de
  `rig.track`. `followView` reproduce la fórmula del `preRender`, con el tamaño ya actualizado por `rig.resize`.
- Cuándo se recalcula:
  - R: `restart` ejecuta `clear` y `paintMap`, y `paintMap` llama a `culler.reset(plan)`, así que no se hereda estado.
  - Redimensionado: `nextView` lee `camera.width/height` en cada frame.
  - Menú: `leave()` suelta `w` y `rig`, las capas se recrean y `drawn` vale 0.
  - Reserva: los rectángulos llevan `bounds` y pasan por la misma regla.
- Espuma: `foam()` pone el frame a todas las espumas pintadas, ocultas incluidas, y `foamFrame` se resetea en
  `paintMap`. Una espuma que reaparece ya tiene el frame vigente.
- Bucle de `apply`: mantiene el índice `[...low, ...high]`. Coincide con el orden de llamadas de `paintMapArt` (todo
  `low` y después `high`) y con la lista `painted` de `phaserArt.ts`.
- `tasks.md`: 2.1 a 5.1 marcadas, con un commit cada una. La 5.2 queda abierta a propósito (necesita el PR).
- Restos de `node -e` y heredoc: no he encontrado comentarios vacíos, plantillas rotas, `\n` ni backticks sueltos en
  el diff de `src/` y `tests/`. Los comentarios de `CameraRig.ts`, `RenderLayers.ts` y `TerrainView.ts` están
  íntegros y typecheck, eslint y la suite pasan.

## Hallazgos

### Critical
Ninguno.

### Warning

- **W1 · Desviación del redondeo a 1/1024 px en `spriteBounds` (`planMapArt.ts`, `snap`).** La spec pide error ≤ 1 px y
  el redondeo es de unos 0,0005 px, así que cumple. El implementer la registró en el diario de IA, pero el `design.md`
  no recoge esta desviación. Por qué se hizo: una copa de la fila 0 acababa en y = −1e-14 y fallaba "cada caja
  intersecta el mundo". Es un parche de coma flotante en vez de una tolerancia explícita en el test o en la regla.
  Además, las copas de la fila 0 quedan enteras fuera del mundo, tocando su borde, y solo se dibujan con la cámara
  arriba del todo. Eso es correcto, porque no son visibles. Acción: anotar la desviación en `design.md` o en la
  retro del archive.
- **W2 · Cobertura del adaptador real solo indirecta.** El orden de `painted`, la reutilización de objetos de los
  pools tras `hide()` y `setVisible(true)` en R no tienen test unitario con el motor. Las pruebas usan lienzos
  dobles. Lo cubre el E2E de Cámara (`drawn` cambia) y el de "Partida nueva con otro mapa". Riesgo bajo, y el código
  es correcto (`next()` más `setVisible(true)` en cada tipo de objeto).
- **W3 · Hallazgo de proceso.** Tres ediciones con `node -e` y un heredoc contra AGENTS.md §8.1. El implementer las
  detectó y corrigió antes del commit, y consta en el diario de IA, que es la evidencia exigida. No hay restos en el
  código.
- **W4 · 5.2 pendiente.** `AGENTS.md` §1 sin actualizar (recorte por cámara y sonda `drawn`) y la columna "0018 después"
  de `exploration.md` sin los datos de CI. Es esperado, pero debe cerrarse antes del archive.

### Suggestion

- **S1 · Regla duplicada.** `touches()` se exporta pero solo la usan los tests como oráculo; `MapCuller.apply` repite
  la misma comparación inline (por rendimiento sobre `Float64Array`). Es coherente, pero hay dos copias de la regla.
  Si se quiere evitar la deriva, un test de paridad `touches` frente a `apply` ya sirve, o marcarlo en el comentario.
- **S2 · Guarda `if (this.rig)` en `GameScene.render`.** Sin rig, `drawn` queda igual a `objects` (todo visible). En
  la práctica el rig existe siempre que hay partida; no pasa nada.
- **S3 · `FollowCamera` pide `width`/`height`.** Hace falta que `this.cameras.main` los exponga. Compila y los E2E lo
  confirman; sin acción.

## Medición realtime (informativa, no bloquea)

Fuente: `exploration.md` y diario de IA, `CI_LIKE=1`, throttle 25, misma máquina que la base.

| Métrica | 0017 | 0018 |
|---|---|---|
| fps mediana semilla 42 / 123 | 14,1 / 12,9 | 19,8 / 22,8 (91 % / 104 % de la base de 0015) |
| `objects` / `drawn` 42 / 123 | 667 / 750 (todos) | 667 / 106 y 750 / 67 |

Supera la base de 0017 y el objetivo orientativo (≥ 18,4 y ≥ 18,6) en ambas semillas.

C: 0 · W: 4 · S: 3
