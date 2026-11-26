import type { HitKind, HitSnapshot } from '../../src/domain/run/RunSnapshot';
import type { CombatLooks } from '../../src/infrastructure/content/appearanceSchema';
import type { TextLike } from '../../src/infrastructure/phaser/DamageNumberLayer';
import type { BarCanvas } from '../../src/infrastructure/phaser/HealthBarLayer';
import { repoAppearance } from './mapArt';

/** Aspecto del combate de los datos del repositorio (0031): L 800, H 32, E 20, P 48, barra 48 × 6. */
export const REPO_COMBAT: CombatLooks = repoAppearance().combat;

/** Doble de `Phaser.GameObjects.Text` (0031): guarda su estado y cuántas veces cambia su texto. */
export class FakeText implements TextLike {
  text = '';
  x = 0;
  y = 0;
  alpha = 1;
  tint = 0xffffff;
  visible = true;
  originX = 0;
  originY = 0;
  setTexts = 0;

  setText(text: string): this {
    this.text = text;
    this.setTexts += 1;
    return this;
  }
  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }
  setAlpha(alpha: number): this {
    this.alpha = alpha;
    return this;
  }
  setTint(color: number): this {
    this.tint = color;
    return this;
  }
  setVisible(visible: boolean): this {
    this.visible = visible;
    return this;
  }
  setOrigin(x: number, y: number): this {
    this.originX = x;
    this.originY = y;
    return this;
  }
}

/** Fábrica de `FakeText` que guarda los creados, en orden. */
export function fakeTexts(): { readonly made: FakeText[]; make: () => FakeText } {
  const made: FakeText[] = [];
  return {
    made,
    make: () => {
      const t = new FakeText();
      made.push(t);
      return t;
    },
  };
}

/** Doble de `Graphics` para las barras: rectángulos rellenos desde el último `clear()`. */
export class FakeBarCanvas implements BarCanvas {
  rects: { x: number; y: number; w: number; h: number; color: number }[] = [];
  clears = 0;
  private color = 0;

  clear(): this {
    this.rects = [];
    this.clears += 1;
    return this;
  }
  fillStyle(color: number): this {
    this.color = color;
    return this;
  }
  fillRect(x: number, y: number, w: number, h: number): this {
    this.rects.push({ x, y, w, h, color: this.color });
    return this;
  }
}

/** Golpe de prueba (id, clase, daño y posición; tick 1 por defecto). */
export const aHit = (
  id: number,
  kind: HitKind,
  amount: number,
  x = 1000,
  y = 1000,
  tick = 1,
): HitSnapshot =>
  kind === 'player'
    ? { id, tick, kind, x, y, amount }
    : { id, tick, kind, targetId: id, x, y, amount };

/** Números visibles de una lista de dobles. */
export const shown = (made: readonly FakeText[]): FakeText[] => made.filter((t) => t.visible);
