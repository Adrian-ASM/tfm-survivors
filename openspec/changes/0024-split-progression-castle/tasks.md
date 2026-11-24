# Tasks · 0024-split-progression-castle

<!-- ADR-0018: TDD estricto (rojo comprobado) en domain/application; test-after en infraestructura, composición y
     contenido. Por tarea: `npm.cmd run verify:fast`. Por grupo: `npm.cmd run verify` en verde, commit
     (Conventional Commits, `refs: 0024-split-progression-castle`, `Assisted-by`) y después `git fetch` + rebase sobre
     `origin/main` si ha avanzado (repetir `verify` tras el rebase). No se cierra un grupo en rojo.
     Los escenarios se citan como "capacidad · escenario". "Valores de escenario" = los que da el escenario, no el
     contenido. Convención de oro por baja (design §14): `aRunConfig` lleva `goldPerKill` 0 en todos los tipos y los
     escenarios que lo necesitan usan `withGoldPerKill({...})`; con `aDefaultConfig`, los tests vivos que cuentan u
     ordenan recogibles de bajas pasan a `withGoldPerKill({})`.
     Balance entre los grupos 1 y 5: al sacar las mejoras de arma de la oferta, el bot v3 deja de estar en la banda
     (cota inferior 0/50). En 1.1 los tests del lote del bot que dependen de la banda o de la base de 0022/0023
     ("Tasa de victoria…", "Victorias sin ovejas", "Mechas por partida" y "… intactas sin ovejas") se aparcan en un
     `describe.skip` con el comentario `0024: se reactiva en 5.3`; los del quieto, los plazos y "Bot reproducible"
     siguen activos. 5.3 los reactiva o los sustituye y el verify comprueba que no queda ningún `skip`. -->

## 0. Medición previa (M0, sin tocar código)
- [x] 0.1 M0 en esta máquina (design §9): bench (`npm.cmd run bench`, caso "tres topes llenos"); tiempo de pared del
  lote del bot dos veces (`vitest run tests/domain/balance.test.ts`); tick de muerte máximo del quieto sobre 1..50
  con el mapa generado y con el vacío; **bajas medias por tipo** del bot v3 sobre 1..50; sha256 canónico de
  `content/upgrades.json`, `resources.json`, `player.json`, `progression.json`, `waves.json`, `enemies.json` y
  `weapons.json` de `main` (los tres últimos deben seguir iguales al final). Anotar las cifras aquí debajo; entran en
  el commit del grupo 1.
  **M0 (2026-11-24, código de b1fac67)**: bench "tres topes llenos" media 0,286 ms (p99 0,465 ms). Fichero
  `balance.test.ts` completo (dos lotes del bot + quietos): 62,3 s y 63,4 s de Vitest (64 s de pared las dos veces);
  un lote del bot v3 con ovejas y una lectura extra por tick, 36,3 s. Quieto: muerte máxima en el tick **6.802**
  (generado) y **7.948** (vacío). Bajas medias por partida del bot v3: `goblin-torch` 301,5, `goblin-barrel` 227,1,
  `goblin-tnt` 130,7, `goblin-tnt-guard` 5,0 (664 en total). sha256 canónico (claves ordenadas): `upgrades`
  `ad0bfdca…0751`, `resources` `d7c2a151…4744`, `player` `625622ed…88f0`, `progression` `3017d257…2474`, `waves`
  `ad7b9a6c…ecc7`, `enemies` `5ab43172…c07c`, `weapons` `4aa8c55f…a0f9` (los tres últimos, iguales a
  `COMBAT_CONTENT_SHA256`).

