# Design · 0032-ui-kit

## Resumen
Un solo juego de piezas de `Tiny Swords (Update 010)/UI/` descrito en una sección nueva `ui` de
`content/appearance.json` y dos adaptadores de infraestructura que la leen: **CSS `border-image`** para los
7 paneles DOM y **`GameObjects.NineSlice`** para las 3 cartas y el HUD. `BootScene` carga las piezas como imágenes
y espera la fuente (`FontFace` propio, como mucho 3.000 ms); al terminar, la composición publica en `#game` (CSSOM,
como `--ui-scale`) el relleno y las tintas de todas las piezas y la imagen y los márgenes solo de las que **sí**
cargaron. Sin imagen, el CSS cae a la reserva: panel con borde de 1 px, fondo = relleno de `panel` y tintas de `panel`
(decisión del autor); botones, cartas y HUD con el aspecto actual. Las esquinas miden siempre `slice × uiScale` px
(escalón entero), en las dos tecnologías. El núcleo no se toca.

> **Revisión tras las specs delta (fase tasks)**: medidas IHDR confirmadas por el orquestador (`*_9Slides` 192 × 192,
> `*_3Slides` 192 × 64); ADR-0028 libre; reserva del panel con el relleno de la pieza; fuente Departure Mono aprobada
> (descarga en apply) con espera máxima de 3.000 ms, lo que obliga a cambiar `load.font` por un `FontFace` propio con
> plazo (§6); regla de la tinta `danger` roja; filas de la tienda: 7, no 6; botón del diálogo: `Confirmar`;
> cartas con márgenes de texto `max(16, l)`/`max(16, r)`, `t`, `b`; `guard-assets` sobre `.woff2/.woff/.ttf/.otf` y
> `OFL.txt` con el texto de la licencia.

Vías de consulta de la API (Phaser 4.2.1): MCP `phaser-docs`, página
`/api-documentation/class/gameobjects-nineslice` (`setSize`, `setSizeToFrame`), contrastada con los tipos y el
código instalados, que mandan: `node_modules/phaser/types/phaser.d.ts` (`GameObjectFactory.nineslice`, l. 27327;
`NineSlice.setSize`/`setSlices`, l. 35884–36049; `LoaderPlugin.font`, l. 89203),
`src/gameobjects/nineslice/NineSlice.js` (l. 1079: `setSize` ajusta el `hitArea` si no es personalizada),
`NineSliceRender.js` (**`renderCanvas` = NOOP**: solo WebGL) y `src/loader/filetypes/FontFile.js` (l. 97–131:
`FontFace` + `document.fonts.add`; si `FontFace.load()` falla solo hace `console.warn`, **no** emite
`FILE_LOAD_ERROR`).

## 1. Medición de las piezas (PNG de Update 010)
Dimensiones **confirmadas por cabecera PNG** (orquestador): `*_9Slides` 192 × 192 y `*_3Slides` 192 × 64. Los
márgenes y rellenos se midieron por inspección a resolución nativa y son provisionales: la tarea 1.1 los **confirma**
con un test que lee los píxeles (el mismo decodificador sirve al test de "Hojas de las piezas medidas") y un script
de medición en el scratchpad (cabecera IHDR + IDAT con `zlib.inflateSync` y desfiltrado; imprime ancho × alto, primera y última
fila/columna opaca, grosor del contorno por lado, filas de sombra inferior y color medio del centro) y que quedan
fijados por el test de IHDR de §8. Regla para fijar un `slice`: el menor múltiplo de 4 que contiene la curva de la
esquina, el contorno y el ribete, y en el lado inferior además la sombra.

| Pieza (ruta bajo `UI/`) | Tamaño | Lectura visual | `slice` T/R/B/L (provisional) | Relleno medio (aprox.) |
|---|---|---|---|---|
| `Banners/Carved_9Slides.png` | 192 × 192 | Pergamino con borde irregular fino (~6 px) y esquina casi recta; **sin sombra** | 12/12/12/12 | `#c8b48a` |
| `Buttons/Button_Blue_9Slides.png` | 192 × 192 | Contorno oscuro 2 px, ribete crema ~8 px, radio ~14 px; **sombra inferior ~8 px** | 20/20/28/20 | `#8ec4c8` |
| `Buttons/Button_Blue_9Slides_Pressed.png` | 192 × 192 | El mismo marco desplazado hacia abajo, sin sombra | 20/20/28/20 (mismos: el texto no salta) | `#86b4b8` |
| `Buttons/Button_Hover_9Slides.png` | 192 × 192 | Ribete dorado, relleno gris cálido, sombra roja inferior | 20/20/28/20 | `#c9c6ac` |
| `Buttons/Button_Disable_9Slides.png` | 192 × 192 | Ribete y relleno tostados, sombra | 20/20/28/20 | `#b99c86` |
| `Buttons/Button_Red_9Slides.png` (+ `_Pressed`) | 192 × 192 | Como el azul, relleno salmón | 20/20/28/20 | `#d68b7e` |
| `Ribbons/Ribbon_Yellow_3Slides.png` | 192 × 64 | Cinta con colas laterales ~44 px; 3 rodajas horizontales | 0/48/0/48 (3-slice, alto fijo 64) | `#b9b04a` |

