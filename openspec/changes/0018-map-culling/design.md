# Design · 0018-map-culling

## Resumen
Opción A de `exploration.md`: cada entrada del plan del mapa (`planMapArt`, puro) lleva su caja en mundo
(`bounds`). Una regla pura decide qué entradas intersectan el **rectángulo de recorte** del frame: la vista del
frame que se va a pintar, calculada con la misma fórmula que aplica la cámara en su `preRender` (sin el desfase de
`worldView`), ampliada exactamente M px por lado, con M = 1 celda de `map.cellSize`. Un `MapCuller` sin motor
evalúa la regla **en cada frame** sobre todas las entradas y llama a `setVisible` solo en las que cambian. Todo en
`src/infrastructure`. `domain`, `application`, `content/` y la firma dorada no cambian.

Vía de consulta de la API: MCP `phaser-docs` (BaseCamera `worldView`, Camera `preRender`, Components.Visible
`setVisible`) y, para la 4.2.1 instalada, los fuentes de `node_modules/phaser/src` (detalle en §2).

## 0. Decisiones del gate (usuario, 2026-11-24)
- **G1–G4 aprobadas** tal como se proponían en §11: `test.slow()` se mantiene (se quitará en un chore posterior si
  los tres E2E del mapa real bajan a ≤ 30 s en el run del PR y en el de `main`); basta con mejorar frente a 0017;
  margen fijo; un objeto que toca el borde se dibuja.
- **Conflicto design/spec resuelto a favor de la spec**: se elimina la ampliación a celdas enteras y la clave de
  celdas como disparador. El rectángulo de recorte es la vista del frame (fórmula del rig) + M px por lado,
  M = `CULL_MARGIN_CELLS` × `map.cellSize` con `CULL_MARGIN_CELLS = 1`. La regla se evalúa en cada frame sobre
  todas las entradas del plan (≤ 1.000 comparaciones AABB) y `setVisible` solo se llama donde cambia el estado.
  D1/D2/D3 y §4–§6 ya reflejan esto.

## 1. Piezas por capa

| Capa | Pieza | Nueva/Mod. | Notas |
|---|---|---|---|
| domain | (ninguna) | — | Sin cambios. Recortar es presentación, no regla de juego. |
| application | (ninguna) | — | Sin cambios. |
| infrastructure | `map/planMapArt.ts`: tipo `Box`, campo `bounds` en `TileDraw`, `SpriteDraw` y `RectDraw`; `MapArtPlan.cellSize` | Mod. | Puro. `objects`, `counts`, `cells` y el orden del plan no cambian (§3). |
| infrastructure | `map/mapCulling.ts`: `CULL_MARGIN_CELLS`, `cullMargin(cellSize)`, `clipRect(view, margin)`, `touches(box, rect)`, clase `MapCuller` | Nueva | Puro, sin motor. Regla de visibilidad y aplicación incremental (§4, §5). |
| infrastructure | `CameraRig.ts`: función pura `followView` y método `CameraRig.nextView()` | Mod. | Vista del frame que se va a pintar (§2). `view()` (sonda, `worldView`) sigue igual. |
| infrastructure | `TerrainView.ts`: `MapArtCanvas.show(index, visible)`; `MapArtProbe.drawn` y `zeroMapArt` con `drawn: 0` | Mod. | Costura sin motor. `paintMapArt` no cambia de contrato. |
| infrastructure | `phaserArt.ts` `mapArtCanvas`: lista `painted` en orden de llamada (vaciada en `clear`) y `show` | Mod. | Único punto con motor: `setVisible`. `foam` sigue aplicándose a **todas** las espumas pintadas, visibles o no (§6). |
| infrastructure | `RenderLayers.ts`: dueño del `MapCuller`; `paintMap` lo reinicia; `cullMap(view)` actualiza `counts.mapArt.drawn` | Mod. | Sin Phaser como valor, como hasta ahora. |
| infrastructure | `GameScene.ts` `render`: tras `rig.track`, `layers.cullMap(rig.nextView())` | Mod. | Una línea; la escena sigue sin reglas. |
| composition | (ninguna) | — | La sonda ya expone `sprites.mapArt` tal cual; `drawn` viaja con él. |

