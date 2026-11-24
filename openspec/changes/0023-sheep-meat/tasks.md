# Tasks · 0023-sheep-meat

<!-- ADR-0018: TDD estricto (rojo comprobado) en domain/application; test-after en infraestructura, composición y
     contenido. Por tarea: `npm.cmd run verify:fast`. Por grupo: `npm.cmd run verify` en verde, commit
     (Conventional Commits, `refs: 0023-sheep-meat`, `Assisted-by`) y después `git fetch` + rebase sobre
     `origin/main` si ha avanzado (repetir `verify` tras el rebase). No se cierra un grupo en rojo.
     "Oveja de prueba" = la de la spec `sheep` (radio 20, vida 12, paseo 60 px/s × 60 ticks, huida 180 px/s y radio 200,
     pasto 120 ticks y radio 300, reaparición 600 ticks a ≥ 500 px): `TEST_SHEEP` en `tests/support/builders.ts`.
     Los escenarios se citan como "capacidad · escenario". -->

## 0. Medición previa (M0, sin tocar código)
- [x] 0.1 M0 en la misma máquina (design §12): `npm.cmd run bench` (caso "tres topes llenos"); tiempo de pared del
  lote del bot dos veces (`vitest run tests/domain/balance.test.ts`); duración de los dos tests del quieto y tick de
  muerte máximo del quieto sobre 1..50 (mapa generado y vacío); sha256 canónico de `content/resources.json` de `main`
  para la huella de combate. Anotar cifras aquí debajo; entran en el commit del grupo 1.
  - **M0 (2026-11-24, código de `a82b314`)**: bench "tres topes llenos" 0,263 ms/tick (p99 0,309) y "Peor caso con
    gemas" 0,190 ms; `balance.test.ts` completo 31,6 s y 31,3 s (pared 32 y 33 s); quieto con mapa generado 2,06 /
    2,03 s y con mapa vacío 0,51 / 0,53 s; tick de muerte máximo del quieto 6.802 (generado) y 7.948 (vacío), margen
    hasta 10.800; sha256 canónico de `resources.json` de `main`
    `c09e42573541d9b138d4a843eeea5f65717ecc70f203ecd9387c92716805787d`.

## 1. Dominio · carne y curación
- [x] 1.1 Recogible `meat` y curación (TDD). `'meat'` en `PickupKind`/`PICKUP_KINDS`, `maxMeat` y `capacity` = Σ 4
  topes, `PickupGain.meat`; `ResourceRules.meat` (`perSheep`, `healPercent`); `Health.heal` y `Player.heal` (no
  resucita, conserva invulnerabilidad); curación en 7.1 con `valor × max(1, ⌊% × máx / 100⌋)`; `RunSetup.player.health`
  (entero en [1, máx]). Contenido mínimo para compilar: `resources.json` `meat {1, 20}`, `progression.json`
  `maxMeat 8` y sus campos zod (la validación completa se prueba en 4.1). Escenarios:
  - player-health · "Curación del 20 %", "Tope en la vida máxima", "Relativa a la vida máxima efectiva", "Redondeo
    hacia abajo y mínimo 1", "Pieza acumulada por el tope", "Dos piezas en el mismo tick", "Golpe y curación en el
    mismo tick", "La carne no resucita", "Sin curación en el tick de la victoria", "La curación no cambia la
    invulnerabilidad";
  - xp-gems · "Mismo imán para la carne", "Carne fuera del radio", "La carne no consume azar", "Efecto según el tipo",
    "Carne con la vida llena", "Tope de XP lleno con otros tipos en el suelo", "Tipos del snapshot";
  - simulation-loop · "La curación no consume azar", "Recogibles de varios tipos en el snapshot".
  Tests: `tests/domain/health-heal.test.ts`, `run-meat.test.ts` y ampliar `run-pickups.test.ts`.
  - Apply: `'meat'` en `Record<PickupKind, …>` obliga a dar aspecto a la carne en infraestructura para compilar, así
    que la **mitad de la carne de 6.1/6.2** entra aquí: `M_Idle.png` copiado byte a byte con su entrada de
    procedencia (al final de la lista), `pickups.meat` en `appearance.json` y en el esquema (color tras la veta en
    la regla de colores distintos, para que "color de `meat` igual al de la veta" nombre la carne), `PickupLayer`
    y `renderCounts` con `meat`, y los escenarios de recogibles de 6.1/6.2 ("Datos del repositorio", "Datos
    inválidos", "Topes de los cuatro tipos pintados", "Sprite reutilizado para la carne", "Reserva de la carne",
    "Reserva de un tipo de recogible"). Los escenarios de pieza acumulada y tope de carne a nivel de campo están en
    `pickup-field.test.ts`.

