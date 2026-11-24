import type { EnemyCatalog } from '../enemy/EnemyCatalog';
import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import type { StructureRules } from '../structure/StructureRules';

/** Mensajes de las invariantes de los recursos; la validación de contenido (zod) usa los mismos. */
export const RESOURCE_AMOUNT_MUST_BE_INTEGER = 'Una cantidad de recursos debe ser un entero ≥ 1.';
export const RESOURCE_COUNT_MUST_BE_INTEGER =
  'El número de vetas o de montones por mapa debe ser un entero ≥ 0.';
export const VEIN_RADIUS_MUST_BE_POSITIVE = 'El radio de contacto de una veta debe ser positivo.';
export const RESOURCE_PLACEMENT_MUST_BE_INTEGER =
  'Una distancia de colocación de recursos debe ser un entero ≥ 0 (en celdas).';
export const MEAT_HEAL_PERCENT_OUT_OF_RANGE =
  'La curación de la carne debe ser un entero entre 1 y 100 (% de la vida máxima).';
export const RESOURCE_DROP_UNKNOWN_ENEMY = 'Drop de recursos de un tipo de enemigo desconocido';
export const RESOURCE_GOLD_PER_KILL_INVALID =
  'El oro por baja necesita un entero ≥ 0 para cada tipo de enemigo y ninguno más';
export const RESOURCE_DROP_UNKNOWN_STRUCTURE =
  'Drop de recursos de un tipo de estructura desconocido';

const PATH = 'resources';

/** Distancias de colocación de vetas y montones, en celdas de Chebyshev (spec procedural-map). */
export interface ResourcePlacementConfig {
  readonly minStartCells: number;
  readonly minCastleCells: number;
  readonly minGapCells: number;
}

/** Carne de las ovejas (spec resources 0023): valor por oveja y % de vida máxima por unidad. */
export interface MeatConfig {
  readonly perSheep: number;
  readonly healPercent: number;
}

/** Fuentes de oro, madera y carne (content/resources.json, spec resources, ADR-0021). */
export interface ResourcesConfig {
  readonly drops: {
    /** Madera por baja sin explotar, por id de tipo de enemigo. */
    readonly enemies: Readonly<Record<string, { readonly wood: number }>>;
    /** Oro por estructura destruida, por id de tipo de estructura. */
    readonly structures: Readonly<Record<string, { readonly gold: number }>>;
    /**
     * Oro por enemigo abatido (0024), por id de tipo: si está, exactamente los tipos del catálogo,
     * enteros ≥ 0. Ausente (válido en el dominio, no en el fichero), ningún tipo suelta oro.
     */
    readonly goldPerKill?: Readonly<Record<string, number>>;
  };
  readonly woodPiles: { readonly count: number; readonly wood: number };
  readonly goldVeins: { readonly count: number; readonly gold: number; readonly radius: number };
  readonly placement: ResourcePlacementConfig;
  readonly meat: MeatConfig;
}

const isAmount = (v: number): boolean => Number.isInteger(v) && v >= 1;
const isCount = (v: number): boolean => Number.isInteger(v) && v >= 0;

const amountError = (field: string): DomainError =>
  invalidConfig(`${PATH}.${field}`, RESOURCE_AMOUNT_MUST_BE_INTEGER);

/** Cantidades, números por mapa, radio y distancias (sin referencias cruzadas). */
function checkScalars(c: ResourcesConfig): DomainError | null {
  const { woodPiles, goldVeins, placement, meat } = c;
  if (!isCount(woodPiles.count)) {
    return invalidConfig(`${PATH}.woodPiles.count`, RESOURCE_COUNT_MUST_BE_INTEGER);
  }
  if (!isAmount(woodPiles.wood)) return amountError('woodPiles.wood');
  if (!isCount(goldVeins.count)) {
    return invalidConfig(`${PATH}.goldVeins.count`, RESOURCE_COUNT_MUST_BE_INTEGER);
  }
  if (!isAmount(goldVeins.gold)) return amountError('goldVeins.gold');
  if (!(Number.isFinite(goldVeins.radius) && goldVeins.radius > 0)) {
    return invalidConfig(`${PATH}.goldVeins.radius`, VEIN_RADIUS_MUST_BE_POSITIVE);
  }
  if (!isAmount(meat.perSheep)) return amountError('meat.perSheep');
  const heal = meat.healPercent;
  if (!(Number.isInteger(heal) && heal >= 1 && heal <= 100)) {
    return invalidConfig(`${PATH}.meat.healPercent`, MEAT_HEAL_PERCENT_OUT_OF_RANGE);
  }
  const keys = ['minStartCells', 'minCastleCells', 'minGapCells'] as const;
  const bad = keys.find((k) => !isCount(placement[k]));
  return bad ? invalidConfig(`${PATH}.placement.${bad}`, RESOURCE_PLACEMENT_MUST_BE_INTEGER) : null;
}