## 1. Dominio · dos catálogos y progresión de personaje
- [x] 1.1 Dos catálogos con precios y oferta solo de personaje (TDD). `UpgradeType.source`/`prices`,
  `UpgradeCatalog.create({ character, weapons }, …)` con índices `character` → `weapons`, reglas de catálogo
  equivocado, id único entre listas, `prices` (longitud `maxLevel`, enteros ≥ 1, no decrecientes) y peor caso de los
  stats nuevos; `UpgradeBoard.open` solo sobre `levelIndices` y `raise(i)`; `toUpgradeLevels` en orden de catálogo;
  `content/upgrades.json` en el formato nuevo con los ids y textos de la tabla de la spec y los provisionales de
  design §2, y el zod mínimo para compilar (la validación completa se prueba en 4.1). Aparcar los tests del lote
  (cabecera). Escenarios:
  - upgrades · "Catálogos por defecto", "Mejoras de arma y de personaje sin cambios", "Id repetido entre catálogos",
    "Mejora en el catálogo equivocado", "Estadísticas nuevas en el contenido por defecto", "Peor caso fuera de rango"
    (salvo el de la carne, en 1.2), "Límite exacto de la invulnerabilidad", "Catálogo por defecto", "Ninguna adquirida
    al empezar", "Mejora en su nivel máximo", "Adquiridas de los dos catálogos", "Todas las mejoras pueden salir",
    "Una disponible", "Mejoras de arma fuera de la oferta", "Elección válida", "Textos del catálogo por defecto", "Sin
    textos del tema anterior";
  - castle-shop · "Contenido por defecto" (precios), "Valores inválidos" y "Límites válidos" (solo los de precios).
  Tests: `tests/domain/upgrade-catalog.test.ts`, `upgrade-board.test.ts`, `upgrades-text.test.ts` (ampliar) y revisar
  `upgrades-rename-determinism.test.ts`, `builders.ts` y `policies.ts` (`config.upgrades.character`).
- [x] 1.2 Efectos de las estadísticas nuevas y curación por subida (TDD). `playerWith` con los 6 stats (base 0);
  `checkPlayer` y `player.regenIntervalTicks`; armadura en `applyHit` (`max(1, bruto − armadura)`); regeneración en
  7.3; `Experience.gain` con resto en centésimas; carne con `meatHealPercent` y su cota [1, 100] con `bestCase` en
  `buildRunRules`; `progression.levelUpHealPercent` y curación en `openNextOffer` (paso 10 y tras elegir). Escenarios:
  - player-health · "Regeneración por intervalo", "Tope en la vida máxima" (regeneración), "Sin mejora no regenera",
    "La regeneración no resucita", "Armadura sobre un contacto", "Armadura sobre el golpe único", "Daño mínimo 1", "La
    armadura no evita la derrota", "Invulnerabilidad mejorada", "Mejora durante la invulnerabilidad", "Carne con la
    mejora del cazador";
  - upgrades · "Peor caso fuera de rango" (carne 120 > 100 y `xpBonusPercent` 2,5), "Ninguna disponible", "La
    disponibilidad se recalcula entre ofertas encoladas", "Sin oferta abierta" (en curso y terminada);
  - leveling · "Bonificación con gemas de valor 1", "Bonificación acumulada", "Bonificación con gema grande", "Una
    subida sin mejoras", "Dos subidas en el mismo tick", "Tope y mínimo", "Sin azar";
  - simulation-loop · "Regeneración tras los recogibles".
  Tests: `tests/domain/run-armor.test.ts`, `run-regeneration.test.ts`, `experience-bonus.test.ts`,
  `run-levelup-heal.test.ts` y ampliar `run-meat.test.ts`.

## 2. Dominio · economía del oro
- [ ] 2.1 Oro por baja, más oro en estructuras, bonus y gasto (TDD). `drops.goldPerKill` completa en `ResourceRules`;
  suelta en `onDeath` tras gema y madera (no si `detonated`); `Stockpile.add` con resto propio y `spend`;
  `resources.json` con la tabla y casas/torres provisionales (design §2); `aRunConfig` con `goldPerKill` 0,
  `withGoldPerKill` y `withoutResourceSources` en `tests/support/`, y los tests vivos de recuento de drops pasados a la
  convención. Escenarios:
  - resources · "Oro de una baja por armas", "Orden con el barril abatido", "El barril que explota no suelta oro",
    "Baja por explosión ajena", "Tipo sin oro", "Tabla de oro por baja inválida" (dominio: falta/sobra tipo), "El
    oro por baja no consume azar", "Oro de estructuras por defecto", "Firmas intactas", "Bonificación de oro", "Resto
    arrastrado del oro", "Mismo combate con y sin recursos";
  - simulation-loop · "Oro de la baja tras su gema en el paso de armas".
  Tests: `tests/domain/run-gold-drops.test.ts`, `stockpile.test.ts`, ampliar `run-resources.test.ts` y
  `map-golden.test.ts` (sin cambiar las firmas).

