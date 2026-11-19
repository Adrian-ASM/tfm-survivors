import type { EnemyCatalog } from '../enemy/EnemyCatalog';
import type { EnemyType } from '../enemy/EnemyType';
import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import { TICKS_PER_SECOND } from '../shared/Tick';

/**
 * Mensajes de las invariantes de la tabla de oleadas; la validación de contenido (zod) usa los
 * mismos.
 */
export const WAVES_NEED_SEGMENTS = 'La tabla de oleadas necesita al menos un tramo.';
export const FIRST_SEGMENT_MUST_START_AT_ZERO = 'El primer tramo debe empezar en fromSecond 0.';
export const SEGMENTS_MUST_INCREASE =
  'Los fromSecond de los tramos deben ser estrictamente crecientes.';
export const BUDGET_MUST_BE_NON_NEGATIVE = 'El budgetPerSecond de un tramo no puede ser negativo.';
export const SEGMENT_NEEDS_TYPES = 'Cada tramo necesita al menos un tipo de enemigo.';
export const UNKNOWN_ENEMY_TYPE = 'Tipo de enemigo desconocido';

const PATH = 'waves.segments';

/** Forma de un tramo en el contenido (content/waves.json). */
export interface WaveSegmentConfig {
  readonly fromSecond: number;
  readonly budgetPerSecond: number;
  readonly types: readonly string[];
}

/** Tramo resuelto: los tipos ya son los del catálogo. */
export interface WaveSegment {
  readonly fromSecond: number;
  readonly budgetPerSecond: number;
  readonly types: readonly EnemyType[];
}

function resolveTypes(
  ids: readonly string[],
  catalog: EnemyCatalog,
  path: string,
): Result<readonly EnemyType[], DomainError> {
  if (ids.length === 0) return err(invalidConfig(`${path}.types`, SEGMENT_NEEDS_TYPES));
  const types: EnemyType[] = [];
  for (const [i, id] of ids.entries()) {
    const type = catalog.get(id);
    if (!type) {
      return err(invalidConfig(`${path}.types.${String(i)}`, `${UNKNOWN_ENEMY_TYPE}: ${id}`));
    }
    types.push(type);
  }
  return ok(Object.freeze(types));
}

function checkStart(fromSecond: number, previous: number | null, path: string): DomainError | null {
  const field = `${path}.fromSecond`;
  if (previous === null) {
    return fromSecond === 0 ? null : invalidConfig(field, FIRST_SEGMENT_MUST_START_AT_ZERO);
  }
  return Number.isFinite(fromSecond) && fromSecond > previous
    ? null
    : invalidConfig(field, SEGMENTS_MUST_INCREASE);
}

/**
 * Tabla de oleadas por tramos de tiempo (value object).
 * Invariantes: ≥ 1 tramo; el primero empieza en 0 s; inicios estrictamente crecientes;
 * presupuesto ≥ 0; ≥ 1 tipo por tramo y todos en el catálogo.
 */
export class WaveTable {
  private constructor(readonly segments: readonly WaveSegment[]) {
    Object.freeze(this);
  }

  static create(
    configs: readonly WaveSegmentConfig[],
    catalog: EnemyCatalog,
  ): Result<WaveTable, DomainError> {
    if (configs.length === 0) return err(invalidConfig(PATH, WAVES_NEED_SEGMENTS));
    const segments: WaveSegment[] = [];
    let previous: number | null = null;
    for (const [i, config] of configs.entries()) {
      const path = `${PATH}.${String(i)}`;
      const startError = checkStart(config.fromSecond, previous, path);
      if (startError) return err(startError);
      const { budgetPerSecond } = config;
      if (!Number.isFinite(budgetPerSecond) || budgetPerSecond < 0) {
        return err(invalidConfig(`${path}.budgetPerSecond`, BUDGET_MUST_BE_NON_NEGATIVE));
      }
      const types = resolveTypes(config.types, catalog, path);
      if (!types.ok) return types;
      segments.push(
        Object.freeze({ fromSecond: config.fromSecond, budgetPerSecond, types: types.value }),
      );
      previous = config.fromSecond;
    }
    return ok(new WaveTable(Object.freeze(segments)));
  }

  /**
   * Índice del tramo activo en el tick dado: el último con fromSecond ≤ tick / 60.
   * `from` es una pista (el tramo activo anterior) para recorrer la tabla de forma monótona.
   */
  indexAt(tick: number, from = 0): number {
    const seconds = tick / TICKS_PER_SECOND;
    let index = from;
    while (
      index + 1 < this.segments.length &&
      (this.segments[index + 1]?.fromSecond ?? 0) <= seconds
    ) {
      index += 1;
    }
    return index;
  }
}
