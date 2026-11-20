# Tasks · 0012-sprite-rendering

<!-- Cada tarea ≤ ~30 min, con test asociado y referencia al escenario. Orden: dominio → aplicación →
     infraestructura → composición → E2E → docs. El implementer marca [x] y hace un commit por tarea.
     Specs: SR = sprite-rendering, AW = auto-weapons, MM = main-menu, RR = run-results. -->

## 1. Dominio
- [ ] 1.1 `weapon` en el proyectil. Cambios: campo `weapon` en `Projectile`, `launch(..., weaponId)` desde
  `Arsenal.launch` con `weapon.type.id`, y `ProjectileSnapshot.weapon` en `toProjectileSnapshot`.
  - Rojo: los proyectiles no tienen `weapon`.
  - En el mismo test van dos tests de caracterización, que pueden nacer en verde porque protegen supuestos del
    design: el determinismo con `weapon` y que, dentro de una partida, los enemigos solo salen del snapshot al
    morir.
  - Ficheros: `src/domain/weapon/{Projectile,Arsenal}.ts`, `src/domain/run/{RunSnapshot,snapshotParts}.ts` y
    `tests/domain/run-weapons.test.ts`.
  - Escenarios: AW "Arma del proyectil en el snapshot", AW "Dos armas de proyectil", AW "El campo weapon no cambia
    la simulación" y SR "Salidas iguales a bajas" (semilla 42, grupos de 1 y 8 ticks).

## 2. Aplicación
<!-- Sin tareas: el change no toca `src/application`. -->

## 3. Infraestructura
### 3a. Manifiesto
- [ ] 3.1 Forma del manifiesto: `appearanceSchema.ts` (strictObject en todos los niveles, `idle` obligatorio,
  `death.loop` literal `false`) y `parseAppearance`, que devuelve `invalidConfig` con la ruta unida por `.`. Se añade
  `content/appearance.json` con `maxCorpses` 64 y 7 `placeholderColor` distintos, sacados de los colores actuales.
  - Ficheros: `src/infrastructure/content/{appearanceSchema,loadAppearance}.ts`, `content/appearance.json` y
    `tests/infrastructure/appearance-content.test.ts`.
  - Escenarios: SR "Manifiesto del repositorio", "Sin aspecto por defecto" y "Campos y estados desconocidos u
    obligatorios ausentes".
- [ ] 3.2 Rangos y formatos: enteros ≥ 1 en frames y `maxCorpses`; `scale` > 0; `origin` en [0, 1]; `fps` > 0;
  `frames` no vacío, de enteros ≥ 0; regex de `sheet` (sin `..`, sin `/` inicial, sin esquema, `.png`); `Hex` y
  `facing`. Se amplía el mismo test con una tabla de casos.
  - Escenarios: SR "Valores fuera de rango" y "Formatos no admitidos".
- [ ] 3.3 `checkAppearanceRefs(appearance, config)`: las claves de `enemies` deben ser ids de tipo, y las de
  `projectiles`, armas con ataque `projectile`. Es parte de `loadAppearance(config)`, no de `buildRunRules`.
  - Ficheros: `loadAppearance.ts` y `appearance-content.test.ts`.
  - Escenarios: SR "Enemigo inexistente", "Arma inexistente o que no es de proyectil" y "Tipo de enemigo sin
    entrada" (la parte de carga).

### 3b. Lógica pura de render (sin Phaser)
- [ ] 3.4 `animation.ts`:
  - `frameAt` (bucle o último frame) y `animDone`.
  - `AnimClock.advance(deltaMs, frozen)`.
  - `Motion.update(x, y, tick)`: umbral 0,001, sin cambios con el mismo tick, orientación según `facing` y
    `reset()`.
  - Ficheros: `src/infrastructure/phaser/art/animation.ts` y `tests/infrastructure/animation.test.ts`.
  - Escenarios: SR "Avance de la animación", "Umbral de movimiento", "Frames sin tick" (a nivel de `Motion`) y
    "Dibujo que mira a la izquierda" (a nivel de `Motion`).
