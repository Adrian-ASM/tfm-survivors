# Proposal · 0032-ui-kit

- **Estado**: aprobada por el autor (2026-11-26)
- **Issue**: (sin issue)
- **Rama / worktree**: `change/0032-ui-kit` (`.claude/worktrees/youthful-napier-bd6ed0`)

## Problema
El mundo ya usa el arte de Tiny Swords Update 010 (0012, 0016, 0029, 0030), pero la interfaz sigue siendo de cajas
planas. Los paneles DOM tienen fondo `#23233a`/`rgb(20 20 30 / 92%)`, un borde de 1 px `#7ce2fe` (`#f5c542` en la
tienda) y fuente `monospace`. Las cartas de mejora y las barras del HUD son `Rectangle` de Phaser. El jugador ve
dos estilos distintos: un mundo medieval de pixel art y una interfaz genérica de depuración (historia 0032 del GDD).

## Objetivo
Toda la interfaz de pantalla usa las piezas de UI de Update 010 (banners, botones, cintas y paneles), estiradas
con nine-slice y con una fuente pixel servida desde el mismo origen. El aspecto actual se queda como reserva y el
juego sigue siendo jugable si alguna pieza o la fuente no carga. El núcleo, el balance y las firmas no cambian.

## Decisiones cerradas por el autor
1. **Alcance completo**. Entran todos los paneles DOM (menú, pausa, diálogo de borrado, guía «Cómo jugar»,
   resultados, tienda y panel de obra), con CSS compartido nine-slice (`border-image`). En Phaser entran las tres
   cartas de mejora y el HUD (`GameObjects.NineSlice`). No hay un corte reducido.
2. **Fuente pixel con licencia OFL**, servida desde el mismo origen con un `@font-face` local, porque la CSP es
   `default-src 'self'` y no tiene `font-src`, así que no admite fuentes remotas ni `data:`. La fuente concreta
   se elige en el design. Su licencia se anota en `content/asset-provenance.json`. La descarga necesita la
   aprobación explícita del autor. Si la fuente no carga, se usa la actual (`monospace`).
3. **Datos de UI en `content/appearance.json`**, en una sección nueva `ui` validada por zod (`appearanceSchema`):
   clave de la pieza, márgenes nine-slice y color de texto de cada pieza. No hay números mágicos en `src/`.

## Recomendaciones de la exploración adoptadas (también cerradas)
- **Reserva = aspecto actual.** En el DOM, la pieza va encima del borde y del fondo actuales con `border-image`.
  Si la imagen falla, el navegador pinta el `border` normal. En Phaser, si la textura no existe
  (`textures.exists`), se pinta el `Rectangle` actual. Es el mismo patrón de reserva de `phaserArt.ts`.
- **Un solo juego de piezas y dos adaptadores**: CSS (`border-image`) y `NineSlice`. Los dos leen el mismo bloque
  `ui` del contenido.
- **E2E**: ninguno nuevo, o como mucho ampliar uno de la suite de humo `logic` (regla `e2e-lite`). El resto se
  cubre con tests unitarios o de infraestructura sobre el contenido, los layouts puros y los dobles de Phaser.
- **Se conservan** las clases CSS, los roles ARIA, el foco, los textos y las sondas `window.__sprint` actuales. Los
  selectores de `smoke`, `progress`, `gameplay`.spec y `tests/support/probe.ts` no cambian. Pasar los botones a
  nine-slice solo toca el CSS, no el DOM.
- **Procedencia**: solo piezas de `Tiny Swords (Update 010)/UI/` (CC0). Nada del Free Pack ni piezas dibujadas
  con IA. Si falta una pieza, esa superficie se queda con el aspecto actual.
