# Design · 0036-ui-polish

## Resumen
Solo hay presentación y datos de aspecto: no se toca el núcleo, el balance ni las firmas. Los cuatro modales (tienda,
obra, guía y Sonido) pierden su botón de salida de abajo. En su lugar llevan una `×` con posición absoluta en la
esquina superior derecha, con la pieza `button` de 9-slice y el nombre accesible de antes. Ese botón llama al mismo
camino que Esc.

Los botones de etiqueta única quedan centrados porque se acotan las reglas de las filas, que hoy alcanzan también a
los demás botones. `HealthBarLayer` guarda en memoria, en el lado del render, qué estructuras han recibido daño, y
borra esa memoria con R o con una partida nueva. El HUD pasa a una columna derecha de 4 contadores con icono
(bajas, oro, madera y piedra). Cada icono mide 24 px a ×1 y muestra un recorte de su frame declarado en
`appearance.json`, de modo que el dibujo llena el icono.

La obra muestra la imagen de `House_Blue` o `Tower_Blue` y una explicación sacada de `guide.json` (`build`), que se
interpola con el mismo catálogo de marcadores que la guía.

> Vía de documentación: MCP `phaser-docs`. Se consultaron `search_phaser_docs` y las páginas Markdown
> `api-documentation/namespace/gameobjects-components-texturecrop.md` (`setCrop`) y
> `api-documentation/class/textures-texture.md` (`add`, `has`, `get`), además de los tipos de
> `node_modules/phaser/types/phaser.d.ts` 4.2.1 (`setCrop(x?: number | Phaser.Geom.Rectangle, …)` en `Image` y
> `Texture.add(...)`).

## Piezas por capa
| Capa | Pieza | Nueva/Mod. | Notas |
|---|---|---|---|
| domain | — | — | Sin cambios. `TICKS_PER_SECOND` (ya existe) solo se lee desde infraestructura |
| application | — | — | Sin cambios |
| infrastructure | `dom/button.ts` · `closeButton(doc, label, onClick)` | Nueva función | `button(doc, MENU_LABELS.close, onClick)` + clase `ui-close` + `aria-label` = `label`. Hereda el `blur()` tras el clic |
| infrastructure | `dom/menuText.ts` | Mod. | `close: '×'` (U+00D7). `shopLeave`/`buildLeave` (`Salir`) y `guideClose`/`soundClose` (`Cerrar`) quedan como **nombre accesible** |
| infrastructure | `ShopPanel`, `BuildPanel`, `GuideModal`, `SoundPanel` | Mod. | La `×` es el último hijo del recuadro y sustituye a `*__leave`, `Cerrar` y `.sound-panel__actions` (§D1) |
| infrastructure | `BuildPanel` | Mod. | 4.º parámetro opcional `about: BuildAbout = NO_BUILD_ABOUT` con la imagen y el texto de cada edificio, como `ShopPanel` con `NO_SHOP_ICONS` (§D6) |
| infrastructure | `dom/resourceIcons.ts` · `buildingIcons(appearance, assetUrl)` | Nueva función | `{ house, tower }` = URL de `sites.house/tower.sheet.file`. `ResourceIcons` no cambia |
| infrastructure | `styles.css` | Mod. | `.ui-close`, reservas en las cabeceras, reglas de fila acotadas, `.resource-icon` 3em y `.build-panel__icon` / `__about` (§D1, D2, D4, D6) |
| infrastructure | `content/guideSchema.ts` + `loadGuide.ts` | Mod. | Clave `build: { house, tower }` (strict, texto ≤ `BUILD_TEXT_MAX` 64). `Guide.build` sale interpolado (§D7) |
| infrastructure | `content/guideMarkers.ts` | Sin cambios | La torre no tiene cifras (spec), así que no hay marcadores nuevos (§D7) |
| infrastructure | `phaser/ui/mobileFrame.ts` | Mod. | `fitsAt`/`maxUiScale`/`mobileUiScale`/`mobileFrameRule` reciben `HudMetrics` (§D4) |
| infrastructure | `content/appearanceSchema.ts` | Mod. | Bloque obligatorio `hud.icons` con recortes, más el cruce con las hojas (§D5) |
| infrastructure | `phaser/HealthBarLayer.ts` | Mod. | `damaged: Set<number>` por id; `drawn` = dañadas y no en ruina (§D3) |
| infrastructure | `phaser/ui/uiLayout.ts` | Mod. | `HUD_BASE` nuevo, `hudLayout(frame, metrics)`, `kills` como `CounterAnchor` y `HUD_RESERVE_TEXTS.kills = '12345'` (§D4) |
| infrastructure | `phaser/hudFormat.ts` · `killsLabel` | Mod. | `String(kills)`, sin «Bajas: ». Los resultados no usan esta función |
| infrastructure | `phaser/sceneWidgets.ts` · `counterIcon`, `counter`, `placement`, `createHud` | Mod. | Icono recortado con `setCrop` + origen + escala; 4 contadores (§D5) |
| infrastructure | `phaser/ui/hudIconPose.ts` · `cropPose(crop, frame, size)` | Nueva (pura) | `{ originX, originY, scale }`. Se prueba en Node |
| composition | `main.ts` | Mod. | `new BuildPanel(document, root, icons, { icons: buildingIcons(...), texts: booted.guide.build })` |
| composition | `GameScene` (cableado del HUD) | Mod. | Pasa `kills: counterIcon(looks.corpse…, appearance.hud.icons.kills)` |
| contenido | `content/appearance.json` | Mod. | `hud.icons` (§D5) |
| contenido | `content/guide.json` | Mod. | Texto de la página `castle` (la `×`) y bloque `build`. El redactado lo fija la spec |

