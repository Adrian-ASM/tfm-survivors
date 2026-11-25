# Tasks · 0026-build-sites

<!-- Cada grupo es una unidad de commit con `npm run verify` completo (ADR-0018). Grupos 1–5: TDD estricto (rojo
     comprobado antes del verde). Grupos 6–9: test-after. Las tareas referencian escenarios de las specs delta de
     `openspec/changes/0026-build-sites/specs/` (bs = build-sites, pm = procedural-map, sl = simulation-loop,
     rs = run-state, eb = enemy-behavior, mv = player-movement, res = resources, aw = auto-weapons, sr =
     sprite-rendering, ap = asset-provenance, mm = main-menu). Escenarios de prueba: el solar de prueba (declarado en
     el mapa vacío) va en `tests/support/sites.ts` (`TEST_SITE`, `withSite`, `declaredSites`, `withStock`), con
     radio 40 y re-armado 300. Es un change grande (~133 escenarios): 9 grupos y 19 tareas. -->

## 1. Dominio · mapa con capa de obra (design §2, ADR-0025)
- [x] 1.1 `GameMap` con terreno inmutable, `live` + `BUILT`, `build()`, `revision`, `isBuilt` y `liveCodes`.
  `codesOf` pasa a copiar los códigos vivos. La colisión del jugador y de las ovejas lee la obra sin cambiar
  `Player` ni `Flock`.
  - Escenarios: pm "Caminabilidad de una celda construida"; bs "El jugador choca con la casa" y "Un solar sin
    construir no bloquea"; mv "Choque con una torre construida a velocidad máxima".
  - Tests: `tests/domain/map/game-map-build.test.ts` y `tests/domain/player/collision-build.test.ts`, sobre el
    mapa con `build` directo.
- [x] 1.2 `FlowField` sin copia propia, con `sync()` por revisión (BFS y `blocked`). `GuardPost` sin `codesOf`.
  - Escenarios: pm "Campo con un edificio" y "Mismo campo con los mismos edificios" (a nivel de campo); bs "El
    edificio corta la línea libre"; eb "El guardia vuelve rodeando el edificio" y "Mismo movimiento con la misma
    obra en otro momento".
  - Tests: `tests/domain/map/flow-field-build.test.ts` y `tests/domain/enemy/guard-post-build.test.ts`.

## 2. Dominio · reglas de edificios y solares (design §1, §3)
- [x] 2.1 `BuildingRules`/`BuildingKind` en `RunConfig`: costes, ingreso, arma de la torre con `WeaponType.create`
  y restricción `nearest-in-range` + `projectile`, tope de flechas, acceso con `radius + playerRadius < 1,5 ·
  cellSize` y `rearm > radius`, y colocación. `BuildSite` lleva huella 2 × 2 (casa = torre), acceso a 1,5 celdas y
  `ProximityGate`, extraído de `CastleGate` sin cambio de comportamiento.
  - Escenarios: bs "Jugador fuera de la huella al abrir" y la parte de reglas cruzadas de "Valores inválidos" y
    "Límites válidos" (en el dominio; la parte de zod va en 6.1).
  - Test: `tests/domain/sites/building-rules.test.ts`.
- [x] 2.2 `placeSites` (candidatas en orden de filas, 1 valor por solar, zona con anillo y fila de acceso,
  distancias, ovejas iniciales y ruta 18–35), `resolveSites` con `siteRandom` y `sites?` declarados (solo se
  comprueba que caben), `MapSnapshot.sites` y `SITE_GOLDEN` nueva en `tests/support/siteGolden.ts`.
  - Escenarios: pm "Reglas de colocación con las semillas del conjunto", "Contenido sin hueco suficiente",
    "Celdas intactas con solares", "Misma semilla, mismos solares", "Semillas distintas, solares distintos",
    "Los solares no cambian nada más", "Firma de referencia de los solares", "Colocar solares no consume el azar
    de la partida", "Mapa explícito con solares declarados", "Solar declarado fuera de la rejilla" y "Todo
    construido sin zonas aisladas" (todo casa y todo torre, con `build` directo).
  - Tests: `tests/domain/sites/place-sites.test.ts` y `tests/domain/determinism-sites.test.ts`.
  - Si no salen 6 en alguna semilla, se ajusta `minGapCells`.

