# Tasks · 0014-e2e-manual-step

> Escenarios: spec delta `specs/simulation-loop/spec.md` (ADDED "Modo de avance manual en modo E2E", "Sin avance
> por tiempo real en modo manual", "Avance manual con step" y "Mismo resultado en avance manual"; MODIFIED
> "Velocidad de simulación en modo E2E" y "Velocidad en todas las partidas de la carga"). Design: `design.md` (§N).
>
> **Cómo se trabaja cada tarea** (TDD):
> - Test en **rojo**, luego implementación mínima en verde, luego refactor.
> - En el bucle rojo-verde, `npm run verify:fast`.
> - Cierre de tarea: `npm run verify` en verde y, si la tarea toca E2E, solo las specs afectadas
>   (`npm run test:e2e -- <fichero>`).
> - Commit por tarea: Conventional Commits con `refs: 0014-e2e-manual-step` y el trailer `Assisted-by`.
>
> **Reglas**:
> - Ningún fichero de `src/domain` ni de `src/application` se modifica en todo el change.
> - Los tests unitarios nuevos van en `tests/infrastructure/` (kebab-case, como `advance-frame.test.ts`).

## 1. Infraestructura pura (Node, sin motor)

- [x] 1.1 **`resolveManual`** (design §2).
  - Ficheros: `src/infrastructure/url/resolveManual.ts` y `tests/infrastructure/resolve-manual.test.ts`.
  - Test:
    - `''`, `1` y `true` con `e2e` dan `manual: true` sin aviso;
    - `0`, `false`, `abc` y `2` dan `manual: false` y 1 aviso que menciona `manual` (y no `seed` ni `speed`), con el
      valor recortado a 32 caracteres;
    - sin `e2e`, `?manual`, `?manual=1&seed=42` y `?manual=abc` no activan el modo ni avisan;
    - `?e2e&seed=7` no activa el modo.
  - Escenarios: "Modo manual activo", "Sin manual en modo E2E", "Valor de manual inválido en modo E2E" y "Manual
    ignorado fuera de E2E" (la parte de resolución).
  - Hecho: `verify` verde.

- [x] 1.2 **`resolveAdvance`, precedencia manual > speed** (design §2).
  - Ficheros: `src/infrastructure/url/resolveAdvance.ts` y `tests/infrastructure/resolve-advance.test.ts`.
  - Test:
    - `?e2e&manual&speed=8` da `{ manual: true, speed: 1 }` sin avisos;
    - `?e2e&manual&speed=abc` y `?e2e&manual&speed=16` no dan aviso de `speed`;
    - `?e2e&manual=abc&speed=8` da `{ manual: false, speed: 8 }` con 1 aviso de `manual` y ninguno de `speed`;
    - `?e2e&manual=abc&speed=abc` da 1 aviso de cada;
    - sin `manual`, el resultado coincide con `resolveSpeed` en todos los casos de `speed.test.ts` (regresión 0008).
  - Escenarios: "Manual gana a speed" y "Manual con speed inválida" (resolución), "Manual inválido no anula
    speed", "Avisos independientes de seed, speed y manual" (la parte de speed y manual) y los escenarios
    MODIFIED de velocidad sin manual.
  - Hecho: `verify` verde; `resolveSpeed` sin cambios.

- [x] 1.3 **`StepCountSchema` y `requestStep`** (design §3.1).
  - Ficheros: `src/infrastructure/e2e/stepRequest.ts` y `tests/infrastructure/step-request.test.ts`.
  - Test, con un doble de `Pick<ManualStepper, 'request'>` y un `warn` espía:
    - `0`, `-1`, `2.5`, `NaN`, `Infinity`, `"10"` y `undefined` resuelven 0 al momento, sin llamar a `request`,
      con exactamente 1 aviso por llamada que menciona `step` y no `manual` (7 en total);
    - `Number.MAX_SAFE_INTEGER` y `1` llegan a `request`;
    - sin stepper, resuelve 0 con 1 aviso que menciona `manual` y no `step`;
    - un `BigInt` o un objeto cíclico no hacen lanzar a `warn` (no hay `JSON.stringify` de un `unknown`).
  - Escenarios: "n inválido", "n muy grande" (la validez) y "Step sin modo manual" (el aviso).
  - Hecho: `verify` verde.

