# Design · 0010-balance-pass

## Resumen
El balance se calibra con un **bot de referencia** versionado en `tests/support/` (huida `fleeInput` + elección
priorizada de mejoras) y se protege con dos invariantes sobre el conjunto fijo de semillas 1..50: el bot gana
entre 25 y 35 partidas, y un jugador quieto pierde las 50 antes de 180 s. La palanca es solo de contenido: se
multiplica por 0,8 el `budgetPerSecond` de los tramos de 300 y 480 s en `content/waves.json` y en su espejo
`DEFAULT_WAVES`. Como la simulación de los primeros 18.000 ticks no lee esos tramos, todos los plazos archivados
(semillas 7 y 42, pulso, derrota quieta) quedan **idénticos tick a tick**. No se toca `src/`.

Fuentes: `exploration.md` (mediciones 1–3, decisiones del usuario y gate), `proposal.md` y las specs delta
`specs/run-outcome/spec.md` y `specs/simulation-loop/spec.md`, contrastadas con este design (ver "Trazabilidad").
No hay ninguna API de Phaser en juego, así que no se ha consultado `phaser-docs`.

## Piezas por capa
| Capa | Pieza | Nueva/Mod. | Notas |
|---|---|---|---|
| domain | — | — | Sin cambios. La regla del director ya lee el tramo activo y nada más. |
| application | — | — | Sin cambios. |
| infrastructure | `content/waves.json` | Mod. | Solo cambian los `budgetPerSecond` de los tramos de 300 y 480 s (5 → 4 y 7 → 5,6). Lo valida zod, como ahora. |
| composition | — | — | Sin cambios. |
| tests/support | `runs.ts`: `chooseWhileOpen(run, pick)` | Nueva | `chooseFirstWhileOpen` pasa a ser `chooseWhileOpen(run, () => 0)`, con el mismo comportamiento y sin cambios en quien la llama. |
| tests/support | `runs.ts`: `playReferenceBot(run, maxTicks)` | Nueva | Bucle del bot de referencia. Devuelve el snapshot final. |
| tests/support | `runs.ts`: `stillSurvivors(config, seeds, limitTicks)` | Nueva | Devuelve las semillas que, quietas y con la política fija, no han perdido antes de `limitTicks`. |
| tests/infrastructure | `speed-equivalence.test.ts` | Mod. | El escenario de la semilla 90 pasa a la semilla 7 quieta, con derrota antes del tick 10.800. |
| tests/support | `policies.ts`: `REFERENCE_UPGRADE_PRIORITY`, `pickByPriority(offer, priority?)` | Nueva | Elección priorizada pura. Vive junto a `fleeInput`. |
| tests/support | `balanceSeeds.ts`: `BALANCE_SEEDS`, `WIN_BAND`, `STILL_LIMIT_TICKS`, `STILL_DEFEAT_SEED` | Nueva | Solo constantes, sin imports, para que los E2E puedan importarla. |
| tests/support | `builders.ts`: `DEFAULT_WAVES` | Mod. | El espejo, con los mismos números que el JSON. |
| tests/domain | `balance.test.ts` | Mod. | Se van las semillas 2 y 90 y entran la tasa y "quieto pierde" (ver abajo). |
| tests/domain | `policies.test.ts` | Mod. | Tests de `pickByPriority` y de que los ids de la prioridad existen en el contenido. |
| tests/e2e | `progress.spec.ts:207`, `menu-progress.spec.ts:30` | Mod. | De la semilla 90 a `STILL_DEFEAT_SEED` (42). |

### 1. Helper del bot de referencia
- `pickByPriority(offer: readonly OfferSnapshot[], priority = REFERENCE_UPGRADE_PRIORITY): number`.
  Recorre `priority` en orden (guardrail, strict-rules, fast-ci, hard-asserts, watch-mode) y devuelve el índice
  en `offer` del primer id que esté en la oferta. Si no hay ninguno, devuelve 0. La prioridad manda sobre el orden
  de la oferta: con `[fast-ci, guardrail, coverage]` devuelve 1.
