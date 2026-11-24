import type { EnemyCatalog } from '../enemy/EnemyCatalog';
import type { EnemyType } from '../enemy/EnemyType';
import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';

/** Mensajes de las invariantes de las estructuras; la validación de contenido (zod) usa los mismos. */
export const STRUCTURE_VALUE_MUST_BE_POSITIVE =
  'La vida y el radio de impacto de una estructura deben ser positivos';
export const STRUCTURE_FOOTPRINT_MUST_FIT =
  'La huella de una estructura necesita enteros ≥ 1 y caber en la rejilla (con la puerta si es casa)';
export const STRUCTURE_COUNT_MUST_BE_INTEGER =
  'El número de estructuras de un tipo debe ser un entero ≥ 0';
export const STRUCTURE_GUARDS_MUST_BE_INTEGER =
  'El tope de guardias y el intervalo de nacimiento deben ser enteros ≥ 1';
export const STRUCTURE_GUARD_UNKNOWN = 'Tipo de guardia que el catálogo de enemigos no declara';
export const STRUCTURE_GUARD_NOT_PATROL =
  'El tipo de guardia de una casa debe empezar en un estado de patrulla';
export const STRUCTURE_PLACEMENT_MUST_BE_INTEGER =
  'Las distancias de colocación deben ser enteros ≥ 0 y los intentos un entero ≥ 1';

/** Guardias de una casa en el contenido: tipo, tope de vivos y ticks mínimos entre nacimientos. */
export interface GuardsConfig {
  readonly type: string;
  readonly max: number;
  readonly everyTicks: number;
}

/** Forma de un tipo de estructura en el contenido (content/structures.json, validada con zod). */
export interface StructureTypeConfig {
  readonly count: number;
  readonly footprint: { readonly cols: number; readonly rows: number };
  readonly radius: number;
  readonly health: number;
  /** Solo las casas: sin `guards`, el tipo es una torre (sin puerta, D4). */
  readonly guards?: GuardsConfig | undefined;
}

/** Parámetros de colocación en celdas (distancias de Chebyshev, spec goblin-structures). */
export interface StructurePlacementConfig {
  readonly minStartCells: number;
  readonly minCastleCells: number;
  readonly minWaterCells: number;
  readonly minGapCells: number;
  readonly maxAttempts: number;
}

/**
 * Contenido de estructuras: colocación y tipos por id. El orden de los ids es el de colocación
 * (casas y luego torres con el contenido por defecto).
 */
export interface StructuresConfig {
  readonly placement: StructurePlacementConfig;
  readonly types: Readonly<Record<string, StructureTypeConfig>>;
}

/** Clase de estructura: la casa tiene puerta y hace nacer guardias; la torre no (D4). */
export type StructureKind = 'house' | 'tower';

/** Guardias de una casa ya resueltos contra el catálogo. */
export interface StructureGuards {
  readonly type: EnemyType;
  readonly max: number;
  readonly everyTicks: number;
}

/** Rejilla en la que tiene que caber la huella. */
export interface StructureGrid {
  readonly cols: number;
  readonly rows: number;
}

const isPositive = (v: number): boolean => Number.isFinite(v) && v > 0;
const isInt = (v: number, min: number): boolean => Number.isInteger(v) && v >= min;

/**
 * Tipo de estructura (value object, ADR-0020). Invariantes: huella entera ≥ 1 que cabe en la
 * rejilla (una casa, también con su puerta debajo), vida y radio positivos, número entero ≥ 0 y,
 * en las casas, tope e intervalo enteros ≥ 1 con un tipo de guardia del catálogo que empieza en
 * patrulla.
 */
export class StructureType {
  readonly kind: StructureKind;

  private constructor(
    readonly id: string,
    readonly cols: number,
    readonly rows: number,
    readonly radius: number,
    readonly health: number,
    readonly count: number,
    readonly guards: StructureGuards | null,
  ) {
    this.kind = guards ? 'house' : 'tower';
    Object.freeze(this);
  }

  /** `path` es la ruta del tipo en el contenido (`structures.types.<id>`). */
  static create(
    id: string,
    config: StructureTypeConfig,
    grid: StructureGrid,
    catalog: EnemyCatalog,
    path: string,
  ): Result<StructureType, DomainError> {
    const bad = (field: string, base: string) =>
      err(invalidConfig(`${path}.${field}`, `${base} (${id})`));
    const { cols, rows } = config.footprint;
    const door = config.guards ? 1 : 0;
    if (!isInt(cols, 1) || cols > grid.cols)
      return bad('footprint.cols', STRUCTURE_FOOTPRINT_MUST_FIT);
    if (!isInt(rows, 1) || rows + door > grid.rows) {
      return bad('footprint.rows', STRUCTURE_FOOTPRINT_MUST_FIT);
    }
    if (!isPositive(config.radius)) return bad('radius', STRUCTURE_VALUE_MUST_BE_POSITIVE);
    if (!isPositive(config.health)) return bad('health', STRUCTURE_VALUE_MUST_BE_POSITIVE);
    if (!isInt(config.count, 0)) return bad('count', STRUCTURE_COUNT_MUST_BE_INTEGER);
    const guards = config.guards ? resolveGuards(config.guards, id, catalog, path) : ok(null);
    if (!guards.ok) return guards;
    const { radius, health, count } = config;
    return ok(new StructureType(id, cols, rows, radius, health, count, guards.value));
  }
}

function resolveGuards(
  g: GuardsConfig,
  id: string,
  catalog: EnemyCatalog,
  path: string,
): Result<StructureGuards, DomainError> {
  const at = `${path}.guards`;
  if (!isInt(g.max, 1)) {
    return err(invalidConfig(`${at}.max`, `${STRUCTURE_GUARDS_MUST_BE_INTEGER} (${id})`));
  }
  if (!isInt(g.everyTicks, 1)) {
    return err(invalidConfig(`${at}.everyTicks`, `${STRUCTURE_GUARDS_MUST_BE_INTEGER} (${id})`));
  }
  const type = catalog.get(g.type);
  if (!type) {
    return err(invalidConfig(`${at}.type`, `${STRUCTURE_GUARD_UNKNOWN}: ${g.type} (${id})`));
  }
  if (!type.behavior.isGuard) {
    return err(invalidConfig(`${at}.type`, `${STRUCTURE_GUARD_NOT_PATROL}: ${g.type} (${id})`));
  }
  return ok(Object.freeze({ type, max: g.max, everyTicks: g.everyTicks }));
}
