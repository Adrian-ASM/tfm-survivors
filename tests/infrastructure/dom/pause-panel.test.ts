import { describe, expect, it } from 'vitest';
import { MENU_LABELS } from '../../../src/infrastructure/dom/menuText';
import { PausePanel } from '../../../src/infrastructure/dom/PausePanel';
import { SoundPanel } from '../../../src/infrastructure/dom/SoundPanel';
import { aSoundStore } from '../../support/audio';
import { fakeDom, type FakeElement } from '../../support/fakeDom';
import { isShown } from '../../support/guide';

// Spec main-menu (0035), "Pausa con Esc": el overlay de pausa con `Sonido` entre `Reanudar` y
// `Volver al menú`, y bloqueado mientras el panel Sonido está abierto (DOM falso).
const L = MENU_LABELS;

function setup() {
  const { doc, root, fake } = fakeDom();
  const sound = new SoundPanel(doc, root, aSoundStore().store);
  const pause = new PausePanel(doc, root, sound);
  pause.setVisible(true);
  const pauseRoot = fake.byClass('pause-panel')[0] as FakeElement;
  const soundRoot = fake.byClass('sound-panel')[0] as FakeElement;
  const buttonOf = (label: string) =>
    pauseRoot.findAll((e) => e.tagName === 'button' && e.textContent === label)[0];
  return { sound, pause, pauseRoot, soundRoot, buttonOf };
}

describe('PausePanel con Sonido (spec main-menu 0035)', () => {
  it('Scenario: Pausar y reanudar con Esc (Reanudar, Sonido y Volver al menú, en ese orden)', () => {
    const { pauseRoot } = setup();

    const labels = pauseRoot.findAll((e) => e.tagName === 'button').map((b) => b.textContent);

    expect(labels).toEqual([L.resume, L.sound, L.toMenu]);
  });

  it('Scenario: Volver al menú bloqueado con el panel Sonido (los botones no tienen efecto)', () => {
    const { pause, soundRoot, buttonOf } = setup();
    buttonOf(L.sound)?.click();

    buttonOf(L.toMenu)?.click();
    buttonOf(L.resume)?.click();

    expect([pause.takeAction(), isShown(soundRoot)]).toEqual([null, true]);
  });

  it('al cerrar el panel la pausa vuelve a estar operativa', () => {
    const { sound, pause, buttonOf } = setup();
    buttonOf(L.sound)?.click();

    sound.close();
    buttonOf(L.toMenu)?.click();

    expect(pause.takeAction()).toBe('menu');
  });

  it('ocultar la pausa cierra el panel Sonido abierto desde ella', () => {
    const { sound, pause, buttonOf } = setup();
    buttonOf(L.sound)?.click();

    pause.setVisible(false);

    expect(sound.open).toBe(false);
  });

  it('sin panel Sonido (cableado de antes), la pausa sigue con Reanudar y Volver al menú', () => {
    const { doc, root, fake } = fakeDom();
    new PausePanel(doc, root);

    const labels = fake.findAll((e) => e.tagName === 'button').map((b) => b.textContent);

    expect(labels).toEqual([L.resume, L.toMenu]);
  });
});
