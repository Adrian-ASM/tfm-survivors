# Exploración · 0008-e2e-fast-sim

Intención: derrota E2E de ~78 s a ~10 s y suite < 1 min, acelerando solo en el adaptador de Phaser y sembrando
`localStorage`. Fuera de alcance: atajo "terminar ya" en el núcleo.

## Contexto actual
- Bucle: `src/application/FixedStepLoop.ts` (acumulador, `MAX_FRAME_MS = 250` => máx. 15 ticks/frame, corta el frame
  si `step()` devuelve false: oferta o fin). `TickRun.execute(elapsedMs, input)` (`src/application/TickRun.ts`) lo usa.
  `GameScene.update(_time, deltaMs)` (`src/infrastructure/phaser/GameScene.ts:108`) lee teclado una vez por frame y
  llama `tickRun.execute(deltaMs, move.read())` una vez.
- Arranque: `src/composition/main.ts`. `resolveSeed(search, fallback)` (`src/infrastructure/url/resolveSeed.ts`) valida
  `?seed` con zod, devuelve `warning` (1 `console.warn`). `?e2e` crea `window.__sprint` (probe) en `main.ts:94`.
  Patrón existente a copiar para `?speed`: función pura en `infrastructure/url/` + zod + aviso, la composición decide.
- E2E (`tests/e2e`, 13 tests, ayudas en `probe.ts`: `playChoosingFirst` sondea cada 100-250 ms reales):
  - Derrotas completas (~78 s reales cada una): `results.spec.ts` (seed 42, timeout 160 s),
    `progress.spec.ts` test 1 (seed 42, **2 derrotas** ~2,7 min, timeout 260 s) y test 2 (almacenamiento bloqueado, seed 90, ~75 s).
    Total ~4 derrotas = el grueso de los ~4,2 min.
  - Parciales: `health.spec.ts` (primer golpe, <=80 s), `level-up.spec.ts` (<=120 s), `weapons.spec.ts` (15 s).
  - Cortos: `smoke`, `enemies`, 3 de carga en `progress.spec.ts` (2 s de juego).
- Playwright: `playwright.config.ts` sin `workers` (por defecto), `timeout: 30_000`, `retries: 1` en CI, solo chromium,
  `webServer` = `npm run build && npm run preview`. CI `.github/workflows/ci.yml`: job `e2e` con `timeout-minutes: 10`.
- Specs afectadas: `simulation-loop` (paso fijo, tope, oferta a mitad de frame), `progress-persistence`, `run-results`
  (los E2E validan sus escenarios). Posible spec nueva/delta para `?speed`. ADR-0002 (motor = adaptador).
- Phaser 4.2.1 fijada (ADR-0001); `update(time, delta)` entrega delta suavizado; no se necesita API nueva del motor.

## Opciones
1. **Multiplicar el tiempo en la escena**: `update` llama `execute(deltaMs * N, input)`. Pros: 1 línea. Contras: el tope de
   250 ms/frame (15 ticks) limita N efectivo a ~15x a 60 fps (a 16,7 ms, N<=15) y a menos si el frame es lento;
   tocar el tope en el núcleo rompería la equivalencia y está fuera de alcance. Con N=8 (~10 s) cabe.
2. **N llamadas a `execute(deltaMs, input)` por frame** (bucle en `GameScene.update`, cortando si `status !== 'running'`).
   Pros: cada llamada respeta el tope y `MAX_FRAME_MS`, sin límite práctico de N; mismo camino del jugador; la
   semántica de oferta/fin ya la resuelve `TickRun` (con oferta o fin las llamadas siguientes no hacen nada).
   Contras: el input se lee una vez por frame y se aplica N veces (con input constante equivale; con pulsaciones breves
   el "tick" de la tecla se multiplica); la scene debe renderizar solo una vez por frame.
3. **Acelerar el reloj de Phaser** (`game.loop`/`time.timeScale` o forzar `fps`). Pros: sin tocar `update`. Contras:
   afecta a tweens/render, depende del motor, no mantiene la unidad "ticks por frame" ni da garantías de tope.