- [x] 1.4 **`advanceTicks` en trozos de ≤ 15 ticks y equivalencia** (design §3.3 y §6).
  - Ficheros: `src/infrastructure/phaser/advanceFrame.ts`, `tests/infrastructure/advance-ticks.test.ts` y
    `tests/infrastructure/manual-equivalence.test.ts`.
  - Test:
    - `TICKS_PER_EXECUTE === 15`;
    - `execute(15 × TICK_MS)` ejecuta 15 ticks;
    - `advanceTicks` de 1, 60 y 225 ticks deja el tick en n, y ninguna llamada a `execute` pasa de 15 ticks (espía);
    - una oferta en el tick k < n hace que devuelva k con la partida eligiendo mejora;
    - una oferta en el tick n devuelve n;
    - con fin en el tick m, devuelve m;
    - con contenido de duración 120 y la partida en el tick 100, `advanceTicks(50)` devuelve 20 con victoria;
    - una partida que no está en curso devuelve 0 con el mismo snapshot;
    - el mismo input en todos los ticks: con input (1, 0), 8 ticks dejan x = 480 + 8 × 3,333.
  - Equivalencia, con `TickRun` real:
    - semilla 42: frames de 16,667 ms frente a `advanceTicks(60)` con elección fija, hasta el fin;
    - semilla 7: `advanceTicks(1)` frente a `advanceTicks(1200)` hasta el tick 1.200, con snapshots iguales campo
      a campo.
  - Escenarios: "Avance exacto", "Un solo tick", "Más de 15 ticks en un step", "Oferta a mitad de step", "Oferta en
    el último tick del step", "Fin de partida a mitad de step", "Victoria al llegar a la duración objetivo", "Input
    leído al empezar el step", "Manual frente a tiempo real" y "Reparto distinto de los ticks".
  - Hecho: `verify` verde, con la equivalencia fuera del test de balance.

- [x] 1.5 **`PauseGate.manualFrame`** (design §3.3).
  - Ficheros: `src/infrastructure/phaser/PauseGate.ts` y `tests/infrastructure/pause-gate.test.ts`.
  - Test:
    - en pausa devuelve `{ ticks: 0 }` con el snapshot igual campo a campo y sin llamar a `execute`;
    - sin pausa delega en `advanceTicks`;
    - tras reanudar, 1 tick da n + 1.
  - Escenario: "Step en pausa" (la regla).
  - Hecho: `verify` verde.

- [x] 1.6 **`ManualStepper`: cola FIFO y resolución en `afterRender`** (design §3.2).
  - Ficheros: `src/infrastructure/e2e/ManualStepper.ts` y `tests/infrastructure/manual-stepper.test.ts`.
  - Test:
    - `request` no resuelve hasta `afterRender`;
    - un frame sin `plan` (no hay escena) resuelve 0;
    - dos `request(30)` seguidos se atienden en orden: la segunda empieza en el frame siguiente y cada una devuelve
      sus ticks;
    - si la primera termina con `canContinue = false` en la oferta (20), la segunda recibe `plan` y `served(0, false)`
      y devuelve 0;
    - sin peticiones, `plan` devuelve 0 ticks.
  - Escenarios: "Llamadas simultáneas", "Llamada simultánea que encuentra la oferta" y "Step en el menú" (la regla).
  - Hecho: `verify` verde.

- [x] 1.7 **`ManualStepper`: varios frames, input congelado y parada** (design §3.2).
  - Ficheros: los mismos que en 1.6.
  - Test:
    - `request(1500)` se reparte en 600 + 600 + 300, con un `afterRender` por frame, y resuelve 1.500 tras el
      tercero;
    - `readInput` se llama una sola vez por petición, en su primer frame;
    - `canContinue = false` a mitad (pausa) resuelve con los ticks hechos;
    - `executed` < planificado termina la petición;
    - `request(Number.MAX_SAFE_INTEGER)` termina cuando `served` informa de la parada;
    - el stepper no recibe ninguna duración de frame (la API no la admite), y lo fija un test de tipo/firma.
  - Escenarios: "n muy grande", "Independiente de la duración de los frames" y "Frames largos sin step" (la regla).
  - Hecho: `verify` verde.

## 2. Escena y composición

