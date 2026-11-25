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
- **Deco 01–03, 07–11** (64 × 64, 1 frame, bajas): figura centrada que cabe en el frame. Con escala 0,9375 el frame
  mide 60 × 60 = 1 celda. Encaje: origen (0,5, 1) en el punto medio del borde inferior de la celda de anclaje ⇒ el
  dibujo entero (1 objeto, capa baja) cubre exactamente esa celda.
- **Deco 16 y 17** (64 × 128, altas): poste con la base en las filas ≈ 120–125 de 128. Con origen (0,5, 1) la base
  (filas 64..128) cubre exactamente la celda de anclaje y la parte alta (0..64) la celda de encima; el pie del poste
  queda ≈ 3–8 frame px por encima del borde inferior. **2 objetos**.
- **Deco 18** (espantapájaros, 192 × 192, alta): figura de ≈ 90 × 145 px con el pie del palo y la sombra en
  ≈ y 165–170. Misma escala 0,9375 que el resto del pack (≈ 84 × 136 px de mundo). Con origen (0,5, 1) la base
  (filas 128..192) mide 180 × 60 px: cubre la celda de anclaje y sus vecinas este y oeste (**huella de base de
  3 × 1 celdas**); el pie del palo queda ≈ 20 px por encima del borde inferior de la celda. **2 objetos**.
- **Origen por defecto (0,5, 1)** en las 11: así la caja de la base nunca baja de la fila de anclaje y la regla de
  la spec ("toda celda que comparte > 1 px con la base es válida") se reduce a la huella de base (§Colocación). La
  tarea de medición de apply mide la última fila opaca de 16, 17 y 18; si el hueco del pie se ve mal, se puede
  bajar el origen (p. ej. ≈ 0,95 / 0,88): la huella de base pasa a incluir la fila de abajo y la regla de colocación
  lo absorbe sin código nuevo (se calcula con la caja, no con supuestos).

