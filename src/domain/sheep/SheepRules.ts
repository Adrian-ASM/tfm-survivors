import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import { TICK_SECONDS } from '../shared/Tick';

/** Mensajes de las invariantes de las ovejas; la validación de contenido (zod) usa los mismos. */
export const SHEEP_MAX_ALIVE_MUST_BE_INTEGER = 'El tope de ovejas vivas debe ser un entero ≥ 0.';
export const SHEEP_RADIUS_MUST_BE_POSITIVE = 'El radio de la oveja debe ser positivo.';
export const SHEEP_HEALTH_MUST_BE_INTEGER = 'La vida de la oveja debe ser un entero ≥ 1.';
export const SHEEP_SPEED_MUST_BE_POSITIVE = 'Una velocidad de la oveja debe ser positiva (px/s).';
export const SHEEP_RADIUS_FIELD_MUST_BE_POSITIVE =
  'El radio de huida y el de pasto de la oveja deben ser positivos.';
export const SHEEP_TICKS_MUST_BE_INTEGER =
  'Una duración o un intervalo de la oveja debe ser un entero ≥ 1 (en ticks).';
export const SHEEP_DISTANCE_MUST_BE_NON_NEGATIVE =
  'La distancia mínima de reaparición al jugador debe ser ≥ 0 (px).';
export const SHEEP_PLACEMENT_MUST_BE_INTEGER =
  'Una distancia de colocación de ovejas debe ser un entero ≥ 0 (en celdas).';

const PATH = 'sheep';

/** Parámetros de las ovejas (content/sheep.json, spec sheep 0023). */
export interface SheepConfig {
  /** Ovejas vivas como mucho con el mapa generado (0 = sin ovejas). */
  readonly maxAlive: number;
  readonly radius: number;
  readonly health: number;
  /** Pasto: duración en ticks y radio en torno al origen fuera del cual el paseo vuelve. */
  readonly graze: { readonly ticks: number; readonly radius: number };
  /** Paseo: px/s y duración en ticks. */
  readonly wander: { readonly speed: number; readonly ticks: number };
  /** Huida: radio (estricto) y px/s. */
  readonly flee: { readonly radius: number; readonly speed: number };
  /** Reaparición: ticks tras la muerte y distancia mínima al jugador en px. */
  readonly respawn: { readonly everyTicks: number; readonly minPlayerDistance: number };
  /** Colocación inicial en el mapa generado, en celdas de Chebyshev. */
  readonly placement: {
    readonly minStartCells: number;
    readonly minCastleCells: number;
    readonly minGapCells: number;
  };
}

const isPositive = (v: number): boolean => Number.isFinite(v) && v > 0;
const isTicks = (v: number): boolean => Number.isInteger(v) && v >= 1;
const isCount = (v: number): boolean => Number.isInteger(v) && v >= 0;

/** Primer campo fuera de rango, en el orden del contenido, o null. */
function firstError(c: SheepConfig): DomainError | null {
  const checks: readonly [boolean, string, string][] = [
    [isCount(c.maxAlive), 'maxAlive', SHEEP_MAX_ALIVE_MUST_BE_INTEGER],
    [isPositive(c.radius), 'radius', SHEEP_RADIUS_MUST_BE_POSITIVE],
    [isTicks(c.health), 'health', SHEEP_HEALTH_MUST_BE_INTEGER],
    [isTicks(c.graze.ticks), 'graze.ticks', SHEEP_TICKS_MUST_BE_INTEGER],
    [isPositive(c.graze.radius), 'graze.radius', SHEEP_RADIUS_FIELD_MUST_BE_POSITIVE],
    [isPositive(c.wander.speed), 'wander.speed', SHEEP_SPEED_MUST_BE_POSITIVE],
    [isTicks(c.wander.ticks), 'wander.ticks', SHEEP_TICKS_MUST_BE_INTEGER],
    [isPositive(c.flee.radius), 'flee.radius', SHEEP_RADIUS_FIELD_MUST_BE_POSITIVE],
    [isPositive(c.flee.speed), 'flee.speed', SHEEP_SPEED_MUST_BE_POSITIVE],
    [isTicks(c.respawn.everyTicks), 'respawn.everyTicks', SHEEP_TICKS_MUST_BE_INTEGER],
    [
      Number.isFinite(c.respawn.minPlayerDistance) && c.respawn.minPlayerDistance >= 0,
      'respawn.minPlayerDistance',
      SHEEP_DISTANCE_MUST_BE_NON_NEGATIVE,
    ],
    [isCount(c.placement.minStartCells), 'placement.minStartCells', SHEEP_PLACEMENT_MUST_BE_INTEGER],
    [
      isCount(c.placement.minCastleCells),
      'placement.minCastleCells',
      SHEEP_PLACEMENT_MUST_BE_INTEGER,
    ],
    [isCount(c.placement.minGapCells), 'placement.minGapCells', SHEEP_PLACEMENT_MUST_BE_INTEGER],
  ];
  const bad = checks.find(([valid]) => !valid);
  return bad ? invalidConfig(`${PATH}.${bad[1]}`, bad[2]) : null;
}

/**
 * Reglas de las ovejas (value object, spec sheep, ADR-0022): tope, círculo, vida, pasto, paseo,
 * huida, reaparición y colocación. Sin cruce con el mapa: las celdas candidatas de colocación y de
 * reaparición solo admiten centros que son posición legal del círculo (spec procedural-map, "Celda
 * en el límite del radio del jugador": `cellSize` 32 carga con el radio por defecto).
 */
export class SheepRules {
  /** Avance por tick del paseo y de la huida (velocidad / 60). */
  readonly wanderStep: number;
  readonly fleeStep: number;

  private constructor(readonly config: SheepConfig) {
    this.wanderStep = config.wander.speed * TICK_SECONDS;
    this.fleeStep = config.flee.speed * TICK_SECONDS;
    Object.freeze(this);
  }

  get maxAlive(): number {
    return this.config.maxAlive;
  }

  get radius(): number {
    return this.config.radius;
  }

  get health(): number {
    return this.config.health;
  }

  static create(config: SheepConfig): Result<SheepRules, DomainError> {
    const error = firstError(config);
    if (error) return err(error);
    return ok(
      new SheepRules(
        Object.freeze({
          ...config,
          graze: Object.freeze({ ...config.graze }),
          wander: Object.freeze({ ...config.wander }),
          flee: Object.freeze({ ...config.flee }),
          respawn: Object.freeze({ ...config.respawn }),
          placement: Object.freeze({ ...config.placement }),
        }),
      ),
    );
  }
}
