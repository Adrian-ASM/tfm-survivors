# Exploración 0034-upgrade-icons

Intención: un icono por cada una de las 15 mejoras (9 de personaje en las cartas de XP, 6 de arma en la tienda), ligado por id en `content/`, con reserva por categoría y procedencia registrada. Núcleo, balance y firmas intactos.

## Contexto actual
- Cartas (Phaser): `src/infrastructure/phaser/cardLayout.ts` (240 × 170 ×k, relleno de texto 16; `cardTextLayout` reparte nombre arriba, descripción debajo y nivel abajo), `UpgradeOverlay.ts` (`CardParts`: `frame` NineSlice, `box`, tres `Text`; la oferta trae `id`, `name`, `description`) y fábrica en `sceneWidgets.ts`. `mobileFrame.ts` usa `cardLayout` con k fraccionario (0033). No hay hueco de imagen: habría que reservarlo en el cálculo puro del layout.
- Tienda (DOM): `src/infrastructure/dom/ShopPanel.ts`. Cada fila es un `button.shop-panel__product` con spans (name, description, level, price, notice) y `dataset.product = id`; rejilla CSS `1fr auto auto` (`src/styles.css` ~258). Solo `textContent` y clases. Los productos incluyen también la curación (`kind: heal`, sin mejora).
- CSP (`index.html`): `img-src 'self' data:`; no hay `blob:`. Un `<img src>` o `background-image` con URL del mismo origen vale, igual que `resourceIcons.ts` (0028, URL de `assetUrl` y SVG `data:`).
- Aspecto: `content/appearance.json` validado por `appearanceSchema.ts`; `parseAppearance(raw, registered)` exige que cada hoja esté en `registeredPaths(note)` (= `files[]` + `fonts[]` de `content/asset-provenance.json`). `bootPlan.ts` (`uiImagesOf`, `imagesToLoad`) lista imágenes enteras para `BootScene`; `finishBoot` avisa de las que existen y las que fallan se anotan; el DOM recibe imagen solo de las cargadas (`uiKit.ts`).
- Mejoras: `content/upgrades.json`, dos catálogos. Personaje (9): `guardrail` maxHealth, `shortcuts` speed, `context-window` pickupRadius, `regeneration`, `armor`, `steady-nerves` invulnerabilityTicks, `scholar` xpBonusPercent, `prospector` goldBonusPercent, `hunter` meatHealPercent. Arma (6): `strict-rules` (linter, damage), `fast-ci` (linter, cooldownTicks), `wide-analysis` (linter, range), `hard-asserts` (tests, damage), `watch-mode` (tests, cooldownTicks), `coverage` (tests, radius).
- Procedencia (`.claude/hooks/guard-assets.mjs`): todo gráfico versionado necesita entrada en `files[]` con `version == "Update 010"`, `sha256` y `bytes`; la cabecera fija pack Tiny Swords / Pixel Frog / CC0; rutas "Free Pack" prohibidas. Una imagen generada con IA **no cabe en `files[]`** tal como está (versión y fuente), así que haría falta una lista nueva (patrón de `fonts[]` de 0032) con herramienta, fecha, términos, prompt, sha y bytes, y ampliar guard + `registeredPaths`.
- Política: GDD Won't = "enemigos dibujados con IA"; línea 387 del GDD ("no se dibuja con IA") y AGENTS.md exigen entrada de procedencia. ADR 0012 (arte CC0) no menciona IA. Último ADR: **0029** (0028 y 0029 son 0032/0033). Candidato: ADR-0030 de procedencia de imágenes IA.
- Prueba previa (fuera del repo): `C:\Users\Adri\.gemini\antigravity\scratch\tiny-swords-test-icons\`. PNG finales 64 × 64 en `icons-64x64/`: `guardrail_chainmail.png` (cota), `shortcuts_boots.png` (botas), `strict_rules_arrowheads.png` (puntas de flecha), `heal_potion.png` (poción; esta es de la curación, no de una mejora). Originales JPG en `raw/` (sin alfa; tamaño no medido). El script `process_icons.ps1` quita el fondo casi blanco por relleno desde los bordes (umbral ≥ 228, alfa binario), recorta al contenido y reescala a 52 px dentro de un lienzo de 64 con vecino más cercano. Vistos: fondo transparente, trazo tipo píxel con contorno, más detalle y sombreado que Tiny Swords. Referencias usadas: `refs/` (Regular_01, W_Idle, G_Idle, M_Idle, Arrow). No hay copia en el repo ni en worktrees hermanos. No hay prompts ni notas en `docs/ai-log/` (solo la mención de `2026-11-26-gdd-ui-icons-audio.md`). Prompts recuperables del historial de Antigravity (`brain/c800c36f-…`), por confirmar.
- Alternativa sin IA: el pack Update 010 (`C:\Users\Adri\TFM\Tiny Swords (Update 010)\`) tiene `UI/Icons` solo de glifos genéricos (X, engranaje, sonido, dígitos, carrito, más, menos, candado) y no sirve para mejoras. Piezas útiles ya versionadas: `Arrow.png`, `G_Idle` (oro), `W_Idle`, `M_Idle` (carne), rocas `Deco/04–06`, y sin versionar `Deco` 01–18 (setas, huesos, etc.). Mapeo plausible sin IA: oro → `prospector`; carne → `hunter`; flecha → `strict-rules`/`fast-ci`/`wide-analysis`; gema → `scholar`. Faltan cota, botas, escudo, tajo, bálsamo, etc.: no hay en el pack (no trae objetos de inventario).

## Capacidades / specs afectadas
`upgrades` (carta con icono), `castle-shop` (fila con icono), `sprite-rendering` y `asset-provenance` (reserva, procedencia IA), posible `appearance`/ui-kit de 0032 (marco). `hud`, `build-sites` y el núcleo no.

## Opciones (sin elegir)
A. **Mapa por id en `appearance.json` (`upgradeIcons`: id → imagen)**, una imagen por mejora. Pros: encaja con el patrón de `ui`/`registeredPaths`; un solo punto de verdad. Contras: `parseAppearance` no ve `upgrades.json`, así que la comprobación "el id existe" hay que hacerla en la composición (cruce al arrancar); 15 imágenes sueltas o una hoja.
B. **Campo `icon` en cada entrada de `upgrades.json`**. Pros: id y icono juntos, el zod de mejoras ya valida ids. Contras: mezcla contenido de simulación con aspecto (contra la separación `appearance.json`) y rompería firmas/huella del contenido si se hashea; el núcleo recibiría un campo que no usa.
C. **Iconos por categoría/stat sin imagen por id** (p. ej. 6 familias: defensa, movimiento, recursos, arco, tajo, curación). Pros: menos arte (6 en vez de 15), coherente aunque falte alguno. Contras: no distingue mejoras de la misma familia; no cumple "un icono por mejora".
Independiente de lo anterior: origen del arte (IA con ADR / pack recoloreado / dibujo a mano) y formato (imágenes sueltas o atlas).

## Riesgos e incógnitas
- Procedencia IA: términos de uso de Antigravity/Gemini y su licencia sobre las salidas aún sin leer; el guardarraíl exige hoy "Update 010".
- Coherencia de estilo: las 4 pruebas son más detalladas que Tiny Swords; alfa binario con posible halo blanco; el reescalado a 64 con vecino más cercano puede dar tamaños con escala no entera (k fraccionario en móvil: usar `NEAREST`).
- Espacio en la carta (170 × k de alto y texto ya apretado, `wrapLines`) y en filas de tienda (rejilla 3 columnas, `overflow-y` con scroll en móvil). Las 6 mejoras de arma y 9 de personaje: el hueco se aplica a todas.
- La reserva por categoría necesita una "categoría" definida (¿personaje/arma, o el stat?).
- Tests existentes que fijan layout de carta o posición de textos (cardLayout, mobileFrame) pueden cambiar.
- Cupo gratuito agotado: generar 11 más puede alargarse días.

## Mediciones previas
No aplica (sin objetivo de balance, ritmo ni rendimiento). Solo comprobar que `BALANCE_BASELINE` y las seis firmas no cambian (no se toca el núcleo). Se podría medir el tamaño total de los 15 PNG (< unos pocos KB cada uno).

## Cobertura de tests (e2e-lite)
Unitarios: esquema (ids ⊂ `upgrades.json`, cada mejora con icono o reserva, ruta registrada, tamaño común); cruce de ids en la composición; `cardLayout` con hueco del icono a ×1/×2 y k fraccionario; reserva por categoría cuando falta la textura o falla la carga (`bootPlan`/`finishBoot`); `ShopPanel` con `<img>` solo con URL propia (sin `data:` ajeno) y `alt` vacío; `checkAssets` con la nueva lista de procedencia IA (campos obligatorios, sha). Como mucho 1 E2E manual ampliando `gameplay.spec`: oferta de XP y tienda con el icono presente en la sonda (p. ej. `sprites`/`shop` con `icon: painted|fallback`).

## Preguntas para el usuario
1. Origen: ¿IA (cuál: Antigravity, otra, en lotes) o pack recoloreado/dibujo manual? ¿Se aceptan las 4 de prueba (estilo)?
2. Política IA: ¿ADR nuevo (0030) y lista aparte en la nota de procedencia con herramienta, fecha, términos y prompt? ¿Se ajusta el Won't ("enemigos con IA" sigue vetado)?
3. Datos: ¿mapa `upgradeIcons` en `appearance.json` (A), campo en `upgrades.json` (B) o por categoría (C)?
4. Tamaño común (¿64 × 64?) y escala en carta/tienda; ¿atlas único o 15 ficheros?
5. "Categoría" de reserva: ¿personaje/arma (2 iconos) o por stat/familia (~6)?
6. ¿La poción de curación de la tienda entra (la prueba trae una) aunque no sea una mejora?
7. ¿Se retoca el fondo (halo) con un paso reproducible versionado (script), o se acepta tal cual?
