# Exploración 0036-ui-polish

Intención: pulido de UI en 6 puntos, solo infraestructura y datos de aspecto (sin núcleo ni balance). Nota de
numeración: el GDD reserva 0036 para `goblin-tower-archers` (líneas 83, 487, 571) y 0037 para `characters`; hay que
renumerar a archers → 0037 y characters → 0038 (GDD y referencias en `AGENTS.md`/specs).

## Contexto actual (qué existe)

**1. Cierre.** `ShopPanel.ts` y `BuildPanel.ts` crean un `button(...)` final con clase `*__leave` y texto
`MENU_LABELS.shopLeave`/`buildLeave` = "Salir" (`dom/menuText.ts`). El clic deja `{kind:'leave'}`, que consumen
`ShopGate`/`BuildGate`, los mismos que Esc (y ⏸ táctil = Esc). Ambos paneles son `position: relative` (`styles.css`
~197 y ~315), así que una `×` absoluta arriba a la derecha es viable. Otros modales: `GuideModal` y `SoundPanel` ya
tienen `Cerrar` (+ Esc); pausa tiene `Reanudar` (Esc); diálogo de borrado `Confirmar/Cancelar`; resultados
`Reiniciar`-style acciones y menú sin cierre.
Equis con sentido: tienda y obra (piden el autor); guía y Sonido son candidatos secundarios (ya hay `Cerrar`
visible, `×` sería redundante; los E2E usan `getByRole('button', {name:'Cerrar'})`). Sin sentido: menú (no se
cierra), pausa (Reanudar es la acción principal), confirmación (decisión binaria), resultados (fin de partida).
El texto de la guía (`content/guide.json` l.36) dice "Sal de la tienda con Salir o con Esc": cambia.

**2. Centrado.** Los botones llevan padding `max(Xem, borde×--ui-scale)` con (t,r,b,l) = 20/20/28/20 del 9-slice
(`appearance.json` `ui.pieces.button*`, todas las variantes iguales). La hoja (visto: `Button_Blue_9Slides.png`)
tiene un borde inferior más alto (reborde/sombra), así que el padding asimétrico centra el texto en la cara visible:
es correcto en principio; solo la pieza `Pressed` desplaza el dibujo y el texto no (desfase menor). Hallazgos de
centrado real:
- `.build-panel button` = `display:flex; justify-content: space-between` (styles.css ~354): el botón `Salir` de la
  obra tiene un único hijo de texto, que queda **pegado a la izquierda**. Defecto confirmado por lectura.
- `.shop-panel button` = `text-align:left` (~254); `Salir` lo corrige con `.shop-panel__leave {text-align:center}`;
  las filas son rejillas (icono | nombre | nivel | precio) con alineación izquierda deliberada: no son botones de
  etiqueta única.
- Menú, pausa, diálogo, resultados, guía y sonido: botón en flujo normal (centrado por defecto). Falta verificar
  centrado vertical con la fuente Departure Mono (línea `normal`) con captura: no medible por lectura.
- Cartas Phaser (`UpgradeOverlay`, `NineSlice` + `cardContentLayout`): no revisadas a fondo; texto de varias líneas,
  por diseño no centrado como etiqueta. Mejor no tocar salvo captura que lo justifique.

**3. Barras de vida (bug).** Flujo leído: `GameScene.create` → `createPlayfield` (`GroundView.ts`: suelo, capa baja,
`RenderLayers`, capa alta, `createHazards`, `createFeedback` con `add.graphics()`) → `paintMap` (`setCellSize` →
`forget`) → `render(snapshot)` → `RenderLayers.render` → `bars.sync(snapshot.structures)`. Por lectura, en el primer
frame `changed()` es verdadero (`lastHealth` vacío vs 7 estructuras) y se llama a `fillRect` por cada barra;
`restart()` hace `clear`+`paintMap`+`render` con el mismo resultado. **No se ve un fallo lógico** en orden
sync/setCellSize/clear/paintMap ni en la caché. Lo que sí es cierto:
- Los tests (`health-bar-layer.test.ts`, `render-layers-feedback.test.ts`, E2E con `healthBars`) usan un doble
  (`FakeBarCanvas`) y el contador `drawn`, que sube aunque el `Graphics` real no se vea. Ninguno comprueba píxeles,
  `visible`/`alpha` ni el `commandBuffer` del `Graphics` real: por eso no pudieron detectarlo.
