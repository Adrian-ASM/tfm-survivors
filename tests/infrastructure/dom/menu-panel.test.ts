import { SoundPanel } from '../../../src/infrastructure/dom/SoundPanel';
import { aSoundStore } from '../../support/audio';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '../../../src/infrastructure/dom/ConfirmDialog';
import { GuideModal } from '../../../src/infrastructure/dom/GuideModal';
import { MenuPanel } from '../../../src/infrastructure/dom/MenuPanel';
import { MENU_LABELS } from '../../../src/infrastructure/dom/menuText';
import { MenuController } from '../../../src/infrastructure/menu/MenuController';
import { fakeDom, type FakeElement } from '../../support/fakeDom';
import { GuideReader, TEST_ICONS, defaultGuide, isShown } from '../../support/guide';

// Spec main-menu y menu-guide (change 0028, design §4): el menú con «Cómo jugar» en la 2.ª
// posición, la guía bloqueando el resto de opciones y el foco de vuelta en «Cómo jugar». En Node,
// con el DOM falso y el mismo cableado del diálogo de Borrar datos que `wireProgress`.
const L = MENU_LABELS;
const MENU_ORDER = [L.play, L.guide, L.sound, L.export, L.import, L.clear];

function setup() {
  const { doc, root, fake, fakeDoc } = fakeDom();
  const controller = new MenuController();
  const guide = new GuideModal(doc, root, defaultGuide(), TEST_ICONS);
  const actions = { onExport: vi.fn(), onImport: vi.fn(), onOpenConfirm: vi.fn() };
  const audio = aSoundStore();
  const sound = new SoundPanel(doc, root, audio.store);
  const panel = new MenuPanel(doc, root, controller, actions, guide, sound);
  // Igual que wireProgress: abrir bloquea el menú y Cancelar lo desbloquea.
  const dialog = new ConfirmDialog(doc, root, {
    onConfirm: vi.fn(),
    onCancel: () => {
      if (!controller.cancel()) return;
      dialog.close();
      panel.setLocked(false);
    },
  });
  actions.onOpenConfirm.mockImplementation(() => {
    panel.setLocked(true);
    dialog.open();
  });
  panel.show();

  const menu = byClass(fake, 'menu-panel');
  const read = new GuideReader(fake);
  const menuButton = (label: string): FakeElement => {
    const b = menu.findAll((e) => e.tagName === 'button' && e.textContent === label)[0];
    if (!b) throw new Error(`sin botón ${label}`);
    return b;
  };
  const filePicker = vi.spyOn(byTag(menu, 'input'), 'click');
  const dialogRoot = byClass(fake, 'confirm-dialog');
  const dialogButton = (label: string) =>
    dialogRoot.findAll((e) => e.tagName === 'button' && e.textContent === label)[0];
  return {
    controller,
    panel,
    sound,
    audio,
    soundRoot: byClass(fake, 'sound-panel'),
    actions,
    menu,
    read,
    menuButton,
    filePicker,
    dialogRoot,
    dialogButton,
    fakeDoc,
    fake,
    key: fakeDoc.dispatchKey.bind(fakeDoc),
    listeners: () => fakeDoc.listenerCount('keydown'),
    /** Botones del menú visibles y pulsables, en orden. */
    operative: () =>
      menu
        .findAll((e) => e.tagName === 'button' && isShown(e) && !e.disabled)
        .map((b) => b.textContent),
    /** ¿Hay partida? Jugar deja una petición que la escena consumiría. */
    played: () => controller.takePlay(),
    focusedLabel: () => fakeDoc.activeElement?.textContent ?? null,
  };
}

function byClass(root: FakeElement, cls: string): FakeElement {
  const e = root.byClass(cls)[0];
  if (!e) throw new Error(`sin .${cls}`);
  return e;
}

function byTag(root: FakeElement, tag: string): FakeElement {
  const e = root.findAll((n) => n.tagName === tag)[0];
  if (!e) throw new Error(`sin <${tag}>`);
  return e;
}

/** Abre la guía con «Cómo jugar» y avanza con Siguiente hasta la página n. */
function openGuideAt(s: ReturnType<typeof setup>, n: number): void {
  s.menuButton(L.guide).click();
  for (let k = 1; k < n; k += 1) s.read.control(L.guideNext).click();
}

