import { describe, expect, it } from 'vitest';
import { TOUCH_LABELS, TouchBar, pressedOnce } from '../../src/infrastructure/dom/TouchBar';
import { PauseGate } from '../../src/infrastructure/phaser/PauseGate';
import { fakeDom, type FakeElement } from '../support/fakeDom';

// Spec touch-controls (0033), "Barra táctil" (sin navegador: DOM falso).
function bar(withFullscreen = true) {
  const { doc, root, fake } = fakeDom();
  const toggles: number[] = [];
  const b = new TouchBar(doc, root, withFullscreen ? { toggle: () => toggles.push(1) } : undefined);
  const nav = fake.children[0] as FakeElement;
  const byLabel = (label: string) =>
    nav.findAll((e) => e.tagName === 'button' && e.getAttribute('aria-label') === label)[0];
  return { b, nav, toggles, byLabel };
}

const visible = (e: FakeElement | undefined): boolean | undefined => (e ? !e.hidden : undefined);

describe('TouchBar (0033)', () => {
  it('Scenario: Barra en el menú (⏸ y ↻ ocultos; ⛶ visible con la API y ausente sin ella)', () => {
    const withApi = bar(true);
    const withoutApi = bar(false);

    withApi.b.sync({ inRun: false, ended: false });

    expect(withApi.nav.className).toBe('touch-bar');
    expect(visible(withApi.byLabel(TOUCH_LABELS.pause))).toBe(false);
    expect(visible(withApi.byLabel(TOUCH_LABELS.restart))).toBe(false);
    expect(visible(withApi.byLabel(TOUCH_LABELS.fullscreen))).toBe(true);
    expect(withoutApi.byLabel(TOUCH_LABELS.fullscreen)).toBeUndefined();
  });

  it('iconos de imagen (SVG en data:) sin glifos de texto', () => {
    const { nav } = bar();
    const buttons = nav.findAll((e) => e.tagName === 'button');
    expect(buttons).toHaveLength(3);
    for (const b of buttons) {
      const img = b.children[0];
      expect(img?.tagName).toBe('img');
      expect(img?.getAttribute('src')).toMatch(/^data:image\/svg\+xml,/);
      expect(img?.getAttribute('alt')).toBe('');
      expect(b.textContent).toBe('');
    }
  });

  it('⏸ visible con partida no terminada; ↻ solo con la partida terminada', () => {
    const { b, byLabel } = bar();
    b.sync({ inRun: true, ended: false });
    const running = [visible(byLabel(TOUCH_LABELS.pause)), visible(byLabel(TOUCH_LABELS.restart))];
    b.sync({ inRun: true, ended: true });
    const over = [visible(byLabel(TOUCH_LABELS.pause)), visible(byLabel(TOUCH_LABELS.restart))];

    expect(running).toEqual([true, false]);
    expect(over).toEqual([false, true]);
  });

  it('Scenario: Reiniciar con ↻ (dos toques seguidos son una sola pulsación; luego ↻ se oculta)', () => {
    const { b, byLabel } = bar();
    b.sync({ inRun: true, ended: true });
    byLabel(TOUCH_LABELS.restart)?.click();
    byLabel(TOUCH_LABELS.restart)?.click();

    const reads = [b.takeRestart(), b.takeRestart()];
    b.sync({ inRun: true, ended: false });

    expect(reads).toEqual([true, false]);
    expect(visible(byLabel(TOUCH_LABELS.restart))).toBe(false);
    expect(visible(byLabel(TOUCH_LABELS.pause))).toBe(true);
  });

  it('⏸ deja una pulsación en cola que se consume; ⛶ llama al control', () => {
    const { b, byLabel, toggles } = bar();
    b.sync({ inRun: true, ended: false });
    byLabel(TOUCH_LABELS.pause)?.click();
    byLabel(TOUCH_LABELS.fullscreen)?.click();

    expect([b.takePause(), b.takePause()]).toEqual([true, false]);
    expect(toggles).toEqual([1]);
  });

  it('Scenario: ⏸ y Esc en el mismo frame (una sola pulsación: la partida queda en pausa)', () => {
    const { b, byLabel } = bar();
    b.sync({ inRun: true, ended: false });
    const gate = new PauseGate();
    const run = { discardPending: () => undefined };
    byLabel(TOUCH_LABELS.pause)?.click();

    const esc = true;
    const tapped = b.takePause();
    gate.step(pressedOnce(esc, tapped), null, 'running', run);

    expect(gate.paused).toBe(true);
    expect(b.takePause()).toBe(false);
  });
});
