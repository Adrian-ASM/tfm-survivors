# Tasks · 0004-auto-weapons

<!-- Cada tarea ≤ ~30 min, con test asociado y referencia al escenario. Orden: dominio → aplicación →
     infraestructura → composición → E2E → docs. El implementer marca [x] y hace un commit por tarea.
     Specs: AW = auto-weapons, SL = simulation-loop, RS = run-state, ES = enemy-spawning, EB = enemy-behavior,
     PH = player-health. Design: openspec/changes/0004-auto-weapons/design.md. ADR-0007. -->

## 1. Dominio: contenido de armas (camino frío)
- [x] 1.1 `domain/weapon/WeaponType.ts`: tipos `TargetingConfig`, `AttackConfig`, `WeaponTypeConfig`, constantes de
  mensaje y `WeaponType.create(config, path)` con enteros ≥ 1 (`cooldownTicks`, `damage`, `lifetimeTicks`,
  `visualTicks`) y finitos > 0 (`range`, `radius`, `speed`, radio del proyectil); test en
  `tests/domain/weapon-type.test.ts` — escenarios AW "Valores no positivos", "Valores no enteros",
  "Daño mayor que la vida de un enemigo".
- [x] 1.2 `ATTACK_TARGETING` (tipo mapeado) y regla `WEAPON_TARGETING_INCOMPATIBLE` en `WeaponType.create`, más
  `assertNever` en `domain/shared` — AW "Combinación incompatible".
- [x] 1.3 `domain/weapon/WeaponLoadout.ts`: armas en orden, ids únicos (`WEAPON_ID_MUST_BE_UNIQUE`),
  `maxProjectiles` y `hitFlashTicks` enteros ≥ 1, lista vacía aceptada, `pulseCapacity` (Σ ⌈visual / cooldown⌉) —
  AW "Identificadores duplicados o lista vacía" (parte de duplicados), AW "Armas equipadas al inicio" (sin armas
  válida en el dominio).
- [x] 1.4 `RunConfig.weapons` + `RunRules.loadout` en `buildRunRules`; builders de test: `NO_WEAPONS` por defecto en
  `aRunConfig`/`aContactConfig`, `DEFAULT_WEAPONS`, `withWeapons`; `RawContent`/`rawContent()` con
  `DEFAULT_WEAPONS`. Para que compile, añadir ya `weapons` a `parseRunConfig` y `content/weapons.json` (ver 5.1,
  adelantada como en 0003) — `run-config.test.ts`: errores con ruta `weapons.weapons.i.…`. Todos los tests de
  0001–0003 en verde sin cambios de expectativas.

## 2. Dominio: piezas de las armas (puras y aisladas)
- [x] 2.1 `Enemy.takeDamage(amount, tick)` con `lastHitTick`, `damagedAt(k, flashTicks)` y vida inicial opcional en
  `Enemy.spawn`; test en `enemy.test.ts` — ES "Daño que no mata", "Daño exactamente igual a la vida", "Daño mayor
  que la vida", "Daño a un enemigo ya dado de baja"; AW "Duración del destello", "Destello renovado".
- [x] 2.2 `domain/weapon/WeaponTarget.ts` + `targeting.ts`: `nearestInRange` (d² ≤ range², empate al primero,
  ignora muertos) y `firstInRadius` (`circlesOverlap` estricto) con `selectTarget`; test
  `tests/domain/targeting.test.ts` con dobles — AW "Elige el más cercano", "Ignora los que están fuera de alcance",
  "Límite exacto del alcance", "Empate por orden de aparición", "Límite exacto del pulso".
- [x] 2.3 `domain/weapon/Weapon.ts`: `readyAt` inicial 0, `isChargedAt(n)`, `fireAt(n)`, `readyIn(k)`; test unitario
  de la cronología — AW "La retención reinicia la cadencia" (a nivel de entidad), SL "Carga de las armas en el
  snapshot" (convención `k ≥ readyAt`).
- [x] 2.4 `domain/weapon/Projectile.ts` (`launch`, `advance`, `spent`, velocidad por tick, d = 0 → (1, 0)) y
  `PulseEcho.ts`; test unitario de posiciones — AW "Agota su vida sin impactar" (posición 952 en T + 59).

