# Tasks · 0022-resources-sheep

<!-- ADR-0018: TDD estricto (rojo comprobado) en domain/application; test-after en infraestructura, composición y
     contenido. `npm run verify:fast` por tarea; `npm run verify` completo + commit (Conventional Commits,
     `refs: 0022-resources-sheep`, `Assisted-by`) al cerrar cada grupo. No cerrar un grupo en rojo.
     Al cerrar cada grupo: `git fetch` y, si `origin/main` avanzó, rebase de `change/0022-resources-sheep` antes del
     commit del grupo siguiente. Referencias de escenario: `spec · "Requirement" › "Scenario"`; "(vivo)" = escenario
     que ya existía y que solo hay que mantener en verde. Design: `design.md` (rev. 2). -->

## 0. Mediciones previas (antes de tocar código)

- [x] 0.1 **M0, línea base.** *Medido: lote 31,8 / 32,0 s; bench gemas 0,2154 / 0,1744 ms; 27/50, 26,88 mechas.* En la misma máquina, sin cambios de código: `npm run bench` (caso "Peor caso con gemas")
  y tiempo de pared del lote de balance, dos veces. Anotar en `docs/ai-log/`. Congelar
  `tests/support/balanceBaseline.ts` (resultado, tick final y bajas de las semillas 1..50 con el bot v3, y la media de
  mechas) y la huella de los campos de combate del contenido (waves, enemies, weapons, upgrades, player, XP de
  progresión, peligros, estructuras). Ambos ficheros se generan con el código de `main`. Commit propio
  (`test: línea base de balance 0022`).
  Prepara: `resources` · "Balance sin recalibrar…" › "Victorias del bot de referencia", "Contenido de combate intacto".

## 1. Dominio · recogibles con tipo y contadores (TDD)

- [x] 1.1 **Reglas.** `PickupKind`, `PickupRules` (ex `GemRules`, con `maxGold`/`maxWood`), `ResourceRules` (drops
  por id resueltos contra catálogo y tipos de estructura, montones, vetas, colocación) y `maxWood ≥ woodPiles.count`
  en `buildRunRules`, con mensajes compartidos con zod. Rojo: `tests/domain/resource-rules.test.ts`,
  `tests/domain/run-config.test.ts`.
  Escenarios (parte de dominio): `xp-gems` · "Contenido de gemas validado" › "Valores no positivos", "Tope de gemas no
  entero", "Tope mínimo válido", "Tope de madera menor que los montones"; `resources` · "Contenido de recursos
  validado" › "Valores fuera de rango", "Límites válidos".
- [x] 1.2 **`PickupField`** (ex `GemField`): lista única, una secuencia de ids, pool libre `Σ topes`, tope y relleno
  por tipo, imán y recogida comunes, totales por tipo. Rojo: `tests/domain/pickup-field.test.ts` (migra
  `gem-field.test.ts`).
  Escenarios: `xp-gems` · "Recogibles con tipo" › "Tipos del snapshot" (a nivel de campo); "Gemas en el suelo" ›
  "Montón fuera del radio"; "Imán de gemas" › "Mismo imán para los tres tipos"; "Tope de gemas en el suelo" › "Tope de
  XP lleno con otros tipos en el suelo", "Tope de madera lleno", "Recoger otro tipo no libera plaza de XP";
  "Recolocación…" (todos los tipos).
- [x] 1.3 **`Stockpile`, paso 7.1 y snapshot.** `Run` con `pickups`, `resources`, vista `gems`; `RunSetup.gems[i].kind`
  y `RunSetup.resources`; no se recoge en el tick de victoria o derrota. Rojo: `tests/domain/run-pickups.test.ts`,
  `tests/domain/run-snapshot.test.ts`.
  Escenarios: `xp-gems` · "Recogida de gemas" › "Efecto según el tipo"; "Recogibles con tipo" › "Tipos del snapshot";
  `resources` · "Contadores…" › "Recogida de oro y de madera en el mismo tick", "Solo suben", "Valores grandes";
  `simulation-loop` · "Snapshot para el motor" › "Recogibles de varios tipos en el snapshot", "Partida recién
  creada" (oro, madera y listas vacías con el mapa vacío); "Determinismo" › "Snapshot no mutable desde fuera" (con
  recogibles; vetas en 2.2); "Orden de los pasos" › "Sin recursos en el tick de la victoria" (parte de recogibles);
  `xp-gems` · "Suelta de gema por baja" › "Las gemas no consumen azar".

