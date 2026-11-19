import type { PlayerRules } from '../player/PlayerRules';
import { assertNever } from '../shared/assertNever';
import type { TargetingConfig, WeaponTypeConfig } from '../weapon/WeaponType';
import type { PlayerStat, UpgradeType, WeaponStat } from './UpgradeType';

/** Cuánto aporta la mejora i del catálogo a su estadística (nivel × incremento, o el peor caso). */
export type Contribution = (upgrade: UpgradeType, index: number) => number;

/** Lo mínimo que se necesita del catálogo: sus mejoras en orden (evita el ciclo con el catálogo). */
interface Upgrades {
  readonly upgrades: readonly UpgradeType[];
}

/** Aporte de un nivel concreto por mejora (`levels[i]`, 0 si falta). */
export const byLevels =
  (levels: readonly number[]): Contribution =>
  (u, i) =>
    u.perLevel * (levels[i] ?? 0);

/** Peor caso (ADR-0008): solo cuentan los incrementos negativos, todos a su nivel máximo. */
export const worstCase: Contribution = (u) => Math.min(0, u.perLevel * u.maxLevel);

function withReach(t: TargetingConfig, bonus: number): TargetingConfig {
  switch (t.mode) {
    case 'nearest-in-range':
      return { mode: t.mode, range: t.range + bonus };
    case 'any-in-radius':
      return { mode: t.mode, radius: t.radius + bonus };
    default:
      return assertNever(t);
  }
}

/** Configuración efectiva de un arma: base + Σ aportes de las mejoras que la apuntan. */
export function weaponWith(
  base: WeaponTypeConfig,
  catalog: Upgrades,
  contribution: Contribution,
): WeaponTypeConfig {
  const bonus: Record<WeaponStat, number> = { damage: 0, cooldownTicks: 0, range: 0, radius: 0 };
  catalog.upgrades.forEach((u, i) => {
    if (u.target.kind === 'weapon' && u.target.weapon === base.id && u.stat in bonus) {
      bonus[u.stat as WeaponStat] += contribution(u, i);
    }
  });
  return {
    id: base.id,
    cooldownTicks: base.cooldownTicks + bonus.cooldownTicks,
    damage: base.damage + bonus.damage,
    targeting: withReach(base.targeting, bonus.range + bonus.radius),
    attack: base.attack,
  };
}

/** Reglas efectivas del jugador: base + Σ aportes de las mejoras de jugador. */
export function playerWith(
  base: PlayerRules,
  catalog: Upgrades,
  contribution: Contribution,
): PlayerRules {
  const bonus: Record<PlayerStat, number> = { maxHealth: 0, speed: 0, pickupRadius: 0 };
  catalog.upgrades.forEach((u, i) => {
    if (u.target.kind === 'player' && u.stat in bonus)
      bonus[u.stat as PlayerStat] += contribution(u, i);
  });
  return {
    ...base,
    maxHealth: base.maxHealth + bonus.maxHealth,
    speed: base.speed + bonus.speed,
    pickupRadius: base.pickupRadius + bonus.pickupRadius,
  };
}

/** Arma efectiva con los niveles dados, siempre desde la base de contenido (ADR-0008). */
export const upgradedWeapon = (
  base: WeaponTypeConfig,
  catalog: Upgrades,
  levels: readonly number[],
): WeaponTypeConfig => weaponWith(base, catalog, byLevels(levels));

/** Jugador efectivo con los niveles dados, siempre desde la base de contenido (ADR-0008). */
export const upgradedPlayer = (
  base: PlayerRules,
  catalog: Upgrades,
  levels: readonly number[],
): PlayerRules => playerWith(base, catalog, byLevels(levels));

/** Vida máxima que suman las mejoras de `maxHealth` con los niveles dados. */
export const maxHealthBonus = (catalog: Upgrades, levels: readonly number[]): number =>
  catalog.upgrades.reduce(
    (sum, u, i) => (u.stat === 'maxHealth' ? sum + u.perLevel * (levels[i] ?? 0) : sum),
    0,
  );