- [x] 2.1 **Composición: `resolveAdvance`, `probe.manual` y `probe.step` sin stepper** (design §2 y §3.6).
  - Ficheros:
    - `src/composition/main.ts`: `resolveAdvance` en lugar de `resolveSpeed`, `manual` en la sonda y
      `step = requestStep(n, undefined, console.warn)` todavía sin stepper;
    - `tests/e2e/probe.ts`: `manual` en `Probe`, `gameUrl({ manual })`, `expectManual` y `step(page, n)`;
    - `tests/e2e/manual-step.spec.ts` (nuevo).
  - Test E2E:
    - `?e2e&manual&seed=7`, `manual=1` y `manual=true` dan `manual: true` y semilla 7, sin aviso de `manual`;
    - `?e2e&manual=0/false/abc/2` dan `manual: false` y 1 aviso;
    - `?e2e&seed=abc&manual=abc&speed=abc` da 1 aviso de cada;
    - `@realtime`: `?e2e&seed=7` con `step(60)` devuelve 0 con 1 aviso de `manual` y `ticksPerFrame` ≈ 1;
    - `@realtime`: `?e2e&manual=abc&speed=8` da `ticksPerFrame` > 2;
    - `@realtime`: `?manual`, `?manual=1&seed=42` y `?manual=abc` con `Jugar`: sin sonda, sin avisos y el canvas
      avanza;
    - `@realtime`: `?e2e&manual=abc` con 3 R: 1 aviso de `manual` en total.

    Las etiquetas `@realtime` se ponen ya, aunque los proyectos lleguen en 3.1.
  - Escenarios: "Modo manual activo", "Valor de manual inválido en modo E2E", "Avisos independientes de seed, speed
    y manual", "Step sin modo manual", "Manual inválido no anula speed", "Manual ignorado fuera de E2E" y "Manual
    inválido y varios reinicios".
  - Hecho: `verify` verde y `npm run test:e2e -- manual-step speed` verde.

- [x] 2.2 **`GameScene` en modo manual + `ManualStepper` + `POST_RENDER`** (design §3.4 y §3.6).
  - Ficheros:
    - `src/infrastructure/phaser/GameScene.ts`: `manual?: ManualFrames` en las deps y rama manual en `update`, con
      `layers.advance(ticks × TICK_MS)`;
    - `src/composition/main.ts`: crea el stepper solo con manual, lo pasa a `requestStep` y engancha
      `game.events.on(Phaser.Core.Events.POST_RENDER, …)`;
    - `tests/e2e/manual-step.spec.ts`.
  - Test E2E con manual:
    - `step(60)` devuelve 60 y el tick vale 60;
    - `step(1)` da n + 1;
    - `step(225)` da 225;
    - `?e2e&manual&speed=8&seed=7`: 120 frames (`waitFrames`) dejan el tick en 0 y `step(10)` devuelve 10;
    - con `?e2e&manual&speed=abc`, sin aviso de `speed`;
    - los 7 n inválidos dan 7 avisos de `step` y el snapshot no cambia;
    - `step(9007199254740991)` hasta el fin, sin avisos de `step` (con la elección fija previa vía `press('1')`);
    - `@realtime`: "Sin step no avanza" (2 s reales: tick 0) y "Avance exacto" (2 s tras `step(60)`: sigue en 60).
  - Escenarios: "Avance exacto", "Un solo tick", "Más de 15 ticks en un step", "Manual gana a speed", "Manual con
    speed inválida", "n inválido", "n muy grande" y "Sin step no avanza".
  - Hecho: `verify` verde, `npm run test:e2e -- manual-step` verde y el resto de E2E en tiempo real sin cambios
    (`-- speed pause`).

- [x] 2.3 **Helpers `waitForRun`, `stepUntil`, `playToEnd` y `holdKey` y E2E de estados** (design §5).
  - Ficheros: `tests/e2e/probe.ts` y `tests/e2e/manual-step.spec.ts`.
  - Test E2E con manual:
    - semilla 7: `step(3600)` devuelve k con la oferta visible; `step(10)` devuelve 0; se pulsa 1 y `step(10)`
      devuelve 10;
    - oferta en el último tick: `step(k − n)` desde n;
    - fin a mitad: `playToEnd` muestra resultados y deja una entrada en `progress.history` al resolverse;
    - después del fin, `step(10)` devuelve 0;
    - pausa: Esc sin step pone `screen` en `paused` con el tick igual; `step(60)` devuelve 0; tras Esc, `step(1)`
      da n + 1;
    - un clic en la carta 0 sin step cierra la oferta con el tick igual;
    - menú: tras Volver al menú, `step(60)` devuelve 0 y `runs` no cambia;
    - `Promise.all([step(30), step(30)])` dentro de un `evaluate` da [30, 30] y tick 60;
    - con la oferta en el tick 20, el mismo `Promise.all` da [20, 0];
    - `holdKey('ArrowRight', 8)` deja x = 480 + 8 × 3,333;
    - pulsar y soltar sin step y luego `step(8)` deja x = 480;
    - R sin step deja el tick en 0; tras Volver al menú y Jugar, con `waitFrames(120)`, sigue en 0 y `step(10)`
      devuelve 10;
    - `@realtime`: "Reinicio sin step" y "Manual tras reiniciar con R" (2 s reales).
  - Escenarios: "Oferta a mitad de step", "Oferta en el último tick del step", "Fin de partida a mitad de step",
    "Step en pausa", "Pausa sin step", "Elección sin step", "Step en el menú", "Llamadas simultáneas", "Llamada
    simultánea que encuentra la oferta", "Input leído al empezar el step", "Pulsación sin step entre medias",
    "Reinicio sin step", "Manual tras reiniciar con R" y "Manual tras volver al menú".
  - Hecho: `verify` verde y `npm run test:e2e -- manual-step` verde.

