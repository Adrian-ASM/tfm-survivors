# Design · 0028-menu-guide

## Resumen
`content/guide.json` (7 páginas con id fijo, título, párrafos e iconos) se valida con zod y se **interpola al
arrancar** dentro de `bootContent`, con un catálogo cerrado de marcadores que lee la `RunConfig` ya validada. Así
cualquier error (forma, orden, texto vacío, marcador desconocido o llave suelta) sale por `showContentError` antes
de que exista el menú. El modal `GuideModal` es DOM puro (`textContent`, atributos y clases). `MenuPanel` lo abre
a través de un estado nuevo `guide` de `MenuController`. Su listener `keydown` vive en `document` solo entre
`open()` y `close()`. No se toca el núcleo y no hay dependencias nuevas.

## Piezas por capa
| Capa | Pieza | Nueva/Mod. | Notas |
|---|---|---|---|
| domain | — | — | Sin cambios. Solo se **leen** `RunConfig`, `TICKS_PER_SECOND` y `OFFER_SIZE` (importarlos desde infraestructura está permitido). |
| application | — | — | Sin cambios. |
| content | `content/guide.json` | Nueva | 7 páginas sin ninguna cifra escrita a mano (§2). |
| infrastructure | `content/guideSchema.ts` | Nueva | Schema zod y constantes de error (§1). |
| infrastructure | `content/guideMarkers.ts` | Nueva | `GUIDE_MARKERS` (catálogo cerrado), `formatCount` y `formatSeconds` (§2). Funciones puras. |
| infrastructure | `content/loadGuide.ts` | Nueva | `parseGuide(raw, config): Result<Guide, DomainError>`: zod, después interpolación (§2). |
| infrastructure | `menu/MenuController.ts` | Mod. | Estado `guide`, `openGuide()` y `closeGuide()` (§4). |
| infrastructure | `dom/GuideModal.ts` | Nueva | Modal, paginación, teclado y foco (§3, §5). |
| infrastructure | `dom/MenuPanel.ts` | Mod. | 5.º botón en la 2.ª posición. Recibe el `GuideModal`, lo abre y cierra con el controlador (§4). |
| infrastructure | `dom/menuText.ts` | Mod. | `guide: 'Cómo jugar'`, `guidePrev: 'Anterior'`, `guideNext: 'Siguiente'`, `guideClose: 'Cerrar'`, `guidePage(n, total)` → `«n de total»` y el `alt` de cada icono. Son etiquetas de UI, no texto de páginas. |
| infrastructure | `dom/resourceIcons.ts` | Mod. | `ResourceIcons` pasa a `{ xp, gold, wood, meat, stone }` (§6). `BuildPanel` pide `Pick<ResourceIcons, 'wood' \| 'stone'>`, así que sus tests no cambian. |
| infrastructure | `src/styles.css` | Mod. | `.guide-modal*` (§7). |
| composition | `contentBoot.ts` | Mod. | `RawBoot.guide: unknown` y `BootedContent.guide: Guide`, que se valida en último lugar (§1). |
| composition | `main.ts`, `progressWiring.ts` | Mod. | Importan `guide.json`. `wireProgress(root, seedOf, menuGuide)` crea el `GuideModal` con `booted.guide` y los iconos, y se lo pasa a `MenuPanel`. `menu.show` llama también a `guideModal.close()`, que no hace nada si el modal ya está cerrado. |

Por qué en infraestructura: es presentación (como `appearance.json`, ADR-0012) y no afecta a la simulación.
`MenuController` ya vive en `infrastructure/menu` y se prueba en Node (ADR-0011).

## 1. Schema de `guide.json` y arranque

```ts
export const GUIDE_PAGE_IDS =
  ['movement', 'progression', 'resources', 'castle', 'sites', 'enemies', 'outcome'] as const;
export const GUIDE_ICONS = ['xp', 'gold', 'wood', 'meat', 'stone'] as const;
const Text = z.string().trim().min(1, GUIDE_TEXT_EMPTY);          // "   " cuenta como vacío
const Page = z.strictObject({
  id: z.enum(GUIDE_PAGE_IDS),
  title: Text.max(48, GUIDE_TITLE_TOO_LONG),                       // una línea en 960 × 540
  paragraphs: z.array(Text).min(1, GUIDE_PARAGRAPHS_EMPTY),
  icons: z.array(z.enum(GUIDE_ICONS)).optional(),                  // únicos (superRefine)
});
export const GuideSchema = z.strictObject({
  pages: z.array(Page).length(GUIDE_PAGE_IDS.length, GUIDE_PAGE_COUNT),
}).superRefine(/* pages[i].id === GUIDE_PAGE_IDS[i] → si no, ['pages', i, 'id'] GUIDE_PAGE_ORDER */);
```
- El orden de los temas lo fija el `id`, no la posición. Así un error nombra la página concreta
  (`guide.pages.3.id`) y no solo «la 4.ª».
