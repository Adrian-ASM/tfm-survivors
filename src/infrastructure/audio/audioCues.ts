import type { RunSnapshot } from '../../domain/run/RunSnapshot';
import type { PickupKind } from '../../domain/pickup/PickupKind';
import { EFFECT_TYPES, PICKUP_EFFECT, zeroCounts, type EffectCounts } from './effectTypes';

/** Lo que el audio lee del snapshot (nada más: spec audio, "Sucesos de audio desde el snapshot"). */
export type CueSnapshot = Pick<
  RunSnapshot,
  'hits' | 'kills' | 'pickups' | 'progression' | 'blasts' | 'shop' | 'sites' | 'towerProjectiles'
>;

export interface AudioCuesOptions {
  /** Tolerancia de cruce de las flechas de torre, en px de mundo (contenido de audio, D3). */
  readonly towerMatchPx: number;
  /** Tope de flechas de torre vivas (contenido de obra): tamaño inicial del buffer de posiciones. */
  readonly maxTowerProjectiles: number;
}

/**
 * Peticiones de efecto por snapshot procesado (design 0035 D2/D3), pura y sin motor: compara cada
 * snapshot con el anterior de la misma partida. El primero tras crearla (o tras `newRun`) solo
 * siembra la referencia y da 0. Los ids de golpes y explosiones crecen sin reutilizarse, así que
 * basta con el último visto; los recogibles se comparan por id (con su clase, para el tipo de
 * recogida) en dos mapas que se alternan y las flechas de torre por id con un `Set`. Devuelve
 */
export class AudioCues {
  private readonly out = zeroCounts();
  private seeded = false;
  private lastHitId = -1;
  private lastBlastId = -1;
  private kills = 0;
  private level = 0;
  private gold = 0;
  private shopOpen = false;
  private readonly siteFree: boolean[] = [];
  /** Recogibles del snapshot anterior (id → clase) y del actual: dos mapas que se alternan. */
  private prevPickups = new Map<number, PickupKind>();
  private curPickups = new Map<number, PickupKind>();
  private readonly arrowIds = new Set<number>();
  private arrowCount = 0;
  private arrowId: number[];
  private arrowX: number[];
  private arrowY: number[];
  private readonly towerMatchSq: number;

  constructor(options: AudioCuesOptions) {
    this.towerMatchSq = options.towerMatchPx * options.towerMatchPx;
    const n = Math.max(0, options.maxTowerProjectiles);
    this.arrowId = new Array<number>(n).fill(0);
    this.arrowX = new Array<number>(n).fill(0);
    this.arrowY = new Array<number>(n).fill(0);
  }

  /** Partida nueva: el siguiente snapshot es la referencia (0 peticiones). */
  newRun(): void {
    this.seeded = false;
  }

  next(s: CueSnapshot): Readonly<EffectCounts> {
    const out = this.out;
    for (const t of EFFECT_TYPES) out[t] = 0;
    if (this.seeded) this.count(s, out);
    this.remember(s);
    this.seeded = true;
    return out;
  }

  private count(s: CueSnapshot, out: EffectCounts): void {
    const live = this.arrowIds;
    live.clear();
    for (const p of s.towerProjectiles) live.add(p.id);
    for (const h of s.hits) {
      if (h.id <= this.lastHitId) continue;
      if (h.kind === 'player') out.playerHurt += 1;
      else if (this.fromBlast(s, h)) out.impactBlast += 1;
      else if (this.fromTower(h)) out.impactTower += 1;
      else out.impactWeapon += 1;
    }
    out.enemyDeath = Math.max(0, s.kills - this.kills);
    out.levelUp = Math.max(0, s.progression.level - this.level);
    for (const b of s.blasts) if (b.id > this.lastBlastId) out.explosion += 1;
    if ((this.shopOpen || s.shop.open) && s.shop.gold < this.gold) out.purchase = 1;
    out.build = this.built(s);
    // Con una obra en este snapshot, los recogibles los quita el despeje de la huella: 0 recogidas.
    if (out.build === 0) this.picked(s, out);
  }

  private fromBlast(s: CueSnapshot, h: CueSnapshot['hits'][number]): boolean {
    for (const b of s.blasts) {
      if (b.tick !== h.tick) continue;
      const dx = h.x - b.x;
      const dy = h.y - b.y;
      if (dx * dx + dy * dy <= b.radius * b.radius) return true;
    }
    return false;
  }

  /** ¿Alguna flecha de torre del anterior que falta en el actual cruzó a ≤ tolerancia del golpe? */
  private fromTower(h: CueSnapshot['hits'][number]): boolean {
    const live = this.arrowIds;
    for (let i = 0; i < this.arrowCount; i++) {
      if (live.has(this.arrowId[i] ?? -1)) continue;
      const dx = h.x - (this.arrowX[i] ?? 0);
      const dy = h.y - (this.arrowY[i] ?? 0);
      if (dx * dx + dy * dy <= this.towerMatchSq) return true;
    }
    return false;
  }

  private built(s: CueSnapshot): number {
    let n = 0;
    for (let i = 0; i < s.sites.length; i++) {
      if (this.siteFree[i] === true && s.sites[i]?.state !== 'free') n += 1;
    }
    return n;
  }

  /** Recogibles del anterior que faltan en el actual, por su tipo de recogida. */
  private picked(s: CueSnapshot, out: EffectCounts): void {
    const cur = this.curPickups;
    cur.clear();
    for (const p of s.pickups) cur.set(p.id, p.kind);
    for (const [id, kind] of this.prevPickups) if (!cur.has(id)) out[PICKUP_EFFECT[kind]] += 1;
  }

  private remember(s: CueSnapshot): void {
    let hitId = this.seeded ? this.lastHitId : -1;
    for (const h of s.hits) hitId = Math.max(hitId, h.id);
    this.lastHitId = hitId;
    let blastId = this.seeded ? this.lastBlastId : -1;
    for (const b of s.blasts) blastId = Math.max(blastId, b.id);
    this.lastBlastId = blastId;
    this.kills = s.kills;
    this.level = s.progression.level;
    this.gold = s.shop.gold;
    this.shopOpen = s.shop.open;
    this.siteFree.length = s.sites.length;
    for (let i = 0; i < s.sites.length; i++) this.siteFree[i] = s.sites[i]?.state === 'free';
    // Alterna los dos conjuntos: el del actual pasa a ser el anterior del siguiente snapshot.
    const prev = this.curPickups;
    prev.clear();
    for (const p of s.pickups) prev.set(p.id, p.kind);
    this.curPickups = this.prevPickups;
    this.prevPickups = prev;
    this.rememberArrows(s);
  }

  private rememberArrows(s: CueSnapshot): void {
    const list = s.towerProjectiles;
    if (list.length > this.arrowId.length) {
      this.arrowId = new Array<number>(list.length).fill(0);
      this.arrowX = new Array<number>(list.length).fill(0);
      this.arrowY = new Array<number>(list.length).fill(0);
    }
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!p) continue;
      this.arrowId[i] = p.id;
      this.arrowX[i] = p.x;
      this.arrowY[i] = p.y;
    }
    this.arrowCount = list.length;
  }
}
