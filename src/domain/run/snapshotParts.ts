import type { HitRecord } from '../combat/HitLog';
import type { Enemy } from '../enemy/Enemy';
import type { Blast } from '../hazard/Blast';
import type { Dynamite } from '../hazard/Dynamite';
import type { Experience } from '../progression/Experience';
import type { Pickup } from '../pickup/Pickup';
import type { GoldVein } from '../resource/GoldVein';
import type { Structure } from '../structure/Structure';
import type { Sheep } from '../sheep/Sheep';
import type { UpgradeBoard } from '../upgrade/UpgradeBoard';
import type { UpgradeCatalog } from '../upgrade/UpgradeCatalog';
import type { Projectile } from '../weapon/Projectile';
import type { CastleGate } from '../shop/CastleGate';
import type { ShopConfig } from '../shop/ShopRules';
import type { PulseEcho } from '../weapon/PulseEcho';
import type {
  BlastSnapshot,
  DynamiteSnapshot,
  EnemySnapshot,
  HitSnapshot,
  GemSnapshot,
  PickupSnapshot,
  OfferSnapshot,
  ProgressionSnapshot,
  ProjectileSnapshot,
  StructureSnapshot,
  PulseSnapshot,
  SheepSnapshot,
  ShopProductSnapshot,
  ShopSnapshot,
  UpgradeLevelSnapshot,
  VeinSnapshot,
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

export function toSheepSnapshot(o: Sheep, damaged: boolean): SheepSnapshot {
  return Object.freeze({
    id: o.id,
    x: o.x,
    y: o.y,
    radius: o.radius,
    health: o.hp,
    state: o.mode,
    damaged,
    origin: Object.freeze({ x: o.originX, y: o.originY }),
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

export function toStructureSnapshot(s: Structure): StructureSnapshot {
  const { id, type, x, y, radius, col, row, cols, rows } = s.site;
  return Object.freeze({
    id,
    type: type.id,
    x,
    y,
    radius,
    col,
    row,
    cols,
    rows,
    health: s.hp,
    maxHealth: s.site.type.health,
    destroyed: s.destroyed,
  });
}

export function toVeinSnapshot(v: GoldVein): VeinSnapshot {
  const { id, x, y, radius, gold, depleted } = v;
  return Object.freeze({ id, x, y, radius, gold, depleted });
}

/**
 * Recogibles del suelo en orden de creación y, en el mismo recorrido, la vista `gems` (solo los
 * `xp`; design §3). La vista es "un array más": comparte los objetos congelados de `pickups`
 * (una gema trae además `kind` y `value`), así el snapshot no copia dos veces cada gema (M1).
 */
export function toPickupSnapshots(
  list: readonly Pickup[],
  radius: number,
): { pickups: readonly PickupSnapshot[]; gems: readonly GemSnapshot[] } {
  const pickups: PickupSnapshot[] = [];
  const gems: GemSnapshot[] = [];
  for (const p of list) {
    const { id, kind, value, x, y, source } = p;
    const snap: PickupSnapshot = Object.freeze(
      source === null
        ? { id, kind, value, x, y, radius }
        : { id, kind, value, x, y, radius, source },
    );
    pickups.push(snap);
    if (kind === 'xp') gems.push(snap);
  }
  return { pickups: Object.freeze(pickups), gems: Object.freeze(gems) };
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

/** Lo que necesita `toShopSnapshot` (lo reúne `Run`). */
export interface ShopParts {
  readonly catalog: UpgradeCatalog;
  readonly board: UpgradeBoard;
  readonly heal: ShopConfig['heal'];
  readonly gate: CastleGate;
  readonly open: boolean;
  readonly gold: number;
  readonly health: number;
  readonly maxHealth: number;
}

/**
 * Tienda del snapshot (spec castle-shop 0024): las mejoras de arma en orden de catálogo, con el
 * precio del siguiente nivel (o `null` al máximo), y la curación de pago al final.
 */
export function toShopSnapshot(p: ShopParts): ShopSnapshot {
  const { catalog, board, heal, gate, gold } = p;
  const products: ShopProductSnapshot[] = catalog.shopIndices.map((i) => {
    const u = catalog.upgrades[i];
    if (!u) throw new Error('Invariante rota: índice de tienda');
    const level = board.levelOf(i);
    const price = u.priceAt(level);
    const { id, name, description, maxLevel } = u;
    return Object.freeze({
      kind: 'upgrade' as const,
      id,
      name,
      description,
      level,
      maxLevel,
      price,
      affordable: price !== null && gold >= price,
    });
  });
  products.push(
    Object.freeze({
      kind: 'heal' as const,
      id: heal.id,
      name: heal.name,
      description: heal.description,
      amount: heal.amount,
      price: heal.price,
      affordable: gold >= heal.price && p.health < p.maxHealth,
    }),
  );
  const { door } = gate;
  return Object.freeze({
    armed: gate.armed,
    open: p.open,
    door: door ? Object.freeze({ x: door.x, y: door.y, radius: gate.radius }) : null,
    gold,
    products: Object.freeze(products),
  });
}

/** Vista congelada de un golpe: sin `targetId` en los de clase `player` (0031). */
export function toHitSnapshot(r: HitRecord): HitSnapshot {
  const { id, tick, kind, targetId, x, y, amount } = r;
  return Object.freeze(
    kind === 'player'
      ? { id, tick, kind, x, y, amount }
      : { id, tick, kind, targetId, x, y, amount },
  );
}