Descartadas: `Banner_Horizontal`/`Banner_Vertical` (patas y sombra, no estirables), `Banner_Connection_*`,
`Carved_3Slides`/`Carved_Regular`, variantes base y `_3Slides` de botones (alto fijo de 64), `Ribbon_Blue/Red`
(una sola cinta basta), `Icons/*` y `Pointers/*` (fuera por la proposal). Nada del Free Pack.

**Asimetría**: solo los botones tienen sombra; por eso `slice.bottom` > `slice.top`. La pieza *pressed* conserva
los mismos `slice` para que el contenido no se mueva al pulsar (el desplazamiento del dibujo ya da la sensación).

## 2. Qué pieza va en cada superficie
| Superficie | Contenedor | Botones | Cabecera (`h1`/`h2`) |
|---|---|---|---|
| Menú `.menu-panel` | `panel` | `button` / `buttonHover` / `buttonPressed` / `buttonDisabled` | `header` |
| Pausa `.pause-panel` | `panel` | ídem | `header` |
| Diálogo de borrado `.confirm-dialog` | `panel` | Cancelar = `button`; Confirmar = `buttonDanger` (+ `buttonDangerPressed`) | — (no tiene) |
| Guía `.guide-modal` | `panel` | ídem `button` | `header` en `.guide-modal__header h2` |
| Resultados `.results-panel` | `panel` (hoy sin fondo) | ídem | `header` en `.results-panel__title` |
| Tienda `.shop-panel` | `panel` | productos y Salir = `button`; `.is-unavailable` = `buttonDisabled` | `header` |
| Obra `.build-panel` | `panel` | opciones = `button`; `.is-unavailable` = `buttonDisabled` | `header` |
| Cartas de mejora (Phaser) | `button` (NineSlice) | — | — |
| HUD (Phaser) | `panel` (3 NineSlice: izquierda vida/XP, centro reloj, derecha bajas y contadores) | — | — |

`:hover`/`:focus-visible` → `buttonHover` (el foco además conserva un `outline` de 2 px para teclado); `:active` →
`buttonPressed`. El selector de `Confirmar` del diálogo usa la clase que ya tenga el botón; si no la tiene, la
posición en `.confirm-dialog__actions` (`:last-child` o `:first-child`, según `ConfirmDialog.ts`); solo CSS: el DOM
no cambia.

**Colores de texto por pieza** (legibilidad sobre pergamino y botones claros): cada pieza declara su tinta
`ink = { text, muted, accent, danger }`. Propuesta inicial: `panel` `#2b1d0e`/`#5a4630`/`#1f4e79`/`#8b1a1a`;
`button` `#10222e`/`#2c4552`/`#0b3a5c`/`#7a1010`; `buttonHover` `#2b2418`/…; `buttonDisabled` `#3e3024`/…;
`buttonDanger` `#2b0f0f`/…; `header` `#2b2418`. Se sustituyen los colores fijos de hoy dentro de los paneles
(`#7ce2fe` de mensajes y página, `#f5c542` del oro, `#c8c8d8` de descripciones, `#ff8a80`/`#f5c46b` de avisos) por
tintas de la pieza. Dentro de un panel se usan siempre las de `panel` (también en reserva, cuyo fondo es su
relleno); dentro de un botón, las del botón solo si su pieza cargó y, si no, el blanco de hoy sobre `#23233a`.
Mapeo de la spec: `text` normal, `muted` descripciones, `accent` mensajes e indicador de página, `danger` avisos y
cifras que faltan (oro del saldo: `text`). Regla de rojo de `danger` en §3.

## 3. Datos: sección `ui` de `appearance.json` y esquema zod
```jsonc
"ui": {
  "pieces": {
    "panel":               { "image": "UI/Banners/Carved_9Slides.png",
                             "slice": { "top": 12, "right": 12, "bottom": 12, "left": 12 },
                             "fill": "#c8b48a",
                             "ink": { "text": "#2b1d0e", "muted": "#5a4630", "accent": "#1f4e79", "danger": "#8b1a1a" } },
    "button":              { "image": "UI/Buttons/Button_Blue_9Slides.png", "slice": { … 20/20/28/20 }, "fill": …, "ink": … },
    "buttonHover":         { "image": "UI/Buttons/Button_Hover_9Slides.png", … },
    "buttonPressed":       { "image": "UI/Buttons/Button_Blue_9Slides_Pressed.png", … },
    "buttonDisabled":      { "image": "UI/Buttons/Button_Disable_9Slides.png", … },
    "buttonDanger":        { "image": "UI/Buttons/Button_Red_9Slides.png", … },
    "buttonDangerPressed": { "image": "UI/Buttons/Button_Red_9Slides_Pressed.png", … },
    "header":              { "image": "UI/Ribbons/Ribbon_Yellow_3Slides.png",
                             "slice": { "left": 48, "right": 48 }, "height": 64, "fill": …, "ink": … }
  },
  "font": { "family": "Departure Mono", "file": "DepartureMono-Regular.woff2", "format": "woff2" }
}
```
`UiSchema` (en `appearanceSchema.ts`, estricto en todos los niveles, añadido a `AppearanceShape` como `ui`):
- `pieces`: `strictObject` con **exactamente** las 8 claves (`UI_PIECES`, `as const`); una que falta o sobra es
  error de contenido por la vía existente (`parseAppearance` → `bootContent` → `showContentError`).