## 3. Dominio y aplicación · tienda
- [ ] 3.1 Puerta, re-armado y fase en tienda (TDD). `door` en `TerrainSource` `open`/`cells` con validación
  `map.door`, `GameMap.door`/`MapSnapshot.door`; `ShopRules` + `content/shop.json` provisional con zod mínimo;
  `CastleGate` y paso 11; `SHOPPING` en `RunPhase`; `RunSetup.shop.armed`; `snapshot.shop` en todo estado con caché
  por clave. Escenarios:
  - castle-shop · "No se abre al nacer", "Volver sin alejarse lo suficiente", "Volver tras alejarse", "Tangencia con
    el radio no abre", "Oferta y tienda en el mismo tick", "Sin tienda en el tick de la victoria", "Mapa sin puerta",
    "Productos al empezar", "Producto en su nivel máximo";
  - procedural-map · "Puerta en el mapa generado", "Sin puerta en el mapa vacío", "Puerta declarada en un mapa
    explícito";
  - run-state · "600 ticks en la tienda", "La tienda no consume azar", "Peligros e invulnerabilidad en pausa durante la
    tienda", "Tienda abierta justo antes del tick de la victoria";
  - simulation-loop · "Partida recién creada", "Oferta en el snapshot", "La tienda se abre tras el director".
  Tests: `tests/domain/castle-gate.test.ts`, `run-shop-door.test.ts`, `run-shop-frozen.test.ts`, ampliar
  `map-door.test.ts` y `run-snapshot.test.ts`.
- [ ] 3.2 Comprar y salir, en `Run` y en los casos de uso (TDD). `Run.buy(id)` y `Run.leaveShop()` con `ShopError`;
  `BuyFromShop`, `LeaveShop` y `StartedRun`; política de tienda fija en `tests/support/` (salir sin comprar). Escenarios:
  - castle-shop · "Compra de una mejora de arma", "Varias compras en una visita", "Oro exacto", "Compras rechazadas",
    "Compra fuera de la tienda", "Comprar no consume azar", "Salir y seguir", "Salir fuera de la tienda", "Visita sin
    compras";
  - player-health · "Curación de pago completa", "Curación recortada por el tope", "Vida llena", "La curación de pago
    no cambia la invulnerabilidad";
  - resources · "El oro solo baja al comprar";
  - upgrades · "Cadencia mejorada sin reiniciar la carga", "Cadencia de Tests mejorada", "Sin oferta abierta" (en
    tienda);
  - run-state · "En tienda y vuelta a en curso";
  - simulation-loop · "Tienda en el snapshot", "Compras distintas divergen", "Partida con tienda y compras
    reproducible", "La política de tienda fija no cambia la partida", "Frames en la tienda", "Tienda a mitad de frame".
  Apply (1.1): al sacar las mejoras de arma de la oferta se retiraron de `run-choosing` y `run-upgrades` "Cadencia
  mejorada sin reiniciar la carga", "Proyectil en vuelo durante una mejora de daño" y "Pulso visible durante una
  mejora de radio" (necesitan comprar a mitad de partida); vuelven aquí con la compra en la tienda.
  Tests: `tests/domain/run-shop-buy.test.ts`, `tests/application/shop-use-cases.test.ts`, ampliar
  `tests/application/tick-run.test.ts` y `tests/domain/determinism.test.ts`.

## 4. Infraestructura y composición (test-after)
- [ ] 4.1 Contenido validado con zod. `UpgradesSchema` (dos listas, `prices` solo en `weapons`), `ProgressionSchema`
  (`levelUpHealPercent`), `PlayerSchema` (`regenIntervalTicks`), `ResourcesSchema` (`goldPerKill`), `ShopSchema` y
  `RawContentFiles.shop`; mensajes que nombran campo, tipo o mejora. Escenarios:
  - castle-shop · "Contenido por defecto", "Valores inválidos", "Límites válidos" (todos los casos);
  - resources · "Tabla de oro por baja inválida" (vía `parseContent`); leveling · "Valores inválidos"; player-health ·
    intervalo de regeneración inválido (requisito "Regeneración de vida").
  Tests: `tests/infrastructure/shop-content.test.ts`, ampliar `progression-content.test.ts`,
  `resources-content.test.ts` y `builders-content.test.ts`.
