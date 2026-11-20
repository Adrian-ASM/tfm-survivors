# Design · 0008-e2e-fast-sim

## Resumen
`?e2e&speed=N` se valida con zod en `infrastructure/url/resolveSpeed.ts` (mismo patrón que `resolveSeed`). La
composición pasa la velocidad ya resuelta a `GameScene`, que en cada frame llama N veces a
`TickRun.execute(deltaMs, input)` mediante una función pura del adaptador (`advanceFrame`). El bucle se corta en
cuanto la partida deja de estar en curso y se pinta una sola vez. El núcleo (`domain`, `application`) no cambia.
Los E2E usan `speed=8` donde juegan hasta un evento lejano, y siembran el progreso con un builder que usa el
codec de producción.

## Piezas por capa
| Capa | Pieza | Nueva/Mod. | Notas |
|---|---|---|---|
| domain | — | — | Intacto (criterio de éxito). |
| application | — | — | Intacto. `TickRun`, `FixedStepLoop` y `MAX_FRAME_MS` no cambian. |
| infrastructure | `url/resolveSpeed.ts` | Nueva | `resolveSpeed(search): { speed; warning? }`, función pura con zod. Detalle abajo. |
| infrastructure | `phaser/advanceFrame.ts` | Nueva | `advanceFrame(run: TickRun, elapsedMs, input, speed): RunSnapshot`. Sin import de Phaser, así que se prueba en Node. |
| infrastructure | `phaser/GameScene.ts` | Mod. | 6.º parámetro opcional `simSpeed = 1`. `update` llama a `advanceFrame(...)` en vez de `execute(...)`. Sigue sin reglas de juego. |
| composition | `main.ts` | Mod. | `resolveSpeed(location.search)`, 1 `console.warn` si hay aviso y `simSpeed` a `GameScene`. El probe expone `speed` (solo lectura). |
| tests/e2e | `progressFixtures.ts` | Nueva | Builder del progreso sembrado (ver "Siembra"). |
| tests/e2e | `probe.ts` y `*.spec.ts` | Mod. | `E2E_SPEED = 8`, `gameUrl({ seed, speed })`, umbrales en ticks y siembra. |
| tooling | `playwright.config.ts`, `ci.yml` | Mod. | `workers: 2`, `fullyParallel: true` y `timeout-minutes` del job `e2e` de 10 a 6. |

### `resolveSpeed` (infrastructure/url)
- Sin `e2e` en la query, devuelve `{ speed: 1 }` **sin aviso**, aunque venga `speed`. La guarda vive aquí y no en
  la composición, para poder probarla en Node, igual que `resolveSeed`.
- Con `e2e`:
  - si falta `speed`, devuelve 1 sin aviso;
  - si `speed` cumple `^\d+$` y está en `1..MAX_SIM_SPEED` (15), devuelve ese valor;
  - en cualquier otro caso (`0`, `16`, `abc`, `2.5`, vacío) devuelve 1 y un `warning` que menciona `speed`, con el
    valor crudo truncado a 32 caracteres y pasado por `JSON.stringify`, igual que `seed`.
- `MAX_SIM_SPEED = 15` es una constante con nombre en el propio fichero. Es configuración de pruebas, no contenido
  de juego, así que no va a `content/*.json`. Con la opción de N llamadas, el tope del acumulador no limita N: cada
  llamada respeta los 250 ms por su cuenta. El 15 lo fija la propuesta para acotar el coste por frame.
- No escribe en consola: decide la composición (regla 6, el mismo contrato que `resolveSeed`).

### `advanceFrame` (infrastructure/phaser)
```ts
let snap = run.execute(elapsedMs, input);
for (let i = 1; i < speed && run.status === 'running'; i += 1) snap = run.execute(elapsedMs, input);
return snap;
```
- Con `speed = 1` hace exactamente 1 llamada, como hoy, así que el jugador no nota ningún cambio.
- El tope de 250 ms se aplica **a cada avance**: cada `execute` pasa por `FixedStepLoop.advance`, que recorta su
  `elapsedMs`. Un frame congelado de 5.000 ms a `speed=15` da 15 avances × 15 ticks = **225 ticks** (escenario
  "Velocidad máxima con frame congelado"). 250 / 16,667 = 15 con `EPSILON_MS`, y el acumulador queda a ≈ 0 tras
  cada avance.
