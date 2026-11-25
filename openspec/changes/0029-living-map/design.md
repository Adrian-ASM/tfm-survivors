# Design · 0029-living-map

## Resumen
Todo el change es **infraestructura de render y datos de aspecto**: el plan puro del arte del mapa
(`planMapArt`) añade la decoración, colocada por hash de la semilla de decoración y de la celda (sin PRNG), y
publica **grupos de animación** (frames, fps, fase e índices de objetos) para árboles y torres goblin intactas.
Un `MapAnimator` sin motor aplica `setFrame` solo a los objetos **dibujados** cuando cambia el frame de su grupo
y "ceba" el frame vigente de cada objeto que el recorte vuelve a mostrar. Los datos (`map.decor`,
`map.trees.idle` y el `idle` de la torre intacta) viven en `content/appearance.json` con zod. El núcleo, los
mapas, las firmas doradas y el balance no cambian.

Vía de consulta de Phaser: MCP `phaser-docs` (`/api-documentation/namespace/gameobjects-components-texturecrop`,
`setFrame`), contrastado con el código instalado `node_modules/phaser/src/gameobjects/components/TextureCrop.js`
(4.2.1). `setFrame` conserva el recorte: si `isCropped`, llama a `frame.updateCropUVs(_crop, flipX, flipY)` y no
asigna; es lo que ya hace la espuma (recortada) desde 0016.

## Comprobación de las hojas (abierto 4 del explore)
Vistas las hojas versionadas y las del pack local (`Tiny Swords (Update 010)/Deco/`):
- **`Tree.png`** (768 × 576, rejilla de 192): los frames 0–5 son el mismo pino con un balanceo leve (el 4 se
  inclina a la izquierda) y el tronco y la sombra en la misma fila (≈ y 165–172); el tocón (8) no se usa. El recorte
  tronco/copa (`cut = origin.y · 192 − 64` = 112,64) y la caja (`spriteBounds`) dependen **solo** del tamaño de frame,
  del origen, de la escala y del volteo, no de los píxeles: ancho completo (0..192) en las dos piezas, así que
  **la caja cubre cualquier frame** y no cambia al animar. El volteo usa ya la unión con el espejo.
- **`Wood_Tower_Red.png`** (1.024 × 192, 4 frames de 256 × 192): mismo cuerpo y patas en los cuatro; solo cambian
  las banderas, dentro del frame. Mismo razonamiento: `structureAspect` corta a ancho completo con el corte del
  frame; caja constante.
- **Deco 01–03, 07–11** (64 × 64, 1 frame): figura centrada que cabe en el frame. Con escala 0,9375 el frame mide
  60 × 60 = 1 celda. Encaje: origen (0,5, 1) en el punto medio del borde inferior de la celda ⇒ el frame cubre
  exactamente la celda y el corte de la regla común sale 0 ⇒ **1 objeto** en la capa baja.
- **Deco 16 y 17** (64 × 128): poste con la base en las filas ≈ 120–125 de 128. Origen (0,5, ≈ 0,95) en el punto
  medio del borde inferior de la celda; corte = 0,95 · 128 − 64 ≈ 57,6 ⇒ base (57,6..128) en la baja y parte alta
  (0..57,6) en la alta: **2 objetos**.
- **Deco 18** (espantapájaros, 192 × 192): figura de ≈ 90 × 145 px con el pie del palo y la sombra en ≈ y 165–170.
  Misma escala 0,9375 que el resto del pack (densidad de píxel común: ≈ 84 × 136 px de mundo, 1,4 × 2,3 celdas, más
  bajo que un árbol). Origen (0,5, ≈ 0,88); corte ≈ 0,88 · 192 − 64 ≈ 105 ⇒ **2 objetos**. Rebasa 12 px por cada
  lado de su celda: aceptable (se permite junto a troncos; nunca toca huellas excluidas porque estas se excluyen
  enteras y la parte que rebasa va bajo estructuras y vetas, ver orden de capas).
- Los orígenes `y` de 16, 17 y 18 son estimaciones a ojo: el implementador fija en los datos la última fila opaca
  (sombra incluida) / alto del frame. No son contrato de la spec (la spec fija la regla, no el número).

