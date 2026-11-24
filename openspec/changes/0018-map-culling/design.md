# Design · 0018-map-culling

## Resumen
Opción A de `exploration.md`: cada entrada del plan del mapa (`planMapArt`, puro) lleva su caja en mundo
(`bounds`). Una regla pura decide qué entradas tocan la **vista del frame que se va a pintar**, calculada con la
misma fórmula que aplica la cámara en su `preRender` (sin el desfase de `worldView`), ampliada a celdas enteras
más una celda de margen. Un `MapCuller` sin motor aplica `setVisible` solo a los objetos que cambian y solo cuando
cambia la ventana de celdas. Todo en `src/infrastructure`. `domain`, `application`, `content/` y la firma dorada
no cambian.

Vía de consulta de la API: MCP `phaser-docs` (BaseCamera `worldView`, Camera `preRender`, Components.Visible
`setVisible`) y, para la 4.2.1 instalada, los fuentes de `node_modules/phaser/src` (detalle en §2).

## 1. Piezas por capa

| Capa | Pieza | Nueva/Mod. | Notas |
|---|---|---|---|
| domain | (ninguna) | — | Sin cambios. Recortar es presentación, no regla de juego. |
| application | (ninguna) | — | Sin cambios. |
| infrastructure | `map/planMapArt.ts`: tipo `Box`, campo `bounds` en `TileDraw`, `SpriteDraw` y `RectDraw`; `MapArtPlan.cellSize` | Mod. | Puro. `objects`, `counts`, `cells` y el orden del plan no cambian (§3). |
| infrastructure | `map/mapCulling.ts`: `cullWindow`, `touches`, clase `MapCuller` | Nueva | Puro, sin motor. Regla de visibilidad y aplicación incremental (§4, §5). |
| infrastructure | `CameraRig.ts`: función pura `followView` y método `CameraRig.nextView()` | Mod. | Vista del frame que se va a pintar (§2). `view()` (sonda, `worldView`) sigue igual. |
| infrastructure | `TerrainView.ts`: `MapArtCanvas.show(index, visible)`; `MapArtProbe.drawn` y `zeroMapArt` con `drawn: 0` | Mod. | Costura sin motor. `paintMapArt` no cambia de contrato. |
| infrastructure | `phaserArt.ts` `mapArtCanvas`: lista `painted` en orden del plan y `show` | Mod. | Único punto con motor: `setVisible`. `foam` sigue aplicándose a **todas** las espumas pintadas, visibles o no (§6). |
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
`CameraRig.ts`) devuelve `{ x: clamp(tx − w/2, 0, W − w), y: clamp(ty − h/2, 0, H − h), width: w, height: h }`,
que es la fórmula de arriba con `originX = originY = 0,5`, zoom 1 y `bounds` (0, 0, W, H) del rig.
`CameraRig.nextView()` la aplica al objetivo que acaba de fijar `track` y al tamaño actual de la cámara
(`FollowCamera` gana `readonly width` y `readonly height`, públicos en `BaseCamera`). Como `RESIZE` llega en
`PRE_STEP`, el tamaño ya es el de este frame cuando se recorta.

La fórmula es la misma que ya comprueba el E2E de Cámara contra `worldView` (`gameplay.spec.ts` l. 114-141), así
que si el motor cambiara de criterio ese E2E fallaría. `view()` (sonda `camera`) sigue leyendo `worldView`.

Descartado: margen de un frame de movimiento sin calcular la vista. Funciona a velocidad 1, pero con
`?e2e&speed=15` o `step(n)` el salto por frame no tiene tope.

## 3. Cajas del plan (`bounds`)

`Box = { x, y, width, height }` en px de mundo, la caja de lo que el objeto pinta:
- `tiles` y `rect`: su propio rectángulo (origen (0, 0)).
- `sprite`: con frame de `fw × fh` (hoja de `aspect.sheet`; puentes: `looks.bridges.rects[orientación]`) y el
  recorte `c` (o el frame entero si `crop` es `null`):
  `x = s.x + (c.x − origin.x·fw)·scale`, `y = s.y + (c.y − origin.y·fh)·scale`, `width = c.width·scale`,
  `height = c.height·scale`.
  Con `flipX` se toma la unión de `c` y de su espejo `fw − c.x − c.width` (conservador: el motor refleja el recorte,
  `textures/Frame.js` l. 632-635). Hoy solo se voltean árboles, cuyo recorte ocupa todo el ancho, así que la caja
  es la misma.

