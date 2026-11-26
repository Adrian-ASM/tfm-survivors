import { describe, expect, it, vi } from 'vitest';
import { GuideModal } from '../../../src/infrastructure/dom/GuideModal';
import { MenuPanel } from '../../../src/infrastructure/dom/MenuPanel';
import { MENU_LABELS } from '../../../src/infrastructure/dom/menuText';
import { PausePanel } from '../../../src/infrastructure/dom/PausePanel';
import { SLIDER_STEP, SoundPanel } from '../../../src/infrastructure/dom/SoundPanel';
import { MenuController } from '../../../src/infrastructure/menu/MenuController';
import { AUDIO_STORAGE_KEY } from '../../../src/infrastructure/audio/LocalStorageAudioSettingsRepository';
import { aSoundStore } from '../../support/audio';
import { fakeDom, type FakeElement } from '../../support/fakeDom';
import { TEST_ICONS, defaultGuide, isShown } from '../../support/guide';

// Spec audio (0035), "Panel Sonido": abrir, cerrar, bloqueo de lo de debajo, deslizadores y
// escrituras, en Node con el DOM falso (design D10).
const L = MENU_LABELS;

function setup(initial?: { music: number; effects: number; muted: boolean }) {
  const { doc, root, fake, fakeDoc } = fakeDom();
  const audio = aSoundStore(initial);
  const sound = new SoundPanel(doc, root, audio.store);
  const controller = new MenuController();
  const guide = new GuideModal(doc, root, defaultGuide(), TEST_ICONS);
  const actions = { onExport: vi.fn(), onImport: vi.fn(), onOpenConfirm: vi.fn() };
  const menu = new MenuPanel(doc, root, controller, actions, guide, sound);
  const pause = new PausePanel(doc, root, sound);
  menu.show();
  const first = (cls: string): FakeElement => {
    const e = fake.byClass(cls)[0];
    if (!e) throw new Error(`sin .${cls}`);
    return e;
  };
  const panelRoot = first('sound-panel');
  const menuRoot = first('menu-panel');
  const pauseRoot = first('pause-panel');
  const buttonIn = (where: FakeElement, label: string): FakeElement => {
    const b = where.findAll((e) => e.tagName === 'button' && e.textContent === label)[0];
    if (!b) throw new Error(`sin botón ${label}`);
    return b;
  };
  const sliders = panelRoot.findAll((e) => e.tagName === 'input' && e.type === 'range');
  const checkbox = panelRoot.findAll((e) => e.tagName === 'input' && e.type === 'checkbox')[0];
  const [musicSlider, effectsSlider] = sliders;
  if (!musicSlider || !effectsSlider || !checkbox) throw new Error('faltan controles');
  /** Una flecha sobre un deslizador: el navegador mueve el valor un paso y lanza input y change. */
  const arrow = (slider: FakeElement, dir: 1 | -1) => {
    const v = Math.min(100, Math.max(0, Number(slider.value) + dir * SLIDER_STEP));
    if (v === Number(slider.value)) return;
    slider.value = String(v);
    slider.dispatch('input');
    slider.dispatch('change');
  };
  return {
    sound,
    audio,
    controller,
    menu,
    pause,
    guide,
    actions,
    fakeDoc,
    panelRoot,
    menuRoot,
    pauseRoot,
    musicSlider,
    effectsSlider,
    checkbox,
    arrow,
    menuButton: (label: string) => buttonIn(menuRoot, label),
    pauseButton: (label: string) => buttonIn(pauseRoot, label),
    closeButton: () => buttonIn(panelRoot, L.soundClose),
    key: fakeDoc.dispatchKey.bind(fakeDoc),
    labels: () =>
      panelRoot
        .findAll((e) => e.tagName === 'span' || e.tagName === 'button' || e.tagName === 'h2')
        .map((e) => e.textContent),
  };
}

