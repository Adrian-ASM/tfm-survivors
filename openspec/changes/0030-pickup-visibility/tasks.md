# Tasks · 0030-pickup-visibility

<!-- Todo es infraestructura y contenido: test-after (ADR-0018), sin rojo obligatorio. `npm run verify:fast` al
     cerrar cada tarea; `npm run verify` completo y un commit por grupo (Conventional Commits, `refs: 0030-pickup-
     visibility`, trailer `Assisted-by`). Ningún grupo se cierra en rojo. Núcleo (`src/domain`, `src/application`)
     sin diff en todo el change. Design: D1–D9. -->

## 1. Dominio
- (sin tareas: el núcleo no cambia, ver design D8)

## 2. Aplicación
- (sin tareas)

## 3. Infraestructura y contenido

### Grupo A · Hojas, procedencia y datos de aspecto (commit 1)
- [x] 3.1 **Hojas y procedencia** (D6).
  - Copiar sin recomprimir `G_Spawn.png`, `W_Spawn.png` y `M_Spawn.png` desde
    `C:\Users\Adri\TFM\Tiny Swords (Update 010)\Resources\Resources\` a
    `public/assets/tiny-swords/Resources/Resources/`.
  - Calcular el sha256 y los bytes de cada una con `Get-FileHash -Algorithm SHA256` y `(Get-Item).Length` sobre el
    fichero del pack, comprobar que coinciden con los de la copia y añadir las 3 entradas a
    `content/asset-provenance.json` (formato de `G_Idle.png`) **en el mismo commit**.
  - Confirmar con la imagen que hay 7 frames de 128 px con el frame 0 vacío (riesgo R1).
  - Actualizar los tests que vigilan la prohibición: `resource-provenance`, `sheep-provenance`, `appearance-schema`
    («Solo las hojas usadas») y `appearance-hazards:217`. En los dos primeros, añadir los casos de lista o nota
    simulada.
  - Escenarios (asset-provenance): «Hojas de aparición registradas», «Integridad de las hojas de aparición», «Hoja
    de aparición sin entrada», «Hoja de aparición del Free Pack», «Variante sin sombra de una hoja de aparición»,
    «Ninguna hoja de más», «Hojas de recursos no usadas», «Una hoja de aparición de más» y «Hojas de ovejas y carne
    no usadas». Escenarios (sprite-rendering): «Solo las hojas usadas».
  - Tests: los cuatro citados más `npm run guard:all`.
- [x] 3.2 **Esquema zod y datos** (D1).
  - En `appearanceSchema.ts`: `SpawnSchema` (sin bucle), `ResourcePickupSchema` con `spawn` opcional en
    `gold`/`wood`/`meat`, `diameter` en `XpShapeSchema` y `PickupMotionSchema` en la raíz
    (`float.{amplitude, periodMs, phaseStepMs}`, `spawnStaggerMs`). Añadir las hojas `spawn` a `XP_SHEET_MUST_DIFFER`.
  - En `loadAppearance.ts`: `pickupSpawnSheetsOf`, con la comprobación `SHEET_NOT_REGISTERED`, y su carga en
    `bootPlan.ts`.
  - En `content/appearance.json`: escalas 0,5 / 0,75, `diameter` 20, `spawn` `[0..6]` a 10 fps y `pickupMotion`
    con A 4, T 1.600, s 989 y e 120.
  - Escenarios (sprite-rendering): «Datos del repositorio», «Datos inválidos» (sin regresión), «Aparición,
    diámetro y flote inválidos», «Aparición opcional» y «Hoja de cada elemento».
  - Tests: `appearance-repo.test.ts`, `appearance-schema.test.ts` (o un `appearance-pickups.test.ts` nuevo) y
    `boot-plan` si existe.

### Grupo B · Flote y tamaño (commit 2)
- [ ] 3.3 **Funciones puras y aspectos resueltos** (D2, D3).
  - `art/pickupMotion.ts` con `floatOffset` (fase por id), `floatOffsetFrom` (desde R_f, sin fase), `spawnDelay` y
    `spawnFrame`.
  - En `looks.ts`, `PickupLook` gana `spawn: StillLook | null` y `shapeRadius`, y `Looks` gana `pickupMotion`.
    `spawn` es null si `idle` va con reserva, si la hoja `spawn` falta o si algún frame no cabe.
  - Escenarios: «Desplazamiento según el reloj», «Fases distintas con el mismo reloj» (funciones), «Frame de
    aparición fuera de la hoja» y «Hoja idle que no carga con la aparición cargada» (resolución).
  - Tests: `pickup-motion.test.ts` (nuevo) y `looks` / `appearance-stone.test.ts`.
- [ ] 3.4 **Flote y escala en `PickupLayer`** (D4, solo la parte del flote).
  - `sync(pickups, ms)` con el desplazamiento en `at()`, `shapeRadius` en la gema y la reserva sin flote.
  - Escenarios (sprite-rendering): «Desplazamiento según el reloj», «Fases distintas con el mismo reloj»,
    «Recogible atraído», «Hueco reutilizado», «La reserva no flota», «Tamaños de los recogibles del repositorio»,
    «Diámetro de la gema independiente de gemRadius», «Flechas y gemas», «Recogibles de los cinco tipos», «Cada
    piedra con la roca de su origen» y «Reserva de una roca».
  - Escenarios (xp-gems): «Recogidas y nuevas», «Tope de gemas pintado», «Todas recogidas» y «Sprite reutilizado
    para la piedra».
  - Escenarios (world-camera): «Gema que flota». Se cubre con la capa y la conversión de `camera-rig.test.ts`.
  - Tests: `pickup-layer.test.ts`, `stone-render` y `camera-rig.test.ts`.

### Grupo C · Aparición, retardo, limpieza y reloj (commit 3)
- [ ] 3.5 **Aparición una vez por id** (D4).
  - Estado de aparición por id en el hueco (`spawnStart`, `spawnDelay`, `spawning` y `floatFrom` = R_f, todos
    reiniciados al aparecer).
  - Cambio `spawn` → `idle` con `setTexture`, d = 0 durante la aparición y flote sin salto desde R_f.
  - Escenarios (sprite-rendering): «Aparición y paso a idle» (ajustado), «Flote sin salto al terminar la
    aparición», «Aparición fallida con fase por id», «Una sola vez por id», «Sprite reutilizado por un id
    nuevo», «Valor sumado por el tope», «Recogido durante la aparición», «Piedra y gema sin aparición», «Hoja de
    aparición que no carga», «Hoja de aparición que falla sin reserva», «Hoja idle que no carga con la aparición
    cargada», «Reserva de un tipo de recogible» y «Reserva de la carne».
  - Escenarios (xp-gems): «Gema reutilizada por un recogible con aparición» y «Topes de los cinco tipos pintados».
  - Tests: `pickup-layer.test.ts`.
- [ ] 3.6 **Retardo del primer pintado, limpieza y sonda** (D4, D5).
  - Indicador `initial` en `PickupLayer`, que `clear()` vuelve a poner a true.
  - `counts.pickupSpawns` en `RenderLayers` y en `renderCounts.ts`, a 0 en el menú.
  - Escenarios (sprite-rendering): «Montones escalonados», «Recogible posterior sin retardo», «Desfase 0»,
    «Montones del repositorio» (8 montones de la semilla 42, inicios distintos y último ≤ R0 + 3.000), «R con
    cadáveres en curso», «R con el mapa real», «R con apariciones en curso», «Recuentos de recogibles sin depender
    de la aparición ni del flote», «Recuento en aparición» y «Sonda en el menú».
  - Tests: `pickup-layer.test.ts`, `layers-clear.test.ts` y `render-layers.test.ts`.
- [ ] 3.7 **Reloj congelado y modo manual** (D4).
  - Prueba sobre `RenderLayers.advance(…, frozen)` con cada estado: `paused`, oferta, `shopping`, `building` y fin.
  - Escenarios (sprite-rendering): «Flote congelado en pausa, oferta, tienda, obra y fin», «Aparición congelada en
    pausa, oferta, tienda, obra y fin», «Flote en modo manual» y «Aparición en modo manual» (ticks × `TICK_MS`).
  - Tests: `render-layers.test.ts`.

### Grupo D · Iconos e invariancias (commit 4)
- [ ] 3.8 **Iconos sin aparición ni flote** (D3, riesgo R4).
  - Comprobar que `counterIcon` y `ResourceIcons` no derivan su tamaño de `scale` ni de `diameter`. Si lo hacen,
    fijar el tamaño en su layout.
  - Escenarios (sprite-rendering): «Iconos del HUD con otra escala de recogible» y «Iconos de la guía y de la obra».
  - Tests: `hud.test.ts` y el test de `ResourceIcons` / `BuildPanel`.
- [ ] 3.9 **Simulación, firmas y mapa intactos** (D8).
  - Un test que ejecuta 1.200 ticks de la semilla 42 con los datos del repositorio y con las variantes (A 0 y sin
    `spawn`, escalas de antes) pintando con `RenderLayers`, y compara los snapshots campo a campo.
  - Escenarios (sprite-rendering): «Flotar no cambia la simulación», «Aparecer no cambia la simulación», «Escalas
    de los recogibles sin efecto en la simulación» y «Totales del mapa con estructuras y vetas» (820/904 con el
    reloj a 0 y a 10.000).
  - Escenarios (xp-gems): «El tamaño pintado no cambia la recogida».
  - Comprobar que `git diff main -- src/domain src/application tests/support/*Golden* tests/support/balanceBaseline.ts`
    sale vacío y que el lote del bot de `verify` sigue dando `BALANCE_BASELINE` sin regenerarla.
  - Tests: `pickup-invariance.test.ts` (nuevo) y `map-probe.test.ts`.
- [ ] 3.10 **Reserva del árbol sin el frame 3** (spec MODIFIED).
  - En `map-looks.test.ts`, el caso «sin el frame 5» (`FrameCount` 5) pasa a «sin el frame 3» (`FrameCount` 3,
    frames 0–2). Con la `idle` 0–3, una hoja de 5 frames ya cabe y no prueba la reserva. Sin cambios de código.
  - Escenario (sprite-rendering): «Reserva de árbol y torre».
  - Tests: `map-looks.test.ts` y `plan-map-animation.test.ts` (sin cambios).

## 4. E2E y documentación

### Grupo E · E2E y cierre (commit 5)
- [ ] 4.1 **E2E ampliado** (D7, e2e-lite: 0 nuevos y 1 ampliado, en modo manual).
  - Tipo `pickupSpawns` en `tests/e2e/probe.ts`.
  - En el test «Mapa real…» de `gameplay.spec.ts`: en la primera lectura, `pickupSpawns.wood` = montones y los
    demás tipos a 0; en la segunda (tras `step(everyTicks + 1)`), 0 y sin reserva.
  - Escenario (sprite-rendering): «Estructuras y guardias en el navegador» [E2E]. Lo ejecuta
    `npm run test:e2e -- gameplay.spec`.
- [ ] 4.2 **Documentación y cierre** (D9). Lo hace el **orquestador**, porque el implementer no escribe en
  `AGENTS.md`.
  - En `AGENTS.md`, bloque de 0029: «Árbol con `idle` 0–5 a 6 fps» → «0–3 a 4 fps».
  - Añadir la entrada de 0030 en la sección 1: escalas, `diameter`, flote A/T/s, `spawn` 7 frames a 10 fps con
    retardo e, sonda `sprites.pickupSpawns`, 3 hojas `*_Spawn` y firmas y balance intactos.
  - Después, `npm run verify` y `npm run test:e2e` en verde.
  - Escenario (sprite-rendering): «Fases deterministas» (solo texto de la spec; `map-probe.test.ts` ya comprueba
    [0, 3]).