- Pieza 9-slice: `image` = `SheetFile` (misma regex, relativa a `ASSET_DIR`, sin `..`), `slice` con `top`, `right`,
  `bottom`, `left` enteros ≥ 0 (`UI_SLICE_MUST_BE_INTEGER`: "Un margen nine-slice es un entero ≥ 0."), `fill` y
  cada tinta `Hex`. Pieza 3-slice (`header`): `slice` solo `left`/`right` y `height` entero ≥ 1.
- `superRefine` `checkUiInk`: contraste WCAG de cada tinta con el `fill` de su pieza ≥ 4,5
  (`UI_INK_CONTRAST`: nombra pieza y tinta). Es la prueba automática de "texto legible por pieza". Además
  `danger` es roja: R ≥ 96, R ≥ 2·G y R ≥ 2·B (`UI_DANGER_MUST_BE_RED`).
  **Acotado en apply por decisión del autor**: la regla de `danger` (roja y contraste ≥ 4,5) solo se exige en
  `panel` y `buttonDisabled`; en `buttonDanger`/`buttonDangerPressed` no se comprueba (centro medido `#996878`
  no admite rojo con contraste 4,5 dentro de la tolerancia de 16). Ver spec delta de `sprite-rendering`.
- El relleno declarado debe coincidir con el color medio del centro de la hoja (≤ 16 por canal): no lo comprueba el
  arranque (no tiene los píxeles), sino el test de píxeles de la tarea 1.1.
- `font`: `family` texto no vacío sin comillas ni `;`/`,` (regex `^[A-Za-z0-9 ]+$`), `file` regex
  `^[A-Za-z0-9_-]+\.woff2$`, `format` `z.literal('woff2')`.
- `parseAppearance` añade las 8 `image` a la lista que exige entrada en la nota (`SHEET_NOT_REGISTERED`) y comprueba
  que `fonts/<file>` figura en `fonts[]` de la nota (`FONT_NOT_REGISTERED`). `bootContent` recibe ambas listas.
- El tamaño real del PNG no lo conoce zod: `left + right < ancho` y `top + bottom < alto` los comprueba el test de
  IHDR (§8).

No hay números de UI nuevos en `src/` fuera de constantes de presentación ya existentes (`HUD_BASE`, `CARD_*`).

## 4. Adaptador CSS (DOM)
**Rutas**: las piezas se copian con la ruta del pack, `public/assets/tiny-swords/UI/<carpeta>/<fichero>.png`
(ADR-0012); la fuente, en `public/assets/fonts/` con su `OFL.txt`.

**Variables inyectadas, no `url()` estáticos en `styles.css`**. Decisión: `styles.css` no contiene ninguna URL;
usa `var(--ui-…, <reserva>)`. Motivos: (1) los márgenes, colores y ficheros vienen de `appearance.json` y no se
duplican en CSS; (2) la URL sale de `assetUrl(import.meta.env.BASE_URL, image)` (la misma que carga `BootScene`),
que da una ruta **absoluta de origen** `/tfm-survivors/assets/tiny-swords/UI/…` idéntica en `dev`
(`localhost:5173/tfm-survivors/`), `build` + `preview` (`localhost:4173/tfm-survivors/`) y Pages, sin depender de
que Vite reescriba `url()` de `public/` ni de cómo se resuelve una URL relativa dentro de una propiedad
personalizada; (3) da reserva y diagnóstico: solo se publican las variables de las piezas que **cargaron**.
Descartado: `url(/assets/...)` estático en `styles.css` (Vite le antepone la base en build, pero duplica datos, no
avisa de fallos y deja las esquinas sin reserva limpia: el fondo oscuro asomaría por las esquinas transparentes).

**Piezas nuevas en infraestructura (`src/infrastructure/dom/uiKit.ts`)**, funciones puras:
- `uiKitVariables(ui, loaded: ReadonlySet<string>, url) → Record<string, string>`:
  - **siempre**, de las 8 piezas: `--ui-<p>-fill` y `--ui-<p>-text|muted|accent|danger`; y
    `--ui-font: "<family>", monospace`;
  - **solo por pieza cargada**: `--ui-<p>-src: url("<url>")` (la URL ya pasó la regex y `encodeURIComponent` por
    segmento: sin comillas ni paréntesis), `--ui-<p>-slice: "T R B L"`, `--ui-<p>-t|r|b|l` (números); para
    `header`, `--ui-header-h`; y en los botones las "tintas activas" `--ui-<p>-on-text|on-muted|on-danger` y
    `--ui-<p>-on-bg: transparent` (sin ellas el botón conserva `#23233a` y blanco), y `--ui-disabled-opacity: 1` si
    cargó `buttonDisabled`.
  Escenario "Variables solo de las piezas cargadas": sin `panel`, se publica todo salvo `--ui-panel-src`,
  `--ui-panel-slice` y `--ui-panel-t|r|b|l`.
- `applyUiKit(style, vars)`: `style.setProperty` sobre `#game` (CSSOM; `style-src 'self'` no lo bloquea, igual que
  `--ui-scale` desde 0017).

