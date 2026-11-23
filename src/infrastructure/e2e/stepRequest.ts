import { z } from 'zod';

/** Ticks admitidos por `window.__sprint.step(n)` (spec simulation-loop, "Avance manual con step"). */
export const StepCountSchema = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);

/** Longitud máxima del valor crudo que se repite en el aviso (entrada externa, solo para consola). */
const MAX_ECHO = 32;

/** Lo que `requestStep` necesita del `ManualStepper`: encolar n ticks ya validados. */
export interface StepRequester {
  request(ticks: number): Promise<number>;
}

/**
 * Describe un valor arbitrario para el aviso sin `JSON.stringify` (lanzaría con un `BigInt` o un
 * objeto cíclico): el tipo y, si es número o texto, el valor recortado.
 */
function describeValue(n: unknown): string {
  if (typeof n === 'number' || typeof n === 'string') {
    return `${typeof n} ${String(n).slice(0, MAX_ECHO)}`;
  }
  return typeof n;
}

/**
 * Entrada de `window.__sprint.step(n)`. Sin stepper (no hay modo manual) o con n inválido avisa
 * por `warn` y resuelve 0 al momento, sin esperar frame ni tocar la partida. Si no, delega en el
 * stepper, que resuelve con los ticks ejecutados.
 */
export function requestStep(
  n: unknown,
  stepper: StepRequester | undefined,
  warn: (msg: string) => void,
): Promise<number> {
  if (stepper === undefined) {
    warn('Sin modo manual (?e2e&manual) la partida no se avanza a mano.');
    return Promise.resolve(0);
  }
  const parsed = StepCountSchema.safeParse(n);
  if (!parsed.success) {
    warn(
      `Argumento de step inválido (${describeValue(n)}): se esperaba un entero ≥ 1; no se avanza.`,
    );
    return Promise.resolve(0);
  }
  return stepper.request(parsed.data);
}
