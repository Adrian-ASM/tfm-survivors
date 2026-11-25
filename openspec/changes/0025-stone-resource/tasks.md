# Tasks · 0025-stone-resource

> Base: `design.md` (contrastado con las 6 specs delta, §13) y ADR-0024. TDD por capa (ADR-0018): **rojo comprobado**
> en las tareas de `domain` y `application` (marcadas *TDD*); *test-after* en infraestructura, composición, contenido
> y tests de soporte. Por tarea: `npm.cmd run verify:fast`. Por grupo: `npm.cmd run verify` en verde y un commit
> (Conventional Commits, `refs: 0025-stone-resource`, trailer `Assisted-by`). Ningún grupo se cierra en rojo.
>
> **Orden**: el grupo 2 (aspecto y assets) va antes de la unión `stone` (grupo 3) porque añadir el tipo obliga a
> completar registros exhaustivos de infraestructura (`Looks.pickups`, `PickupLayer.counts`, `renderCounts`) y sin
> los datos de aspecto el grupo 3 no compilaría (design §13).
>
> **Convención de escenarios vivos** (spec `resources`): sin azar de la piedra (`Run.start` sin quinto parámetro)
> no hay piedra ni consumo. Los ~40 `toEqual` sobre `resources` y la expectativa de `smoke.spec` ganan `stone: 0`
> como cambio mecánico, sin rojo propio, en la tarea que añade el campo.
>
> Son 15 tareas, más que las ~8 de un change mediano: el change cruza cinco capas y añade arte. Cada grupo tiene
> ≤ 3 tareas y tiene sentido como commit.

## 1. Dominio: reglas de la tirada y contador (TDD)

- [x] 1.1 *TDD* `StoneDrops` (nuevo, `src/domain/resource/StoneDrops.ts`) y `ResourceRules.stoneChanceFor` con
  `drops.stoneChance?` (opcional en el dominio; ausente = 0). `roll(typeId, detonated)`: sin generador `false` sin
  consumir; con generador consume 1 valor siempre y suelta si `!detonated && ⌊u × 100⌋ < p`. Validación contra el
  catálogo con `STONE_CHANCE_INVALID` (tipo que falta, que sobra, fuera de 0..100 o no entero; el error nombra el
  tipo). Test `tests/domain/resource/stone-drops.test.ts` y `resource-rules.test.ts`.
  Escenarios: `resources` "Umbral de la tirada", "Valor límite de la tirada", "Tipo con 0 consume y no suelta" (a nivel
  de `roll`), "El barril que explota consume y no suelta" (a nivel de `roll`), "La probabilidad de un tipo no desplaza
  las tiradas de los demás", "Tabla de piedra inválida" y "Límites válidos de la tabla" (parte de dominio).
- [x] 1.2 *TDD* `Stockpile`: tercer contador `stone` (constructor `(gold, wood, stone = 0)`), `addStone(n)` sin
  bonificación ni resto, que no se toca en `spend`. Test `tests/domain/resource/stockpile.test.ts`.
  Escenarios: `resources` "Sin bonificación", "Valores grandes" y "No baja al comprar ni al recibir daño" (a nivel de
  `Stockpile`; en `Run` los cierra 3.3).

## 2. Infraestructura: arte de la piedra (test-after)

- [x] 2.1 Copiar `C:\Users\Adri\TFM\Tiny Swords (Update 010)\Deco\04.png`, `05.png` y `06.png` a
  `public/assets/tiny-swords/Deco/` (mismo nombre, byte a byte; nada más de `Deco`). Medir sha256 y bytes de cada
  fichero copiado (`Get-FileHash -Algorithm SHA256` y `(Get-Item …).Length`, o `node:crypto`) y añadir 3 entradas a
  `content/asset-provenance.json` (`path`, `source` `Tiny Swords (Update 010)/Deco/0N.png`, `version` `Update 010`,
  `sha256`, `bytes`) en el mismo commit. Anotar el tamaño real (ancho × alto) y el número de frames de cada hoja.
  Tests (ampliar el de procedencia/guardarraíl): `asset-provenance` "Hojas de la piedra registradas", "Integridad de
  las hojas de la piedra", "Hoja de la piedra sin entrada", "Hoja de la piedra del Free Pack" y "Solo las tres rocas de
  Deco". `npm.cmd run guard:all` en verde.
