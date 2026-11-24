import type { EnemySnapshot, StateKind } from '../../domain/run/RunSnapshot';
import { AnimTrack, Motion, frameAt, type AnimSpec } from './art/animation';
import { PLACEHOLDER_TEXTURE, type EnemyLook } from './art/looks';
import type { SpriteCount } from './PlayerView';
import { SlotPool } from './SlotPool';
import { PaintedSprite, type SpriteKit } from './SpriteLike';

/** Destino de las bajas: muestra un cadáver si hay hueco (`CorpseLayer`, design D6). */
export interface CorpseSink {
  spawn(x: number, y: number, facingLeft: boolean, radius: number): boolean;
}

/** Aspecto de un tipo sin datos (no ocurre tras `checkAppearanceRefs`): reserva gris. */
const UNKNOWN: EnemyLook = {
  texture: PLACEHOLDER_TEXTURE,
  placeholder: true,
  scale: 1,
  origin: { x: 0.5, y: 0.5 },
  facing: 'right',
  color: 0xb0b4ba,
  flips: false,
  idle: { frames: [0], fps: 1, loop: true },
  walk: { frames: [0], fps: 1, loop: true },
};

type EnemyAnim = 'idle' | 'walk' | 'fuse' | 'throw';

/** Sprites de enemigo vivo por clase de estado de comportamiento (sonda E2E, 0020). */
export type StateCounts = Record<StateKind, number>;

interface EnemySlot {
  readonly painted: PaintedSprite;
  readonly motion: Motion;
  readonly track: AnimTrack<EnemyAnim>;
  look: EnemyLook;
  type: string;
  /** Clase de estado contada en la sonda (null si el hueco no cuenta). */
  kind: StateKind | null;
  x: number;
  y: number;
  radius: number;
}

/**
 * Pinta los enemigos del snapshot con un pool de sprites preasignado (ADR-0006): no crea ni destruye
 * objetos del motor por frame. Cada tipo usa su aspecto (hoja, escala, origen) e `idle`/`walk` por
 * desplazamiento; el destello de daño es silueta blanca (`FILL`). Un enemigo que sale del snapshot
 * (baja) deja un cadáver en su última posición pintada; `clear()` (cambio de partida) no.
 */
export class EnemyLayer {
  readonly counts: SpriteCount = { visible: 0, placeholder: 0 };
  /** Sprites con aspecto de reserva por tipo (claves preasignadas con los tipos con aspecto). */
  readonly placeholdersByType: Record<string, number> = {};
  readonly states: StateCounts = { chase: 0, fuse: 0, charge: 0, wait: 0 };
  private readonly pool: SlotPool<EnemySnapshot, EnemySlot>;
  private tick = 0;
  private clockMs = 0;

  constructor(
    capacity: number,
    kit: SpriteKit,
    private readonly looks: ReadonlyMap<string, EnemyLook>,
    corpses: CorpseSink,
  ) {
    for (const type of looks.keys()) this.placeholdersByType[type] = 0;
    const newSlot = (): EnemySlot => ({
      painted: new PaintedSprite(kit.create(), kit.tint),
      motion: new Motion(),
      track: new AnimTrack(),
      look: UNKNOWN,
      type: '',
      kind: null,
      x: 0,
      y: 0,
      radius: 0,
    });
    this.pool = new SlotPool(capacity, newSlot, {
      show: (slot, enemy, appearing) => {
        this.show(slot, enemy, appearing);
      },
      hide: (slot, cleared) => {
        slot.painted.show(false);
        this.count(slot, -1);
        this.countState(slot, null);
        if (!cleared) corpses.spawn(slot.x, slot.y, slot.motion.facingLeft === true, slot.radius);
      },
    });
  }

  sync(enemies: readonly EnemySnapshot[], tick: number, clockMs: number): void {
    this.tick = tick;
    this.clockMs = clockMs;
    this.pool.sync(enemies);
  }

  /** Oculta todos los sprites sin cadáveres (reinicio de partida o Volver al menú). */
  clear(): void {
    this.pool.clear();
  }

  private show(slot: EnemySlot, enemy: EnemySnapshot, appearing: boolean): void {
    if (appearing || slot.type !== enemy.type) {
      if (!appearing) this.count(slot, -1);
      slot.type = enemy.type;
      slot.look = this.looks.get(enemy.type) ?? UNKNOWN;
      this.count(slot, 1);
    }
    if (appearing) {
      slot.motion.reset();
      slot.track.reset();
    }
    this.countState(slot, enemy.stateKind);
    const look = slot.look;
    slot.motion.update(enemy.x, enemy.y, this.tick);
    const [name, anim] = animFor(look, enemy.stateKind, slot.motion.moving);
    const elapsed = slot.track.play(name, this.clockMs);
    slot.painted
      .look(look, enemy.radius)
      .setFrame(look, frameAt(anim, elapsed))
      .setFlip(look.flips && slot.motion.flipX(look.facing))
      .paint(look, enemy.damaged)
      .at(enemy.x, enemy.y)
      .show(true);
    slot.x = enemy.x;
    slot.y = enemy.y;
    slot.radius = enemy.radius;
  }

  /** Recuento por clase de estado: mueve el hueco de su clase anterior a `kind` (null: fuera). */
  private countState(slot: EnemySlot, kind: StateKind | null): void {
    if (slot.kind === kind) return;
    if (slot.kind) this.states[slot.kind] -= 1;
    if (kind) this.states[kind] += 1;
    slot.kind = kind;
  }

  /** Contadores incrementales para la sonda (sin recorrer huecos). */
  private count(slot: EnemySlot, delta: number): void {
    this.counts.visible += delta;
    if (!slot.look.placeholder) return;
    this.counts.placeholder += delta;
    this.placeholdersByType[slot.type] = (this.placeholdersByType[slot.type] ?? 0) + delta;
  }
}

/**
 * Animación de un enemigo (spec sprite-rendering 0020): `fuse` en mecha y `throw` en carga, se mueva o
 * no; si no, `walk`/`idle` por desplazamiento. Al cambiar de nombre la pista empieza en su primer frame.
 */
function animFor(look: EnemyLook, kind: StateKind, moving: boolean): [EnemyAnim, AnimSpec] {
  if (kind === 'fuse' && look.fuse) return ['fuse', look.fuse];
  if (kind === 'charge' && look.throw) return ['throw', look.throw];
  return moving ? ['walk', look.walk] : ['idle', look.idle];
}
