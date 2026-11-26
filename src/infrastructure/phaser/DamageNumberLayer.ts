import type { HitKind, HitSnapshot } from '../../domain/run/RunSnapshot';
import { damageText, newHits, numberPose, type NumberMotion } from './art/combatFeedback';

/**
 * Lo mínimo que la capa necesita de un `Phaser.GameObjects.Text` (MCP phaser-docs, API de Text 4.x:
 * `setText`, `setPosition`, `setAlpha`, `setVisible`, `setOrigin` y `setTint` del componente Tint).
 * Costura sin motor.
 */
export interface TextLike {
  setText(text: string): unknown;
  setPosition(x: number, y: number): unknown;
  setAlpha(alpha: number): unknown;
  setTint(color: number): unknown;
  setVisible(visible: boolean): unknown;
  setOrigin(x: number, y: number): unknown;
}

/** Aspecto de los números: color por clase de golpe (`#RRGGBB` ya numérico) y movimiento y pool. */
export interface DamageNumberLooks {
  readonly colors: Readonly<Record<HitKind, number>>;
  readonly numbers: NumberMotion & { readonly pool: number };
}

/** Sonda `sprites.damageNumbers` (0031): visibles por clase y creados en la partida. */
export type DamageNumberCounts = Record<HitKind, number> & { created: number };

export const zeroDamageNumbers = (): DamageNumberCounts => ({
  enemy: 0,
  structure: 0,
  sheep: 0,
  player: 0,
  created: 0,
});

class NumberSlot {
  visible = false;
  kind: HitKind = 'enemy';
  x = 0;
  y = 0;
  bornMs = 0;

  constructor(readonly text: TextLike) {}
}

/**
 * Números de daño (change 0031, spec sprite-rendering "Números de daño"): un pool de P `Text` creados
 * una vez, en anillo, que se ocupan en orden de id de golpe. Un golpe crea número una sola vez
 * (deduplicación por el último id creado: los ids crecen con el orden del snapshot). Al ocupar un
 * hueco, un `setText` y un `setTint`; por frame, solo posición y opacidad de los visibles. Edad con el
 * reloj de render del frame que lo crea: congelado en pausa, quieto sin código propio.
 */
export class DamageNumberLayer {
  readonly counts: DamageNumberCounts = zeroDamageNumbers();
  private readonly slots: NumberSlot[] = [];
  private next = 0;
  private lastId = -1;
  private readonly pose = { visible: false, dy: 0, alpha: 0 };

  constructor(
    make: () => TextLike,
    private readonly looks: DamageNumberLooks,
  ) {
    for (let i = 0; i < looks.numbers.pool; i++) {
      const text = make();
      text.setOrigin(0.5, 0.5);
      text.setVisible(false);
      this.slots.push(new NumberSlot(text));
    }
  }

  /** Crea los números de los golpes nuevos del snapshot pintado y coloca los vivos con `ms`. */
  sync(hits: readonly HitSnapshot[], ms: number): void {
    const last = hits[hits.length - 1];
    if (last && last.id > this.lastId) {
      for (let i = newHits(hits, this.lastId, this.slots.length); i < hits.length; i++) {
        const h = hits[i];
        if (h) this.occupy(h, ms);
      }
      this.lastId = last.id;
    }
    for (const slot of this.slots) {
      if (!slot.visible) continue;
      const p = numberPose(ms - slot.bornMs, this.looks.numbers, this.pose);
      if (!p.visible) {
        this.hide(slot);
        continue;
      }
      slot.text.setPosition(slot.x, slot.y + p.dy);
      slot.text.setAlpha(p.alpha);
    }
  }

  /** R y Volver al menú: todo oculto, recuentos a 0 y deduplicación desde cero. */
  clear(): void {
    for (const slot of this.slots) if (slot.visible) this.hide(slot);
    this.next = 0;
    this.lastId = -1;
    Object.assign(this.counts, zeroDamageNumbers());
  }

  /** El siguiente hueco del anillo (libre o el vivo de menor id) pasa a mostrar el golpe `h`. */
  private occupy(h: HitSnapshot, ms: number): void {
    const slot = this.slots[this.next];
    if (!slot) return;
    this.next = (this.next + 1) % this.slots.length;
    if (slot.visible) this.hide(slot);
    slot.kind = h.kind;
    slot.x = h.x;
    slot.y = h.y;
    slot.bornMs = ms;
    slot.visible = true;
    slot.text.setText(damageText(h.amount));
    slot.text.setTint(this.looks.colors[h.kind]);
    slot.text.setVisible(true);
    this.counts[h.kind] += 1;
    this.counts.created += 1;
  }

  private hide(slot: NumberSlot): void {
    slot.visible = false;
    slot.text.setVisible(false);
    this.counts[slot.kind] -= 1;
  }
}