## 2. Dominio · ovejas declaradas y movimiento
- [x] 2.1 Entidad, flota y ovejas declaradas (TDD). `Sheep`, `Flock`, `SheepRules`, `RunConfig.sheep`,
  `content/sheep.json` provisional (design §2) con su zod mínimo; `TerrainSource` `open`/`cells` con
  `sheep: { at, random }` y validación de posición legal (`map.sheep[i]`); `RunSetup.sheep[i]: { health?, origin? }`;
  `snapshot.sheep` con `origin`; helpers `TEST_SHEEP`, `withSheep` y `declaredSheep`. Escenarios:
  - procedural-map · "Mapa explícito con ovejas declaradas", "Oveja declarada ilegal", "Partida con mapa vacío";
  - simulation-loop · "Ovejas en el snapshot del motor" (tick 0), "Partida recién creada" (mapa vacío),
    "Snapshot no mutable desde fuera" (ovejas);
  - sheep · "Mapa vacío sin ovejas", "Ovejas solapadas", "El jugador atraviesa una oveja sin daño", "Un enemigo cruza
    una oveja", "El contacto de un enemigo no la daña".
  Tests: `tests/domain/sheep-flock.test.ts`, `run-sheep.test.ts`.
  - Apply: **sin el cruce `sheep.radius ≤ map.cellSize / 2`** de design §2. Rompía el escenario vivo "Celda en el
    límite del radio del jugador" (`procedural-map`: `cellSize` 32 carga con el contenido por defecto, y 16 < 18).
    El invariante se mantiene de otra forma: las celdas base de colocación y de reaparición (5.1 y 3.3) solo
    admiten centros que son posición legal del círculo de la oveja. `SheepSchema` (zod) ya entra aquí completo
    (lo exige `RunConfig.sheep` para compilar); sus escenarios se prueban en 4.1.
- [x] 2.2 Huida y deambular en el paso 1 (TDD). Máquina `graze`/`wander`/`flee` (design §5) con el barrido por ejes,
  `DIRS` de 8 unitarios y 1 valor del flujo por paseo aleatorio. Escenarios:
  - sheep · "Huida en línea recta", "Tangencia con el radio de huida", "Huida con la posición del jugador ya movido",
    "Jugador sobre la oveja", "Un enemigo no la espanta", "Huida contra un tronco", "El puente es caminable para la
    oveja", "Pasto y paseo de una oveja declarada", "Vuelta al origen fuera del radio de pasto", "Límite exacto del
    radio de pasto", "Una oveja que no huye no se aleja de su origen";
  - simulation-loop · "Ovejas en el snapshot del motor" (tick 1, `flee`).
  Tests: `tests/domain/sheep-movement.test.ts`.

## 3. Dominio · daño, carne y reaparición
- [x] 3.1 Armas por niveles (TDD). `Arsenal.step(n, px, py, enemies, reserves)` con `reserves = [structures.all,
  flock.all]`, `Projectile.tier` y pulso sobre los tres. Escenarios:
  - auto-weapons · "Oveja sin enemigos ni estructuras en alcance", "La estructura gana a la oveja aunque esté más
    lejos", "El enemigo gana a la oveja", "Límite del alcance con una oveja", "Empate entre ovejas", "Impacto en una
    oveja", "Un proyectil dirigido a un enemigo atraviesa una oveja", "Un proyectil dirigido a una oveja da antes a un
    enemigo", "Proyectiles entre estructuras y ovejas", "Pulso sobre una oveja sola", "Pulso disparado por un enemigo
    que alcanza a una oveja", "Una ruina no es objetivo" y "Pulso sobre una ruina" (sin ovejas);
  - simulation-loop · "Las armas apuntan tras la huida de las ovejas", "Carga de las armas en el snapshot".
  Regresión: los tests de `auto-weapons` de 0021 siguen verdes sin cambios. Tests: ampliar `arsenal-*.test.ts` y
  `tests/domain/run-sheep-weapons.test.ts`.
  - Apply: `Arsenal.step(n, px, py, enemies, structures?, sheep?)` con los dos niveles de reserva como parámetros
    (un array fijo interno de 2 huecos, sin asignar) en vez de `reserves[]`: así las llamadas de 0021 con
    `[casa]` como quinto argumento siguen sin cambios. Escenarios en `tests/domain/arsenal-sheep.test.ts`.