No hay puertos nuevos: todo vive dentro de un mismo adaptador.

## Decisiones

### D1 · La `×` de los cuatro modales
**DOM.** `<button type="button" class="ui-close" aria-label="Salir|Cerrar">×</button>` es el **último hijo** del
recuadro (`section.shop-panel`, `section.build-panel`, `div.guide-modal`, `div.sound-panel`). Así mantiene el sitio
del botón que sustituye en el orden de tabulación. La crea `closeButton()`. El clic hace lo mismo que hacía el botón
retirado:
- Tienda y obra: `{kind:'leave'}`, que consumen `ShopGate`/`BuildGate`, igual que Esc. 0 ticks y sin pausa.
- Guía y Sonido: `close()`, que también es lo que hace su Esc.

En `getByRole('button', { name: 'Salir' | 'Cerrar' })` el nombre accesible sale del `aria-label`, así que los E2E y
las specs que buscan por rol siguen valiendo. El texto visible es solo `×`.

Se retiran `MENU_LABELS.*` como texto visible, `.shop-panel__leave`, `.build-panel__leave`, el `Cerrar` de
`.guide-modal__actions` y el elemento `.sound-panel__actions` con su CSS.

**Pieza.** Se usa la **pieza `button` de 9-slice**, no un glifo suelto. Al ser un `button` dentro de los 8 paneles
del kit, ya hereda el borde, los estados hover/pressed/disabled y el contorno `:focus-visible`. Así se mantiene la
coherencia con el resto de botones y no hace falta CSS nuevo para los estados.