`MapArtPlan.cellSize` = `map.cellSize` del snapshot (60 px con `content/map.json`). Se añade al plan porque es lo
único que falta al recorte y el plan ya se construye desde el snapshot.

## 4. Regla de visibilidad, margen y cuantización

- `cullWindow(view, cell)`: la vista ampliada hacia fuera a múltiplos de `cell` y luego `CULL_MARGIN_CELLS`
  celdas por cada lado. Se devuelve como rango entero de celdas `{ c0, r0, c1, r1 }`, que sirve también de clave.
- `touches(box, window)`: intersección **inclusiva**. Una caja que toca el borde de la ventana se dibuja
  (conservador: nunca hay hueco). Si la spec delta dice otra cosa en "tocando el borde", manda la spec. Con el
  margen no se nota en pantalla.
- No se recorta la ventana al mundo: la vista ya viene recortada (D1). Las cajas que salen del mundo (copas de la
  fila 0) siguen el mismo criterio.

**Decisión D2 (pregunta 4): margen fijo de 1 celda**, `CULL_MARGIN_CELLS = 1` (constante con nombre en
`mapCulling.ts`), en celdas de `map.cellSize`. No es contenido de juego (no cambia lo que se ve ni la partida,
regla 5), así que no va a `content/` ni a zod. Lo que se ve está siempre de 1 a 2 celdas (60-120 px) dentro de la
ventana.
- Fijo y no proporcional: el desfase ya está resuelto por D1, así que el margen solo absorbe el redondeo de
  `Linear(sx, objetivo, 1)` (unas ULP) y la cuantización. Con un margen proporcional (p. ej. 10 % de la vista)
  se recortaría menos justo con la vista grande (2.560 × 1.440: unos 256 px más por lado), que es donde ya se gana
  menos.
- Alternativa descartada: ponerlo en `content/arena.json`. Sería un parámetro de afinado del render sin efecto
  visible, y metería en el contenido validado algo que no es del juego.

## 5. Cuándo se recalcula y coste

**Decisión D3**: en cada `render` se calcula la clave (`cullWindow`, O(1)). Solo si difiere de la última aplicada
se recorren todas las entradas (`touches`, N ≤ 1.000 por el tope de `plan-map-fallback.test.ts`) y se llama a
`canvas.show(i, v)` **solo** donde cambia el estado guardado (`Uint8Array` por índice). `drawn` se mantiene
incremental.

- A velocidad 1 (215 px/s, 60 fps) se cruza una frontera de celda de 60 px cada ~17 frames por eje, así que la
  pasada completa ocurre en ≤ 1 de cada ~8 frames moviéndose en diagonal, y en ninguno quieto, en pausa o en la
  pantalla de resultados.
- Coste de la pasada: ~1.000 × 4 comparaciones más unas decenas de `setVisible`, del orden de microsegundos en
  escritorio y < 0,5 ms con la CPU frenada ×25. Se puede medir con un bench opcional (`npm run bench`, sin gate).
- Descartado: un índice espacial por trozos. Con N ≤ 1.000 y la pasada solo al cambiar de celda no compensa su
  complejidad (sobreingeniería).

`render` puede ejecutarse dos veces en un frame (elección de mejora + frame). La segunda llamada casi siempre tiene
la misma clave y no hace nada.

## 6. Ciclo de vida: espuma, R, resize, menú y reserva

- **Pintado (al crear y con R)**: `paintMapArt` deja todo visible (como hoy). `RenderLayers.paintMap` llama a
  `culler.reset(plan)`: guarda las cajas en orden `[...low, ...high]` (el mismo orden en que `paintMapArt` llama al
  lienzo, y por eso el índice del lienzo), marca todo como visible, pone `drawn = objects` y borra la clave. El
  `render` que sigue en el mismo `update` (en `create` y en `restart`) recorta antes del `preRender`, así que nunca
  se pinta un frame con el mapa entero.
