/**
 * Frenado de CPU por CDP (`Emulation.setCPUThrottlingRate`) del proyecto `realtime` con
 * `CI_LIKE=1` (design 0014 §4.2): imita al runner de Actions sin depender de saturar el PC con
 * workers. `CPU_THROTTLE` lo cambia; 1 = sin frenar.
 *
 * Calibrado (2026-11-23, tarea 5.2) con la sonda `calibration.spec.ts` frente al job `e2e` de CI.
 *
 * Medidas locales (2026-11-23, tarea 5.2 pasos 1 y 2), `CI_LIKE=1 CPU_THROTTLE=<r> npx playwright
 * test --project=realtime --repeat-each=3`, 2 workers, tras el rebase sobre 0013. Mediana de las 3
 * líneas `[calibration]` (?e2e&seed=42&speed=8, tick >= 1.200, 300 frames):
 *
 *   rate | fps  | p95 (ms) | tpf  | pasada realtime x3
 *   -----+------+----------+------+-----------------------------------------
 *     1  | 60,0 |   16,7   | 8,00 | 135 ok, 3 saltados (throttle), 0 fallos, 4,7 min
 *     2  | 60,0 |   16,8   | 8,00 | 138 ok, 0 fallos, 4,9 min
 *     3  | 60,0 |   16,8   | 8,00 | 138 ok, 0 fallos, 5,2 min
 *     4  | 60,0 |   16,8   | 8,00 | 138 ok, 0 fallos, 5,5 min
 *     6  | 60,0 |   16,8   | 8,00 | 138 ok, 0 fallos, 5,9 min
 *
 * En este PC la sonda no distingue los rates hasta 6: el frame sigue cabiendo en 16,7 ms.
 *
 * CI (paso 3): job `e2e` del PR #33 (run 45175086531), `fps=11.2 p95=116.7 tpf=11.05`.
 * Rates mayores, solo la sonda (`--workers=1`, una muestra por rate):
 *
 *   rate | fps  | p95 (ms) | tpf
 *   -----+------+----------+------
 *    10  | 59,8 |   16,8   | 8,03
 *    20  | 30,7 |   50,0   | 11,53
 *    25  | 16,4 |  116,7   | 10,40
 *    30  | 11,3 |  166,7   | 11,26
 *    40  |  8,1 |  233,4   | 9,33
 *
 * Elección (paso 4): 25, el de p95 igual al de CI. Se probó antes 30 (fps y tpf más parecidos),
 * pero frena más el JS que el runner, cuya lentitud viene sobre todo del render sin GPU: con 30,
 * "Sin violaciones en el bucle completo" pasaba de 60 s (CI: 43,4 s) y "Cinco ciclos menú-partida"
 * tardaba 1,2 min (CI: 50,4 s). Con 25, `--workers=1`: 35,7 s y 38,1 s, ambos en verde.
 */
export const DEFAULT_CPU_THROTTLE = 25;

/**
 * Lee `CPU_THROTTLE`: sin valor, `DEFAULT_CPU_THROTTLE`; si no, un número finito ≥ 1. Un valor
 * inválido lanza al cargar la config (herramienta de test: mejor fallar alto que frenar mal).
 */
export function parseThrottle(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_CPU_THROTTLE;
  const rate = raw.trim() === '' ? Number.NaN : Number(raw);
  if (!Number.isFinite(rate) || rate < 1) {
    throw new Error(`CPU_THROTTLE inválido (${raw.slice(0, 32)}): se espera un número ≥ 1.`);
  }
  return rate;
}