describe('Menú de inicio con Cómo jugar (spec main-menu)', () => {
  it('Scenario: Carga sin parámetros (6 botones en orden y la guía no visible)', () => {
    const s = setup();
    expect(s.menu.findAll((e) => e.tagName === 'button').map((b) => b.textContent)).toEqual(
      MENU_ORDER,
    );
    expect(s.operative()).toEqual(MENU_ORDER);
    expect(isShown(s.menu)).toBe(true);
    expect(s.read.visible).toBe(false);
  });

  it('Scenario: Teclas sin efecto en el menú (guía cerrada: sin escucha de teclado)', () => {
    const s = setup();
    const keys = ['Escape', 'r', '1', '2', '3', 'ArrowLeft', 'ArrowRight', 'w', 'd'];
    const results = keys.map((k) => s.key(k));
    expect(s.listeners()).toBe(0);
    expect(results.some((r) => r.defaultPrevented)).toBe(false);
    expect([isShown(s.menu), s.read.visible, s.played()]).toEqual([true, false, false]);
  });

  it('Scenario: Opciones bloqueadas con el diálogo abierto (la guía no es visible)', () => {
    const s = setup();
    s.menuButton(L.clear).click();
    s.menuButton(L.play).click();
    s.menuButton(L.guide).click();
    s.menuButton(L.sound).click();
    s.menuButton(L.export).click();
    expect(s.played()).toBe(false);
    expect(s.actions.onExport).not.toHaveBeenCalled();
    expect(s.read.visible).toBe(false);
    expect(isShown(s.soundRoot)).toBe(false);
    expect(isShown(s.dialogRoot)).toBe(true);
  });

  it('Scenario: Teclas con el diálogo abierto (la guía no es visible)', () => {
    const s = setup();
    s.menuButton(L.clear).click();
    for (const k of ['Escape', 'r', 'ArrowLeft', 'ArrowRight']) s.key(k);
    expect(isShown(s.dialogRoot)).toBe(true);
    expect(s.read.visible).toBe(false);
    expect(s.played()).toBe(false);
    expect(s.controller.state).toBe('confirming');
  });
});

describe('Abrir y cerrar la guía desde el menú (spec menu-guide)', () => {
  it('Scenario: Doble pulsación de Cómo jugar', () => {
    const s = setup();
    s.menuButton(L.guide).click();
    s.menuButton(L.guide).click();
    expect(s.fake.byClass('guide-modal').filter((g) => isShown(g))).toHaveLength(1);
    expect(s.read.indicator).toBe('1 de 7');
    expect(s.listeners()).toBe(1);
  });

  it('Scenario: Abrir no toca el progreso (0 llamadas a las acciones de progreso)', () => {
    const s = setup();
    openGuideAt(s, 7);
    for (let k = 0; k < 6; k += 1) s.read.control(L.guidePrev).click();
    expect(s.read.indicator).toBe('1 de 7');
    s.read.control(L.guideClose).click();
    expect(s.actions.onExport).not.toHaveBeenCalled();
    expect(s.actions.onImport).not.toHaveBeenCalled();
    expect(s.actions.onOpenConfirm).not.toHaveBeenCalled();
    expect(s.filePicker).not.toHaveBeenCalled();
    expect(s.played()).toBe(false);
  });

  it('Scenario: Cerrar con el botón (foco en Cómo jugar y 6 opciones operativas)', () => {
    const s = setup();
    openGuideAt(s, 4);
    s.read.control(L.guideClose).click();
    expect(s.read.visible).toBe(false);
    expect(isShown(s.menu)).toBe(true);
    expect(s.operative()).toEqual(MENU_ORDER);
    expect(s.focusedLabel()).toBe(L.guide);
    expect(s.played()).toBe(false);
  });

  it('Scenario: Cerrar con Esc (foco en Cómo jugar y 6 opciones operativas)', () => {
    const s = setup();
    openGuideAt(s, 7);
    s.key('Escape');
    expect(s.read.visible).toBe(false);
    expect(isShown(s.menu)).toBe(true);
    expect(s.operative()).toEqual(MENU_ORDER);
    expect(s.focusedLabel()).toBe(L.guide);
    expect(s.played()).toBe(false);
  });

  it('Scenario: Esc mantenido (sin partida, sin pausa y sin el diálogo de Borrar datos)', () => {
    const s = setup();
    openGuideAt(s, 2);
    s.key('Escape');
    for (let k = 0; k < 20; k += 1) s.key('Escape', { repeat: true });
    expect(s.read.visible).toBe(false);
    expect(isShown(s.menu)).toBe(true);
    expect(isShown(s.dialogRoot)).toBe(false);
    expect(isShown(s.soundRoot)).toBe(false);
    expect(s.controller.state).toBe('idle');
    expect(s.played()).toBe(false);
  });

  it('Scenario: Jugar y pausa tras cerrar la guía (Jugar con 1 pulsación y 0 escuchas)', () => {
    const s = setup();
    openGuideAt(s, 1);
    s.key('Escape');
    s.menuButton(L.play).click();
    expect(s.played()).toBe(true);
    expect(isShown(s.menu)).toBe(false);
    // Sin escucha de la guía: el Esc siguiente llega solo a Phaser (la pausa, E2E existente).
    expect(s.listeners()).toBe(0);
  });
});

