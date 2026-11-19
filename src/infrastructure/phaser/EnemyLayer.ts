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
  /** Enemigo que lo ocupa (si `visible`). */
  id: number;
  /** Último frame en que su enemigo estaba en el snapshot. */
  seen: number;
}

/**
 * Pinta los enemigos del snapshot con un pool de círculos preasignado: no crea ni destruye objetos
 * del motor por frame. Cada enemigo conserva su hueco (asociación hueco ↔ id, ADR-0006) mientras
 * vive, así que una baja solo oculta un hueco y no repinta a los demás. El repintado (radio y
 * color) solo ocurre cuando un hueco pasa a un enemigo de otro tipo.
 */
export class EnemyLayer {
  private readonly slots: Slot[];
  /** Huecos libres (pila); al empezar, el hueco 0 queda en la cima. */
  private readonly free: Slot[];
  private readonly byId = new Map<number, Slot>();
  private frame = 0;

  constructor(capacity: number, create: () => CircleSprite) {
    this.slots = Array.from({ length: capacity }, () => {
      const sprite = create();
      sprite.setVisible(false);
      return { sprite, id: -1, type: null, visible: false, seen: 0 };
    });
    this.free = [...this.slots].reverse();
  }

  /**
   * Tres pasadas sin asignar: actualiza a los que ya tienen hueco, libera los huecos de las bajas y
   * después da hueco a los nuevos (así una reposición en el mismo frame reutiliza lo liberado).
   * Si llegaran más enemigos que huecos, los sobrantes no se pintan.
   */
  sync(enemies: readonly EnemySnapshot[]): void {
    this.frame += 1;
    for (const enemy of enemies) {
      const slot = this.byId.get(enemy.id);
      if (slot) this.show(slot, enemy);
    }
    this.releaseUnseen();
    for (const enemy of enemies) {
      if (this.byId.has(enemy.id)) continue;
      const slot = this.free.pop();
      if (!slot) continue;
      slot.id = enemy.id;
      this.byId.set(enemy.id, slot);
      this.show(slot, enemy);
    }
  }

  /** Oculta y devuelve a la pila los huecos visibles cuyo enemigo no está en este snapshot. */
  private releaseUnseen(): void {
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (!slot?.visible || slot.seen === this.frame) continue;
      slot.sprite.setVisible(false);
      slot.visible = false;
      this.byId.delete(slot.id);
      this.free.push(slot);
    }
  }

  private show(slot: Slot, enemy: EnemySnapshot): void {
    slot.seen = this.frame;
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