- Phaser 4.2.1 `GraphicsWebGLRenderer` no pinta si `commandBuffer.length === 0` y no tiene lógica de "primer frame".
Hipótesis a descartar con el navegador, no resolubles leyendo: (a) la barra llena (relleno `#e63946`, 48×6) queda
tapada o recortada por algo al empezar (p. ej. arte alto de la torre, 256 px de hoja vs huella 180); (b) el
`Graphics` se crea con la escena pero el primer dibujo lo borra otro `clear()` fuera de `HealthBarLayer`;
(c) diferencia real solo en la ruta de entrada (menú → Jugar vs `?e2e`). Falta reproducir con 1 captura y leyendo el
`Graphics` (`commandBuffer`, `visible`, `depth`) desde una sonda o la consola.

**4. Iconos grandes.** Tamaños actuales: DOM `.resource-icon` = `2em` (guía 16 px × `--ui-scale` = 32; obra
14 px × escala = 28; fijado en `styles.css` ~411, comparte guía y obra; `object-fit: cover` recorta el frame 0).
HUD Phaser: `HUD_BASE.iconSize` 16, filas de contador a pitch 18 (`xpY` 46, `woodY` 64, `stoneY` 82), todo × `uiScale`
(`hudLayout`, `hudPanels` con textos de reserva). `setDisplaySize(size,size)` sobre el frame completo de 128 px,
donde el dibujo ocupa solo una parte: el icono se ve aún menor que su tamaño.
Propuesta razonable: DOM guía 3em (48 px a ×1) y obra 2,5–3em con `faltan N` sin cambio; HUD 16 → 24 px a ×1.
Con 24 px el pitch de 18 solapa: habría que subir el pitch a ≥ 26 (filas 28/54/80/106 a ×1) o recortar el frame.
Con k fraccionario (móvil, `mobileFrameRule`) todo escala lineal con k; el riesgo es el alto del panel derecho y el
solape con la barra de vida/XP en ventanas 960 × 540 (el spec exige HUD entero y sin solapes ≥ 960 × 540).

**5. Calavera.** Sí existe en los assets registrados: `public/assets/tiny-swords/Factions/Knights/Troops/Dead/Dead.png`
(ya en `asset-provenance.json`, Update 010; `appearance.json` `corpse`: hoja 128×128, 7 × 2 frames, la animación de
muerte usa 1–13). Es una hoja de calaveras; frames limpios (completos y de frente) hacia el 3, 4 y 9, y el 0 está
vacío. No hace falta generador ni script ni nota de procedencia nueva. Reutilizarla como icono del contador de bajas
(mismo mecanismo que `counterIcon` de oro/madera/piedra) cambia `killsLabel` (`Bajas: N` → `N`) y `HUD_RESERVE_TEXTS`.

**6. Obra: iconos y texto.** Hojas utilizables: `Factions/Knights/Buildings/House/House_Blue.png` (128×192, 1 frame,
vista) y `Tower/Tower_Blue.png` (128×256, 1 frame), ya registradas y en `appearance.json` (`sites.house`/`tower`).
`ResourceIcons` solo cubre los 5 recursos; haría falta un hermano para edificios (URL por `assetUrl`, como hoy) y
`<img>` con `object-fit: contain` (proporción 2:3 y 1:2: mostrar a ~3em de alto). Textos: hoy `MENU_LABELS`
(`menuText.ts`) tiene las etiquetas y `guide.json` el único texto interpolado (`parseGuide`, `{clave}` desde la
`RunConfig`). Los valores (1 oro/1.800 ticks = 30 s, 16 flechas, daño 4, alcance 350) viven en
`content/buildings.json`; escribirlos a mano en `menuText.ts` duplica contenido (regla 5, "sin números mágicos").

## Capacidades/specs afectadas (búsqueda en `openspec/specs/**`)

- `castle-shop`: botón `Salir` (l.206-232 "Salir con Esc o con el botón", 291-312 maquetación). `build-sites`: l.597-660
  (panel de obra), 833-856 (maquetación con `Salir`), iconos/`faltan`. Se reescriben con la `×` (nombre accesible
  decidible).
- `menu-guide`: icono de recursos (l.385-430; tamaño no fijado, solo ≥ 20 px en E2E de obra) y texto "con Salir".
- `hud`: "Bajas en el HUD" (l.147), anclaje/solapes/escalas (l.165-260), reserva de paneles (`Bajas: 12345`) y el
  icono de contadores (l.260-325).
- `sprite-rendering`: "Barras de vida de las estructuras" (l.2497-2542), solo si el arreglo cambia el contrato
  (hoy ya exige barra llena al empezar; el bug es de implementación). Capas: sin cambios.
- `touch-controls`: la `×` es zona pulsable en móvil (≥ 44 × 44 px CSS en el resto de controles táctiles).
- `audio` y `simulation-loop` mencionan "Bajas" solo como bajas de simulación: no cambian.

