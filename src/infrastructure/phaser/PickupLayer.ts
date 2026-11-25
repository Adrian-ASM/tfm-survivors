import type { PickupKind } from '../../domain/pickup/PickupKind';
import type { PickupSnapshot } from '../../domain/run/RunSnapshot';
import type { PickupLook, StoneLooks } from './art/looks';
import type { SpriteCount } from './PlayerView';
import { SlotPool } from './SlotPool';
import { PaintedSprite, type SpriteKit } from './SpriteLike';

/** Sprites de recogible visibles por tipo, y cuántos con aspecto de reserva (0022). */
export type PickupCounts = Readonly<Record<PickupKind, SpriteCount>>;

/**
 * Hueco del pool: el sprite, el tipo del recogible que pinta y el aspecto que usó al aparecer (para
 * contar al ocultarlo; en la piedra, cada roca puede ir a reserva por separado, 0025).
 */
interface PickupSlot {
  readonly painted: PaintedSprite;
  kind: PickupKind;
  look: PickupLook | null;
}

/**
 * Pinta los recogibles del snapshot (los cinco tipos, ADR-0021) sobre un único pool de `Σ topes`
 * sprites preasignados, asociados por id (los ids son únicos entre tipos, ADR-0006). Al aparecer, el
 * sprite toma el aspecto de su tipo, y la piedra el de la roca de su origen (0025; un sprite
 * reutilizado cambia de aspecto); el tamaño lo fija el
 * aspecto, no `gemRadius`, salvo en reserva. La gema sin hoja es una forma de color: nunca cuenta como
 * reserva. Ningún sprite de un recogible recogido queda visible; no crea objetos por frame.
 */
export class PickupLayer {
  readonly counts: PickupCounts = {
    xp: { visible: 0, placeholder: 0 },
    gold: { visible: 0, placeholder: 0 },
    wood: { visible: 0, placeholder: 0 },
    meat: { visible: 0, placeholder: 0 },
    stone: { visible: 0, placeholder: 0 },
  };
  private readonly pool: SlotPool<PickupSnapshot, PickupSlot>;

  constructor(
    capacity: number,
    kit: SpriteKit,
    looks: Readonly<Record<PickupKind, PickupLook>>,
    stones: StoneLooks,
  ) {
    const newSlot = (): PickupSlot => ({
      painted: new PaintedSprite(kit.create(), kit.tint),
      kind: 'xp',
      look: null,
    });
    this.pool = new SlotPool(capacity, newSlot, {
      show: (slot, p, appearing) => {
        if (appearing) {
          const look = p.kind === 'stone' ? stones.of(p.source) : looks[p.kind];
          slot.kind = p.kind;
          slot.look = look;
          slot.painted
            .look(look, p.radius)
            .setFrame(look, look.idle.frames[0] ?? 0)
            .paint(look, false);
          this.count(p.kind, look, 1);
        }
        slot.painted.at(p.x, p.y).show(true);
      },
      hide: (slot) => {
        slot.painted.show(false);
        if (slot.look) this.count(slot.kind, slot.look, -1);
      },
    });
  }

  sync(pickups: readonly PickupSnapshot[]): void {
    this.pool.sync(pickups);
  }

  /** Oculta todos los sprites (reinicio de partida). */
  clear(): void {
    this.pool.clear();
  }

  private count(kind: PickupKind, look: PickupLook, delta: number): void {
    const c = this.counts[kind];
    c.visible += delta;
    if (look.placeholder && !look.shape) c.placeholder += delta;
  }
}