## 3. Playwright: proyectos, fixture y ESLint

- [x] 3.1 **Proyectos `logic` y `realtime`, `retries` y etiquetas** (design §4.1).
  - Ficheros:
    - `playwright.config.ts`: `logic` con `grepInvert: /@realtime/` y `realtime` con `grep: /@realtime/`;
      `retries: CI_LIKE ? 0 : CI ? 1 : 0`;
    - `{ tag: '@realtime' }` en `smoke`, `speed`, `sprites`, `menu`, `menu-flow` (todo), `pause` ("velocidad 8"),
      `progress` ("Sin violaciones en el bucle completo" y el `describe` "Carga del progreso guardado") y los tests
      de tiempo real de `manual-step`.

    Las specs que todavía no se han migrado (level-up, etc.) caen en `logic` sin cambios y siguen pasando.
  - Test (rojo antes del cambio, porque los proyectos no existen):
    - `npx playwright test --list --project=realtime` lista exactamente los tests etiquetados;
    - `--project=logic` lista el resto;
    - la suma de los dos da el total de antes más los de `manual-step`.
  - Hecho: `verify` verde y `npm run test:e2e` (los dos proyectos) verde.

- [x] 3.2 **Fixture `cpuThrottle` por CDP, `parseThrottle` y regla de ESLint** (design §4.2).
  - Ficheros:
    - `tests/e2e/fixtures.ts`;
    - `tests/support/cpuThrottle.ts` con `parseThrottle` y `DEFAULT_CPU_THROTTLE` provisional, con un comentario
      con la fecha;
    - `tests/infrastructure/cpu-throttle.test.ts`;
    - `playwright.config.ts`: `defineConfig<{ cpuThrottle: number }>` y `cpuThrottle` solo en `realtime` con
      `CI_LIKE`;
    - regla `no-restricted-imports` en la config de ESLint para `tests/e2e/**/*.spec.ts`;
    - todas las specs pasan a importar `test` y `expect` de `./fixtures`.
  - Test:
    - unitario: `parseThrottle(undefined)` da el valor por defecto, `'4'` da 4, y `'0'`, `'abc'` y `'-1'` lanzan;
    - lint: una spec que importa `test` de `@playwright/test` falla `npm run lint` (rojo antes de la regla);
    - E2E `@realtime` en `calibration.spec.ts` o `throttle.spec.ts`, que solo corre con `cpuThrottle > 1`:
      - el tiempo de un bucle JS fijo en `page` comparado con una segunda página sin frenar del mismo contexto da
        una razón ≥ rate/2 tras `goto`;
      - lo mismo **tras `page.reload()`** (si no sobrevive, el fixture lo vuelve a aplicar en `framenavigated`).
  - Hecho: `verify` verde y `CI_LIKE=1 npm run test:e2e -- --project=realtime throttle` verde. Sin `CI_LIKE`, el
    test de frenado se salta.

## 4. Migración de specs a `logic` (design §5)

> En cada tarea, el rojo es la guarda de 4.0: se añade el fichero (o los tests) a la lista de la guarda, falla
> mientras queden esperas de reloj, y después se migra. Además, quitar `manual` de `gameUrl` hace fallar
> `expectManual`. Las specs migradas dejan de importar `E2E_SPEED` y `playChoosingFirst`.