- Error → `DomainError` con `field = 'guide.' + path` y el mismo trato de `unrecognized_keys` que en
  `parseAppearance`. El campo usa el índice de la ruta (empieza en 0), así que el mensaje termina en
  `(página n)` con n de 1 a 7. Así cumple «el error nombra la página 4» de la spec, p. ej.
  `guide.pages.3.paragraphs.0: … (página 4)`. Si al implementador le encaja, puede extraer esa conversión a un helper común; no es
  obligatorio.
- `bootContent` valida en este orden: `parseContent` → `parseAppearance` → `checkAppearanceRefs` →
  `checkTileScales` → **`parseGuide(raw.guide, config)`**. La guía va al final porque necesita la config.
- El `report` y el `return null` son los de siempre, así que la vía de `showContentError` es la de ahora
  (decisión 7).
- `RawBoot.guide` es **obligatorio**: un campo opcional con valor por defecto ocultaría arranques sin guía. Hay
  que añadir `guide: guideJson` en los 6 tests que llaman a `bootContent` (`content-boot`,
  `structure-appearance-boot`, `build-tower-regression`, `appearance-hazards`, `content-sheep`,
  `buildings-content`). Es un cambio mecánico.
- `main.ts` ya importa `cspSafeZod` antes que nada, y `guideSchema` se construye al cargar el módulo, igual que
  `appearanceSchema`. No hace falta tocar la CSP.

## 2. Marcadores e interpolación (pura, sin DOM)
- **Sintaxis**: `{clave}`. Vale en títulos y en párrafos. Lo que va entre llaves no tiene un patrón propio: o es
  una clave del catálogo, o es `GUIDE_MARKER_UNKNOWN`.
- **Algoritmo** (`interpolate(text, values)`):
  1. Recorre `/\{([^{}]*)\}/g`.
  2. Si una clave no está en el catalog, da `GUIDE_MARKER_UNKNOWN` con el campo `guide.pages.i.paragraphs.j` (o
     `.title`) y el marcador en el mensaje.
  3. Si tras sustituir queda `{` o `}`, da `GUIDE_BRACE_UNMATCHED`.
  - No hay escape de llaves porque ningún texto las necesita.
- **Catálogo** (`GUIDE_MARKERS: Readonly<Record<string, (c: RunConfig) => string | undefined>>`):
  - Se evalúa una sola vez con la config de arranque.
  - Si una entrada da `undefined` (fuente ausente, p. ej. un id de estructura renombrado), es error
    `GUIDE_MARKER_UNRESOLVED`.

| Marcador | Fuente | Formato | Valor por defecto |
|---|---|---|---|
| `run.duration` | `run.durationSeconds` | `formatClock` (mm:ss, ya en `phaser/hudFormat.ts`, sin motor) | `10:00` |
| `upgrades.offerSize` | `OFFER_SIZE` (dominio) | entero | `3` |
| `upgrades.characterCount` | `upgrades.character.length` | entero | `9` |
| `upgrades.weaponCount` | `upgrades.weapons.length` | entero | `6` |
| `progression.levelUpHealPercent` | `progression.levelUpHealPercent` | entero (el `%` va en el texto) | `10` |
| `resources.meat.healPercent` | `resources.meat.healPercent` | entero | `20` |
| `shop.heal.price` | `shop.heal.price` | entero | `8` |
| `buildings.house.wood` | `buildings.house.cost.wood` | entero | `15` |
| `buildings.house.incomeGold` | `buildings.house.income.gold` | entero | `1` |
| `buildings.house.incomeSeconds` | `buildings.house.income.everyTicks / TICKS_PER_SECOND` | `formatSeconds` | `30` |
| `buildings.tower.wood` | `buildings.tower.cost.wood` | entero | `30` |
| `buildings.tower.stone` | `buildings.tower.cost.stone` | entero | `15` |
| `structures.houseCount` | `structures.types['goblin-house'].count` | entero | `4` |
| `structures.towerCount` | `structures.types['goblin-tower'].count` | entero | `3` |