/** Drops por id resueltos contra los ids conocidos, o el primer error en orden del contenido. */
function resolveDrops<K extends string>(
  entries: Readonly<Record<string, Readonly<Record<K, number>>>>,
  key: K,
  known: (id: string) => boolean,
  group: 'enemies' | 'structures',
  unknown: string,
): Result<ReadonlyMap<string, number>, DomainError> {
  const out = new Map<string, number>();
  for (const [id, drop] of Object.entries(entries)) {
    const at = `drops.${group}.${id}`;
    if (!known(id)) return err(invalidConfig(`${PATH}.${at}`, `${unknown}: ${id}`));
    if (!isAmount(drop[key])) return err(amountError(`${at}.${key}`));
    out.set(id, drop[key]);
  }
  return ok(out);
}

/**
 * Oro por baja resuelto contra el catálogo (spec resources 0024): un tipo de más, un valor que no es
 * entero ≥ 0 o un tipo que falta es un error que nombra el tipo.
 */
function resolveGoldPerKill(
  table: Readonly<Record<string, number>> | undefined,
  catalog: EnemyCatalog,
): Result<ReadonlyMap<string, number>, DomainError> {
  const out = new Map<string, number>();
  if (!table) return ok(out);
  const fail = (id: string) =>
    err(
      invalidConfig(`${PATH}.drops.goldPerKill.${id}`, `${RESOURCE_GOLD_PER_KILL_INVALID}: ${id}`),
    );
  for (const [id, gold] of Object.entries(table)) {
    if (catalog.get(id) === undefined || !isCount(gold)) return fail(id);
    out.set(id, gold);
  }
  const missing = catalog.ids.find((id) => !out.has(id));
  return missing === undefined ? ok(out) : fail(missing);
}

/**
 * Reglas de los recursos de la partida (value object, spec resources): cantidades de cada fuente,
 * montones y vetas por mapa y su colocación. Un tipo sin drop no suelta nada (mapas vacíos válidos).
 */
export class ResourceRules {
  private constructor(
    private readonly wood: ReadonlyMap<string, number>,
    private readonly gold: ReadonlyMap<string, number>,
    readonly woodPiles: ResourcesConfig['woodPiles'],
    readonly goldVeins: ResourcesConfig['goldVeins'],
    readonly placement: ResourcePlacementConfig,
    /** Carne por oveja y curación por unidad (0023). */
    readonly meat: MeatConfig,
    private readonly goldPerKill: ReadonlyMap<string, number>,
  ) {
    Object.freeze(this);
  }

  /** Madera que suelta la baja sin explotar de un tipo de enemigo (0 si ninguna). */
  woodFor(enemyType: string): number {
    return this.wood.get(enemyType) ?? 0;
  }

  /** Oro que suelta un enemigo abatido de ese tipo (0 si ninguno, 0024). */
  goldForEnemy(enemyType: string): number {
    return this.goldPerKill.get(enemyType) ?? 0;
  }

  /** Oro que suelta un tipo de estructura al quedar destruida (0 si ninguno). */
  goldFor(structureType: string): number {
    return this.gold.get(structureType) ?? 0;
  }

  static create(
    config: ResourcesConfig,
    catalog: EnemyCatalog,
    structures: StructureRules,
  ): Result<ResourceRules, DomainError> {
    const wood = resolveDrops(
      config.drops.enemies,
      'wood',
      (id) => catalog.get(id) !== undefined,
      'enemies',
      RESOURCE_DROP_UNKNOWN_ENEMY,
    );
    if (!wood.ok) return wood;
    const gold = resolveDrops(
      config.drops.structures,
      'gold',
      (id) => structures.byId(id) !== undefined,
      'structures',
      RESOURCE_DROP_UNKNOWN_STRUCTURE,
    );
    if (!gold.ok) return gold;
    const perKill = resolveGoldPerKill(config.drops.goldPerKill, catalog);
    if (!perKill.ok) return perKill;
    const scalarError = checkScalars(config);
    if (scalarError) return err(scalarError);
    return ok(
      new ResourceRules(
        wood.value,
        gold.value,
        Object.freeze({ ...config.woodPiles }),
        Object.freeze({ ...config.goldVeins }),
        Object.freeze({ ...config.placement }),
        Object.freeze({ ...config.meat }),
        perKill.value,
      ),
    );
  }
}