- [x] 3.2 Muerte, carne y explosiones (TDD). `Flock.settle(onDeath)` en 3.5 y 4.2, `onSheepDeath` con
  `drop('meat', …)` y `HazardField.explode` sobre ovejas. Escenarios:
  - sheep · "Dos impactos del Linter", "Explosión que mata a una oveja", "Explosión tangente", "Armas y explosión en el
    mismo tick", "Daño mayor que la vida", "Bajas solo de enemigos", "Muerte sin reordenar" (lista o1, o3);
  - resources · "Carne en la posición de la oveja", "Orden con bajas y estructuras en el paso de armas", "Orden en el
    paso de peligros", "Carne recogida en su tick";
  - enemy-hazards · "Oveja alcanzada que sobrevive", "Barril que explota junto a una oveja y un goblin";
  - xp-gems · "Una secuencia de identificadores", "Tope de carne lleno";
  - simulation-loop · "Las ovejas mueren tras las estructuras".
  Tests: `tests/domain/run-sheep-death.test.ts`, ampliar `run-hazards.test.ts`.
  - Apply: los escenarios de peligros están en `run-sheep-death.test.ts`. "Barril que explota junto a una oveja y un
    goblin" usa la oveja con radio de huida 50 ("oveja quieta" de `auto-weapons`): a 69 px del jugador quieto la de
    prueba huiría y no estaría a 30 px del barril en el tick 82.
- [x] 3.3 Reaparición en 9.2 (TDD). Cola FIFO con celda de muerte, celdas base de reaparición (declarados: `grass`
  fuera de huellas y puertas), candidatas por celda distinta y `minPlayerDistance` en px, segunda pasada sin asignar.
  Escenarios:
  - sheep · "Reaparición tras el intervalo", "Dos muertes en el mismo tick", "Sin celda candidata", "Muerte en el tick
    de la victoria", "Muerte sin reordenar" (o4 al final);
  - simulation-loop · "La oveja reaparecida no se mueve ni es objetivo en su tick".
  Tests: `tests/domain/sheep-respawn.test.ts`.
  - Apply: `candidateCells` (5.1) se extrae ya aquí para las celdas base de reaparición en mapas declarados;
    `RESOURCE_GOLDEN` intacta. Las celdas base solo admiten centros legales para la oveja (ver 2.1).

## 4. Infraestructura · contenido validado (test-after)
- [x] 4.1 zod completo y cruces: `sheep.json` (rangos de design §2, `maxAlive` ≥ 0 sin máximo), `resources.meat`
  (`perSheep` ≥ 1, `healPercent` en [1, 100]), `progression.maxMeat` ≥ 1, cruce `sheep.radius ≤ cellSize / 2` en
  `buildRunRules`, carga de `sheep.json` en `contentBoot`/`loadRunConfig`. Escenarios:
  - sheep · "Contenido por defecto", "Valores fuera de rango", "Límites válidos", "Campos ausentes o desconocidos";
  - resources · "Contenido por defecto", "Valores fuera de rango", "Límites válidos", "Campos ausentes, desconocidos y
    tipo no admitido";
  - xp-gems · "Contenido por defecto", "Valores no positivos", "Tope de gemas no entero", "Campo desconocido o
    ausente", "Tope mínimo válido", "Tope de madera menor que los montones".
  Tests: ampliar `tests/infrastructure/content-*.test.ts` (o los ficheros de schema existentes).
  - Apply: escenarios en `content-schemas.test.ts` (recursos y gemas) y `content-sheep.test.ts` (nuevo). Sin el
    cruce `sheep.radius ≤ cellSize / 2` (ver 2.1). El escenario de recursos "tipo no admitido" pasa de `meat` a
    `potion` y el de campo desconocido de `meatPerSheep` a `meatPerHouse`, como en la spec.

