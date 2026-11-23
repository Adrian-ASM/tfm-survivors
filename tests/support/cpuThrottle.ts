/**
 * Frenado de CPU por CDP (`Emulation.setCPUThrottlingRate`) del proyecto `realtime` con
 * `CI_LIKE=1` (design 0014 §4.2): imita al runner de Actions sin depender de saturar el PC con
 * workers. `CPU_THROTTLE` lo cambia; 1 = sin frenar.
 *
 * PROVISIONAL (2026-11-23, tarea 3.2): la tarea 5.2 lo fija con la sonda `calibration.spec.ts`
 * frente al log del job `e2e` de CI (paso 3, pendiente: aún no hay PR).
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
 * En este PC la sonda no distingue los rates hasta 6: el frame sigue cabiendo en 16,7 ms. Si en CI
 * sale fps < 60 o p95 > 16,8, ningún rate de la tabla lo iguala y habrá que probar rates mayores
 * (design §4.3, paso 4). Hasta entonces se mantiene 4.
 */
export const DEFAULT_CPU_THROTTLE = 4;

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