describe('Opciones del menú bloqueadas con la guía abierta', () => {
  it('Scenario: Pulsaciones del menú con la guía abierta', () => {
    const s = setup();
    openGuideAt(s, 2);
    for (const label of [L.play, L.sound, L.export, L.import, L.clear]) {
      s.menuButton(label).click();
    }
    expect(s.played()).toBe(false);
    expect(isShown(s.soundRoot)).toBe(false);
    expect(s.actions.onExport).not.toHaveBeenCalled();
    expect(s.filePicker).not.toHaveBeenCalled();
    expect(isShown(s.dialogRoot)).toBe(false);
    expect(s.read.visible).toBe(true);
    expect(s.read.indicator).toBe('2 de 7');
  });

  it('con la guía abierta el controlador rechaza las opciones (aunque llegue el clic)', () => {
    const s = setup();
    openGuideAt(s, 2);
    for (const label of MENU_ORDER) {
      const b = s.menuButton(label);
      b.disabled = false;
      b.click();
    }
    expect(s.played()).toBe(false);
    expect(s.actions.onExport).not.toHaveBeenCalled();
    expect(s.actions.onOpenConfirm).not.toHaveBeenCalled();
    expect(s.filePicker).not.toHaveBeenCalled();
    expect(s.read.indicator).toBe('2 de 7');
    expect(s.listeners()).toBe(1);
  });

  it('Scenario: Cómo jugar con el diálogo de Borrar datos abierto', () => {
    const s = setup();
    s.menuButton(L.clear).click();
    s.menuButton(L.guide).click();
    expect(s.read.visible).toBe(false);
    expect(isShown(s.dialogRoot)).toBe(true);
    expect([L.confirm, L.cancel].map((l) => isShown(s.dialogButton(l) ?? null))).toEqual([
      true,
      true,
    ]);
    s.dialogButton(L.cancel)?.click();
    s.menuButton(L.guide).click();
    expect(s.read.visible).toBe(true);
    expect(s.read.indicator).toBe('1 de 7');
  });

  it('Scenario: Jugar en el mismo frame que se abre la guía', () => {
    const s = setup();
    s.menuButton(L.guide).click();
    s.menuButton(L.play).click();
    expect(s.read.visible).toBe(true);
    expect(s.played()).toBe(false);
  });

  it('Scenario: Menú operativo tras cerrar', () => {
    const s = setup();
    openGuideAt(s, 3);
    s.read.control(L.guideClose).click();
    s.menuButton(L.export).click();
    expect(s.actions.onExport).toHaveBeenCalledTimes(1);
    expect(s.played()).toBe(false);
  });
});

describe('La guía nunca aparece sola', () => {
  it('Scenario: Carga en modo E2E (ningún camino abre el modal salvo el clic)', () => {
    const s = setup();
    s.panel.hide();
    s.panel.show();
    expect(s.read.visible).toBe(false);
    expect(s.listeners()).toBe(0);
  });

  it('Scenario: Guía cerrada antes de jugar', () => {
    const s = setup();
    openGuideAt(s, 6);
    s.read.control(L.guideClose).click();
    s.menuButton(L.play).click();
    expect(s.read.visible).toBe(false);
    expect(s.played()).toBe(true);
    // Esc y Volver al menú: la escena para la partida y vuelve a mostrar el menú.
    s.panel.show();
    expect(isShown(s.menu)).toBe(true);
    expect(s.read.visible).toBe(false);
  });

  it('Scenario: Volver al menú en modo E2E (show() cierra la guía; menú operativo)', () => {
    const s = setup();
    openGuideAt(s, 4);
    s.panel.show();
    expect(s.read.visible).toBe(false);
    expect(s.listeners()).toBe(0);
    expect(s.controller.state).toBe('idle');
    expect(s.operative()).toEqual(MENU_ORDER);
  });
});

describe('Panel Sonido desde el menú (spec audio y menu-guide 0035)', () => {
  it('Scenario: Cómo jugar con el panel Sonido abierto', () => {
    const s = setup();
    s.menuButton(L.sound).click();
    s.menuButton(L.guide).click();
    expect(s.read.visible).toBe(false);
    expect(isShown(s.soundRoot)).toBe(true);

    s.key('Escape');
    s.menuButton(L.guide).click();

    expect(s.read.visible).toBe(true);
    expect(s.read.indicator).toBe('1 de 7');
  });

  it('Scenario: Volver al menú en modo E2E (show() cierra también el panel Sonido)', () => {
    const s = setup();
    s.menuButton(L.sound).click();
    s.panel.show();
    expect([isShown(s.soundRoot), s.listeners(), s.controller.state]).toEqual([false, 0, 'idle']);
    expect(s.operative()).toEqual(MENU_ORDER);
  });
});