describe('Panel Sonido (spec audio 0035)', () => {
  it('Scenario: Abrir desde el menú y cerrar con Esc', () => {
    const s = setup();

    s.menuButton(L.sound).click();
    const opened = [isShown(s.panelRoot), s.panelRoot.contains(s.fakeDoc.activeElement)];
    const labels = s.labels();
    s.key('Escape');
    const closed = [isShown(s.panelRoot), s.fakeDoc.activeElement?.textContent];
    s.menuButton(L.play).click();

    expect(opened).toEqual([true, true]);
    expect(labels).toEqual([L.sound, L.soundMusic, L.soundEffects, L.soundMute, L.soundClose]);
    expect(closed).toEqual([false, L.sound]);
    expect(s.controller.takePlay()).toBe(true);
  });

  it('Scenario: Abrir desde el menú y cerrar con Esc (sin partida tras Esc)', () => {
    const s = setup();
    s.menuButton(L.sound).click();
    s.key('Escape');

    expect([s.controller.state, s.controller.takePlay()]).toEqual(['idle', false]);
  });

  it('Scenario: Abrir desde el menú y cerrar con Esc (Cerrar también cierra)', () => {
    const s = setup();
    s.menuButton(L.sound).click();
    s.closeButton().click();

    expect([isShown(s.panelRoot), s.fakeDoc.activeElement?.textContent]).toEqual([false, L.sound]);
  });

  it('Scenario: Botones de debajo bloqueados (desde el menú)', () => {
    const s = setup();
    s.menuButton(L.sound).click();

    for (const label of [L.play, L.guide, L.clear]) s.menuButton(label).click();
    for (const k of ['r', '1']) s.key(k);

    expect(isShown(s.panelRoot)).toBe(true);
    expect(s.controller.takePlay()).toBe(false);
    expect(s.guide.view.open).toBe(false);
    expect(s.actions.onOpenConfirm).not.toHaveBeenCalled();
  });

  it('Scenario: Botones de debajo bloqueados (desde la pausa)', () => {
    const s = setup();
    s.menu.hide();
    s.pause.setVisible(true);
    s.pauseButton(L.sound).click();

    s.pauseButton(L.resume).click();
    s.pauseButton(L.toMenu).click();

    expect(isShown(s.panelRoot)).toBe(true);
    expect(s.pause.takeAction()).toBeNull();
  });

  it('Scenario: Abrir desde la pausa (orden Reanudar, Sonido, Volver al menú; Esc no lo cierra el panel)', () => {
    const s = setup();
    s.menu.hide();
    s.pause.setVisible(true);
    const order = s.pauseRoot.findAll((e) => e.tagName === 'button').map((b) => b.textContent);

    s.pauseButton(L.sound).click();
    s.key('Escape');
    const afterEsc = isShown(s.panelRoot);
    s.sound.close();

    expect(order).toEqual([L.resume, L.sound, L.toMenu]);
    expect(afterEsc).toBe(true);
    expect([isShown(s.panelRoot), isShown(s.pauseRoot)]).toEqual([false, true]);
    expect(s.fakeDoc.activeElement?.textContent).toBe(L.sound);
    s.pauseButton(L.resume).click();
    expect(s.pause.takeAction()).toBe('resume');
  });

  it('Scenario: Límites del deslizador', () => {
    const s = setup({ music: 100, effects: 0, muted: false });
    s.menuButton(L.sound).click();

    s.arrow(s.musicSlider, 1);
    s.arrow(s.effectsSlider, -1);
    // Aunque el navegador lanzara input y change sin cambiar el valor, no se escribe.
    s.musicSlider.dispatch('input');
    s.musicSlider.dispatch('change');

    expect([s.sound.view.music, s.sound.view.effects]).toEqual(['100 %', '0 %']);
    expect(s.audio.storage.audioWrites).toBe(0);
  });

  it('Scenario: Una escritura por cambio', () => {
    const s = setup();
    s.menuButton(L.sound).click();

    for (let i = 0; i < 3; i++) s.arrow(s.musicSlider, 1);
    s.checkbox.checked = true;
    s.checkbox.dispatch('change');
    s.closeButton().click();

    expect(s.audio.storage.audioWrites).toBe(4);
    expect(JSON.parse(s.audio.storage.values.get(AUDIO_STORAGE_KEY) ?? '{}')).toEqual({
      version: 1,
      music: 65,
      effects: 80,
      muted: true,
    });
  });

  it('Scenario: Una escritura por cambio (un arrastre: muchos input y 1 change)', () => {
    const s = setup();
    s.menuButton(L.sound).click();
    for (const v of ['45', '30', '15', '0']) {
      s.musicSlider.value = v;
      s.musicSlider.dispatch('input');
    }
    const shown = s.sound.view.music;
    s.musicSlider.dispatch('change');

    expect([shown, s.audio.store.settings.music, s.audio.storage.audioWrites]).toEqual([
      '0 %',
      0,
      1,
    ]);
  });

  it('Scenario: Sin ajustes guardados (el panel muestra 50 %, 80 % y sin silencio, 0 escrituras)', () => {
    const s = setup();
    s.menuButton(L.sound).click();
    s.key('Escape');

    expect([s.sound.view.music, s.sound.view.effects, s.sound.view.muted]).toEqual([
      '50 %',
      '80 %',
      false,
    ]);
    expect(s.audio.storage.audioWrites).toBe(0);
  });

  it('Scenario: Panel centrado (sin atributo style en ningún elemento)', () => {
    const s = setup();
    s.menuButton(L.sound).click();
    const all = [s.panelRoot, ...s.panelRoot.findAll(() => true)];

    expect(all.filter((e) => e.getAttribute('style') !== null)).toEqual([]);
  });
});
