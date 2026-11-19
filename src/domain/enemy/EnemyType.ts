import type { Arena } from '../arena/Arena';
import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';

/**
 * Mensajes de las invariantes de un tipo de enemigo; la validación de contenido (zod) usa los
 * mismos.
 */
export const ENEMY_SPEED_MUST_BE_POSITIVE = 'La velocidad del enemigo debe ser positiva.';
export const ENEMY_RADIUS_MUST_FIT = 'El radio del enemigo debe ser positivo y caber en la arena.';
export const ENEMY_COST_MUST_BE_POSITIVE = 'El coste del enemigo debe ser positivo.';
export const ENEMY_ID_MUST_BE_UNIQUE = 'Identificador de enemigo repetido';

/** Forma de un tipo de enemigo en el contenido (content/enemies.json). */
export interface EnemyTypeConfig {
  readonly id: string;
  readonly speed: number;
  readonly radius: number;
  readonly cost: number;
}

const isPositive = (v: number): boolean => Number.isFinite(v) && v > 0;

/**
 * Tipo de enemigo (value object): inmutable y compartido por todos los enemigos de ese tipo.
 * Invariantes: velocidad y coste positivos; el círculo cabe en la arena.
 */
export class EnemyType {
  private constructor(
    readonly id: string,
    readonly speed: number,
    readonly radius: number,
    readonly cost: number,
  ) {
    Object.freeze(this);
  }

  /**
   * `path` es la ruta del tipo en el contenido (p. ej. `enemies.types.1`) para nombrar el campo.
   */
  static create(
    config: EnemyTypeConfig,
    arena: Arena,
    path: string,
  ): Result<EnemyType, DomainError> {
    const { id, speed, radius, cost } = config;
    if (!isPositive(speed)) {
      return err(invalidConfig(`${path}.speed`, ENEMY_SPEED_MUST_BE_POSITIVE));
    }
    if (!arena.fits(radius)) return err(invalidConfig(`${path}.radius`, ENEMY_RADIUS_MUST_FIT));
    if (!isPositive(cost)) return err(invalidConfig(`${path}.cost`, ENEMY_COST_MUST_BE_POSITIVE));
    return ok(new EnemyType(id, speed, radius, cost));
  }
}
