# Exploración 0017-fullscreen-view

Intención: la vista ocupa toda la ventana; la aparición de enemigos deja de depender del tamaño de pantalla; mundo mayor que cualquier monitor razonable; HUD y overlays se recolocan al redimensionar; balance recalibrado.

## Contexto actual
- `content/arena.json`: mundo 1920×1080, `view` 960×540 (zod: mundo ≥ vista, `schemas.ts:107`). `main.ts:233-239` crea `Phaser.Game` con `width/height = view` y sin `scale` (tamaño fijo, sin `parent` ajustado).
- **La vista entra en el núcleo por un solo sitio**: `View` (`src/domain/arena/View.ts`, `halfDiagonal`) -> `SpawnRules.ringRadius = halfDiagonal + margin` (582,7 hoy) -> `placeSpawn` (anillo alrededor del jugador, recorte a la arena, `minDistance`). `RunConfig.ts:112` crea la `View` desde el contenido. Es puro y determinista: el anillo es constante por contenido, no por ventana.
- Adaptador: `CameraRig` (`setBounds` al mundo, `startFollow` lerp 1, `worldView` para la sonda), `GameScene` (`new CameraRig(cameras.main, world)`), `sceneWidgets.ts` (HUD y overlays con `scene.scale.width/height` leídos UNA vez en `create`, `scrollFactor(0)`; `MARGIN`, `BAR_WIDTH` y `RESULTS_LINES_DY` fijos), `cardLayout(view, n)` (recibe `{width,height}` fijo), `MenuScene` (título en `scale.width/2`).
- Mapa: rejilla `ceil(mundo/60)` = 32×18; castillo 5×4 con huella fija (cols 14-18, filas 6-9) y salida (990, 630); mapa pintado con objetos (no canvas), ≤ 300 objetos en las semillas 42 y 123 (test en `verify`).
- Balance: `tests/domain/balance.test.ts`, bot de referencia en `tests/support/`; gate 25–35 victorias de 50 (hoy 27), 0 quietos.
- Specs: `world-camera` (decía vista 960×540 y mundo 1920×1080 en escenarios y sonda), `enemy-spawning` (anillo "depende solo de la vista"), `hud`, `upgrades`, `main-menu`, `procedural-map`, `sprite-rendering`. ADRs a revisar: 0002, 0011, 0012, 0013.

## Hallazgo clave
Si la vista pasa a ser el tamaño de la ventana, `View` ya no puede ser contenido fijo ni entrar en el dominio: el tamaño de ventana es dato del adaptador y variable (rompería determinismo y balance por semilla). Hay que **sustituir `View` por un parámetro de contenido propio** del anillo (p. ej. `spawn.ringRadius` explícito) o por una "vista de referencia" que no sea la real.

## Opciones de escalado (Phaser 4.2.1; `Scale.RESIZE`, `FIT`, `ENVELOP`, `EXPAND` existen; `CameraManager` escucha `Scale.Events.RESIZE` y reajusta las cámaras)
- **A. `RESIZE` a ventana completa, zoom 1.** Se ve más mapa en monitores grandes. Pros: nítido, sin barras, lo que pide la historia. Contras: la visión depende del monitor (ventaja en 4K/ultrawide); `scale.width` cambia, así que HUD/overlays/cardLayout/menú deben recolocarse por evento `resize`; cámara con bounds mayores que el mundo si la ventana > mundo; hay que fijar un tope.
- **B. `RESIZE` + zoom de cámara por tamaño de ventana (visión acotada).** Zoom = clamp(ventana / vista de referencia) para que el área visible quede en un rango [min,max] de unidades de mundo. Pros: equidad y balance más estables; el mundo "razonable" puede ser menor. Contras: zoom no entero emborrona el pixel art (hoy sin `pixelArt`, `roundPixels` falso), HUD debe ir fuera del zoom (cámara de UI aparte o contra-escala), sonda `camera` ya no es V_w×V_h.
- **C. `ENVELOP`/`FIT` con resolución virtual fija.** Pros: cero cambios en HUD, cámara, sonda y balance. Contras: no ve más mapa (solo agranda), barras con FIT o recorte con ENVELOP, borroso; no cumple "ver más mapa".

