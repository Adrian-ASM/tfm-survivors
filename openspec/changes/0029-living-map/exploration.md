# Exploración 0029 · living-map

## Contexto actual
- Plan puro del arte: `src/infrastructure/phaser/map/planMapArt.ts` (capa baja: agua, espuma, orillas, puentes, troncos, fachada, estructuras, vetas, solares; alta: copas, tejado, partes altas). Cada objeto lleva `bounds` y el `MapCuller` (`mapCulling.ts`, margen 1 celda) los oculta por índice en `[...low, ...high]`.
- Árboles: cada celda `trunk` = 2 sprites (tronco bajo + copa alto) con el mismo frame cortado. Frame y volteo salen de `deriveSeed(decorSeed, cellIndex)` (`treeChoices.ts`, `DECOR_STREAM` 2: hash, sin PRNG ni orden). `Tree.png` (768 × 576, frames de 192) tiene 6 frames casi idénticos (0–3 fila 0, 4–5 fila 1) con balanceo leve y un tocón en el frame 8; hoy se usan como 6 "modelos" estáticos (`appearance.json` `trees.models`). Es decir, ya están en el repo y son plausiblemente los fotogramas de balanceo.
- Torre goblin: `Wood_Tower_Red.png` (1024 × 192, 4 frames de 256 × 192, balanceo de banderas); `structureAspect` usa solo `idle.frames[0]` y parte la estructura en `structure` (baja) y `structure-top` (alta); la ruina alterna por `setEnabled` (0021).
- Único animado del mapa hoy: la espuma, con 1 `setFrame` común para todos (`RenderLayers.animateFoam`, `mapCanvas.foam`). No hay mecanismo de fase por objeto.
- Decoración: en el repo solo `Deco/04–06.png` (64 × 64, 1 frame), usadas como roca de piedra (`appearance.json` `stone.rocks`). Deco 01–03 y 07–18 NO están: hay que copiarlas del pack Update 010 (fuera del repo, no verificable aquí; la búsqueda web no da su contenido) y registrarlas en `content/asset-provenance.json` (ruta, sha256, bytes; `guard-assets.mjs` falla si falta la entrada o hay Free Pack).
- Objetos del mapa: 737 / 820 en semillas 42 / 123 (`tests/infrastructure/phaser/plan-sites.test.ts:51`, spec `build-sites` l.816); 0027 y 0028 no lo cambiaron. Los árboles dominan (2 objetos por `trunk`, `trunkDensity` 0,12): holgura de 263 / 180 objetos hasta 1.000.
- Sonda `sprites.mapArt` (`water, shore, foam, tree, canopy, bridge, castle`, `objects`, `drawn`) rellenada en `RenderLayers.paintMap`.

## Capacidades/specs afectadas
`sprite-rendering` (pintado del mapa, variedad de árboles, presupuesto ≤ 1.000, sonda, reserva por elemento), `build-sites` (escenario "737 y 820" ya fijado), `asset-provenance` (nuevas hojas). No tocan `procedural-map` ni el núcleo: es solo infraestructura.

## Opciones
**A. Decoración por hash de celda con subflujo derivado + animación por `setFrame` por objeto.** Decoración elegida con `deriveSeed(deriveSeed(decorSeed, K), cellIndex)`; fase de cada árbol de otro tramo de bits de `deriveSeed(decorSeed, cellIndex)`. Pros: sin PRNG, sin orden, sin tocar firmas (ninguna se genera de `decorSeed`), variedad de árboles por modelo intacta si no se reutilizan sus bits. Contras: hay que fijar K como constante nueva; ambos sprites del árbol deben cambiar de frame a la vez.
**B. Flujo de azar propio `Mulberry32` (como `STRUCT_STREAM`) para la decoración.** Pros: colocación con rechazo y separación mínima. Contras: depende del orden de recorrido; en infraestructura no hay ADR que lo ampare; más pruebas.
**C. Animar con animaciones del motor (`anims`) por sprite con `startFrame` aleatorio.** Pros: poco código propio. Contras: `play` por objeto del mapa (cientos) y de ahí fuera del recorte de 0018, que decide por índice; reloj del motor ≠ reloj de render de `frameAt`; peor para sonda y tests sin navegador.

