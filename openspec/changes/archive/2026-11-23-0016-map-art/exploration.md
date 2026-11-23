# Exploración 0016 · map-art

Intención: sustituir los colores de reserva del mapa (0015) por arte Tiny Swords Update 010 (CC0): agua, orillas
con autotile, árboles con copa, puentes y castillo sólido en la zona de inicio.

## Contexto actual

- Dominio (`src/domain/map/`): `CellType` = grass|trunk|water|bridge (códigos 0..3), `GameMap` (rejilla 32 × 18, celdas
  de 60 px, mundo 1.920 × 1.080 exacto, sin recorte), `generateMap` (ríos, puentes, troncos), `MapRules.inStartZone`
  (disco r = 180 px centrado en el mundo, solo reserva de troncos). El jugador nace en el centro del mundo.
- Render (`src/infrastructure/phaser/`): `TerrainView.ts` (`terrainFills`/`mergeRuns`/`paintTerrain`, puro, un rectángulo
  por tramo no-hierba), `phaserArt.ts#terrainCanvas` (un `Layer` con `Rectangle` en pool), `GroundView.ts` (suelo =
  `TileSprite` de `Tilemap_Flat` frame 11 o rectángulo de reserva), `RenderLayers` (el orden de creación es el orden de
  pintado; no hay `setDepth` salvo HUD/overlays), `BootScene` (carga `spritesheet`s de `appearance`).
- Contenido: `content/appearance.json` (`ground` y `terrain` = 3 colores `#RRGGBB`, `TerrainSchema` strict en
  `appearanceSchema.ts`), `content/asset-provenance.json` (path, source, version, sha256, bytes; solo 8 ficheros hoy).
- Sonda: `sprites.cells` (`CellCounts` por tipo) y `window.__sprint.map`. Firma dorada `tests/support/mapGolden.ts`
  (semillas 42 y 123, un carácter por celda) fijada por `map-golden.test.ts`.

## Ficheros del pack (ruta bajo `Tiny Swords (Update 010)/`; tamaños leídos de las imágenes, confirmar con sha256 al copiar)

- `Terrain/Water/Water.png`: un tile liso de 64 × 64, no animado. `Terrain/Water/Foam/Foam.png`: 1536 × 192, 8 frames de
  192 × 192 (animada, espuma en torno a un tile de 64 centrado). `Terrain/Water/Rocks/Rocks_0N.png`: opcional, no pedido.
- `Terrain/Ground/Tilemap_Flat.png` (ya copiado): 640 × 256, tiles de 64. Bloque 3 × 3 (esquinas/bordes/centro, con borde
  oscuro hacia fuera), tira vertical de 3 (tapa-medio-tapa) y horizontal de 3, y 1 isla. Sirve para autotile de 4 vecinos
  (16 casos); **no trae esquinas cóncavas** (celdas con agua solo en diagonal).
- `Resources/Trees/Tree.png`: 768 × 576, frames de 192 × 192 (6 árboles en filas 0-1, tocón en el frame 8). Árbol ~110 px
  de ancho, ~170 de alto; el tronco ocupa la base (~20 px).
- `Terrain/Bridge/Bridge_All.png`: ~192 × 256, piezas sueltas (tramo vertical, horizontal, cabezas, troncos); no es una
  rejilla regular: habrá que recortar frames a mano.
- `Factions/Knights/Buildings/Castle/Castle_Blue.png` (+Yellow/Purple/Red/Construction/Destroyed): ~320 × 256, una imagen.
- El pack pinta **agua de fondo y tierra encima** (espuma bajo la tierra). Nuestro modelo es el inverso: hierba de fondo
  y agua en celdas. La orilla se resuelve sobre la celda de hierba adyacente al agua o sobre la propia celda de agua.

## Capacidades/specs afectadas

- `procedural-map` (spec de 0015): colisión copa/tronco, castillo sólido, zona de inicio (si se toca el dominio).
- `sprite-art`/apariencia (0012) y spec de render del mapa: nuevas entradas en `appearance.json`, reserva por colores.
- `asset-provenance` (guardarraíl): una entrada por PNG nuevo (Water, Foam, Tree, Bridge_All, Castle_*), sin Free Pack.
- Sonda E2E (`sprites`/`map`): recuentos nuevos o ampliados. ADR-0013 (render) puede necesitar addendum.