## Riesgos e incógnitas
- Fps en CI sin GPU: un canvas a pantalla completa y más objetos del mapa. El E2E de humo corre en modo manual (sin umbrales de fps), pero el viewport de Playwright por defecto (1280×720) cambia lo que ven las sondas; fijarlo en la config de Playwright.
- Mundo: "mayor que cualquier monitor razonable" (¿4K = 3840×2160, ultrawide 5120×1440?) implica ≥ 4× área: rejilla ~64×36+ (más si el mundo ≥ 7680); `ceil(mundo/60)` crece, **la firma dorada (`tests/support/mapGolden.ts`) se regenera entera**, el castillo de huella fija y la zona de inicio quedan relativos al centro (revisar `castleSite`), troncos/ríos/puentes con densidades y `patchAttempts` 4000 pensados para 32×18, conectividad (`connectivity.test`), y el tope de 300 objetos (≈ 4× más objetos: replantear el tope o pintar solo por tramos/visibles).
- Balance: mundo mayor = enemigos con más espacio para huir y bot que tarda más en cruzar; densidad efectiva distinta. Con vista variable, el balance debe medirse con anillo/margen constantes y sin depender de la ventana.
- Spawn: si el anillo es fijo y la ventana lo supera (monitor grande), los enemigos aparecen DENTRO de la vista; hay que decidir el anillo respecto al tope de vista (p. ej. mitad diagonal de la vista máxima soportada) y el comportamiento al contacto (enemigos que nacen lejos tardan más en llegar: ritmo).
- Memoria/frame: cadáveres, gemas, `capacity` de capas pensados para la vista actual; culling de objetos fuera de pantalla en Phaser es por cámara, pero los 8.000+ objetos de mapa siguen en la lista de dibujo.
- HUD: `BAR_WIDTH`/fuentes fijos; en 4K quedan diminutos (¿escala de UI por DPR/ventana?). Overlays con interactividad: reposicionar zonas de clic al `resize`. Menú DOM (`ResultsPanel`/exportar/importar) ya es DOM, probablemente fluido (comprobar CSS/`index.html`).
- Pixel art: `pixelArt`/`roundPixels` no activados; con DPR > 1 o zoom no entero aparecen costuras en los tilemaps (`Tilemap_Flat`, tramos de `tileSprite`).
- Eventos: `resize` frecuente durante el arrastre de la ventana; Volver al menú destruye/recrea cámara y widgets (suscripciones a limpiar en `SHUTDOWN`).

## Mediciones previas (las lanza el orquestador antes de la propuesta)
1. Balance con mundo mayor: mismo bot (`referenceBot(config)`) sobre semillas 1..50 con el mundo candidato (p. ej. 3840×2160) y anillo fijo equivalente al actual; umbral: 25–35 victorias y 0 quietos (quieto pierde antes de 180 s); además, plazo de primera subida y primer contacto (spawns más lejanos).
2. Conteo de objetos del mapa y tiempo de generación (ms) en semillas 42 y 123 con rejilla 64×36 y 128×72; umbral: tiempo razonable (< 50 ms) y decidir el nuevo tope.
3. Conectividad: % de semillas 1..200 con inicio-castillo accesible con la rejilla mayor.
4. (Opcional) fps con `CI_LIKE=1` a 1920×1080 frente a 960×540, solo diagnóstico.

## Decisiones que piden ADR
- Modelo de escalado (A/B/C) y tope de visión (supera 0011/0012/0013 en parte).
- Desacoplar aparición de la vista: sustituir `View` por parámetro de contenido (cambia el contrato de `enemy-spawning`).
- Tamaño de mundo/rejilla y tope de objetos del mapa (extiende ADR-0013).

## Preguntas para el usuario
1. ¿Más mapa en monitores grandes (A) o visión acotada con zoom (B), aun a costa de equidad/nitidez? ¿O basta con agrandar (C)?
2. ¿Tamaño de mundo objetivo (4K, ultrawide) y fija o proporcional a la ventana?
3. ¿Ventana arbitraria (arrastrar) o también F11/botón de pantalla completa (Fullscreen API)?
4. ¿HUD con escala propia en pantallas grandes?
5. ¿Banda 25–35 se mantiene tras agrandar el mundo? ¿Se acepta tocar `player.speed`/oleadas?
