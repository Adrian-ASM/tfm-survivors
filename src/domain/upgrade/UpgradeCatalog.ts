import type { Arena } from '../arena/Arena';
import { checkPlayer, type PlayerRules } from '../player/PlayerRules';
import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import type { WeaponLoadout } from '../weapon/WeaponLoadout';
import { WeaponType } from '../weapon/WeaponType';
import {
  INTEGER_STATS,
  TARGETING_STAT,
  UPGRADE_ID_MUST_BE_UNIQUE,
  UPGRADE_STAT_INCOMPATIBLE,
  UPGRADE_STAT_OUT_OF_RANGE,
  UPGRADE_STEP_MUST_BE_INTEGER,
  UPGRADE_UNKNOWN_WEAPON,
  UPGRADE_WRONG_CATALOG,
  UpgradeType,
  isWeaponStat,
  type UpgradeSource,
  type UpgradeTypeConfig,
} from './UpgradeType';
import { bestCase, playerWith, weaponWith, worstCase } from './upgradeStats';

/** Los dos catálogos del contenido (content/upgrades.json, ADR-0023). */
export interface UpgradeLists {
  /** Mejoras de personaje (oferta por XP), objetivo el jugador. */
  readonly character: readonly UpgradeTypeConfig[];
  /** Mejoras de arma (tienda, con precio por nivel), objetivo un arma. */
  readonly weapons: readonly UpgradeTypeConfig[];
}

/** Ruta de cada catálogo en el contenido y su origen. */
const LISTS = [
  { key: 'character', source: 'level', kind: 'player' },
  { key: 'weapons', source: 'shop', kind: 'weapon' },
] as const satisfies readonly {
  key: keyof UpgradeLists;
  source: UpgradeSource;
  kind: 'player' | 'weapon';
}[];

/** Regla de compatibilidad estadística ↔ objetivo; `null` si la mejora es compatible. */
function checkCompatible(
  u: UpgradeTypeConfig,
  weapon: WeaponType | undefined,
  path: string,
): DomainError | null {
  const compatible =
    u.target.kind === 'player'
      ? !isWeaponStat(u.stat)
      : weapon !== undefined &&
        isWeaponStat(u.stat) &&
        (u.stat === 'damage' ||
          u.stat === 'cooldownTicks' ||
          u.stat === TARGETING_STAT[weapon.targeting.mode]);
  if (compatible) return null;
  return invalidConfig(`${path}.stat`, `${UPGRADE_STAT_INCOMPATIBLE}: ${u.id} (${u.stat})`);
}

function checkIntegerStep(u: UpgradeTypeConfig, path: string): DomainError | null {
  if (!INTEGER_STATS.has(u.stat) || Number.isInteger(u.perLevel)) return null;
  return invalidConfig(`${path}.perLevel`, `${UPGRADE_STEP_MUST_BE_INTEGER}: ${u.id} (${u.stat})`);
}

/** Última parte de la ruta del error de una fábrica (`linter.targeting.range` → `range`). */
const statOf = (field: string): string => field.slice(field.lastIndexOf('.') + 1);

/**
 * Catálogo de mejoras (value object, ADR-0008 y ADR-0023): las de personaje y después las de arma,
 * en un solo vector de índices (`levelIndices` y `shopIndices` lo separan por origen). Reglas
 * cruzadas con el loadout y el jugador: ids únicos entre los dos catálogos, cada mejora en el
 * catálogo de su objetivo, arma existente, estadística compatible con el objetivo, incremento entero
 * en las estadísticas enteras y **build de peor caso** (cada estadística a
 * `base + Σ min(0, perLevel · maxLevel)` validada con las mismas fábricas). Catálogos vacíos son
 * válidos en el dominio: que el fichero exija ≥ 1 mejora en cada uno es una regla de forma.
 */
export class UpgradeCatalog {
  private constructor(
    readonly upgrades: readonly UpgradeType[],
    /** Ruta en el contenido de cada mejora (mismo índice). */
    private readonly paths: readonly string[],
    /** Cota de pulsos visibles a la vez con la cadencia mínima alcanzable (peor caso). */
    readonly pulseCapacity: number,
    /** Índices de las mejoras de personaje (oferta), en orden de catálogo. */
    readonly levelIndices: readonly number[],
    /** Índices de las mejoras de arma (tienda), en orden de catálogo. */
    readonly shopIndices: readonly number[],
  ) {
    Object.freeze(this);
  }