- [ ] 4.2 Overlay de la tienda, Esc y sonda. `dom/ShopPanel.ts` (jsdom), `phaser/ShopGate.ts` (Node, sin motor),
  cableado en `GameScene` (antes de `PauseGate`; 1–3 y R descartadas), `Screen` `'shop'`, `menuText`, CSS con
  `--ui-scale`, `main.ts` con `ShopPanel` y sonda `window.__sprint.shop`. Escenarios:
  - castle-shop · "Overlay con oro justo", "Clic en un producto", "Clic sin oro", "Salir con Esc o con el botón", "Sin
    overlay fuera de la tienda";
  - main-menu · "Esc en la tienda"; hud · "HUD en la tienda";
  - simulation-loop · "Tienda a mitad de step" (stepper con una partida falsa).
  Tests: `tests/infrastructure/shop-panel.test.ts`, `shop-gate.test.ts`, ampliar `pause-gate.test.ts`,
  `manual-stepper.test.ts` y `hud.test.ts`.

## 5. Bot v4 y calibración del balance
- [ ] 5.1 Bot de referencia v4 (test-after, helper de test). `ReferenceBot.shop`, ir a la tienda con un `FlowField`
  del bot hacia la celda de la puerta, compra (curación bajo el umbral, luego orden de compra) y constantes
  `REFERENCE_UPGRADE_PRIORITY`, `REFERENCE_SHOP_ORDER`, `REFERENCE_HEAL_THRESHOLD`, `SHOP_DANGER_RANGE` (design §8);
  `balanceMeasure` con compras/salida y traza de economía (oro por fuente, gastado, visitas, compras, ticks de la
  1.ª/5.ª/10.ª compra, curaciones por subida). Escenarios:
  - run-outcome · "Elige por prioridad de personaje, no por posición", "Ningún id priorizado en la oferta", "Va a la
    tienda con oro y sin peligro", "Sin oro suficiente no va", "El peligro gana a la tienda", "Orden de compra",
    "Compra hasta agotar el oro"; los vivos de esquiva y huida siguen verdes.
  Tests: `tests/support/policies.test.ts` (ampliar) o `tests/domain/reference-bot.test.ts`.
- [ ] 5.2 M1 y calibración (contenido, test-after). Lote del bot v4 sobre 1..50 con métricas informativas (design §9):
  victorias, oro ganado por fuente y gastado, visitas, compras, niveles de arma por partida ganada, mechas, curaciones
  y tiempo del lote en local (×2,8 para CI); tick de muerte máximo del quieto con ambos mapas, plazos del quieto y
  primera oferta de la semilla 7. Iterar **solo** las palancas de design §9 en su orden, anotando cada iteración aquí
  debajo. Criterio: 25–35/50, 0 quietos con ambos mapas, margen del quieto ≥ ~1.000 ticks, lote ≤ 45 s local
  (≤ 81 s ×2,8). Si no se alcanza, **parar y consultar al autor** (spec run-outcome). Todo valor que una spec fije y
  cambie se actualiza en su spec delta.
- [ ] 5.3 M2: congelar y reactivar. `balanceBaseline.ts` nuevo (filas `[semilla, resultado, tick, bajas]` del bot v4
  con el contenido final, media de mechas, huellas: `waves`, `enemies`, `weapons` iguales a M0 y las nuevas de
  `upgrades` con precios, `player`, `resources`, `progression`, `shop`); retirar el lote "sin ovejas" y el
  `describe.skip` de 1.1; `BOT_BATCH_TIMEOUT_MS` sin cambios. Escenarios:
  - castle-shop · "Victorias del bot v4", "Línea base nueva congelada" (incl. precio cambiado en 1), "Quieto pierde con
    la tienda";
  - run-outcome · "Tasa de victoria del bot de referencia", "Presupuesto de oleadas y stats intactos", "Toda partida
    del bot termina", "Bot reproducible", los del quieto y "Barril que cumple su papel" (mechas > 16,3).
  Tests: `tests/domain/balance.test.ts`, `tests/support/balanceBaseline.ts`.

## 6. E2E y documentación
- [ ] 6.1 E2E "Abrir, intentar comprar y salir" (castle-shop), ampliando un test de `gameplay.spec` con el recorrido
  determinista de design §7 (`seed=42`, `map: 'real'`, manual, `step(5)` hasta armada y hasta en tienda, precondición
  oro 0 comprobada, clic sin compra, Esc sin pausa, `step(1)` = 1). Un solo E2E nuevo; `npm.cmd run test:e2e` verde.
- [ ] 6.2 Documentación. Cifras finales de M1/M2 y parámetros del bot en design §8–§9 (desviaciones del apply en el
  mismo commit); ADR-0023 a "aceptada"; AGENTS.md §1 (estado 0024); entrada en `docs/ai-log/` (incluye el aparcado
  temporal del lote y cualquier bloqueo de hooks).