## Piezas por capa
| Capa | Pieza | Nueva/Mod. | Notas |
|---|---|---|---|
| domain | — | — | Sin cambios (decisión de alcance). |
| application | — | — | Sin cambios. |
| infrastructure · contenido | `appearanceSchema.ts` | Mod. | `map.trees`: `models` → `idle` (`frames`, `fps`, `loop: true` como la espuma) + `flip`. `map.decor` nuevo (ver §Datos). `MODELS_REQUIRED` se sustituye por `TREE_MUST_LOOP`. |
| infrastructure · contenido | `loadAppearance.ts` | Mod. | `mapSheetsOf` añade las hojas de `map.decor.items[i].sheet.file` (campo `map.decor.items.<i>.sheet.file`): la comprobación de procedencia (`SHEET_NOT_REGISTERED`) las cubre sin código nuevo. |
| infrastructure · render | `map/decorChoices.ts` | Nueva | Pura. Celdas válidas, huella de base, selección por rango de hash con huellas sin solape, tipo por hash y tope (§Colocación). Constantes de sal documentadas. |
| infrastructure · render | `map/treeChoices.ts` | Mod. | `treeModel` → `treeLook`: devuelve `phase = h mod n` (los mismos bits que el modelo de hoy) y `flipX` (bit 31, igual). En `ms = 0` cada árbol muestra el frame que mostraba antes. |
| infrastructure · render | `map/mapLooks.ts` | Mod. | `trees` comprueba todos los `idle.frames`; `decor` por ítem (`On`/`Off` con su frame); `resolveStructureLooks` comprueba **todos** los `idle.frames` del aspecto (antes solo el 0) para que una torre sin su frame 3 caiga a reserva y no pida un frame inexistente. |
| infrastructure · render | `map/planMapArt.ts` | Mod. | `decor.placed` (colocación sobre datos) y `decorDraws` (solo piezas con arte, corte en el borde superior de la celda de anclaje); `counts.decor` (`planned`/`painted`/`unpainted`); `animations: PlannedAnimation[]`; offsets de índices de estructuras y solares recalculados con la decoración. |
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
  "density": 25,           // número > 0: celdas válidas por decoración esperada (decisión 2)
  "maxObjects": 120,       // entero ≥ 0: tope en OBJETOS de escena, sobre los datos (decisión 7)
  "castleMargin": 1,       // entero ≥ 0: huella del castillo ampliada N celdas (decisión 3)
  "items": [               // ≥ 1; la hoja identifica el aspecto: dos ítems con la misma hoja ⇒ error
    { "sheet": { "file": "Deco/01.png", "frameWidth": 64, "frameHeight": 64 },
      "frame": 0, "scale": 0.9375, "origin": { "x": 0.5, "y": 1 }, "tall": false }
    // … 02, 03, 07–11 bajas; 16 y 17 (64 × 128) y 18 (192 × 192) con "tall": true
  ]
}
```
- Los campos son exactamente los de la spec (hoja, tamaño de frame, frame, escala, origen, si es alta; tope;
  densidad). Sin pesos ni volteo de decoración: el tipo es uniforme entre los 11 (altas 3/11; ≈ 5–6 espantapájaros
  por mapa) y la decoración no se voltea. Añadir pesos sería solo un campo de datos más (cambio de spec).
- Errores con la ruta del campo: lista vacía (`map.decor.items`), tope negativo o no entero (`map.decor.maxObjects`),
  densidad ≤ 0 (`map.decor.density`), hoja repetida (nombra la hoja, p. ej. `Deco/07.png`), hoja de una roca de la
  piedra (`pickups.stone.rocks.*`, nombra la hoja) y hoja fuera de la nota (`SHEET_NOT_REGISTERED`, nombra la hoja).
- Árbol: `map.trees = { sheet, scale, origin, idle: { frames, fps, loop: true }, flip }`.
- Torre: el `idle` del aspecto ya existe en `StructureAspectSchema`; solo cambian los datos. **Regla de código**:
  solo se anima el aspecto **intacto** de un tipo de estructura con `idle.frames.length ≥ 2`; ruinas, vetas,
  solares/edificios y castillo usan siempre `frames[0]` (o `frame`) aunque los datos tuvieran más (decisión 4 por
  construcción, no solo por datos). La casa goblin intacta es estática porque su `idle` tiene 1 frame (lo vigila el
  test "Datos del repositorio").

## Colocación de la decoración (sin PRNG)
Solo si `map.castle !== null` (mapa generado; el vacío y los explícitos no tienen huella ⇒ 0 decoración).

1. **Celdas válidas** (máscara `Uint8Array`): celda `grass` (tipo de terreno de `MapSnapshot.cells`; los solares
   son hierba en el terreno inmutable y se excluyen aparte) que **no** está en: la zona de inicio (misma regla que
   `MapRules.inStartZone`, recalculada con `map.start` — punto más cercano del rectángulo de la celda a distancia
   < radio —; un test la contrasta con la del dominio en 1..50), la huella del castillo ampliada `castleMargin`, la
   huella de un solar, la de una casa o torre goblin, una celda de orilla (`shoreCells`), la celda de un montón de
   madera (`⌊x/s⌋, ⌊y/s⌋`) o la de una veta (`col`, `row`). Junto a troncos sí. Los solares salen de
   `MapSnapshot.sites` (estático): construir no cambia la decoración.
2. **Pieza y huella de base** (de los datos, nunca de la carga): origen en el punto medio del borde inferior de la
   celda de anclaje. Baja (`tall: false`): 1 pieza, el dibujo entero. Alta: corte en el borde superior de la celda,
   `cut = clamp(origin.y·h − s/scale, 0, h)`; base = recorte `cut..h` (capa baja), parte alta = `0..cut` (capa
   alta) ⇒ 2 piezas. **Huella de base** = celdas cuyo rectángulo comparte > 1 px² con la caja de la base (la pieza
   entera si es baja). Con los datos del repositorio: la celda de anclaje (01–03, 07–11, 16, 17) o anclaje ± 1
   columna (18).
3. **Cuántas se intentan**: `n = ⌊válidas / density⌋`.
4. **Orden**: `placeSeed = deriveSeed(decorSeed, DECOR_PLACE_KEY)`, `h(i) = deriveSeed(placeSeed, i)`; las celdas
   válidas se recorren por **menor `h`** (empate por índice). Tipo: `k(i) = deriveSeed(deriveSeed(decorSeed,
   DECOR_KIND_KEY), i) mod items.length`.
5. **Aceptación** (voraz, en ese orden, hasta `n` intentos): la decoración de la celda i entra si (a) toda su huella
   de base es válida y está libre (ninguna celda de la huella de base de una decoración ya aceptada) y (b)
   `objetos + piezas ≤ maxObjects`. Si no, se descarta y se pasa a la siguiente (una de 1 pieza aún puede entrar con
   el tope casi lleno). Al aceptar, su huella de base se marca ocupada. Así se cumplen "toda celda bajo la base es
   válida", "1 decoración por anclaje" y "bases sin solape" por construcción.
6. Todo es independiente del orden de recorrido del mapa, de la cámara, del tick y de la carga de hojas; ninguna
   firma dorada se calcula con `decorSeed`, así que no se tocan.

**Tope frente a recuento (compatibles)**: el tope se aplica a los **datos** (piezas nominales de lo colocado): la
lista de decoraciones del plan no depende de qué hojas cargaron (escenarios "Recuento de la decoración sin una hoja" y
"Pintar la decoración no cambia la simulación"). Los **objetos del mapa** de la sonda y `drawn` cuentan lo
**pintado**: una decoración cuya hoja falló no crea objetos (spec "Pintado de la decoración"). Como pintados ≤
colocados, objetos de decoración pintados ≤ objetos nominales ≤ tope: las dos reglas se cumplen a la vez. En el plan,
`decor.placed` (lista con celda, hoja y origen) es la colocación; `low`/`high` solo llevan las piezas con arte.

Sales: `DECOR_PLACE_KEY = 0x10000`, `DECOR_KIND_KEY = 0x10001`, `TOWER_PHASE_KEY = 0x10002` en
`decorChoices.ts`. Van por encima de 2¹⁶ para no coincidir con ningún índice de celda (la rejilla tiene 2.304; el
árbol usa `deriveSeed(decorSeed, índice)` directamente). Son sales de hash, no contenido de juego (como `FLIP_BIT`).
Entran en el addendum de ADR-0013 (`DECOR_STREAM` es presentación, fuera del contrato de la simulación).

**Estimación** (a medir en apply; las cifras exactas van al verify-report, como pide la spec): ≈ 1.500–1.600
válidas ⇒ n ≈ 60–64 intentos, algunos descartados por huella ⇒ ≈ 75 objetos (×1,27 con altas 3/11). Semilla 42:
≈ 737 + 75 ≈ 812; 123: ≈ 820 + 75 ≈ 895. Peor caso por construcción: 820 + 120 = 940 ≤ 950.

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
reloj se congela con pausa o `status !== 'running'` (oferta `choosing`, tienda `shopping`, obra `building` y
partida terminada `won`/`lost`, como exige la spec), así que **árboles, torres y espuma se congelan juntos** en esos
estados y reanudan desde el mismo valor (el criterio de éxito "avanzan también en pausa…" queda sustituido por "se
congelan como la espuma"). Sin segundo reloj del mapa; la espuma no cambia de comportamiento. En modo manual
`advance(ticks · TICK_MS)` sigue siendo la fuente del reloj (comportamiento de 0014, sin cambios), así que los E2E
siguen deterministas; ver §Abierto sobre la frase de la spec "no depende de `step(n)`".

## Sonda y procedencia
- `sprites.mapArt.decor = { planned, painted, unpainted }` en **decoraciones** (no objetos): `planned` = las del
  plan (colocación, independiente de la carga); `painted` = las pintadas con su hoja; `unpainted` = las de hojas que
  fallaron (decisión 6), con `painted + unpainted = planned`. `objects` y `drawn` cuentan solo objetos **pintados**
  (una decoración no pintada no aporta ninguno). Todo 0 en el menú, en el vacío y en los explícitos.
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
  `Deco/` admitidas, altas 16–18, tope 120, densidad 25); inválidos con ruta del campo (`idle` del árbol ausente, sin
  bucle o `[]`; `models` extra; lista vacía; tope −1 / 2,5; densidad 0; hoja repetida; hoja de roca; hoja fuera de
  la nota).
- **Plan sin navegador** (`plan-map-art.test.ts`, `plan-sites.test.ts`, nuevo `plan-decor.test.ts`): seeds 1..50
  con 1..120 objetos de decoración, huellas de base en celdas válidas y sin solape, anclajes únicos, ≥ 1 junto a un
  tronco; vacío y explícitos 0; misma semilla ⇒ misma lista (celda, hoja, origen); 42 ≠ 43; tope 0 / 1 / 3; con tope
  0, 737 y 820 objetos; con los datos del repositorio, esos más la decoración y ≤ 950; encaje base/parte alta (borde
  superior de la celda); colocación idéntica con hojas de decoración caídas y recuento `unpainted`; zona de inicio
  igual a `MapRules.inStartZone`; ≥ 2 fases de árbol por mapa; cajas de tronco, copa y torre que cubren todos sus
  frames.
- **Animación** (`map-animation.test.ts` nuevo, `render-layers.test.ts`): `phasedFrameAt`; tronco y copa con el
  mismo frame; torre recorre 0–3 con su fase; solo visibles reciben `setFrame`; reaparición cebada con el frame
  vigente; ruina sin `setFrame`; castillo, casas, mina y edificios nunca cambian; árboles y torres congelados en
  pausa/oferta/tienda/obra/fin igual que la espuma (§Reloj); snapshots iguales con y sin capas en 1.200 ticks de la 42.
- **Firmas doradas y balance**: los tests existentes sin regenerar.
- **E2E** (0 nuevos, 2 ampliados, modo manual): "Recuentos del mapa pintado" añade `decor.planned ≥ 1`,
  `painted = planned`, `unpainted 0`; "Hojas del mapa bloqueadas" bloquea además `Deco/18.png` ⇒ `unpainted` = las
  del espantapájaros en el plan (0 si no hay), el resto pintadas, sin errores no capturados.

## Dependencias nuevas
| Paquete | Versión exacta | Motivo | Alternativa descartada |
|---|---|---|---|
| — | — | Ninguna. | Animaciones del motor (`anims.play` por objeto): reloj distinto del de render, fuera del recorte por índice y de los tests sin navegador. Flujo `Mulberry32` propio para la decoración: depende del orden y añade un flujo sin necesidad. |

## ADRs
- Ninguno nuevo. Las decisiones son internas al adaptador y baratas de revertir; la colocación y las fases por hash
  amplían el addendum de ADR-0013 (`DECOR_STREAM` como presentación) sin flujo nuevo, y el arte sigue ADR-0012.

## Abierto
- Cifras exactas de objetos (42/123) y `drawn`: se miden en apply (tarea de medición) y van al verify-report; la
  spec solo fija 737/820 con tope 0 y ≤ 950.
- Orígenes `y` de 16/17/18: por defecto 1 (§Comprobación); la tarea de medición confirma o los baja.
- Nit de spec para el orquestador: el término "Reloj de render" dice que "no depende de `step(n)`", pero en modo
  manual el reloj avanza `ticks · TICK_MS` desde 0014 (y así lo usan los E2E). El diseño conserva ese comportamiento;
  conviene matizar la frase en la spec ("fuera del modo manual").