- Con un frame de 8,334 ms a `speed=8`, los avances pares ejecutan 1 tick: 4 ticks en total. Tras una oferta en el
  3.er tick, el acumulador queda a 0 (`FixedStepLoop` lo resetea) y las llamadas siguientes no se hacen.
- Corta el bucle en cuanto hay una oferta o la partida termina. Las llamadas restantes no harían nada (`TickRun`
  ya resetea el acumulador), pero cortarlas ahorra snapshots.
- Por qué el resultado es idéntico con cualquier N: el estado tras k ticks depende solo de la semilla, del input de
  cada tick y de las elecciones (spec "Determinismo"). Que los ticks se agrupen en frames de una forma u otra, o que
  se descarten ticks cuando se abre una oferta, solo mueve el tiempo **real**; los ticks siguen siendo los mismos.
  Con input constante y la política de elección fija, el resultado no depende de N. No es casualidad del prototipo.
  Única salvedad: el input se lee una vez por frame y se aplica N veces, aceptado solo en modo E2E.

### `GameScene`
- El orden de `update` no cambia: R → elección → avance → `render` (una vez por frame).
- Tras R, `advanceFrame` usa el `tickRun` de la partida nueva. Con `speed=8`, el primer frame de esa partida hace
  8 ticks en vez de 1. El escenario "Primer frame de la partida nueva" vale para `speed=1`, que es el modo de
  jugador.
- No se crean objetos del motor por frame.

