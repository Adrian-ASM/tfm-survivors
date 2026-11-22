import { animDone, frameAt } from './art/animation';
import type { CorpseLook } from './art/looks';
import type { CorpseSink } from './EnemyLayer';
import type { SpriteCount } from './PlayerView';
import { PaintedSprite, type SpriteKit } from './SpriteLike';

interface Corpse {
  readonly painted: PaintedSprite;
  active: boolean;
  /** Tiempo de render en que empezó; `NaN` hasta el primer `sync` tras aparecer. */
  startMs: number;
}

/**
 * Cadáveres de los enemigos dados de baja (design D6): `maxCorpses` sprites preasignados que
 * reproducen una vez `death` en la última posición del enemigo y se ocultan al terminar. Con el tope
 * lleno una baja no muestra cadáver y no se recicla ninguno en curso. Sin tweens ni eventos: el
 * tiempo es el reloj de render, que se congela con el mundo detenido.
 */
export class CorpseLayer implements CorpseSink {
  readonly counts: SpriteCount = { visible: 0, placeholder: 0 };
  private readonly corpses: Corpse[];

  constructor(
    maxCorpses: number,
    kit: SpriteKit,
    private readonly look: CorpseLook,
  ) {
    this.corpses = Array.from({ length: maxCorpses }, () => ({
      painted: new PaintedSprite(kit.create(), kit.tint),
      active: false,
      startMs: Number.NaN,
    }));
  }

  spawn(x: number, y: number, facingLeft: boolean, radius: number): boolean {
    const corpse = this.corpses.find((c) => !c.active);
    if (!corpse) return false;
    const look = this.look;
    corpse.active = true;
    corpse.startMs = Number.NaN;
    corpse.painted
      .look(look, radius)
      .setFrame(look, frameAt(look.death, 0))
      .setFlip(look.flips && facingLeft !== (look.facing === 'left'))
      .paint(look, false)
      .at(x, y)
      .show(true);
    this.count(1);
    return true;
  }

  /** Avanza cada cadáver con el reloj de render y oculta los que han terminado. */
  sync(clockMs: number): void {
    const look = this.look;
    for (const corpse of this.corpses) {
      if (!corpse.active) continue;
      if (Number.isNaN(corpse.startMs)) corpse.startMs = clockMs;
      const elapsed = clockMs - corpse.startMs;
      if (animDone(look.death, elapsed)) this.release(corpse);
      else corpse.painted.setFrame(look, frameAt(look.death, elapsed));
    }
  }

  /** Descarta todos los cadáveres sin terminar su animación (R o Volver al menú). */
  clear(): void {
    for (const corpse of this.corpses) if (corpse.active) this.release(corpse);
  }

  private release(corpse: Corpse): void {
    corpse.active = false;
    corpse.painted.show(false);
    this.count(-1);
  }

  private count(delta: number): void {
    this.counts.visible += delta;
    if (this.look.placeholder) this.counts.placeholder += delta;
  }
}