## Opciones

**A. Un solo change `0036-ui-polish` (6 puntos).** Pros: coherente (todo es capa DOM/HUD), un solo gate. Contras:
mezcla un bug que exige diagnóstico con cambios de maquetación; el HUD reflowed arrastra ~50 tests de HUD/layout.
**B. Dividir: 0036 DOM (1, 2, 4-guía/obra, 6) y 0037 HUD (4-HUD, 5), bug 3 como fix aparte (`fix/…` o primer grupo).**
Pros: riesgo y revisión acotados, el bug se cierra rápido con su prueba real. Contras: más changes y más renumeración
(archers → 0038, characters → 0039).
**C. Un change con grupos ordenados: (G1) bug 3 con diagnóstico, (G2) DOM, (G3) HUD.** Pros: una renumeración, aislable
por commit. Contras: change largo, verify más pesado.

## Riesgos e incógnitas

- Bug 3: sin reproducción real no hay causa raíz demostrada; se necesita captura o prueba con `Graphics` real
  (p. ej. E2E con lectura del `commandBuffer`, o un píxel). Regla `e2e-lite`: máx. 1-2 E2E nuevos y en manual.
- Tests con aserciones exactas afectadas: snapshot `dom-unchanged.test.ts.snap` (l.781, 1007, texto `Salir`),
  `shop-panel.test.ts` l.62/122 y `build-panel.test.ts` l.66/108/142 (clase y texto del botón),
  `styles-ui.test.ts` l.268 (`.shop-panel__leave`), `hud-format.test.ts` l.70-72 (`Bajas: 12345`),
  `ui-layout.test.ts` y `hud-panels.test.ts` (`HUD_BASE`, cajas, `HUD_RESERVE_TEXTS`), `hud.test.ts` (33 ocurrencias de
  `kills`/layout), `dom-unchanged.test.ts` l.194-235, `guide-modal.test.ts` l.287, E2E `gameplay.spec` l.860-876
  (iconos ≥ 20 px y hueco ≥ 8 px: seguirían verdes) y `smoke.spec` l.216 (`hud` `toEqual` exacto: no añadir campos a
  la sonda sin actualizarlo). `ResultsOverlay.ts:53` y `dom-results-lines.test.ts:46` usan `Bajas: N` en
  resultados: fuera de alcance salvo decisión.
- Un `<button>` con `×` necesita `aria-label`; el nombre accesible hoy "Salir" lo usan tests y specs. Foco: tras pulsar
  `button()` hace `blur()` (se conserva).
- Layout: el panel de tienda se desplaza por dentro; una `×` absoluta no debe solaparse con `h2` centrada en ventanas
  estrechas (móvil, 12 px de relleno mínimo).
- Cumplir ≥ 44 × 44 px en móvil con una `×` pequeña; la zona de clic puede ser mayor que el glifo.
- Si los textos de edificios se interpolan, extender `guideSchema`-estilo o un nuevo esquema (zod) y su cruce en
  `bootContent`; error nuevo de contenido.
- Sin núcleo: balance, firmas y `BALANCE_BASELINE` intactos; 820/904 objetos del mapa no cambian.

## Mediciones previas

No aplica (no fija objetivo de balance, ritmo ni rendimiento). Solo comprobar a mano, con captura a 1.280 × 720 y
960 × 540, el alto del HUD con iconos mayores.

## Preguntas para el usuario

1. ¿La `×` también en guía y Sonido (ahora con `Cerrar`) o solo tienda y obra? ¿El nombre accesible sigue siendo "Salir"?
2. Calavera: ¿vale la de `Dead.png` (frame de calavera de frente) o prefieres dibujarla? ¿El número de bajas va sin
   etiqueta ("12345")? ¿También en resultados ("Bajas: N") o solo en el HUD?
3. Tamaños: ¿HUD 24 px (subiendo el pitch de filas) y guía/obra 3em? ¿Prefieres recortar el frame del icono en vez de
   subir el pitch?
4. Textos de casa y torre: ¿interpolados desde `content/buildings.json` (nuevo esquema + `bootContent`) o texto fijo
   en `menuText.ts` sin cifras ("Genera oro con el tiempo" / "Dispara a los enemigos cercanos")?
5. ¿Un solo change, dividido (DOM / HUD / bug) o con grupos? ¿Confirmas renumerar archers → 0037, characters → 0038?
6. ¿Puedes dar una captura o pasos exactos del bug 3 (menú → Jugar, `?e2e`, móvil, qué estructuras)?
