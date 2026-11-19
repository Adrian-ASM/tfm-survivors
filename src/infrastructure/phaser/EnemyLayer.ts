import type { EnemySnapshot } from '../../domain/run/RunSnapshot';
import { enemyPalette } from './enemyPalette';
import { SlotPool } from './SlotPool';

/** Color del destello de un enemigo dañado (presentación, como `PLAYER_COLOR`). */
export const FLASH_COLOR = 0xffffff;

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
  flash: boolean;
}

/**
 * Pinta los enemigos del snapshot con un pool de círculos preasignado: no crea ni destruye objetos
 * del motor por frame. La asociación hueco ↔ id (ADR-0006) la lleva `SlotPool`, así que una baja
 * solo oculta un hueco y no repinta a los demás. El radio solo cambia cuando un hueco pasa a otro
 * tipo; el color, cuando cambia el tipo o la indicación de daño (destello).
 */
export class EnemyLayer {
  private readonly pool: SlotPool<EnemySnapshot, EnemySlot>;

  constructor(capacity: number, create: () => CircleSprite) {
    const newSlot = (): EnemySlot => {
      const sprite = create();
      sprite.setVisible(false);
      return { sprite, type: null, flash: false };
    };
    this.pool = new SlotPool(capacity, newSlot, {
      show: (slot, enemy, appearing) => {
        slot.sprite.setPosition(enemy.x, enemy.y);
        const retype = slot.type !== enemy.type;
        if (retype) slot.sprite.setRadius(enemy.radius);
        if (retype || slot.flash !== enemy.damaged) {
          slot.sprite.setFillStyle(enemy.damaged ? FLASH_COLOR : enemyPalette(enemy.type));
          slot.type = enemy.type;
          slot.flash = enemy.damaged;
        }
        if (appearing) slot.sprite.setVisible(true);
      },
      hide: (slot) => slot.sprite.setVisible(false),
    });
  }

  sync(enemies: readonly EnemySnapshot[]): void {
    this.pool.sync(enemies);
  }

  /** Oculta todos los sprites (reinicio de partida). */
  clear(): void {
    this.pool.clear();
  }
}
