import type { GemSnapshot } from '../../domain/run/RunSnapshot';
import type { CircleSprite } from './EnemyLayer';
import { SlotPool } from './SlotPool';

/** Color de las gemas de XP (presentación). */
export const GEM_COLOR = 0x4fd1c5;

/**
 * Pinta las gemas del snapshot sobre un pool de `maxGems` círculos preasignados, asociados por id
 * (ADR-0006): ningún sprite de una gema recogida queda visible y no se crean objetos del motor
 * por frame. El radio se fija al ocupar un hueco.
 */
export class GemLayer {
  private readonly pool: SlotPool<GemSnapshot, CircleSprite>;

  constructor(capacity: number, create: () => CircleSprite) {
    const newSprite = (): CircleSprite => {
      const sprite = create();
      sprite.setFillStyle(GEM_COLOR);
      sprite.setVisible(false);
      return sprite;
    };
    this.pool = new SlotPool(capacity, newSprite, {
      show: (sprite, p, appearing) => {
        sprite.setPosition(p.x, p.y);
        if (appearing) {
          sprite.setRadius(p.radius);
          sprite.setVisible(true);
        }
      },
      hide: (sprite) => sprite.setVisible(false),
    });
  }

  sync(gems: readonly GemSnapshot[]): void {
    this.pool.sync(gems);
  }

  /** Oculta todos los sprites (reinicio de partida). */
  clear(): void {
    this.pool.clear();
  }
}
