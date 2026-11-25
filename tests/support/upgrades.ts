import { Arena } from '../../src/domain/arena/Arena';
import type { RunConfig, UpgradesConfig } from '../../src/domain/run/RunConfig';
import { UpgradeCatalog } from '../../src/domain/upgrade/UpgradeCatalog';
import type { UpgradeTypeConfig } from '../../src/domain/upgrade/UpgradeType';
import { WeaponLoadout } from '../../src/domain/weapon/WeaponLoadout';
import { DEFAULT_UPGRADES, DEFAULT_WEAPONS, aRunConfig, anUpgrade } from './builders';

/** Catálogo de mejoras sobre las armas y el jugador por defecto (por defecto, el de la spec). */
export function aCatalog(lists: UpgradesConfig = DEFAULT_UPGRADES): UpgradeCatalog {
  const arena = Arena.create(960, 540);
  const loadout = WeaponLoadout.create(DEFAULT_WEAPONS);
  if (!arena.ok || !loadout.ok) throw new Error('contenido inválido');
  const r = UpgradeCatalog.create(lists, loadout.value, aRunConfig().player, arena.value);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

/** Las mejoras de los dos catálogos en el orden del vector de niveles (personaje y luego arma). */
const ordered = (lists: UpgradesConfig): readonly UpgradeTypeConfig[] => [
  ...lists.character,
  ...lists.weapons,
];

/** Niveles por id sobre los catálogos dados (el resto a 0). */
export function levelsOf(
  byId: Record<string, number>,
  lists: UpgradesConfig = DEFAULT_UPGRADES,
): number[] {
  return ordered(lists).map((u) => byId[u.id] ?? 0);
}

/** Niveles con todas las mejoras al máximo salvo las dadas (con su nivel). */
export function allMaxedExcept(
  byId: Record<string, number>,
  lists: UpgradesConfig = DEFAULT_UPGRADES,
): number[] {
  return ordered(lists).map((u) => byId[u.id] ?? u.maxLevel);
}

/**
 * El mismo contenido con una sola mejora de personaje, `id` de la lista por defecto con estos
 * `perLevel` y `maxLevel` (valores de escenario: "armadura 3" = `withPlayerStat(c, 'armor', 3)` y
 * el `RunSetup` con `upgrades: { armor: 1 }`). Las de arma no cambian.
 */
export const withPlayerStat = (
  config: RunConfig,
  id: string,
  perLevel: number,
  maxLevel = 1,
): RunConfig => ({
  ...config,
  upgrades: { ...config.upgrades, character: [anUpgrade(id, { perLevel, maxLevel })] },
});

/** Niveles de personaje al máximo salvo los dados (los de arma, a 0 salvo los dados). */
export function characterMaxedExcept(
  byId: Record<string, number>,
  lists: UpgradesConfig = DEFAULT_UPGRADES,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const u of lists.character) out[u.id] = byId[u.id] ?? u.maxLevel;
  for (const u of lists.weapons) if (byId[u.id] !== undefined) out[u.id] = byId[u.id] ?? 0;
  return out;
}