## 2. Dominio · fuentes y vetas (TDD)

- [x] 2.1 **Drops.** `Enemy.detonated`, `onDeath` (gema y luego madera), `StructureField.settle(onRuin)` con el oro
  tras las bajas del paso de armas. Rojo: `tests/domain/run-resource-drops.test.ts`.
  Escenarios: `enemy-hazards` · "Madera del barril abatido" (sus 7); `goblin-structures` · "Vida, destrucción y
  ruina" › "Daño que no destruye", "Oro de una casa destruida", "Oro de una torre recogido", "Dos estructuras
  destruidas en el mismo tick", "Una ruina no suelta más oro", "Daño mayor que la vida", "Las explosiones no dañan
  estructuras", "El oro de las estructuras no consume azar"; `xp-gems` · "Recogibles con tipo" › "Una secuencia de
  identificadores"; "Suelta de gema por baja" › "Gema y madera intercaladas por baja"; "Recogida" › "Madera del
  barril recogida en su tick"; "Tope" › "Tope de oro lleno"; "Recolocación" › "Barril abatido sobre un tronco";
  `simulation-loop` · "Orden de los pasos" › "Las armas actúan antes que la mecha", "Las estructuras se destruyen tras
  las bajas", "Oro de una estructura recogido en su tick".
- [x] 2.2 **`GoldVein` y paso 7.2**, `RunSetup.veins`, `veins` en el snapshot. Rojo: `tests/domain/run-veins.test.ts`.
  Escenarios: `resources` · "Vetas de oro al pasar" (sus 7); `simulation-loop` · "Snapshot" › "Vetas en el snapshot
  del motor"; "Orden de los pasos" › "Recogibles antes que las vetas", "Sin recursos en el tick de la victoria"
  (vetas); "Determinismo" › "Snapshot no mutable desde fuera" (vetas).

## 3. Dominio · colocación, determinismo y balance

- [x] 3.1 **Colocación (TDD).** Extraer `chebyshevFrom` a `map/chebyshev.ts`; `placeResources` (candidatas, 1 valor
  por recurso), `resolveResources`, `TerrainSource.resourceRandom` y recursos declarados, `MapSnapshot.veins` y
  `woodPiles`, y montones como `wood` en el tick 0 antes que cualquier otro recogible. `RESOURCE_GOLDEN` en
  `tests/support/mapGolden.ts`. Rojo: `tests/domain/resource/place-resources.test.ts`,
  `tests/domain/run-resources-map.test.ts`.
  Escenarios: `procedural-map` · "Recursos en el mapa generado" (sus 4); "Colocación de recursos determinista…" (sus
  5); "Mapa explícito y mapa vacío" › "Partida con mapa vacío", "Mapa explícito con vetas y montones declarados",
  "Recurso declarado fuera del mundo"; `resources` · "Montones de madera…" (sus 3); "Contadores" › "Partida recién
  creada"; `simulation-loop` · "Snapshot" › "Partida recién creada" (con el mapa generado); `xp-gems` ·
  "Recolocación" › "Ninguna gema en reposo en celda no caminable".
- [x] 3.2 **Combate intacto y determinismo** *(todos en verde a la primera, como se esperaba; sensibilidad comprobada rompiendo `Run.collect`)* (test-after: el comportamiento ya está en 1–3.1; si alguno sale en verde a
  la primera, se anota). `withoutResourceSources(config)` en `tests/support`.
  Escenarios: `resources` · "Recursos sin efecto en el combate" › "Mismo combate con y sin recursos", "Los recursos no
  consumen azar"; `simulation-loop` · "Determinismo" › "Partida con recursos reproducible", "Dos partidas idénticas",
  "Partida larga reproducible" (oro y madera); `procedural-map` · "Azar del mapa independiente…" (vivos, en verde);
  "Los recursos no cambian celdas ni estructuras"; `simulation-loop` · "Mapa intacto" (`MAP_GOLDEN`,
  `STRUCTURE_GOLDEN` sin cambios). Tests: `tests/domain/determinism-resources.test.ts`, `tests/support/map-golden.test.ts`.
