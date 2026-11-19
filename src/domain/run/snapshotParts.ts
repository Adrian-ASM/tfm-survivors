import type { Enemy } from '../enemy/Enemy';
import type { Experience } from '../progression/Experience';
import type { XpGem } from '../progression/XpGem';
import type { UpgradeBoard } from '../upgrade/UpgradeBoard';
import type { UpgradeCatalog } from '../upgrade/UpgradeCatalog';
import type { Projectile } from '../weapon/Projectile';
import type { PulseEcho } from '../weapon/PulseEcho';
import type {
  EnemySnapshot,
  GemSnapshot,
  OfferSnapshot,
  ProgressionSnapshot,
  ProjectileSnapshot,
  PulseSnapshot,
  UpgradeLevelSnapshot,
} from './RunSnapshot';

// Piezas congeladas del `RunSnapshot` (copias de escalares): el adaptador puede leerlas pero no
// alterar la partida. Se ensamblan una vez por frame, no por tick.

export function toEnemySnapshot(e: Enemy, damaged: boolean): EnemySnapshot {
  return Object.freeze({
    id: e.id,
    type: e.type.id,
    x: e.x,
    y: e.y,
    radius: e.radius,
    health: e.hp,
    damaged,
  });
}

export function toGemSnapshot(g: XpGem, radius: number): GemSnapshot {
  return Object.freeze({ id: g.id, x: g.x, y: g.y, radius });
}

export function toProjectileSnapshot(p: Projectile): ProjectileSnapshot {
  return Object.freeze({ id: p.id, x: p.x, y: p.y, radius: p.radius });
}

export function toPulseSnapshot(e: PulseEcho): PulseSnapshot {
  return Object.freeze({
    weapon: e.weaponId,
    firedAt: e.firedAt,
    x: e.x,
    y: e.y,
    radius: e.radius,
  });
}

export function toProgressionSnapshot(e: Experience): ProgressionSnapshot {
  return Object.freeze({
    level: e.level,
    xp: e.xp,
    xpToNext: e.xpToNext,
    pendingLevelUps: e.pendingLevelUps,
  });
}

/** Opciones de la oferta abierta en el orden sorteado, con nivel actual y siguiente. */
export function toOfferSnapshot(board: UpgradeBoard): readonly OfferSnapshot[] {
  const { offer, offerIndices } = board;
  const options = offer.map((u, k) => {
    const level = board.levelOf(offerIndices[k] ?? -1);
    const { id, name, description } = u;
    return Object.freeze({ id, name, description, level, nextLevel: level + 1 });
  });
  return Object.freeze(options);
}

/** Mejoras adquiridas (nivel ≥ 1) en el orden del catálogo. */
export function toUpgradeLevels(
  catalog: UpgradeCatalog,
  board: UpgradeBoard,
): readonly UpgradeLevelSnapshot[] {
  const out: UpgradeLevelSnapshot[] = [];
  catalog.upgrades.forEach((u, i) => {
    const level = board.levelOf(i);
    if (level >= 1) out.push(Object.freeze({ id: u.id, level }));
  });
  return Object.freeze(out);
}