## Flujo (un frame con `?e2e&speed=8`)
1. Phaser llama a `update(time, deltaMs)`. `deltaMs` es "smoothed and capped", según
   [Scene#update](https://phaser.io/oss/docs/api-documentation/class/scene.md#instance-updatetime-delta).
2. Se leen R y la elección (sin cambios) y `move.read()` una vez.
3. `advanceFrame(tickRun, deltaMs, input, 8)` hace hasta 8 llamadas a `execute`, cada una con su tope de 250 ms y
   el corte por oferta o fin.
4. `render(snapshot)` una vez: capas, HUD, overlays, `progress.sync` (guarda en el frame del fin) y `onRender`
   (probe).

Vía de consulta: MCP `phaser-docs` (API `Scene#update`, `delta` suavizado). No hace falta ninguna API nueva del motor.

## Siembra de `localStorage` (tests/e2e)
- `tests/e2e/progressFixtures.ts`:
  - **construye** el texto con `encodeProgress` de `src/infrastructure/progress/progressCodec.ts`;
  - **lo comprueba** con `decodeProgress` y lanza si no es `ok`.
  Así los fixtures no pueden desincronizarse del esquema zod de 0007: si el esquema cambia, el builder falla al
  cargar el test, no a mitad de partida. Los tests ya importan `src/**` (unitarios); en E2E corre en Node, el lado
  de Playwright, y no entra en el bundle.
- API:
  - `progressText({ records, history })`, con entradas del dominio (`outcome: 'won' | 'lost'`);
  - `seedProgress(page, text)`, un `addInitScript` **de un solo uso por pestaña**, con guarda en `sessionStorage`
    (`addInitScript` se repite en cada `reload`; sin la guarda, la recarga volvería a sembrar y ocultaría lo
    guardado).
- `VALID_V1` y los casos "dañado" y "versión futura" se derivan del builder, salvo el JSON truncado, que es un
  literal a propósito.

### Bucle export / import con 1 sola derrota
Importar exige el overlay de resultados, así que el orden literal "exporta → recarga → importa" necesita 2 partidas
terminadas. El flujo nuevo es este:
1. Siembra de P0 (1 entrada; récords elegidos para que el máximo campo a campo sea comprobable).
2. `?e2e&seed=42&speed=8` y derrota acelerada (la única).
3. Panel con `max(P0, partida)` y 2 entradas.
4. Exportar: fichero igual al guardado. 60 frames después, el snapshot no ha cambiado.
5. Importar el fichero **exportado**: idempotente, mensaje de éxito y nada cambia.
6. Importar un fichero F del builder con un récord mayor: fusión por máximo.
7. Rechazos (`hola`, 64 KiB + 1).
8. CSP sin violaciones.
9. R: partida nueva y panel oculto.
10. **Recarga**: el progreso cargado coincide con el fusionado, y otra vez CSP sin violaciones.

`__cspViolations` se reinicia en cada carga: se comprueba antes y después de recargar. El escenario "Sin violaciones
en el bucle completo" queda reformulado en el delta de `progress-persistence` con este flujo.

Fixtures fijos del bucle. Cada récord fusionado sale de una fuente distinta, así la fusión por máximo se comprueba
campo a campo:

| Documento | Récords (tiempo, nivel, bajas) | Historial |
|---|---|---|
| P0 | (300, 2, 10) | 1 entrada: `playedAt` 1763596800000, seed 7, `lost`, 300 s, nivel 2, 10 bajas |
| F | (60, 20, 5) | **1 entrada**: `playedAt` 1763683200000, seed 123, `lost`, 60 s, nivel 20, 5 bajas |

- La partida jugada (seed 42, unos 78 s, nivel 3, 77 bajas) aporta el máximo de bajas.
- El fichero exportado (P0 + partida) no añade entradas.
- Tras recargar: récords (300, 20, bajas de la partida) y **exactamente 3 entradas** (partida, F, P0, por
  `playedAt` descendente; la partida tiene la fecha del reloj del sistema, posterior a las dos).

### Umbrales de los E2E
Los E2E esperan por **ticks** del snapshot; ninguno compara ticks con reloj real. Se confirma leyendo los specs:
`tick ≤ 120·60`, `≤ 80·60`, `≤ 60·60`, `waitTicks`, y la oferta y el fin congelan la simulación, así que no se
pierden entre sondeos. Ajustes:
- Tras R, `fresh.tick ≤ 60` pasa a `≤ 60·E2E_SPEED`: entre la pulsación y la lectura pasan varios frames de 8
  ticks. Sigue distinguiendo la partida nueva de la terminada (tick ≥ 4.500).
- `setTimeout` y los plazos de `playChoosingFirst` bajan de 130–260 s a ≤ 60 s en los tests acelerados. Son un
  margen de reloj, no la aserción.
- Por test:

  | Test | Seed | Speed | Siembra |
  |---|---|---|---|
  | `results.spec` | 42 | 8 | No |
  | almacenamiento bloqueado | 90 | 8 | No (el almacenamiento está bloqueado) |
  | `health.spec` | 42 | 8 | No |
  | `level-up.spec` | 7 | 8 | No |
  | `weapons`, `smoke`, `enemies`, carga | — | 1 | Solo en los de carga |

  `weapons`, `smoke`, `enemies` y los de carga siguen a `speed=1`: son cortos y `weapons` detecta bajas comparando
  sondeos.
- E2E nuevo, `tests/e2e/speed.spec.ts`, sin partidas largas:
  - `?e2e&seed=abc&speed=abc` da 1 aviso de `seed`, 1 de `speed` y `probe.speed === 1`;
  - `?e2e&speed=8` da `probe.speed === 8`, sin avisos;
  - `?speed=abc`, sin `?e2e`, no da ningún aviso.
- "Velocidad ignorada fuera de E2E" (1 tick por frame) se cubre en Node, con `resolveSpeed` (→ 1) y
  `advanceFrame` a velocidad 1. Sin `?e2e` no hay probe.
- La velocidad se resuelve una vez en `bootstrap` y es constante de la escena; R no relee la URL. "La velocidad se
  mantiene al reiniciar" y "Reinicio tras una velocidad inválida" se prueban en Node con
  `RestartRun` + `advanceFrame`. En el navegador, `results.spec` comprueba `probe.speed === 8` tras R.
- Cada test acelerado comprueba `probe.speed === 8`. Si alguien quita el parámetro, el test fallará en vez de
  volverse lento en silencio.

### Workers y CI
- `workers: 2` y `fullyParallel: true`, fijos en local y en CI. Los tests son independientes: cada uno tiene su
  contexto y su `localStorage`. Medido en local con `CI=1`: 47 s con 2 workers frente a 68 s con 1. Con 1 worker,
  < 60 s quedaría muy justo incluso con la siembra. `fullyParallel` reparte los 6 tests de `progress.spec`.
- `retries: 1` en CI no cambia.
- `timeout-minutes: 6` en el job `e2e`:
  - margen: `npm ci` + `playwright install --with-deps` ≈ 1–2 min, build ≈ 0,5 min, suite ≤ 2 min con WebGL por
    software y el reintento de un test;
  - solo se mide; la duración va al verify-report.

## Dependencias nuevas
| Paquete | Versión exacta | Motivo | Alternativa descartada |
|---|---|---|---|
| — | — | Ninguna: zod y Playwright ya están. | — |

## Rendimiento y seguridad
- **Coste por frame**:
  - con N = 8, unos 8 × 0,126 ms ≈ 1 ms de media (p99 ≈ 2 ms), más 8 snapshots (`execute` siempre devuelve uno; el
    núcleo no se toca). En el peor caso, N = 15, unos 4 ms de 16,7;
  - medido: 60 FPS.
  - Modo jugador (`speed=1`): coste idéntico al actual.
- **Bundle**: +1 función pequeña y un esquema zod (≈ < 1 KB).
- **Entrada externa**: `?speed` se valida con zod (regla 6) y solo se lee con `?e2e`, que ya es público (probe).
- **Datos persistidos**: sin formato nuevo.
  - Acelerar no altera récords ni historial: `timeSeconds = tick / 60` sale de ticks, no de reloj, y el resultado
    es idéntico con cualquier N.
  - Un jugador con `?e2e&speed=15` no obtiene ventaja: solo juega más difícil.
  - Los fixtures sembrados son de test y no se publican.

## ADRs
- Ninguno. Es reversible con un cambio local: un parámetro de la escena y una función de URL. Es coherente con
  ADR-0002 (el motor es un adaptador) y ADR-0004 (sin backend).

## Riesgos
- **Escenario E2E "Sin violaciones en el bucle completo"**: resuelto con el delta de `progress-persistence` (P0 →
  1 derrota → exportar → importar el exportado y F → recargar). F trae 1 entrada, así que el historial final tiene
  exactamente 3 entradas.
- **Duración de los tests de equivalencia en Node**: la seed 7 con input (1, 0) puede llegar a 36.000 ticks; dos
  partidas cuestan unos 10 s. Necesitan un `timeout` propio por `it`, por debajo del `testTimeout` de 20 s.
  "Snapshots iguales tick a tick" exige parar exactamente en el tick 1.200: el driver del test baja la velocidad
  del último frame a `min(8, 1200 − tick)`.
- **CI con 2 workers y WebGL por software**: frames lentos alargan el tiempo real, pero no cambian el resultado.
  Si aparecen reintentos en CI, `workers: process.env.CI ? 1 : 2`.
- **Partida nueva tras R a `speed=8`**: las aserciones `kills: 0` y `xp: 0` dependen de que se lea antes de la
  primera baja (≥ ~70 ticks, que es lo que tarda un enemigo en llegar al radio de `tests`). Si fallan en apply, se
  comprueban con el primer snapshot en curso que tenga `tick < ended.tick`.
- Dependencia de las semillas 42 y 90 (deuda `0007 · S2`); sin cambio en este change.
