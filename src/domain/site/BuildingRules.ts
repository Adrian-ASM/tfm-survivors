import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import { WeaponType, type WeaponTypeConfig } from '../weapon/WeaponType';

/** Tipos de edificio en el orden fijo de la oferta de obra (spec build-sites 0026). */
export const BUILDING_KINDS = ['house', 'tower'] as const;

export type BuildingKind = (typeof BUILDING_KINDS)[number];

/** ¿Es un tipo de edificio del contenido? (entrada del adaptador, sin validar). */
export const isBuildingKind = (kind: string): kind is BuildingKind =>
  (BUILDING_KINDS as readonly string[]).includes(kind);

/**
 * Separación máxima (px) entre el círculo del jugador y el rectángulo de la huella para que el
 * jugador **toque** un solar (design 0027 §1.4): g ≤ ε. Constante del dominio, no contenido; el
 * barrido deja al jugador tangente (g ≈ 0), así que vale igual en caras y esquinas.
 */
export const CONTACT_EPS = 1;

/** Mensajes de las invariantes de los edificios; la validación de contenido (zod) usa los mismos. */
export const BUILDING_WOOD_MUST_BE_INTEGER = 'La madera de un edificio debe ser un entero ≥ 1.';
export const BUILDING_STONE_MUST_BE_INTEGER = 'La piedra de un edificio debe ser un entero ≥ 0.';
export const HOUSE_INCOME_MUST_BE_INTEGER =
  'El oro por pago y el periodo de la casa deben ser enteros ≥ 1.';
export const TOWER_PROJECTILES_MUST_BE_INTEGER =
  'El tope de flechas de torre debe ser un entero ≥ 1.';
export const TOWER_WEAPON_MUST_BE_NEAREST_PROJECTILE =
  'El arma de la torre debe ser `nearest-in-range` con `projectile`.';
export const CONTACT_REARM_MUST_EXCEED_EPS =
  'La separación de re-armado de un solar debe ser un número finito mayor que ε (1 px).';
export const SITE_PLACEMENT_MUST_BE_INTEGER =
  'Los parámetros de colocación de los solares deben ser enteros ≥ 0 (la huella, ≥ 1).';
export const SITE_ROUTE_MIN_ABOVE_MAX =
  'El mínimo de ruta de los solares no puede superar el máximo.';

/** Coste de un edificio. */
export interface BuildingCost {
  readonly wood: number;
  readonly stone: number;
}

/** Colocación de los solares en el mapa generado (spec procedural-map 0026, design §3). */
export interface SitePlacementConfig {
  readonly count: number;
  readonly footprint: { readonly cols: number; readonly rows: number };
  readonly minGapCells: number;
  readonly minWaterCells: number;
  readonly minCastleCells: number;
  readonly minStartCells: number;
  readonly minStructureCells: number;
  readonly route: { readonly min: number; readonly max: number };
}

/** Contenido de los solares y edificios (content/buildings.json, spec build-sites 0026). */
export interface BuildingsConfig {
  readonly sites: SitePlacementConfig;
  readonly contact: { readonly rearmDistance: number };
  readonly house: {
    readonly cost: BuildingCost;
    readonly income: { readonly gold: number; readonly everyTicks: number };
  };
  readonly tower: {
    readonly cost: BuildingCost;
    readonly maxProjectiles: number;
    readonly weapon: WeaponTypeConfig;
  };
}

const PATH = 'buildings';
const isInt = (v: number, min: number): boolean => Number.isInteger(v) && v >= min;

function checkCost(cost: BuildingCost, path: string): DomainError | null {
  if (!isInt(cost.wood, 1)) return invalidConfig(`${path}.wood`, BUILDING_WOOD_MUST_BE_INTEGER);
  if (!isInt(cost.stone, 0)) return invalidConfig(`${path}.stone`, BUILDING_STONE_MUST_BE_INTEGER);
  return null;
}

