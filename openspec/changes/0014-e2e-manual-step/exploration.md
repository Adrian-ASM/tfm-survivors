# Exploración 0014-e2e-manual-step (id provisional)

Intención: que los E2E de reglas no dependan del reloj real, sin perder la detección de carreras del adaptador.

## Contexto actual
- `playwright.config.ts`: 2 workers, `retries: CI ? 1 : 0`; con `CI`/`CI_LIKE` timeout 60 s y expect 15 s. `CI_LIKE` = swiftshader.
- Bucle: `GameScene.update(time, deltaMs)` (src/infrastructure/phaser/GameScene.ts) lee Esc, clic de pausa, R y elección,
  y llama a `PauseGate.frame` -> `advanceFrame` (speed avances de `TickRun.execute(deltaMs, input)`) -> `FixedStepLoop`
  (acumulador, tope 250 ms, 0..15 ticks de 1/60 s). Un `render` por frame. El núcleo no conoce `speed` (spec viva).
- `resolveSpeed` (src/infrastructure/url) se resuelve una vez en `src/composition/main.ts`, que también crea la sonda
  `window.__sprint` (solo con `?e2e`; campos seed, speed, snapshot, results, progress, screen, runs, sprites).
- `tests/e2e/probe.ts`: esperas con `expect.poll`, `waitForTimeout`, `waitFrames` (rAF), `playChoosingFirst` (bucle de 100 ms).
- Spec viva: `openspec/specs/simulation-loop` (requisitos "Velocidad de simulación en modo E2E", "Avance acelerado por frame",
  "Sin tiempo acumulado durante la pausa ni antes de jugar", "Velocidad en todas las partidas de la carga"). Origen: change 0008 archivado.

## Capacidades afectadas
simulation-loop (nuevo requisito de modo manual y convivencia con speed); probe/sonda E2E (campo `step`, `manual`); main-menu
y run-results solo si se tocan sus escenarios. `domain`/`application`: no hace falta tocarlos (`TickRun.execute(ms, input)` ya
admite pasar `n * 1000/60` ms; reglas 1-3 intactas).

## Contraste de la idea
- Punto de enganche limpio: en modo manual `update()` seguiría corriendo (teclado, Esc, R, clics de pausa, elección se
  consumen igual) pero con `deltaMs = presupuesto pendiente` en lugar del real; `step(n)` fija el presupuesto (n * 16,667 ms)
  y resuelve cuando se pintó ese frame. Con delta 0 `FixedStepLoop` devuelve 0 ticks, así que sin `step` el mundo no avanza.
- Ojo con el tope (`MAX_FRAME_MS = 250` en `FixedStepLoop`): un único `execute(n * 16,667)` se recorta a 15 ticks. El
  adaptador debe trocear `step(n)` en llamadas de ≤ 15 ticks (en un mismo frame, como ya hace `advanceFrame` con speed)
  y parar al cambiar de estado (subida de nivel, fin de partida) para no saltarse la elección. Lo fija el design.
- Convivencia con speed: o se excluyen (`manual` gana y `speed` se ignora, con aviso) o `step(n)` cuenta frames de motor y
  se multiplica por speed. Lo más simple y claro: manual excluye speed.
- Input: el teclado de Phaser se lee en `update`; una pulsación hay que dejarla "viva" hasta el siguiente `step`
  (`keyboard.down` / `up` con `step` entre medias). Hay que comprobar cómo lee `KeyboardInput` (estado vs. JustDown).
- Menú, `screen`, pausa: el menú y los botones DOM no dependen del bucle. Pausa: `step` en pausa debe dar 0 ticks (ya lo
  da `PauseGate`), y es más determinista que `waitForTimeout(1000)`. Escena de resultados y guardado: se escriben dentro de
  `render()`, así que funcionan igual con `step`.
- Animaciones: usan `layers.advance(deltaMs)` (reloj propio, sin tweens/timers de Phaser), así que el tiempo manual las
  mueve de forma coherente. Los timers de Phaser no se usan en la escena (grep).
- Riesgo de ocultar bugs: lo que no se ejercita es el acumulador con deltas irregulares, el tope de 250 ms, rAF real,
  la carga de hojas y el render bajo carga. Mitigación: esos escenarios siguen en tiempo real (ver clasificación).

## Clasificación de specs (16 ficheros, ~150 esperas)
(a) pasa a manual (reglas; sustituye `playChoosingFirst`, `expect.poll(tick)` y `E2E_SPEED`):
- level-up (oferta/elección por semilla 7), health (primer golpe), weapons (proyectiles y bajas), results (derrota, R, 5
  reinicios), progress (guardado al terminar, bloqueado, recarga a mitad), enemies (aparecen, aviso de seed), partes de
  pausa (Esc durante la oferta, Esc con partida terminada, congelado) y de clear-progress/menu-progress que juegan hasta el fin.
  Aprox. 35-45 esperas/polls cambian (las ~10 `playChoosingFirst` + ~20 polls de tick + ~10 `waitForTimeout`).