- **Espuma al reaparecer**: `MapArtCanvas.foam(frame)` sigue haciendo `setFrame` sobre todas las espumas pintadas,
  ocultas incluidas (la lista `foams` de `phaserArt.ts` ya es así; solo se corrige su comentario, "visibles"). Una
  espuma oculta tiene siempre el frame vigente y al reaparecer está sincronizada. El culler nunca toca frames.
  Alternativa descartada: animar solo las visibles y fijar el frame en `show`. Ahorraría unos pocos `setFrame` por
  cambio de frame (a los fps de la espuma, no por frame de juego), pero acopla el culler a la animación.
- **Resize**: cambia `camera.width/height` en `PRE_STEP`, `nextView()` devuelve otra vista, cambia la clave y se
  hace la pasada. No hace falta escuchar `RESIZE`. Al encoger, lo que sale de la ventana se oculta; al crecer, se
  muestra en el mismo frame.
- **Volver al menú**: el motor destruye los objetos y la escena suelta `w` y `rig` (`leave`). El culler vive en
  `RenderLayers`, que `create` vuelve a crear. En el menú la sonda usa `emptyCounts` → `zeroMapArt`, con
  `drawn: 0`.
- **Reserva**: los `rect` de reserva tienen `bounds` y pasan por la misma regla. Los recuentos
  `painted`/`fallback` siguen siendo del plan entero.

## 7. Sonda `drawn`

`sprites.mapArt.drawn`: objetos del mapa de las dos capas con `visible = true` tras el último recorte, es decir,
los que se mandan a dibujar en ese frame (el recorte ocurre antes del `preRender` del mismo frame). Siempre
`0 ≤ drawn ≤ objects`, y `0` en el menú. No se redefine `painted`, `fallback`, `objects` ni `sprites.cells`.
Sin desglose por capa: ningún escenario lo pide.

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
            layers.cullMap(rig.nextView())       (clave; pasada y show(i, v) solo si cambia)
            hud/offer/results/progress/onRender  (sonda con drawn)