## 3. Dominio · fase `building` en `Run` (design §4, §5 paso 12)
- [x] 3.1 `Settlement` con solares armados al inicio, paso 12 tras la tienda (uno por tick, asequible ⇒ abre; si
  no, sigue armado), `BUILDING` en `RunPhase`/`RunStatus`, `snapshot.sites` y `snapshot.build` cacheado por clave.
  - Escenarios: bs "Solares al crear la partida", "Sin solares en el mapa vacío", "Lista estable" (con
    `build`, que se hace en 3.2: el test se cierra allí) y los 14 de "Apertura del solar con re-armado", de "Se
    abre con el coste exacto de la casa" a "Abrir no consume azar"; "Oferta en el snapshot" y "Sin oferta fuera de
    la obra"; pm "Sin solares"; sl "Solar abierto con los recursos del mismo tick"; rs "600 ticks en obra", "La
    obra no consume azar", "Obra abierta justo antes del tick de la victoria" y "En obra y vuelta a en curso".
  - Tests: `tests/domain/run-sites-open.test.ts` y `tests/domain/run-building-frozen.test.ts`.
- [x] 3.2 `Run.build(kind)`/`leaveSite()` con `BuildError`, `Stockpile.spendMaterials`, `map.build` y vuelta a
  `RUNNING`.
  - Escenarios: bs "Construir una casa", "Construir una torre con el coste exacto", "Torre no ofrecida", "Tipo
    desconocido", "Construir fuera de la obra", "Un solo edificio por visita", "Construir no consume azar", "Salir
    y seguir", "Salir fuera de la obra" y "Visita sin construir"; res "La madera baja al construir", "La piedra baja
    al construir una torre" y "La casa no gasta piedra"; sl "Construcciones distintas divergen" y "Snapshot de los
    solares no mutable desde fuera"; pm "Tipos constantes con edificios"; bs "El tipo de las celdas no cambia".
  - Test: `tests/domain/run-build.test.ts`.
- [x] 3.3 Despeje de la huella al construir: `Enemy.relocate`, `PickupField.evict`, `Flock.evict` (con el origen)
  y `GuardPost.evict`, en orden fijo y sin azar. Comprobación de bloqueo en `Run`.
  - Escenarios: bs "Enemigo dentro de la huella", "Recogibles dentro de la huella", "Oveja que solapa la huella",
    "Punto de patrulla dentro de la huella", "Despejar no consume azar", "El enemigo rodea el edificio nuevo",
    "Campo recalculado con el jugador en la misma celda", "Aparición sobre el edificio", "Recogible creado sobre el
    edificio", "Explosión junto a una casa" y "El Linter no apunta a un edificio"; eb "El campo se recalcula y el
    enemigo rodea".
  - Los dos últimos de bs (explosión y Linter) son regresión: pasan en verde porque los edificios nunca fueron
    objetivos.
  - Test: `tests/domain/run-build-clearance.test.ts`.

## 4. Dominio · casas y torres (design §5 pasos 3 y 7.4, §6)
- [ ] 4.1 Ingreso de las casas en el paso 7.4: n = `builtAt` + k × periodo, orden de solares, `stock.add` con
  bonificación y resto compartido.
  - Escenarios: bs "Pagos de una casa", "Dos casas", "Con bonificación de oro", "Sin recogible ni tope", "Sin pago
    en el tick de la victoria" y "Las pausas no adelantan el pago"; sl "Pago de la casa tras la regeneración"; res
    "Pago de una casa como ingreso"; rs "Peligros, invulnerabilidad y pagos en pausa durante la obra".
  - Test: `tests/domain/run-house-income.test.ts`.
- [ ] 4.2 `TowerBattery` (pool propio, ids propios, solo tier 0, sin mejoras) y `Arsenal.step` partido en
  `advance` + `fire` (3.1 y 3.2). Se mueve `firstOverlapping` a `weapon/hits.ts` y se añade
  `snapshot.towerProjectiles`.
  - Escenarios: bs "Primer disparo de la torre", "Límite del alcance", "Cadencia de la torre", "Solo enemigos",
    "Las mejoras no afectan a la torre", "Baja por una flecha", "Reserva de las torres llena", "El jugador
    conserva su tope", "Con el tope del jugador lleno las torres disparan" y "Flechas congeladas en pausa"; sl "Las
    flechas después de las armas del jugador" y "Solares y flechas en el snapshot"; aw "Tope lleno con torres
    disparando".
  - Tests: `tests/domain/weapon/tower-battery.test.ts` y `tests/domain/run-towers.test.ts`.

## 5. Aplicación
- [ ] 5.1 Casos de uso `BuildOnSite` y `LeaveSite` (patrón `BuyFromShop`/`LeaveShop`). El bucle de paso fijo se
  comprueba en `building` como regresión.
  - Escenarios: sl "Frames en obra" y "Obra a mitad de frame"; bs "Construir una casa" y "Salir fuera de la obra"
    (a través de los casos de uso).
  - Tests: `tests/application/build-on-site.test.ts` y `tests/application/fixed-step-building.test.ts`.

