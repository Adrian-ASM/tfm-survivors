import { Arena } from '../../src/domain/arena/Arena';
import { UpgradeCatalog } from '../../src/domain/upgrade/UpgradeCatalog';
import type { UpgradeTypeConfig } from '../../src/domain/upgrade/UpgradeType';
import { WeaponLoadout } from '../../src/domain/weapon/WeaponLoadout';
import { DEFAULT_UPGRADE_LIST, DEFAULT_WEAPONS, aRunConfig } from './builders';

/** Catálogo de mejoras sobre las armas y el jugador por defecto (por defecto, el de la spec). */
export function aCatalog(
  list: readonly UpgradeTypeConfig[] = DEFAULT_UPGRADE_LIST,
): UpgradeCatalog {
  const arena = Arena.create(960, 540);
  const loadout = WeaponLoadout.create(DEFAULT_WEAPONS);
  if (!arena.ok || !loadout.ok) throw new Error('contenido inválido');
  const r = UpgradeCatalog.create(list, loadout.value, aRunConfig().player, arena.value);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

/** Niveles por id sobre la lista dada (el resto a 0). */
export function levelsOf(
  byId: Record<string, number>,
  list: readonly UpgradeTypeConfig[] = DEFAULT_UPGRADE_LIST,
): number[] {
  return list.map((u) => byId[u.id] ?? 0);
}

/** Niveles con todas las mejoras al máximo salvo las dadas (con su nivel). */
export function allMaxedExcept(
  byId: Record<string, number>,
  list: readonly UpgradeTypeConfig[] = DEFAULT_UPGRADE_LIST,
): number[] {
  return list.map((u) => byId[u.id] ?? u.maxLevel);
}
