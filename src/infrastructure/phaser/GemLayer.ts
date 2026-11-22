import type { GemSnapshot } from '../../domain/run/RunSnapshot';
import type { StillLook } from './art/looks';
import type { SpriteCount } from './PlayerView';
import { SlotPool } from './SlotPool';
import { PaintedSprite, type SpriteKit } from './SpriteLike';

/**
 * Pinta las gemas del snapshot con el aspecto de la gema (frame fijo, tamaño por aspecto) sobre un
 * pool de `maxGems` sprites preasignados, asociados por id (ADR-0006): ningún sprite de una gema
 * recogida queda visible y no se crean objetos del motor por frame.
 */
export class GemLayer {
  readonly counts: SpriteCount = { visible: 0, placeholder: 0 };
  private readonly pool: SlotPool<GemSnapshot, PaintedSprite>;

  constructor(
    capacity: number,
    kit: SpriteKit,
    private readonly look: StillLook,
  ) {
    const newSprite = (): PaintedSprite => new PaintedSprite(kit.create(), kit.tint);
    this.pool = new SlotPool(capacity, newSprite, {
      show: (painted, g, appearing) => {
        if (appearing) {
          painted
            .look(look, g.radius)
            .setFrame(look, look.idle.frames[0] ?? 0)
            .paint(look, false);
          this.count(1);
        }
        painted.at(g.x, g.y).show(true);
      },
      hide: (painted) => {
        painted.show(false);
        this.count(-1);
      },
    });
  }

  sync(gems: readonly GemSnapshot[]): void {
    this.pool.sync(gems);
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