## 6. Infraestructura y composición · contenido, azar y arte (test-after)
- [ ] 6.1 `content/buildings.json` con su esquema zod (reutiliza el esquema de arma) y su parser, y `siteColors` y
  `sites` en `appearance.json` con validación de color. Además, `SITE_STREAM = 7`, `seededRun` con `siteRandom`
  (solo `generated`) y `contentBoot`/`main` cableando los casos de uso.
  - Escenarios: bs "Contenido por defecto", "Valores inválidos", "Límites válidos" y "Campo ausente"; sr "Colores
    de los solares inválidos".
  - Tests: `tests/infrastructure/content/buildings-content.test.ts` y `tests/composition/seed-source.test.ts`
    (ampliado).
- [ ] 6.2 Hojas `House_Construction`, `House_Blue` y `Tower_Blue` copiadas byte a byte, con su entrada (sha256 y
  bytes) en `content/asset-provenance.json`. Hay que confirmar 128 × 192 y 128 × 256 en la cabecera IHDR.
  - Escenarios: ap "Hojas de caballeros registradas", "Hoja de caballeros sin entrada" y "Hojas de caballeros no
    usadas".
  - Ver la contradicción con ap sobre `Tower_Construction`, que está pendiente del orquestador.
  - Test: `tests/hooks/guard-assets.test.ts` (ampliado).

## 7. Infraestructura · render, panel y sonda (test-after)
- [ ] 7.1 `planMapArt.sites` (3 aspectos: obra común, casa y torre; baja/alta; `bounds` para `MapCuller`), `SiteArt`
  y `sprites.sites`.
  - Escenarios: sr "Solar en obra y casa construida" (sin navegador, con snapshots preparados), "Reserva de los
    edificios", "Presupuesto de objetos con solares" y "Pintar los solares no cambia la simulación".
  - Tests: `tests/infrastructure/phaser/plan-sites.test.ts` y `tests/infrastructure/phaser/site-art.test.ts`.
- [ ] 7.2 Segunda instancia de `ProjectileLayer` para `towerProjectiles`, y `sprites.towerArrows`.
  - Escenario: sr "Flechas coherentes con el snapshot".
  - Test: `tests/infrastructure/phaser/tower-arrows.test.ts`.
- [ ] 7.3 `BuildPanel` (DOM) y `BuildGate` en `GameScene` (orden Shop → Build → Pause). Sin input ni 1/2/3/R con el
  panel. `playScreen` añade `'build'`, y la sonda gana `__sprint.sites` y `map.sites` (`null` en el menú).
  - Escenarios: bs "Panel con una opción", "Panel con dos opciones", "Clic en la casa", "Salir con Esc o con el
    botón" y "Sin panel fuera de la obra"; mm "Esc en la obra"; sl "Step en obra".
  - Tests: `tests/infrastructure/dom/build-panel.test.ts` y `tests/infrastructure/phaser/build-gate.test.ts`.

## 8. Tests globales sin navegador · bots, balance e invariantes (test-after)
- [ ] 8.1 Política de obra fija en el harness (`chooseWhileOpen` sale de `building`) y bot v4 que sale sin
  construir.
  - Escenarios: bs "Línea base intacta con el bot v4" y "Quieto pierde con los solares"; sl "La política de obra
    fija no cambia la partida" y "Partida con edificios reproducible".
  - Tests: `tests/balance/*.test.ts` y `tests/domain/determinism-build.test.ts`.
- [ ] 8.2 Bot v5 (`builderBot`, `REFERENCE_BUILD_POLICY`: torre si es asequible y, si no, casa; ruta por
  `FlowField`) con un lote propio entre 25 y 35. Invariantes largos con edificios.
  - Escenarios: bs "Victorias del bot v5" y "Nada en la huella tras construir"; eb "Semillas del conjunto con
    edificios"; mv "Partida larga sin solapes con edificios".
  - Tests: `tests/balance/balance-builder.test.ts` y `tests/domain/invariants-build.test.ts`.
  - Si el lote se sale de la banda, se recalibra solo `tower`.
- [ ] 8.3 Bench informativo (no bloquea).
  - Escenarios: sl "Peor caso con 6 torres" y "Recalcular los campos al construir".
  - Test: `tests/bench/run-tick-buildings.bench.ts`. Las medias se anotan para el verify-report.

## 9. E2E y documentación
- [ ] 9.1 E2E nuevo (1) en `gameplay.spec.ts`, manual, mapa real, semilla 42, con la ruta calculada por BFS sobre la
  sonda: madera ≥ 15, acceso, clic en la casa y `step(1)`. Se amplía el test de humo del menú con `sites: null`.
  - Escenarios: bs "Construir una casa en el juego real [E2E]" y "Sonda de solares en el menú"; parte E2E de sr
    "Solar en obra y casa construida".
  - Tipos de la sonda en `tests/e2e/probe.ts`.
- [ ] 9.2 Documentación: estado del proyecto en AGENTS.md (0026), ADR-0025 a `aceptada`, ADR-0013/0017/0020 con una
  nota que apunte a ADR-0025, GDD 0026 hecho y diario de IA.