- [ ] 3.5 `looks.ts`:
  - `sheetKey`, `sheetsToLoad(appearance, index)` (solo hojas presentes, sin duplicados).
  - `resolveLooks(appearance, frames)`: placeholder por aspecto si la hoja falta o algún frame se sale de ella;
    fallback a `default`; búsqueda por `weapon` y `gem`.
  - Ficheros: `src/infrastructure/phaser/art/looks.ts` y `tests/infrastructure/looks.test.ts`.
  - Escenarios: SR "Tipo de enemigo sin entrada" (aspecto), "Manifiesto mínimo", "Pack parcial" (unitario), "Frame
    fuera de la hoja" (ejemplo literal [0, 1, 2, 7] con 4 frames), "Proyectil por arma" y "Sin pack" (índice vacío
    → 0 hojas que cargar).
- [ ] 3.6 `artFiles.ts`: `indexArt(record)` puro (claves del glob → ruta relativa a `art/`) y el glob real
  `@art/**/*.png`. Se añaden el alias `@art` (`SPRINT_ART_DIR` o `art/`) y `assetsInlineLimit` que no inlina el arte
  en `vite.config.ts`; `/art/`, `/dist-art/` y `/tests/e2e/.fixture-art/` en `.gitignore`; y esas carpetas en los
  ignores de ESLint.
  - Tests: `indexArt` con registros falsos; el glob real devuelve `{}` sin `art/`; `git ls-files` no lista ningún
    `.png` bajo `art/`.
  - Ficheros: `src/infrastructure/phaser/art/artFiles.ts`, `vite.config.ts`, `.gitignore`, `eslint.config.*` y
    `tests/infrastructure/art-files.test.ts`.
  - Escenarios: SR "Repositorio sin PNG del pack" y "Sin pack" (no se pide ninguna hoja).
- [ ] 3.7 `SlotPool`: cambia a `hide(slot, cleared)`. La liberación sigue el orden del snapshot anterior, con un
  array preasignado, y `clear()` libera con `cleared = true`. Es el primer test propio de `SlotPool`.
  - Ficheros: `src/infrastructure/phaser/SlotPool.ts` y `tests/infrastructure/slot-pool.test.ts`.
  - Escenarios: SR "Tope de cadáveres" (orden e1…e7, a nivel de pool) y "Salida sin baja" (`cleared`).

### 3c. Capas sobre `SpriteLike`
- [ ] 3.8 `SpriteLike`, `SpriteKit` y `applyLook(sprite, look, radius)`:
  - Con arte: textura y frame, `scale` y `origin`.
  - Con placeholder: disco, `2r / 64`, `placeholderColor`, sin flip y con rotación 0.
  - También el doble `FakeSprite`, que guarda el estado final.
  - Ficheros: `src/infrastructure/phaser/SpriteLike.ts`, `tests/infrastructure/doubles/FakeSprite.ts` y
    `tests/infrastructure/apply-look.test.ts`.
  - Escenarios: SR "Tamaño del placeholder", "Escala independiente de la hitbox" y "Cambio de pack solo con
    datos".
- [ ] 3.9 `GemLayer` y `ProjectileLayer` sobre `SpriteLike` + `LookBook`. El proyectil usa el aspecto de su
  `weapon` y rota con `atan2` del Δ (0 o π en el primer frame); la gema reproduce `idle` sin flip. Se reescriben sus
  tests.
  - Ficheros: `src/infrastructure/phaser/{GemLayer,ProjectileLayer}.ts` y
    `tests/infrastructure/{gem,projectile}-layer.test.ts`.
  - Escenarios: SR "Gema", "Rotación del proyectil" y "Proyectil por arma"; AW "Sprites de proyectiles" y "Aspecto
    del proyectil por arma".
