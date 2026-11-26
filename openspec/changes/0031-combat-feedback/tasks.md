# Tasks · 0031-combat-feedback

<!-- ADR-0018: TDD estricto (rojo comprobado) en el grupo 1; test-after en los grupos 2 a 4. `npm run verify:fast`
     al cerrar cada tarea; `npm run verify` completo y un commit por grupo (Conventional Commits, `refs: 0031`).
     Specs: SL = simulation-loop, GS = goblin-structures, AW = auto-weapons, SR = sprite-rendering.
     Design: openspec/changes/0031-combat-feedback/design.md (D1–D9). ADR-0027. -->

## 1. Dominio: registro de golpes (TDD estricto) · commit `feat(domain): registro de golpes de combate`
- [x] 1.1 Crear `combat/HitKind`, `combat/CombatRules` (enteros ≥ 1) y `combat/HitLog`, con
  `strike`/`begin`/anillo (D1). `RunConfig.combat` y `RunRules.combat`, `CONTENT_COMBAT`/`withCombat` en
  `tests/support/builders.ts` y `combat` en las configuraciones literales (R2). `WeaponTarget` gana `id`/`hp`. Inyectar
  el `HitLog` en `Arsenal`, `TowerBattery` y `HazardField` (D3) y llamar a `begin(n)` en `Run.tick` (D2).
  - Escenarios SL: «Golpe letal recortado a la vida restante», «Suma por objetivo y tick», «Suma de armas y explosión
    en el mismo tick», «Golpe letal sumado en el mismo tick», «Impacto sobre un objetivo ya abatido en el tick»,
    «Golpes en ticks distintos no se suman», «Golpe en una estructura que pasa a ruina», «Sin golpe en una ruina ni
    con explosiones» y «Golpes en una oveja». Para el dominio de «Valores de combate fuera de rango», `CombatRules`
    rechaza 0, −1 y 2,5.
  - Tests: `tests/domain/combat/hit-log.test.ts` (unitario del anillo, de la suma por referencia y del recorte) y
    `tests/domain/run-hits.test.ts` (escenarios con `Run`, usando `hits` desde 1.4 o un acceso de test al registro
    mientras tanto). Rojo: no existe `HitLog`.
- [x] 1.2 Golpe al jugador en `Run.applyHit` con `recordPlayer` (vida antes − después, posición del tick).
  - Escenarios SL: «Golpe al jugador con armadura», «Un solo golpe al jugador con contacto y explosión», «Jugador
    invulnerable sin golpe», «Golpe letal al jugador» y «Las curaciones no son golpes».
  - Test: `tests/domain/run-hits-player.test.ts`. Rojo: sin golpes `player`.
- [x] 1.3 Ids y tope: secuencia propia desde 0 por partida, orden de registro del tick, tope de no jugador sin consumir
  id, suma a los golpes conservados y jugador fuera del tope (plaza reservada, R4).
  - Escenarios SL: «Identificadores en orden de registro», «Secuencia sin huecos entre ticks», «Identificadores desde
    0 en cada partida», «Pulso con más objetivos que el tope», «Suma a un golpe conservado con el tope lleno», «El
    golpe al jugador no cuenta para el tope», «Tope en el límite» y «Descarte determinista» (semilla 42, 3.600 ticks,
    tope 2).
  - Test: `tests/domain/run-hits-order.test.ts`. Rojo: con el tope de 1.1 sin aplicar, o con los ids sin la regla de
    descarte.
- [x] 1.4 Snapshot: `HitSnapshot` con `targetId` (ausente en `player`) y `RunSnapshotBody.hits` con la ventana
  `tick > k − N`, la caché por `(k, nextId)` y las vistas congeladas (D4). `StructureSnapshot.maxHealth` sale de
  `site.type.health`. Ajustar las igualdades estrictas existentes (R1) sin regenerar firmas.
  - Escenarios SL: «Golpe visible durante la ventana», «Partida recién creada sin golpes», «Golpes congelados en la
    tienda y en la oferta», «Ventana con un frame de 15 ticks», «Golpes no mutables desde fuera», «Golpes en el
    snapshot del motor», «Partida recién creada» (lista de golpes vacía, estructuras con vida = vida máxima),
    «Estructuras en el snapshot del motor», «Mismos golpes con la misma semilla» y «Otra ventana u otro tope no cambian
    la partida» (con el estado de los `RandomGenerator`).
  - Escenarios GS: «Lista inicial», «Vida máxima tras el daño y en ruina», «Vida máxima de una estructura declarada»,
    «Orden estable tras destruir» y «Lista no mutable».
  - Tests: `tests/domain/run-hits-snapshot.test.ts` y ampliación de los tests del snapshot de estructuras. Rojo: no
    existen `hits` ni `maxHealth`.

