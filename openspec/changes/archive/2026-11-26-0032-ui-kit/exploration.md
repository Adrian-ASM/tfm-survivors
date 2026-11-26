# Exploración 0032-ui-kit

## Contexto actual
- **Piezas del pack** (no copiadas aún al repo; `public/assets/tiny-swords/` solo tiene arte de mundo y
  `content/asset-provenance.json` ninguna de UI). Origen en disco: `C:\Users\Adri\TFM\Tiny Swords (Update 010)\UI\`
  (el Free Pack está al lado en `Tiny Swords (Free Pack)\UI Elements`: no usar).
  - `Banners/`: `Carved_9Slides`, `Carved_3Slides`, `Carved_Regular`, `Banner_Horizontal`, `Banner_Vertical`,
    `Banner_Connection_{Up,Down,Left,Right}`.
  - `Buttons/`: `Button_{Blue,Red,Hover,Disable}` en variantes base, `_3Slides` y `_9Slides`, con `_Pressed` para
    Blue y Red (Hover y Disable sin pressed).
  - `Ribbons/`: `Ribbon_{Blue,Red,Yellow}_3Slides` y 4 conexiones (Up/Down/Left/Right) con `_Pressed`.
  - `Icons/`: `Regular_01..10`, `Pressed_01..10`, `Disable_03..10` (botones con icono, sin determinar su motivo).
  - `Pointers/01..06`.
  - Tamaños (estimados al verlas; **medir los PNG antes del design**): `*_9Slides` y `Carved_9Slides` ~192 × 192
    (marco con esquinas ~ 1/3: aptos para nine-slice 64/64/64); `Ribbon_*_3Slides` ~192 × 64 (3 rodajas
    horizontales, apta para `border-image` con corte solo horizontal); `Banner_Horizontal` ~192 × 192 con
    "patas" y sombra (no es nine-slice limpio; mejor como cabecera de tamaño fijo). Los marcos 9Slides llevan
    sombra inferior: el margen inferior probablemente es mayor que el superior.
  - **Fuente: el pack no trae ninguna** (ningún .ttf/.otf/.woff). Decisión abierta.
- **Superficies actuales** (todas con aspecto de reserva = fondo `#23233a`/`rgb(20 20 30/92%)`, borde 1 px
  `#7ce2fe` o `#f5c542` en tienda, `monospace`):
  | Superficie | Fichero | Tecnología / escala |
  |---|---|---|
  | Menú, pausa, diálogo de borrado | `src/infrastructure/dom/MenuPanel.ts`, `PausePanel.ts`, `MenuController.ts` | DOM; `.menu-panel/.pause-panel/.confirm-dialog` en `src/styles.css`; fuente `calc(16px * var(--ui-scale))` |
  | Guía | `dom/GuideModal.ts` | DOM, `.guide-modal` (iconos `<img>` de `resourceIcons`) |
  | Resultados | `dom/ResultsPanel.ts`, `resultsPanelText.ts` | DOM, `.results-panel`, sin fondo propio (velo Phaser detrás) |
  | Tienda / obra | `dom/ShopPanel.ts`, `BuildPanel.ts` | DOM, `.shop-panel/.build-panel`, botones por producto |
  | Cartas de mejora | `phaser/UpgradeOverlay.ts`, `cardLayout.ts`, `sceneWidgets.ts` (`createUpgradeOverlay`) | Phaser: 3 `Rectangle` con `setStrokeStyle`, interactivos (el rectángulo es también el área de clic); `Text` monospace 14 px |
  | HUD | `phaser/Hud.ts`, `sceneWidgets.ts` (`createHud`), `ui/uiLayout.ts` (`hudLayout`) | Phaser: barras = 2 `Rectangle` (`0x2a2a3a` y relleno), textos, iconos de contador; recolocado por `watchScreen` en cada RESIZE |
  | Velos | `sceneWidgets.ts` | `Rectangle` negro 0,6/0,75 |
  | Números de daño y barras de vida (0031) | `DamageNumberLayer`, `HealthBarLayer` | Mundo, no UI de pantalla: **fuera** del alcance |
- **Escalado**: `ScreenFrame` (`ui/screenFrame.ts`: ancho, alto y `uiScale` = escalón entero ≥ 1) → `applyUiScale`
  pone `--ui-scale` en `#game` (DOM); Phaser lo lee de `frame.uiScale` (`hudLayout`, `cardLayout`) y `watchScreen`
  recoloca. Un único escalón entero: favorable al pixel art (nine-slice sin escalado fraccionario).
- **Carga de arte**: `BootScene.preload` carga `sheetsToLoad`/`imagesToLoad(appearance)` con
  `assetUrl(BASE_URL + 'assets/tiny-swords/' + file)`; `FILE_LOAD_ERROR` anota la clave en `failed` y el aspecto
  usa reserva (`phaserArt.ts`, `textures.exists`). Los `<img>` del DOM usan la misma URL (`resourceIcons`).
  `content/appearance.json` ya tiene secciones por familia (`pickups`, `map`, `combat`…) validadas por
  `appearanceSchema`.