- [x] 3.3 **Balance y M1.** *M1: balance idéntico semilla a semilla (27/50, 26,88 mechas, 0 quietos en 100). Lote con el arnés de M0: 34,3–35,2 s frente a 31,8–32,7 s de `main` en la misma sesión (+8 %); con el arnés que reutiliza el snapshot `after` como `before` (sin cambiar resultados): 27,7–32,2 s. Bench tres topes 0,2672 ms (≤ 2 ms); gemas 0,2178 ms (M0 0,2154 / 0,1744). Informativo: oro 1,5 y madera 113,8 por partida.* `balance.test.ts` compara con `balanceBaseline.ts` semilla a semilla (resultado, tick y
  bajas), 100 quietos y mechas 26,9; test de contenido de combate contra la huella de M0; línea informativa de oro y
  madera medios. Caso de bench "tres topes llenos" en `tests/bench/run.bench.ts`. **M1**: lote ≤ 35 s local, bench
  ≤ 2 ms (anotar frente a 0,25 ms) y comparación con M0 en `docs/ai-log/`. Si el balance difiere en una sola semilla,
  parar: es un fallo de determinismo.
  Escenarios: `resources` · "Balance sin recalibrar…" (sus 4); `simulation-loop` · "Rendimiento con recogibles por
  tipo" › "Peor caso con los tres topes llenos".
- [x] 3.4 **Escenarios vivos sin cambio de comportamiento.** *Primera oferta (semilla 7, quieto): 2.082 con el mapa generado y 2.057 con el vacío con salida. Sin ids de gemas que adaptar: ningún test vivo con mapa generado fijaba ids de gemas.* Mantener en verde, adaptando solo los ids de gemas que se
  desplazan en mapas generados (montones con ids 0..N−1): `xp-gems` (todos los escenarios vivos de suelta, suelo,
  imán, recogida, tope, pintado y recolocación), `simulation-loop` (orden del tick, snapshot y determinismo vivos),
  `goblin-structures` "Destrucción sin XP ni baja", "Ruina hasta el final", `procedural-map` "Mismos spawns…",
  "Primera oferta en plazo…" (anotar los ticks medidos). Sin tests nuevos; `npm run verify` completo.

## 4. Infraestructura · contenido, arte y composición (test-after)

- [x] 4.1 **Contenido y siembra.** zod de `content/resources.json` (nuevo, con los valores del design §2),
  `progression.json` (`maxGold` 32, `maxWood` 64) y el cruce `maxWood ≥ woodPiles.count` en `parseContent`;
  `RESOURCE_STREAM = 4`; `seedSource` con `resourceRandom`; `main.ts` carga el fichero nuevo. Tests:
  `tests/infrastructure/content-schemas.test.ts`, `tests/composition/seed-source.test.ts`.
  Escenarios: `xp-gems` · "Contenido de gemas validado" (sus 6, parte zod); `resources` · "Contenido de recursos
  validado" (sus 4, `meat` incluido).
- [x] 4.2 **Aspectos y PNG con procedencia (misma tarea, mismo commit).** Copiar `W_Idle.png`, `GoldMine_Active.png` y
  `GoldMine_Inactive.png` a `public/assets/tiny-swords/…` con sus entradas en `content/asset-provenance.json`
  (sha256, bytes); medir las hojas al copiar. `appearance.json`: `pickups.{xp (forma), gold, wood}`, `veins`, colores
  de reserva distintos; zod. Tests: `tests/infrastructure/appearance-schema.test.ts`, guardarraíl
  (`npm run guard:all`).
  Escenarios: `sprite-rendering` · "Aspectos de los recogibles y de las vetas" › "Datos del repositorio", "Datos
  inválidos"; "Arte de Tiny Swords Update 010 por elemento" › "Hoja de cada elemento", "Solo las hojas usadas";
  `asset-provenance` · todos los del delta (6).

## 5. Infraestructura · render, HUD y sonda (test-after)

