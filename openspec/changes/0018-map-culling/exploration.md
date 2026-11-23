# Exploración · 0018-map-culling

Intención: no pintar los objetos de arte del mapa que queden fuera de la cámara (deuda de 0017).

## Contexto actual
- `src/infrastructure/phaser/map/planMapArt.ts` (puro) devuelve `low` (tramos `TileSprite` de agua y orilla,
  espuma, puentes, troncos, fachada, o `rect` de reserva) y `high` (copas, tejado) + `counts`, `cells`, `objects`.
  Ninguna entrada lleva hoy su caja en mundo: los sprites solo tienen posición, origen, escala y crop.
- `phaserArt.ts` `mapArtLayers`: dos `Layer` (baja y alta, creados en dos llamadas para rodear el orden de
  `RenderLayers`) y `LayerPool` (objetos reutilizados entre partidas; `next()` hace `bringToTop`, `hide()` oculta).
  `paintMapArt` (`TerrainView.ts`) pinta el plan entero **una vez por partida** (al crear y tras R).
- La espuma cambia de frame con `RenderLayers.animateFoam` -> `MapArtCanvas.foam(frame)` sobre todas las espumas.
- `CameraRig` sigue a un objetivo plano y el motor centra/recorta la cámara en su `preRender`; `GameScene.render`
  llama a `rig.track` **después** de `layers.render`, así que `camera.worldView` va un frame por detrás del snapshot.
  La vista cambia con la ventana (`rig.resize`, 960x540 a 2.560x1.440 máx.).
- Sonda: `sprites.mapArt` (`painted`/`fallback` por elemento + `objects`) y `sprites.cells` son recuentos **del plan
  entero**; `tests/e2e/gameplay.spec.ts` (l. 176-185, 255-273) los compara con `map.counts`. `tests/e2e/probe.ts` solo
  exige `objects === 0` en el menú. `plan-map-fallback.test.ts` limita a <= 1.000 objetos (semillas 42, 123);
  `realtime.spec.ts` `[map]` lo repite y mide fps. `mapGolden.ts` firma las **celdas** (dominio), no el plan.
- Phaser 4.2.1 (verificado en `node_modules/phaser/src`): **el render WebGL no hace culling por objeto**. `Layer`
  (`LayerWebGLRenderer.js`) recorre todos los hijos con `child.willRender(camera)`, que solo mira flags y
  `cameraFilter`; el único `cull` activo es el de `TilemapLayer`. Un hijo con `visible=true` fuera de cámara se
  transforma y se manda al batch igual (la GPU lo recorta). Un hijo con `visible=false` cuesta solo el chequeo.

## Specs afectadas
`sprite-rendering` (sonda de render, "Coste de render del mapa (a demanda)", tope de objetos), `world-camera`
(vista variable), `procedural-map` (sin cambios de dominio). Ninguna ADR nueva obligatoria; ADR-0012/0013/0016 aplican.

## Opciones
**A. Visibilidad por objeto (`setVisible` según caja vs. vista).** El plan añade `bounds` a cada entrada (puro, a
partir de `aspect.sheet`, escala, origen y crop). Una función pura `visibleIndexes(bounds, view, margen)` decide;
el adaptador aplica `setVisible` solo en los objetos que cambian (o al cruzar un umbral de 1 celda).
+ Mínimo cambio: pools, orden de capas, `objects` y plan intactos; fácil de testear sin motor; no cambia la firma
dorada. - 700 comparaciones por frame (despreciables; un índice por chunk las reduce); tramos largos de agua/orilla
(río de punta a punta) casi siempre intersectan, no se recortan; la espuma debe recibir el frame vigente al reaparecer.

**B. Chunks (p. ej. 8x6 celdas) con un `Layer`/`Container` por trozo, activado o no.** + Pocas decisiones por frame;
histéresis natural. - Los tramos deben partirse en las fronteras (sube `objects`, rompe tests de plan y el tope);
muchos `Layer` a crear respetando el orden bajo/sobre entidades (hoy resuelto con dos llamadas); más superficie
de cambio en `GameScene`/`RenderLayers`.