**CSS** (selector `:is(.shop-panel, .build-panel, .guide-modal, .sound-panel) > .ui-close`, especificidad (0,2,0),
que gana a `.guide-modal button` (0,1,1)). Ajuste posterior a las specs: `top` ≤ t·k y padding = margen × k en cada
lado.
```css
position: absolute;
top: calc(16px * var(--ui-scale, 1));    /* = margen t de `panel` × k (spec: ≤ t·k) */
right: calc(16px * var(--ui-scale, 1));  /* = margen r de `panel` × k */
display: grid; place-items: unsafe center;
width: calc(48px * var(--ui-scale, 1)); height: calc(48px * var(--ui-scale, 1));
padding: calc(var(--ui-b-t) * var(--ui-scale, 1) * 1px) calc(var(--ui-b-r) * var(--ui-scale, 1) * 1px)
  calc(var(--ui-b-b) * var(--ui-scale, 1) * 1px) calc(var(--ui-b-l) * var(--ui-scale, 1) * 1px);
font-size: calc(24px * var(--ui-scale, 1)); line-height: 1;
```
- **Centrado del glifo.** Con la pieza, la caja de contenido es de 8k × 0, y su centro (24k, 20k) coincide con el de
  la cara (la caja menos 20/20/28/20 · k). El glifo de 24k desborda esa caja por igual a cada lado gracias a
  `unsafe center`. En reserva el padding es 0 y queda centrado en la caja. Lo mide el E2E de D2. Si Chromium no
  centrase el desborde, el plan B es subir el lado a 56k sin cambiar la regla.
- **Posición.** La cabecera (`header`: alto 64k) empieza en el padding superior del panel (16k con la pieza). La `×`
  va de 16k a 64k, dentro de la cabecera (que acaba en 80k), así que nunca alcanza el saldo, la lista desplazable de
  la tienda ni el cuerpo de la guía. La distancia a la esquina es 16k / 16k en los cuatro modales.
- **No pisa el título.** Se reserva `--ui-close-room: calc(56px * var(--ui-scale, 1))` (48 de la `×` + 8 de aire):
  - `.shop-panel h2` y `.build-panel h2` llevan `margin-inline: var(--ui-close-room)` **a los dos lados**. Son
    elementos estirados, así que la cinta y el título siguen centrados en el panel. El borde derecho del título
    queda en W − 21k − 56k, y la `×` empieza en W − 64k.
  - `.guide-modal__header` lleva `padding-right: var(--ui-close-room)`, porque el indicador «n de total» está a la
    derecha.
  - `.sound-panel__header` lleva `padding-inline: var(--ui-close-room)`, porque su título va centrado.
- **Móvil.** `--ui-scale` vale 1, así que la `×` mide 48 × 48 px CSS, por encima de 44 × 44. La regla
  `.is-mobile .<panel> button { min-width/min-height: 44px }` ya la cubre, y `mobile-display` no necesita cambios.
  Si el panel entero se desplaza en móvil (`overflow-y:auto`), la `×` se desplaza con la cabecera. Esc y ⏸ siguen
  disponibles.

### D2 · Centrado de los botones de etiqueta única
Se ha comprobado con las hojas: `Button_Blue_9Slides.png` tiene un reborde inferior. Los márgenes de `appearance.json`
son 20/20/28/20 en todas las variantes. La cara visible va desde arriba hasta `bottom − (28 − 20)·k`. El padding
`(t, r, b, l)·k` ya centra la caja de contenido sobre la cara (20 + (H − 48)/2 = (H − 8)/2). En reserva, t = b = 0 y
el padding es simétrico. **No se cambia el padding.**

Lo que sí descentra son dos reglas genéricas que alcanzan a cualquier botón del panel:
- `.build-panel button { display:flex; justify-content:space-between }`
- `.shop-panel button { text-align:left }`

Cambios:
1. Las reglas se acotan a las filas: `.shop-panel .shop-panel__product { width:100%; padding…; text-align:left }` y
   `.build-panel .build-panel__option { width:100%; padding…; display:grid… }`.
2. Se añade `text-align: center` a la regla común `:is(8 paneles) button`. La fila la sobrescribe porque tiene más
   especificidad, (0,2,0) frente a (0,1,1).
3. La `×` usa el mismo padding de margen × k que el resto de botones (D1).

El estado `:active` (`Pressed`) sigue sin ajustarse: el dibujo baja unos px. Queda fuera del criterio, que se mide en
reposo, y las cartas de Phaser no se tocan.