(b) se queda en tiempo real:
- speed (valida precisamente `speed`), smoke (carga, CSP, flecha derecha), sprites (`waitFrames` de 600 frames = render real),
  menu y menu-flow (navegación DOM y ciclos de escena), pausa con speed 8 y `ticksPerFrame`, menu-progress/clear-progress
  de import/export (no usan bucle). Aprox. 60-70 esperas no cambian.

## Opciones
A. Modo `?e2e&manual` + `__sprint.step(n)` (la idea). Pros: determinista, elimina la dependencia de la CPU en (a), tests
   cortos. Contras: cambia el adaptador y la composición; hay que mantener dos estilos de test; riesgo de falsa seguridad.
B. Solo infraestructura de tests: subir `speed` por defecto, más márgenes, retries. Pros: sin código de producción. Contras:
   no quita el reloj real; sigue habiendo fallos de tiempos con CPU al 100 %.
C. Híbrida: A para (a) + etiqueta `@realtime` y proyecto Playwright `realtime` para (b), y calibración de la pasada
   CI_LIKE. Pros: cubre las dos intenciones, la pasada pesada queda acotada. Contras: más piezas.

## Pasada CI_LIKE y workers
- Propuesta de ejecución: dos proyectos Playwright, `logic` (manual) y `realtime` (los `@realtime` o ficheros listados);
  `CI_LIKE=1 npm run test:e2e -- --project=realtime --workers=8 --repeat-each=3`. La lógica se repite 1 vez.
- Workers: el runner (4 vCPU, 2 workers) da ~2 hilos por worker. Local 16 hilos / 12 workers = 1,3 hilos por worker (más duro
  que CI, de ahí falsos fallos); 16/8 = 2 hilos por worker, igual que CI. Cifra propuesta: 8. Incógnita: la CPU del runner es
  más lenta por núcleo; validar comparando frames/s (`ticksPerFrame`) entre CI y local con 8.
- `retries: 1` con `CI_LIKE`: desaconsejado; en esa pasada el objetivo es ver flakes y un reintento los oculta. Alternativa
  barata: mantener 0 y usar `--repeat-each=3` + `--reporter=list`; en CI real sí 1 y revisar los "flaky" del informe HTML.

## SDD o chore
SDD ligero. Añade comportamiento a la spec viva `simulation-loop` y a la sonda (estado de la API E2E), igual que 0008.
Propuesta: propose + delta de spec + design corto + tasks; sin ADR nueva salvo que se decida el semántico de `step` y speed.
Los cambios de `playwright.config.ts` caben dentro del mismo change (no merecen chore separado).

## Coste (estimado)
- 8-10 tareas: `resolveManual`/parseo URL + test; hueco en `GameScene`/`PauseGate` para el presupuesto de ticks; sonda
  `step` en `src/composition/main.ts`; helper `stepTicks`/`stepUntil` en `tests/e2e/probe.ts`; migrar ~8 specs; tag y proyectos
  en `playwright.config.ts`; actualizar AGENTS.md (tabla de comandos) y spec.
- Ficheros: ~4 de `src`, `playwright.config.ts`, `probe.ts`, ~8 specs, spec delta, AGENTS.md. Riesgo medio-bajo.
- Ganancia: menos tiempo en (a) (de 5-60 s de reloj a milisegundos por test) y desaparecen sus flakes por CPU; la pasada
  pesada baja a ~la mitad de los tests. Sin medir aún.

## Riesgos e incógnitas
- Doble modo en producción: `manual` solo con `?e2e`, sin sonda fuera de E2E (spec main-menu).
- Pulsaciones de teclado que se pierden entre `step`s; hay que fijar el orden pulsar -> step.
- `step(n)` grande con oferta a mitad: el bucle se corta y descarta el resto (spec); definir qué devuelve step.
- Que los tests (a) dejen de cubrir la integración con el reloj real: se conservan en (b) smoke, speed y 1 prueba de partida
  completa a velocidad 8.

## Mediciones previas
No aplica objetivo de balance. Útil antes de proponer: tiempo actual de la suite y tasa de fallos con `CI_LIKE=1
--workers=12 --repeat-each=3` frente a `--workers=8` (3 pasadas cada una, mismas semillas); umbral: 0 fallos en 3 pasadas.

## Preguntas para el usuario
1. ¿`manual` excluye `speed` o se combinan?
2. ¿Aceptas que (b) quede en tiempo real y como única pasada CI_LIKE con 8 workers?
3. ¿Retries solo en `CI` (no en `CI_LIKE`)?
4. ¿Cambio SDD ligero (sí) o prefieres separar la parte de config como chore?