**C. `RenderTexture` por chunk.** + Un quad por chunk. - La espuma está animada (habría que sacarla y romper el
orden de capas); texturas grandes = relleno de píxeles en CI sin GPU (lección del PR #36); invalida la sonda por
elemento y las pruebas del plan. Riesgo alto.

**D. `Tilemap` de Phaser con culling nativo (agua, orilla, suelo).** + Único culling de motor. - Reescritura del
plan (autotile de 4 vecinos, escala, espuma y puentes aparte), nueva firma dorada del arte, `Tilemap_Flat` con
margenes/escala; es un change de arte, no de recorte.

**E. Variante de A con creación bajo demanda** (pool ligado a un índice espacial; solo existen los objetos
visibles). + Menos memoria y arranque. - Pierde el orden por `bringToTop` del plan; más complejo.

## Riesgos e incógnitas
- La lentitud de 0017 mezcla **dos causas**: más objetos (x2-3) y más píxeles (1.280x720 = 1,78x los de 960x540).
  El recorte solo ataca la primera; el relleno de píxeles de la ventana grande queda. Puede no volver a los 20,7 s de 0016.
- Ganancia dependiente de la ventana: a 1.280x720 se ve ~11 % del mundo; a 2.560x1.440 ~44 % (solo ~2x menos objetos).
- Desfase de un frame de `worldView`: calcular la vista con la misma fórmula del rig sobre `snapshot.player` (pura) o
  usar margen >= 1 frame de movimiento (+ 1 celda); si no, parpadeo en el borde.
- Desconocemos el reparto de objetos por rol en 42/123 (cuántos son espuma, orilla, árbol) y qué parte del coste
  del frame es CPU de batch frente a relleno: medir antes de prometer.
- Sonda: no redefinir `painted/fallback/objects` (los E2E los comparan con `map.counts`); añadir campo nuevo.
- Reinicio (R), cambio de tamaño y salida al menú deben restablecer visibilidad (los pools se reutilizan).

## Sonda y tests
- Sonda: conservar `mapArt.*` y `objects` (totales) y añadir `mapArt.drawn` (objetos del mapa visibles en el último frame),
  `0` en el menú. Opcional: `drawn` por capa.
- Unitarios (sin motor): regla de visibilidad (dentro, fuera, tocando el borde, margen, vista que crece con la ventana,
  vista recortada al mundo en las esquinas); `bounds` del plan para tramo, sprite con crop/origen/escala y rect de
  reserva; la unión de objetos visibles de todas las posiciones de cámara cubre el plan; `foam` aplica el frame al
  reaparecer; restart/clear; sonda `drawn`. `map-art-canvas.test.ts` y `terrain-view.test.ts` se amplían.
- E2E (regla e2e-lite): 0 nuevos; ampliar el de "Cámara" (mapa real, manual): `0 < drawn < objects` al empezar y `drawn`
  cambia tras cruzar el mapa. Sin umbrales de fps/tiempo. `realtime [map]` imprime `drawn` además de `objects`.

## Encaje con el flow-field
Hoy el siguiente change (flow-field, centenares de enemigos) sería 0019. Argumentos para **change propio previo**:
solo toca infraestructura, es pequeño y medible por separado; el flow-field cambia `domain/application` y subirá los
sprites de enemigos, así que mezclarlos confunde la medida de CI; reduce `test.slow()` antes de añadir carga.
Para **dentro del flow-field**: ambos comparten el presupuesto de frame y un solo gate/PR. Inclinación: change propio.

## Mediciones
Qué mide: efecto del recorte en el coste por frame y en los E2E del mapa real. Sin umbral en el gate (informativo).

CI (Actions, proyecto `logic`), duración por test:

| Test | 0016 (run 45256417145) | 0017 con `test.slow()` (run 45279626178) | 0018 después |
|---|---|---|---|
| Cámara | 29,0 s | 56,2 s | _hueco_ |
| Sprites | 17,5 s | 33,7 s | _hueco_ |
| Mapa real | 20,7 s | 55,4 s | _hueco_ |
| Suite total | 54,9 s | 1,8 min | _hueco_ |

Local `CI_LIKE=1` (mapa 64x36), mismo comando antes y después:
`CI_LIKE=1 npx playwright test --project=realtime --grep "calibration|\[map\]"`

| Métrica | Antes (main) | Después |
|---|---|---|
| fps mediana semilla 42 / 123 | 14,1 / 12,9 (65 % / 59 % de la base de rectángulos 21,6 / 21,9); ~71 / ~78 ms por frame | _hueco_ |
| Calibración (escena cargada): fps / p95 de frame / ticks por frame | 16,5 / 133,3 ms / 12,25 | _hueco_ |
| `objects` / `drawn` semilla 42 / 123 | 667 / 750 (hoy se pintan todos) | _hueco_ |

Medido por el orquestador el 2026-11-23 en `main` (35256f6), PC local, `CI_LIKE=1`, `CPU_THROTTLE` 25 (por
defecto), Chromium con SwiftShader; log del proyecto `realtime`, 2 passed (2,6 min).

Criterio de bueno: `drawn` bien por debajo de `objects` a 1.280x720 y mejora de fps/duración respecto a 0017, sin
regresión funcional; la recuperación total a cifras de 0016 no es requisito. Medida previa barata (sin navegador):
recuento de objetos del plan por rol en las semillas 42 y 123.

## Preguntas para el usuario
1. ¿Change propio previo al flow-field (recomendado) o dentro de él?
2. ¿Se acepta que el objetivo sea mejorar, no volver a las cifras de 0016, dado el relleno de píxeles de 1.280x720?
3. ¿Quitar `test.slow()` si la medida lo permite, o dejarlo hasta ver varias ejecuciones en CI?
4. ¿Margen de visibilidad fijo (p. ej. 1 celda) o proporcional al tamaño de vista?
