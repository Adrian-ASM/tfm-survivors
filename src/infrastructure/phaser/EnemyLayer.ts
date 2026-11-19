import type { EnemySnapshot } from '../../domain/run/RunSnapshot';
import { enemyPalette } from './enemyPalette';
import { SlotPool } from './SlotPool';

/**
 * Lo mínimo que la capa necesita de un círculo del motor. `Phaser.GameObjects.Arc` lo cumple; es una
 * costura de testabilidad dentro de infraestructura (no un puerto de dominio).
 */
export interface CircleSprite {
  setPosition(x: number, y: number): unknown;
  setRadius(radius: number): unknown;
  setFillStyle(color: number): unknown;
  setVisible(visible: boolean): unknown;
}

interface EnemySlot {
  readonly sprite: CircleSprite;
  type: string | null;
}

/**
 * Pinta los enemigos del snapshot con un pool de círculos preasignado: no crea ni destruye objetos
 * del motor por frame. La asociación hueco ↔ id (ADR-0006) la lleva `SlotPool`, así que una baja
 * solo oculta un hueco y no repinta a los demás. El repintado (radio y color) solo ocurre cuando
 * un hueco pasa a un enemigo de otro tipo.
 */
export class EnemyLayer {
  private readonly pool: SlotPool<EnemySnapshot, EnemySlot>;

  constructor(capacity: number, create: () => CircleSprite) {
    const newSlot = (): EnemySlot => {
      const sprite = create();
      sprite.setVisible(false);
      return { sprite, type: null };
    };
    this.pool = new SlotPool(capacity, newSlot, {
      show: (slot, enemy, appearing) => {
        slot.sprite.setPosition(enemy.x, enemy.y);
        if (slot.type !== enemy.type) {
          slot.sprite.setRadius(enemy.radius);
          slot.sprite.setFillStyle(enemyPalette(enemy.type));
          slot.type = enemy.type;
        }
        if (appearing) slot.sprite.setVisible(true);
      },
      hide: (slot) => slot.sprite.setVisible(false),
    });
  }

  sync(enemies: readonly EnemySnapshot[]): void {
    this.pool.sync(enemies);
  }
}