## Piezas por capa
| Capa | Pieza | Nueva/Mod. | Notas |
|---|---|---|---|
| domain | — | — | Sin cambios (decisión de alcance). |
| application | — | — | Sin cambios. |
| infrastructure · contenido | `appearanceSchema.ts` | Mod. | `map.trees`: `models` → `idle` (`frames`, `fps`, `loop: true` como la espuma) + `flip`. `map.decor` nuevo (ver §Datos). `MODELS_REQUIRED` se sustituye por `TREE_MUST_LOOP`. |
| infrastructure · contenido | `loadAppearance.ts` | Mod. | `mapSheetsOf` añade las hojas de `map.decor.items[i].sheet.file` (campo `map.decor.items.<i>.sheet.file`): la comprobación de procedencia (`SHEET_NOT_REGISTERED`) las cubre sin código nuevo. |
| infrastructure · render | `map/decorChoices.ts` | Nueva | Pura. Candidatas, selección por rango de hash, tipo ponderado y volteo (§Colocación). Constantes de sal documentadas. |
| infrastructure · render | `map/treeChoices.ts` | Mod. | `treeModel` → `treeLook`: devuelve `phase = h mod n` (los mismos bits que el modelo de hoy) y `flipX` (bit 31, igual). En `ms = 0` cada árbol muestra el frame que mostraba antes. |
| infrastructure · render | `map/mapLooks.ts` | Mod. | `trees` comprueba todos los `idle.frames`; `decor` por ítem (`On`/`Off` con su frame); `resolveStructureLooks` comprueba **todos** los `idle.frames` del aspecto (antes solo el 0) para que una torre sin su frame 3 caiga a reserva y no pida un frame inexistente. |
| infrastructure · render | `map/planMapArt.ts` | Mod. | `decorDraws` (regla común de corte de `structureAspect`, generalizada a una celda); `counts.decor`; `animations: PlannedAnimation[]`; offsets de índices de estructuras y solares recalculados con la decoración. |
| infrastructure · render | `art/animation.ts` | Mod. | `phasedFrameAt(anim, ms, phase) = frames[(⌊ms·fps/1000⌋ + phase) mod n]` (bucle). `frameAt` = fase 0. |
| infrastructure · render | `map/mapAnimation.ts` (`MapAnimator`) | Nueva | Pura, sin motor (§Animación). |
| infrastructure · render | `map/mapCulling.ts` | Mod. | `isVisible(i)` de solo lectura. La regla de recorte no cambia. |
| infrastructure · render | `TerrainView.ts` (`MapArtCanvas`) | Mod. | Método `frame(index, frame)`: pone el frame del sprite pintado `index`. `zeroMapArt` y `MapArtProbe` con `decor`. |
| infrastructure · motor | `phaserArt.ts` | Mod. | Implementa `frame(index, f)` con `setFrame(f)` sobre el `Sprite` pintado (sin crear objetos). |
| infrastructure · render | `RenderLayers.ts` | Mod. | Mismo `AnimClock` que la espuma (§Reloj), `MapAnimator` tras los `sync` de estructuras y antes del recorte; `cullMap` pasa al culler un `MapVisibility` que ceba el frame antes de mostrar (objeto creado una vez, no por frame). Copia `decor` a la sonda. |
| infrastructure · arranque | `bootPlan.ts` | Mod. | `mapSheets` añade las hojas de la decoración (deduplicadas por `file`). |
| contenido | `content/appearance.json` | Mod. | `map.trees.idle` (0–5, 6 fps), `structures.goblin-tower.intact.idle` (0–3, 5 fps), `map.decor`. |
| assets | `public/assets/tiny-swords/Deco/{01,02,03,07,08,09,10,11,16,17,18}.png` + `content/asset-provenance.json` | Nuevas | Copia byte a byte del pack Update 010; 11 entradas (ruta, sha256, bytes, origen `Tiny Swords (Update 010)/Deco/NN.png`). |
| composition | — | — | Sin cambios: `decorSeed` ya llega a `planMapArt`. |

No hay puerto nuevo: todo es adaptador interno y funciones puras.

## Datos: dónde viven y por qué
**`content/appearance.json` → `map.decor`**, no `map.json` ni un fichero nuevo:
- La decoración es **presentación** (no colisiona, no la ve el núcleo, no cambia ningún snapshot): pertenece a los
  datos de aspecto, que por diseño de 0012 (D9) viven en infraestructura y no llegan al dominio. `map.json` es
  contenido de juego parseado al `MapConfig` del núcleo; meterla ahí obligaría al dominio a validar algo que no usa
  y está fuera de alcance (proposal, "Fuera").
- `appearance.json` ya tiene el cableado que hace falta: validación estricta zod con la ruta del campo, cruce con
  la nota de procedencia y carga de hojas por `file`. Un fichero nuevo duplicaría cargador, esquema y cruce.

