import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';

/** Mensajes de las invariantes de spawn; la validación de contenido (zod) usa los mismos. */
export const MAX_ALIVE_MUST_BE_INTEGER = 'El tope de enemigos vivos debe ser un entero ≥ 1.';
export const MAX_BUDGET_MUST_BE_POSITIVE = 'El máximo de presupuesto guardado debe ser positivo.';
export const MAX_ATTEMPTS_MUST_BE_INTEGER =
  'El número de intentos de spawn debe ser un entero ≥ 1.';
export const RING_RADIUS_MUST_BE_POSITIVE =
  'El radio del anillo de aparición debe ser positivo y finito.';
export const SPAWN_DISTANCE_MUST_BE_NON_NEGATIVE =
  'Las distancias de spawn no pueden ser negativas.';

/** Forma de los parámetros de spawn en el contenido (content/waves.json). */
export interface SpawnConfig {
  readonly maxAlive: number;
  readonly maxBudget: number;
  readonly ringRadius: number;
  readonly minDistance: number;
  readonly maxAttempts: number;
}

const isCount = (v: number): boolean => Number.isInteger(v) && v >= 1;
const isDistance = (v: number): boolean => Number.isFinite(v) && v >= 0;

/**
 * Reglas de aparición (value object). `ringRadius` es contenido (ADR-0015): el núcleo no conoce la
 * vista ni la ventana. Que el anillo quede fuera de cualquier vista lo valida la infraestructura
 * contra el tope de vista del contenido. `minDistance` ≥ `ringRadius` es válido (spec: "Ninguna
 * posición válida").
 */
export class SpawnRules {
  private constructor(
    readonly maxAlive: number,
    readonly maxBudget: number,
    readonly ringRadius: number,
    readonly minDistance: number,
    readonly maxAttempts: number,
  ) {
    Object.freeze(this);
  }

  static create(config: SpawnConfig): Result<SpawnRules, DomainError> {
    const { maxAlive, maxBudget, ringRadius, minDistance, maxAttempts } = config;
    if (!isCount(maxAlive)) return err(invalidConfig('waves.maxAlive', MAX_ALIVE_MUST_BE_INTEGER));
    if (!(Number.isFinite(maxBudget) && maxBudget > 0)) {
      return err(invalidConfig('waves.maxBudget', MAX_BUDGET_MUST_BE_POSITIVE));
    }
    if (!(Number.isFinite(ringRadius) && ringRadius > 0)) {
      return err(invalidConfig('waves.spawn.ringRadius', RING_RADIUS_MUST_BE_POSITIVE));
    }
    if (!isDistance(minDistance)) {
      return err(invalidConfig('waves.spawn.minDistance', SPAWN_DISTANCE_MUST_BE_NON_NEGATIVE));
    }
    if (!isCount(maxAttempts)) {
      return err(invalidConfig('waves.spawn.maxAttempts', MAX_ATTEMPTS_MUST_BE_INTEGER));
    }
    return ok(new SpawnRules(maxAlive, maxBudget, ringRadius, minDistance, maxAttempts));
  }
}
