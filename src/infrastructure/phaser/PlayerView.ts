import type { RunSnapshot } from '../../domain/run/RunSnapshot';
import { AnimTrack, Motion, frameAt } from './art/animation';
import type { MovingLook } from './art/looks';
import { playerVisible } from './playerBlink';
import { PaintedSprite, type SpriteKit } from './SpriteLike';

/** Recuento de un tipo de sprite para la sonda de E2E (design D7). */
export interface SpriteCount {
  visible: number;
  placeholder: number;
}

/**
 * Sprite del jugador (sustituye al `Arc`, change 0012): `idle`/`walk` por desplazamiento entre ticks,
 * volteo según la orientación del dibujo, parpadeo de invulnerabilidad e `idle` con la partida
 * terminada. `reset()` (partida nueva) no hereda estado ni orientación.
 */
export class PlayerView {
  readonly counts: SpriteCount = { visible: 0, placeholder: 0 };
  private readonly painted: PaintedSprite;
  private readonly motion = new Motion();
  private readonly track = new AnimTrack<'idle' | 'walk'>();

  constructor(
    kit: SpriteKit,
    private readonly look: MovingLook,
  ) {
    this.painted = new PaintedSprite(kit.create(), kit.tint);
    this.counts.placeholder = look.placeholder ? 1 : 0;
  }

  reset(): void {
    this.motion.reset();
    this.track.reset();
  }

  render(s: Pick<RunSnapshot, 'tick' | 'status' | 'player'>, clockMs: number): void {
    const { x, y, radius } = s.player;
    const look = this.look;
    this.motion.update(x, y, s.tick);
    const walking = this.motion.moving && s.status !== 'over';
    const anim = walking ? look.walk : look.idle;
    const elapsed = this.track.play(walking ? 'walk' : 'idle', clockMs);
    const visible = playerVisible(s);
    this.painted
      .look(look, radius)
      .setFrame(look, frameAt(anim, elapsed))
      .setFlip(look.flips && this.motion.flipX(look.facing))
      .paint(look, false)
      .at(x, y)
      .show(visible);
    this.counts.visible = visible ? 1 : 0;
  }

  /** Modo menú o escena cerrada: oculto. */
  hide(): void {
    this.painted.show(false);
    this.counts.visible = 0;
  }
}
