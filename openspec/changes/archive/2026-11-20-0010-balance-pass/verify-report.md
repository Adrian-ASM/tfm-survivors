# Verify report · 0010-balance-pass

## Ejecución
- `npm run verify`: lint, typecheck, guard:all (467 ficheros) y Vitest en verde (102 ficheros, 1169 tests).
- `npm run test:e2e`: no relanzado. El implementer informa de 48 passed. Los E2E cambiados solo sustituyen la
  semilla (42) y añaden un `expect` de tick. Confirmado por lectura del diff.
- `src/`: sin cambios en `origin/main..HEAD` (`git diff --stat -- src` vacío).

## Escenario → Test → Estado
| Escenario | Test | Estado |
|---|---|---|
| Elige por prioridad, no por posición | `policies.test.ts` pickByPriority | OK |
| La prioridad más alta gana | `policies.test.ts` | OK |
| Ningún id priorizado en la oferta | `policies.test.ts` | OK |
| Oferta de una sola opción | `policies.test.ts` | OK |
| Huida sin amenazas / de un enemigo / Enemigo fuera de rango | `policies.test.ts` fleeInput | OK |
| Bot reproducible | `balance.test.ts` (semilla 7 x2) | OK |
| Sin semillas sueltas de balance | Sin test; grep de WIN_SEED, FAST_DEFEAT_SEED, semillas 2 y 90 en `tests/`: limpio (el `seed: 2` de `progress.test.ts` es historial, no balance) | OK (ver W1) |
| Contenido de los tests igual al del juego | `content.test.ts` (toEqual loadRunConfig/aDefaultConfig) | OK |
| Derrota E2E con una semilla del conjunto | `progress.spec.ts` (42, tick ≤ STILL_LIMIT_TICKS) y `menu-progress.spec.ts` | OK (E2E no relanzado) |
| Tasa de victoria del bot de referencia | `balance.test.ts` (25..35; mensaje con el nº; mide 30/50) | OK |
| Toda partida del bot termina | `balance.test.ts` | OK |
| Jugador quieto pierde con todas las semillas | `balance.test.ts` stillSurvivors(1..50) = [] | OK |
| Muerte quieta en el límite de 180 s | `balance.test.ts` con LONG_RUN_HEALTH devuelve [7] | OK |
| Derrota equivalente con otra semilla del conjunto | `speed-equivalence.test.ts` (7, velocidades 1 y 8, lost, tick < 10.800) | OK |
| Resto de escenarios de simulation-loop | Sin cambios | OK |

## Contraste con design y tasks
- `content/waves.json` y `DEFAULT_WAVES` coinciden: `[1, 2, 2.5, 4, 5.6]`. Monótono, y lo cubren el test de
  igualdad y "Oleadas que crecen".
- Sin números mágicos: `WIN_BAND`, `STILL_LIMIT_TICKS`, `TEN_MINUTES`, `BOT_BATCH_TIMEOUT_MS` y
  `STILL_DEFEAT_SEED` están nombradas. El factor 0,8 no aparece en el código.
- El conjunto `BALANCE_SEEDS` 1..50 se importa desde los E2E. No quedan dependencias de las semillas 2 y 90.
- Las tareas 1.1 a 4.1 están marcadas, cada una con su commit (1d9838e, ea71e31, 72aaae1, a51f125, b64009c,
  6b624ce) más 872a259 del plan.
- Los 7 commits llevan `refs: 0010-balance-pass`, `Assisted-by` y `Co-Authored-By`.
- Reglas de arquitectura: sin `src/` tocado y sin dependencias nuevas; guard:all en verde.
- Los helpers no usan `Math.random`; el bot es determinista (comprobado por el test).

## Hallazgos
### Critical
Ninguno.

### Warning
- W1. "Sin semillas sueltas de balance" no tiene test automático: solo se comprobó por grep, y nada impide
  reintroducir una semilla suelta. Registrarlo como deuda o aceptarlo expresamente al archivar. El design ya
  lo declara así.
- W2. Margen de la tasa: 30/50 con banda 25..35, con ruido de ±3-4 entre factores contiguos. El test es
  frágil ante cualquier ajuste de contenido (previsto en el proposal). Quedó constancia en el design.

### Suggestion
- S1. El comentario sobre `STILL_DEFEAT_SEED` en `progress.spec.ts` queda como bloque suelto sin constante
  debajo. Moverlo al `import` o al test lo haría más claro.
- S2. En `menu-progress.spec.ts` el import de `balanceSeeds` va tras un comentario y fuera del orden del resto
  de imports.
- S3. Pendiente al archivar: actualizar el GDD (criterio 1..50 y deudas 0006·W1 y 0007·S2), según el design.

C: 0 · W: 2 · S: 3
