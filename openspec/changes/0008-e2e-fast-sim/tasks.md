# Tasks · 0008-e2e-fast-sim

<!-- Cada tarea ≤ ~30 min, con test asociado y referencia al escenario. Orden: dominio → aplicación →
     infraestructura → composición → E2E → docs. El implementer marca [x] y hace un commit por tarea.
     Specs delta: simulation-loop (SL) y progress-persistence (PP). -->

## 1. Dominio
Sin tareas: `src/domain` no cambia (criterio de éxito de la propuesta).

## 2. Aplicación
Sin tareas: `src/application` no cambia (`TickRun`, `FixedStepLoop` y `MAX_FRAME_MS` intactos).

## 3. Infraestructura y composición
- [x] 3.1 `src/infrastructure/url/resolveSpeed.ts`
  - Qué hace: zod `^\d+$` → entero en `1..MAX_SIM_SPEED` (15), sin efecto sin `e2e` y con aviso truncado a 32
    caracteres.
  - Test: `tests/infrastructure/speed.test.ts`, en rojo porque el módulo no existe.
  - Escenarios SL:
    - "Velocidad válida en modo E2E";
    - "Límites del rango";
    - "Velocidad inválida en modo E2E" (`0`, `16`, `-1`, `2.5`, `abc` y vacío: 1 aviso que menciona `speed`);
    - "Sin velocidad en modo E2E";
    - "Velocidad ignorada fuera de E2E", parte de resolución (`?speed=8` y `?seed=42&speed=8` → 1, sin aviso);
    - "Velocidad inválida ignorada fuera de E2E".
- [x] 3.2 `src/infrastructure/phaser/advanceFrame.ts`, el bucle de N `execute` con corte, y
  `tests/support/frameDriver.ts`.
  - El driver es un harness de Node: frames de duración dada, política de elección fija con `ChooseUpgrade` y
    velocidad del último frame `min(N, objetivo − tick)`.
  - Tests:
    - `tests/infrastructure/advance-frame.test.ts`, en rojo porque el módulo no existe;
    - `tests/infrastructure/speed-equivalence.test.ts`, con `timeout` propio por `it` (≤ 20 s).
  - Incluye la equivalencia: pasa en verde en cuanto pasa el avance, por eso va en la misma tarea.
  - Escenarios SL:
    - avance:
      - "Un frame de 1/60 s a velocidad 8";
      - "Monitor de 120 Hz a velocidad 8";
      - "Velocidad máxima con frame congelado" (225 ticks: tope de 250 ms por avance);
      - "Tiempo negativo o no numérico a velocidad 8";
      - "Velocidad 1 sin cambios" (`execute` directo frente a `advanceFrame(…, 1)`);
      - "Input único por frame";
    - corte:
      - "Oferta a mitad de frame acelerado";
      - "Fin de partida a mitad de frame acelerado";
      - "Frames durante la elección a velocidad 15";
      - "Frames con la partida terminada a velocidad 15";
    - reinicio con `RestartRun` + `advanceFrame`:
      - "La velocidad se mantiene al reiniciar" (tick 8);
      - "Reinicio tras una velocidad inválida" (1 tick por frame tras 3 R);
    - equivalencia:
      - "Derrota equivalente con la semilla 42" (velocidades 1, 4, 8 y 15);
      - "… con la semilla 90";
      - "Equivalencia con frames irregulares" (seed 7, input (1, 0));
      - "Snapshots iguales tick a tick" (tick 1.200).
  - Si alguna equivalencia sale en rojo, el design está mal: parar y avisar al orquestador.
- [ ] 3.3 Conexión con la escena y la composición:
  - `GameScene`: 6.º parámetro `simSpeed = 1` y `update` con `advanceFrame`;
  - `main.ts`: `resolveSpeed` una sola vez en `bootstrap`, `console.warn` del aviso y `speed` en el probe;
  - `probe.ts`: campo `speed` en la vista del probe.
  - Test: `tests/e2e/speed.spec.ts`, en rojo porque `probe.speed` no existe y no hay aviso de `speed`.
  - Escenarios SL:
    - "Velocidad válida en modo E2E" (`probe.speed` 8, sin avisos);
    - "Avisos independientes de seed y speed" (`?e2e&seed=abc&speed=abc`: 1 aviso de cada uno);
    - "Velocidad inválida ignorada fuera de E2E" (`?speed=abc` sin `e2e`: 0 avisos).
  - `npm run verify`: el guardarraíl confirma que no se toca `src/domain` ni `src/application`.