- [x] 2.2 Esquema y datos de aspecto: `pickups.stone = { placeholderColor, rocks: { small, medium, large } }` (rocas =
  `StillSchema` sin color), `EnemyAspectSchema.rock` obligatorio (`small|medium|large`), color de la piedra en
  `checkResourceColors` (tras la oveja), rocas en `pickupAspectsOf` (carga, registro y reserva) y en
  `XP_SHEET_MUST_DIFFER`. `appearance.json`: color `#9aa0a6`, rocas `Deco/04`–`06` con el tamaño medido en 2.1, escala
  0,5, `idle [0]`; `rock`: torch `small`, tnt `medium`, barrel `small`, guard `large`. `looks.ts`: `Looks.stones`
  (`rocks` y `of(source)` con reserva `medium` para origen ausente o sin aspecto). Tests
  `tests/infrastructure/appearance*.test.ts` y `looks.test.ts`, más uno que lee la cabecera PNG (IHDR) y comprueba que
  el frame cabe en la hoja. Escenarios: `sprite-rendering` "Datos del repositorio" y "Datos inválidos" (los 15
  casos).

## 3. Dominio: recogible `stone` y tirada en la partida (TDD)

- [x] 3.1 *TDD* Unión y recogibles: `'stone'` en `PickupKind`/`PICKUP_KINDS`, `PickupRules.maxStone`
  (`MAX_STONE_MUST_BE_INTEGER`, `capacity` = Σ 5), `PickupGain.stone`, `counts.stone`, `Pickup.source` y
  `drop(..., source = null)`; el relleno conserva el origen. Andamiaje de compilación en la misma tarea:
  `progression.maxStone` en `schemas.ts` y `"maxStone": 32` en `content/progression.json`, `builders.ts`,
  `Looks.pickups.stone = stones.rocks.medium`, entradas `stone` a cero en `PickupLayer.counts` y `renderCounts`, y la
  huella `BALANCE_CONTENT_SHA256.progression` calculada **sin `maxStone`** en `combat-content.test.ts` (constante
  intacta). Tests `pickup-field.test.ts` y `pickup-rules.test.ts`. Escenarios: `xp-gems` "Tope de piedra lleno",
  "Plaza de piedra liberada por una recogida" y "Tope de piedra lleno sin tocar los otros tipos" (a nivel de campo).
- [x] 3.2 *TDD* Tirada en `Run`: `Run.start(..., stoneRandom?)`, `StoneDrops` en el constructor y llamada en `onDeath`
  tras madera y oro. Doble `CountingRandom` y `SequenceRandom` de la piedra en `tests/support/`. Test
  `tests/domain/run-stone.test.ts`. Escenarios: `resources` "Tipo con 100 suelta siempre", "Tipo con 0 consume y no
  suelta", "Orden con el barril abatido", "Piedra por baja intercalada", "Piedra sobre un tronco", "Tirada con el tope
  de piedra lleno", "La probabilidad de un tipo no desplaza las tiradas de los demás"; `xp-gems` "Una secuencia de
  identificadores" y "Tope de piedra lleno"; `simulation-loop` "Piedra de la baja tras su oro y antes de la
  estructura".
- [x] 3.3 *TDD* Paso 4, bordes, recogida y snapshot: `collect` con `addStone`, `snapshot.resources.stone`,
  `PickupSnapshot.source` solo en piedras, `RunSetup.resources.stone?`. Mismo fichero de test y
  `run-stone-pickup.test.ts`. Escenarios: `resources` "El barril que explota consume y no suelta", "Baja por explosión
  ajena", "Tiradas del paso de armas antes que las del de peligros", "Partida recién creada", "Recogida de piedra con
  otros tipos en el mismo tick", "Sin bonificación", "No baja al comprar ni al recibir daño", "Valores grandes";
  `simulation-loop` "Sin piedra en el tick de la victoria", "Tirada en el tick de la victoria", "Las armas antes que la
  mecha, con piedra", "Partida recién creada", "Piedra en el snapshot", "Snapshot de la piedra no mutable desde fuera";
  `xp-gems` "Piedra recogida al pasar", "Piedra fuera del radio", "Piedra de una baja recogida en su tick", "Tipos del
  snapshot". Cambio mecánico de los `toEqual` sobre `resources`.

## 4. Aplicación y siembra

- [x] 4.1 *TDD* `RunSeeding.stoneRandom` (obligatorio), `StartRun.execute(..., stoneRandom?)` y `RestartRun` que lo pasa.
  Tests `tests/application/restart-run.test.ts` y `start-run.test.ts`; el de resultados y guardado con
  `RecordRun`/`resultsText`/export. Escenarios: `resources` "Partida nueva tras R" y "Sin rastro en resultados ni en el
  guardado".
- [x] 4.2 *test-after* `STONE_STREAM = 6` en `deriveSeed.ts`; `seededRun` crea el flujo antes de la rama `empty`;
  `runLauncher` lo pasa; `tests/support/runs.ts` `startSeededRun` lo pasa (desde aquí el lote de balance juega con
  piedra). Test `tests/composition/seed-source.test.ts`. Escenarios: `simulation-loop` "Mismo azar de la piedra en
  cualquier mapa", "Semillas distintas, azares distintos" e "Independiente de los demás flujos".

