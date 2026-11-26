import { describe, expect, it, vi } from 'vitest';
import { FixedStepLoop } from '../../../src/application/FixedStepLoop';
import { TickRun } from '../../../src/application/TickRun';
import { PlayerInput } from '../../../src/domain/player/PlayerInput';
import { wireAudioControls } from '../../../src/composition/audioWiring';
import { GuideModal } from '../../../src/infrastructure/dom/GuideModal';
import { MenuPanel } from '../../../src/infrastructure/dom/MenuPanel';
import { MENU_LABELS } from '../../../src/infrastructure/dom/menuText';
import { MenuController } from '../../../src/infrastructure/menu/MenuController';
import { PauseGate } from '../../../src/infrastructure/phaser/PauseGate';
import { preferKeyboard } from '../../../src/infrastructure/phaser/touch/preferKeyboard';
import { AudioMemoryStorage, repositoryAudio } from '../../support/audio';
import { TICK_MS } from '../../support/builders';
import { fakeDom, type FakeElement } from '../../support/fakeDom';
import { GuideReader, TEST_ICONS, defaultGuide, isShown } from '../../support/guide';
import { aContactConfig, startRun } from '../../support/runs';

// Spec audio (0035), "Tecla M", y los escenarios de M de main-menu, touch-controls y
// simulation-loop: M marca una petición en el documento y la composición la consume una vez por
// frame del juego (design D11), con los controles de audio reales sobre un DOM falso.
const L = MENU_LABELS;
const M = { code: 'KeyM' } as const;

function setup() {
  const { doc, root, fake, fakeDoc } = fakeDom();
  const storage = new AudioMemoryStorage();
  const audio = wireAudioControls(repositoryAudio(), {
    doc,
    root,
    storage: () => storage,
    warn: () => undefined,
    keys: doc,
  });
  const controller = new MenuController();
  const guide = new GuideModal(doc, root, defaultGuide(), TEST_ICONS);
  const actions = { onExport: vi.fn(), onImport: vi.fn(), onOpenConfirm: vi.fn() };
  const menu = new MenuPanel(doc, root, controller, actions, guide, audio.panel);
  menu.show();
  const menuRoot = fake.byClass('menu-panel')[0] as FakeElement;
  const menuButton = (label: string) =>
    menuRoot.findAll((e) => e.tagName === 'button' && e.textContent === label)[0] as FakeElement;
  const press = (key = 'm', options: Parameters<typeof fakeDoc.dispatchKey>[1] = M) =>
    fakeDoc.dispatchKey(key, options);
  return {
    audio,
    storage,
    controller,
    guide,
    menuRoot,
    menuButton,
    press,
    read: new GuideReader(fake),
    muted: () => audio.store.settings.muted,
  };
}

const CENTER = { x: 480, y: 270 };
const quietRun = () =>
  new TickRun(startRun(aContactConfig(), { player: CENTER }), new FixedStepLoop());

describe('Tecla M (spec audio 0035)', () => {
  it('Scenario: M en partida', () => {
    const s = setup();
    const a = quietRun();
    const b = quietRun();
    const differing: number[] = [];
    for (let frame = 0; frame < 120; frame++) {
      if (frame === 10) s.press();
      if (frame > 10 && frame <= 30) s.press('m', { ...M, repeat: true });
      s.audio.frame();
      const sa = a.execute(TICK_MS, PlayerInput.of(1, 0));
      const sb = b.execute(TICK_MS, PlayerInput.of(1, 0));
      if (JSON.stringify(sa) !== JSON.stringify(sb)) differing.push(frame);
    }

    expect([s.muted(), s.storage.audioWrites, differing]).toEqual([true, 1, []]);
  });

  it('Scenario: M en el menú con la guía abierta', () => {
    const s = setup();
    s.menuButton(L.guide).click();
    s.read.control(L.guideNext).click();
    s.read.control(L.guideNext).click();

    s.press();
    s.audio.frame();

    expect([s.muted(), s.read.indicator, s.read.visible]).toEqual([true, '3 de 7', true]);
    expect(s.controller.takePlay()).toBe(false);
  });

  it('Scenario: M con el panel abierto', () => {
    const s = setup();
    s.menuButton(L.sound).click();

    s.press();
    s.audio.frame();
    const first = s.audio.panel.view.muted;
    s.press();
    s.audio.frame();

    expect([first, s.audio.panel.view.muted, s.audio.panel.open]).toEqual([true, false, true]);
  });

  it('Scenario: M con modificador', () => {
    const s = setup();

    s.press('m', { ...M, ctrlKey: true });
    s.press('m', { ...M, altKey: true });
    s.press('m', { ...M, metaKey: true });
    s.audio.frame();

    expect([s.muted(), s.storage.audioWrites]).toEqual([false, 0]);
  });

  it('Scenario: M en el menú', () => {
    const s = setup();

    s.press();
    s.audio.frame();

    const visible = s.menuRoot.findAll((e) => e.tagName === 'button' && !e.disabled);
    expect([s.muted(), isShown(s.menuRoot), visible.length]).toEqual([true, true, 6]);
    expect(s.controller.takePlay()).toBe(false);
  });

  it('Scenario: M en el menú (otra tecla con el mismo carácter pero otro código no conmuta)', () => {
    const s = setup();

    s.press('m', { code: 'Semicolon' });
    s.audio.frame();

    expect(s.muted()).toBe(false);
  });

  it('Scenario: M con el joystick activo', () => {
    const s = setup();
    // El teclado del motor no tiene M: sin teclas de movimiento manda el joystick.
    const keyboard = { read: () => PlayerInput.NONE };
    const stick = { read: () => PlayerInput.of(1, 0) };

    s.press();
    s.audio.frame();
    const input = preferKeyboard(keyboard, stick).read();

    expect([input.direction.x, input.direction.y, s.muted()]).toEqual([1, 0, true]);
  });

  it('Scenario: M con el aviso visible', () => {
    const s = setup();
    const run = quietRun();
    for (let t = 0; t < 500; t++) run.execute(TICK_MS, PlayerInput.NONE);
    const gate = new PauseGate();

    gate.hold(true, run);
    s.press();
    s.audio.frame();
    const held = gate.frame(run, TICK_MS, PlayerInput.NONE, 1);
    gate.hold(false, run);

    expect([s.muted(), held.tick, gate.paused, run.status]).toEqual([true, 500, false, 'running']);
  });

  it('Scenario: Silencio sin step', () => {
    const s = setup();
    const run = quietRun();
    for (let t = 0; t < 40; t++) run.execute(TICK_MS, PlayerInput.NONE);
    const gate = new PauseGate();

    s.press();
    s.audio.frame();
    const after = gate.manualFrame(run, 0, PlayerInput.NONE);

    expect([s.muted(), after.snapshot.tick, after.ticks]).toEqual([true, 40, 0]);
  });
});