**Reglas en `styles.css`** (un bloque compartido por grupo de selectores, sin tocar clases ni DOM):
```css
.menu-panel, .pause-panel, .confirm-dialog, .guide-modal, .results-panel, .shop-panel, .build-panel {
  border-image-source: var(--ui-panel-src, none);
  border-image-slice: var(--ui-panel-slice, 0) fill;
  border-image-width: calc(var(--ui-panel-t, 1) * var(--ui-scale, 1) * 1px) calc(var(--ui-panel-r, 1) * …) …;
  border-image-repeat: stretch;
  image-rendering: pixelated;
  background: var(--ui-panel-fill, <fondo actual de cada panel>);
  padding: max(<padding actual>, calc(var(--ui-panel-t, 0) * var(--ui-scale, 1) * 1px)) …;
  font-family: var(--ui-font, monospace);
  color: var(--ui-panel-text, #fff);
}
```
- `border` de 1 px (`#7ce2fe`, `#f5c542` en la tienda) y `border-radius` actuales se quedan: con
  `border-image-source: none` (sin variable) o con la imagen sin poder pintarse, el navegador usa el `border-style`
  normal (CSS Backgrounds 3). **Reserva del panel** (decisión del autor): ese borde + fondo = relleno de `panel` +
  tintas de `panel`, que tienen contraste ≥ 4,5 con ese relleno por construcción. Con la pieza, el centro `fill`
  tapa el fondo, que es del mismo color, así que las esquinas transparentes no desentonan. `border-image-width` no
  cambia la caja; por eso el `padding` sube a `max(actual, slice × uiScale)`: el texto nunca pisa el marco (área
  útil = caja − márgenes) y, sin pieza, el padding es el de hoy. La guía mantiene además un mínimo de 12 px por lado.
- **Botones**: `background: var(--ui-button-on-bg, #23233a)`, `color: var(--ui-button-on-text, #fff)`, borde de
  1 px `#7ce2fe` de siempre y la pieza de su estado; `:focus-visible` con `outline: 2px solid`.
- **Escalado**: `border-image-slice` en px de imagen (sin unidades) y `border-image-width` = `slice × --ui-scale`
  px; como `--ui-scale` es entero (ScreenFrame), cada píxel de la esquina mide exactamente `uiScale` px.
- **Alto mínimo de botón**: `min-height: calc((var(--ui-button-t,0) + var(--ui-button-b,0)) * var(--ui-scale,1) *
  1px)`, porque si la suma de anchos supera la caja el navegador los reduce proporcionalmente (CSS Backgrounds 3,
  §border-image-width) y la esquina dejaría de medir `slice × uiScale`.
- **Cabecera (3-slice)**: `border-image-slice: 0 R 0 L fill`, `border-image-width: 0 calc(R·k) 0 calc(L·k)`,
  `height`/`line-height` = `--ui-header-h × k` y `padding-inline` ≥ colas; sin variables, el `h1`/`h2` de hoy.
- **Tienda**: única concesión de layout (también con reserva, inocua): `.shop-panel` gana
  `max-height: calc(100vh - 2em)` y `.shop-panel__products` `overflow-y: auto; min-height: 0` (mismo patrón que la
  guía), porque 7 filas con botón de 20 + 28 px de marco pueden pasar de 720 px a ×1 (riesgo R1). El título, el oro
  y `Salir` quedan fuera de la zona que se desplaza. Las filas no comprables siguen siendo botones clicables (el
  clic intenta la compra, que falla).
- `.is-unavailable` (tienda y obra) usa `buttonDisabled`; su `opacity` pasa a `var(--ui-disabled-opacity, 0.6)` y
  la composición publica `1` si `buttonDisabled` cargó (el marco ya comunica el estado; la opacidad bajaría el
  contraste).

## 5. Adaptador Phaser (cartas y HUD)
**API (4.2.1, comprobada en tipos y código)**:
`scene.add.nineslice(x, y, texture, frame?, width?, height?, leftWidth?, rightWidth?, topHeight?, bottomHeight?)`
(9-slice si se dan los cuatro). Los `slice` son px de textura y **no** escalan con `setSize`; `setSize(w, h)`
estira el centro y ajusta el `hitArea`; tamaño mínimo `left + right` × `top + bottom`; solo WebGL (en Canvas no
pinta nada, `renderCanvas` = NOOP).

**Geometría pura** `nineSliceGeometry(rect: CenteredRect, uiScale) → { x, y, width: w / k, height: h / k, scale: k }`
en `src/infrastructure/phaser/ui/uiPanel.ts`: el objeto se dibuja con `setScale(k)` y `setSize(w / k, h / k)`, así
la esquina mide `slice × k` px y el total `w × h`. Probado en Node (×1 y ×2, mínimo respetado).

**Costura** (infraestructura, dos implementaciones reales, no puerto de dominio):
```ts
interface UiPanelPart { setVisible(v: boolean): unknown; place(rect: CenteredRect, uiScale: number): void }
```
- `NineSlicePanel` (envuelve `NineSlice`): `place` → `setPosition`, `setScale(k)`, `setSize(w/k, h/k)`.
- `NO_PANEL` (objeto nulo): la reserva **es** el aspecto de hoy, que no tiene marco en el HUD y cuyo marco en las
  cartas es el propio `Rectangle` del área de clic; no hace falta un tercer objeto.