## Riesgos e incógnitas
- Presupuesto: decoración 1 objeto cada una; la torre y el árbol no suman objetos (mismos sprites). Con 180 de holgura (semilla 123), la decoración debe ser ≤ ~150 por mapa o sustituir algo; hay que cambiar los tests que fijan 737/820 y la spec.
- Coste por frame: `setFrame` de árboles visibles (decenas a 1.280 × 720; hasta 2 sprites cada uno) a 6–8 fps de animación; con fases distintas habrá cambios casi cada frame. Fps en CI sin GPU ya fue problema en 0015 (capas grandes): medir con CPU frenada, `MapCuller` debe seguir ocultando los de fuera.
- Los recortes (`crop`) y `bounds` de copa y tronco se calculan con un frame; confirmar que los 6 frames tienen la misma silueta o que la caja con margen (1 celda) los cubre.
- Decoración sobre recogibles/ovejas/jugador: baja puede esconder gemas pequeñas (0030 `pickup-visibility` lo toca).
- Las Deco 01–18 no se han visto: tamaños (¿64 × 64?, ¿hojas con varios frames?), cuáles son árboles/tocones/arbustos/setas y si alguna es agua/orilla no se ha podido confirmar sin abrir el pack.
- El plan debe quedar determinista aun con hoja caída (reserva por elemento: ¿rectángulo o nada?).

## Mediciones previas
- Objetos del mapa en semillas 42 y 123 con la decoración propuesta (≤ 1.000; objetivo ≤ 950 para dejar margen) y reparto por zona. Medir con la densidad recomendada en un script sin navegador (como `plan-sites.test.ts`), semillas 1..50 para el máximo.
- `drawn` medio y máximo en la vista de 1.280 × 720 y en la de tope 2.560 × 1.440 (hoy 667/750 y 106/67 en 42/123 a vista pequeña).
- Coste de animación: ms por frame con CPU frenada (`CI_LIKE=1`), `realtime`, solo informativo (no gate, regla `e2e-lite`).

## Decisiones abiertas (recomendación)
1. Densidad: 1 decoración cada ~25 celdas de hierba válida (~60–90 por mapa; tope duro 120). Motivo: cabe en la holgura (180) y no satura.
2. Zonas: solo hierba libre; fuera de la zona de inicio, de la huella del castillo + 1 celda, de solares y su borde, de huellas de campamento, de celdas de orilla y de vetas/montones; permitidas junto a troncos. Motivo: no tapar interactuables ni aumentar bloqueo visual.
3. Qué Deco entran: sin ver el pack, proponer las 12 de Deco 01–03 y 07–18 y que el autor tache las que no encajen; Deco 04–06 siguen siendo rocas de piedra y se excluyen (son piedra del juego).
4. Fotogramas de árbol: 6 (frames 0–5) en bucle, 6 fps; el tocón (frame 8) fuera. Motivo: balanceo suave sin ruido.
5. Torre: 4 frames de `Wood_Tower_Red` a 4–6 fps, misma fase para todas (o fase por `structure.id`); ruina estática; castillo, casas y mina estáticos.
6. Fase por árbol: de bits altos del hash `deriveSeed(decorSeed, cellIndex)` (no los del modelo ni el volteo). Motivo: sin azar nuevo, determinista y sin firmas.
7. Capa: decoración en baja (bajo entidades); solo en alta si es alta (arbusto grande/árbol) y se corta como el árbol. Motivo: no tapar al jugador ni a los recogibles.
8. Reserva si falla una hoja de decoración: no pintar (sin rectángulo); la de árbol y torre ya tiene su reserva.

## Preguntas para el usuario
- ¿Puede indicar qué es cada Deco 01–18 (nombre y tamaño) o dejar el pack accesible? ¿Hay algún Deco que sea árbol/tocón/agua?
- ¿La decoración debe poder cambiar `drawn`/`objects` de la sonda con campos nuevos (p. ej. `sprites.mapArt.decor`)?
- ¿Se acepta actualizar la spec de 737/820 a las nuevas cifras?