## 5. Dominio · ovejas en el mapa generado y balance (gate M1)
- [ ] 5.1 Colocación inicial y primer pasto (TDD). `candidateCells` extraído de `placeResources` (`RESOURCE_GOLDEN`
  intacta), `placeSheep`, `resolveSheep`, fase 2 del flujo (primer pasto) y, en composición, `SHEEP_STREAM = 5` y
  `sheepRandom` en `seededRun` (3 líneas, necesarias para los tests sembrados); `SHEEP_GOLDEN` en `mapGolden.ts`.
  Escenarios:
  - procedural-map · "Reglas de colocación con las semillas del conjunto" (1..1.000, 0 y 4.294.967.295, con la
    distancia a la salida), "Contenido sin hueco suficiente", "Sin ovejas", "Celdas intactas con ovejas", "Misma
    semilla, mismas ovejas", "Semillas distintas, ovejas distintas", "Las ovejas no cambian celdas, estructuras ni
    recursos", "Firma de referencia de las ovejas", "Colocar ovejas no consume el azar de la partida";
  - sheep · "Ovejas al crear la partida", "Primer pasto de las ovejas colocadas", "Nunca más que el tope", "Ninguna
    oveja solapa el mapa", "Vuelta al tope con el contenido por defecto", "Partida con ovejas reproducible", "Las
    ovejas no consumen el azar de la partida", "Mismas oleadas con y sin ovejas";
  - simulation-loop · "Partida con ovejas y carne reproducible", "Partida recién creada" (mapa generado), "Dos
    partidas idénticas", "Partida larga reproducible";
  - resources · "Mismo combate con y sin recursos" (ovejas incluidas), "Los recursos no consumen azar" (azar de las
    ovejas);
  - xp-gems · "Ningún enemigo ni estructura suelta carne" (tope 0).
  Las propiedades que ya pasen en verde al escribirlas se quedan en esta tarea (no son tareas aparte). Tests:
  `tests/domain/sheep-placement.test.ts`, `determinism-sheep.test.ts`, `tests/support/map-golden.test.ts`.
- [ ] 5.2 Balance M1 y tests de balance (test-after sobre contenido). En `balance.test.ts`: el lote actual queda con
  ovejas (banda, mechas > 16,3, toda partida termina) y se añade un lote con `withoutSheep` (igualdad con
  `BALANCE_BASELINE`, 27, y 26,9 mechas), cada uno con su `beforeAll` y timeout de 180 s; quieto con ovejas y con
  tope 0 en el mapa generado, y el del mapa vacío una vez; huella de combate con `resources.json` sin `meat`
  (`COMBAT_CONTENT_SHA256.resources` de M0). Traza informativa: curación media del bot y del quieto, ovejas muertas
  por partida, tick de muerte máximo del quieto y tiempo de cada lote. Bench nuevo "cuatro topes llenos + ovejas en
  huida" en `tests/bench/run.bench.ts`. Escenarios:
  - sheep · "Victorias del bot con ovejas", "Quieto pierde con ovejas", "Contenido de combate intacto";
  - resources · "Victorias del bot de referencia sin ovejas", "Quieto pierde con todas las semillas sin ovejas",
    "Mechas por partida intactas sin ovejas";
  - simulation-loop · "Peor caso con los cuatro topes llenos" (informativo).
  **Gate**: si falla la banda o el quieto, ajustar **solo** contenido de ovejas y carne en el orden de design §12
  (quieto: `respawn.everyTicks` ↑ → `respawn.minPlayerDistance` ↑ → `meat.healPercent` ↓ → `maxAlive` 4 →
  `flee.radius` ↑; > 35: `healPercent` ↓ → `everyTicks` ↑ → `maxMeat` ↓ → `maxAlive` 4; < 25: `healPercent` ↑ ≤ 30 →
  `everyTicks` ↓ → `health` ↓), regenerar `SHEEP_GOLDEN` si cambian `maxAlive` o `placement`, y anotar cada paso aquí.
  Si no se cumple, **parar** y devolver la decisión al usuario. Si un test del quieto pasa de 10 s en local, timeout
  propio de 60 s. Revisar y anotar cualquier test existente cuyo valor exacto cambie por las ovejas (sin tocar
  expectativas que la spec no respalde). Anotar M1 aquí: victorias y delta semilla a semilla, tiempos de lote (local y
  ×2,8 frente a 90 s), bench frente a 0,27 / 0,25 ms.