## 4. E2E, tooling y documentación
- [ ] 4.1 `tests/e2e/progressFixtures.ts`:
  - `progressText({ records, history })` con `encodeProgress` y comprobación con `decodeProgress`; lanza si no es
    `ok`;
  - `seedProgress(page, text)`, de un solo uso por pestaña con guarda en `sessionStorage`;
  - fixtures `P0` y `F` del design.
  - Test: `tests/infrastructure/progress-fixtures.test.ts` (Vitest; importa solo `progressText` y los fixtures, no
    Playwright). En rojo porque el módulo no existe.
  - Qué comprueba: P0 y F se decodifican igual campo a campo, una entrada con `level` 0 hace lanzar al builder y F
    tiene exactamente 1 entrada.
  - Escenario PP: "Sin violaciones en el bucle completo", parte GIVEN (P0 válido con 1 entrada).
  - Ojo: si Vitest no puede importar el fichero porque importa `@playwright/test`, separar `seedProgress` en
    `probe.ts`.
- [ ] 4.2 `probe.ts`: `E2E_SPEED = 8`, `gameUrl({ seed, speed })` y `expectSpeed(page, n)`. Migrar a
  `speed=8` `results.spec`, `health.spec` y `level-up.spec`.
  - Umbrales en ticks; tras R, `≤ 60 · E2E_SPEED`; `setTimeout` y plazos de `playChoosingFirst` ≤ 60 s.
  - En rojo con la aserción nueva de `results.spec`: la derrota tarda ≤ 12 s reales (`Date.now()` en el test, que
    es Node y no el núcleo). Hoy son unos 78 s.
  - `results.spec` comprueba `probe.speed === 8` tras R.
  - Escenarios: SL "La velocidad se mantiene al reiniciar" (en el navegador) y los de `run-results`,
    `player-health` y `upgrades` que esos E2E ya cubrían, sin cambio de comportamiento.
  - Si `kills: 0` / `xp: 0` tras R fallan, aplicar la mitigación del design (Riesgos).
- [ ] 4.3 Reescribir `progress.spec.ts`:
  - **Bucle**: P0 sembrado → `?e2e&seed=42&speed=8` → 1 derrota → exportar (2 entradas, igual al guardado) →
    60 frames sin cambios → importar el exportado (sin cambios y mensaje de éxito) → importar F (récords
    (300, 20, bajas)) → rechazos (`hola` y 64 KiB + 1) → CSP sin violaciones → R → recargar → progreso cargado igual
    al fusionado con **exactamente 3 entradas** y CSP sin violaciones en la 2.ª carga.
  - **Almacenamiento bloqueado** con seed 90 y `speed=8`.
  - **Tests de carga**: `VALID_V1` y la versión futura salen de `progressText`.
  - Test en rojo: la aserción de 3 entradas tras recargar (hoy el test no siembra P0 ni importa F).
  - Escenarios PP:
    - "Sin violaciones en el bucle completo" (delta);
    - "Almacenamiento bloqueado";
    - "Datos guardados dañados";
    - "Versión futura guardada";
    - "Partida sin terminar".
- [ ] 4.4 Tooling:
  - `playwright.config.ts` con `workers: 2` y `fullyParallel: true`;
  - `ci.yml` con `timeout-minutes: 6` en el job `e2e`.
  - Es una medición, no un test unitario: `npx playwright test --reporter=list` en local con `CI=1`, toda la suite
    en verde, sin reintentos y en < 60 s. Anotar tiempos por test para el verify-report.
  - Criterio de éxito de la propuesta: "Suite E2E completa en local < 60 s".
- [ ] 4.5 Documentación, sin test:
  - `docs/gdd.md`: marcar saldada la deuda `0007 · E2E`;
  - `AGENTS.md` §1: estado del proyecto con el modo `?e2e&speed`;
  - entrada en `docs/ai-log/` con las mediciones (prototipo, suite antes y después, workers).
