import type { ProjectileSnapshot } from '../../domain/run/RunSnapshot';
import { MOVE_EPSILON } from './art/animation';
import type { StillLook } from './art/looks';
import type { SpriteCount } from './PlayerView';
import { SlotPool } from './SlotPool';
import { PaintedSprite, type SpriteKit } from './SpriteLike';

interface ArrowSlot {
  readonly painted: PaintedSprite;
  lastX: number;
  lastY: number;
}

/**
 * Pinta los proyectiles del snapshot como flechas sobre un pool de `maxProjectiles` sprites
 * preasignados, asociados por id (ADR-0006). La flecha rota a atan2(Δy, Δx) entre snapshots (más π
 * si el dibujo mira a la izquierda); en su primer frame, sin Δ previo, 0 (o π). Sin objetos del
 * motor por frame.
 */
export class ProjectileLayer {
  readonly counts: SpriteCount = { visible: 0, placeholder: 0 };
  private readonly pool: SlotPool<ProjectileSnapshot, ArrowSlot>;

  constructor(
    capacity: number,
    kit: SpriteKit,
    private readonly look: StillLook,
  ) {
    const newSlot = (): ArrowSlot => ({
      painted: new PaintedSprite(kit.create(), kit.tint),
      lastX: 0,
      lastY: 0,
    });
    const base = look.facing === 'left' ? Math.PI : 0;
    this.pool = new SlotPool(capacity, newSlot, {
      show: (slot, p, appearing) => {
        const painted = slot.painted;
        if (appearing) {
          painted
            .look(look, p.radius)
            .setFrame(look, look.idle.frames[0] ?? 0)
            .paint(look, false);
          painted.setRotation(look.flips ? base : 0);
          this.count(1);
        } else if (look.flips) {
          const dx = p.x - slot.lastX;
          const dy = p.y - slot.lastY;
          if (Math.hypot(dx, dy) > MOVE_EPSILON) painted.setRotation(Math.atan2(dy, dx) + base);
        }
        slot.lastX = p.x;
        slot.lastY = p.y;
        painted.at(p.x, p.y).show(true);
      },
      hide: (slot) => {
        slot.painted.show(false);
        this.count(-1);
      },
    });
  }

  sync(projectiles: readonly ProjectileSnapshot[]): void {
    this.pool.sync(projectiles);
  }

  /** Oculta todos los sprites (reinicio de partida). */
  clear(): void {
    this.pool.clear();
  }

  private count(delta: number): void {
    this.counts.visible += delta;
    if (this.look.placeholder) this.counts.placeholder += delta;
  }
}
