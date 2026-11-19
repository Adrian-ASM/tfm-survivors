import type { ProjectileSnapshot } from '../../domain/run/RunSnapshot';
import type { CircleSprite } from './EnemyLayer';
import { SlotPool } from './SlotPool';

/** Color de los proyectiles (presentación). */
export const PROJECTILE_COLOR = 0xf5d90a;

/**
 * Pinta los proyectiles del snapshot sobre un pool de `maxProjectiles` círculos preasignados,
 * asociados por id (ADR-0006): ningún sprite de un proyectil desaparecido queda visible y no se
 * crean objetos del motor por frame. El radio se fija al ocupar un hueco.
 */
export class ProjectileLayer {
  private readonly pool: SlotPool<ProjectileSnapshot, CircleSprite>;

  constructor(capacity: number, create: () => CircleSprite) {
    const newSprite = (): CircleSprite => {
      const sprite = create();
      sprite.setFillStyle(PROJECTILE_COLOR);
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

  sync(projectiles: readonly ProjectileSnapshot[]): void {
    this.pool.sync(projectiles);
  }
}