- Fábrica `createUiPanel(scene, piece, depth): UiPanelPart | null`: NineSlice solo si
  `scene.textures.exists(piece.image)` **y** `scene.game.renderer.type === Phaser.WEBGL`; si no, `null` y el llamador
  usa `NO_PANEL` y deja su `Rectangle` con el aspecto de hoy. Se crea **una vez** en `create()`; RESIZE llama a
  `place`, nunca recrea.
- Las texturas de UI se cargan como `load.image(image, assetUrl(image))` (nueva `uiImagesOf(appearance)` en
  `imagesToLoad`) y en `BootScene.create()` reciben `setFilter(Phaser.Textures.FilterMode.NEAREST)` (a ×2 el pixel
  art no se emborrona; el resto de texturas no cambia).

**Cartas** (`UpgradeOverlay`, `createUpgradeOverlay`): `CardParts` gana `frame: UiPanelPart`; `box` sigue siendo
el `Rectangle` interactivo (área de clic y `useHandCursor`) pero **transparente** (relleno alfa 0, sin trazo) cuando
hay NineSlice, y con su relleno y trazo de hoy en reserva (entonces `frame` es `NO_PANEL`). Así el clic, `takeClicked` y `ChoiceKeys` no cambian. `placeCard` llama a
`frame.place(rect, k)`. Profundidades: frame `OVERLAY_DEPTH + 1`, box `+ 1` creado después, textos `+ 2`.
- Área útil (spec upgrades): nueva función pura `cardTextLayout(rect, slice, k)` en `cardLayout.ts`: borde
  izquierdo del texto a ≥ `max(16, l)·k`, ancho de ajuste ≤ `ancho − (max(16, l) + max(16, r))·k`, borde superior
  del nombre a ≥ `t·k` y borde inferior del nivel a ≥ `b·k`. Sustituye a `CARD_TEXT_WRAP` constante y a
  `NAME_DY`/`LEVEL_DY` fijos (hoy `LEVEL_DY` 55 invade la sombra inferior de 28). Si "Descripción más larga del
  catálogo" no cabe en 170 px de alto a ×1, se sube `CARD_HEIGHT` (constante de presentación; `cardLayout` ya está
  probado para alturas mayores).
- Zona de clic = rectángulo entero de la carta (márgenes incluidos): es el `Rectangle` de siempre.
- Tinta: los `Text` de la carta usan `button.ink.text` con NineSlice y `#ffffff` en reserva.

**HUD** (`createHud`): 3 `UiPanelPart` con la pieza `panel` detrás de los textos (`HUD_DEPTH − 1`). Nueva función
pura `hudPanels(layout, slice) → { left, center, right: CenteredRect }` en `uiLayout.ts`: cajas fijas calculadas
con textos de reserva por número de caracteres (`HUD_BASE.reserveChars`), no con el texto vivo, así que **no se
redimensionan por frame**; solo `HudPlacement.place` (RESIZE) llama a `place`. `HUD_BASE` gana `panelInset` 4 y
`margin`/filas suben para que el contenido quede a ≥ `panelInset + slice` del borde del panel (con `slice` 12:
`margin` 16 se mantiene en horizontal y las filas bajan 8 px, de 16/34/52/70 a 24/42/60/78, porque el texto de
14 px centrado en 16 empieza en 9 < 16; cifra final tras medir).
`hudPanels` **no** entra en `hudBoxes` (si no, el test de solapes vería el panel solapado con su contenido). Tinta:
textos del HUD con `panel.ink.text` si hay NineSlice; `#ffffff` en reserva. Las barras no cambian.

**Fuente en Phaser**: `TEXT_STYLE.fontFamily` = `'"<family>", monospace'` (dato del contenido) en HUD y cartas.

## 6. Fuente pixel OFL (elegida: **Departure Mono**; descarga aprobada, la hace el implementer en apply desde la release oficial, con su `OFL.txt`)
| | Candidata 1 (recomendada) | Candidata 2 |
|---|---|---|
| Nombre | **Departure Mono** (Helena Zhang) | **VT323** (Peter Hull) |
| Licencia | SIL OFL 1.1 | SIL OFL 1.1 |
| Formato | `DepartureMono-Regular.woff2` del paquete oficial de la release (GitHub `rektdeckard/departure-mono`; se extrae solo el `.woff2` y el `LICENSE`, nunca el `.zip`, que el guardarraíl prohíbe) | `vt323-latin-400-normal.woff2` de Fontsource (conversión ya publicada, sin tocarla) |
| Peso | Regular 400, una sola cara | Regular 400 |
| Monoespaciada | Sí (encaja con `MONO_CHAR_RATIO`) | Sí |
| A favor / en contra | Legible a 14–16 px; diseñada a múltiplos de 11 px (a 14/16 px no es nítida al píxel) | Muy pixel; x-height pequeña: a 14 px se lee peor |

Se descarta una blackletter pixel (p. ej. *Jacquard*): ilegible en texto corrido. Sin subconjuntos ni conversiones
propias: una modificación obligaría a renombrar si la fuente tiene *Reserved Font Name*.