## Opciones

**A. Autotile solo en el adaptador, bake estático.** Máscara de 4 vecinos calculada en infraestructura desde `MapSnapshot`
(función pura testeable, como `terrainFills`). Todo el suelo/agua/orillas/puentes se compone una vez por partida en una
`RenderTexture` o en pocos objetos y se muestra con un único `Image`/`TileSprite`. Pros: dominio y firma dorada intactos
("el núcleo no cambia" del GDD); coste por frame ~0. Contras: una textura del tamaño del mundo (1920 × 1080) es justo lo que
partió los fps en CI sin GPU en 0015 (el problema fue la capa transparente a pantalla completa con mezcla); hay que medir;
reserva por colores más compleja.
**B. Sprites por celda en pool (sin textura grande).** Un `Image` por celda de agua/orilla/tronco, reutilizados entre
partidas, reservas por rectángulos como hoy. Pros: encaja con el patrón actual (pools, `mergeRuns`), sin textura grande.
Contras: unos 100-250 objetos estáticos (agua + orillas + 70 árboles + 2-3 puentes); `Tilemap`/`Blitter` de Phaser reducen
llamadas pero son una dependencia de API nueva en 4.2.1 (comprobar tipos en `node_modules/phaser`).
**C. Híbrida:** agua como `TileSprite` fijo solo bajo las celdas de agua (por tramo, como `mergeRuns`), orillas y árboles
como sprites; espuma animada opcional con un único frame o animación global.
Castillo: **(i)** solo visual sobre la zona de inicio (disco libre, sin colisión nueva, aspecto solo en adaptador; el
jugador nace dentro/encima) o **(ii)** celda `castle` nueva en dominio (colisión sólida, generador, `CELL_CODE`, firma
dorada, bot de referencia, re-medir balance 25/50 vs 29/50, quizá `isWalkableCode`, `nearestWalkable`).

## Riesgos e incógnitas

- Castillo sólido en el centro = jugador encerrado: la sólida exige desplazar el spawn o dejar un hueco; el GDD dice
  "en el punto de inicio". Cambia dominio, firma dorada, bot y balance (0015 ya costó recalibrar). Un castillo ~5 × 4
  celdas cabe en el disco de r = 180 (7 × 7 celdas) pero deja poco aire con el spawn.
- Escala 64 → 60: 0,9375 con píxeles no enteros (borroso/costuras si hay `antialias`; revisar `pixelArt`/`roundPixels`
  en la config de Phaser). Alternativa: celda 64 (cambia dominio y mundo 1.920 = 30 × 64, no encaja) o dibujar a 64 y
  dejar que la celda lógica sea de 60 (desfase visual acumulado: no). Probable: escala 0,9375 y comprobar.
- Copa sobre el jugador: ~70 árboles de ~100 px de alto en celdas de 60; las copas de manchas contiguas se solapan y
  tapan al jugador y enemigos. Hace falta una capa creada después del jugador y antes del HUD (por orden de creación o
  `setDepth`); decidir si la copa tapa también a los enemigos y proyectiles (legibilidad).
