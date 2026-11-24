import type {
  BlastSnapshot,
  DynamiteSnapshot,
  WarningSnapshot,
} from '../../domain/run/RunSnapshot';
import { frameAt } from './art/animation';
import type { ExplosionLook, StillLook, WarningLook } from './art/looks';
import type { SpriteCount } from './PlayerView';
import { SlotPool } from './SlotPool';
import { PaintedSprite, type SpriteKit } from './SpriteLike';

/**
 * Lo mínimo que la capa necesita de un `Phaser.GameObjects.Graphics` (MCP phaser-docs, API de
 * Graphics: `clear()`, `fillStyle(color, alpha)` y `fillCircle(x, y, radius)`). Costura sin motor.
 */
export interface WarningCanvas {
  clear(): unknown;
  fillStyle(color: number, alpha: number): unknown;
  fillCircle(x: number, y: number, radius: number): unknown;
}

/** Aspectos de la capa de peligros, ya resueltos contra las texturas cargadas. */
export interface HazardLooks {
  readonly dynamite: StillLook;
  readonly explosion: ExplosionLook;
  readonly warnings: { readonly fuse: WarningLook; readonly dynamite: WarningLook };
}

/** Tamaño de los pools: el tope de dinamitas del contenido y el de explosiones pintadas. */
export interface HazardCapacity {
  readonly dynamites: number;
  readonly blasts: number;
}

/** Recuentos de la sonda E2E (los avisos nunca son reserva). */
export interface HazardCounts {
  readonly warnings: SpriteCount;
  readonly dynamites: SpriteCount;
  readonly explosions: SpriteCount;
}

/** Lista vacía compartida para `clear()` (no asigna). */
const NO_WARNINGS: readonly WarningSnapshot[] = Object.freeze([]);

interface BlastSlot {
  readonly painted: PaintedSprite;
  /** Reloj de render en el primer frame en que se pintó esta explosión. */
  startMs: number;
}

/**
 * Capa de peligros (change 0020, spec sprite-rendering "Pintado de los peligros"), en este orden de
 * pintado, que es el de creación: avisos (un solo `Graphics` que se reescribe en cada frame, con el
 * color de su origen), dinamitas (pool de `maxDynamites` sprites en `idle`) y explosiones (pool de
 * `maxBlastSprites` sprites asociados por id, `explode` una vez y quietos en el último frame). Todo
 * se crea en el constructor: ningún objeto del motor por frame. `clear()` lo oculta todo sin
 * animación de salida (R y Volver al menú). Si hay más explosiones que sprites, las sobrantes no se
 * pintan (deuda aceptada, proposal).
 */
export class HazardLayer {
  readonly counts: HazardCounts = {
    warnings: { visible: 0, placeholder: 0 },
    dynamites: { visible: 0, placeholder: 0 },
    explosions: { visible: 0, placeholder: 0 },
  };
  private readonly dynamites: SlotPool<DynamiteSnapshot, PaintedSprite>;
  private readonly blasts: SlotPool<BlastSnapshot, BlastSlot>;
  private clockMs = 0;

  constructor(
    kit: SpriteKit,
    private readonly canvas: WarningCanvas,
    private readonly looks: HazardLooks,
    capacity: HazardCapacity,
  ) {
    canvas.clear();
    const { dynamite, explosion } = looks;
    this.dynamites = new SlotPool(
      capacity.dynamites,
      () => new PaintedSprite(kit.create(), kit.tint),
      {
        show: (painted, d, appearing) => {
          if (appearing) {
            painted.look(dynamite, d.radius).paint(dynamite, false);
            this.count(this.counts.dynamites, dynamite.placeholder, 1);
          }
          painted.setFrame(dynamite, frameAt(dynamite.idle, this.clockMs)).at(d.x, d.y).show(true);
        },
        hide: (painted) => {
          painted.show(false);
          this.count(this.counts.dynamites, dynamite.placeholder, -1);
        },
      },
    );
    const newBlast = (): BlastSlot => ({
      painted: new PaintedSprite(kit.create(), kit.tint),
      startMs: 0,
    });
    this.blasts = new SlotPool(capacity.blasts, newBlast, {
      show: (slot, b, appearing) => {
        if (appearing) {
          slot.startMs = this.clockMs;
          slot.painted.look(explosion, b.radius).paint(explosion, false);
          this.count(this.counts.explosions, explosion.placeholder, 1);
        }
        slot.painted
          .setFrame(explosion, frameAt(explosion.explode, this.clockMs - slot.startMs))
          .at(b.x, b.y)
          .show(true);
      },
      hide: (slot) => {
        slot.painted.show(false);
        this.count(this.counts.explosions, explosion.placeholder, -1);
      },
    });
  }

  /** Un frame: los avisos, dinamitas y explosiones del snapshot con el reloj de render dado. */
  sync(
    warnings: readonly WarningSnapshot[],
    dynamites: readonly DynamiteSnapshot[],
    blasts: readonly BlastSnapshot[],
    clockMs: number,
  ): void {
    this.clockMs = clockMs;
    this.paintWarnings(warnings);
    this.dynamites.sync(dynamites);
    this.blasts.sync(blasts);
  }

  /** Cambio de partida o Volver al menú: nada visible, sin animación de salida. */
  clear(): void {
    this.paintWarnings(NO_WARNINGS);
    this.dynamites.clear();
    this.blasts.clear();
  }

  /** El buffer de comandos del `Graphics` se reescribe entero (es interno al motor). */
  private paintWarnings(warnings: readonly WarningSnapshot[]): void {
    const { canvas } = this;
    canvas.clear();
    for (const w of warnings) {
      const look = this.looks.warnings[w.source];
      canvas.fillStyle(look.color, look.alpha);
      canvas.fillCircle(w.x, w.y, w.radius);
    }
    this.counts.warnings.visible = warnings.length;
  }

  private count(counts: SpriteCount, placeholder: boolean, delta: number): void {
    counts.visible += delta;
    if (placeholder) counts.placeholder += delta;
  }
}
