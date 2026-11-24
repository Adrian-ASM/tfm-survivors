import type { Arena } from '../arena/Arena';
import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import { Behavior } from './behavior/Behavior';
import type { BehaviorConfig } from './behavior/BehaviorConfig';

/**
 * Mensajes de las invariantes de un tipo de enemigo; la validación de contenido (zod) usa los
 * mismos.
 */
export const ENEMY_SPEED_MUST_BE_POSITIVE = 'La velocidad del enemigo debe ser positiva.';
export const ENEMY_RADIUS_MUST_FIT = 'El radio del enemigo debe ser positivo y caber en la arena.';
export const ENEMY_COST_MUST_BE_POSITIVE = 'El coste del enemigo debe ser positivo.';
export const ENEMY_DAMAGE_MUST_BE_POSITIVE = 'El daño del enemigo debe ser positivo.';
export const ENEMY_HEALTH_MUST_BE_POSITIVE = 'La vida del enemigo debe ser positiva.';
export const ENEMY_XP_MUST_BE_INTEGER = 'La XP que suelta un enemigo debe ser un entero ≥ 1.';
export const ENEMY_ID_MUST_BE_UNIQUE = 'Identificador de enemigo repetido';

/** Forma de un tipo de enemigo en el contenido (content/enemies.json). */
export interface EnemyTypeConfig {
  readonly id: string;
  readonly speed: number;
  readonly radius: number;
  readonly cost: number;
  /** Daño por contacto; ausente = el tipo no golpea al tocar (spec enemy-spawning, D3). */
  readonly damage?: number | undefined;
  readonly health: number;
  /** XP de la gema que suelta al morir (spec xp-gems). */
  readonly xp: number;
  /** Comportamiento por estados (spec enemy-behavior, ADR-0019). */
  readonly behavior: BehaviorConfig;
}

const isPositive = (v: number): boolean => Number.isFinite(v) && v > 0;

/**
 * Tipo de enemigo (value object): inmutable y compartido por todos los enemigos de ese tipo.
 * Invariantes: velocidad, coste y vida positivos y finitos; daño por contacto positivo si está
 * (si falta, `damage` vale 0 y `hasContact` es false); XP entera ≥ 1; el círculo cabe en la arena;
 * comportamiento válido.
 */
export class EnemyType {
  readonly hasContact: boolean;

  private constructor(
    readonly id: string,
    readonly speed: number,
    readonly radius: number,
    readonly cost: number,
    readonly damage: number,
    readonly health: number,
    readonly xp: number,
    readonly behavior: Behavior,
  ) {
    this.hasContact = damage > 0;
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
    const { id, speed, radius, cost, damage, health, xp } = config;
    if (!isPositive(speed)) {
      return err(invalidConfig(`${path}.speed`, ENEMY_SPEED_MUST_BE_POSITIVE));
    }
    if (!arena.fits(radius)) return err(invalidConfig(`${path}.radius`, ENEMY_RADIUS_MUST_FIT));
    if (!isPositive(cost)) return err(invalidConfig(`${path}.cost`, ENEMY_COST_MUST_BE_POSITIVE));
    if (damage !== undefined && !isPositive(damage)) {
      return err(invalidConfig(`${path}.damage`, ENEMY_DAMAGE_MUST_BE_POSITIVE));
    }
    if (!isPositive(health)) {
      return err(invalidConfig(`${path}.health`, ENEMY_HEALTH_MUST_BE_POSITIVE));
    }
    if (!Number.isInteger(xp) || xp < 1) {
      return err(invalidConfig(`${path}.xp`, ENEMY_XP_MUST_BE_INTEGER));
    }
    const behavior = Behavior.create(config.behavior, id, `${path}.behavior`);
    if (!behavior.ok) return behavior;
    const type = new EnemyType(id, speed, radius, cost, damage ?? 0, health, xp, behavior.value);
    return ok(type);
  }
}
