import type { EnemySnapshot } from '../../domain/run/RunSnapshot';
import { enemyPalette } from './enemyPalette';

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

interface Slot {
  readonly sprite: CircleSprite;
  type: string | null;
  visible: boolean;
}

/**
 * Pinta los enemigos del snapshot con un pool de círculos preasignado: no crea ni destruye objetos
 * del motor por frame. El hueco i pinta al enemigo i (orden de aparición); si cambia de tipo, se
 * redimensiona y recolorea.
 */
export class EnemyLayer {
  private readonly slots: Slot[];

  constructor(capacity: number, create: () => CircleSprite) {
    this.slots = Array.from({ length: capacity }, () => {
      const sprite = create();
      sprite.setVisible(false);
      return { sprite, type: null, visible: false };
    });
  }

  sync(enemies: readonly EnemySnapshot[]): void {
    for (const [i, slot] of this.slots.entries()) {
      const enemy = enemies[i];
      if (enemy) {
        this.show(slot, enemy);
      } else if (slot.visible) {
        slot.sprite.setVisible(false);
        slot.visible = false;
      }
    }
  }

  private show(slot: Slot, enemy: EnemySnapshot): void {
    slot.sprite.setPosition(enemy.x, enemy.y);
    if (slot.type !== enemy.type) {
      slot.sprite.setRadius(enemy.radius);
      slot.sprite.setFillStyle(enemyPalette(enemy.type));
      slot.type = enemy.type;
    }
    if (!slot.visible) {
      slot.sprite.setVisible(true);
      slot.visible = true;
    }
  }
}