Forma (estricta en todos los niveles):
```jsonc
"decor": {
  "cellsPerItem": 25,      // entero ≥ 1: 1 decoración por cada N celdas candidatas (decisión 2)
  "maxObjects": 120,       // entero ≥ 0: tope duro en OBJETOS de escena (decisión 7)
  "castleMargin": 1,       // entero ≥ 0: huella del castillo ampliada N celdas (decisión 3)
  "items": [               // ≥ 1; `id` único (error con la ruta `map.decor.items.<i>.id`)
    { "id": "mushroom-small", "sheet": { "file": "Deco/01.png", "frameWidth": 64, "frameHeight": 64 },
      "frame": 0, "scale": 0.9375, "origin": { "x": 0.5, "y": 1 }, "flip": true, "weight": 4 }
    // … 02, 03, 07–11 con weight 4; 16 y 17 con weight 2; 18 con weight 1
  ]
}
```
- `weight` (entero ≥ 1) reparte el tipo: con 8 × 4 + 2 × 2 + 1 = 37, las piezas altas son 5/37 ≈ 13,5 % y el
  espantapájaros ≈ 2,7 % (≈ 1–2 por mapa). Los pesos son datos ajustables, no contrato de la spec salvo que existan.
- Ninguna hoja de `items` puede ser una de las rocas de la piedra (`pickups.stone.rocks.*`): refine con error en
  `map.decor.items.<i>.sheet.file` (no confundir decoración con piedra, decisión 1).
- Árbol: `map.trees = { sheet, scale, origin, idle: { frames, fps, loop: true }, flip }`.
- Torre: el `idle` del aspecto ya existe en `StructureAspectSchema`; solo cambian los datos. **Regla de código**:
  solo se anima el aspecto **intacto** de un tipo de estructura con `idle.frames.length ≥ 2`; ruinas, vetas,
  solares/edificios y castillo usan siempre `frames[0]` (o `frame`) aunque los datos tuvieran más (decisión 4 por
  construcción, no solo por datos). La casa goblin intacta es estática porque su `idle` tiene 1 frame (lo vigila el
  test "Datos del repositorio").

## Colocación de la decoración (sin PRNG)
Solo si `map.castle !== null` (mapa generado; el vacío y los explícitos no tienen huella ⇒ 0 decoración).

1. **Candidatas**, en orden de filas: celda `grass` (tipo de terreno de `MapSnapshot.cells`; los solares son
   hierba en el terreno inmutable y se excluyen aparte) que **no** está en: la zona de inicio (misma regla que
   `MapRules.inStartZone`, recalculada con `map.start` — punto más cercano del rectángulo de la celda a distancia
   < radio —; un test la contrasta con la del dominio en 1..50), la huella del castillo ampliada `castleMargin`, la
   huella de un solar, la de una casa o torre goblin, una celda de orilla (`shoreCells`), la celda de un montón de
   madera (`⌊x/s⌋, ⌊y/s⌋`) o la de una veta (`col`, `row`). Junto a troncos sí.
2. **Cuántas**: `n = ⌊candidatas / cellsPerItem⌋`.
3. **Cuáles**: `placeSeed = deriveSeed(decorSeed, DECOR_PLACE_KEY)` y `h(i) = deriveSeed(placeSeed, i)`; se
   eligen las `n` candidatas de **menor `h`** (empate por índice). Reparto uniforme, independiente del orden de
   recorrido y de la carga de hojas; ninguna firma dorada se calcula con `decorSeed`, así que no se tocan.
4. **Tipo y volteo**: `k(i) = deriveSeed(deriveSeed(decorSeed, DECOR_KIND_KEY), i)`; tipo por peso acumulado con
   `k mod Σweight`; volteo = `item.flip && bit 31 de k`.
5. **Tope**: en orden de rango (menor `h` primero) se acepta cada decoración si `objetos + piezas(item) ≤
   maxObjects`; si no cabe se salta (las siguientes de 1 pieza aún pueden entrar). `piezas(item)` sale de los
   **datos** (corte > 0 ⇒ 2), no de si la hoja cargó: la colocación es idéntica con una hoja caída (decisión 6).
6. **Pieza**: posición = punto medio del borde inferior de la celda; `cut = clamp(origin.y·h − s/scale, 0, h)`;
   baja = recorte `cut..h`, alta = `0..cut` si `cut > 0` (la misma regla que `structureAspect` con huella 1 × 1).

Sales: `DECOR_PLACE_KEY = 0x10000`, `DECOR_KIND_KEY = 0x10001`, `TOWER_PHASE_KEY = 0x10002` en
`decorChoices.ts`. Van por encima de 2¹⁶ para no coincidir con ningún índice de celda (la rejilla tiene 2.304; el
árbol usa `deriveSeed(decorSeed, índice)` directamente). Son sales de hash, no contenido de juego (como `FLIP_BIT`).
Entran en el addendum de ADR-0013 (`DECOR_STREAM` es presentación, fuera del contrato de la simulación).

