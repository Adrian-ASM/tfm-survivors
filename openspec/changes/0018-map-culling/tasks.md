# Tasks · 0018-map-culling

<!-- Cada tarea ≤ ~30 min, con test asociado y referencia al escenario. Orden: dominio → aplicación →
     infraestructura → composición → E2E → docs. El implementer marca [x] y hace un commit por tarea.
     TDD: primero el test en rojo (por fallo de aserción o de tipos), después el código. Cada tarea se cierra con
     `npm run verify 2>&1 | tail -20` en verde (en el bucle, `npm run verify:fast`).
     Escenarios de la spec delta `specs/sprite-rendering/spec.md`. Design: §N de `design.md`. -->

## 1. Dominio y aplicación
Sin tareas: el change no toca `src/domain` ni `src/application` (design §1).

## 2. Infraestructura pura: vista, regla y cajas
- [ ] 2.1 `followView(target, size, world)` en `CameraRig.ts` y `CameraRig.nextView()`; `FollowCamera` gana
  `readonly width` y `readonly height` (design D1). Test en `tests/infrastructure/camera-rig.test.ts` (rojo: no
  existe): vista centrada; recortada en las cuatro esquinas; jugador en (16, 16) a 1.280 × 720 → (0, 0)–(1.280,
  720); jugador en (3.824, 2.144) → (2.560, 1.440)–(3.840, 2.160); jugador en (1.920, 1.080) con vistas de 960 ×
  540, 1.280 × 720 y 2.560 × 1.440 → los tres rectángulos de la spec; mundo 2.560 × 1.440 con vista igual → (0, 0);
  posición inicial del E2E de Cámara (1.310, 810); `nextView()` usa el objetivo de `track` y el tamaño tras
  `resize` (cámara doble con `width`/`height`).
  — escenarios: "Vista que crece con la ventana", "Vista recortada al mundo en una esquina", "Vista que cubre el
  mundo entero" (parte de rectángulos visibles).
- [ ] 2.2 `src/infrastructure/phaser/map/mapCulling.ts`: tipo `Box` (o importado de `planMapArt`),
  `CULL_MARGIN_CELLS = 1`, `cullMargin(cellSize)`, `clipRect(view, margin)` y `touches(box, rect)` inclusivo
  (design §4). Test nuevo `tests/infrastructure/map-culling.test.ts` (rojo: el módulo no existe) con los datos
  literales de la spec: A y C sí, B no; D y F sí, E y G no, y sus reflejos en los bordes izquierdo, superior e
  inferior; H no a 1.280 × 720 y sí a 2.560 × 1.440, y a 960 × 540 H no y A sí; I sí y J no en la esquina
  (0, 0); en la esquina opuesta (2.440, 1.320)–(2.500, 1.380) sí y (2.439, 1.319)–(2.499, 1.379) no; mundo
  2.560 × 1.440 con vista completa: todas las cajas de un plan de prueba sí; `cullMargin(60) === 60`.
  Los rectángulos visibles salen de `followView` (2.1).
  — escenarios: "Objeto dentro, fuera y en parte", "Caja que toca el borde", "Vista que crece con la ventana",
  "Vista recortada al mundo en una esquina", "Vista que cubre el mundo entero".
- [ ] 2.3 `bounds` en `TileDraw` y `RectDraw` (tramos de baldosas y rectángulos de reserva) y
  `MapArtPlan.cellSize` (design §3). Test en `tests/infrastructure/plan-map-art.test.ts` y
  `plan-map-fallback.test.ts` (rojo por tipos/aserción): con el mapa de "Elementos en su sitio", el tramo de agua
  cubre su rectángulo de celdas; con reserva de agua, árbol, puente y castillo, cada `rect` tiene por `bounds` su
  rectángulo de celda o de huella ((1.800, 900)–(2.100, 1.140) para el castillo de la semilla 42); `cellSize` 60.
  — escenarios: "Recorte del arte del mapa por cámara" (definición de caja, tiles y reserva), "Recorte con aspecto
  de reserva" (cajas de los rectángulos).