**Medida (E2E).** Un helper `faceCenterOffset(locator)` en `tests/e2e/probe.ts` hace lo siguiente:
- Toma `rect = el.getBoundingClientRect()`.
- Define la cara como la caja menos `(--ui-b-l, --ui-b-t, --ui-b-r, --ui-b-b) × --ui-scale`, que la spec fija en
  20/20/28/20 px a ×1. En reserva, la caja interior sin el borde.
- Mide el texto con un `Range` sobre el nodo de texto.
- Devuelve `|Δx|` y `|Δy|`, que deben ser ≤ 1 a 1.280 × 720.

### D3 · Barra de vida desde el primer daño (`HealthBarLayer`)
- Estado nuevo: `private readonly damaged = new Set<number>()`, con la clave `StructureSnapshot.id` (estable en la
  partida).
- En `sync(structures)`, antes de `changed()`: para cada `s` con `!s.destroyed && s.health < s.maxHealth`, se ejecuta
  `damaged.add(s.id)`. Solo crea memoria la primera vez y no reserva nada por frame.
- Al dibujar, se pinta solo si `damaged.has(s.id) && !s.destroyed`. La primera vez que una estructura queda dañada
  siempre coincide con un cambio de `health`, así que la caché `changed()` sigue siendo válida.
- `drawn` (la sonda `sprites.healthBars`) cuenta las barras dibujadas en el último redibujo, es decir, las
  estructuras dañadas alguna vez y no destruidas. Vale 0 al empezar (semilla 42: 7 → 0) y 0 en el menú.
- **Reinicio.** `forget()` borra también `damaged`. Ya lo llaman `clear()` (R, ↻ y Volver al menú) y `setCellSize()`
  (`paintMap` de cada partida nueva, también tras menú → Jugar). No se borra con un RESIZE, porque este no repinta el
  plan.
- No hay lógica nueva en la escena ni en el núcleo. Que «vida < máxima» y «ya dañada» coincidan hoy (no existe
  regeneración) no cambia la regla, que es la de la memoria.

### D4 · Tamaños de los iconos y nuevo paso del HUD
**DOM.** `.resource-icon` pasa de `2em` a **`3em`**: 48 px en la guía a ×1 (16 px de fuente) y 96 a ×2; 42 px en la
obra (14 px) y 84 a ×2. Sigue con `object-fit: cover` y el frame completo; en CSS no se recorta, porque recortar
exigiría `object-view-box` o `style`, y la CSP no lo admite. «faltan N» no cambia. Los 5 iconos de la página de
recursos ocupan 272 px, que caben en los 36em de la guía.

**HUD** (todo × k). Ajuste posterior a las specs (`sprite-rendering`, «Datos de aspecto de los contadores del
HUD»):
- El lado `s` y el paso `p` son **datos de aspecto**: `appearance.json` `hud.iconSize` 24 y `hud.pitch` 30.
- Zod los valida como enteros ≥ 1, con `p ≥ s` (`HUD_PITCH_BELOW_ICON`, campo `hud.pitch`).
- Salen de `HUD_BASE` (`iconSize` y las filas `goldY`/`woodY`/`stoneY` se derivan) y entran como un parámetro
  `HudMetrics = { iconSize, pitch }`:
  - `hudLayout(frame, metrics)`;
  - `hudPanels(layout, margins)`, sin cambios, porque ya recibe el layout;
  - `fitsAt` / `maxUiScale` / `mobileUiScale` / `mobileFrameRule(minTextPx, metrics)` en `mobileFrame.ts`.
- La composición pasa `appearance.hud` a `GameScene` y a `wireMobile`.
- Las filas de contador son `healthY + i·p` para i = 0..3 (bajas, oro, madera, piedra). Con s mayor que 24, el panel
  derecho podría pegarse al borde, pero solo lo hace el contenido de prueba de «Los datos del HUD no cambian la
  simulación», que no mide el layout.

Valores con los datos del repositorio:

