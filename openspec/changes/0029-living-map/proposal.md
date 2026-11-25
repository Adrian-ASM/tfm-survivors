# Proposal · 0029-living-map

- **Estado**: aprobada (2026-11-25)
- **Issue**: (sin issue)
- **Rama / worktree**: `change/0029-living-map`
- **Historia**: `docs/gdd.md` «0029 · living-map» (Should, pequeño)
- **Exploración**: `openspec/changes/0029-living-map/exploration.md`

## Problema
El mapa generado se ve como una rejilla estática: la hierba libre está vacía salvo troncos, río, castillo,
campamentos, vetas, montones y solares, y lo único que se mueve en todo el arte del mapa es la espuma. Los árboles
usan los 6 fotogramas de balanceo de `Tree.png` como 6 "modelos" fijos y la torre goblin (`Wood_Tower_Red`, 4
fotogramas de banderas) solo pinta el frame 0. De la carpeta `Deco/` de Tiny Swords Update 010 el repo solo tiene
04–06, usadas como rocas de la piedra recogible.

## Objetivo
Al jugar en un mapa generado, el jugador ve decoración no bloqueante repartida por la hierba libre (setas, arbustos,
matas, cartel, poste y espantapájaros), los árboles se balancean cada uno con su propia fase y las torres goblin
intactas ondean sus banderas, sin que cambie nada de la simulación, del mapa, de las firmas doradas ni del balance,
y sin pasar de 1.000 objetos de escena del mapa.

## Decisiones del autor
1. **Deco que entran (11)**: `Deco/01`, `Deco/02`, `Deco/03` (setas rojas pequeña, mediana y grande, 64 × 64);
   `Deco/07`, `Deco/08`, `Deco/09` (arbustos, 64 × 64); `Deco/10`, `Deco/11` (matas de hierba, 64 × 64); `Deco/16`
   (cartel con calavera, 64 × 128); `Deco/17` (poste con flecha, 64 × 128); `Deco/18` (espantapájaros, 192 × 192).
   **Quedan fuera (7)**: `Deco/04`, `Deco/05`, `Deco/06` (rocas: siguen siendo solo la roca de la piedra recogible,
   para no confundir decoración con piedra), `Deco/12`, `Deco/13` (calabazas), `Deco/14`, `Deco/15` (huesos). Las 11
   nuevas se copian byte a byte del pack Update 010 y se registran en `content/asset-provenance.json`; ninguna del
   Free Pack.
2. **Densidad**: 1 decoración por cada ~25 celdas de hierba válida (orden de 60–90 por mapa generado), con **tope
   duro de 120** decoraciones por mapa. Se mantiene el presupuesto de **≤ 1.000 objetos del mapa**.
3. **Zonas**: solo celdas de hierba libre. Excluidas: zona de inicio, huella del castillo ampliada 1 celda por cada
   lado, huellas de solares, huellas de campamentos (casas y torres goblin), celdas de orilla del río y celdas de
   recursos (montones de madera y vetas de oro). Se permiten junto a troncos.
4. **Animación**:
   - Árbol: frames 0–5 de `Tree.png` en bucle a 6 fps; el tocón (frame 8) queda fuera. La **fase** de cada árbol sale
     de un hash de la semilla de decoración y de la celda (la misma familia que hoy elige el modelo, `DECOR_STREAM`
     por `deriveSeed`): **sin flujo de azar nuevo ni consumo de ningún PRNG**, sin tocar las firmas doradas.
   - Torre goblin intacta (`Wood_Tower_Red`): sus 4 frames en bucle a 5 fps.
   - Estáticos: torre goblin en ruina, castillo, casas goblin (intacta y ruina), mina de oro (activa y agotada) y,
     como dice la nota del GDD, los edificios de caballeros (`House_Construction`, `House_Blue`, `Tower_Blue`).
     La decoración (todas sus hojas tienen 1 frame) también es estática.
5. **Capa**: la decoración va en la capa baja (bajo las entidades y los recogibles). `Deco/16`, `Deco/17` y
   `Deco/18` (piezas altas) se pintan **partidas como el árbol**: la base (hasta el borde superior de su celda) en la
   capa baja y la parte superior en la capa alta; cuestan **2 objetos** cada una.
6. **Reserva**: si falla la hoja de una decoración (no carga o no contiene su frame), esa decoración **no se pinta**:
   sin rectángulo de color, sin errores no capturados, y el resto del mapa se pinta con su arte.
