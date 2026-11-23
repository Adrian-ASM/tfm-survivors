import { describe, expect, it } from 'vitest';
import {
  UI_SCALE_PROPERTY,
  applyUiScale,
  type StyleLike,
} from '../../src/infrastructure/dom/applyUiScale';
import { screenFrame } from '../../src/infrastructure/phaser/ui/screenFrame';

/** `CSSStyleDeclaration` falso: guarda las propiedades y cuenta las escrituras. */
class FakeStyle implements StyleLike {
  props = new Map<string, string>();
  writes = 0;
  setProperty(name: string, value: string): void {
    this.props.set(name, value);
    this.writes += 1;
  }
  getPropertyValue(name: string): string {
    return this.props.get(name) ?? '';
  }
}

// Spec main-menu / run-results (0017): los paneles DOM escalan con el mismo escalón que el HUD.
describe('applyUiScale (0017, design D6/D11)', () => {
  it('pone --ui-scale 1 con 1.280 × 720 y 2 con 1.920 × 1.080', () => {
    const style = new FakeStyle();

    applyUiScale(style, screenFrame(1280, 720));
    const one = style.getPropertyValue(UI_SCALE_PROPERTY);
    applyUiScale(style, screenFrame(1920, 1080));

    expect([UI_SCALE_PROPERTY, one, style.getPropertyValue(UI_SCALE_PROPERTY)]).toEqual([
      '--ui-scale',
      '1',
      '2',
    ]);
  });

  it('no escribe si el escalón no cambia', () => {
    const style = new FakeStyle();
    applyUiScale(style, screenFrame(1280, 720));

    applyUiScale(style, screenFrame(1000, 600));
    applyUiScale(style, screenFrame(960, 540));

    expect(style.writes).toBe(1);
  });
});