| Campo | Antes | Ahora |
|---|---|---|
| `healthY` (vida, reloj y **bajas**) | 28 | **32** |
| `xpY` (barra de XP) | 46 | **50** |
| `goldY` (antes en `xpY`) | 46 | **62** |
| `woodY` | 64 | **92** |
| `stoneY` | 82 | **122** |
| `iconSize` | 16 | **24** |
| `iconGap` | 4 | **6** |

La columna derecha tiene un paso de 30 (`counterPitch`): bajas 32, oro 62, madera 92, piedra 122.

Por qué la primera fila baja a 32: el panel del HUD rodea su contenido con el margen de la pieza (16k) y debe quedar
a `panelInset` (4k) del borde, así que el borde superior del icono debe estar a 20k o más. Con un icono de 24 eso da
un centro en 32 o más. Se mueven la izquierda y el reloj para que la primera fila siga alineada.

Comprobación a ×1:
- Panel derecho: y de 4 a 150, x de W − 123,76 a W − 8. La caja más ancha es la de `123456` (53,76 + 6 + 24).
- Paneles izquierdo y central: empiezan en y = 9.
- Iconos de bajas y oro: [20, 44] y [50, 74]. No se solapan.
- Columna izquierda: barras [27, 37] y [45, 55]. No se solapan.

Para k_max (móvil) siguen mandando las 3 cartas (`maxUiScale(1385, 640) ≈ 1385/768`), porque las cajas del HUD son
más estrechas que antes (la de bajas pasa de 107,5 a 74,8 de ancho). k_max no cambia y el k fraccionario de
`mobile-frame.test` tampoco. A ×2 (desde 1.920 × 1.080, con un tope de lienzo de 2.560 × 1.440, también para
3.840 × 2.160) el panel derecho acaba en 300 px.

### D5 · Iconos recortados del HUD y calavera de `Dead.png`
**La hoja comprobada.** `Dead.png` mide 896 × 256 y tiene 7 × 2 frames de 128 px. El frame 0 está vacío; los 1–2
son el destello y los 11–13 se hunden. Se usa el **frame 5** (fila 0, columna 5): la calavera de frente, completa,
con las dos cuencas y apoyada en su sombra. Está dentro de `corpse.death.frames` (1–13) y del doble de prueba
(1–6).

El dibujo ocupa alrededor del 30 % del frame, y la bolsa de oro, el tronco y la roca entre el 40 y el 60 %. Con el
frame completo a 24 px la calavera mediría unos 7 px, así que el icono del HUD es un **recorte cuadrado del frame
declarado en datos**:
```json
"hud": { "iconSize": 24, "pitch": 30, "icons": {
  "kills": { "frame": 5, "crop": { "x": 40, "y": 46, "width": 52, "height": 52 } },
  "gold":  { "crop": { "x": 36, "y": 36, "width": 60, "height": 60 } },
  "wood":  { "crop": { "x": 34, "y": 52, "width": 60, "height": 60 } },
  "stone": { "crop": { "x": 10, "y": 8,  "width": 44, "height": 44 } }
} }
```
Las cifras son orientativas. La regla es el **cuadrado mínimo que contiene todos los píxeles con alfa > 0 del frame,
más 2 px por lado y dentro del frame**. La fija la tarea de contenido con un test que decodifica el PNG
(`tests/support/png.ts`: `decodePng` y `pixelAt`) y exige que el recorte contenga esa caja y que su lado no pase de
`max(w, h)` de la caja + 8.

Hojas y frames:
- `kills`: `corpse.sheet`, frame `kills.frame`.
- `gold` y `wood`: su hoja, frame `idle.frames[0]`.
- `stone`: la roca `medium`.