**Estimación** (a medir en apply; la spec fijará las cifras exactas): ≈ 1.500–1.600 candidatas ⇒ n ≈ 60–64 y
≈ 70 objetos (×1,135). Semilla 42: ≈ 737 + 70 ≈ 807; 123: ≈ 820 + 70 ≈ 890. Peor caso por construcción:
820 + 120 = 940 ≤ 950.

## Orden de capas e índices
- Capa baja: agua, espuma, orillas, puentes, **decoración (base)**, troncos, fachada, estructuras, vetas, solares.
  La decoración va antes que troncos y estructuras para que lo que rebasa de un espantapájaros o de un cartel quede
  bajo un tronco, una torre o una mina vecinos, y siempre bajo las entidades y los recogibles (decisión 5).
- Capa alta: **decoración (parte alta)**, copas, tejado, estructuras alta, solares alta (las copas tapan la parte
  alta de una decoración situada detrás).
- Los offsets que pasan a `built.number(...)` y `sites.number(...)` se recalculan con las nuevas longitudes; los
  tests que comparan con el plan siguen valiendo; cualquier test que fije índices absolutos se rehace (riesgo bajo).

## Animación
`PlannedAnimation = { frames, fps, phase, indices: readonly number[] }` en `MapArtPlan.animations`, agrupado por
(animación, fase):
- **Árboles con arte**: `phase = h mod n` del `treeLook`; un grupo por fase distinta (≤ 6) con los índices del
  tronco **y** de la copa de cada árbol de esa fase ⇒ las dos piezas cambian en la misma llamada.
- **Torres intactas con arte y `idle` ≥ 2 frames**: `phase = deriveSeed(deriveSeed(decorSeed, TOWER_PHASE_KEY),
  structure.id) mod n`; un grupo por fase (≤ 4) con los índices de `structure` y `structure-top` del aspecto
  intacto ⇒ las dos piezas sincronizadas.
- Reservas (rectángulos) y decoración: sin grupo.

`MapAnimator` (puro): `reset(plan)` guarda los grupos como `Int32Array` y un `groupOf: Int32Array` por índice
(−1 si no se anima), sin asignar después. En cada frame `tick(ms, culler, canvas)`: por grupo calcula
`phasedFrameAt`; si difiere del último aplicado a ese grupo, llama a `canvas.frame(i, f)` **solo para los `i` con
`culler.isVisible(i)`**. `prime(i)` pone el frame vigente del grupo de `i`; `RenderLayers.cullMap` lo llama desde
un `MapVisibility` envoltorio justo antes de `show(i, true)`. Así:
- un árbol o una torre que vuelve a dibujarse muestra el frame que le toca por fase y tiempo, no uno congelado
  ("El recorte no cambia lo que se ve");
- una torre en ruina tiene su aspecto intacto deshabilitado (`setEnabled` de `StructureArt`) ⇒ nunca visible ⇒
  nunca recibe `setFrame`; la ruina no tiene grupo (estática);
- la caja (`bounds`) no cambia porque todos los frames comparten tamaño (§Comprobación).

Orden en un frame: `render(snapshot)` → `structureArt/veinArt/siteArt.sync` → `animateFoam` → `mapAnimator.tick`
→ (`rig.track`) → `cullMap` (con cebado). La espuma conserva su mecanismo (`foam(frame)` a todas) para no tocar
sus tests; fusionarla en el animador sería trivial pero no aporta.

