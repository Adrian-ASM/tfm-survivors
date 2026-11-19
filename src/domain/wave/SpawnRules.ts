import type { View } from '../arena/View';
import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';

/** Mensajes de las invariantes de spawn; la validación de contenido (zod) usa los mismos. */
export const MAX_ALIVE_MUST_BE_INTEGER = 'El tope de enemigos vivos debe ser un entero ≥ 1.';
export const MAX_ATTEMPTS_MUST_BE_INTEGER =
  'El número de intentos de spawn debe ser un entero ≥ 1.';
export const SPAWN_DISTANCE_MUST_BE_NON_NEGATIVE =
  'Las distancias de spawn no pueden ser negativas.';

/** Forma de los parámetros de spawn en el contenido (content/waves.json). */
export interface SpawnConfig {
  readonly maxAlive: number;
  readonly margin: number;
  readonly minDistance: number;
  readonly maxAttempts: number;
}

const isCount = (v: number): boolean => Number.isInteger(v) && v >= 1;
const isDistance = (v: number): boolean => Number.isFinite(v) && v >= 0;

/**
 * Reglas de aparición (value object). `ringRadius` se calcula: mitad de la diagonal de la vista + margin,
 * de modo que el punto de partida queda siempre fuera de la vista centrada en el jugador.
 * `minDistance` ≥ `ringRadius` es válido (spec: "Ninguna posición válida").
 */
export class SpawnRules {
  readonly ringRadius: number;

  private constructor(
    readonly maxAlive: number,
    readonly margin: number,
    readonly minDistance: number,
    readonly maxAttempts: number,
    view: View,
  ) {
    this.ringRadius = view.halfDiagonal + margin;
    Object.freeze(this);
  }

  static create(config: SpawnConfig, view: View): Result<SpawnRules, DomainError> {
    const { maxAlive, margin, minDistance, maxAttempts } = config;
    if (!isCount(maxAlive)) return err(invalidConfig('waves.maxAlive', MAX_ALIVE_MUST_BE_INTEGER));
    if (!isDistance(margin)) {
      return err(invalidConfig('waves.spawn.margin', SPAWN_DISTANCE_MUST_BE_NON_NEGATIVE));
    }
    if (!isDistance(minDistance)) {
      return err(invalidConfig('waves.spawn.minDistance', SPAWN_DISTANCE_MUST_BE_NON_NEGATIVE));
    }
    if (!isCount(maxAttempts)) {
      return err(invalidConfig('waves.spawn.maxAttempts', MAX_ATTEMPTS_MUST_BE_INTEGER));
    }
    return ok(new SpawnRules(maxAlive, margin, minDistance, maxAttempts, view));
  }
}