- `formatCount(n)`: entero con punto de miles fijo, de modo que 1800 da `1.800`.
  - No usa `Intl`, porque `es-ES` no agrupa los números de 4 cifras y el resultado dependería del motor.
- `formatSeconds(ticks)`: segundos con una decimal como mucho y coma decimal (`30`, `22,5`).
- **El catálogo es cerrado y mínimo**: un test exige que cada clave se use al menos una vez en `guide.json`. Las
  specs pueden quitar o añadir filas; solo entra lo que cite algún texto.
- **Sin cifras a mano**: un test sobre `content/guide.json` exige que ningún título ni párrafo contenga
  `[0-9]`. Todas las cifras salen de marcadores. Es una regla de contenido del repo, no del schema.
- Resultado de `parseGuide`: `Guide = { pages: readonly GuidePage[] }`, con
  `GuidePage = { id, title, paragraphs, icons }` ya interpolados y congelados. El modal no conoce los
  marcadores.

## 3. `GuideModal` (DOM, CSP estricta)
```
<div class="guide-modal" role="dialog" aria-modal="true" aria-labelledby="guide-modal-title"
     tabindex="-1" hidden>
  <header class="guide-modal__header">
    <h2 id="guide-modal-title">…</h2> <p class="guide-modal__page">1 de 7</p>
  </header>
  <div class="guide-modal__body">                <!-- scroll interno -->
    <p class="guide-modal__icons"><img class="resource-icon resource-icon--gold" alt="oro">…</p>
    <p>párrafo</p>…
  </div>
  <div class="guide-modal__actions">[Anterior] [Siguiente] [Cerrar]</div>
</div>
```
- Usa solo `createElement`, `textContent`, `setAttribute`, `className`, `hidden`, `replaceChildren` y
  `addEventListener`. Nada de `innerHTML` ni de atributo `style`.
- Los botones se crean con `button()` de `dom/button.ts`, y su `blur()` no estorba (§5).
- **Paginación**:
  - `index` está en [0, total − 1]. `next()` y `prev()` se quedan en los topes y no hacen nada en ellos.
  - Al cambiar de página se hace `render()`: título, «n de 7», iconos, párrafos, `body.scrollTop = 0`, y Anterior
    oculto (`hidden`) en la 1 y Siguiente oculto en la 7.
  - Cada `open()` vuelve a la página 1 («Al abrirlo se ve la página 1 de 7»).
  - Reconstruir 3–8 nodos por pulsación es trivial (nunca ocurre por frame).
- **API**:
  - `open(onClosed: () => void)` no hace nada si el modal ya está abierto.
  - `close()` es idempotente: llama a `onClosed` una sola vez y solo si el modal estaba abierto.
  - `get view(): { open, page, total, listening }` existe solo para los tests de Node. No es una sonda E2E.

## 4. Integración con el menú
- `MenuState` pasa a `'idle' | 'confirming' | 'guide' | 'leaving'`.
  - `openGuide()` solo funciona en `idle` (`idle → guide`). `closeGuide()` solo en `guide` (`guide → idle`).
  - Las demás opciones ya exigen `idle`, así que con la guía abierta Jugar, Exportar, Importar y Borrar datos no
    tienen efecto, como con `confirming`.
  - `show()` deja el estado en `idle`.
- En `MenuPanel` el botón «Cómo jugar» hace: si `controller.openGuide()`, entonces `setLocked(true)` y
  `guide.open(onClosed)`. `onClosed` hace `controller.closeGuide()`, después `setLocked(false)` y, el último paso,
  `guideButton.focus()`.
  - El orden importa: un botón `disabled` no recibe el foco.
- `MenuPanel` recibe el `GuideModal` como parámetro. Así no hay referencias circulares como las del
  `ConfirmDialog`, y la integración se prueba en Node sin `progressWiring`, que toca `localStorage`.
- `?e2e`:
  - El modal solo se abre desde el clic de «Cómo jugar». `BootScene` y `MenuScene` no lo conocen.
  - `menu.show` (Volver al menú) además lo cierra.
  - Por construcción, nunca aparece solo.

## 5. Teclado, foco y ciclo de vida del listener
- **Listener**:
  - `open()` hace `doc.addEventListener('keydown', this.onKey)` y `close()` hace
    `doc.removeEventListener('keydown', this.onKey)`. `onKey` es una propiedad flecha fija, la misma referencia
    en el alta y en la baja.
  - Fuera del modal no hay ningún `keydown` DOM: Esc en el menú sin modal sigue sin efecto.