- [ ] 3.10 `EnemyLayer` sobre `SpriteLike`:
  - `idle`/`walk` por `Motion` y flip según `facing`.
  - Destello `FILL` y vuelta a `tint` o `placeholderColor` con `MULTIPLY`, sin detener la animación.
  - Reinicio del estado al aparecer en un hueco.
  - Se borran `enemyPalette.ts` y `CircleSprite`, y se reescribe su test.
  - Ficheros: `src/infrastructure/phaser/EnemyLayer.ts` y `tests/infrastructure/enemy-layer.test.ts`.
  - Escenarios: SR "Aspecto sin walk", "Hueco reutilizado", "Dibujo que mira a la izquierda" y "Tipo de enemigo sin
    entrada" (pintado); AW "Indicación de daño fiel al snapshot" e "Indicación de daño con placeholder".
- [ ] 3.11 `CorpseLayer` (pool de `maxCorpses`; `spawn` → `false` con el tope lleno; caducidad por `animDone`;
  `clear`) e integración en `EnemyLayer` (baja → `spawn` con la última posición y orientación; `clear` sin
  cadáveres).
  - Ficheros: `src/infrastructure/phaser/{CorpseLayer,EnemyLayer}.ts` y `tests/infrastructure/corpse-layer.test.ts`.
  - Escenarios: SR "Muerte y desaparición", "Pulso que mata a varios en el mismo tick", "Tope de cadáveres", "Tope
    pequeño", "Aspecto sin death", "Muerte con placeholder", "Fin de la partida" y "Salida sin baja".
- [ ] 3.12 `PlayerView`: `idle`/`walk`/`death` (solo con derrota; con victoria, `idle`), flip, parpadeo con
  `playerVisible` y `reset()`. Se reescribe `player-blink.test.ts` sobre el sprite.
  - Ficheros: `src/infrastructure/phaser/PlayerView.ts` y `tests/infrastructure/{player-view,player-blink}.test.ts`.
  - Escenarios: SR "Quieto y andando", "Frames sin tick", "Jugador que gira", "Primer frame sin desplazamiento",
    "Muerte del jugador", "Victoria" y "Parpadeo con sprite animado".
- [ ] 3.13 `RenderLayers`:
  - Agrupa pulsos, gemas, cadáveres, enemigos, proyectiles y jugador, con `AnimClock` congelado en pausa o
    eligiendo mejora.
  - `SpriteCounts` reutilizado ({visible, placeholder}, más `walking` en jugador y enemigos) y `visibleCount` en
    `PulseLayer`.
  - `clear()` limpia todo, incluidos los cadáveres y el estado del jugador.
  - Se reescribe `layers-clear.test.ts`.
  - Ficheros: `src/infrastructure/phaser/{RenderLayers,renderCounts,PulseLayer}.ts` y
    `tests/infrastructure/{render-layers,layers-clear,pulse-layer}.test.ts`.
  - Escenarios: SR "Mundo detenido", "Cadáver con el mundo detenido", "R con cadáveres en curso", "Pulso sin
    manifiesto" y "Recuento coherente con el snapshot" (unitario); RR "Primer frame tras reiniciar" (200/32/1/300/10
    → 0, jugador en `idle` y sin voltear).

## 4. Composición y adaptador del motor
- [ ] 4.1 `bootContent(raw, report)`: contenido + manifiesto + cruce. Con error llama a `show` y a `log` con el
  campo y devuelve `null` (no se crea el juego).
  - Ficheros: `src/composition/contentBoot.ts` y `tests/composition/content-boot.test.ts`.
  - Escenarios: SR "Manifiesto inválido en el arranque" (con y sin `?e2e`, sin navegador) y "El manifiesto no
    cambia la simulación" (manifiesto del repo frente al mínimo, semilla 42, 1.200 ticks).
- [ ] 4.2 `BootScene`, cambios en `GameScene` y cableado en `main.ts`:
  - `BootScene` + `BOOT_SCENE_KEY`: `preload` de `sheetsToLoad`; en `create`, `NEAREST` a las hojas, el placeholder
    con `generateTexture` y `scene.start(next)`.
  - `GameScene` usa `RenderLayers` y el kit con `Phaser.TintModes`.
  - `main.ts`: `bootContent`, `loader.imageLoadType: 'HTMLImageElement'`, `[boot, menu, game]` y
    `capacity.corpses`.
  - Rojo: el E2E nuevo en `smoke.spec.ts`.
  - Ficheros: `src/infrastructure/phaser/{BootScene,GameScene,sceneKeys}.ts`, `src/composition/main.ts` y
    `tests/e2e/smoke.spec.ts`.
  - Escenarios: SR "Sin pack" (todo con placeholder, 0 peticiones de hojas, 0 errores), "CSP sin pack" y "Arranque
    e2e sin pack".
