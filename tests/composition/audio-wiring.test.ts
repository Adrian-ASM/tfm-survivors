import { describe, expect, it, vi } from 'vitest';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import {
  exposeProbe,
  wireAudioControls,
  wireAudioPlayback,
  type AudioGame,
} from '../../src/composition/audioWiring';
import {
  AudioLoadStatus,
  audioMode,
  type AudioMode,
} from '../../src/infrastructure/audio/audioPlan';
import { GuideModal } from '../../src/infrastructure/dom/GuideModal';
import { MenuPanel } from '../../src/infrastructure/dom/MenuPanel';
import { MENU_LABELS } from '../../src/infrastructure/dom/menuText';
import { MenuController } from '../../src/infrastructure/menu/MenuController';
import { AudioMemoryStorage, repositoryAudio } from '../support/audio';
import { aDefaultConfig, TICK_MS } from '../support/builders';
import { fakeDom, type FakeElement } from '../support/fakeDom';
import { TEST_ICONS, defaultGuide, isShown } from '../support/guide';
import { startSeededRun } from '../support/runs';

// Spec audio y main-menu (0035), cableado del audio en la composición con dependencias falsas: el
// juego (eventos y gestor de sonido), la ventana (sonda) y el almacenamiento (design D12).
const EVENTS = { hidden: 'hidden', visible: 'visible', preStep: 'prestep' };

class FakeGame implements AudioGame {
  private readonly handlers = new Map<string, (() => void)[]>();
  readonly sound = { locked: false, pauseOnBlur: true, add: vi.fn() };
  readonly cache = { audio: { exists: () => false } };
  readonly events = {
    on: (event: string, fn: () => void) => {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), fn]);
    },
  };
  emit(event: string): void {
    for (const fn of this.handlers.get(event) ?? []) fn();
  }
}

function setup(mode: AudioMode = 'muted') {
  const { doc, root, fake, fakeDoc } = fakeDom();
  const storage = new AudioMemoryStorage();
  const audio = repositoryAudio();
  const controls = wireAudioControls(audio, {
    doc,
    root,
    storage: () => storage,
    warn: () => undefined,
    keys: doc,
  });
  const game = new FakeGame();
  const status = new AudioLoadStatus();
  const playback = wireAudioPlayback(audio, controls, {
    mode,
    game,
    events: EVENTS,
    status,
    maxTowerProjectiles: 16,
  });
  return { doc, root, fake, fakeDoc, controls, game, playback, storage, status };
}

const BASE: RunSnapshot = startSeededRun(aDefaultConfig(), 42, 'empty').snapshot();

describe('Cableado del audio (0035, design D12)', () => {
  it('Scenario: Sonda en el menú', () => {
    const { playback } = setup();
    playback.newRun();
    playback.screen('playing');
    playback.render(BASE, 0);
    playback.render({ ...BASE, kills: 2 }, TICK_MS);
    playback.screen('paused');
    const before = playback.view();

    playback.screen('menu');
    const inMenu = playback.view();

    expect(inMenu.music).toBe('stopped');
    expect([inMenu.requested, inMenu.played, inMenu.dropped]).toEqual([
      before.requested,
      before.played,
      before.dropped,
    ]);
    expect(inMenu.requested).toBe(2);
    expect([inMenu.loaded, inMenu.filesRequested, inMenu.sounding]).toEqual([false, 0, 0]);
  });

  it('Scenario: Sin sonda fuera de E2E', () => {
    const win = {};
    const withE2e = {};

    exposeProbe(win, false, { audio: {} });
    exposeProbe(withE2e, true, { audio: {} });

    expect('__sprint' in win).toBe(false);
    expect('__sprint' in withE2e).toBe(true);
  });

  it('Scenario: Menú tras Volver al menú en modo E2E', () => {
    const { doc, root, fake, controls, playback } = setup();
    const controller = new MenuController();
    const guide = new GuideModal(doc, root, defaultGuide(), TEST_ICONS);
    const actions = { onExport: vi.fn(), onImport: vi.fn(), onOpenConfirm: vi.fn() };
    const menu = new MenuPanel(doc, root, controller, actions, guide, controls.panel);
    playback.newRun();
    playback.screen('paused');
    controls.panel.show(() => undefined, { escCloses: false });

    menu.show();
    playback.screen('menu');

    const soundRoot = fake.byClass('sound-panel')[0] as FakeElement;
    const buttons = (fake.byClass('menu-panel')[0] as FakeElement).findAll(
      (e) => e.tagName === 'button',
    );
    expect([isShown(soundRoot), controls.panel.open, playback.view().music]).toEqual([
      false,
      false,
      'stopped',
    ]);
    expect(buttons.map((b) => b.textContent)).toContain(MENU_LABELS.sound);
  });

  it('Scenario: Carga en modo E2E (salida muda, 0 ficheros pedidos y lógica entera)', () => {
    const { playback, game } = setup(audioMode(true, true));
    playback.newRun();
    playback.screen('playing');
    playback.render(BASE, 0);
    playback.render({ ...BASE, kills: 1 }, TICK_MS);

    const v = playback.view();
    expect([v.music, v.filesRequested, v.sounding, v.played]).toEqual(['playing', 0, 0, 1]);
    // Con la salida muda no se toca el sistema de sonido del motor.
    expect([game.sound.pauseOnBlur, game.sound.add.mock.calls.length]).toEqual([true, 0]);
  });

  it('Scenario: Pestaña oculta en curso (HIDDEN y VISIBLE del juego, en el propio evento)', () => {
    const { playback, game } = setup();
    playback.newRun();
    playback.screen('playing');

    game.emit(EVENTS.hidden);
    const hidden = playback.view().music;
    game.emit(EVENTS.visible);

    expect([hidden, playback.view().music]).toEqual(['paused', 'playing']);
  });

  it('Scenario: Silencio y M en el mismo frame (PRE_STEP consume una vez y aplica los volúmenes)', () => {
    const { playback, game, controls, fakeDoc, storage } = setup();
    playback.newRun();
    playback.screen('playing');

    fakeDoc.dispatchKey('m', { code: 'KeyM' });
    controls.requests.mark();
    game.emit(EVENTS.preStep);

    expect(playback.view().settings.muted).toBe(true);
    expect(playback.view().volumes).toEqual({ music: 0, effects: 0 });
    expect(storage.audioWrites).toBe(1);
  });

  it('Scenario: Navegador sin Web Audio (modo web: pauseOnBlur apagado; sin Web Audio, mudo)', () => {
    const web = setup('web');
    const none = setup('unavailable');

    expect(web.game.sound.pauseOnBlur).toBe(false);
    expect(none.game.sound.pauseOnBlur).toBe(true);
  });
});