**Zod** (`appearanceSchema`), sobre `RectSchema`:
- Bloque `hud` estricto y obligatorio. Hay que añadirlo a `rawAppearance()` de `tests/support/appearance.ts`.
- `HUD_ICON_CROP_NOT_SQUARE` si `width !== height`.
- `HUD_ICON_CROP_OUTSIDE` si el recorte sale del `frameWidth × frameHeight` de su hoja (cruce en el `superRefine`).
- `kills.frame` es un entero ≥ 0 y nada más. Tras contrastar con las specs se retira la regla `∈ death.frames`.
  El índice frente a la hoja se comprueba en dos sitios:
  - Al pintar: hay arte si la hoja cargó y `frame < FrameCount(Dead.png)`; si no, reserva.
  - En un test sobre el PNG: el frame está entre 0 y 13 y tiene píxeles con alfa > 0.

  La hoja medida coincide con la que asume la spec: 896 × 256 y 14 frames.

Cada error nombra su campo (`hud.icons.kills.crop`) y llega por `showContentError`, como el resto de
`parseAppearance`.

**Phaser** (`TextureCrop.setCrop`, coordenadas relativas al frame, escalado con el objeto y sin cambiar el tamaño):
`counter()` crea `scene.add.image(x, y, texture, frame)` una sola vez, con
`setCrop(crop.x, crop.y, crop.width, crop.height)`. `cropPose` devuelve:
- `originX = (crop.x + crop.width/2) / frameWidth`
- `originY = (crop.y + crop.height/2) / frameHeight`
- `scale = size / crop.width`

El centro del recorte cae así justo en el ancla del icono, y en cada RESIZE `placement` aplica
`setPosition(x, y).setScale(scale)` en lugar de `setDisplaySize`. Se descartó añadir frames con nombre
(`Texture.add`, como en el puente): subiría `frameTotal` de hojas que `looks.ts` usa para validar los índices
(`FrameCount`).

**Reserva.** Si el aspecto está en reserva (`corpse.placeholder`, o la hoja de un recogible que no cargó), se usa un
`Rectangle` de `size × size` del color de reserva, como hoy. `CounterIcon` pasa a tener
`{ texture, frame, color, crop, frameSize }`.

**Bajas en el HUD.** `HudLayout.kills: CounterAnchor` (icono junto al margen derecho y número alineado a la derecha a
su izquierda: un solo elemento) y `hudBoxes.kills = counterBox`. `hudPanels.right` rodea bajas, oro, madera y piedra.
`HUD_RESERVE_TEXTS.kills = '12345'`. La pantalla de resultados (`ResultsOverlay`/`DomResultsLines`) mantiene
«Bajas: N».

### D6 · La obra con su edificio y su explicación
**Fila.** `button.build-panel__option`:
```html
<img class="build-panel__icon" alt="" src="…House_Blue.png">
<span class="build-panel__name">Casa</span>
<span class="build-panel__about">…</span>
<span class="build-panel__cost"> …</span>
```
- La imagen es decorativa (el nombre ya está en el texto). Lleva los atributos `width`/`height` del frame de su hoja
  (128 × 192 y 128 × 256), que dan la proporción antes de cargar. Con la URL vacía lleva `hidden` y no tiene `src`.
- Si la imagen falla (`addEventListener('error')`), pasa a `hidden`, como pide la spec «Imagen de edificio que no
  carga».
- CSS: `grid-template-columns: auto 1fr auto`.
  - El icono ocupa `grid-row: 1 / span 2` en la columna 1, con `height: 3.5em; width: auto;
    image-rendering: pixelated`. La caja medida conserva la proporción del frame (la casa a 2,33 × 3,5em y la torre a
    1,75 × 3,5em), y su alto es ≥ los 3em del icono de recurso.
  - El nombre va en la fila 1 de la columna 2 y la explicación en la fila 2 (0,85em, `--ui-b-muted`, alineada a la
    izquierda y con ajuste de línea).
  - El coste va en la columna 3, `1 / span 2`.
- El hueco nombre → coste es el `column-gap` de 1,25em (17,5 px). El E2E pide 8 px o más.
- Alto de la obra a ×1: unos 340 px, por debajo de los 540.