- [ ] 2.4 `bounds` en `SpriteDraw` (origen, escala, recorte, `flipX` como unión con el espejo, puentes con
  `looks.bridges.rects[orientación]`; design §3). Tests en `plan-map-art.test.ts` (rojo): tejado
  (1.800, 900)–(2.100, 1.080) y fachada (1.800, 1.080)–(2.100, 1.140) de la semilla 42 (±1 px); árbol de
  "Elementos en su sitio" con origen (630, 300): caja del tronco + copa = frame del árbol; puente centrado en
  (990, 570); un sprite con `flipX` y recorte asimétrico da la unión. Con `M = cullMargin(60)` y la regla de 2.2:
  borde inferior del recorte en y = 1.080 − M − 1 → tejado sí, fachada no; en y = 900 − M → tejado sí (toca),
  fachada no; en y = 900 − M − 1 → ninguna. Propiedad sobre las semillas 42 y 123 y vistas de 960 × 540,
  1.280 × 720 y 2.560 × 1.440 (ventana de 3.840 × 2.160 con el tope `maxView`), jugador en la rejilla de paso
  60 px de (0, 0) a (3.840, 2.160) con extremos: la unión de dibujados es el plan entero y cada caja intersecta el
  mundo.
  — escenarios: "Partes del castillo por separado", "Todo el plan se puede ver".

## 3. Infraestructura: culler, capas y sonda (lienzo y cámara dobles)
- [ ] 3.1 `MapCuller` en `mapCulling.ts` (design D3): `reset(plan)` copia las cajas en orden `[...low, ...high]` a
  un `Float64Array`, marca todo visible y `drawn = objects`; `apply(view, canvas)` evalúa `touches` sobre todas las
  entradas con `clipRect(view, cullMargin(plan.cellSize))` y llama a `canvas.show(i, v)` solo donde cambia.
  `MapArtCanvas` gana `show(index, visible)` (ajustar los lienzos dobles existentes de `map-art-canvas.test.ts`,
  `terrain-view.test.ts` y `render-layers.test.ts`). Test nuevo en `map-culling.test.ts` (rojo): con la semilla 42
  a 1.280 × 720, jugador en (1.920, 1.080) y en (16, 16), `drawn` = número de entradas que da la regla; misma vista
  dos veces → 0 llamadas a `show` la segunda; solo se llama a `show` en los índices que cambian; vista que crece
  (1.280 × 720 → 2.560 × 1.440) sube `drawn` y la que encoge (→ 960 × 540) lo baja, iguales a la regla; plan vacío
  → `drawn` 0 y ninguna llamada; `reset` con el plan de la semilla 43 tras una vista en la esquina (3.824, 2.144)
  deja el estado de la 43 sin heredar nada.
  — escenarios: "`drawn` igual al recorte", "Redimensionado", "Mapa vacío" (de "Recorte al cambiar…"),
  "R tras acabar en una esquina" (nivel culler).
- [ ] 3.2 `RenderLayers.cullMap(view)`; `paintMap` llama a `culler.reset(plan)` (design §6). Test en
  `render-layers.test.ts` (rojo: `cullMap` no existe) con un lienzo doble que guarda visibilidad y frame de espuma
  por índice y un `CameraRig` sobre una cámara doble, encadenando por frame `render` → `rig.track` →
  `cullMap(rig.nextView())`: 600 snapshots de la semilla 42 a 1.280 × 720 moviéndose a 215 px/s a la derecha y
  luego hacia abajo, a 1 y a 15 ticks por frame → en cada frame toda entrada cuya caja intersecta `followView` (sin
  margen) está visible, y el orden y la capa de las visibles son los del plan; espuma S visible en f, oculta en
  f + 1 y visible en f + 40 → mismo frame de `idle` que las que siguieron visibles; 300 frames en pausa (tick 500),
  con oferta y terminada → mismo conjunto visible y 0 llamadas a `show` tras el primero; `rig.resize` a 2.560 ×
  1.440 y luego a 960 × 540 → visibles = regla en el primer frame de cada tamaño.
  — escenarios: "Movimiento continuo sin huecos", "Salto de varios ticks en un frame", "Espuma al reaparecer",
  "Pausa, oferta y partida terminada", "Redimensionado".