Comprobaciones al descargar (tarea de contenido): glifos `á é í ó ú ñ ü ¿ ¡ « » · × →` (los que falten caen glifo a
glifo a `monospace`); avance real en em con `measureText` en `dev` — si supera 0,6, sube `MONO_CHAR_RATIO` y se
revisan `ui-layout`/`textBox`.

**Carga** (CSP `default-src 'self'` sin `font-src`). Se **descarta** `this.load.font` de Phaser: su `FontFile`
no tiene plazo (una fuente que no responde bloquearía el arranque, contra los 3.000 ms de la spec) y no emite
`FILE_LOAD_ERROR` cuando `FontFace.load()` falla. En su lugar, `src/infrastructure/dom/uiFont.ts`:
- `loadUiFont(fonts: FontLoaderLike, family, url) → Promise<boolean>`: `new FontFace(family,
  'url("<url>") format("woff2")')`, `load()`, `fonts.add(face)` y resultado `fonts.check('16px "<family>"')`;
  cualquier rechazo → `false` (sin errores no capturados). URL `/tfm-survivors/assets/fonts/<file>` (`fontUrl` en
  `assetUrl.ts`): mismo origen, sin `blob:` ni `data:`.
- `withDeadline(promise, ms, timer) → Promise<boolean>`: resuelve con el primero entre la carga y `timer(ms)`
  (→ `false`). `FONT_WAIT_MS = 3000` (constante con nombre, fijada por la spec) y `timer` inyectado (reloj de prueba
  en el escenario "Fuente que no responde"; `setTimeout` en composición).
- La composición la lanza en `bootstrap()`, en paralelo con la carga de Phaser, y pasa la promesa a `BootScene`
  (`deps.fontReady`). `BootScene.create()` hace `void fontReady.then(ok => { if (!ok) failed.push(family);
  onUiLoaded(...); scene.start(next) })`: el menú (o la partida con `?e2e`) espera como mucho 3.000 ms desde el
  arranque, y los `Text` de cartas y HUD nacen después, con la fuente ya registrada o con la caída (Phaser no repinta
  un `Text` cuando la fuente llega tarde; una fuente que llega tras el plazo solo afectaría al DOM, que sí repinta).
- Reserva: `var(--ui-font, monospace)` en CSS y `, monospace` en Phaser.

**Guardarraíl**: se amplía `guard-assets.mjs` a ficheros de fuente (`\.(woff2?|ttf|otf)$`, sin distinguir
mayúsculas); `OFL.txt` debe estar versionado y contener `SIL OPEN FONT LICENSE Version 1.1` (el contenido lo lee el
test de "Fuente registrada"; el guardarraíl comprueba que está versionado y su sha256 si se registra). Justificación: el
criterio de éxito exige "licencia OFL anotada" con el guardarraíl en verde, y sin ampliarlo nada impide versionar
una fuente sin licencia (todo `public/` se publica). Reglas nuevas, aplicadas a una lista **separada** `fonts[]` de
`content/asset-provenance.json` (la cabecera CC0 del pack no cambia): `path`, `family`, `author`, `source` (URL de
la release), `version`, `license` = `"OFL-1.1"`, `licenseFile` (ruta versionada, p. ej.
`public/assets/fonts/OFL.txt`), `sha256` y `bytes`; toda fuente versionada necesita entrada; `licenseFile` debe
estar versionado. Ver ADR-0028.

## 7. Procedencia
- 8 PNG en `files[]` (Tiny Swords, CC0, `version` "Update 010"), con `path`
  `public/assets/tiny-swords/UI/<Banners|Buttons|Ribbons>/<fichero>` y `source`
  `Tiny Swords (Update 010)/UI/<…>`, `sha256` y `bytes` medidos al copiar.
- 1 `.woff2` + `OFL.txt` en `fonts[]` (§6). El `OFL.txt` no es gráfico ni fuente: no necesita entrada propia, pero
  la regla `licenseFile` lo exige versionado.

## Piezas por capa
| Capa | Pieza | Nueva/Mod. | Notas |
|---|---|---|---|
| domain | — | — | Sin cambios |
| application | — | — | Sin cambios |
| infrastructure | `content/appearanceSchema.ts` (`UiSchema`, `UI_PIECES`, `checkUiInk`, errores) | Mod. | Presentación, no llega al dominio |
| infrastructure | `content/loadAppearance.ts` (`uiImagesOf`, registro de imágenes y fuente) | Mod. | |
| infrastructure | `dom/uiKit.ts` (`uiKitVariables`, `applyUiKit`) | Nueva | Puras / CSSOM |
| infrastructure | `dom/uiFont.ts` (`loadUiFont`, `withDeadline`, `FONT_WAIT_MS`) | Nueva | `FontFace` con plazo de 3.000 ms |
| infrastructure | `src/styles.css` | Mod. | Bloques compartidos; clases y DOM intactos |
| infrastructure | `phaser/ui/uiPanel.ts` (`nineSliceGeometry`, `UiPanelPart`, `NineSlicePanel`, `NO_PANEL`, `createUiPanel`) | Nueva | |
| infrastructure | `phaser/bootPlan.ts`, `BootScene.ts` (imágenes de UI, espera de `fontReady`, `NEAREST`, `failed`, aviso de piezas cargadas) | Mod. | |
| infrastructure | `phaser/sceneWidgets.ts`, `UpgradeOverlay.ts`, `cardLayout.ts`, `ui/uiLayout.ts` (`hudPanels`, `HUD_BASE`) | Mod. | |
| composition | `main.ts`, `contentBoot.ts`, `assetUrl.ts` (`fontUrl`) | Mod. | Al terminar `BootScene`, `applyUiKit(root.style, uiKitVariables(...))` con las piezas cargadas |
| contenido | `content/appearance.json` (`ui`), `content/asset-provenance.json` (8 PNG + `fonts[]`) | Mod. | |
| guardarraíl | `.claude/hooks/guard-assets.mjs` (+ `tests/guardrails/assets.test.ts`) | Mod. | Fuentes con OFL |