## 3. Dominio: `Arsenal` (paso de armas del tick)
- [x] 3.1 `Arsenal` con pools preasignados (`maxProjectiles` proyectiles, `pulseCapacity` ecos), ids de proyectil y
  sub-paso 3b-3c (avance, impacto en el primer vivo de la lista, caducidad, compactación estable); test
  `tests/domain/arsenal.test.ts` — AW "Impacto en vuelo", "Agota su vida sin impactar", "Solo daña a un enemigo",
  "Varios proyectiles sobre el mismo bug en un tick", "El objetivo muere antes del impacto"; SL "Proyectiles en el
  snapshot" (orden).
- [x] 3.2 Sub-paso 3d: disparo en el orden del loadout, retención sin objetivo, ataque `projectile` (no se mueve ni
  colisiona al crearse) y tope con plazas liberadas en el mismo tick — AW "Tope lleno", "Retención sin objetivo en
  alcance", "Sin enemigos, sin disparos".
- [ ] 3.3 Ataque `pulse` (daño a todos los vivos solapados) y ecos visibles de T a T + `visualTicks` − 1 (sub-paso
  3a); `step` devuelve el número de bajas — AW "Tres dentro y uno fuera", "Sin enemigos en el radio, sin pulso",
  "Duración del pulso".
- [ ] 3.4 Test de ausencia de asignaciones en régimen (los objetos del pool son los mismos por identidad tras 600
  ticks de disparos) — design "Proyectiles: pool y bajas" (ADR-0003).

## 4. Dominio: integración en `Run`
- [ ] 4.1 `RunSetup.enemies[i].health` (finito, 0 < h ≤ `type.health`, `SETUP_HEALTH_OUT_OF_RANGE`) — AW
  "Armas equipadas al inicio" (vida inicial fijada al preparar), ES "Vida inicial del tipo".
- [ ] 4.2 `Run.tick` con el nuevo orden (armas tras la persecución, `removeDead()` una vez si hay bajas, contacto
  solo con vivos, director después); `run.test.ts` / `run-weapons.test.ts` — SL "Las armas apuntan tras la
  persecución", "Un enemigo recién aparecido no es objetivo en su tick de aparición", "Una baja libera el hueco
  antes del director"; AW "Disparo en el tick 1", "Cadencia con objetivo permanente", "La baja impide el contacto
  en ese tick", "Reposición en el mismo tick".
- [ ] 4.3 Snapshot ampliado: `projectiles`, `pulses` (`weapon`, `firedAt`, centro, radio), `weapons` (`id`, `ready`),
  `EnemySnapshot.damaged`; todo congelado — SL "Partida recién creada", "Carga de las armas en el snapshot",
  "Pulso identificado en el snapshot", "Snapshot no mutable desde fuera"; AW "Armas equipadas en una partida nueva".
- [ ] 4.4 Daño acumulado con las armas por defecto sobre `RunSetup` — AW "Ningún arma mata a un bug de un impacto",
  "Linter mata a un bug en 2 impactos", "Tests mata a un bug en 3 pulsos", "Combinación de armas", "Enemigos más
  resistentes"; EB "Misma trayectoria con y sin daño", "El impacto no empuja".
- [ ] 4.5 Eliminar `Run.damageEnemy` y `EnemyDamageOutcome`; reescribir `run-removal.test.ts` con
  `RunSetup.health` + arma de pulso de prueba (vida 1 en las víctimas) — SL "Bajas sin reordenar", "Reposición al
  final de la lista", "Baja del primero y del último"; ES "Identificador no reutilizado", "Golpear al jugador no
  quita vida al enemigo" (sin armas).
- [ ] 4.6 Partida terminada con armas: `run-state.test.ts` — RS "600 ticks después de terminar", "Armas congeladas al
  terminar", "La terminación no consume azar"; retirar el test de "Una partida sin defensa termina" (requisito
  REMOVED) o reconvertirlo con `NO_WEAPONS`.
- [ ] 4.7 **Medición temprana (gate de equilibrio)**: test del núcleo con el contenido por defecto, semilla 42 e
  input (0, 0) que registra el tick del primer golpe (y, con semilla 7, que hay ≥ 1 proyectil, ≥ 1 pulso y ≥ 1 baja
  en 600 ticks). Anotar los ticks medidos en el diario del change. Si el primer golpe no llega en ≤ 3.600 ticks,
  **parar y avisar al orquestador** (hallazgo de equilibrio → spec), sin relajar el test — PH "Primer golpe en el
  núcleo con armas activas"; AW "Jugador quieto con el contenido por defecto".
