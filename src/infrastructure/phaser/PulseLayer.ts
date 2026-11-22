import type { PulseSnapshot } from '../../domain/run/RunSnapshot';

/** Lo mínimo que la capa necesita de un anillo del motor (`Phaser.GameObjects.Arc` con trazo). */
export interface RingSprite {
  setPosition(x: number, y: number): unknown;
  setRadius(radius: number): unknown;
  setAlpha(alpha: number): unknown;
  setVisible(visible: boolean): unknown;
}

/**
 * Opacidad del anillo de un pulso disparado en `firedAt` y visible `visualTicks` ticks: 1 al
 * disparar y decreciente con la edad. Solo lee el snapshot (como `playerVisible`).
 */
export function pulseAlpha(tick: number, firedAt: number, visualTicks: number): number {
  return 1 - (tick - firedAt) / visualTicks;
}

/** Lista vacía compartida para `clear()` (no asigna). */
const NO_PULSES: readonly PulseSnapshot[] = Object.freeze([]);

interface Ring {
  readonly sprite: RingSprite;
  visible: boolean;
  radius: number;
}

/**
 * Pinta los pulsos visibles del snapshot con `pulseCapacity` anillos preasignados, asignados por
 * índice: son efímeros y no se mueven, así que no hace falta asociarlos por id. Sin objetos del
 * motor por frame.
 */
export class PulseLayer {
  /** Anillos visibles para la sonda (un anillo nunca es aspecto de reserva). */
  readonly counts = { visible: 0, placeholder: 0 };
  private readonly rings: Ring[];

  constructor(
    capacity: number,
    private readonly visualTicks: ReadonlyMap<string, number>,
    create: () => RingSprite,
  ) {
    this.rings = Array.from({ length: capacity }, () => {
      const sprite = create();
      sprite.setVisible(false);
      return { sprite, visible: false, radius: -1 };
    });
  }

  /** Oculta todos los anillos (reinicio de partida). */
  clear(): void {
    this.sync(NO_PULSES, 0);
  }

  sync(pulses: readonly PulseSnapshot[], tick: number): void {
    this.counts.visible = Math.min(pulses.length, this.rings.length);
    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i];
      if (!ring) continue;
      const p = pulses[i];
      if (!p) {
        if (ring.visible) ring.sprite.setVisible(false);
        ring.visible = false;
        continue;
      }
      ring.sprite.setPosition(p.x, p.y);
      if (ring.radius !== p.radius) ring.sprite.setRadius(p.radius);
      ring.radius = p.radius;
      ring.sprite.setAlpha(pulseAlpha(tick, p.firedAt, this.visualTicks.get(p.weapon) ?? 1));
      if (!ring.visible) ring.sprite.setVisible(true);
      ring.visible = true;
    }
  }
}
