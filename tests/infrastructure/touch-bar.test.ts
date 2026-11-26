import { describe, expect, it } from 'vitest';
import { TOUCH_LABELS, TouchBar, pressedOnce } from '../../src/infrastructure/dom/TouchBar';
import { PauseGate } from '../../src/infrastructure/phaser/PauseGate';
import { MuteRequests, applyMute } from '../../src/infrastructure/audio/MuteRequests';
import { TOUCH_ICONS } from '../../src/infrastructure/dom/touchIcons';
import { aSoundStore } from '../support/audio';
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

// Spec touch-controls (0035): botón de silencio de la barra (equivale a una pulsación de M).
describe('TouchBar · silencio (0035)', () => {
  function muteBar() {
    const { doc, root, fake } = fakeDom();
    const audio = aSoundStore();
    const requests = new MuteRequests();
    const b = new TouchBar(doc, root, { toggle: () => undefined }, requests);
    audio.store.subscribe((s) => {
      b.setMuted(s.muted);
    });
    const nav = fake.children[0] as FakeElement;
    const mute = nav.findAll((e) => e.tagName === 'button')[2] as FakeElement;
    /** Un frame del juego: la composición consume la petición (PRE_STEP). */
    const frame = () => {
      applyMute(requests, audio.store);
    };
    return { b, nav, mute, audio, requests, frame };
  }

  it('Scenario: Silenciar con la barra', () => {
    const { mute, audio, frame } = muteBar();
    const before = [mute.getAttribute('aria-label'), mute.getAttribute('aria-pressed')];

    mute.click();
    frame();
    const first = [
      audio.store.settings.muted,
      mute.getAttribute('aria-label'),
      mute.getAttribute('aria-pressed'),
    ];
    mute.click();
    frame();

    expect(before).toEqual([TOUCH_LABELS.mute, 'false']);
    expect(first).toEqual([true, TOUCH_LABELS.unmute, 'true']);
    expect([audio.store.settings.muted, mute.getAttribute('aria-label')]).toEqual([
      false,
      TOUCH_LABELS.mute,
    ]);
  });

  it('Scenario: Silenciar con la barra (icono de altavoz y altavoz tachado, sin texto)', () => {
    const { mute, frame } = muteBar();
    const icon = () => mute.children[0]?.getAttribute('src');
    const speaker = icon();
    mute.click();
    frame();

    expect(speaker).toBe(TOUCH_ICONS.sound);
    expect(icon()).toBe(TOUCH_ICONS.muted);
    expect(mute.textContent).toBe('');
  });

  it('Scenario: Silencio y M en el mismo frame', () => {
    const { mute, audio, requests, frame } = muteBar();

    mute.click();
    requests.mark();
    frame();

    expect([audio.store.settings.muted, audio.storage.audioWrites]).toEqual([true, 1]);
  });

  it('Scenario: Barra en el menú (el botón de silencio es visible con y sin pantalla completa)', () => {
    const { doc, root, fake } = fakeDom();
    const b = new TouchBar(doc, root, undefined, new MuteRequests());
    b.sync({ inRun: false, ended: false });
    const buttons = (fake.children[0] as FakeElement).findAll((e) => e.tagName === 'button');

    expect(buttons.map((x) => [x.getAttribute('aria-label'), x.hidden])).toEqual([
      [TOUCH_LABELS.pause, true],
      [TOUCH_LABELS.restart, true],
      [TOUCH_LABELS.mute, false],
    ]);
  });

  it('Scenario: Silenciar con la barra (con la partida en curso o terminada sigue visible)', () => {
    const { b, mute } = muteBar();
    b.sync({ inRun: true, ended: false });
    const running = mute.hidden;
    b.sync({ inRun: true, ended: true });

    expect([running, mute.hidden]).toEqual([false, false]);
  });
});