- [ ] 3.3 Sonda: `MapArtProbe.drawn`, `zeroMapArt()` con `drawn: 0` y `cullMap` escribe `counts.mapArt.drawn`
  (design §7). Tests en `render-layers.test.ts` y `map-probe.test.ts` (rojo: `drawn` no existe): semillas 42 y 123
  con vistas de 960 × 540, 1.280 × 720 y 2.560 × 1.440, jugador en el centro y en (16, 16) → `cells`, elementos
  pintados/reserva y `objects` iguales entre sí y a 667 y 750, y `0 < drawn < objects` en la posición inicial a
  1.280 × 720 (anotar el valor para §10.1); `drawn` = regla con (1.920, 1.080) y (16, 16); R con `clear` +
  `paintMap` de la semilla 43 tras acabar en (3.824, 2.144) → visibles y `drawn` = regla del plan 43 y ningún
  objeto del mapa anterior visible; capas nuevas (Volver al menú + Jugar) → primer frame = regla, y
  `emptyCounts(...).mapArt.drawn === 0`; mapa vacío → `drawn` 0; plan con reserva (cada hoja por separado y las
  cinco a la vez) → en el primer frame y a ≥ 1.280 px en x, visibles = regla y recuentos de reserva iguales a los
  del plan entero.
  — escenarios: "Totales del mapa sin cambios", "`drawn` igual al recorte", "R tras acabar en una esquina",
  "Volver al menú y jugar", "Sonda en el menú" (parte unitaria), "Mapa vacío" (ambos), "Recorte con aspecto de
  reserva".

## 4. Adaptador, escena y E2E
- [ ] 4.1 E2E primero (rojo): ampliar "Cámara" de `tests/e2e/gameplay.spec.ts` con `?e2e&manual&seed=7`, mapa
  real, 1.280 × 720 y la flecha derecha: lectura al arrancar y tras cada uno de 20 `step(60)` (opción 0 si hay
  oferta) → `0 < drawn < objects`, `objects` constante y ≥ 1 lectura con `drawn` distinto de la primera. Ajustar
  `tests/e2e/probe.ts` (`MapArtView.drawn`; en el menú también `drawn === 0`, junto a `objects`) y el `toEqual` de
  "Mapa real" (`drawn: undefined`). Después: `show` en `mapArtCanvas` de `phaserArt.ts` (lista `painted` en orden
  de llamada, vaciada en `clear`; `setVisible`), corregir el comentario de `foam` ("todas las espumas pintadas")
  y en `GameScene.render`, tras `rig.track`, `w.layers.cullMap(this.rig.nextView())` (design §8). Verde con
  `npm run test:e2e` (toda la suite `logic`, incluidos "Sprites", "Mapa real", "Partida nueva con otro mapa" y el
  fondo de reserva, sin cambios de intención) y `npm run verify`. `test.slow()` se mantiene (G1).
  — escenarios: "Objetos dibujados con la cámara [E2E]", "Sonda en el menú", "Recuentos del mapa pintado [E2E]"
  (sin cambios), "Recuento coherente con el snapshot" (sin cambios), "Sin sonda fuera de E2E" (sin cambios).

## 5. Medición y documentación
- [ ] 5.1 `tests/e2e/realtime.spec.ts` `[map]`: imprimir `drawn` junto a `objects` y exigir `0 < drawn < objects`
  (a demanda, fuera del CI). Medir con el mismo comando y máquina que la base:
  `CI_LIKE=1 npx playwright test --project=realtime --grep "calibration|\[map\]"`; rellenar la columna/tabla
  "Después" de `exploration.md` §Mediciones (fps mediana 42/123, % sobre 21,6/21,9, diferencia con 14,1/12,9,
  calibración fps/p95/ticks por frame, `objects`/`drawn`). Si no se supera la base de 0017, anotarlo para el
  verify-report (informativo, sin gate). `npm run verify` en verde.
  — escenarios: "Objetos del mapa [realtime]", "Fps con el mapa real [realtime]".
- [ ] 5.2 Tras abrir el PR: leer **una vez**, al terminar el run, la duración de Cámara, Sprites, Mapa real y la
  suite total del job `e2e` (sin lanzar workflows ni hacer polling) y rellenar la columna "0018 después" de
  `exploration.md`; anotar si los tres E2E del mapa real quedan ≤ 30 s (criterio de G1 para el chore posterior).
  Actualizar el estado de `AGENTS.md` §1 (recorte por cámara del arte del mapa, sonda `sprites.mapArt.drawn`) y la
  entrada del diario de IA en `docs/ai-log/`. `npm run verify` en verde.
  — escenario: "Coste de render del mapa (a demanda)" (informe de CI).