render    Camera.preRender (worldView = nextView) → Layer recorre hijos; los ocultos solo cuestan el chequeo
```

## 9. Tests (según e2e-lite: 0 E2E nuevos)

Unitarios en Node, sin motor (`tests/infrastructure/`):
- `followView`: centrada, recortada en las cuatro esquinas, 960 × 540 y 2.560 × 1.440, y la posición inicial del
  E2E de Cámara (1.310, 810) a 1.280 × 720.
- `bounds` del plan: tramo, rect de reserva, sprite con origen, escala y recorte (fachada + tejado de la semilla
  42 = caja del castillo del test existente (1.800, 900)–(2.100, 1.140) en x; tronco + copa = frame del árbol),
  `flipX` y puente con su `rect`.
- Regla: dentro, fuera, tocando el borde, dentro del margen (≤ 1 celda fuera se dibuja), lejos (> 2 celdas fuera
  no se dibuja), vista que crece, y la clave estable al moverse dentro de la misma celda.
- `MapCuller` con un lienzo doble: `reset` deja todo visible y `drawn = objects`; el primer recorte oculta lo de
  fuera; con la misma clave no hay ninguna llamada a `show`; solo se llama a `show` donde cambia; R (un `reset` con
  otro plan) restablece; resize (vista mayor) sube `drawn`.
- Cobertura, semillas 42 y 123 a 960 × 540 y 2.560 × 1.440: la unión de lo visible al recorrer el mundo con la
  cámara en pasos de una celda cubre todos los índices del plan (escenario "ningún objeto queda sin poder verse").
  Lleva también la medida previa sin navegador: `drawn` en la posición inicial a 1.280 × 720 `< objects` y reparto
  del plan por rol.
- `RenderLayers`: `paintMap` + `cullMap` rellenan `counts.mapArt.drawn`; `animateFoam` sigue llamando a
  `canvas.foam` con espumas ocultas (espuma al reaparecer, §6). El `setFrame` real de `phaserArt.ts` es una línea
  de adaptador sin cambio de lógica; queda cubierto por revisión.

E2E: se amplía "Cámara" (mapa real, manual, ya existente): al empezar `0 < drawn < objects`; tras cruzar el mapa
hacia la derecha `drawn` es distinto del inicial y nunca supera `objects`. `realtime [map]` imprime `drawn` junto a
`objects` (a demanda, sin umbral). Sin umbrales de fps ni de tiempo en el gate.

## 10. Plan de medición (informativo, sin gate)

Línea base en `exploration.md` §Mediciones (main 35256f6). Después de apply:
1. Sin navegador (en verify): reparto por rol y `drawn` inicial a 1.280 × 720 para 42/123 (§9).
2. Local, mismo comando y máquina que la base:
   `CI_LIKE=1 npx playwright test --project=realtime --grep "calibration|\[map\]"`. Se anotan fps de la mediana
   42/123, calibración (fps, p95, ticks por frame) y `objects`/`drawn`.
3. CI: duración de Cámara, Sprites, Mapa real y suite total en el job `e2e` del PR. Se lee **una vez** al terminar
   el run, sin polling ni lanzamientos manuales.
4. El orquestador rellena las columnas "después" de `exploration.md`.

Expectativa honesta: a 1.280 × 720 la ventana con margen cubre ~1.520 × 960 px (~18 % del mundo). Los árboles y la
espuma se recortan en proporción, pero los tramos largos de agua y orilla no. Se espera `drawn` en torno a un
cuarto o un tercio de `objects`, por confirmar con el punto 1. El relleno de píxeles no cambia.

## 11. Decisiones para el gate de tasks

- **G1 (pregunta 2, `test.slow()`)**: se mantiene en este change. Propuesta: retirarlo en un chore posterior solo
  si en el run del PR **y** en el de `main` tras fusionar los tres tests quedan ≤ 30 s (la mitad del `timeout` de CI
  de 60 s, `playwright.config.ts` l. 27). Motivos: `test.slow()` no frena nada, solo amplía el plazo; una ejecución
  sola es ruidosa (ya hay 1 reintento en CI); y el flow-field (0019) va a añadir carga justo ahí. Quitarlo ahora
  solo arriesga flakes y no gana nada.
- **G2 (pregunta 3)**: basta con **mejorar** respecto a 0017 (`drawn` < `objects`, y duración y fps mejor que la
  base). Volver a las cifras de 0016 no es requisito: el relleno de 1.280 × 720 queda fuera del alcance.
- **G3 (pregunta 4)**: margen **fijo** de 1 celda de `map.cellSize` más la cuantización a celdas (D2), con la vista
  calculada desde el rig (D1).
- **G4 (menor)**: "tocando el borde" = se dibuja (inclusivo), salvo que la spec delta diga otra cosa.

## Dependencias nuevas
| Paquete | Versión exacta | Motivo | Alternativa descartada |
|---|---|---|---|
| (ninguna) | — | — | — |

## Rendimiento y seguridad
- Presupuesto: 0 ms por tick de simulación (el núcleo no cambia). Render: O(1) por frame y una pasada O(N ≤ 1.000)
  solo al cambiar de celda, en microsegundos y muy por debajo de 1 ms de 16,7 ms incluso frenado. El ahorro:
  `objects − drawn` objetos menos que transformar y meter en el lote cada frame. Bundle: unos cientos de bytes.
- Ningún objeto del motor se crea por frame: los pools y los objetos del mapa siguen creándose una vez por
  partida.
- Datos persistidos y entradas externas: ninguno. `drawn` solo sale por la sonda E2E, que ya existía.

## ADRs
- Ninguna nueva. La decisión es local al adaptador y barata de revertir (quitar una llamada y un campo).
  Aplican ADR-0002 (núcleo puro), ADR-0012/0013 (arte y mapa), ADR-0014 (vista variable) y ADR-0016 (mundo de
  3.840 × 2.160).