- **`onKey(e)`** (spec «Pulsación», «Flecha mantenida», «Esc mantenido» y «Teclas con modificador»):
  1. Si la tecla no es `Escape`, `ArrowRight` ni `ArrowLeft`, sale sin tocar nada. R, 1, 2, 3 y WASD no hacen
     nada.
  2. Si lleva `altKey`, `ctrlKey` o `metaKey`, sale **sin** `preventDefault`: no bloquea Alt + ← («atrás»).
  3. Llama a `preventDefault()`: ni Esc ni las flechas desplazan la página, tampoco en las repeticiones.
  4. Si `e.repeat`, sale: una tecla mantenida es una sola pulsación.
  5. `Escape` llama a `close()`. `ArrowRight` llama a `next()` y `ArrowLeft` a `prev()`.
  - Esc mantenido: la primera pulsación cierra el modal y quita el listener. Las repeticiones solo llegan a Phaser
    (`window`), y en el menú no hacen nada. → seguida de Esc en el mismo frame: cada evento se trata en orden,
    así que avanza y después cierra; la siguiente apertura empieza en la página 1.
- **Interacción con Phaser**:
  - El `KeyboardManager` escucha `keydown` en `window` (`target`). Solo llama a `preventDefault()` en los códigos
    de `captures`, y nunca a `stopPropagation`.
  - El listener en `document` se ejecuta antes en el burbujeo, y no se mira `defaultPrevented`. Las capturas de
    Esc o de las flechas de `GameScene` no afectan al modal.
  - En el menú `GameScene` está parada y `MenuScene` no registra teclas (spec `main-menu`).
  - Fuentes consultadas:
    - MCP `phaser-docs`: `https://phaser.io/oss/docs/api-documentation/class/input-keyboard-keyboardmanager.md`
      (`target`, `captures`, `preventDefault`, `addCapture`).
    - Tipos y fuente de la 4.2.1 instalada: `node_modules/phaser/src/input/keyboard/KeyboardManager.js`
      (l. 202, 222, `preventDefault` solo en capturas; l. 230, `addEventListener('keydown')` en `target`).
- **Foco frente al `blur()` de 0009**:
  - `button()` ejecuta primero `onClick()` y después `b.blur()`, y `blur()` solo actúa si `b` aún tiene el foco.
  - Abrir: el clic en «Cómo jugar» hace `root.focus()` (con `tabindex="-1"`). El `blur()` posterior no hace nada
    porque el foco ya no está en el botón.
  - Anterior y Siguiente: `onClick` cambia de página y llama a `root.focus()`. El foco sigue en el modal, aunque
    el botón pulsado desaparezca en el tope.
  - Cerrar (botón o Esc): `setPanelHidden(root, true)` suelta antes el foco interior, y `onClosed` lleva el foco
    a «Cómo jugar».
  - No hay focus trap (decisión 3).

## 6. Iconos
- `resourceIcons(appearance, assetUrl)` devuelve los cinco iconos:
  - `gold` (`G_Idle`), `wood` (`W_Idle`), `meat` (`M_Idle`) y `stone` (`Deco/05`, la roca `medium`).
  - `xp`: la hoja de la gema si existe. Hoy es `shape: true`, y en ese caso es un **SVG en data URL** (un rombo
    con `placeholderColor`), generado por una función pura.
- Por qué el SVG en data URL:
  - `img-src 'self' data:` ya lo admite y el color ya está validado como `Hex` por zod, así que no hay inyección.
  - La alternativa de dar el color por CSS necesitaría un estilo inline (`style-src 'self'` lo bloquea) o
    duplicar el color en `styles.css`.
- No se añaden ficheros a `assets/` ni entradas a la nota de procedencia (decisión 4).
- El modal pinta `page.icons` en una fila bajo el título, con `.resource-icon` (frame 0 recortado por CSS) y el
  `alt` de `menuText`.
- Si una hoja no carga, el `<img>` muestra su `alt` y el navegador no lanza nada. El modal no espera a que carguen
  las imágenes ni escucha `error`, así que el título, el texto y los controles se pintan igual (spec «Hoja de icono
  que no carga»).