**Datos.** `BuildAbout = { icons: { house, tower }, texts: { house, tower } }`:
- `icons` sale de `buildingIcons(appearance, sheetUrl)`, la misma URL que carga `BootScene`.
- `texts` sale de `booted.guide.build`.

El 4.º parámetro es opcional (`NO_BUILD_ABOUT`: sin imagen y con texto vacío) para no tocar los 6 tests que
construyen el panel sin él. La composición siempre lo pasa, y lo cubre un test de composición.

La sonda `__sprint.sites.panel` (`BuildPanelView`) **no cambia**.

### D7 · Textos de casa y torre interpolados (`guide.json` → `build`)
**Dónde viven.** Los textos van en `content/guide.json`, en una clave nueva `build: { "house": "…", "tower": "…" }`.
Es el único fichero de presentación que ya se interpola con la `RunConfig`, y todos los tests de arranque usan el
`guide.json` real, así que `RawBoot` no cambia. Se descartó un fichero nuevo: obligaba a tocar los 12 fixtures de
`bootContent` y añadía un esquema y un cruce sin ganar nada.

**Esquema.** `GuideSchema` pasa a ser `{ pages, build: strictObject({ house, tower }) }`. Cada texto es `Text`,
tiene como mucho 64 caracteres (`BUILD_TEXT_MAX`, con el mensaje `GUIDE_BUILD_TOO_LONG`) y **no tiene dígitos**
(`/^[^0-9]*$/`, `GUIDE_BUILD_DIGITS`, regla de la spec). `parseGuide` interpola `build.house` y `build.tower` con
`markerValues(config)` y `interpolate()`. El error de un marcador desconocido, sin valor o con una llave suelta usa
el campo `guide.build.house`, sin sufijo de página. Sale por `bootContent`, y de ahí por `showContentError`.
`Guide.build` queda congelado.

**Cifras.** No se escribe ningún número en `src/`:
- La casa ya tiene `buildings.house.incomeGold` y `buildings.house.incomeSeconds`, que es
  `formatSeconds(everyTicks)` con `TICKS_PER_SECOND` del dominio: 1.800 → `30`.
- La torre no tiene cifras (spec): **no se añade ningún marcador** al catálogo. `{buildings.tower.range}` debe seguir
  fallando como desconocido.

El test que exige que todo marcador del catálogo se use (`guide-markers.test.ts` l.176) pasa a recoger las páginas
y `build`.

Textos fijados por la spec:
- `house`: `+{buildings.house.incomeGold} oro cada {buildings.house.incomeSeconds} s` → `+1 oro cada 30 s`.
- `tower`: `Dispara flechas a los enemigos cercanos`.
- Página 4 (`castle`): «… Sal de la tienda con la × de su esquina o con Esc.».

Ni `oro cada` ni `Dispara flechas` pueden aparecer en `src/`, tampoco en los comentarios.

## Flujo
- **`×` (tienda/obra).** Clic → `closeButton` → `action = {kind:'leave'}` → `blur()`. En el siguiente frame,
  `ShopGate`/`BuildGate.takeAction()` → `LeaveShop`/`LeaveSite`. Es el mismo camino que Esc: 0 ticks y la pausa no se
  abre.
- **`×` (guía/Sonido).** Clic → `close()`: quita la escucha, oculta el panel y llama a `onClosed()`. El foco vuelve
  a «Cómo jugar» o a «Sonido», como hace hoy `Cerrar`.
- **Barras, por frame pintado.** `GameScene.render(s)` → `RenderLayers.render` → `bars.sync(s.structures)`:
  1. Marca como dañadas las que ahora tienen vida por debajo del máximo.
  2. Si algo cambió: `clear`, y un `fillRect` × 2 por cada estructura dañada y no en ruina.
  3. `drawn` = número de barras dibujadas.
- **Arranque.** `bootContent`: `parseContent` → `parseAppearance` (con `hud.icons`) → … → `parseGuide` (páginas +
  `build`). Ya en `main`: `new BuildPanel(…, { icons: buildingIcons(…), texts: guide.build })`.

