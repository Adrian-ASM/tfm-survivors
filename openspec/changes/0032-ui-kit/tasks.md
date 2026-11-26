# Tasks · 0032-ui-kit

<!-- ADR-0018: el change no toca `domain` ni `application`; todo es contenido, infraestructura y composición con
     test-after (no hace falta rojo). Por tarea: `npm run verify:fast`. Por grupo: `npm run verify` completo y un
     commit (Conventional Commits, `refs: 0032-ui-kit`, trailer `Assisted-by`). Escenarios: specs delta de
     `openspec/changes/0032-ui-kit/specs/**` (prefijo = capacidad). Diseño: `design.md` (§ = sección). -->

## 1. Contenido, procedencia y guardarraíl
- [ ] 1.1 Copiar las 8 piezas de `C:\Users\Adri\TFM\Tiny Swords (Update 010)\UI\` (design §1: `Carved_9Slides`,
  `Button_{Blue,Blue_Pressed,Hover,Disable,Red,Red_Pressed}_9Slides`, `Ribbon_Yellow_3Slides`; nada del Free Pack ni
  de `Icons`/`Pointers`) a `public/assets/tiny-swords/UI/<Banners|Buttons|Ribbons>/` con sus 8 entradas en `files[]`
  de `content/asset-provenance.json` (sha256 y bytes reales). Decodificador PNG de test en `tests/support/png.ts`
  (IHDR + IDAT con `zlib`, desfiltrado RGBA) y medición de márgenes y color medio del centro de cada pieza con la regla
  del §1 (múltiplo de 4 que contiene esquina, contorno, ribete y sombra); anotar los valores medidos en este fichero
  al cerrar la tarea. Test: `tests/infrastructure/ui-provenance.test.ts`.
  — escenarios: asset-provenance "Piezas registradas", "Integridad de las piezas", "Pieza sin entrada", "Pieza del
  Free Pack", "Iconos y punteros fuera"; sprite-rendering "Hoja de cada elemento", "Solo las hojas usadas", "Pieza de
  UI de más" (ampliar el test existente de hojas usadas con las piezas de `ui`).
- [ ] 1.2 Descargar Departure Mono (descarga aprobada por el autor) desde la release oficial: extraer solo
  `DepartureMono-Regular.woff2` sin modificar ni renombrar y el texto completo de la licencia como
  `public/assets/fonts/OFL.txt` (ningún `.zip` en el repo). Comprobar glifos `á é í ó ú ñ ü ¿ ¡ « » · × →` y el avance
  en em (si > 0,6, anotarlo para subir `MONO_CHAR_RATIO` en 4.2); si no hay `woff2` o faltan glifos clave, parar y
  consultar. Añadir `fonts[]` a la nota (§6: `path`, `family`, `author`, `source`, `version`, `license` `OFL-1.1`,
  `licenseFile`, `sha256`, `bytes`) y ampliar `.claude/hooks/guard-assets.mjs` a `.woff2/.woff/.ttf/.otf` sin
  distinguir mayúsculas. Test: `tests/guardrails/assets.test.ts`.
  — escenarios: asset-provenance "Fuente registrada", "Fuente sin registro", "Registro de fuente incompleto",
  "Licencia de la fuente sin versionar", "Registro sin fichero"; sprite-rendering "Bloque de combate sin hojas".
- [ ] 1.3 `UiSchema` en `appearanceSchema.ts` (8 roles cerrados, márgenes, `header.height`, `fill`, tintas, contraste
  ≥ 4,5, `danger` roja R ≥ 96 y ≥ 2·G y 2·B, fuente `family`/`file`/`format`), registro de imágenes y fuente en
  `parseAppearance`/`bootContent` (`FONT_NOT_REGISTERED`) y sección `ui` en `content/appearance.json` con los valores
  medidos en 1.1 (tintas de §2, ajustadas hasta pasar contraste). Test: `tests/infrastructure/appearance-ui.test.ts`
  (con `tests/support/png.ts`).
  — escenarios: sprite-rendering "Datos de interfaz del repositorio", "Hojas de las piezas medidas", "Datos de
  interfaz inválidos".

## 2. Infraestructura DOM (adaptador CSS)
- [ ] 2.1 `src/infrastructure/dom/uiKit.ts`: `uiKitVariables` (siempre relleno, tintas y `--ui-font`; imagen,
  márgenes, alto de cabecera y tintas activas de botón solo de piezas cargadas; `--ui-disabled-opacity`) y
  `applyUiKit` (CSSOM); `fontUrl` en `src/composition/assetUrl.ts`. Test: `tests/infrastructure/dom/ui-kit.test.ts`.
  — escenarios: sprite-rendering "Variables solo de las piezas cargadas", "URLs de las piezas y de la fuente bajo la
  base" (parte de URL; la comprobación de "existe en `dist/`" se hace sobre `public/`, que Vite copia entero),
  "Reserva del panel con el relleno de la pieza".
- [ ] 2.2 `src/styles.css`, bloque compartido de los 7 paneles y sus botones (§4: `border-image` con variables y
  reserva, `padding` ≥ margen × k, `min-height` de botón, `buttonHover`/`:focus-visible` con contorno de 2 px,
  `buttonPressed`, `buttonDisabled`, `Confirmar` con `buttonDanger`, cabecera 3-slice, `font-family` con caída), sin
  ningún `url(` ni cambio de DOM. Test de lectura del CSS: `tests/infrastructure/dom/styles-ui.test.ts`; ampliar los
  tests DOM existentes de menú, pausa, diálogo y guía con "sin atributo `style`" y mismas clases, roles y foco.
  — escenarios: sprite-rendering "Esquinas a ×1 y a ×2" (cálculo puro compartido con 4.1), "Los siete paneles con la
  pieza de panel", "DOM sin cambios", "Reglas de reserva declaradas en el DOM"; main-menu "Botón deshabilitado, botón
  con foco y botón de borrado", "Diálogo con texto legible"; menu-guide "Guía dentro del marco a ×1 y a ×2",
  "Controles de la guía con piezas de botón", "Iconos sin hojas propias" (y los demás de "Iconos de recurso en la
  guía", que siguen en verde).
- [ ] 2.3 Tintas y layout de tienda, obra y resultados en `styles.css`: lista de la tienda con desplazamiento interno
  (`max-height`, `overflow-y: auto`, `min-height: 0`; título, oro y `Salir` fuera), filas no comprables/asequibles con
  `buttonDisabled` sin opacidad extra si carga, `danger` en avisos y cifras que faltan, `accent` en mensajes y panel
  de resultados con marco. Tests: `styles-ui.test.ts` y ampliar los de `ShopPanel`, `BuildPanel` y `ResultsPanel`.
  — escenarios: castle-shop "Filas comprables y no comprables", "Tienda con desplazamiento interno a ×1 en
  1.280 × 720", "Tienda entera a ×2"; build-sites "Torre no asequible con piezas", "Panel sin atributo style",
  "Panel entero dentro del marco"; run-results "Colores de mensajes y avisos", "Contenido máximo dentro del marco".

## 3. Arranque: fuente y piezas (infraestructura Phaser + composición)
- [ ] 3.1 `src/infrastructure/dom/uiFont.ts`: `loadUiFont` (`FontFace` + `document.fonts.add` + `check`; rechazo →
  `false`) y `withDeadline` con temporizador inyectado y `FONT_WAIT_MS` 3.000. Test con dobles de `FontFace`/`fonts`
  y reloj de prueba: `tests/infrastructure/dom/ui-font.test.ts`.
  — escenarios: sprite-rendering "Fuente que no responde" (parte del plazo), "Fuente que no carga" (parte de la carga).
- [ ] 3.2 `bootPlan.ts` (`uiImagesOf` en `imagesToLoad`), `BootScene` (filtro `NEAREST` a las de UI, espera de
  `fontReady`, `failed`, `onUiLoaded` con las claves cuya textura existe) y `main.ts` (lanza la fuente en
  `bootstrap`, publica `applyUiKit` al terminar la carga). Tests: `tests/infrastructure/boot-plan.test.ts` (o el
  existente) y uno de `BootScene` con dobles: arranca el menú al resolver la fuente o al vencer el plazo, nunca antes
  de la carga.
  — escenarios: sprite-rendering "Fuente que no responde" (el menú se crea como muy tarde a los 3.000 ms), "Fuente que
  no carga" (se crea el menú sin errores), "Directivas sin cambios" (el test existente de la CSP sigue en verde).

## 4. Infraestructura Phaser (cartas y HUD con NineSlice)
- [ ] 4.1 `src/infrastructure/phaser/ui/uiPanel.ts` (`nineSliceGeometry`, `UiPanelPart`, `NineSlicePanel`,
  `NO_PANEL`, `createUiPanel` con `textures.exists` y renderizador WebGL) y cartas: `CardParts.frame`, `box`
  transparente con pieza y de siempre en reserva, `cardTextLayout` (texto a ≥ `max(16, l)`·k, `t`·k y `b`·k; subir
  `CARD_HEIGHT` si la descripción más larga no cabe), tinta `text` y familia con caída. Dobles de Phaser con
  `nineslice` en `tests/support/feedback.ts` (o el doble que ya usen los tests del overlay). Tests:
  `tests/infrastructure/ui-panel.test.ts` y ampliar los de `UpgradeOverlay`/`createUpgradeOverlay`.
  — escenarios: upgrades "Una pieza por carta", "Esquinas y texto de la carta a ×1 y a ×2", "Descripción más larga del
  catálogo", "Clic en el margen de la carta", "Redimensionar sin crear piezas"; sprite-rendering "Carta sin textura",
  "Pieza de UI que falla sin reserva de sprites", "Familia con caída en el DOM y en Phaser" (cartas).
- [ ] 4.2 HUD: `hudPanels` puro (cajas fijas por caracteres de reserva, fuera de `hudBoxes`), `HUD_BASE.panelInset`
  y filas desplazadas (§5; pasar los literales `[52, 70]`/`140` de `ui-layout.test.ts` a `HUD_BASE`), 3
  `UiPanelPart` en `createHud` recolocados solo en `HudPlacement.place`, tinta `text` de `panel` con paneles y
  `#ffffff` sin ellos, familia con caída; `MONO_CHAR_RATIO` al avance medido en 1.2 si es mayor. Tests:
  `ui-layout.test.ts` (ampliado) y los de `createHud`/`Hud` con dobles; los de `DamageNumberLayer` siguen iguales.
  — escenarios: hud "Tres paneles con su contenido", "Paneles independientes del snapshot", "Seiscientos frames sin
  crear objetos", "Fuente pixel en los textos del HUD"; sprite-rendering "HUD sin textura", "Los números de daño
  conservan su fuente", "Familia con caída en el DOM y en Phaser" (HUD).
- [ ] 4.3 Partidas con todo en reserva, con dobles de Phaser y DOM de prueba: 3.600 ticks de la semilla 42 con el bot
  de referencia, las 8 texturas y la fuente sin cargar, comparados tick a tick con la misma partida con todo
  cargado, y flujos de menú, tienda, obra y resultados en reserva. Test:
  `tests/infrastructure/ui-fallback-run.test.ts`.
  — escenarios: sprite-rendering "Partida entera con todas las piezas en reserva", "Fuente que no carga" (600 ticks
  con HUD); main-menu "Flujo del menú con las piezas en reserva"; castle-shop "Compra con las piezas en reserva";
  build-sites "Construir con las piezas en reserva"; run-results "Botones de resultados con las piezas en reserva".

## 5. E2E, invariantes y documentación
- [ ] 5.1 E2E (e2e-lite: **0 nuevos, 1 ampliado**): el test de humo de `smoke.spec` que ya abre el menú y vigila la
  CSP comprueba, a 1.280 × 720, `borderImageSource` de `.menu-panel` con `UI/Banners/Carved_9Slides.png` bajo
  `/tfm-survivors/`, `borderImageWidth` = márgenes de `panel` × 1 px y `document.fonts.check('16px "Departure
  Mono"')`; selectores y `probe.ts` intactos. Si `tests/remote/public.spec.ts` enumera las hojas con `bootPlan`, que
  incluya las de UI y la fuente (se ejecuta solo a demanda). `npm run test:e2e` en verde.
  — escenarios: main-menu "Menú con piezas en el navegador" [E2E]; sprite-rendering "Desde el menú", "Con e2e",
  "Partida con arte", "Hoja que no carga", "Fondo de reserva en el mundo entero" (E2E existentes, sin cambios), "Arte
  en la URL pública" (smoke remoto a demanda).
- [ ] 5.2 Invariantes: test de 1.200 ticks de la semilla 42 con la `ui` del repositorio frente a otra válida
  (márgenes a 0, otros colores, otra familia) con snapshots iguales tick a tick; confirmar en `verify` que
  `BALANCE_BASELINE` y `BUILDER_REFERENCE` son idénticos (1..50, 0 quietos), que las seis firmas no cambian (no se
  regeneran) y que los objetos del mapa siguen en 820/904 (42/123); diff de `src/domain` y `src/application` = 0
  líneas. Test: `tests/infrastructure/ui-invariance.test.ts`.
  — escenario: sprite-rendering "La interfaz no cambia la simulación ni el mapa".
- [ ] 5.3 Documentación: línea de estado del change 0032 en `AGENTS.md` §1, ADR-0028 a "aceptada" tras verify,
  diario de IA de apply en `docs/ai-log/` (medidas reales de 1.1, versión de la fuente, incidencias de hooks).
