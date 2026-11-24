import type { SheepSnapshot, SheepState } from '../../domain/run/RunSnapshot';
import { AnimTrack, Motion, frameAt } from './art/animation';
import type { SheepLook, StillLook } from './art/looks';
import { SlotPool } from './SlotPool';
import { PaintedSprite, type SpriteKit } from './SpriteLike';

type SheepAnim = 'idle' | 'bounce';

/** Ovejas pintadas, con reserva y por estado (sonda E2E `sprites.sheep`, 0023). */
export interface SheepCounts {
  visible: number;
  placeholder: number;
  readonly byState: Record<SheepState, number>;
}

/** Recuentos de oveja a 0 (modo menú y capa recién creada). */
export const zeroSheepCounts = (): SheepCounts => ({
  visible: 0,
  placeholder: 0,
  byState: { graze: 0, wander: 0, flee: 0 },
});

interface SheepSlot {
  readonly painted: PaintedSprite;
  readonly motion: Motion;
  readonly track: AnimTrack<SheepAnim>;
  /** Estado contado en la sonda (null si el hueco no cuenta). */
  state: SheepState | null;
}

/**
 * Pinta las ovejas del snapshot (spec sprite-rendering 0023) sobre un pool de `capacity` sprites
 * preasignados, asociados por id (ADR-0006): `idle` en pasto y `bounce` en paseo y huida, cada una
 * con su hoja (al cambiar de animación el sprite cambia de textura con `setTexture`), volteo por Δx
 * (`Motion`) y el destello de daño de los enemigos. Sin barra de vida ni cadáver: una oveja muerta
 * solo deja de verse. Con reserva, las dos vistas son el disco del color de la oveja. No crea
 * objetos por frame.
 */
export class SheepLayer {
  readonly counts: SheepCounts = zeroSheepCounts();
  private readonly pool: SlotPool<SheepSnapshot, SheepSlot>;
  private tick = 0;
  private clockMs = 0;

  constructor(
    capacity: number,
    kit: SpriteKit,
    private readonly look: SheepLook,
  ) {
    const newSlot = (): SheepSlot => ({
      painted: new PaintedSprite(kit.create(), kit.tint),
      motion: new Motion(),
      track: new AnimTrack(),
      state: null,
    });
    this.pool = new SlotPool(capacity, newSlot, {
      show: (slot, sheep, appearing) => {
        this.show(slot, sheep, appearing);
      },
      hide: (slot) => {
        slot.painted.show(false);
        this.count(-1);
        this.countState(slot, null);
      },
    });
  }

  sync(sheep: readonly SheepSnapshot[], tick: number, clockMs: number): void {
    this.tick = tick;
    this.clockMs = clockMs;
    this.pool.sync(sheep);
  }

  /** Oculta todas (reinicio de partida o Volver al menú). */
  clear(): void {
    this.pool.clear();
  }

  private show(slot: SheepSlot, sheep: SheepSnapshot, appearing: boolean): void {
    if (appearing) {
      slot.motion.reset();
      slot.track.reset();
      this.count(1);
    }
    this.countState(slot, sheep.state);
    slot.motion.update(sheep.x, sheep.y, this.tick);
    const name: SheepAnim = sheep.state === 'graze' ? 'idle' : 'bounce';
    const view: StillLook = this.look[name];
    const elapsed = slot.track.play(name, this.clockMs);
    slot.painted
      .look(view, sheep.radius)
      .setFrame(view, frameAt(view.idle, elapsed))
      .setFlip(view.flips && slot.motion.flipX(view.facing))
      .paint(view, sheep.damaged)
      .at(sheep.x, sheep.y)
      .show(true);
  }

  private countState(slot: SheepSlot, state: SheepState | null): void {
    if (slot.state === state) return;
    if (slot.state) this.counts.byState[slot.state] -= 1;
    if (state) this.counts.byState[state] += 1;
    slot.state = state;
  }

  private count(delta: number): void {
    this.counts.visible += delta;
    if (this.look.placeholder) this.counts.placeholder += delta;
  }
}