Siembra de `localStorage` (independiente): los tests de carga ya usan `addInitScript` (`seedStorage` en `progress.spec.ts`).
El test 1 de `progress.spec.ts` necesita 2 derrotas reales para validar el bucle export -> recarga -> import: con `?speed`
(~10 s cada una) puede mantenerse jugándolas; sembrar solo se justifica donde la derrota no es el objeto de la prueba
(p. ej. rechazos de import, que hoy cuelgan de una partida terminada).

## Riesgos e incógnitas
- `?speed` en producción: es una entrada externa. Si se queda siempre activo, un jugador puede acelerar su partida y
  guardar récords/historial (`progress` + export) con tiempos alterados. Variantes: (a) solo con `?e2e` (ya existe la
  guarda del probe), (b) `import.meta.env.DEV`/modo de build (pero los E2E corren contra `vite preview` de producción),
  (c) siempre activo, documentado como inocuo en un juego local-first sin ranking (ADR-0004). Recomiendo (a).
- Validación (regla 6): zod, entero 1..N_max (p. ej. 1..32), inválido => `warning` único y velocidad 1, como `?seed`;
  los E2E con `collect(['error','warning'])` fallarían ante cualquier aviso inesperado.
- Equivalencia: el resultado (tick de derrota, snapshot) depende de cuándo se abre una oferta y se descartan ticks del
  frame. Hoy ya varía con la tasa de frames; con speed N cambia el patrón de descarte => semilla 90 (tope 4.560 ticks,
  `balance.test.ts`) y `health.spec` pueden no coincidir. Los E2E no deberían fijar el tick exacto de la derrota.
- Aserciones por reloj real (`<=80 s`, `<=15 s`, `expect.poll` 10 s) y `intervalMs` de `playChoosingFirst`: con speed,
  los ticks avanzan N veces más rápido entre sondeos; una oferta/derrota puede pasar entre dos lecturas (la derrota
  es estable, la oferta congela la simulación, así que no se pierde). Revisar los umbrales por ticks, no por segundos.
- Headless con WebGL por software: el frame puede ser lento; N ticks por frame alarga el frame (coste CPU del núcleo
  x N). `npm run bench` da ms/tick: dato necesario para elegir N.
- `workers`: el estado vive en navegador/`localStorage` por contexto; paralelizar es seguro, pero el CI gratuito tiene
  2 núcleos y los workers compiten con WebGL por software. Medir antes de fijarlo.
- Incógnita: ¿5 derrotas a ~10 s + resto bastan para < 1 min? (hoy 2 s de juego en 5 tests, 15 s en `weapons`).

## Mediciones previas (sí, antes de la propuesta; las lanza el orquestador)
1. Tiempo por test de la suite actual (`npx playwright test --reporter=list`, 1 worker): confirmar el reparto de los ~4,2 min.
2. `npm run bench`: ms/tick del núcleo a final de partida (enemigos al máximo), para fijar N máximo sin que un frame
   supere ~16 ms de simulación x N en CI.
3. Prototipo desechable de la opción 2 (N = 4, 8, 15) con seed 42 y 90: tiempo real de derrota, y si el tick de derrota
   y la oferta coinciden con speed 1 (umbral: derrota <= 12 s y suite < 1 min con 1-2 workers en local; en CI <= 90 s).
4. `workers: 1` vs `2` en CI-like (local `CI=1`): tiempo y estabilidad (sin retries).

## Preguntas para el usuario
- ¿`?speed` solo con `?e2e` (recomendado) o siempre disponible?
- ¿Se mantienen las 2 derrotas reales del bucle export/import (más fieles) o se siembra la 1.ª con `localStorage`?
- ¿Objetivo de CI: < 1 min en local o también en GitHub Actions (y bajar `timeout-minutes` de 10)?
- ¿Hay que reflejar `?speed` en la spec `simulation-loop` o como spec nueva de tooling?