- [x] 4.0 **Guarda de esperas de reloj en `logic`**.
  - Ficheros: `tests/support/logicGuard.ts` y `tests/infrastructure/logic-guard.test.ts`.
  - Qué hace: parte cada spec en bloques `test(…)`. Un bloque sin `@realtime`, o el preámbulo de un fichero que no
    es entero de tiempo real, no puede contener `waitForTimeout`, `playChoosingFirst` ni
    `expect.poll(…snapshot…tick…)`.
  - Test:
    - el detector, sobre textos de ejemplo, da positivos y negativos (rojo: el detector no existe);
    - la lista de ficheros vigilados empieza con `manual-step.spec.ts`.
  - Escenario: el criterio de éxito de la proposal ("Las specs del proyecto `logic` no contienen…").
  - Hecho: `verify` verde.

- [x] 4.1 **`level-up.spec.ts`**.
  - Cambio: con `?e2e&manual&seed=7`, `stepUntil(offer)`, overlay visible, `press('1')`, `step(1)` y sin oferta.
    Fuera `waitForTimeout(100/500)`.
  - Escenarios de la spec viva de level-up/upgrades que cubre hoy, sin cambiar su intención.
  - Hecho: la guarda incluye el fichero, `verify` verde y `npm run test:e2e -- level-up` verde.

- [ ] 4.2 **`health.spec.ts` y `enemies.spec.ts`**.
  - Cambios:
    - health: `stepUntil(health < max, 80 × 60)` con la semilla 42;
    - enemies: `step(30)` con enemigos dentro de la arena; `?seed=abc` con 1 aviso y `step(31)` devuelve 31.
  - Hecho: la guarda incluye los dos ficheros, `verify` verde y `npm run test:e2e -- health enemies` verde.

- [ ] 4.3 **`weapons.spec.ts`**.
  - Cambio: `stepUntil` con `chunk = 10` y tope de 15 × 60, registrando los proyectiles vistos y las bajas. Fuera
    `waitForTimeout(50)`.
  - Hecho: la guarda incluye el fichero, `verify` verde y `npm run test:e2e -- weapons` verde.

- [ ] 4.4 **`results.spec.ts`** (derrota + R y cinco reinicios).
  - Cambios: `playToEnd`, R y espera de `runs`; la partida nueva está en el tick 0 y con 0 cadáveres, sin
    `watchNextRun`; la sexta con `stepUntil(tick ≥ 600)`.
  - Hecho: la guarda incluye el fichero, `verify` verde y `npm run test:e2e -- results` verde.

- [ ] 4.5 **`progress.spec.ts`**, solo los tests de reglas.
  - Cambios: guardado al terminar con `playToEnd`; almacenamiento bloqueado + R; recarga a mitad tras `step(300)`.
    Se quedan `@realtime` "Sin violaciones en el bucle completo" (la partida completa a `speed=8`) y "Carga del
    progreso guardado".
  - Hecho: la guarda incluye el fichero (bloques sin etiqueta), `verify` verde y `npm run test:e2e -- progress`
    verde.

- [ ] 4.6 **`pause.spec.ts`**: Esc y reanudar, botón, teclas en pausa, Esc durante la oferta y Esc con la partida
  terminada.
  - Cambios: `step(60)` en pausa devuelve 0 con el snapshot igual; tras reanudar, `step(1)` da n + 1. Fuera
    `waitForTimeout(PAUSED_MS/1000/300)` y los polls del tick. Se queda `@realtime` "velocidad 8".
  - Hecho: la guarda incluye el fichero, `verify` verde y `npm run test:e2e -- pause` verde.

- [ ] 4.7 **`clear-progress.spec.ts`**.
  - Cambios: `playToEnd` en manual; `menuInE2E` con `gameUrl({ manual: true })` y `step(11)`; los dos tests que
    juegan tras Jugar, en manual; `waitForTimeout(500)` pasa a `waitFrames(30)`.
  - Hecho: la guarda incluye el fichero, `verify` verde y `npm run test:e2e -- clear-progress` verde.

- [ ] 4.8 **`menu-progress.spec.ts`**.
  - Cambios: "Jugar tras usar los botones" y "Mismo fichero desde los dos sitios" en manual (`step` y
    `playToEnd`); `waitForTimeout(300)` pasa a `waitFrames(20)`.
  - Hecho: la guarda incluye el fichero, `verify` verde y `npm run test:e2e -- menu-progress` verde.

- [x] ~~4.9~~ **Descartada (usuario, 2026-11-23)**: "Volver al menú desde la pausa" se queda en `realtime`, como
  fija la proposal. No se implementa.