## Dependencias nuevas
| Paquete | Versión exacta | Motivo | Alternativa descartada |
|---|---|---|---|
| — | — | Ninguna | — |

No hay assets nuevos: `Dead.png`, `House_Blue.png` y `Tower_Blue.png` ya están en `asset-provenance.json`.

## Rendimiento y seguridad
- **Presupuesto.** El núcleo no cambia (tick < 1 ms). Render:
  - Barras: 1 `Set.has` por estructura y frame; `add` solo con el primer daño. Sin reservas por frame.
  - HUD: un `Image` más, creado una vez. `setCrop` solo al crear y `setScale` solo en RESIZE.
  - DOM: los paneles se reconstruyen solo cuando cambia su clave, como hoy.
- **Datos persistidos.** No hay ninguno nuevo.
- **Entradas externas.** `guide.json` (`build`) y `appearance.json` (`hud`) se validan con zod y se cruzan en el
  arranque.
- **CSP.** Solo `textContent`, atributos y clases. Ningún `style` ni URL en el CSS. Las imágenes son del mismo origen.

## Tests con aserciones exactas afectados (lista para tasks)
- **Sondas `toEqual`.**
  - `smoke.spec` l.216 (`hud` = `{gold, wood, stone}`): **no cambia**, porque la sonda no gana `kills`.
  - `gameplay.spec` l.98 (`healthBars` 0 en el menú): no cambia.
  - `gameplay.spec` l.851 (`sites.panel.options`) y `__sprint.shop`: no cambian.
  - `viewport` (k): no cambia.
- **Textos y DOM exactos.**
  - `tests/infrastructure/dom/__snapshots__/dom-unchanged.test.ts.snap` y `dom-unchanged.test.ts` (l.194–235).
  - `shop-panel.test.ts` (l.62, 122), `build-panel.test.ts` (l.66, 108, 142, más la imagen y la explicación) y
    `guide-modal.test.ts` (l.287).
  - `sound-panel.test.ts` (`Cerrar` y `actions`) y `styles-ui.test.ts` (l.268 `.shop-panel__leave`, reglas acotadas,
    `.ui-close`).
  - `hud-format.test.ts` (l.70–76, `Bajas: 12345` → `12345`).
- **Layout del HUD.** `ui-layout.test.ts` (`HUD_BASE`, cajas, `kills` como contador, `HUD_RESERVE_TEXTS`),
  `hud-panels.test.ts` y `hud.test.ts` (l.577 y 636 `counterIcon`, más el contador de bajas). `mobile-frame.test.ts`
  debería seguir en verde (k_max por cartas, D4).
- **Barras.** `health-bar-layer.test.ts` y `render-layers-feedback.test.ts` (l.146, 158 y 176: `healthBars` pasa de
  «intactas» a «dañadas y no en ruina»).
- **Contenido.**
  - `guide-schema.test.ts`, `guide-markers.test.ts` (l.176), `guide-boot.test.ts` y `resource-icons.test.ts`
    (`buildingIcons`).
  - Tests de `appearanceSchema` (bloque `hud`) y `tests/support/appearance.ts` (`rawAppearance` + `hud`).
  - Contenido de la guía con el texto de `castle`.
- **E2E (se amplían los existentes, sin crear ninguno nuevo).**
  - `smoke.spec` (`Cerrar` de la guía y de Sonido por rol: siguen valiendo, más el centrado y el tamaño de los iconos
    de la guía).
  - Tienda en `gameplay.spec`: `Salir` con la `×` igual que con Esc, y centrado.
  - Obra en `gameplay.spec` l.860–876: el mínimo de ≥ 20 px sigue en verde; se añaden la imagen del edificio, la
    explicación y la `×`.

## ADRs
- Ninguno: todo es presentación de un adaptador y fácil de revertir (CSS, una clave de datos y una memoria de render).