Por qué todo en infraestructura: la visibilidad depende de la cámara y del tamaño del lienzo, que no existen en el
núcleo (ADR-0002, ADR-0014). Las piezas nuevas son funciones y clases puras dentro del adaptador, como
`planMapArt`, `hudLayout` o `CameraRig`, y se prueban en Node sin motor.

Sin puertos nuevos: `MapArtCanvas` ya es la costura (fake en tests y adaptador Phaser), solo gana un método.

## 2. Fuente de la vista y desfase de un frame

Hechos verificados en la 4.2.1 (`node_modules/phaser/src`):
- El orden de un paso es `PRE_STEP` (ScaleManager: `step` → `refresh` → evento `RESIZE`,
  `scale/ScaleManager.js` l. 459 y 1706), luego `update` de las escenas y luego el render, que llama a
  `Camera.preRender` (`cameras/2d/Camera.js` l. 522-612).
- `preRender` con `startFollow` y lerp 1: `scrollX = clampX(follow.x − width·originX)`, y
  `clampX` (`BaseCamera.js` l. 968) recorta a `[0, max(0, W − width)]` con zoom 1. Después
  `worldView.setTo(scrollX, scrollY, width, height)`. La doc de `BaseCamera#worldView` confirma que "is updated in
  the Camera preRender step" y que se recorta a los `bounds`.
- `LayerWebGLRenderer.js` l. 57 solo salta a un hijo si `!child.willRender(camera)`, y `GameObject.willRender`
  (l. 707-712) solo mira `renderFlags` (bit de `Visible`) y `cameraFilter`. Doc de `Components.Visible#setVisible`:
  "An invisible Game Object will skip rendering". No hay recorte por posición.

Consecuencia: en `GameScene.render` (dentro de `update`) `camera.worldView` todavía es la del frame anterior.
Recortar contra él daría huecos de un frame en el borde que avanza.

**Decisión D1**: la vista del recorte se calcula, no se lee. `followView(target, size, world)` (pura, en
`CameraRig.ts`) devuelve `{ x: clamp(tx − w/2, 0, max(0, W − w)), y: clamp(ty − h/2, 0, max(0, H − h)), width: w,
height: h }`, que es la fórmula de arriba con `originX = originY = 0,5`, zoom 1 y `bounds` (0, 0, W, H) del rig.
`CameraRig.nextView()` la aplica al objetivo que acaba de fijar `track` y al tamaño actual de la cámara
(`FollowCamera` gana `readonly width` y `readonly height`, públicos en `BaseCamera`). Como `RESIZE` llega en
`PRE_STEP`, el tamaño ya es el de este frame cuando se recorta. El tamaño de la cámara es el del lienzo con el tope
`arena.maxView` (0017), así que una ventana de 3.840 × 2.160 da una vista de 2.560 × 1.440, como dicen los
escenarios de la spec; los tests puros reciben directamente la vista.

La fórmula es la misma que ya comprueba el E2E de Cámara contra `worldView` (`gameplay.spec.ts` l. 114-141), así
que si el motor cambiara de criterio ese E2E fallaría. `view()` (sonda `camera`) sigue leyendo `worldView`.

Descartado: margen de un frame de movimiento sin calcular la vista. Funciona a velocidad 1, pero con
`?e2e&speed=15` o `step(n)` el salto por frame no tiene tope.

## 3. Cajas del plan (`bounds`)

`Box = { x, y, width, height }` en px de mundo, la caja de lo que el objeto pinta (error ≤ 1 px, fija durante la
partida):
- `tiles` y `rect`: su propio rectángulo (origen (0, 0)).
- `sprite`: con frame de `fw × fh` (hoja de `aspect.sheet`; puentes: `looks.bridges.rects[orientación]`) y el
  recorte `c` (o el frame entero si `crop` es `null`):
  `x = s.x + (c.x − origin.x·fw)·scale`, `y = s.y + (c.y − origin.y·fh)·scale`, `width = c.width·scale`,
  `height = c.height·scale`.
  Con `flipX` se toma la unión de `c` y de su espejo `fw − c.x − c.width` (conservador: el motor refleja el recorte,
  `textures/Frame.js` l. 632-635). Hoy solo se voltean árboles, cuyo recorte ocupa todo el ancho, así que la caja
  es la misma.
- Castillo de la semilla 42 (escenario "Partes del castillo por separado"): tejado (1.800, 900)–(2.100, 1.080) y
  fachada (1.800, 1.080)–(2.100, 1.140), por el corte `cut` de `castleDraws`.