- [ ] 4.3 Sonda de render. Se escriben primero los E2E (en rojo: `probe.sprites` no existe) y después se cablean
  `onRender(…, sprites)`, `probe.sprites` y la puesta a 0 en `onScreen('menu')`. `tests/e2e/probe.ts` añade
  `weapon` y `sprites`.
  - Ficheros: `src/composition/main.ts`, `tests/e2e/{probe.ts,sprites.spec.ts,menu-flow.spec.ts,results.spec.ts}`.
  - Escenarios: SR "Recuento coherente con el snapshot", "Sonda en el menú", "Sin sonda fuera de E2E" y "Volver al
    menú con cadáveres en curso"; MM "Volver al menú desde la pausa", "Volver al menú con cadáveres en curso" y
    "Cinco ciclos menú-partida" (cierra 0009 · W2); RR "Cinco reinicios seguidos".
  - Unos 40 min: se acepta porque todos los escenarios se ponen en rojo por la misma causa.

## 5. E2E con arte sintético
- [ ] 5.1 `scripts/fixture-art.mjs`: `sheetPlan(appearance)` calcula el ancho (frameWidth × (máx. índice + 1)) y
  el alto de cada hoja, y falla si una hoja aparece con dos tamaños de frame. Un codificador PNG con `node:zlib`
  (crc32 de Node ≥ 22) escribe cada hoja con un color plano por frame.
  - Ficheros: `scripts/fixture-art.mjs` y `tests/infrastructure/fixture-art.test.ts` (dimensiones, conflicto,
    firma PNG y cabecera IHDR).
  - Escenario: base de todos los "con arte sintético" de SR.
- [ ] 5.2 Build con arte:
  - `scripts/build-art-e2e.mjs`: genera las hojas, fija `SPRINT_ART_DIR` y llama a `build({ outDir: 'dist-art' })`.
  - `playwright.config.ts`: segundo `webServer` en el puerto 4174 y proyectos `chromium` (ignora `art-*`) y
    `chromium-art`.
  - `tests/e2e/art.spec.ts` con **4 tests**.
  - Ficheros: `scripts/build-art-e2e.mjs`, `playwright.config.ts`, `package.json` (script
    `build:art-e2e`) y `tests/e2e/art.spec.ts`.
  - Escenarios: SR "CSP con arte desde el menú", "CSP con arte y con e2e" (0 placeholders, `walking` > 0), "Pack
    parcial" (se interceptan las hojas de `player` y `memory-leak` y se responde con bytes no decodificables) y
    "Frame fuera de la hoja" (se intercepta la hoja de `bug` con un solo frame).
  - Se anota el tiempo del job `e2e` antes y después. Si supera los 6 min, se sube `timeout-minutes` a 8 en
    `ci.yml`.

## 6. Documentación
- [ ] 6.1 Documentación:
  - README (o `docs/`): cómo usar un pack local (`art/`, rutas de `sheet` y que una build local con pack no se
    despliega).
  - AGENTS.md §1: estado del proyecto y el comando `build:art-e2e`.
  - GDD: deuda 0009 · W2 cerrada.
  - Nota en ADR-0006 sobre el pool de cadáveres y el orden de liberación.
  - Entrada en el diario de IA `docs/ai-log/`.
  - Sin test: es documentación.
- [ ] 6.2 (Opcional, no bloqueante) `tests/bench/render-layers.bench.ts`: 200 enemigos animados y 64 cadáveres en
  `RenderLayers` con `FakeSprite`. Se anota el ms/frame en el diario. No entra en `verify`.