7. **Tope en objetos**: el tope de 120 de la decisión 2 cuenta **objetos de escena** de decoración, no piezas (una
   pieza alta cuenta 2). Objetivo: **≤ 950 objetos del mapa** en las semillas 42 y 123; el límite duro sigue en
   1.000.
8. **Fase de la torre**: cada torre goblin intacta tiene su propia fase, derivada de un hash de la semilla y de la
   estructura (sin PRNG ni flujo nuevo), como la del árbol.
9. **Reloj de la animación**: árboles y torres siguen el mismo reloj de render que la espuma, también en pausa, con
   oferta abierta, en la tienda y en la obra.

## Alcance
- **Dentro**:
  - Solo **infraestructura de render y contenido de aspecto/assets**: plan puro del arte del mapa (decoración,
    fases), pintado y animación por frame en el adaptador, datos de aspecto (`content/appearance.json`) con los
    aspectos de decoración y las animaciones de árbol y torre, validados con zod; 11 hojas nuevas en `Deco/` con su
    entrada de procedencia.
  - Colocación de la decoración por función determinista de la semilla y de la celda (hash, sin PRNG), solo en las
    zonas de la decisión 3, con la densidad y el tope de la decisión 2.
  - Animación de árboles con fase por árbol y de la torre goblin intacta; el resto, estático (decisión 4).
  - La decoración se recorta por cámara como el resto del arte del mapa (change 0018) y cuenta como objeto del mapa.
  - Recuento de decoración en la sonda de render (`sprites.mapArt`: pintadas y no pintadas por fallo de hoja) para
    poder verificar colocación y reserva; actualización de las cifras de objetos del mapa (hoy 737 / 820 en las
    semillas 42 / 123) a las nuevas.
- **Fuera**:
  - El núcleo (`src/domain`, `src/application`): ni `GameMap`, ni `Run`, ni snapshot, ni contenido de juego
    (`map.json`, `structures.json`, `resources.json`, `buildings.json`, `sheep.json`...). **No cambia el balance**.
  - Colisión o bloqueo de la decoración: es puramente visual; no la ven jugador, enemigos, ovejas ni `FlowField`.
  - Firmas doradas (`MAP_GOLDEN`, `STRUCTURE_GOLDEN`, `RESOURCE_GOLDEN`, `SHEEP_GOLDEN`, `STONE_GOLDEN`,
    `SITE_GOLDEN`) y `BALANCE_BASELINE` / `BUILDER_REFERENCE`: no se regeneran.
  - Decoración en mapas explícitos (`open`/`cells`) y en el mapa vacío: no hay (solo en el mapa generado).
  - Animar castillo, casas, minas, ruinas, solares o edificios; animaciones del motor (`anims.play`) por objeto del
    mapa.
  - Deco 04–06 como decoración, calabazas y huesos.
  - Visibilidad de recogibles bajo la decoración (change 0030 `pickup-visibility`).