- Sin esquinas cóncavas en `Tilemap_Flat`: ríos de 1 celda con meandros en diagonal darán costuras visibles.
- Rendimiento CI sin GPU: lección de 0015 (PR #36). Medir antes de comprometer la opción.
- `TerrainSchema` hoy exige tres colores distintos y un tipo por tipo de celda; hay que extenderlo (nuevas hojas de
  `appearance.json`) sin romper la reserva.
- Puente: orientación (horizontal o vertical según el río); `Bridge_All` no es regular.
- Animación de la espuma: 8 frames; puede costar fps y los E2E manuales no avanzan el reloj de render (sin timers).

## Mediciones previas (las lanza el orquestador antes de la propuesta)

1. fps en CI-like (`CI_LIKE=1`, sin GPU, CPU frenada 25) de un prototipo con A, B y C sobre las semillas 42 y 123 frente a la
   línea base actual (rectángulos). Umbral: no peor que ~85 % de los fps de la base (la base es el valor de 0015).
2. Nº de objetos de escena en pantalla y drawcalls por opción. Umbral orientativo: ≤ 300 objetos estáticos.
3. Si se opta por castillo sólido (ii): balance con el bot de referencia en semillas 1..50 (banda 25..35 victorias) y
   "quieto pierde antes de 180 s" con todas; el castillo cambia el mapa y la geometría.
4. Puerta visual (GDD): capturas de 3-4 semillas (42, 123 y 2 más) con orillas, puentes y copa, antes de abrir el apply.

## Preguntas para el usuario

1. Castillo: ¿solo visual (sin cambiar dominio) o sólido con colisión (celda nueva, spawn desplazado, re-medir balance)?
2. ¿Copa sobre jugador y enemigos, o solo sobre el jugador?
3. ¿Espuma animada, un frame fijo o sin espuma?
4. Variedad de árboles (6 frames y tocón): ¿elegir por semilla (azar en el adaptador, sin consumir el flujo del dominio) o uno fijo?
5. ¿Se acepta la escala 0,9375 (píxeles no enteros) o se prefiere ajustar la celda/mundo (dominio)?
6. Color de castillo: ¿Blue como el arquero?

## Decisiones del usuario (2026-11-23, tras explore)

Aceptadas las recomendaciones del orquestador salvo el castillo, que el usuario quiere sólido:

1. Castillo **sólido** (opción ii): bloquea al jugador, así que cambia el dominio (celda o huella nueva, generador,
   `CELL_CODE`, firma dorada, bot de referencia) y obliga a desplazar el punto de salida y a re-medir el balance
   (semillas 1..50, banda 25..35 victorias, y quieto pierde antes de 180 s con todas).
2. La copa tapa **todo**: jugador, enemigos y proyectiles se pintan por debajo de las copas.
3. Espuma **animada** (render opción C, ver abajo).
4. Variedad de árboles **por semilla**, elegida en el adaptador con un flujo derivado (determinista, sin tocar el dominio).
5. Escala **0,9375** aceptada; se valida en las capturas de la puerta visual.
6. Castillo **Blue**, como el arquero.

## Mediciones previas (2026-11-23, prototipos temporales sin versionar)

Render, `CI_LIKE=1`, frenado 25, 1 worker, mediana de 3 pasadas, semillas 42 / 123 (base de rectángulos 21,6 / 21,9 fps):

| Opción | fps | % base | Objetos de escena |
|---|---|---|---|
| A: bake opaco en RenderTexture + árboles sprite | 20,6 / 20,5 | 95 % | 72 / 75 |
| B: todo sprites, espuma animada | 19,1 / 19,1 | 88 % | 206 / 300 |
| C: agua TileSprite por tramo, espuma animada | 19,0 / 18,6 | 86 % | 204 / 269 |
| C con espuma fija | 19,7 / 17,6 | 91 % / 80 % | ídem |

Ruido entre pasadas ±2 fps: la animación de la espuma no se distingue del ruido; penalizan los 130–225 objetos de suelo.
**Decisión del usuario: opción C con espuma animada**, aun en el límite del umbral del 85 %.

Castillo sólido (prototipo): huella 5 × 4 celdas (columnas 14–18, filas 6–9; 300 × 240 px = 320 × 256 a 0,9375),
salida en (990, 630) ante la puerta, zona de inicio (r = 180) centrada en la salida; la franja vetada al río es la
unión de zona y huella. Balance con el bot de referencia en 1..50: **24/50** con `player.speed` 210; 28/50 con 215,
26/50 con 220. Muy sensible a la huella (5 × 3: 24/50; una fila más arriba: 18/50). Quieto pierde antes de 180 s con
las 50. El bot no necesita lógica nueva si el castillo cuenta como no caminable. Firma dorada: cambian 135/576
caracteres (semilla 42, se mueve el río) y 95/576 (123), más las 20 celdas del castillo con código propio.
**Decisión del usuario: `player.speed` 215**, re-medido en apply con la huella definitiva.

Puerta visual (prototipo A): escala 0,9375 sin costuras entre baldosas (píxel algo suavizado; la escala de baldosa del
suelo debe pasar a 0,9375). Sin esquinas cóncavas: muesca de espuma en cada meandro, repetitiva en ríos en escalera
(semilla 123). Los marcos de `Bridge_All` hay que definirlos a mano (recorte con poste suelto en el prototipo).
Riesgo: con C los objetos llegan a ~270 en la semilla 123, cerca del tope orientativo de 300.