## Flujo
1. `bootContent` valida `appearance` (incluida `ui`) y la nota → error de contenido por la vía de siempre.
2. `bootstrap()` lanza `withDeadline(loadUiFont(...), FONT_WAIT_MS, setTimeout)` → `fontReady`.
   `BootScene.preload`: hojas de siempre + 8 imágenes de UI. `FILE_LOAD_ERROR` → `failed`.
3. `BootScene.create`: filtro `NEAREST` a las de UI; espera `fontReady` (≤ 3.000 ms; `false` → `failed`);
   `deps.onUiLoaded(loaded)` con las claves de UI cuya textura existe. La composición publica las variables CSS
   (§4). Después arranca menú o partida (como hoy).
4. Menú y paneles DOM se pintan con las variables (o sin imagen = reserva). `GameScene.create` crea cartas y HUD con
   `createUiPanel` (NineSlice o `NO_PANEL`).
5. RESIZE (`watchScreen` / `applyUiScale`): `--ui-scale` cambia y el CSS recalcula; `UpgradeOverlay.relayout` y
   `HudPlacement.place` llaman a `place(rect, k)` sobre los mismos objetos.

## Dependencias nuevas
| Paquete | Versión exacta | Motivo | Alternativa descartada |
|---|---|---|---|
| — (ninguna npm) | — | La fuente es un fichero estático en `public/`, no un paquete | `@fontsource/*` como dependencia: añade un paquete para un solo fichero y lo importaría por Vite fuera de `public/assets/` |

## Rendimiento y seguridad
- **Presupuesto**: 0 ms/tick en el núcleo (no se toca). En render, 3 NineSlice de carta + 3 de HUD (equivalen a 9
  sprites cada uno, en el mismo lote WebGL), creados una vez; el HUD solo llama a `place` en RESIZE. Ningún objeto
  por frame. Carga: 8 PNG (≈ 5–20 KB cada uno, cifra real en la nota) + 1 `woff2` (≈ 20–40 KB); el `border-image`
  reutiliza la caché HTTP de la carga de `BootScene` (misma URL). Bundle JS: solo el esquema y dos módulos pequeños.
- **Objetos del mapa**: la UI no entra en `planMapArt`: 820/904 en 42/123 sin cambios.
- **Determinismo**: ningún flujo de azar ni colocación; `BALANCE_BASELINE`, `BUILDER_REFERENCE` y las seis firmas
  idénticas por construcción (diff de `src/domain` y `src/application`: 0 líneas).
- **CSP**: no cambia. Imágenes `img-src 'self'`, fuente por `default-src 'self'` (sin `data:`), variables por
  CSSOM. Las URL de las variables salen de rutas validadas por regex y codificadas: no hay inyección de CSS.
- **Datos persistidos**: ninguno nuevo. Entradas externas: ninguna nueva (el contenido es del repo y pasa por zod).
- **Licencias**: la OFL obliga a distribuir el aviso: `OFL.txt` se publica junto a la fuente y el guardarraíl lo
  exige.

## Riesgos
- **R1 Desborde**: tienda con 7 filas a ×1 en 1.280 × 720 (marco de botón 20 + 28 px por fila) → scroll interno
  de la lista (§4). Guía: ya hace scroll; su `padding` sube a ≥ 12 px. Obra: 2 opciones, cabe. Cartas: área útil
  240 − 40 = 200 px (antes 208): algún nombre o descripción largo puede pasar a una línea más; si no cabe en alto,
  sube `CARD_HEIGHT`.
  Verificación: test de layout puro (anchos por `MONO_CHAR_RATIO` contra área útil a ×1 y ×2) y revisión visual
  manual en `preview` a 1.280 × 720 y 2.560 × 1.440 (no hay test visual automático).
- **R2 Medidas provisionales**: si el script da `slice` mayores, solo cambian datos (`appearance.json`) y quizá
  `HUD_BASE.margin`/filas; el test de IHDR y el de contraste atan los valores.
- **R3 Tests que pueden romper**: `ui-layout.test.ts` (literal de filas `[52, 70]` y `140` a ×2 si bajan las filas:
  pasarlos a `HUD_BASE`); `screen-frame` y `viewport-probe` no (no cambia `ScreenFrame`); `build-gate`/`shop-gate`
  no (no cambian puertas ni DOM); tests de `UpgradeOverlay` y de `createHud` con dobles (nuevo `frame` en
  `CardParts` y paneles: ampliar dobles de `tests/support/feedback.ts` o equivalentes con `nineslice` y
  `textures.exists`); `bootPlan`/`imagesToLoad` (más imágenes); tests de procedencia (`*-provenance.test.ts`) si
  cuentan entradas; `assets.test.ts` (reglas nuevas). E2E: selectores, roles y sondas no cambian; `probe.ts`
  intacto. Si el CI cayera a Canvas, las cartas y el HUD usarían la reserva (sin fallo).