- Un test en Node lee la cabecera IHDR de `G_Idle` y `M_Idle` y comprueba que `alto == frameHeight`, es decir,
  hojas de una fila, que es la condición del recorte por `object-position`.

## 7. Layout y desbordamiento
- `.guide-modal`:
  - Hermano de los demás overlays en la rejilla de `#game` (`grid-area: 1 / 1`, centrado por
    `place-items`), con `z-index: 3`, como `.confirm-dialog`.
  - `font: calc(16px * var(--ui-scale, 1)) monospace`, `display: flex; flex-direction: column`.
  - `width: min(36em, calc(100vw - 2em))` y `max-height: calc(100vh - 2em)`.
- `.guide-modal__body`: `flex: 1 1 auto; min-height: 0; overflow-y: auto`. Cabecera y acciones son
  `flex: none`, así que siempre se ven enteras y el texto largo hace scroll dentro.
- **Escala de UI real**, comprobada en el código: `screenFrame` (`phaser/ui/screenFrame.ts`) da
  `uiScale = max(1, ⌊min(w / 960, h / 540)⌋)`.
  - A 960 × 540 es **×1**.
  - A 1.920 × 1.080 es **×2**: el lienzo mide eso, porque el tope `maxView` es 2.560 × 1.440.
  - La spec `hud` solo garantiza ×2 desde 2.560 × 1.440, y la delta dice «la que le corresponda». El E2E, por
    tanto, **no fija la escala**: solo comprueba la geometría.
- En `em`, 960 × 540 a ×1 y 1.920 × 1.080 a ×2 son la misma caja: 60 × 33,75 em. Con 1 em de margen, la caja
  mayor posible es 36 × 31,75 em.
- **Redimensionado**: el modal es DOM y no escucha `RESIZE`. Solo cambia `--ui-scale`, así que la página, el estado y
  el listener se conservan, y la rejilla lo vuelve a centrar (spec `world-camera` «Redimensionado con la guía
  abierta» y `main-menu` «Guía abierta al redimensionar»).

## 8. Plan de tests (ADR-0018: todo *test-after*, porque no hay núcleo)

En Node, con `fakeDom` ampliado: `focus()`, `scrollTop`, y `FakeDocument.addEventListener` y
`removeEventListener` con recuento por tipo y `dispatchKey(key, { repeat, altKey, ctrlKey, metaKey })`, que
informa de si se llamó a `preventDefault`. No se añaden
dependencias: el proyecto no usa jsdom.

| Test | Cubre |
|---|---|
| `tests/infrastructure/content/guide-schema.test.ts` | <ul><li>Repo válido.</li><li>6 u 8 páginas (`GUIDE_PAGE_COUNT`).</li><li>Orden.</li><li>Título o párrafo vacío o en blanco.</li><li>Campo desconocido.</li><li>Marcador desconocido, con campo y mensaje.</li><li>Llave suelta.</li><li>Icono repetido.</li></ul> |
| `tests/infrastructure/content/guide-markers.test.ts` | <ul><li>Valores por defecto: `10:00`, 15, 1, 30, 30, 15, 20…</li><li>Una config modificada se refleja (casa 20 madera da «20»).</li><li>`formatCount` y `formatSeconds`.</li><li>Cada clave se usa en `guide.json`.</li><li>`guide.json` sin dígitos.</li></ul> |
| `tests/composition/guide-boot.test.ts` | `bootContent` con guía inválida: `report` con `field` `guide.…` y `null`. Con la válida: `booted.guide` interpolada. |
| `tests/infrastructure/menu/menu-controller.test.ts` (ampliar) | <ul><li>`openGuide` solo en `idle`.</li><li>Con `guide`, el resto de opciones da `false`.</li><li>`closeGuide`.</li><li>`show()`.</li></ul> |
| `tests/infrastructure/dom/guide-modal.test.ts` | <ul><li>Abre en 1 de 7, sin Anterior.</li><li>6 × Siguiente o → llega a 7 de 7, sin Siguiente; → otra vez sigue en 7; ← en 1 sigue en 1.</li><li>Esc y Cerrar: `onClosed` ×1 y 0 listeners.</li><li>Abrir dos veces deja 1 listener.</li><li>Las teclas con modificador se ignoran.</li><li>Foco en el modal y foco tras pulsar Siguiente.</li><li>Iconos: `src` y `alt`.</li><li>Reabrir vuelve a la página 1.</li></ul> |
| `tests/infrastructure/dom/menu-panel.test.ts` (nuevo) | <ul><li>5 botones en orden.</li><li>Con la guía abierta, Jugar, Exportar, Importar y Borrar no tienen efecto.</li><li>Al cerrar, foco en «Cómo jugar» y botones activos.</li><li>`show()` deja el modal cerrado (caso `?e2e` y Volver al menú).</li></ul> |
| `tests/infrastructure/dom/resource-icons.test.ts` (ampliar o nuevo) | <ul><li>5 URLs.</li><li>SVG data URL con el color de la gema.</li><li>Hojas de una fila (IHDR).</li></ul> |
| **E2E**, ampliar `smoke.spec.ts` «Arranque y menú» (sin `?e2e`, solo DOM; spec «Recorrido de la guía en el smoke») | <ul><li>Lista de 5 botones.</li><li>Abrir: «1 de 7», sin Anterior.</li><li>7 × flecha derecha: «7 de 7», sin Siguiente.</li><li>Con `setViewportSize` a 960 × 540 y a 1.920 × 1.080 y `waitFrames` (frames, no tiempo): recuadro y botones visibles dentro de la ventana, centro ±1 px en cada eje e indicador conservado. No se fija la escala.</li><li>Esc: modal oculto, menú visible con 5 botones, foco en «Cómo jugar».</li><li>0 diálogos nativos (`page.on('dialog')`), CSP sin violaciones y consola limpia.</li></ul> `logicGuard` solo veta `waitForTimeout`, `playChoosingFirst` y `expect.poll` sobre el tick. `setViewportSize` ya lo usa `gameplay.spec.ts:74`. |