## 6. Infraestructura · render, arte y sonda (test-after)
- [ ] 6.1 Arte, procedencia y aspectos. Copiar `HappySheep_Idle.png`, `HappySheep_Bouncing.png` y `M_Idle.png`
  (byte a byte, Update 010) a `public/assets/tiny-swords/...` con sus entradas en `content/asset-provenance.json`
  **en el mismo commit**. `appearanceSchema`: aspecto `sheep` con `idle` y `bounce`, **cada una con su `sheet`**
  (design §10: cambiar a `HappySheep_All` sería solo contenido) y color de reserva; `pickups.meat` con `M_Idle`;
  colores distintos. `looks.ts` con dos looks por oveja. Escenarios:
  - asset-provenance · "Hojas de ovejas y carne registradas", "Hoja de oveja sin entrada", "Hojas de ovejas y carne no
    usadas", "Hojas de recursos registradas", "Hoja de recursos sin entrada", "Hojas de recursos no usadas";
  - sprite-rendering · "Datos de la oveja inválidos", "Datos del repositorio", "Datos inválidos".
  Tests: `appearance-schema.test.ts` y `resource-provenance.test.ts` (dejan de prohibir `M_Idle`/`HappySheep`;
  prohíben `HappySheep_All`, `M_Spawn` y `NoShadow`), `npm.cmd run guard:all`.
- [ ] 6.2 `SheepLayer`, carne en `PickupLayer` y sonda. Pool por id de `capacity` sprites, `idle`/`bounce` con
  `setTexture` al cambiar de animación, volteo por Δx, destello, reserva conjunta; capa entre recogibles y
  jugador/enemigos; `PickupLayer` con Σ 4 topes; `renderCounts` con `sprites.sheep` (`visible`, `placeholder`,
  `byState`) y `sprites.pickups.meat`. Escenarios:
  - sprite-rendering · "Oveja en pasto y en huida", "Muertes y reapariciones", "Reserva de la oveja", "Indicación de
    daño en una oveja", "Pintar las ovejas no cambia la simulación", "Ovejas fuera del plan del mapa", "Reserva de un
    tipo de recogible", "Reserva de la carne", "Recuento coherente con el snapshot" (con fakes, sin navegador), "Totales
    del mapa con estructuras y vetas" (701/784), "Sonda en el menú";
  - xp-gems · "Topes de los cuatro tipos pintados", "Sprite reutilizado para la carne".
  Tests: `tests/infrastructure/sheep-layer.test.ts`, ampliar `pickup-layer.test.ts` y `render-counts.test.ts`.

## 7. E2E y documentación
- [ ] 7.1 E2E (ninguno nuevo): ampliar "Estructuras y guardias en el navegador" de `tests/e2e/gameplay.spec.ts`
  (`?e2e&manual&seed=42`, `step(n)`, sin umbrales de tiempo): en ambas lecturas, sprites de oveja iguales en número y
  por estado al snapshot (en la primera, el tope del contenido) y `meat` igual a los recogibles `meat`, sin reserva.
  Escenario: sprite-rendering · "Estructuras y guardias en el navegador". `npm.cmd run test:e2e -- gameplay.spec`;
  `logicGuard` sin cambios de recuento.
- [ ] 7.2 Documentación: `AGENTS.md` §1 (estado del proyecto con 0023: ovejas, carne, `SHEEP_STREAM` 5, banda M1),
  ADR-0022 a "aceptada" con el addendum de balance de 5.2, docblock de `Run` con el orden del tick y el consumo de
  azar, y entrada del diario de IA en `docs/ai-log/` (incluidos los bloqueos de hooks si los hubo).
