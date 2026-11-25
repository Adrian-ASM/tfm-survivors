import type { MapRules } from '../map/MapRules';
import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import { WeaponType, type WeaponTypeConfig } from '../weapon/WeaponType';

/** Tipos de edificio en el orden fijo de la oferta de obra (spec build-sites 0026). */
export const BUILDING_KINDS = ['house', 'tower'] as const;

export type BuildingKind = (typeof BUILDING_KINDS)[number];

/** ¿Es un tipo de edificio del contenido? (entrada del adaptador, sin validar). */
export const isBuildingKind = (kind: string): kind is BuildingKind =>
  (BUILDING_KINDS as readonly string[]).includes(kind);

/**
 * Celdas entre el borde inferior de la huella y el acceso (design 0026 §1): el acceso queda en el
 * centro de la fila r + rows + 1, separado de la huella por una fila libre. Es geometría del solar,
 * no contenido.
 */
export const ACCESS_OFFSET_CELLS = 1.5;

/** Mensajes de las invariantes de los edificios; la validación de contenido (zod) usa los mismos. */
export const BUILDING_WOOD_MUST_BE_INTEGER = 'La madera de un edificio debe ser un entero ≥ 1.';
export const BUILDING_STONE_MUST_BE_INTEGER = 'La piedra de un edificio debe ser un entero ≥ 0.';
export const HOUSE_INCOME_MUST_BE_INTEGER =
  'El oro por pago y el periodo de la casa deben ser enteros ≥ 1.';
export const TOWER_PROJECTILES_MUST_BE_INTEGER =
  'El tope de flechas de torre debe ser un entero ≥ 1.';
export const TOWER_WEAPON_MUST_BE_NEAREST_PROJECTILE =
  'El arma de la torre debe ser `nearest-in-range` con `projectile`.';
export const ACCESS_RADIUS_MUST_BE_POSITIVE = 'El radio de oferta del acceso debe ser > 0.';
export const ACCESS_REARM_MUST_EXCEED_RADIUS =
  'La distancia de re-armado de un solar debe ser mayor que el radio de oferta.';
export const ACCESS_TOO_CLOSE =
  'El radio de oferta más el radio del jugador debe ser < 1,5 celdas ' +
  '(el jugador no puede tocar la huella al abrir)';
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
  readonly access: { readonly radius: number; readonly rearmDistance: number };
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

function checkAccess(config: BuildingsConfig, map: MapRules): DomainError | null {
  const { radius, rearmDistance } = config.access;
  const path = `${PATH}.access`;
  if (!(Number.isFinite(radius) && radius > 0)) {
    return invalidConfig(`${path}.radius`, ACCESS_RADIUS_MUST_BE_POSITIVE);
  }
  if (!(Number.isFinite(rearmDistance) && rearmDistance > radius)) {
    return invalidConfig(`${path}.rearmDistance`, ACCESS_REARM_MUST_EXCEED_RADIUS);
  }
  // Design §1: el jugador a d < radio del acceso nunca solapa la huella (spec "Jugador fuera...").
  if (!(radius + map.playerRadius < ACCESS_OFFSET_CELLS * map.cellSize)) {
    return invalidConfig(`${path}.radius`, ACCESS_TOO_CLOSE);
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
 * Reglas de los solares y edificios (value object, spec build-sites 0026): colocación, acceso,
 * costes por tipo, ingreso de la casa y arma y tope de flechas de la torre. La única
 * implementación de sus invariantes y de la regla cruzada con el mapa y el jugador (design §1).
 */
export class BuildingRules {
  private constructor(
    readonly sites: SitePlacementConfig,
    readonly access: { readonly radius: number; readonly rearmDistance: number },
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

  static create(config: BuildingsConfig, map: MapRules): Result<BuildingRules, DomainError> {
    const problem =
      checkPlacement(config.sites) ??
      checkCost(config.house.cost, `${PATH}.house.cost`) ??
      checkIncome(config.house.income) ??
      checkCost(config.tower.cost, `${PATH}.tower.cost`) ??
      checkAccess(config, map);
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
        Object.freeze({ ...config.access }),
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