function checkPlacement(p: SitePlacementConfig): DomainError | null {
  const path = `${PATH}.sites`;
  const counts = [
    ['count', p.count, 0],
    ['footprint.cols', p.footprint.cols, 1],
    ['footprint.rows', p.footprint.rows, 1],
    ['minGapCells', p.minGapCells, 0],
    ['minWaterCells', p.minWaterCells, 0],
    ['minCastleCells', p.minCastleCells, 0],
    ['minStartCells', p.minStartCells, 0],
    ['minStructureCells', p.minStructureCells, 0],
    ['route.min', p.route.min, 0],
    ['route.max', p.route.max, 0],
  ] as const;
  const bad = counts.find(([, v, min]) => !isInt(v, min));
  if (bad) return invalidConfig(`${path}.${bad[0]}`, SITE_PLACEMENT_MUST_BE_INTEGER);
  if (p.route.min > p.route.max)
    return invalidConfig(`${path}.route.min`, SITE_ROUTE_MIN_ABOVE_MAX);
  return null;
}

function checkContact(config: BuildingsConfig): DomainError | null {
  const { rearmDistance } = config.contact;
  if (!(Number.isFinite(rearmDistance) && rearmDistance > CONTACT_EPS)) {
    return invalidConfig(`${PATH}.contact.rearmDistance`, CONTACT_REARM_MUST_EXCEED_EPS);
  }
  return null;
}

/** Arma de la torre: un arma válida, y además `nearest-in-range` con `projectile`. */
function towerWeapon(config: WeaponTypeConfig): Result<WeaponType, DomainError> {
  const path = `${PATH}.tower.weapon`;
  const weapon = WeaponType.create(config, path);
  if (!weapon.ok) return weapon;
  const { targeting, attack } = weapon.value;
  if (attack.type !== 'projectile') {
    return err(invalidConfig(`${path}.attack.type`, TOWER_WEAPON_MUST_BE_NEAREST_PROJECTILE));
  }
  if (targeting.mode !== 'nearest-in-range') {
    return err(invalidConfig(`${path}.targeting.mode`, TOWER_WEAPON_MUST_BE_NEAREST_PROJECTILE));
  }
  return weapon;
}

/**
 * Reglas de los solares y edificios (value object, spec build-sites 0026 y 0027): colocación,
 * separación de re-armado del contacto, costes por tipo, ingreso de la casa y arma y tope de flechas
 * de la torre. La única implementación de sus invariantes (zod las llama desde el superRefine).
 */
export class BuildingRules {
  private constructor(
    readonly sites: SitePlacementConfig,
    readonly contact: { readonly rearmDistance: number },
    private readonly costs: Readonly<Record<BuildingKind, BuildingCost>>,
    readonly income: { readonly gold: number; readonly everyTicks: number },
    readonly towerWeapon: WeaponType,
    readonly maxTowerProjectiles: number,
  ) {
    Object.freeze(this);
  }

  /** Coste del tipo de edificio. */
  cost(kind: BuildingKind): BuildingCost {
    return this.costs[kind];
  }

  static create(config: BuildingsConfig): Result<BuildingRules, DomainError> {
    const problem =
      checkPlacement(config.sites) ??
      checkCost(config.house.cost, `${PATH}.house.cost`) ??
      checkIncome(config.house.income) ??
      checkCost(config.tower.cost, `${PATH}.tower.cost`) ??
      checkContact(config);
    if (problem) return err(problem);
    const weapon = towerWeapon(config.tower.weapon);
    if (!weapon.ok) return weapon;
    if (!isInt(config.tower.maxProjectiles, 1)) {
      return err(invalidConfig(`${PATH}.tower.maxProjectiles`, TOWER_PROJECTILES_MUST_BE_INTEGER));
    }
    const sites = structuredClone(config.sites);
    return ok(
      new BuildingRules(
        Object.freeze({
          ...sites,
          footprint: Object.freeze(sites.footprint),
          route: Object.freeze(sites.route),
        }),
        Object.freeze({ rearmDistance: config.contact.rearmDistance }),
        Object.freeze({
          house: Object.freeze({ ...config.house.cost }),
          tower: Object.freeze({ ...config.tower.cost }),
        }),
        Object.freeze({ ...config.house.income }),
        weapon.value,
        config.tower.maxProjectiles,
      ),
    );
  }
}

function checkIncome(income: { readonly gold: number; readonly everyTicks: number }) {
  const path = `${PATH}.house.income`;
  if (!isInt(income.gold, 1)) return invalidConfig(`${path}.gold`, HOUSE_INCOME_MUST_BE_INTEGER);
  if (!isInt(income.everyTicks, 1)) {
    return invalidConfig(`${path}.everyTicks`, HOUSE_INCOME_MUST_BE_INTEGER);
  }
  return null;
}
