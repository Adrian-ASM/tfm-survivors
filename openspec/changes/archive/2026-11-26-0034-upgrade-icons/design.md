# Design · 0034-upgrade-icons

## Resumen
Cada mejora (15) y la curación de la tienda se pintan con un PNG de 64 × 64 propio. El PNG se liga por id en una
sección nueva `icons` de `content/appearance.json`. La composición cruza esos ids con `upgrades.json` y `shop.json`
al arrancar. `BootScene` carga los iconos como imágenes con filtro `NEAREST`. La carta (Phaser) gana un `Image`
preasignado sobre el nombre, dentro de un hueco reservado por el layout puro (carta de 240 × 240 × k). La fila de la
tienda (DOM) gana un `<img>` del mismo origen con `image-rendering: pixelated`. Si un icono falta o no carga, se pinta
la reserva de su categoría (obligatoria en los datos). Si también falla la reserva, el hueco queda vacío (estado
`none`) y el resto de la carta o de la fila no cambia. Las imágenes IA tienen su propia lista `generated[]` en la nota
de procedencia, vigilada por `guard-assets` y limitada a `public/assets/icons/` (ADR-0030). Núcleo intacto.

Vía de consulta de la API de Phaser: MCP `phaser-docs` (búsqueda en el API), contrastada con los tipos de
`node_modules/phaser` 4.2.1 y con el código que ya usa esas llamadas:
- `Texture.setFilter(FilterMode.NEAREST)`: aplica a toda la textura. Ver
  `https://phaser.io/oss/docs/api-documentation/class/textures-texture.md#instance-setfilterfiltermode` (ya se usa
  en `BootScene` para las piezas de UI desde 0032).
- `Image.setTexture` / `setDisplaySize` / `setOrigin` / `setVisible`. Ver
  `https://phaser.io/oss/docs/api-documentation/class/gameobjects-image.md#inherited-methods`.
- Un `Image` sin `setInteractive` no participa en el hit test, así que el clic sobre el icono llega a la zona de clic
  de la carta (el `Rectangle` transparente de 0032).
- El cargador con `imageLoadType: 'HTMLImageElement'` ya está fijado en `main.ts` (design 0012 D2). Las imágenes se
  piden con `<img>`, así que la CSP no cambia.

