import { describe, expect, it } from 'vitest';
import { MenuController } from '../../src/infrastructure/menu/MenuController';
import { MENU_LABELS, MENU_MESSAGES } from '../../src/infrastructure/dom/menuText';

const confirming = (): MenuController => {
  const menu = new MenuController();
  menu.openConfirm();
  return menu;
};

describe('MenuController (spec main-menu)', () => {
  it('empieza en idle con todas las opciones operativas', () => {
    const menu = new MenuController();

    expect([menu.state, menu.requestExport(), menu.requestImport()]).toEqual(['idle', true, true]);
  });

  it('Scenario: Doble clic en Jugar (requestPlay da true y después false; takePlay una vez)', () => {
    const menu = new MenuController();

    const clicks = [menu.requestPlay(), menu.requestPlay()];
    const takes = [menu.takePlay(), menu.takePlay()];

    expect([clicks, takes, menu.state]).toEqual([[true, false], [true, false], 'leaving']);
  });

  it('takePlay sin pulsar Jugar da false', () => {
    expect(new MenuController().takePlay()).toBe(false);
  });

  it('tras pulsar Jugar, el resto de opciones no tiene efecto', () => {
    const menu = new MenuController();
    menu.requestPlay();

    expect([menu.requestExport(), menu.requestImport(), menu.openConfirm()]).toEqual([
      false,
      false,
      false,
    ]);
  });

  it('Scenario: Opciones bloqueadas con el diálogo abierto (todas false, también la guía)', () => {
    const menu = confirming();

    const actions = [
      menu.requestPlay(),
      menu.openGuide(),
      menu.requestExport(),
      menu.requestImport(),
      menu.openConfirm(),
    ];

    expect([actions, menu.takePlay(), menu.state]).toEqual([
      [false, false, false, false, false],
      false,
      'confirming',
    ]);
  });

  it('Scenario: Confirmar dos veces (true y después false; el menú vuelve a idle)', () => {
    const menu = confirming();

    expect([menu.confirm(), menu.confirm(), menu.state]).toEqual([true, false, 'idle']);
  });

  it('Scenario: Cancelar no cambia nada (vuelve a idle sin pedir borrado)', () => {
    const menu = confirming();

    const cancelled = menu.cancel();

    expect([cancelled, menu.confirm(), menu.state]).toEqual([true, false, 'idle']);
  });

  it('confirm y cancel fuera del diálogo no hacen nada', () => {
    const menu = new MenuController();

    expect([menu.confirm(), menu.cancel(), menu.state]).toEqual([false, false, 'idle']);
  });

  it('Scenario: Jugar y Esc tras usar los botones del menú (Jugar sigue con 1 pulsación)', () => {
    const menu = new MenuController();
    menu.requestExport();
    menu.requestImport();
    menu.openConfirm();
    menu.cancel();

    expect([menu.requestPlay(), menu.takePlay()]).toEqual([true, true]);
  });

  it('show() desde leaving vuelve a idle y descarta un Jugar sin consumir', () => {
    const menu = new MenuController();
    menu.requestPlay();

    menu.show();

    expect([menu.state, menu.takePlay(), menu.requestPlay()]).toEqual(['idle', false, true]);
  });
});

describe('MenuController con la guía (spec menu-guide, 0028)', () => {
  const guiding = (): MenuController => {
    const menu = new MenuController();
    menu.openGuide();
    return menu;
  };

  it('openGuide solo en idle: abre una vez y una segunda pulsación no tiene efecto', () => {
    const menu = new MenuController();

    expect([menu.openGuide(), menu.openGuide(), menu.state]).toEqual([true, false, 'guide']);
  });

  it('Scenario: Pulsaciones del menú con la guía abierta (todas dan false)', () => {
    const menu = guiding();

    const actions = [
      menu.requestPlay(),
      menu.requestExport(),
      menu.requestImport(),
      menu.openConfirm(),
      menu.confirm(),
      menu.cancel(),
    ];

    expect([actions, menu.takePlay(), menu.state]).toEqual([
      [false, false, false, false, false, false],
      false,
      'guide',
    ]);
  });

  it('closeGuide solo con la guía abierta y deja el menú operativo', () => {
    const menu = guiding();

    expect([menu.closeGuide(), menu.closeGuide(), menu.state]).toEqual([true, false, 'idle']);
    expect([menu.requestExport(), menu.requestPlay(), menu.takePlay()]).toEqual([true, true, true]);
  });

  it('openGuide tras Jugar no tiene efecto', () => {
    const menu = new MenuController();
    menu.requestPlay();

    expect([menu.openGuide(), menu.state]).toEqual([false, 'leaving']);
  });

  it('show() con la guía abierta vuelve a idle', () => {
    const menu = guiding();

    menu.show();

    expect([menu.state, menu.closeGuide(), menu.openGuide()]).toEqual(['idle', false, true]);
  });
});

describe('Título del juego en el menú (spec main-menu, change 0012)', () => {
  it('Scenario: Título en el menú y en el documento (parte del menú: Greentide Vanguard)', () => {
    expect(MENU_LABELS.title).toBe('Greentide Vanguard');
    const texts = [...Object.values(MENU_LABELS), ...Object.values(MENU_MESSAGES)];
    expect(texts.some((t) => t.includes('Sprint Survivors'))).toBe(false);
  });
});

describe('Panel Sonido en el menú (spec audio y main-menu 0035)', () => {
  const sounding = (): MenuController => {
    const menu = new MenuController();
    menu.openSound();
    return menu;
  };

  it('Scenario: Botones de debajo bloqueados (el controlador rechaza las opciones del menú)', () => {
    const menu = sounding();

    expect([
      menu.requestPlay(),
      menu.openGuide(),
      menu.openConfirm(),
      menu.requestExport(),
      menu.requestImport(),
      menu.openSound(),
      menu.state,
    ]).toEqual([false, false, false, false, false, false, 'sound']);
  });

  it('Scenario: Opciones bloqueadas con el diálogo abierto (Sonido no abre el panel)', () => {
    const menu = new MenuController();
    menu.openConfirm();

    expect([menu.openSound(), menu.state]).toEqual([false, 'confirming']);
  });

  it('Scenario: Pulsaciones del menú con la guía abierta (Sonido no abre el panel)', () => {
    const menu = new MenuController();
    menu.openGuide();

    expect([menu.openSound(), menu.state]).toEqual([false, 'guide']);
  });

  it('closeSound solo con el panel abierto y deja el menú operativo', () => {
    const menu = sounding();

    expect([menu.closeSound(), menu.closeSound(), menu.state]).toEqual([true, false, 'idle']);
    expect([menu.requestPlay(), menu.takePlay()]).toEqual([true, true]);
  });

  it('show() con el panel abierto vuelve a idle', () => {
    const menu = sounding();

    menu.show();

    expect([menu.state, menu.closeSound()]).toEqual(['idle', false]);
  });
});