## 5. Contenido de recursos (test-after)

- [x] 5.1 `ResourcesSchema.drops.stoneChance` (obligatorio, enteros 0..100) y `content/resources.json` con torch 10,
  tnt 15, barrel 5, guard 25. Huella `BALANCE_CONTENT_SHA256.resources` calculada **sin `drops.stoneChance`**
  (constante intacta). Tests `content-schemas.test.ts`, `progression-content.test.ts` y `resources-content.test.ts`.
  Escenarios: `resources` "Tabla de piedra inválida" y "Límites válidos de la tabla" (carga), "Contenido por defecto",
  "Valor de piedra no configurable"; `xp-gems` "Contenido por defecto", "Valores no positivos", "Tope de gemas no
  entero", "Campo desconocido o ausente" y "Tope mínimo válido".

## 6. Render y HUD (test-after)

- [ ] 6.1 `PickupLayer`: el hueco guarda su `PickupLook`; la piedra usa `stones.of(p.source)`; reserva por roca; sonda
  `sprites.pickups.stone`. Tests `pickup-layer.test.ts`, `render-counts.test.ts` y el de simulación con dos aspectos.
  Escenarios: `xp-gems` "Topes de los cinco tipos pintados" y "Sprite reutilizado para la piedra"; `sprite-rendering`
  "Cada piedra con la roca de su origen", "Cambiar la roca es solo de datos", "Reserva de una roca", "Pintar la piedra
  no cambia la simulación", "Recuento de piedras por roca agregado", "Sonda en el menú" y "Totales del mapa con
  estructuras y vetas" (701/784 sin cambios).
- [ ] 6.2 HUD: `HUD_BASE.stoneY = 70`, `hudLayout().stone`, `HudTexts.stone`, `hudBoxes.stone`, contador con icono
  `counterIcon(looks.pickups.stone)` (roca `medium`), `Hud.shown.stone`, `GameScene.hudView().stone` y sonda
  `window.__sprint.hud.stone` (`main.ts`, `tests/e2e/probe.ts`). Tests `hud.test.ts` y `ui-layout.test.ts`.
  Escenarios: `hud` "Piedra al empezar", "Piedra que cambia entre snapshots", "Número grande", "Icono de la piedra que no
  carga", "HUD al empezar", "Sin HUD en el menú", "Piedra congelada en pausa y en la tienda", "HUD entero y sin
  solapes" y "Contadores reubicados al redimensionar".

## 7. Determinismo y balance (tests de soporte, test-after)

- [ ] 7.1 `tests/support/stoneGolden.ts` con `STONE_GOLDEN` (42 y 123; design §10) y tests de regresión en
  `tests/domain/determinism-stone.test.ts`. Escenarios: `simulation-loop` "Firma dorada de las piedras", "Firmas
  anteriores intactas", "Oleadas intactas", "Piedra con el mapa vacío", "Partida con piedra reproducible" y "… en el
  mapa vacío"; `resources` "Valores consumidos igual a bajas", "Ninguna otra fuente de piedra", "Mismo combate con y sin
  recursos" (ampliado con `stoneChance` 0) y "La piedra solo consume su azar".
- [ ] 7.2 Balance y rendimiento: `balanceMeasure` con piedra soltada y recogida por partida (informativo); el lote
  existente compara con `BALANCE_BASELINE` **sin regenerarla**; los quietos con mapa generado y vacío. Bench de
  `tests/bench/run.bench.ts` con cinco topes llenos. Escenarios: `resources` "Línea base intacta" (30/50 y ≥ 1 piedra)
  y "Quieto sigue perdiendo"; `simulation-loop` "Peor caso con los cinco topes llenos". Anotar para el verify-report:
  media de piedra, tiempo del lote frente a ~35 s, y bench frente a 0,25/0,27 ms.

## 8. E2E y documentación

- [ ] 8.1 E2E (único, ampliado): en `tests/e2e/gameplay.spec.ts`, "Contadores en el navegador" (seed 42, mapa real,
  `?e2e&manual`, `step(n)`) compara además `hud.stone` con `resources.stone` y `sprites.pickups.stone.visible` con las
  piedras del snapshot en cada lectura. En `smoke.spec.ts`, solo `{ gold: '0', wood: '0', stone: '0' }`. Escenario:
  `hud` "Piedra en el navegador [E2E]". `npm.cmd run test:e2e` en verde.
- [ ] 8.2 Documentación: estado de ADR-0024 a *aceptada* con addendum de apply (tamaño real de las hojas, media de
  piedra, bench); `AGENTS.md` §1 (párrafo del change 0025); comentario del contrato de determinismo de `Run` y del
  puerto `RandomGenerator`; diario de IA (`docs/ai-log/`).
