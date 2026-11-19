import type { Arena } from '../arena/Arena';
import { checkPlayer, type PlayerRules } from '../player/PlayerRules';
import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import type { WeaponLoadout } from '../weapon/WeaponLoadout';
import { WeaponType } from '../weapon/WeaponType';
import {
  TARGETING_STAT,
  UPGRADE_ID_MUST_BE_UNIQUE,
  UPGRADE_STAT_INCOMPATIBLE,
  UPGRADE_STAT_OUT_OF_RANGE,
  UPGRADE_STEP_MUST_BE_INTEGER,
  UPGRADE_UNKNOWN_WEAPON,
  UpgradeType,
  isWeaponStat,
  type UpgradeTypeConfig,
} from './UpgradeType';
import { playerWith, weaponWith, worstCase } from './upgradeStats';

const PATH = 'upgrades.upgrades';

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
  if ((u.stat !== 'damage' && u.stat !== 'cooldownTicks') || Number.isInteger(u.perLevel)) {
    return null;
  }
  return invalidConfig(`${path}.perLevel`, `${UPGRADE_STEP_MUST_BE_INTEGER}: ${u.id} (${u.stat})`);
}

/** Última parte de la ruta del error de una fábrica (`linter.targeting.range` → `range`). */
const statOf = (field: string): string => field.slice(field.lastIndexOf('.') + 1);

/**
 * Catálogo de mejoras (value object, ADR-0008), en el orden del contenido. Reglas cruzadas con el
 * loadout y el jugador: ids únicos, arma existente, estadística compatible con el objetivo,
 * incremento entero en daño y cadencia y **build de peor caso** (cada estadística a
 * `base + Σ min(0, perLevel · maxLevel)` validada con las mismas fábricas). Un catálogo vacío es
 * válido en el dominio: que el fichero exija ≥ 1 mejora es una regla de forma.
 */
export class UpgradeCatalog {
  private constructor(
    readonly upgrades: readonly UpgradeType[],
    /** Cota de pulsos visibles a la vez con la cadencia mínima alcanzable (peor caso). */
    readonly pulseCapacity: number,
  ) {
    Object.freeze(this);
  }

  static create(
    configs: readonly UpgradeTypeConfig[],
    loadout: WeaponLoadout,
    player: PlayerRules,
    arena: Arena,
  ): Result<UpgradeCatalog, DomainError> {
    const upgrades: UpgradeType[] = [];
    const ids = new Set<string>();
    for (const [i, u] of configs.entries()) {
      const path = `${PATH}.${String(i)}`;
      const type = UpgradeType.create(u, path);
      if (!type.ok) return type;
      if (ids.has(u.id)) {
        return err(invalidConfig(`${path}.id`, `${UPGRADE_ID_MUST_BE_UNIQUE}: ${u.id}`));
      }
      ids.add(u.id);
      const target = u.target;
      const weapon =
        target.kind === 'weapon' ? loadout.weapons.find((w) => w.id === target.weapon) : undefined;
      if (target.kind === 'weapon' && !weapon) {
        const message = `${UPGRADE_UNKNOWN_WEAPON}: ${target.weapon} (${u.id})`;
        return err(invalidConfig(`${path}.target.weapon`, message));
      }
      const problem = checkCompatible(u, weapon, path) ?? checkIntegerStep(u, path);
      if (problem) return err(problem);
      upgrades.push(type.value);
    }
    const catalog = { upgrades };
    let pulseCapacity = 0;
    for (const base of loadout.weapons) {
      const config = weaponWith(base, catalog, worstCase);
      const worst = WeaponType.create(config, base.id);
      if (!worst.ok) {
        const stat = statOf(worst.error.field);
        const holder = stat === 'range' || stat === 'radius' ? config.targeting : config;
        return err(outOfRange(upgrades, base.id, stat, valueOf(holder, stat)));
      }
      const { attack, cooldownTicks } = worst.value;
      if (attack.type === 'pulse') pulseCapacity += Math.ceil(attack.visualTicks / cooldownTicks);
    }
    const worstPlayer = playerWith(player, catalog, worstCase);
    const playerError = checkPlayer(worstPlayer, arena);
    if (playerError) {
      const stat = statOf(playerError.field);
      return err(outOfRange(upgrades, 'player', stat, valueOf(worstPlayer, stat)));
    }
    return ok(new UpgradeCatalog(Object.freeze(upgrades), pulseCapacity));
  }

  get size(): number {
    return this.upgrades.length;
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
  const first = lowering[0]?.i ?? 0;
  const names = lowering.map(({ u }) => u.id).join(', ');
  const message = `${UPGRADE_STAT_OUT_OF_RANGE}: ${owner}.${stat} = ${String(value)} (${names})`;
  return invalidConfig(`${PATH}.${String(first)}.perLevel`, message);
}