## Capacidades/specs afectadas
`openspec/specs/` de menú/pausa (0009), guía (0028), resultados (0007/0017), cartas (upgrades), HUD, tienda
(0024), obra (0026/0027), `asset-provenance`/`sprite-appearance` (0012). Escenarios visuales a revisar, no de
comportamiento. Núcleo, firmas y `BALANCE_BASELINE`: intactos por construcción (nada de `domain`/`application`).

## Restricciones
- **CSP** (`index.html`): `default-src 'self'; style-src 'self'; img-src 'self' data:`; sin `font-src`, así que
  cae en `default-src 'self'`: un `@font-face` con `url()` del mismo origen vale; `data:` para fuentes no. `border-image`
  con PNG propio vale (`img-src 'self'`). Sin estilos en línea: todo va en `src/styles.css` o por CSSOM
  (`style.setProperty`, ya permitido).
- **Base `/tfm-survivors/`**: en CSS, Vite reescribe `url(/assets/...)` de `public/` con la base; probar con
  `build`+`preview` (el E2E ya sirve `localhost:4173/tfm-survivors/`). Alternativa: importar desde `src/` para que
  Vite la procese (pero entonces `assets/tiny-swords/` deja de ser la única ruta del arte).
- **Fallo de carga en CSS**: no hay evento. Con `border-image-source` inválido o 404 el navegador pinta el
  `border` normal (el borde 1 px actual), de modo que dejar el aspecto actual como base y la pieza como capa encima da
  reserva natural; el aviso de diagnóstico se puede hacer con un `Image()` de sondeo en composición.
- **Guard** (`guard-assets.mjs`): exige entrada en `asset-provenance.json` (path, source, sha256, bytes) para
  png/svg/…; `.woff2/.ttf` no es "gráfico", así que la fuente no la vigila (habría que ampliarlo o anotar su licencia).
- **Tests que pueden romperse**: unitarios `tests/infrastructure/{screen-frame,ui-layout,viewport-probe,build-gate,shop-gate}.test.ts`
  (si cambian anclajes o dimensiones de HUD/cartas); E2E `smoke/gameplay/progress.spec` y `probe.ts` usan roles y
  selectores de los paneles (19 apariciones): conservar clases y roles; `tests/remote/public.spec.ts` (a demanda).
  Cambiar a nine-slice de botones no debe tocar el DOM, solo CSS.
- **Phaser 4.2.1**: `NineSlice` existe como `GameObjects.NineSlice` (`add.nineslice`); comprobar firma en los
  tipos de `node_modules/phaser` (no verificado aquí; la doc publicada puede ir por detrás). Un `NineSlice` no
  se estira con `setSize` del área interactiva por sí solo: revisar `CardBox.setSize` (hoy delega en `Rectangle`).

## Opciones
1. **Un juego de piezas, dos adaptadores** (propuesta del GDD): CSS `border-image` en DOM y `NineSlice` en
   Phaser, ambos leyendo un mismo bloque de contenido. + Coherencia total, cumple los criterios. – Más superficie
   (≈ 8 superficies × 2 tecnologías) y más riesgo de regresión visual sin tests automáticos.
2. **Primer corte reducido**: menú + cartas + HUD (+ pausa/diálogo por compartir CSS); tienda, obra, guía y
   resultados se heredan por CSS compartido en una segunda pasada. + Ciclo corto; – criterio 1 del GDD cubierto en
   parte salvo que el CSS común ya alcance todos los paneles DOM (probable: casi todo es DOM).
3. **Solo DOM + HUD sin nine-slice** (barras/cartas con imágenes fijas). + Menos riesgo en Phaser. – Las cartas y
   barras no escalarían bien a ×2 ni a ventanas distintas; no cumple el criterio nine-slice.

## Riesgos e incógnitas
- Márgenes reales y tamaños de los PNG sin medir; sombra inferior asimétrica; `Banner_Horizontal` no es
  estirable.
- Fuente pixel: ninguna en el pack; hay que elegir una de licencia libre (p. ej. OFL) y descargarla (decisión
  del autor); sin ella se mantiene `monospace` y el texto sobre pieza puede verse desencajado.
- Legibilidad: texto blanco sobre marcos claros (papel/pergamino de `Carved`) requiere cambiar color de texto.
- Desbordes: la guía tiene scroll interno; con nine-slice el relleno útil es menor (márgenes de borde).
- Rendimiento Phaser: `NineSlice` por carta/barra es poco, pero el HUD se actualiza en cada frame (no recrear).
- Pausa/diálogo comparten reglas CSS con el menú: un cambio rompe las tres.

## Mediciones previas
Ninguna de balance o ritmo. Solo medir (dimensiones de PNG y márgenes de esquina) en el design.

## Preguntas para el usuario
1. Alcance del primer corte (opciones 1/2/3).
2. Fuente pixel: ¿sí o no, y cuál (licencia libre)?
3. Dónde vive el dato de UI: ¿`appearance.json` sección `ui` o fichero nuevo?
4. Detección de fallo de carga en CSS: ¿reserva natural por `border` o sondeo explícito?
5. Número de E2E nuevos (regla e2e-lite: 1–2).
