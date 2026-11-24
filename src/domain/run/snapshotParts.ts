import type { Enemy } from '../enemy/Enemy';
import type { Blast } from '../hazard/Blast';
import type { Dynamite } from '../hazard/Dynamite';
import type { Experience } from '../progression/Experience';
import type { XpGem } from '../progression/XpGem';
import type { UpgradeBoard } from '../upgrade/UpgradeBoard';
import type { UpgradeCatalog } from '../upgrade/UpgradeCatalog';
import type { Projectile } from '../weapon/Projectile';
import type { PulseEcho } from '../weapon/PulseEcho';
import type {
  BlastSnapshot,
  DynamiteSnapshot,
  EnemySnapshot,
  GemSnapshot,
  OfferSnapshot,
  ProgressionSnapshot,
  ProjectileSnapshot,
  PulseSnapshot,
  UpgradeLevelSnapshot,
  WarningSnapshot,
} from './RunSnapshot';

// Piezas congeladas del `RunSnapshot` (copias de escalares): el adaptador puede leerlas pero no
// alterar la partida. Se ensamblan una vez por frame, no por tick.

export function toEnemySnapshot(e: Enemy, damaged: boolean): EnemySnapshot {
  const { names, kinds } = e.type.behavior;
  return Object.freeze({
    id: e.id,
    type: e.type.id,
    x: e.x,
    y: e.y,
    radius: e.radius,
    health: e.hp,
    damaged,
    state: names[e.state] ?? '',
    stateKind: kinds[e.state] ?? 'chase',
  });
}

/** Dinamita en el snapshot del tick n: posición interpolada y radio visual (spec enemy-hazards). */
export function toDynamiteSnapshot(d: Dynamite, n: number, radius: number): DynamiteSnapshot {
  return Object.freeze({
    id: d.id,
    x: d.xAt(n),
    y: d.yAt(n),
    targetX: d.tx,
    targetY: d.ty,
    radius,
    explodesAt: d.explodesAt,
  });
}

export function toBlastSnapshot(b: Blast): BlastSnapshot {
  return Object.freeze({ id: b.id, x: b.x, y: b.y, radius: b.radius, tick: b.tick });
}

/**
 * Avisos en el suelo (spec enemy-hazards, "Aviso en el suelo"): uno por enemigo vivo en mecha (en
 * orden de lista) y uno por dinamita (en orden de creación, en su objetivo), ordenados de forma
 * estable por tick de explosión: a igual tick, las mechas primero.
 */
export function toWarnings(
  enemies: readonly Enemy[],
  dynamites: readonly Dynamite[],
): readonly WarningSnapshot[] {
  const out: WarningSnapshot[] = [];
  for (const e of enemies) {
    const b = e.type.behavior;
    if (b.kinds[e.state] !== 'fuse') continue;
    const radius = b.blastRadius[e.state] ?? 0;
    out.push(Object.freeze({ x: e.x, y: e.y, radius, source: 'fuse', explodesAt: e.stateEndsAt }));
  }
  for (const d of dynamites) {
    const { tx: x, ty: y, radius, explodesAt } = d;
    out.push(Object.freeze({ x, y, radius, source: 'dynamite', explodesAt }));
  }
  out.sort((a, b) => a.explodesAt - b.explodesAt);
  return Object.freeze(out);
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