- [ ] 4.8 Migración y revisión de 0001–0003: `determinism.test.ts` gana el caso con armas; `long-run.test.ts` y
  `run-spawning.test.ts` siguen con `NO_WEAPONS` donde prueban el spawn; repasar cada escenario largo contra el
  contenido por defecto (lección 0003) — SL "Dos partidas idénticas", "Partida con contactos reproducible",
  "Partida con armas reproducible", "Partida larga reproducible", "Enemigos en el snapshot" (sin armas).

## 5. Infraestructura: contenido
- [ ] 5.1 `content/weapons.json` con los valores de la spec y `WeaponsSchema` (`discriminatedUnion` por `mode` y
  por `type`, `strictObject`, `weapons.min(1)` con `WEAPONS_REQUIRED`, id no vacío); `loadRunConfig` lo importa —
  `content.test.ts`: AW "Contenido por defecto", "Daños base distintos y menores que la vida del bug",
  "Identificadores duplicados o lista vacía", "Campos o variantes desconocidos", "Valores no positivos", "Valores no
  enteros", "Combinación incompatible" (errores que nombran el campo).

## 6. Infraestructura: render
- [ ] 6.1 Extraer `phaser/SlotPool.ts` (tres pasadas, `Map` id ↔ hueco, pila libre) y hacer que `EnemyLayer` lo use;
  `enemy-layer.test.ts` intacto y en verde — SL "Pintado de los enemigos vivos" (bajas, todos dados de baja,
  reposición).
- [ ] 6.2 Destello en `EnemyLayer` (`FLASH_COLOR`, repintar solo si cambia tipo o `damaged`); test con dobles —
  AW "Indicación visual de daño, proyectiles y pulsos" (destello).
- [ ] 6.3 `ProjectileLayer` sobre `SlotPool` con capacidad `maxProjectiles`; test con dobles, sin sprites nuevos
  tras crear — AW "Sprites de proyectiles".
- [ ] 6.4 `PulseLayer` (anillos por índice, capacidad `pulseCapacity`) y función pura `pulseAlpha`; test en Node —
  AW "Duración del pulso" (pintado), "Indicación visual…" (un anillo por pulso).
- [ ] 6.5 `GameScene` con `SceneCapacity { enemies, projectiles, pulses }`, orden de capas (anillos, enemigos,
  proyectiles, jugador) y `sync` de las tres capas — cubierto por E2E 8.1.

## 7. Composición
- [ ] 7.1 `main.ts` calcula `SceneCapacity` desde el `RunConfig` validado (`maxAlive`, `maxProjectiles`,
  `pulseCapacity`); `npm run build` en verde — AW "Comprobación en el navegador" (cableado).

## 8. E2E, bench y documentación
- [ ] 8.1 E2E `tests/e2e/weapons.spec.ts`: `?e2e&seed=7`, sin input, en ≤ 15 s se observa ≥ 1 proyectil en el
  snapshot y ≥ 1 baja (id visto que desaparece con la partida en curso), sin errores — AW "Comprobación en el
  navegador".
- [ ] 8.2 Sustituir el E2E de 0003 "vida baja en ≤ 20 s" por `?e2e&seed=42` con plazo 60 s, vida < máxima y > 0,
  partida en curso, armas `linter` y `tests` en el snapshot. Si no se cumple, hallazgo de equilibrio (como 4.7) —
  PH "Primer golpe en el navegador".
- [ ] 8.3 Bench: casos de 0003 con el contenido por defecto (armas incluidas) y caso nuevo de peor caso (200 enemigos
  lentos con vida 1e9 en el perímetro, `BENCH_HEALTH`, proyectil de bench con `cooldownTicks` 1 y alcance mayor que
  la diagonal, pulso de bench que cubre la arena; comprobar 32 proyectiles vivos y partida en curso) — SL "Tope de
  vivos alcanzado", "200 enemigos encima del jugador", "Peor caso con proyectiles".
- [ ] 8.4 Documentación: JSDoc de `Run` (orden del tick) y de `contact.ts` (rejilla aplazada); anotar en
  `verify-report`/diario los datos del bench y de 4.7; cualquier desviación del apply en `design.md`
  (lección S1/S2 de 0003). La sección "Aplicación (0004)" de ADR-0003/0006 se añade al archivar.