- **Núcleo intacto**: no se toca nada de `src/domain` ni de `src/application`. `BALANCE_BASELINE`,
  `BUILDER_REFERENCE` y las seis firmas doradas (`MAP_GOLDEN`, `STRUCTURE_GOLDEN`, `RESOURCE_GOLDEN`,
  `SHEEP_GOLDEN`, `STONE_GOLDEN`, `SITE_GOLDEN`) quedan idénticos. El change no toca ningún flujo de azar ni
  ninguna colocación por semilla (ovejas, solares, decoración), y el plan del mapa no cambia. Por eso el recuento
  de objetos del mapa sigue en 820/904 (semillas 42/123), porque la UI no aporta objetos al plan del mapa.

## Alcance
- **Dentro**:
  - Copiar al repo (bajo `public/assets/tiny-swords/`) las piezas de `UI/` de Update 010 que el design
    seleccione: marcos `*_9Slides` / `Carved_9Slides`, botones `Button_{Blue,Red,Hover,Disable}_9Slides` (con
    `_Pressed` donde exista), cintas `Ribbon_*_3Slides` y, si se usa, un banner de cabecera de tamaño fijo. Cada una
    lleva su entrada en `content/asset-provenance.json`.
  - CSS compartido en `src/styles.css`: marco de panel, botón (normal, hover, pulsado y deshabilitado) y cabecera
    o cinta, aplicado a `.menu-panel`, `.pause-panel`, `.confirm-dialog`, `.guide-modal`, `.results-panel`,
    `.shop-panel` y `.build-panel`. Los márgenes nine-slice se escalan con `--ui-scale`.
  - Fuente pixel OFL local (`@font-face`) con caída a `monospace`. Se usa en el DOM y en los `Text` de Phaser de las
    cartas y del HUD.
  - Phaser: las cartas de mejora (`UpgradeOverlay`, `createUpgradeOverlay`) y el HUD (marcos o barras de
    `createHud`) con `NineSlice`. El área interactiva y la recolocación por `watchScreen` siguen como ahora, y hay
    reserva al `Rectangle` actual si falta la textura.
  - Sección `ui` de `appearance.json`: esquema zod, valores y errores de contenido por la vía existente.
  - Carga de las piezas en `BootScene` (por la lista de imágenes de `appearance`) y URL de las piezas en el CSS
    compatible con la base `/tfm-survivors/` y la CSP.
  - Color de texto por pieza para que el texto sea legible sobre marcos claros (`Carved`).
- **Fuera**:
  - Números de daño y barras de vida del mundo (0031): no son UI de pantalla.
  - Velos de las capas (`Rectangle` negro 0,6/0,75): se quedan como están.
  - Iconos de las mejoras (0033) y audio (0034).
  - Iconos `Icons/Regular_*` y punteros `Pointers/*` del pack: no hay botón ni cursor que los necesite.
  - Cualquier cambio en `src/domain`, `src/application`, contenido de combate, balance, oleadas o mapa.
  - Cambios de comportamiento: flujos de menú, teclado, foco, compra u obra.
  - Ampliar `guard-assets.mjs` a ficheros de fuente: solo si el design lo justifica. La licencia se anota igual
    en `asset-provenance.json`.