- `chooseWhileOpen(run: Run, pick: (offer) => number): number`. Es la generalización de `chooseFirstWhileOpen`:
  mientras `run.status === 'choosing'`, elige `pick(run.snapshot().offer)` y falla si la elección se rechaza.
  Mantener `chooseFirstWhileOpen` como alias evita tocar a unos 10 llamadores (`long-run`,
  `run-outcome-long`, `determinism-progression`…) y conserva la convención de "política de elección fija" de
  `simulation-loop`, que el proposal deja fuera del alcance.
- `playReferenceBot(run, maxTicks): RunSnapshot`. Por cada tick hace `chooseWhileOpen(run, pickByPriority)` y
  luego `run.tick(fleeInput(run.snapshot()))`, y para cuando `status === 'over'`. Esta es la misma secuencia que la
  medición (`flee-prio`). **No se reutiliza `play`**, porque su input es constante y aquí depende del snapshot.
  Generalizar `play` para que acepte una función obligaría a tocar su firma y a todos sus llamadores sin ganar
  nada.
- `stillSurvivors(config, seeds, limitTicks): number[]`. Para cada semilla hace `play(run, limitTicks - 1)` con
  input (0, 0) y la política fija, y devuelve las semillas cuya partida no está `over` + `lost`. "Antes de 180 s"
  significa que la derrota llega en un tick < 10.800: una partida que sigue viva en el tick 10.799 cuenta como
  superviviente, aunque muera en el 10.800. Separarlo del test permite probar ese límite con un contenido
  controlado (vida `LONG_RUN_HEALTH`) sin tocar el contenido por defecto.
- No es un puerto ni una abstracción del núcleo: es un doble de jugador que solo usan los tests.

### 2. Estructura de `tests/domain/balance.test.ts`
- **Se mantiene** `Plazos con progresión (0005…)`, con sus 4 escenarios de las semillas 7 y 42 (oferta ≤ 3.600,
  primer golpe ≤ 4.800, pulso ≤ 1.800, gema y oferta). Son plazos de otras specs, no de balance, y no cambian
  (ver §5).
- **Desaparecen** `FAST_DEFEAT_SEED` (90, ≤ 4.560 ticks, 0007·S2) y `WIN_SEED` (2, 0006·W1), con sus describes.
- **Nuevo** `describe('Balance con el contenido por defecto (0010)')`, con `BALANCE_SEEDS` = 1..50:
  - *Tasa de victoria del bot de referencia* + *Toda partida del bot termina*. Las 50 partidas se juegan una sola
    vez en un `beforeAll` (`{ timeout: 60_000 }`, porque el `testTimeout` global es de 20 s y en CI el coste puede
    doblarse). Un `it` comprueba que las 50 están `over` con tick ≤ 36.000. Otro cuenta las `won` en el tick
    36.000 y comprueba que el número está entre `WIN_BAND.min` = 25 y `WIN_BAND.max` = 35, ambos incluidos. El
    mensaje del `expect` incluye el número de victorias.
  - *Jugador quieto pierde con todas las semillas*: `expect(stillSurvivors(aDefaultConfig(), BALANCE_SEEDS,
    STILL_LIMIT_TICKS)).toEqual([])`, con `STILL_LIMIT_TICKS = 180 * 60` (10.800). Si falla, la lista dice qué
    semillas sobreviven.
  - *Muerte quieta en el límite de 180 s*: `stillSurvivors(withPlayer(aDefaultConfig(), { maxHealth:
    LONG_RUN_HEALTH }), [7], STILL_LIMIT_TICKS)` devuelve `[7]`. Prueba que el helper marca la partida que sigue
    viva en el tick 10.799.
  - La semilla del E2E está en el conjunto: `expect(BALANCE_SEEDS).toContain(STILL_DEFEAT_SEED)`. Une el E2E de
    derrota con el invariante sin repetir la semilla en otro sitio.
  - *Bot reproducible* (semilla 7, dos veces): mismo resultado, tick, bajas y `upgrades`.