- Redondeo (añadido en apply, W1 del verify-report): las cajas de los sprites se redondean a 1/1024 px. Sin él,
  la copa de un árbol de la fila 0 acababa en y = −1,4e-14 en lugar de 0 y fallaba "toda caja toca el mundo". El
  error (≈ 0,0005 px) queda muy por debajo del ≤ 1 px que permite la spec.

`MapArtPlan.cellSize` = `map.cellSize` del snapshot (60 px con `content/map.json`). Se añade al plan porque es lo
único que falta al recorte y el plan ya se construye desde el snapshot.

## 4. Regla de visibilidad y margen

- `clipRect(view, margin)`: `{ x: view.x − M, y: view.y − M, width: view.width + 2M, height: view.height + 2M }`.
  Sin cuantizar a celdas y sin recortar al mundo (la vista ya viene recortada por D1; las cajas que salen del
  mundo, como copas de la fila 0, siguen el mismo criterio).
- `touches(box, rect)`: intersección **inclusiva** (`box.x ≤ rect.x + rect.width && box.x + box.width ≥ rect.x`, y
  lo mismo en y). Una caja que solo toca el borde se dibuja (G4; escenario "Caja que toca el borde": D y F sí, E y
  G no, en los cuatro bordes).
- La regla recibe M como parámetro, así los tests puros usan M = 0 y M = 60 como pide la spec; el juego usa
  `cullMargin(plan.cellSize)`.

**Decisión D2 (G3): margen fijo de 1 celda**, `CULL_MARGIN_CELLS = 1` (constante con nombre en `mapCulling.ts`),
M = 1 × `map.cellSize` = 60 px con el contenido por defecto. No depende de la vista ni del snapshot (la spec lo
permite). No es contenido de juego (no cambia lo que se ve ni la partida, regla 5), así que no va a `content/` ni a
zod.
- Fijo y no proporcional: el desfase ya está resuelto por D1, así que el margen solo absorbe el redondeo de
  `Linear(sx, objetivo, 1)` (unas ULP) y errores de caja ≤ 1 px. Con un margen proporcional (p. ej. 10 % de la
  vista) se recortaría menos justo con la vista grande (2.560 × 1.440), que es donde ya se gana menos.
- Alternativa descartada: ponerlo en `content/arena.json`. Sería un parámetro de afinado del render sin efecto
  visible, y metería en el contenido validado algo que no es del juego.