- [x] 5.1 **`PickupLayer`** (ex `GemLayer`): `SlotPool` de `Σ topes`, aspecto por tipo al aparecer, XP como forma de
  color sin contar como reserva; sonda `sprites.pickups` y alias `gems`; limpieza al cambiar de partida. Tests:
  `tests/infrastructure/pickup-layer.test.ts`, `layers-clear.test.ts`, `render-layers.test.ts`.
  Escenarios: `xp-gems` · "Pintado de las gemas" (sus 5); `sprite-rendering` · "Aspectos…" › "Reserva de un tipo de
  recogible"; "Proyectiles, gemas, pulso y fondo" › "Flechas y gemas", "Recogibles de los tres tipos"; "Limpieza de la
  vista…" › "R con cadáveres en curso", "R con el mapa real"; `resources` · "Contadores" › "Partida nueva tras R"
  (con `tests/application/restart-run.test.ts`).
- [x] 5.2 **Vetas en el plan y recorte; M2.** *M2: 701 (42) y 784 (123) objetos del mapa = 695/778 + 6 de las 3 vetas (≤ 1.000); `drawn` 0 en el menú (`emptyCounts`).* Sprites activo/agotado y `CircleDraw` de reserva en `planMapArt`,
  pintado en `TerrainView`, `StructureArt` parametrizado para vetas, `sprites.veins` y `mapArt.objects`. **M2**:
  objetos del mapa en 42/123 ≤ 1.000 (695/778 + vetas) y `drawn` 0 en el menú. Tests:
  `tests/infrastructure/plan-map-art.test.ts`, `structure-art.test.ts`, `map-culling.test.ts`.
  Escenarios: `sprite-rendering` · "Pintado de las vetas" (sus 4); "Sonda de render" › "Totales del mapa con
  estructuras y vetas", "`drawn` igual al recorte", "Sonda en el menú".
- [x] 5.3 **HUD.** `hudLayout`/`hudBoxes` con oro y madera, iconos con reserva, `Hud.sync` y sonda `hud`. Tests:
  `tests/infrastructure/hud.test.ts`, `ui-layout.test.ts`.
  Escenarios: `hud` · "Oro y madera en el HUD" (sus 4); "Contenido y visibilidad del HUD" (sus 6 no E2E); "HUD
  anclado a la ventana" (sus 5).
- [x] 5.4 **Sonda del mapa y escena.** `map.veins`/`map.woodPiles` en la sonda, cableado de `GameScene` y
  `RenderLayers`, y el sampler de `tests/e2e/probe.ts` (recogibles por tipo y vetas). Tests:
  `tests/infrastructure/map-probe.test.ts`.
  Escenarios: `procedural-map` · "Sonda del mapa para E2E" › "Sonda coherente con el núcleo", "Sonda con el mapa
  vacío"; `sprite-rendering` · "Sonda de render" › "Recuento coherente con el snapshot" (con el sampler);
  `resources` · "Contadores" › "Sin rastro en resultados ni en el guardado" (tests de `resultsText` y del
  repositorio de progreso, sin cambios de código).

## 6. E2E y documentación

- [ ] 6.1 **E2E nuevo (1)**, proyecto `logic`, `?e2e&manual&seed=42`: el jugador va al montón más cercano a la salida
  (`map.woodPiles` de la sonda, con un recorrido sin bloqueos comprobado como precondición) con `holdKey`/`step(n)`;
  en cada lectura los números del HUD (`hud`) son iguales a los del snapshot; al final la madera es > 0. Sin esperas
  de reloj ni umbrales de fps.
  Escenario: `hud` · "Contenido y visibilidad del HUD" › "Contadores en el navegador [E2E]".
- [ ] 6.2 **E2E ampliado** (no nuevo): "Estructuras y guardias en el navegador" añade los sprites `wood` y las vetas
  activas iguales a los del snapshot, sin reserva; los vivos "Sonda con castillo y salida", "Objetos dibujados con la
  cámara" y "Barril en mecha…" siguen en verde con `npm run test:e2e`.
  Escenarios: `sprite-rendering` · "Sonda de render" › "Estructuras y guardias en el navegador [E2E]", "Objetos
  dibujados con la cámara [E2E]", "Barril en mecha y su explosión en el navegador [E2E]"; `procedural-map` · "Sonda
  con castillo y salida [E2E]".
- [ ] 6.3 **Documentación.** AGENTS.md §1 (estado de 0022: recogibles con tipo, contadores, fuentes,
  `RESOURCE_STREAM`, mediciones M1/M2), ADR-0021 aceptado, entrada en `docs/ai-log/` (mediciones, incidencias de
  hooks). El seguimiento del GDD (renumerar ovejas) queda anotado, sin editar `docs/gdd.md`.
