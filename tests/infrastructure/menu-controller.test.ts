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

  it('Scenario: Opciones bloqueadas con el diálogo abierto (todas dan false)', () => {
    const menu = confirming();

    const actions = [
      menu.requestPlay(),
      menu.requestExport(),
      menu.requestImport(),
      menu.openConfirm(),
    ];

    expect([actions, menu.takePlay(), menu.state]).toEqual([
      [false, false, false, false],
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

describe('Título del juego en el menú (spec main-menu, change 0012)', () => {
  it('Scenario: Título en el menú y en el documento (parte del menú: Greentide Vanguard)', () => {
    expect(MENU_LABELS.title).toBe('Greentide Vanguard');
    const texts = [...Object.values(MENU_LABELS), ...Object.values(MENU_MESSAGES)];
    expect(texts.some((t) => t.includes('Sprint Survivors'))).toBe(false);
  });
});