  static create(
    lists: UpgradeLists,
    loadout: WeaponLoadout,
    player: PlayerRules,
    arena: Arena,
  ): Result<UpgradeCatalog, DomainError> {
    const upgrades: UpgradeType[] = [];
    const paths: string[] = [];
    const ids = new Set<string>();
    for (const { key, source, kind } of LISTS) {
      for (const [i, u] of lists[key].entries()) {
        const path = `upgrades.${key}.${String(i)}`;
        const type = UpgradeType.create(u, path, source);
        if (!type.ok) return type;
        if (ids.has(u.id)) {
          return err(invalidConfig(`${path}.id`, `${UPGRADE_ID_MUST_BE_UNIQUE}: ${u.id}`));
        }
        ids.add(u.id);
        const target = u.target;
        if (target.kind !== kind) {
          return err(invalidConfig(`${path}.target`, `${UPGRADE_WRONG_CATALOG}: ${u.id}`));
        }
        const weapon =
          target.kind === 'weapon'
            ? loadout.weapons.find((w) => w.id === target.weapon)
            : undefined;
        if (target.kind === 'weapon' && !weapon) {
          const message = `${UPGRADE_UNKNOWN_WEAPON}: ${target.weapon} (${u.id})`;
          return err(invalidConfig(`${path}.target.weapon`, message));
        }
        const problem = checkCompatible(u, weapon, path) ?? checkIntegerStep(u, path);
        if (problem) return err(problem);
        upgrades.push(type.value);
        paths.push(path);
      }
    }
    const catalog = { upgrades };
    let pulseCapacity = 0;
    for (const base of loadout.weapons) {
      const config = weaponWith(base, catalog, worstCase);
      const worst = WeaponType.create(config, base.id);
      if (!worst.ok) {
        const stat = statOf(worst.error.field);
        const holder = stat === 'range' || stat === 'radius' ? config.targeting : config;
        return err(outOfRange(upgrades, paths, base.id, stat, valueOf(holder, stat)));
      }
      const { attack, cooldownTicks } = worst.value;
      if (attack.type === 'pulse') pulseCapacity += Math.ceil(attack.visualTicks / cooldownTicks);
    }
    const worstPlayer = playerWith(player, catalog, worstCase);
    const playerError = checkPlayer(worstPlayer, arena);
    if (playerError) {
      const stat = statOf(playerError.field);
      return err(outOfRange(upgrades, paths, 'player', stat, valueOf(worstPlayer, stat)));
    }
    const indicesOf = (source: UpgradeSource) =>
      Object.freeze(upgrades.flatMap((u, i) => (u.source === source ? [i] : [])));
    return ok(
      new UpgradeCatalog(
        Object.freeze(upgrades),
        Object.freeze(paths),
        pulseCapacity,
        indicesOf('level'),
        indicesOf('shop'),
      ),
    );
  }

  get size(): number {
    return this.upgrades.length;
  }

  /** Ruta en el contenido de la mejora i (p. ej. `upgrades.character.8`). */
  pathOf(index: number): string {
    return this.paths[index] ?? 'upgrades';
  }

  /**
   * Cota de la curación de la carne efectiva (spec upgrades 0024): `base + Σ meatHealPercent` en
   * [1, 100] con el peor caso (incrementos negativos al máximo) y el mejor (positivos al máximo).
   * La comprueba `buildRunRules`, que conoce la curación de la carne del contenido (`base`).
   */
  checkMeatHeal(base: number): DomainError | null {
    const stat = 'meatHealPercent';
    const meat = this.upgrades.map((u, i) => ({ u, i })).filter(({ u }) => u.stat === stat);
    const low = base + meat.reduce((s, { u }) => s + worstCase(u, 0), 0);
    const high = base + meat.reduce((s, { u }) => s + bestCase(u, 0), 0);
    const bad = low < 1 ? { value: low, sign: -1 } : high > 100 ? { value: high, sign: 1 } : null;
    if (!bad) return null;
    const culprits = meat.filter(({ u }) => Math.sign(u.perLevel) === bad.sign);
    const names = culprits.map(({ u }) => u.id).join(', ');
    const message = `${UPGRADE_STAT_OUT_OF_RANGE}: player.${stat} = ${String(bad.value)} (${names})`;
    return invalidConfig(`${this.pathOf(culprits[0]?.i ?? 0)}.perLevel`, message);
  }

  /** Índice de la mejora con ese id, o −1. */
  indexOf(id: string): number {
    return this.upgrades.findIndex((u) => u.id === id);
  }
}

function valueOf(source: object, stat: string): number {
  const v: unknown = (source as Record<string, unknown>)[stat];
  return typeof v === 'number' ? v : Number.NaN;
}

/**
 * Error del peor caso en `…perLevel` de la primera mejora que baja esa estadística, con el valor
 * alcanzado y las mejoras que la bajan (p. ej. `linter.cooldownTicks = 0 (fast-ci)`).
 */
function outOfRange(
  upgrades: readonly UpgradeType[],
  paths: readonly string[],
  owner: string,
  stat: string,
  value: number,
): DomainError {
  const lowering = upgrades
    .map((u, i) => ({ u, i }))
    .filter(({ u }) => {
      const target = u.target.kind === 'player' ? 'player' : u.target.weapon;
      return target === owner && u.stat === stat && u.perLevel < 0;
    });
  const first = paths[lowering[0]?.i ?? 0] ?? 'upgrades';
  const names = lowering.map(({ u }) => u.id).join(', ');
  const message = `${UPGRADE_STAT_OUT_OF_RANGE}: ${owner}.${stat} = ${String(value)} (${names})`;
  return invalidConfig(`${first}.perLevel`, message);
}