- Las constantes (`WIN_BAND`, `STILL_LIMIT_TICKS`, `TEN_MINUTES`) son nombradas y cada una cita su escenario.
  Ninguna semilla suelta fija un resultado de balance.
- **Coste en `verify`** (rango medido de 35 a 190 ms por partida): la tasa son 50 partidas, de las que unas 30 llegan a
  36.000 ticks. Son unos 6–9,5 s. "Quieto" son 50 partidas que acaban en ≤ 94 s de juego (≤ 5.640 ticks), unos
  1–2 s. En total, de 7 a 11 s en un solo fichero, que Vitest ejecuta en paralelo con los demás. Si en CI se acerca
  a 60 s, el plan B es partir la tasa en dos `it` (1..25 y 26..50) que sumen en un `beforeAll`. No se hace de
  entrada.

### 3. Palanca de contenido
- **Restricción de monotonía**: el escenario "Oleadas que crecen con el contenido por defecto" (`enemy-spawning`,
  `content.test.ts:410`) exige que cada `budgetPerSecond` sea ≥ el del tramo anterior. ×0,7 o ×0,75 desde 180 s
  dejan el tramo de 180 s en 1,75 o 1,875, por debajo del 2 del tramo de 60 s, y lo rompen. Por eso se descartan.
- **Palanca elegida** (Medición 3 de `exploration.md`): **×0,8 solo en los tramos de 300 y 480 s**, que deja
  `budgetPerSecond` = `[1, 2, 2.5, 4, 5.6]` (5 → 4 y 7 → 5,6). Dio **30/50**, el centro de la banda. Es monótona y
  no toca nada antes de 300 s. Quieto muere en ≤ 94 s con las 50 semillas. La medición eligió por prioridad, igual
  que `pickByPriority`.
- **Plan B**: f300x75 = `[1, 2, 2.5, 3.75, 5.25]`, que dio 32/50. Se usa solo si el test de tasa no reproduce 30.
- Descartadas:
  - f180x80 = `[1, 2, 2, 4, 5.6]`: 24/50, fuera de la banda.
  - Cualquier cambio de vida o de tramos anteriores a 180 s: rompe "quieto < 180 s" (hp150 + f300x60 dio una
    muerte máxima de 322 s) y movería los plazos archivados.
- **Ruido**: la tasa varía ±3–4 entre factores contiguos y no es monótona en las combinaciones (f180x80 + f300x85 =
  36, f180x80 + f300x90 = 28). La banda de ±5 alrededor de 30 es el margen mínimo. Un ajuste futuro de contenido
  puede sacarla de la banda, y eso es intencionado (ver proposal).
- **Sin números mágicos**: los presupuestos viven en `content/waves.json` y en su espejo. El factor ×0,8 es solo
  un razonamiento de diseño y no aparece en el código.