## Capacidades afectadas
Delta de specs vivas, todas **modificadas** y sin capacidades nuevas:
- `openspec/specs/main-menu`: aspecto del menú, de la pausa y del diálogo de borrado (requisito "Menú y pausa
  centrados en la ventana"). El borrado está en `progress-persistence`, pero su diálogo lo pinta el menú.
- `openspec/specs/menu-guide`: aspecto de la guía. El requisito "Iconos de recurso en la guía" no cambia.
- `openspec/specs/run-results`: "Overlay de resultados" / "Overlay de resultados centrado en la ventana".
- `openspec/specs/upgrades`: "Overlay de elección" / "Overlay de elección en la ventana" (cartas con
  `NineSlice`).
- `openspec/specs/hud`: "HUD anclado a la ventana" / "Escala del HUD por escalones" (marcos o barras con
  `NineSlice`).
- `openspec/specs/castle-shop`: "Overlay de la tienda".
- `openspec/specs/build-sites`: "Panel de obra".
- `openspec/specs/sprite-rendering`: "Carga del arte compatible con la CSP" y "Aspecto de reserva ante un
  fallo de carga" (piezas de UI y fuente local). Probable requisito ADDED para la sección `ui` de
  `appearance.json`.
- `openspec/specs/asset-provenance`: ADDED "Procedencia de las piezas de UI" (y de la licencia de la fuente).
- `openspec/specs/public-deploy`: solo si el design cambia la CSP. Lo previsto es no tocarla, y entonces esta
  capacidad no entra en el delta.

## Riesgos y dudas
- **Medidas de los PNG sin comprobar**: las `*_9Slides` miden unos 192 × 192 con esquinas de alrededor de 1/3, y
  la sombra inferior es asimétrica. `Banner_Horizontal` no se puede estirar. Hay que medirlas en el design antes
  de fijar márgenes.
- **Desborde**: los márgenes del nine-slice reducen el área útil, sobre todo en la guía (con scroll interno), la
  tienda y el panel de obra a ×1 en 1.280 × 720.
- **Legibilidad**: el texto blanco sobre `Carved` (pergamino claro) necesita el color de texto por pieza.
- **Base y CSP**: la `url()` del CSS tiene que resolverse bajo `/tfm-survivors/` en `build` + `preview`. El CSS
  no avisa cuando una imagen falla (la reserva es natural, pero sin diagnóstico). El design decide si hace falta un
  sondeo en la composición.
- **`NineSlice` en Phaser 4.2.1**: hay que comprobar la firma en los tipos de `node_modules/phaser`.
  `CardBox.setSize` delega hoy en el `Rectangle`, que también es el área de clic. El HUD se actualiza en cada frame:
  hay que redimensionar el objeto, no recrearlo.
- **Reglas compartidas**: pausa, diálogo y menú comparten CSS, así que un fallo rompe las tres. No hay test visual
  automático (regresión visual sin cubrir).
- **Fuente**: la licencia OFL exige conservar el aviso de licencia. Sin descarga aprobada no hay fuente, y se
  sigue con `monospace`.

## Criterio de éxito
- Las 7 superficies DOM (menú, pausa, diálogo de borrado, guía, resultados, tienda y obra) referencian en su CSS
  una pieza de la sección `ui`. Las 3 cartas y el HUD crean `NineSlice` cuando la textura existe. Los tests
  unitarios o de infraestructura con dobles de Phaser comprueban 1 `NineSlice` por carta (3 en total) y el
  `Rectangle` de reserva cuando falta la textura.
- Nine-slice sin deformar: a ×1 y a ×2 las esquinas miden `margen × uiScale` px exactos en las dos tecnologías,
  según el layout puro o el CSS calculado. Al cambiar de tamaño (RESIZE) se redimensiona el mismo objeto sin crear
  otro.
- Sin desborde: a 1.280 × 720 (×1) y a 2.560 × 1.440 (×2), el texto de cada panel y carta cabe en el área útil
  del marco (ancho del texto ≤ ancho del marco − márgenes izquierdo y derecho).
- Reserva: con la pieza o la fuente sin cargar, la superficie muestra el aspecto actual (borde de 1 px,
  `monospace`) y la partida se puede jugar hasta el final.
- Zod rechaza una sección `ui` mal formada (clave que falta o margen negativo) con error de contenido por la vía
  existente.
- `guard-assets.mjs` en verde: cada pieza de UI nueva tiene entrada en `asset-provenance.json` (path, source,
  sha256, bytes), ninguna ruta del Free Pack y la licencia OFL de la fuente anotada.
- `BALANCE_BASELINE` y `BUILDER_REFERENCE` idénticos semilla a semilla (1..50), 0 quietos, las seis firmas
  doradas sin cambios y 820/904 objetos del mapa en 42/123.
- Sin violaciones de CSP en la suite de humo. 0 E2E nuevos, o 1 test de la suite de humo ampliado. Ningún
  selector, rol ni sonda existente cambia y la suite `logic` sigue en verde.
- `npm run verify` y `npm run test:e2e` en verde.