## 2. Infraestructura: contenido (test-after) · commit `feat(content): contenido y aspecto del combate`
- [x] 2.1 Crear `content/combat.json` (15 / 48) y `CombatSchema` estricto con `hitWindowTicks ≥ MAX_TICKS_PER_FRAME`
  (constante nueva exportada de `application/FixedStepLoop`), y añadir `combat` a `RunConfigSchema`,
  `RawContentFiles` y `repositoryContent` (D5).
  - Escenarios SL: «Contenido de combate por defecto» (`weapons.json` sin campos nuevos), «Valores de combate fuera de
    rango», «Límites válidos del combate» y «Campos de combate ausentes o desconocidos».
  - Test: `tests/infrastructure/combat-content.test.ts`.
- [x] 2.2 Bloque `combat` de `appearanceSchema.ts` y `content/appearance.json` (D6): `colors` con `superRefine`
  (distintos y `player` rojo), `numbers` y `bar` (relleno ≠ fondo), con constantes de error que nombran el campo.
  - Escenarios SR: «Datos de combate del repositorio», «Datos de combate inválidos» y «Sin assets nuevos»
    (`npm run guard:all` y la nota de procedencia con las mismas entradas).
  - Test: `tests/infrastructure/appearance-combat.test.ts`.

## 3. Infraestructura (render) y composición (test-after) · commit `feat(render): números de daño y barras de vida`
- [ ] 3.1 `art/combatFeedback.ts` (`numberPose`, `newHits`, `damageText`) y `DamageNumberLayer` sobre `TextLike`:
  pool en anillo, deduplicación por `lastId`, tinte por clase, `R_b` del frame, recuentos y `clear()` (D7).
  - Escenarios SR: «Número de un golpe a un enemigo», «Color por clase», «Golpe letal visible», «Sin número con el
    jugador invulnerable», «Mismo snapshot pintado varias veces», «Un golpe en varios snapshots», «Pool lleno», «Más
    golpes nuevos que el pool en un frame», «Números congelados en pausa» y «Números con avance manual» (reloj
    manual con dobles).
  - Escenario AW: «Destello y número del mismo impacto».
  - Tests: `tests/infrastructure/combat-feedback.test.ts` y `tests/infrastructure/damage-number-layer.test.ts`.
- [ ] 3.2 `barRects` y `HealthBarLayer` sobre `BarCanvas`: redibujo por clave, relleno sin redondeo y ruina sin barra
  (D8).
  - Escenarios SR: «Barra al 50 %», «Barra llena al empezar», «Golpe que deja la estructura en ruina», «Torre dañada y
    sin barras en otros objetivos» y «Barras con reserva y fuera del plan del mapa» (820/904 con el test sin navegador
    existente).
  - Test: `tests/infrastructure/health-bar-layer.test.ts`.
- [ ] 3.3 Integración: `RenderLayers.createFeedback()` tras `createHazards()` en `GroundView.createPlayfield`, `render`
  y `clear`, fábricas `this.add.text`/`this.add.graphics` en `GameScene`, `cellSize` en `paintMap`, sondas
  `damageNumbers`/`healthBars` en `renderCounts` (a 0 en el menú) y cableado de `appearance.combat` en composición
  (D9).
  - Escenarios SR: «Barras y números sobre la parte alta y los peligros» (orden de creación con dobles), «R y menú con
    números de daño y barras», «Recuentos coherentes con el snapshot» (`Run` real con semilla 42, 600 frames, dobles
    del motor), «Los números siguen a la cámara, no al objetivo» (posición de mundo fija y `scrollFactor` 1),
    «Pintar números no cambia la simulación» y «Número de daño en una oveja».
  - Tests: `tests/infrastructure/render-layers-feedback.test.ts` y ampliación de `game-scene-manual.test.ts` si hace
    falta.

## 4. E2E, medición y documentación · commit `test(e2e)+docs: números de daño, medición y docs 0031`
- [ ] 4.1 E2E único (e2e-lite): ampliar un test de humo de `tests/e2e/gameplay.spec.ts` con
  `?e2e&manual&map=empty&seed=7` (`step(1)` hasta el primer golpe `enemy`, 30 frames en pausa, `step(60)` y Volver al
  menú) y añadir los tipos de la sonda en `tests/e2e/probe.ts`.
  - Escenario SR: «Números de daño en el navegador [E2E]». Sin esperas de reloj.
  - Test: `npm run test:e2e -- gameplay.spec`, en verde.
- [ ] 4.2 Medición con el test real. Ejecutar `npm run bench` antes del change (en `main`) y después, y comparar el caso
  del tick de `run.bench.ts`. Tomar el tiempo del test de balance (lote del bot v4 y del v5 con invariantes) en
  `verify` y comparar con los ~35 s de v4 en local. Confirmar `BALANCE_BASELINE`/`BUILDER_REFERENCE` idénticas y las
  seis firmas intactas.
  - Escenario SL: «Balance y firmas intactos».
  - Se anotan las cifras en el diario de IA y en el informe de verify. Umbral: ≤ +5 %; si no se cumple, aplicar la
    mitigación de design §Rendimiento.
- [ ] 4.3 Documentación: entrada 0031 en `AGENTS.md` §1 (registro de golpes, `combat.json`, capa 9, sonda), estado de
  la historia 0031 en `docs/gdd.md`, ADR-0027 enlazado y diario de IA (`docs/ai-log/`).