## Reloj (decisión 9, resuelta por el autor)
Un **solo `AnimClock`**, el de `RenderLayers` que ya mueve la espuma: árboles y torres leen `this.clock.ms`. Ese
reloj se congela con pausa o `status !== 'running'` (oferta, tienda, obra, fin), así que **árboles, torres y
espuma se congelan juntos** en esos estados y reanudan desde el mismo instante (el criterio de éxito "avanzan
también en pausa…" queda sustituido por "se congelan como la espuma"). Sin segundo reloj del mapa; la espuma no
cambia de comportamiento. En modo manual `advance(ticks · TICK_MS)` sigue siendo la única fuente, así que los E2E
siguen deterministas.

## Sonda y procedencia
- `sprites.mapArt.decor = { painted, fallback }` en **decoraciones** (no objetos): `painted` = colocadas con su hoja
  y pintadas; `fallback` = colocadas cuya hoja falló (no se pintan, decisión 6). `painted + fallback` = colocadas.
  `objects` y `drawn` incluyen los objetos de decoración. 0 en el menú, en el vacío y en los explícitos.
- Procedencia: 11 entradas nuevas; `guard-assets.mjs` no cambia (exige entrada por PNG versionado y prohíbe el Free
  Pack). El test "Solo las tres rocas de Deco" se rehace: `Deco/` versionado = exactamente 01–11 y 16–18, una vez
  cada uno, ninguno de 12–15.

## Rendimiento y seguridad
- **Tick de simulación**: 0 ms añadidos (el núcleo no cambia). Snapshots iguales campo a campo con y sin render.
- **Plan** (una vez por partida y tras R): candidatas O(celdas), orden de ≈ 2.000 hashes, < 1 ms.
- **Por frame**: `MapCuller.apply` recorre ≈ 810–890 entradas en `Float64Array` (+≈ 9 %); `MapAnimator.tick`
  ≤ 10 grupos y, en el frame en que cambia el paso (6 y 5 fps, todos los grupos a la vez), un `setFrame` por pieza
  **dibujada** animada: ≈ 100 a 1.280 × 720 y ≈ 400 a 2.560 × 1.440, ninguno de los ocultos. Sin asignaciones ni
  objetos del motor nuevos por frame; sin capas a pantalla completa (antecedente 0015). Medición informativa con
  `realtime` / `CI_LIKE=1`, sin gate de fps (`e2e-lite`).
- **Objetos de escena del mapa**: ≤ 950 en 42/123 (límite duro 1.000), por test sin navegador en `verify`.
- **Datos/entradas externas**: ninguno nuevo persistido; `appearance.json` validado con zod en el arranque; las 11
  hojas son CC0 de Update 010 con sha256 en la nota.

## Estrategia de test (ADR-0018, test-after en infraestructura y contenido)
- **Esquema** (`appearance-map.test.ts`, `appearance-repo.test.ts`): datos del repositorio (árbol 0–5 a 6 fps,
  torre intacta 0–3 a 5 fps, casa/ruinas/vetas/solares/castillo de 1 frame, 11 ítems de decoración con hojas de
  `Deco/` admitidas); inválidos con ruta del campo (`idle` sin bucle, `cellsPerItem` 0, `id` repetido, peso 0, hoja
  de roca como decoración, campo extra).
- **Plan sin navegador** (`plan-map-art.test.ts`, `plan-sites.test.ts`, nuevo `plan-decor.test.ts`): seeds 1..50
  con 1..120 objetos de decoración, todas en candidatas válidas y de los 11 ítems; vacío y explícito 0; misma
  semilla ⇒ misma lista (celda, ítem, volteo) en dos cálculos; ≥ 2 fases de árbol por mapa; objetos exactos de 42 y
  123 (sustituyen 737/820) y ≤ 950; encaje base/copa (borde superior de la celda); colocación idéntica con hojas de
  decoración caídas y `fallback` contado; zona de inicio igual a `MapRules.inStartZone`.
- **Animación** (`map-animation.test.ts` nuevo, `render-layers.test.ts`): `phasedFrameAt`; tronco y copa con el
  mismo frame; torre recorre 0–3 con su fase; solo visibles reciben `setFrame`; reaparición cebada con el frame
  vigente; ruina sin `setFrame`; castillo, casas, mina y edificios nunca cambian; árboles y torres congelados en
  pausa/oferta/tienda/obra igual que la espuma (§Reloj); snapshots iguales con y sin capas en 1.200 ticks de la 42.
- **Firmas doradas y balance**: los tests existentes sin regenerar.
- **E2E** (0 nuevos, 2 ampliados, modo manual): "Recuentos del mapa pintado" añade `decor.painted ≥ 1`,
  `fallback 0`; "Hojas del mapa bloqueadas" bloquea además las 11 hojas de decoración ⇒ `decor.painted 0`,
  `fallback` = colocadas, sin errores no capturados.

## Dependencias nuevas
| Paquete | Versión exacta | Motivo | Alternativa descartada |
|---|---|---|---|
| — | — | Ninguna. | Animaciones del motor (`anims.play` por objeto): reloj distinto del de render, fuera del recorte por índice y de los tests sin navegador. Flujo `Mulberry32` propio para la decoración: depende del orden y añade un flujo sin necesidad. |

## ADRs
- Ninguno nuevo. Las decisiones son internas al adaptador y baratas de revertir; la colocación y las fases por hash
  amplían el addendum de ADR-0013 (`DECOR_STREAM` como presentación) sin flujo nuevo, y el arte sigue ADR-0012.

## Abierto
- Cifras exactas de objetos (42/123), `drawn` de la sonda y orígenes `y` de 16/17/18: se miden en apply y se
  trasladan a la spec antes de cerrar tasks.