- Alternativa descartada (gate): ampliar la vista a celdas enteras y usar el rango de celdas como clave para
  recalcular solo al cruzar una frontera. Ahorraba pasadas, pero el rectángulo de recorte dejaba de ser
  "vista + M" y contradecía los escenarios exactos de la spec ("Caja que toca el borde", "Vista recortada al mundo
  en una esquina").

## 5. Cuándo se recalcula y coste

**Decisión D3**: en cada `cullMap(view)` se calcula `clipRect` y se recorren todas las entradas del plan
(`touches`, N ≤ 1.000 por el tope de `plan-map-fallback.test.ts`). El estado de cada índice se guarda en un
`Uint8Array`; `canvas.show(i, v)` se llama **solo** donde el resultado difiere del estado guardado, y `drawn` se
actualiza de forma incremental. Sin clave ni caché de la ventana anterior: el primer frame tras R, resize o una
partida nueva no hereda nada (requisito "Recorte al cambiar de partida, de ventana y de modo").

- Coste por frame: ~1.000 × 4 comparaciones de números sobre arrays planos, del orden de pocos microsegundos en
  escritorio y por debajo de ~0,3 ms con la CPU frenada ×25 (estimación; se puede medir con un bench opcional,
  `npm run bench`, sin gate). Las llamadas a `setVisible` son decenas por frame moviéndose y 0 quieto, en pausa,
  con oferta o con la partida terminada (la vista no cambia).
- Las cajas se copian en `reset` a un `Float64Array` (x0, y0, x1, y1 por entrada) para no recorrer objetos del plan
  ni crear nada por frame.
- `render` puede ejecutarse dos veces en un frame (elección de mejora + frame). La segunda pasada da el mismo
  resultado y no llama a `show`.
- Descartado: un índice espacial por trozos. Con N ≤ 1.000 no compensa su complejidad (sobreingeniería).

## 6. Ciclo de vida: espuma, R, resize, menú y reserva

- **Pintado (al crear y con R)**: `paintMapArt` llama a `canvas.clear()` (oculta todos los objetos de los pools,
  también los del mapa anterior que no se reutilizan) y deja visible cada entrada del plan nuevo. El adaptador
  vacía su lista `painted` en `clear` y añade cada objeto en el orden de llamada (`[...low, ...high]`), que es el
  índice de `show`. `RenderLayers.paintMap` llama a `culler.reset(plan)`: copia las cajas en ese orden, marca todo
  como visible y pone `drawn = objects`. El `render` que sigue en el mismo `update` (en `create` y en `restart`)
  recorta antes del `preRender`, así que nunca se pinta un frame con el mapa entero ni con objetos del mapa
  anterior (escenario "R tras acabar en una esquina").
- **Espuma al reaparecer**: `MapArtCanvas.foam(frame)` sigue haciendo `setFrame` sobre todas las espumas pintadas,
  ocultas incluidas (la lista `foams` de `phaserArt.ts` ya es así; solo se corrige su comentario, "visibles"). Una
  espuma oculta tiene siempre el frame vigente y al reaparecer está sincronizada. El culler nunca toca frames.
  Alternativa descartada: animar solo las visibles y fijar el frame en `show`. Ahorraría unos pocos `setFrame` por
  cambio de frame, pero acopla el culler a la animación.
- **Resize**: cambia `camera.width/height` en `PRE_STEP`; `nextView()` devuelve la vista nueva y la pasada de ese
  mismo frame aplica la regla con ella. No hace falta escuchar `RESIZE`. Al encoger, lo que sale se oculta; al
  crecer, se muestra en el mismo frame.
- **Volver al menú**: el motor destruye los objetos y la escena suelta `w` y `rig` (`leave`). El culler vive en
  `RenderLayers`, que `create` vuelve a crear con `Jugar`. En el menú la sonda usa `emptyCounts` → `zeroMapArt`,
  con `drawn: 0`; además no hay `render` de partida, así que no se llama a `cullMap`.
- **Mapa vacío**: plan sin entradas → `reset` deja `drawn = 0` y la pasada no hace nada.
- **Reserva**: los `rect` de reserva tienen `bounds` y pasan por la misma regla. Los recuentos
  `painted`/`fallback` siguen siendo del plan entero.

## 7. Sonda `drawn`

`sprites.mapArt.drawn`: objetos del mapa de las dos capas con `visible = true` tras el último recorte, es decir,
los que se mandan a dibujar en ese frame (el recorte ocurre antes del `preRender` del mismo frame). Siempre
`0 ≤ drawn ≤ objects`, y `0` en el menú y con el mapa vacío. No se redefine `painted`, `fallback`, `objects` ni
`sprites.cells`. Sin desglose por capa: ningún escenario lo pide.

Impacto en tests existentes (los ajusta apply, sin cambiar su intención):
- `tests/e2e/probe.ts`: `MapArtView` gana `drawn`; en el menú también se exige `drawn === 0` (junto a
  `objects`, l. 290).
- `gameplay.spec.ts` "Mapa real" (l. 265-274): el `toEqual` con `objects: undefined` necesita `drawn: undefined`;
  si no, falla por la clave nueva.

## 8. Flujo de un frame

```
PRE_STEP  ScaleManager → RESIZE → watchScreen → rig.resize (camera.setSize)
update    GameScene.update → render(snapshot)
            layers.render(snapshot)              (entidades, espuma por reloj de render)
            rig.track(snapshot.player)           (objetivo de la cámara)
            layers.cullMap(rig.nextView())       (N comparaciones; show(i, v) solo donde cambia)
            hud/offer/results/progress/onRender  (sonda con drawn)
render    Camera.preRender (worldView = nextView) → Layer recorre hijos; los ocultos solo cuestan el chequeo
```

## 9. Tests (según e2e-lite: 0 E2E nuevos)

Unitarios en Node, sin motor (`tests/infrastructure/`):
- `followView`: centrada, recortada en las cuatro esquinas, vista igual al mundo, 960 × 540 y 2.560 × 1.440, y la
  posición inicial del E2E de Cámara (1.310, 810) a 1.280 × 720.
- `bounds` del plan: tramo, rect de reserva, sprite con origen, escala y recorte (tejado y fachada de la semilla
  42, tronco + copa = frame del árbol), `flipX` y puente con su `rect`.
- Regla pura con los escenarios literales de la spec: "Objeto dentro, fuera y en parte", "Caja que toca el borde"
  (cuatro bordes, M = 0 y 60), "Vista que crece con la ventana", "Vista recortada al mundo en una esquina",
  "Vista que cubre el mundo entero".
- Plan + regla: "Partes del castillo por separado", "Todo el plan se puede ver" (42 y 123, tres ventanas, rejilla de
  60 px con extremos), "Totales del mapa sin cambios" (667 y 750).
- `MapCuller` y `RenderLayers` con lienzo y cámara dobles: movimiento continuo a 1 y 15 ticks por frame, espuma al
  reaparecer, pausa/oferta/terminada, R, redimensionado, menú y jugar, mapa vacío, reserva y `drawn` igual al
  recorte. El `setVisible`/`setFrame` real de `phaserArt.ts` es una línea de adaptador; queda cubierto por revisión
  y por el E2E de Cámara.

E2E: se amplía "Cámara" (mapa real, manual, ya existente) con el escenario "Objetos dibujados con la cámara". El
`realtime [map]` informa de `drawn` junto a `objects` (a demanda, sin umbral). Sin umbrales de fps ni de tiempo en
el gate.

## 10. Plan de medición (informativo, sin gate)

Línea base en `exploration.md` §Mediciones (main 35256f6). Después de apply:
1. Sin navegador (en verify): `drawn` en la posición inicial a 1.280 × 720 para 42/123 (§9).
2. Local, mismo comando y máquina que la base:
   `CI_LIKE=1 npx playwright test --project=realtime --grep "calibration|\[map\]"`. Se anotan fps de la mediana
   42/123, calibración (fps, p95, ticks por frame) y `objects`/`drawn`.
3. CI: duración de Cámara, Sprites, Mapa real y suite total en el job `e2e` del PR. Se lee **una vez** al terminar
   el run, sin polling ni lanzamientos manuales.
4. Se rellenan las columnas "después" de `exploration.md`.

Expectativa honesta: a 1.280 × 720 el rectángulo de recorte cubre 1.400 × 840 px (~14 % del mundo). Los árboles y
la espuma se recortan en proporción, pero los tramos largos de agua y orilla no. Se espera `drawn` en torno a un
cuarto de `objects`, por confirmar con el punto 1. El relleno de píxeles no cambia.

## 11. Decisiones del gate de tasks (aprobadas, ver §0)

- **G1 (`test.slow()`)**: se mantiene en este change. Se retira en un chore posterior solo si en el run del PR
  **y** en el de `main` tras fusionar los tres tests quedan ≤ 30 s (la mitad del `timeout` de CI de 60 s,
  `playwright.config.ts` l. 27).
- **G2**: basta con **mejorar** respecto a 0017 (`drawn` < `objects`, y duración y fps mejor que la base). Volver
  a las cifras de 0016 no es requisito.
- **G3**: margen **fijo** de 1 celda de `map.cellSize` (D2), sin cuantizar a celdas, con la vista calculada desde
  el rig (D1).
- **G4**: "tocando el borde" = se dibuja (inclusivo), como fija la spec.

## Dependencias nuevas
| Paquete | Versión exacta | Motivo | Alternativa descartada |
|---|---|---|---|
| (ninguna) | — | — | — |

## Rendimiento y seguridad
- Presupuesto: 0 ms por tick de simulación (el núcleo no cambia). Render: una pasada O(N ≤ 1.000) por frame, en
  microsegundos y muy por debajo de 1 ms de 16,7 ms incluso frenado. El ahorro: `objects − drawn` objetos menos
  que transformar y meter en el lote cada frame. Bundle: unos cientos de bytes.
- Ningún objeto del motor se crea por frame: los pools y los objetos del mapa siguen creándose una vez por
  partida; el culler reserva sus arrays en `reset`.
- Datos persistidos y entradas externas: ninguno. `drawn` solo sale por la sonda E2E, que ya existía.

## ADRs
- Ninguna nueva. La decisión es local al adaptador y barata de revertir (quitar una llamada y un campo).
  Aplican ADR-0002 (núcleo puro), ADR-0012/0013 (arte y mapa), ADR-0014 (vista variable) y ADR-0016 (mundo de
  3.840 × 2.160).