- (texto original) 4.9 `menu-flow`: "Volver al menú desde la pausa (tick ≥ 3.000)" a
  `logic`.
  - Cambio: `stepUntil(busy || over)` en lugar de `playChoosingFirst` a 60 s; se le quita `@realtime`. El resto de
    menu-flow sigue `@realtime`.
  - Hecho: la guarda vigila ese bloque, `verify` verde y `npm run test:e2e -- menu-flow` verde. Si no se aprueba,
    se marca como descartada con el motivo.

## 5. Calibración del frenado (design §4.3)

- [ ] 5.1 **Sonda `calibration.spec.ts` (`@realtime`)**.
  - Ficheros: `tests/e2e/calibration.spec.ts` y `measureFrames(page, frames)` en `probe.ts`.
  - Qué mide: con `?e2e&seed=42&speed=8` y el tick ≥ 1.200, sobre 300 frames de rAF, `fps`, p95 del intervalo y
    `ticksPerFrame`.
  - Qué registra: `console.log('[calibration] throttle=N fps=… p95=… tpf=…')` y `testInfo.annotations`.
  - Test: solo exige `fps > 0` y los 3 campos finitos (rojo: `measureFrames` no existe). Nunca falla por lento.
  - Hecho: `verify` verde y `npm run test:e2e -- calibration` verde, con la línea `[calibration]` en la salida.

- [ ] 5.2 **Medir y fijar `DEFAULT_CPU_THROTTLE`**.
  - Pasos:
    1. **Línea base**: `CI_LIKE=1 CPU_THROTTLE=1 npm run test:e2e -- --project=realtime --repeat-each=3` con 2
       workers. Se anotan fallos y duración.
    2. **Local**: la misma pasada con `CPU_THROTTLE` ∈ {2, 3, 4, 6}. Se anota la mediana de `[calibration]` de cada
       rate.
    3. **CI**: el valor se lee del log del job `e2e` (o del artefacto `playwright-report`) **en el siguiente push
       del PR**. **No se lanza ningún workflow a mano ni se hace polling**: se lee una vez, cuando el job ya ha
       terminado.
    4. **Elección**: el menor rate con `fps` local ≤ CI y p95 local ≥ CI. Si ninguno lo consigue (cuello en
       swiftshader), el de `tpf` más parecido, y se deja escrito.
  - Ficheros: `tests/support/cpuThrottle.ts` (valor y tabla de medidas en un comentario con fecha) y
    `tests/infrastructure/cpu-throttle.test.ts`.
  - Test: el test de `parseThrottle(undefined)` se cambia primero al valor medido (rojo) y después la constante
    (verde).
  - La tabla se deja en el diario de IA (`docs/ai-log/`) para que verify la pase al verify-report.
  - Bloqueo: depende de que el PR exista; hasta entonces vale el valor provisional de 3.2.
  - Hecho: `verify` verde.

- [ ] 5.3 **Pasada pesada final**.
  - Comando: `CI_LIKE=1 npm run test:e2e -- --project=realtime --workers=2 --repeat-each=3`, con el frenado medido.
  - Hecho: **0 fallos** en 3 pasadas consecutivas, sin reintentos, y el PC usable durante la pasada. Si hay
    fallos, se corrige el test o la clasificación; no se suben márgenes ni reintentos.

## 6. Documentación y cierre

- [ ] 6.1 **AGENTS.md §1 y §2** (design §9).
  - §2, fila `npm run test:e2e`: la receta pasa a
    `CI_LIKE=1 npm run test:e2e -- --project=realtime --repeat-each=3`, con 2 workers como CI, `CPU_THROTTLE` y
    sin reintentos; `--project=logic` para las de reglas; se quita `--workers=12`.
  - §1: una línea sobre `?e2e&manual` + `step(n)` y sobre los proyectos `logic` y `realtime`.
  - **Reconciliar con 0013**, que también toca §2 (6 workers y `--repeat-each=2`, provisional). El que fusione
    segundo rebasa y deja **una sola** receta, esta. Hay que comprobar `main` antes de abrir o actualizar el PR.
  - Test: no hay test automático (es documentación). Hecho: `verify` verde, con `guard:all` incluido.

- [ ] 6.2 **Suite completa y comprobaciones del change**.
  - Ejecutar `npm run test:e2e` (`logic` + `realtime`) en local y anotar la duración de cada proyecto.
  - `git diff --stat main -- src/domain src/application` vacío.
  - `package.json` sin dependencias nuevas.
  - La guarda de 4.0 vigila todas las specs `logic`.
  - Hecho: `verify` verde, la suite E2E verde en local y la duración anotada para el verify-report. CI en verde en
    el push del PR, sin lanzarlo a mano.
