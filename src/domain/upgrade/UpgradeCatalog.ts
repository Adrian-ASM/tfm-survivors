import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import type { WeaponLoadout } from '../weapon/WeaponLoadout';
import type { WeaponType } from '../weapon/WeaponType';
import {
  TARGETING_STAT,
  UPGRADE_ID_MUST_BE_UNIQUE,
  UPGRADE_STAT_INCOMPATIBLE,
  UPGRADE_UNKNOWN_WEAPON,
  UpgradeType,
  isWeaponStat,
  type UpgradeTypeConfig,
} from './UpgradeType';

const PATH = 'upgrades.upgrades';

/** Regla de compatibilidad estadística ↔ objetivo; `null` si la mejora es compatible. */
function checkCompatible(
  u: UpgradeTypeConfig,
  weapon: WeaponType | undefined,
  path: string,
): DomainError | null {
  const ok =
    u.target.kind === 'player'
      ? !isWeaponStat(u.stat)
      : weapon !== undefined &&
        isWeaponStat(u.stat) &&
        (u.stat === 'damage' ||
          u.stat === 'cooldownTicks' ||
          u.stat === TARGETING_STAT[weapon.targeting.mode]);
  if (ok) return null;
  const message = `${UPGRADE_STAT_INCOMPATIBLE}: ${u.id} (${u.stat})`;
  return invalidConfig(`${path}.stat`, message);
}

/**
 * Catálogo de mejoras (value object, ADR-0008), en el orden del contenido. Reglas cruzadas con el
 * loadout y el jugador: ids únicos, arma existente y estadística compatible con el objetivo. Un
 * catálogo vacío es válido en el dominio: que el fichero exija ≥ 1 mejora es una regla de forma.
 */
export class UpgradeCatalog {
  private constructor(readonly upgrades: readonly UpgradeType[]) {
    Object.freeze(this);
  }

  static create(
    configs: readonly UpgradeTypeConfig[],
    loadout: WeaponLoadout,
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
      const incompatible = checkCompatible(u, weapon, path);
      if (incompatible) return err(incompatible);
      upgrades.push(type.value);
    }
    return ok(new UpgradeCatalog(Object.freeze(upgrades)));
  }

  get size(): number {
    return this.upgrades.length;
  }
}