## Capacidades afectadas
- `openspec/specs/sprite-rendering` (modificada):
  - "Datos de aspecto validados": el árbol pasa de lista de modelos estáticos a animación de 6 frames; aspectos de
    decoración nuevos; `idle` de la torre intacta con 4 frames; escenario "Datos del repositorio" ("árbol con ≥ 2
    modelos") y "Datos del mapa inválidos" (lista de modelos).
  - "Arte de Tiny Swords Update 010 por elemento": hojas de decoración; escenario "Solo las hojas usadas".
  - "Sonda de render para E2E": nuevo elemento del mapa (decoración); escenario "Totales del mapa con estructuras y
    vetas" (fija 701 y 784 "iguales a los de antes"); regla de que los recuentos "conservan el valor de antes".
  - "Pintado del mapa": nuevo elemento decoración y su reserva (no se pinta); la frase "ningún requisito depende del
    frame concreto de la espuma" (hoy solo la espuma se anima).
  - "Variedad de árboles por semilla": la variedad pasa a ser fase (y volteo) por árbol; escenarios "Variedad dentro
    de un mapa" y "Otra semilla, otros modelos".
  - "Capas del mapa y de las entidades": dónde va la decoración baja y la parte alta de las piezas altas.
  - "Coste de render del mapa (a demanda)" y los topes ≤ 1.000 de "Pintado de las estructuras", "Pintado de las
    vetas" y "Pintado de los solares y de los edificios" (ahora decoración incluida).
  - "Recorte del arte del mapa por cámara": la lista de objetos recortables incluye la decoración; la caja de un
    objeto "no cambia mientras dura la partida" debe seguir valiendo con árboles y torres animados.
  - "El recorte no cambia lo que se ve": hoy exige espumas sincronizadas al reaparecer; un árbol o una torre que
    vuelve a dibujarse debe mostrar el frame que le toca por su fase y el tiempo de render, no uno congelado.
  - "Recorte con aspecto de reserva" (las "cinco hojas del mapa").
  - "Pintado de las estructuras": la torre intacta se anima; la ruina y la casa siguen estáticas.
- `openspec/specs/build-sites` (modificada): "Colocación y arte intactos con el solar bloqueante", escenario "Objetos
  del mapa sin cambios" (737 y 820).
- `openspec/specs/asset-provenance` (modificada + nueva): "Procedencia de las hojas de la piedra" prohíbe versionar
  cualquier otra hoja de `Deco/` (escenario "Solo las tres rocas de Deco"); requisito nuevo "Procedencia de las hojas
  de la decoración" con las 11 hojas y la exclusión de 12–15.
- Sin cambios (solo se citan como invariantes): `procedural-map`, `goblin-structures`, `resources`, `sheep`,
  `simulation-loop` (ya nombran "el de la decoración" como flujo distinto; no se añade flujo).

## Riesgos y dudas
- **Presupuesto de objetos** (cerrado por las decisiones 5 y 7): holgura actual 263 / 180 (semillas 42 / 123); con
  el tope de 120 objetos el peor caso es 820 + 120 = 940 ≤ 950.
- **Siluetas (para el design) de los 6 frames del árbol y de los 4 de la torre**: el corte tronco/copa y la caja de recorte se calculan
  con un frame; hay que confirmar que todos comparten tamaño y que la caja los cubre.
- **Coste por frame**: `setFrame` por árbol visible con fases distintas; CI sin GPU ya sufrió en 0015. Medición solo
  informativa (`realtime`, `CI_LIKE=1`), sin gate de fps (regla `e2e-lite`).
- **Variedad de árboles**: al animarse, los 6 "modelos" dejan de ser variedad fija; la variedad queda en la fase y el
  volteo. Los escenarios vivos de variedad se reescriben en la fase SPEC.
- **Tamaños de Deco (para el design)**: vistos por el orquestador en el pack local (no versionado): 64 × 64, 64 × 128 y 192 × 192 de un
  frame; el espantapájaros mide 3 × 3 celdas de 64 y su escala/encaje los fija el diseño.

## Criterio de éxito
- Con el contenido por defecto y las semillas 42 y 123, el plan del arte del mapa (test sin navegador en `verify`)
  tiene **≤ 950 objetos** cada una (límite duro 1.000), y cifras exactas nuevas fijadas en las specs (sustituyen a
  737 / 820).
- En las semillas 1..50, cada mapa generado tiene entre 1 y 120 objetos de decoración (las piezas altas cuentan 2), todas en celdas de hierba fuera de las
  zonas excluidas (decisión 3), de las 11 hojas admitidas, y el mapa vacío y los explícitos tienen 0.
- Misma semilla ⇒ misma decoración (celda, hoja, posición) y mismas fases de árbol en dos cálculos y tras R.
- En cada mapa generado de 1..50 hay ≥ 2 fases de árbol distintas; cada torre intacta recorre sus 4 frames con su
  fase por estructura, y árboles y torres avanzan también en pausa, oferta, tienda y obra; la torre en
  ruina, castillo, casas, mina y edificios de caballeros muestran siempre el mismo frame.
- Firmas doradas (`MAP_GOLDEN`, `STRUCTURE_GOLDEN`, `RESOURCE_GOLDEN`, `SHEEP_GOLDEN`, `STONE_GOLDEN`, `SITE_GOLDEN`)
  intactas y `BALANCE_BASELINE` idéntica semilla a semilla (sin regenerar); snapshots iguales campo a campo con y sin
  decoración/animación en 1.200 ticks de la semilla 42.
- `guard:all` en verde con exactamente 11 entradas nuevas de `Deco/` en la nota de procedencia; los ficheros de
  `Deco/` versionados son exactamente `01`–`11` y `16`–`18` (las 11 nuevas más las rocas `04`–`06`), cada uno 1 vez,
  y ninguno de `12`–`15`.
- Con la hoja de una decoración bloqueada, esa decoración no se pinta, la sonda lo cuenta y no hay errores no
  capturados.
- `npm run verify` y `npm run test:e2e` en verde; como máximo 1–2 E2E nuevos o ampliados (regla `e2e-lite`).
