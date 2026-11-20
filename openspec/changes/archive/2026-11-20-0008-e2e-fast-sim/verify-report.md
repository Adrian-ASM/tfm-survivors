# Verify report · 0008-e2e-fast-sim

Verificador independiente. Rama `change/0008-e2e-fast-sim`, 9 commits sobre `main`. No se ha modificado código.

## Resultados de ejecución

| Comprobación | Resultado |
|---|---|
| `npm run verify` (lint + typecheck + guard:all + vitest) | Verde: 95 ficheros, 1083 tests, guardarraíl con 414 ficheros revisados |
| `npm run test:e2e` | 16/16 en verde, 38,4 s con 2 workers, sin reintentos (en local `retries` es 0) |
| Derrota a speed 8 (`results.spec`) | La aserción `≤ 12 s` con reloj de Node pasa. El implementador midió 9,9 s |
| Suite local < 60 s | Cumple con `workers: 2` (38,4 s). Con 1 worker no cumple, según el implementador |
| `src/domain`, `src/application`, `content` | `git diff --stat main..HEAD` vacío: sin tocar |
| `?speed` sin `?e2e` | `resolveSpeed` devuelve 1 sin aviso. Test unitario y E2E (`speed.spec`) |
| Validación zod de `?speed` | `z.string().regex(/^\d+$/).transform(Number).pipe(int 1..15)`. Aviso truncado a 32 caracteres |
| Reglas AGENTS.md §3 | Sin imports prohibidos. `Date.now` solo en tests E2E (Node), no en domain ni application. Sin `Math.random` |
| AGENTS.md §6 | Sin secretos ni dependencias nuevas |
| Tareas | 3.1 a 4.5 marcadas, un commit por tarea (8 commits más el de docs SDD) |

## Escenario → Test → Estado

| Escenario | Test | Estado |
|---|---|---|
| SL Velocidad válida en modo E2E | `speed.test.ts` y `speed.spec.ts` (probe.speed 8, 0 avisos) | OK |
| SL Límites del rango | `speed.test.ts` (it.each 1 y 15) | OK |
| SL Velocidad inválida en modo E2E | `speed.test.ts` (it.each de los 6 valores, 1 aviso) | OK, solo unitario (ver S1) |
| SL Sin velocidad en modo E2E | `speed.test.ts` | OK |
| SL Velocidad ignorada fuera de E2E | `speed.test.ts` (resolución a 1). El tick único sale de `advanceFrame(…, 1)` | OK parcial (ver S2) |
| SL Velocidad inválida ignorada fuera de E2E | `speed.test.ts` y `speed.spec.ts` (`?speed=abc`, 0 avisos) | OK |
| SL Avisos independientes de seed y speed | `speed.spec.ts` | OK |
| SL La velocidad se mantiene al reiniciar | `advance-frame.test.ts` (tick 8) y `results.spec` (`probe.speed` tras R) | OK |
| SL Reinicio tras una velocidad inválida | `advance-frame.test.ts` | OK |
| SL Un frame de 1/60 s a velocidad 8 | `advance-frame.test.ts` | OK |
| SL Monitor de 120 Hz a velocidad 8 | `advance-frame.test.ts` | OK |
| SL Velocidad máxima con frame congelado | `advance-frame.test.ts` (225 ticks) | OK |
| SL Tiempo negativo o no numérico | `advance-frame.test.ts` (it.each −10 y NaN) | OK |
| SL Velocidad 1 sin cambios | `advance-frame.test.ts` (600 frames, snapshots iguales) | OK |
| SL Oferta a mitad de frame acelerado | `advance-frame.test.ts` | OK |
| SL Fin de partida a mitad de frame | `advance-frame.test.ts` | OK |
| SL Frames durante la elección a velocidad 15 | `advance-frame.test.ts` | OK |
| SL Frames con la partida terminada a velocidad 15 | `advance-frame.test.ts` | OK |
| SL Input único por frame | `advance-frame.test.ts` | OK |
| SL Derrota equivalente semilla 42 (1, 4, 8, 15) | `speed-equivalence.test.ts` | OK |
| SL Derrota equivalente semilla 90 | `speed-equivalence.test.ts` | OK |
| SL Equivalencia con frames irregulares | `speed-equivalence.test.ts` | OK |
| SL Snapshots iguales tick a tick | `speed-equivalence.test.ts` | OK |
| PP Sin violaciones en el bucle completo | `progress.spec.ts` (P0 sembrado, 1 derrota, export, import, F, rechazos, CSP en 2 cargas, 3 entradas) y `progress-fixtures.test.ts` | OK |
| PP CSP presente y restrictiva | Sin cambios; la cubre `smoke.spec` | OK |

## Hallazgos

### Critical
Ninguno.

### Warning
- **W1 · La tarea 4.3 no tuvo un rojo propio.** Lo declara el implementador. La aserción de "exactamente 3 entradas tras
  recargar" no se vio fallar antes de implementarse, así que no hay evidencia de que el test detecte la regresión que
  protege. Hay que registrarlo como deuda de proceso TDD. El test sí comprueba el comportamiento: `toHaveLength(3)` y
  `toEqual(expectedHistory)`.
- **W2 · Un commit entró con un error de `tsc`.** Lo causó la tarea 4.1; se enmendó en local y el historial final es
  limpio. Es deuda real de tooling, no de este código. `.husky/pre-commit` ejecuta lint-staged y guard, pero no
  `typecheck`, así que el error solo lo habría cazado el CI (`verify`). La corrección razonable es añadir
  `tsc --noEmit` al pre-commit o a un pre-push, o registrarla en `docs/gdd.md` como deuda. Ahora solo está en el diario
  de IA, no en el registro de deuda.
- **W3 · El criterio "< 60 s" depende de `workers: 2`.** Con 1 worker pasa de 60 s y la derrota de 9,9 s deja poco margen
  frente al tope de 12 s. En una máquina más lenta o en CI con CPU compartida puede dar flakiness. `retries: 1` en CI lo
  mitiga, pero lo enmascara. El tope de 6 min del job sí tiene holgura.

### Suggestion
- **S1 · Sin cobertura E2E de `?e2e&speed=<inválido>` solo.** La combinación `?e2e&speed=abc` sin seed inválido solo se
  comprueba en unitario. El E2E de "Avisos independientes" la cubre de forma indirecta.
- **S2 · "Velocidad ignorada fuera de E2E" no se prueba de extremo a extremo con 1 tick.** Se deduce de `resolveSpeed` más
  `advanceFrame(…, 1)`. Se podría añadir un E2E con `?speed=8` que compruebe que el tick avanza a ritmo normal. No es
  bloqueante.
- **S3 · `Date.now()` en `results.spec` y `progress.spec`.** Es legítimo, porque corre en Node y no en el núcleo, pero
  conviene que el guardarraíl no lo confunda en el futuro.
- **S4 · `MAX_SIM_SPEED` y `E2E_SPEED`.** Son configuración de pruebas y están bien ubicados. La spec dice 15 y el código
  también; si se mueve de sitio, enlazarlos en un comentario.

## Recuento

C: 0 · W: 3 · S: 4

## Veredicto

Cumple spec, design y criterios de éxito: verify y E2E en verde y núcleo intacto. Apto para archivar tras el gate humano,
registrando W2 (typecheck en pre-commit) y W1 como deuda.