### 4. Sincronización entre `content/waves.json` y `builders.ts`
- **Ya existe** el test de igualdad completo: `tests/infrastructure/content.test.ts:416` ("coincide con el
  contenido de la spec que usan los tests") compara `loadRunConfig()` con `aDefaultConfig()` mediante `toEqual`.
  Cubre arena, jugador, enemigos, oleadas, armas, progresión, mejoras y partida (además de
  `weapons-content.test.ts` para las armas). **No hace falta un test nuevo**.
- La tarea de contenido cambia los dos ficheros a la vez. El test de igualdad se pone en rojo si solo se cambia
  uno, y "Oleadas que crecen" se pone en rojo si un tramo baja del anterior.
- `DEFAULT_WAVES` también lo usa `aRunConfig` (sin armas). Lo revisé: `long-run` con `LONG_RUN_HEALTH` sigue
  llegando a 200 vivos (el presupuesto acumulado hasta los 180 s ya da para más de 200), el "quieto sin armas"
  muere antes de 180 s y el resto solo compara una ejecución consigo misma. No se esperan roturas.
  `npm run verify` lo confirma.

### 5. E2E y plazos archivados
- **Invariante de identidad**: `WaveDirector` solo lee el tramo activo (el último con `fromSecond` ≤ tick/60).
  Antes del tick 18.000 los tramos de 300 y 480 s no se leen, y con el mismo RNG la simulación es la misma tick a
  tick. Todos los plazos medidos caen antes:
  - oferta de la semilla 7: tick 3.332, con plazo ≤ 3.600;
  - pulso: unos 950, con plazo ≤ 1.800;
  - primer golpe de la semilla 42: 4.122, con plazos ≤ 4.800 y 80 s;
  - derrota quieta de la semilla 42: 4.682 ≈ 78 s, con plazo ≤ 120 s;
  - muerte quieta máxima en 1..50: ≤ 94 s.

  **No hay deltas** de `player-health`, `run-results`, `upgrades`, `auto-weapons` ni `player-movement`. Apply lo
  confirma con los tests actuales en verde sin tocarlos.
- `progress.spec.ts:207` y `menu-progress.spec.ts:30`: se borra el `FAST_DEFEAT_SEED = 90` local y se importa
  `STILL_DEFEAT_SEED` (42) desde `tests/support/balanceSeeds.ts`. Se actualizan los comentarios ("tick 4501",
  "la que antes pierde"), que ahora apuntan al invariante "quieto pierde". Plazos:
  - La 42 pierde en el tick 4.682, frente al 4.501 de la 90. Son unos 3 s más de juego, unos 0,4 s reales a
    `E2E_SPEED` = 8.
  - `PLAY_TIMEOUT_MS` = 45 s y `test.setTimeout` de 60 s siguen sobrados.
  - El peor caso del invariante (180 s de juego) cuesta unos 22,5 s reales a velocidad 8 y también cabe.

  **No se cambian `?speed` ni los timeouts**. `results.spec.ts` (≤ 12 s reales y ≤ 120 s de juego con la 42) no
  cambia.
- `progress.spec.ts` (almacenamiento bloqueado) añade `expect(ended.tick).toBeLessThanOrEqual(STILL_LIMIT_TICKS)`.
  Con eso cubre el escenario de `run-outcome` "Derrota E2E con una semilla del conjunto" (≤ 180 s). El ≤ 120 s
  de `run-results` sigue en `results.spec.ts`. Los dos plazos son compatibles: la 42 pierde a los 78 s, y el de
  `run-results` es simplemente más estricto.
- `speed-equivalence.test.ts`: "Derrota equivalente con la semilla 90" pasa a "Derrota equivalente con otra
  semilla del conjunto": la 7, quieta, a velocidades 1 y 8, con `outcome` `lost` y tick < 10.800.
- `clear-progress.spec.ts` juega con una semilla aleatoria tras Volver al menú (120 s de margen). Sus primeros
  300 s son idénticos a los de ahora y la medición sobre 1..100 dio p90 = 87 s quieto, así que no le afecta.

### Trazabilidad con las specs delta
| Escenario | Test |
|---|---|
| run-outcome · Elige por prioridad, no por posición / La prioridad más alta gana / Ningún id priorizado / Oferta de una sola opción | `policies.test.ts` (`pickByPriority`) |
| run-outcome · Huida sin amenazas / de un enemigo / Enemigo fuera de rango | `policies.test.ts` (`fleeInput`; los dos primeros ya existen) |
| run-outcome · Bot reproducible | `balance.test.ts` |
| run-outcome · Tasa de victoria / Toda partida del bot termina | `balance.test.ts` |
| run-outcome · Jugador quieto pierde con todas las semillas / Muerte quieta en el límite de 180 s | `balance.test.ts` (`stillSurvivors`) |
| run-outcome · Sin semillas sueltas de balance | Se borran `WIN_SEED` y `FAST_DEFEAT_SEED`; se comprueba con grep en verify |
| run-outcome · Contenido de los tests igual al del juego | `content.test.ts:416` (ya existe; se renombra con el escenario) |
| run-outcome · Derrota E2E con una semilla del conjunto | `progress.spec.ts` (almacenamiento bloqueado, semilla 42) |
| run-outcome · **Límites de la banda** | **Sin test: se propone retirarlo de la spec.** Solo probaría la comparación `25 ≤ n ≤ 35` del propio test (un helper `withinBand` sería un test del test). |
| simulation-loop · Derrota equivalente con otra semilla del conjunto (7) | `speed-equivalence.test.ts` |
| simulation-loop · resto de escenarios del requisito | Ya existen y no cambian |

### 6. Documentación
- `AGENTS.md` §1 (estado del proyecto): una frase que diga que el balance se calibra con el bot de referencia
  sobre las semillas 1..50 (change 0010) y que "quieto pierde < 180 s" es invariante. Va en la tarea de docs de
  apply.
- `docs/gdd.md`: el criterio de 0010 (líneas 106–112) pasa de 10 semillas a 1..50 con la banda 25–35, y las deudas
  0006·W1 y 0007·S2 se marcan como resueltas. Se hace al archivar (skill `sdd-archive`), como prevé el proposal.
- Sin ADR: no hay una decisión estructural. Es un helper de test y números de contenido.

## Flujo
Un tick del bot de referencia (solo en los tests):
`chooseWhileOpen(run, pickByPriority)` → `fleeInput(run.snapshot())` → `run.tick(input)` → ¿`status === 'over'`?
El núcleo y el bucle de paso fijo del juego no cambian.

## Dependencias nuevas
| Paquete | Versión exacta | Motivo | Alternativa descartada |
|---|---|---|---|
| — | — | Ninguna | — |

## Rendimiento y seguridad
- **Juego**: ningún cambio en `src/`, y el presupuesto por tick sigue igual. Habrá menos enemigos desde 300 s, así
  que el coste por tick en la parte final como mucho baja.
- **`verify`**: entre 7 y 11 s más en local, en un fichero que corre en paralelo. `npm run bench` no cambia.
- **Datos**: no cambian el formato guardado ni las entradas externas. `content/waves.json` sigue validado con zod.
  Los récords guardados con el balance anterior siguen siendo válidos, aunque no sean comparables.

## Riesgos
- **Reproducir el 30/50**: el helper versionado tiene que replicar la secuencia de la medición (elegir antes del
  tick y usar el snapshot previo para `fleeInput`). Si sale otro número dentro de la banda, vale; si sale fuera, se
  revisa el helper antes de tocar el contenido, y el plan B (f300x75) va después.
- **Ruido de la tasa**: ±3–4 entre factores contiguos, así que con 30 quedan unos 5 de margen a cada lado.
- **Sobreajuste al bot** y **coste en CI**: ya están en el proposal. Para el coste hay timeout explícito y plan B
  de partir el test.

## Medición
Ejecución local de apply (tarea 2.1, Windows, Vitest 5.1.1):
- `budgetPerSecond` finales: `[1, 2, 2.5, 4, 5.6]` (palanca principal ×0,8 en 300 y 480 s; no hizo falta el
  plan B).
- Con el contenido anterior (`[1, 2, 2.5, 5, 7]`), el test de tasa dio 17/50 (rojo), igual que la medición.
- Bot de referencia sobre 1..50: **30/50** victorias, las 50 partidas terminadas en un tick ≤ 36.000. Reproduce
  la Medición 3.
- Jugador quieto: las 50 pierden; la muerte más tardía es en el tick **5.629** (≈ 93,8 s), por debajo de 10.800.
- Coste: unos 7,0 s las 50 partidas del bot (**unos 140 ms por partida**) y 0,16 s las 50 quietas. El fichero
  `balance.test.ts` completo tarda unos 7,8 s, y `npm run verify` pasa de unos 5 s a unos 9,6 s de Vitest.