- Sin `?e2e` no hay sonda, así que el listener retirado y el caso `?e2e` se cubren en Node (e2e-lite).
- Escenarios cubiertos solo por construcción y con un test de Node del componente:
  - «Jugar y pausa tras cerrar la guía»: 0 listeners tras cerrar, y la pausa la cubre el E2E de pausa existente.
  - Los de redimensionado con la guía abierta: el modal no reacciona a `RESIZE`; el E2E cubre el cambio de ventana.
  - «Abrir no toca el progreso»: `MenuPanel` con acciones espía da 0 llamadas.
  - «Sin assets nuevos»: `guard:all` y la nota de procedencia, sin cambios.
- El balance no cambia, porque ningún fichero del núcleo ni de `content/` de juego se toca. `verify` ya ejecuta
  `BALANCE_BASELINE`.

## Flujo
```
arranque: guide.json ─┐
content/*.json ─ parseContent ─ RunConfig ─┬─ parseAppearance … ─┐
                                           └─ parseGuide(zod → interpolate(GUIDE_MARKERS(config)))
                                                 └─ error → report → showContentError, sin menú
menú: clic «Cómo jugar» → MenuController.openGuide → setLocked(true) → GuideModal.open
      (addEventListener keydown, foco en root) … Esc/Cerrar → close (removeEventListener)
      → closeGuide → setLocked(false) → foco «Cómo jugar»
```

## Dependencias nuevas
| Paquete | Versión exacta | Motivo | Alternativa descartada |
|---|---|---|---|
| — | — | Ninguna. | jsdom o happy-dom para los tests de DOM: `tests/support/fakeDom.ts` ya cubre los paneles y basta con ampliarlo. |

## Rendimiento y seguridad
- **Presupuesto**: 0 ms/tick, porque nada corre en el bucle. El parse y la interpolación al arrancar cuestan
  < 1 ms (7 páginas y 14 marcadores). Bundle: + ~3–4 KB de JSON y unos 200 líneas de TS.
- **CSP**: sin cambios en `index.html`.
  - Solo `textContent`, atributos y clases.
  - Iconos con URL del mismo origen o un `data:` SVG generado a partir de un `Hex` ya validado.
  - El E2E sigue exigiendo `violations: []`.
- **Entradas externas**: `guide.json` es contenido del repo y se valida con zod (regla 6).
- **Persistencia**: no se toca nada persistido (`localStorage` intacto) ni el progreso guardado.

## ADRs
- No hace falta ninguno: es presentación local y fácil de revertir, y sigue el patrón de `appearance.json`
  (ADR-0012) y del menú DOM (ADR-0011).
- Si los marcadores se generalizan a otros textos (tienda, mejoras), conviene registrarlos entonces como
  convención.
- Vía de documentación: MCP `phaser-docs` y la fuente de `node_modules/phaser` 4.2.1 (§5).
