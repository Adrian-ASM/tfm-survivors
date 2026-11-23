/**
 * Frenado de CPU por CDP (`Emulation.setCPUThrottlingRate`) del proyecto `realtime` con
 * `CI_LIKE=1` (design 0014 §4.2): imita al runner de Actions sin depender de saturar el PC con
 * workers. `CPU_THROTTLE` lo cambia; 1 = sin frenar.
 *
 * PROVISIONAL (2026-11-23, tarea 3.2): todavía sin medir. La tarea 5.2 lo fija con la sonda
 * `calibration.spec.ts` frente al log del job `e2e` de CI y deja aquí la tabla de medidas.
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