## Cambios tras contrastar con las specs delta (fase tasks)
Las specs se escribieron después de la primera versión de este design. Se corrigió:
1. **Reservas obligatorias** (`sprite-rendering`, "Datos de los iconos de mejora" y "Datos de iconos inválidos": "sin
   la reserva de arma" es error). Antes eran opcionales. `fallback.character` y `fallback.weapon` son rutas
   obligatorias; el campo `color` desaparece.
2. **Tercer estado = sin icono** (`sprite-rendering` "Resolución del icono", `castle-shop` "la fila MUST ocultar el
   icono", URL nunca `data:`). Se retira el disco teñido de Phaser y el círculo SVG `data:` del DOM. El estado se llama
   `none`: `Image.setVisible(false)` en la carta y atributo `hidden` en el `<img>` de la fila.
3. **La lista IA referencia el ADR** (`asset-provenance`, "Política sin ADR"): campo `generatedPolicy` en la nota.
4. **Campos de `generated[]`** iguales a los de la spec: sin `termsCheckedOn` (la fecha de lectura va dentro del
   texto de `terms`); campo desconocido = error; `createdOn` con fecha de calendario válida (`2026-02-30` falla).
5. **Rutas de icono solo de la lista IA** y hojas/piezas solo de la lista de arte ("Imágenes con IA solo en los
   iconos"): `parseAppearance` recibe dos conjuntos separados en lugar de mezclar `generated` en `registeredPaths`.
6. **Esquinas transparentes** ("Iconos del repositorio medidos"): el test de contenido descomprime el PNG con
   `node:zlib` para leer el alfa de las 4 esquinas, no solo la cabecera IHDR.
7. **"Icono de más"** se comprueba en el test existente de "Solo las hojas usadas", ampliado a la lista IA.
8. **E2E**: la spec pide un solo escenario ("Iconos en la oferta y en la tienda [E2E]", todo `painted`, 0 violaciones
   CSP, semilla 42). Se amplía **un** test (el de la Tienda) en lugar de dos, y sin `page.route`: el fallo de carga se
   cubre con dobles. Se retira el ayudante `tests/support/icons.ts`.
9. **Integración por lotes** con reservas obligatorias: la sección `icons` es opcional en el esquema solo mientras
   duran los grupos de código; la primera tarea de contenido (las 2 reservas) la hace obligatoria (D9).

## Decisiones

### D1 · Datos: sección `icons` en `appearance.json`
```json
"icons": {
  "fallback": { "character": "fallback-character.png", "weapon": "fallback-weapon.png" },
  "byId": { "guardrail": "guardrail.png", "…": "…", "heal": "heal.png" }
}
```
- Las rutas son relativas a `public/assets/icons/` (`ICON_DIR`, constante nueva junto a `ASSET_DIR` y `FONT_DIR`).
  Es una carpeta propia, fuera de `public/assets/tiny-swords/`: el arte IA no se mezcla con el del pack (ADR-0012).
- zod (`appearanceSchema.ts`):
  - `IconFile = /^[a-z0-9-]+\.png$/`: plana, sin `..`, sin `/` inicial, sin esquema ni subcarpetas. Cumple y
    endurece las reglas de ruta de "Datos de aspecto validados" (los ocho casos de `armor` fallan aquí o en el
    registro);
  - `byId: z.record(UpgradeIdLike, IconFile)`, que puede estar vacío ("Mejora sin entrada" es válida);
  - `fallback: strictObject({ character: IconFile, weapon: IconFile })`, ambos obligatorios;
  - todo con `strictObject` (el campo extra `size` falla), como el resto del fichero.
- `parseAppearance` exige que `ICON_DIR + file` figure en el conjunto **`generated`** (D8), con el mensaje
  `ICON_NOT_REGISTERED` y la ruta del campo (`icons.byId.<id>` o `icons.fallback.<cat>`). Una ruta de la lista de arte
  o de la fuente nunca está en ese conjunto, así que falla.
- La cobertura final (16 claves) la exige un test de contenido, no el esquema.
- Se descarta poner un campo `icon` en `upgrades.json`, porque mezcla aspecto con contenido de simulación y cambiaría
  la huella del contenido (exploración, opción B).

### D2 · Cruce de ids en la composición
- `checkIconRefs(appearance, config): Result<IconCatalog, DomainError>` vive en `src/composition/contentBoot.ts` y lo
  llama `bootContent` justo después de `checkAppearanceRefs`.
- Ids válidos: los de `config.upgrades.character` (categoría `character`), los de `config.upgrades.weapons`
  (`weapon`) y `config.shop.heal.id` (`weapon`).
- Una clave de `byId` fuera de ese conjunto da `invalidConfig('icons.byId.<id>', ICON_UNKNOWN_ID)`, que se muestra
  con `showContentError` como el resto del contenido (con y sin `?e2e`).
- Una mejora sin entrada **no** es error: usa la reserva de su categoría.
- `IconCatalog` es un valor de presentación congelado (`src/infrastructure/icons/upgradeIcons.ts`):
  `entries: ReadonlyMap<id, { file: string | null; category }>` con todos los ids válidos, más `fallback`.
  `BootedContent` gana `icons`.
- **La curación usa la reserva de arma** ("la reserva de la curación" de las specs): es un artículo de la tienda y la
  reserva comunica "artículo de tienda". Una tercera reserva costaría otra imagen IA, y la proposal fija 2 categorías.

### D3 · Resolución del icono (función pura, una sola regla para Phaser y DOM)
`resolveIcon(catalog, id, loaded: ReadonlySet<string>) → { state, key | null, file | null }`, con
`state ∈ 'painted' | 'fallback' | 'none'`:
1. Si la entrada tiene `file` y su clave `icon:<file>` está en `loaded`, `painted`.
2. Si no, y la reserva de su categoría está en `loaded`, `fallback`.
3. Si no, `none`: sin clave ni fichero; el hueco queda vacío.

No depende del snapshot, del tick ni del reloj. `loaded` lo publica `BootScene` (D5). Un id ausente del catálogo, que
no ocurre tras D2, se trata como `character` sin `file`. La clave lleva el prefijo `icon:` para que no choque con las
claves de hoja (= ruta de fichero dentro de `tiny-swords/`).

### D4 · Carta: hueco del icono en el layout puro
Medidas reales a ×1, contrastadas con `appearance.json` (`button.slice` l 20, t 20, r 20, b 28) y `upgrades.json`
(9 de personaje):
- Área de texto actual: ancho 240 − 2 · 20 = 200 px, fuente 14, `MONO_CHAR_RATIO` 0,64, así que caben 200 / 8,96 =
  **22,3 caracteres por línea**. Alto de línea 17,5.
- Alto útil actual: 170 − 20 − 28 = 122. El peor caso real (nombre de 1 línea y descripción de 3, por ejemplo
  "Cada golpe te quita menos vida, pero siempre al menos 1.") ocupa 17,5 + 6 + 52,5 = 76 sobre el nivel (17,5).
  Sobran unos 28 px: **no cabe** un icono de 64 encima sin crecer.
- Al lado, el icono deja 200 − 64 − 6 = 130 px, unos 14 caracteres por línea. Las descripciones pasan a 4–5 líneas y
  tampoco caben. Por eso el icono va **arriba y centrado**.

Decisión:
- `CARD_HEIGHT` pasa de 170 a **240** (carta cuadrada).
- `CARD_ICON_SIZE` vale **64** y la separación con el nombre es `CARD_TEXT_GAP` (6).
- Icono con origen (0,5, 0) en `(t.x, top + m.top·k)` y tamaño `64·k`. A ×1 y ×2 la escala es entera (1 y 2); con k
  fraccionario se aplica `NEAREST` sin redondeo, y se acepta píxel desigual (riesgo R2 de la proposal).
- El nombre empieza en `nameTop = top + m.top·k + (64 + 6)·k`. La descripción y el nivel siguen la regla actual,
  con el nivel anclado abajo. El hueco existe siempre: con `none` el `Image` se oculta y los textos no se mueven.

Comprobación a ×1 con pieza, en px desde el borde superior de la carta:

| Caso | Icono | Nombre | Descripción | Fin del contenido | Inicio del nivel | Holgura |
|---|---|---|---|---|---|---|
| Peor real (1 + 3 líneas, "Escudo de roble") | 20–84 | 90–107,5 | 113,5–166 | 166 | 194,5 | 28,5 |
| "Amuleto del saqueador" (2 + 2) | 20–84 | 90–125 | 131–166 | 166 | 194,5 | 28,5 |
| Hipotético 2 + 3 | 20–84 | 90–125 | 131–183,5 | 183,5 | 194,5 | 11 |
| Sin pieza (márgenes 16), peor real | 16–80 | 86–103,5 | 109,5–162 | 162 | 206,5 | 44,5 |

El layout es lineal en k y el número de caracteres por línea no depende de k (ancho y fuente escalan igual). Por
tanto la tabla vale a ×2 y con cualquier k fraccionario, con todas las medidas multiplicadas por k. En horizontal el
icono queda a (240 − 64)/2 = 88·k de cada borde, por encima de max(16, l)·k.

Pieza pura nueva en `cardLayout.ts`, `cardContentLayout(rect, margins, k, nameLines)`, que devuelve
`{ x, wrapWidth, icon: { x, top, size }, nameTop, descriptionTop, levelBottom }`. `UpgradeOverlay.placeCard` la usa
en lugar del cálculo en línea. Su test genera las cajas de icono, nombre, descripción y nivel con `wrapLines` y los
textos reales de las 9 mejoras de personaje, con k ∈ {1, 2, 1,4066}. Comprueba que las cajas no se solapan y que todas
quedan dentro del área útil.

Impacto en el modo móvil (`fitsAt`/`maxUiScale`): las 3 cartas siguen limitadas por el **ancho** (768·k) en
apaisado:
- 1.385 × 640 (844 × 390 CSS): k_max = 1.385 / 768 = 1,80; el límite de alto pasa de 3,76 a 640 / 240 = 2,67. Con
  k = 1,4066 la carta mide 337,6 px de alto, dentro de 640.
- 960 × 720: 1,25 frente a 3,0.
- `fitsAt(960, 720, 1)` y `maxUiScale(960, 540) ≥ 1` siguen siendo ciertos.

Ni k_max ni los tests de `mobile-frame` cambian. Sí cambian los tests que fijan 170 (`card-layout`, `upgrade-overlay`;
`ui-panel` usa 170 como dato propio y no depende de la constante).

`CardParts` gana `icon: CardIcon`, una costura con `setTexture(key)`, `setDisplaySize`, `setPosition` y
`setVisible`. La crea `createUpgradeOverlay` una vez por carta (3 `Image`, profundidad `OVERLAY_DEPTH + 2`, sin
`setInteractive`). `UpgradeOverlay` recibe `iconFor(id) → IconChoice` y solo llama a `setTexture` en `sync`, cuando
cambia la oferta; en cada `layout` (RESIZE) solo recoloca. No crea objetos por frame. El `Image` funciona también en
Canvas: allí `NineSlice` cae a reserva, pero el icono no.

### D5 · Carga (`bootPlan` / `BootScene`)
- `iconImagesOf(appearance): ImageLoad[]` devuelve los ficheros únicos de `byId` y de `fallback`, con clave
  `icon:<file>`. `BootScene.preload` los pide con `deps.iconUrl(file)`.
- En `create`, `BootScene` aplica `NEAREST` a cada clave que existe y avisa con `deps.onIconsLoaded(loaded)`, igual
  que `onUiLoaded`.
- Los fallos quedan anotados en `failed` por `FILE_LOAD_ERROR`, como hoy. No lanza y no cuentan como reserva de sprites.
- `iconUrl(base, file) = base + 'assets/icons/' + encodeURIComponent(file)` vive en `composition/assetUrl.ts`.

### D6 · Tienda (DOM)
- `ShopPanel` recibe un `IconBook` (dependencia de la composición). Es el `IconCatalog` más el conjunto `loaded` que
  rellena `onIconsLoaded` (antes de la carga todo es `none`; la tienda no puede abrirse antes).
- Cada fila antepone un `<img class="shop-panel__icon" alt="" width="64" height="64">` con `src` igual a
  `iconUrl(file)`. Con `none` el `<img>` sigue en la fila (el DOM tiene siempre 1 imagen por fila) con el atributo
  `hidden` y sin `src`. Nunca `data:` ni `blob:`. Es decorativo: el nombre accesible de la fila no cambia. Al estar
  dentro del botón de la fila, el clic sobre el icono es un clic en la fila.
- Sin estilos en línea (CSP `style-src 'self'`). `width` y `height` son atributos HTML, no estilo.
- CSS (`styles.css`):
  - `.shop-panel__product` pasa a `grid-template-columns: auto 1fr auto auto`;
  - `.shop-panel__icon` ocupa `grid-column: 1; grid-row: 1 / span 2`, mide `calc(32px * var(--ui-scale, 1))` de ancho
    y de alto y lleva `image-rendering: pixelated` y `align-self: center`; `.shop-panel__icon[hidden]` con
    `display: none` (que gana a la regla de rejilla);
  - descripción y aviso pasan a `grid-column: 2 / -1`.
- 32 px a ×1 (escala exacta 1/2) y 64 a ×2 (nativo). Así el icono cabe en el alto de las 2 líneas de texto
  (≈ 14 · 1,2 + 0,85 · 14 · 1,2 ≈ 31 px) y en el `min-height` del botón con pieza ((20 + 28) · s). El alto de la fila
  y el scroll de 0032/0033 no cambian. En móvil `--ui-scale` vale 1: 32 px CSS ≤ 44 px, y la fila entera sigue en
  ≥ 44 × 44.
- `ShopProductView` gana `icon: IconState` (sonda `__sprint.shop`).

### D7 · Sonda E2E
- `__sprint.shop.products[i].icon` (D6); `products` ya está vacío con la tienda cerrada.
- `__sprint.offerIcons`: getter de `readonly { id; icon: IconState }[]` de las cartas visibles (`[]` sin oferta y
  en el menú), servido por `UpgradeOverlay.iconStates` a través de `GameScene`.
- Hace falta porque el estado del icono no se ve en el snapshot del núcleo, y permite el E2E sin comparar píxeles.

### D8 · Procedencia IA (`guard-assets`, listas registradas, ADR-0030)
Lista nueva `generated[]` en `content/asset-provenance.json`, con el patrón de `fonts[]` (0032), y campo
`generatedPolicy` con la ruta del ADR:
```json
"generatedPolicy": "docs/adr/0030-imagenes-generadas-con-ia-solo-para-iconos.md",
"generated": [{
  "path": "public/assets/icons/guardrail.png",
  "tool": "<herramienta y modelo>",
  "createdOn": "AAAA-MM-DD",
  "terms": "<URL de los términos sobre las salidas (leídos AAAA-MM-DD)>",
  "prompt": "<prompt completo, con el de estilo común>",
  "postProcess": "scripts/icons/remove-white-bg.ps1",
  "sha256": "<hex>",
  "bytes": 1234
}]
```
Reglas nuevas de `checkAssets`, que sigue siendo pura y con `digest` inyectado:
1. Todo gráfico versionado bajo `public/assets/icons/` necesita entrada en `generated[]` y **no** puede estar en
   `files[]`. Fuera de esa carpeta, `generated[]` no admite nada (Won't "enemigos dibujados con IA"). Solo `.png`.
2. El aviso actual "asset gráfico sin entrada" cuenta como registrada cualquier ruta de `files[]` o de `generated[]`.
3. Campos: `path`, `tool`, `terms`, `prompt` texto no vacío; `createdOn` `AAAA-MM-DD` y fecha de calendario válida;
   `sha256` (64 hex) y `bytes` como en `files[]`; `postProcess` opcional y, si está, versionado. Cualquier otro campo
   es error. Cada mensaje nombra la ruta y el campo.
4. `generatedPolicy` obligatorio si hay `generated[]`, y versionado bajo `docs/adr/`.
5. Una entrada repetida, una ruta en dos listas o una entrada sin fichero versionado es error. El sha distinto es
   error, y el mensaje incluye el sha medido para facilitar la corrección.
6. La cabecera del pack (Tiny Swords / Pixel Frog / CC0 / Update 010) y las reglas del Free Pack solo afectan a
   `files[]`: las entradas IA no tienen `version` ni `source`.

Listas en el arranque: `registeredPaths` sigue con `files[]` + `fonts[]` (hojas, piezas y fuente) y se añade
`generatedPaths` (`generated[].path`). `parseAppearance` comprueba hojas y piezas contra el primero e iconos contra
el segundo, así que una hoja que apunta a un icono falla con el nombre del aspecto o de la pieza, y un icono que
apunta a la hoja de `Arrow.png` o a la fuente falla con el nombre del id o la reserva. `ProvenanceLists` gana
`generated?`. La guarda de rutas, por hook y en CI, no cambia.

Post-proceso reproducible: `scripts/icons/remove-white-bg.ps1` versiona `process_icons.ps1` de la prueba,
parametrizado (origen, destino, lienzo 64, interior 52) y sin rutas de usuario. Usa PowerShell + `System.Drawing`
(Windows, la máquina del autor). Lo ejecuta el autor, no el CI: el CI solo comprueba sha y forma (test de contenido).

**Cambio de origen en apply (decisión del autor, grupo 6).** No se usan las 4 imágenes de prueba de Antigravity ni
`remove-white-bg.ps1` (no se crea). Los 18 iconos los dibuja el orquestador (Claude Code, Claude Opus 5.5) como pixel
art con un script determinista sin dependencias, `scripts/icons/draw-icons.mjs` (rejilla 32 × 32, bisel y contorno
automático, salida 64 × 64 RGBA transparente, ×2 por vecino más próximo). `node scripts/icons/draw-icons.mjs
public/assets/icons` los reproduce byte a byte (comprobado tras pasarlo por prettier: mismos sha256). Cada entrada de
`generated[]` registra `tool` "Claude Code (Claude Opus 5.5) · pixel art dibujado por script determinista",
`createdOn` 2026-11-26, los términos de consumo de Anthropic §4 (leídos 2026-11-26), un `prompt` con el encargo común,
el objeto y la función del script, y `postProcess` = `scripts/icons/draw-icons.mjs`. Matiz: el script no es un paso
*posterior* a una imagen, es el propio generador; se registra en `postProcess` porque es el campo que exige un script
versionado (D8, regla 3) y así el guardarraíl comprueba que está en el repositorio.

### D9 · Integración de los PNG separada del código
- Los grupos de código (D1–D8) se cierran **sin** sección `icons` en `appearance.json` y sin `generated[]`: el
  esquema acepta `icons` ausente solo de forma transitoria (catálogo sin ficheros, todo `none`). Los tests de código
  usan datos de prueba. Juego jugable y `verify` en verde.
- El grupo de **contenido** va por lotes:
  - lote 0: las 2 reservas, su entrada en `generated[]`, `generatedPolicy` y la sección `icons` con `byId` vacío; en
    la misma tarea `icons` pasa a obligatoria en el esquema (quitar el `optional` transitorio);
  - lotes 1..n: por cada icono disponible, el PNG en `public/assets/icons/`, su entrada en `generated[]` y su clave en
    `byId`. Una mejora sin PNG sigue en reserva.
- Ese grupo trae `tests/content/upgrade-icons.test.ts` y el lector `tests/support/pngProbe.ts` (firma, IHDR, IDAT
  con `node:zlib`, filtros 0–4, sin dependencias):
  - cada PNG de `generated[]` mide 64 × 64, profundidad 8, tipo de color 6 (RGBA), sin entrelazado, y sus 4 esquinas
    tienen alfa 0; el lector se prueba con copias alteradas (48 × 48, RGB, esquina opaca) que nombran el icono;
  - cada `byId` y cada reserva apuntan a una entrada de `generated[]` y viceversa (con "Solo las hojas usadas");
  - la cobertura completa (16 claves exactas y 2 reservas) se activa en la última tarea de contenido.
- Las 4 de prueba (`guardrail`, `shortcuts`, `strict-rules`, `heal`) entran solo si se recupera su prompt del
  historial de la herramienta y los términos lo permiten. Si no, se regeneran con prompt registrado.
- **Aplicado (grupo 6)**: con el cambio de origen de D8 los 18 PNG llegaron a la vez, así que 6.1–6.3 van en un solo
  lote (no hay lote 0 con `byId` vacío). El lector de forma vive en `tests/support/pngProbe.ts` (IHDR, esquinas y un
  codificador mínimo para las copias alteradas) sobre el decodificador de `tests/support/png.ts` de 0032, sin
  duplicarlo. Con `icons` obligatoria, los tests pasan `GENERATED_PATHS` (`tests/support/generated.ts`) como tercer
  argumento de `parseAppearance` y cuarto de `bootContent`, y el aspecto crudo de prueba copia la sección del
  repositorio.

## Piezas por capa
| Capa | Pieza | Nueva/Mod. | Notas |
|---|---|---|---|
| domain | — | — | Sin cambios (`OfferSnapshot`, `ShopProductSnapshot` intactos) |
| application | — | — | Sin cambios |
| infrastructure | `content/appearanceSchema.ts`, `loadAppearance.ts` (`ICON_DIR`, sección `icons`, `generatedPaths`) | Mod. | zod y rutas registradas (D1, D8) |
| infrastructure | `icons/upgradeIcons.ts` (`IconCatalog`, `IconCategory`, `IconState`, `resolveIcon`, `IconBook`) | Nueva | Puro salvo `IconBook` (conjunto rellenado una vez) |
| infrastructure | `phaser/cardLayout.ts` (`CARD_HEIGHT` 240, `CARD_ICON_SIZE`, `cardContentLayout`) | Mod. | Layout puro (D4) |
| infrastructure | `phaser/UpgradeOverlay.ts` (`CardIcon`, `iconFor`, `iconStates`), `sceneWidgets.ts` | Mod. | 3 `Image` preasignados |
| infrastructure | `phaser/bootPlan.ts` (`iconImagesOf`), `BootScene.ts` (`iconUrl`, `onIconsLoaded`, `NEAREST`) | Mod. | D5 |
| infrastructure | `dom/ShopPanel.ts`, `src/styles.css` | Mod. | `<img>` y rejilla (D6) |
| infrastructure | `phaser/GameScene.ts` (paso de `iconFor` y `offerIconsView`) | Mod. | Solo cableado |
| composition | `contentBoot.ts` (`checkIconRefs`, `BootedContent.icons`), `assetUrl.ts` (`iconUrl`), `main.ts` (`IconBook`, sonda `offerIcons`) | Mod. | D2, D5, D7 |
| guardarraíl | `.claude/hooks/guard-assets.mjs` (`generated[]`, `generatedPolicy`, `AI_DIR`) | Mod. | D8 |
| contenido | `content/appearance.json` (`icons`), `content/asset-provenance.json` (`generated[]`), `public/assets/icons/*.png`, `scripts/icons/remove-white-bg.ps1` | Nueva/Mod. | D9 |

No hay puertos nuevos: `CardIcon` e `IconBook` son costuras de testabilidad dentro de infraestructura, como
`CardText`, no puertos de dominio.

## Flujo
Arranque (una vez): `bootContent` hace parse → `parseAppearance` (hojas contra arte, iconos contra IA) →
`checkAppearanceRefs` → `checkIconRefs` (lleva a `IconCatalog` o a `showContentError`). Después `BootScene.preload`
pide hojas, UI e iconos; en `create` aplica `NEAREST` y llama a `onIconsLoaded(loaded)`, que rellena `IconBook`.

En partida no hay trabajo por tick. En cada frame `UpgradeOverlay.sync(offer)` solo actúa si cambia la clave de la
oferta, y entonces resuelve 3 iconos y llama a `setTexture`/`setVisible`. `ShopPanel.sync` solo reconstruye las filas
si cambia su clave, igual que hoy.

## Dependencias nuevas
| Paquete | Versión exacta | Motivo | Alternativa descartada |
|---|---|---|---|
| — | — | No se añade ninguna. El PNG se lee con `node:zlib` en los tests y el post-proceso usa `System.Drawing` de Windows | `pngjs` / `sharp`: dependencia nueva (y binario nativo en `sharp`) para un test de forma y un paso manual en una sola máquina |

## Rendimiento y seguridad
- Presupuesto por tick: 0 ms. No hay cambios en el núcleo y el render no hace nada por frame salvo cuando cambia la
  oferta (3 `setTexture`).
- Objetos del motor: 3 `Image` más, creados una vez. Los 820/904 objetos del mapa no cambian.
- Carga: 18 PNG de 64 × 64 (unos pocos KB cada uno, < 100 KB en total) en `public/`, fuera del bundle JS. Las
  imágenes del `<img>` del DOM reutilizan la caché HTTP de la carga de Phaser.
- Balance y firmas: no cambia ningún dato de `RunConfig` y `upgrades.json` queda intacto, así que `BALANCE_BASELINE`,
  `BUILDER_REFERENCE` y las seis firmas son idénticas por construcción (sigue el gate en `verify`).
- CSP: no cambia. Las imágenes son del mismo origen; no hay `data:` nuevos ni estilos en línea.
- Entradas externas: ninguna nueva. `appearance.json` y la nota se validan con zod y con el guardarraíl. Nada se
  persiste.
- Legal: un icono solo entra si los términos de su herramienta permiten publicar las salidas, con la URL y la fecha
  de lectura en `terms` (ADR-0030). Si no, se queda en reserva (revisión humana en el gate de verify).

## Cobertura prevista (e2e-lite)
- Unitarios y de infraestructura (test-after):
  - esquema `icons` y rutas registradas (incluidos los ocho casos de `armor` y hojas que apuntan a un icono);
  - `checkIconRefs` (id desconocido con y sin `?e2e`, mejora sin entrada, `heal`);
  - `resolveIcon` (tabla de 5 casos y reserva de otra categoría);
  - `cardContentLayout` con los textos reales a ×1, ×2 y k 1,4066;
  - `UpgradeOverlay` con dobles (3 iconos, `none` sin mover textos, Canvas/sin `button`, RESIZE sin crear, clic);
  - `ShopPanel` (`<img>` con URL propia, `hidden` en `none`, `alt` vacío, clic en el icono, `icon` en la vista) y
    `dom-unchanged` (1 imagen más por fila);
  - `iconImagesOf` y `BootScene` (NEAREST, `onIconsLoaded`), URLs bajo la base y en `dist/`;
  - partida de 3.600 ticks con iconos sin cargar (`ui-fallback-run`), simulación igual con y sin iconos;
  - `checkAssets` con `generated[]` (D8);
  - test de contenido de PNG y cobertura; "Solo las hojas usadas" con la lista IA.
- E2E: **1 ampliado** en `gameplay.spec`, el de la Tienda (`?e2e&manual&seed=42`, mapa real): en tienda, las 7 filas
  `painted`; tras salir, `stepUntil` hasta la primera oferta y las 3 cartas `painted`; escucha de
  `securitypolicyviolation` = 0. Solo puede ir en verde con el contenido completo, así que va después del grupo de
  contenido.
- Smoke remoto (a demanda, fuera del gate): `tests/remote/public.spec.ts` también pide los iconos (200 `image/png`).
- Núcleo: no hay tareas de `domain`/`application`, así que no aplica el rojo obligatorio (ADR-0018). Todo es
  test-after.

## Riesgos
- R1 · Estimación de ajuste: `wrapLines` con `MONO_CHAR_RATIO` 0,64 es una estimación. Con la fuente de caída
  (`monospace`), el ajuste real puede diferir. Hay 11 px de holgura en el peor caso hipotético y 28,5 en el real.
- R2 · Escala no entera: con k fraccionario (móvil), `NEAREST` deja píxeles desiguales. Se acepta (proposal).
- R3 · Contenido parcial por cupo: D9 permite cerrar el código con iconos en reserva, pero el change no pasa verify
  sin las 16 + 2 (escenario "Iconos del repositorio" y E2E todo `painted`).
- R4 · Términos de la herramienta sin leer: los decide el autor en el grupo de contenido. Sin términos válidos, el
  icono no entra y el change no cumple "Iconos del repositorio" hasta sustituirlo.
- R5 · El E2E de la Tienda ya es lento (mapa real, `test.slow()`); añadir los ticks hasta la primera oferta lo alarga.
  Se usa `stepUntil` con lecturas ligeras.

## ADRs
- `docs/adr/0030-imagenes-generadas-con-ia-solo-para-iconos.md` (propuesta; número confirmado libre en `origin/main`).