- **R4 Fuente**: descarga aprobada; si la release no trae `woff2` o le faltan glifos clave, el implementer se para
  y lo consulta (no convierte formatos: sería una modificación). La espera de 3.000 ms solo se alcanza si el
  servidor no responde; en local y en Pages la fuente llega en decenas de ms.
- **R7 Filas del HUD**: bajan 8 px a ×1 (el anclaje a los bordes no cambia). La spec delta de `hud` dice que el
  anclaje no cambia y no fija cifras; lo comprueban los tests relativos de `ui-layout`.
- **R8 Proposal frente a specs**: la proposal decía "reserva = aspecto actual" para todas las superficies; la spec,
  por decisión del autor, cambia la del panel DOM (fondo = relleno de `panel` y sus tintas). Mandan las specs. El
  resto de criterios de la proposal (8 piezas, 1 NineSlice por carta, esquinas `margen × k`, sin desborde, zod,
  guardarraíl, balance y firmas, 1 E2E ampliado) casa con las specs; la proposal no menciona el plazo de 3.000 ms
  ni la regla de rojo de `danger`, que son añadidos de las specs.
- **R5 CSS compartido**: menú, pausa y diálogo comparten bloque: un error rompe los tres (también la reserva). El
  test estático de CSS (§8) y el E2E ampliado lo mitigan.
- **R6 `image-rendering` en `border-image`**: Chromium lo aplica a imágenes de borde; si no, a ×2 se vería suave
  (cosmético, sin efecto funcional).

## 8. Plan de pruebas (ADR-0018: todo es infraestructura/contenido → *test-after*; e2e-lite)
- **Esquema** (`tests/infrastructure/appearance-ui.test.ts`): `ui` válida; falta una pieza, margen negativo o no
  entero, `header` sin `height`, tinta con contraste < 4,5, fuente con extensión ≠ `.woff2`, imagen no registrada,
  fuente no registrada → error con su campo.
- **IHDR** (mismo fichero, patrón `tests/support/looks.ts`): cada `image` versionada mide lo esperado y
  `l + r < ancho`, `t + b < alto` (3-slice: `alto = height`).
- **CSS variables** (`tests/infrastructure/dom/ui-kit.test.ts`): `uiKitVariables` solo emite variables de piezas
  cargadas, URL con base `/tfm-survivors/`, `--ui-font` siempre; con `loaded` vacío, nada salvo la fuente.
- **CSS estático** (`tests/infrastructure/dom/styles-ui.test.ts`, lee `src/styles.css`): los 7 selectores usan
  `var(--ui-panel-src`, `border-image-width` con `--ui-scale`, ningún `url(` literal, reserva presente en cada
  `var()` de color.
- **Geometría Phaser** (`ui-panel.test.ts`): `nineSliceGeometry` a ×1 y ×2 (esquina = `slice × k`, total = rect);
  `hudPanels` sin solapes entre paneles a 960…3.840 y conteniendo sus cajas con `slice` de margen; área útil de
  carta y `LEVEL_DY`/`NAME_DY` dentro.
- **Fábricas con dobles** (`upgrade-overlay`/`hud` widgets): con textura y WebGL, 1 NineSlice por carta (3) y 3 en
  el HUD; sin textura o con Canvas, 0 NineSlice y el `Rectangle` de la carta con su trazo de hoy; RESIZE llama a `place` sin crear objetos.
- **BootScene/bootPlan/uiFont**: `imagesToLoad` incluye las 8 de UI; `loadUiFont` con la URL de la base; fuente
  que rechaza o no pasa `check` → `false` y `failed`; con un temporizador de prueba que nunca resuelve la carga, el
  menú arranca al llegar a 3.000 ms y los `Text` usan la caída.
- **Guardarraíl** (`tests/guardrails/assets.test.ts`): fuente sin entrada, licencia ≠ OFL-1.1, `licenseFile` no
  versionado → error; caso válido en verde.
- **E2E**: **0 nuevos, 1 ampliado** de la suite `logic` (el de humo que ya abre el menú y vigila errores de CSP):
  `getComputedStyle(.menu-panel).borderImageSource` contiene `UI/Banners/Carved_9Slides.png`,
  `borderImageWidth` = `12px` a ×1 (1.280 × 720), y `document.fonts.check('16px "<family>"')` es `true`; sin
  violaciones de CSP. Ningún selector, rol ni sonda cambia.
- **Balance y firmas**: el `verify` completo ejecuta los lotes de siempre; deben dar `BALANCE_BASELINE` y
  `BUILDER_REFERENCE` idénticos, 0 quietos y las seis firmas sin cambios (no se regeneran).

## ADRs
- `docs/adr/0028-kit-de-ui-por-variables-css-y-fuente-ofl.md` (número confirmado libre en `origin/main`).
