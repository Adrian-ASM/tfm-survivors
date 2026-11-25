import { describe, expect, it, vi } from 'vitest';
import { GuideModal } from '../../../src/infrastructure/dom/GuideModal';
import { GUIDE_ICON_ALT, MENU_LABELS } from '../../../src/infrastructure/dom/menuText';
import { fakeDom } from '../../support/fakeDom';
import { GuideReader, TEST_ICONS, defaultGuide } from '../../support/guide';

// Spec menu-guide (change 0028): paginación, topes, teclado, foco y escucha de teclado del modal
// (design §3 y §5), en Node con el DOM falso.
const { guidePrev: PREV, guideNext: NEXT, guideClose: CLOSE } = MENU_LABELS;
const GUIDE = defaultGuide();

function setup() {
  const { doc, root, fake, fakeDoc } = fakeDom();
  const modal = new GuideModal(doc, root, GUIDE, TEST_ICONS);
  const read = new GuideReader(fake);
  const onClosed = vi.fn();
  const listeners = () => fakeDoc.listenerCount('keydown');
  const key = fakeDoc.dispatchKey.bind(fakeDoc);
  /** Abre y avanza con Siguiente hasta la página n. */
  const openAt = (n: number) => {
    modal.open(onClosed);
    for (let k = 1; k < n; k += 1) read.control(NEXT).click();
  };
  return { modal, read, onClosed, listeners, key, openAt, fakeDoc };
}

const page = (n: number) => {
  const p = GUIDE.pages[n - 1];
  if (!p) throw new Error(`sin página ${String(n)}`);
  return p;
};

describe('Abrir la guía', () => {
  it('Scenario: Primera apertura (página 1, sin Anterior, foco dentro de la guía)', () => {
    const { modal, read, onClosed } = setup();
    expect(read.visible).toBe(false);
    modal.open(onClosed);
    expect(read.visible).toBe(true);
    expect(read.title).toBe(page(1).title);
    expect(read.paragraphs).toEqual(page(1).paragraphs);
    expect(read.indicator).toBe('1 de 7');
    expect(read.controls).toEqual([NEXT, CLOSE]);
    expect(read.focused).toBe(true);
    expect(read.root.getAttribute('tabindex')).toBe('-1');
    expect(read.root.getAttribute('role')).toBe('dialog');
  });

  it('Scenario: Reabrir empieza en la página 1', () => {
    const { modal, read, openAt, onClosed } = setup();
    openAt(5);
    expect(read.indicator).toBe('5 de 7');
    read.control(CLOSE).click();
    modal.open(onClosed);
    expect(read.indicator).toBe('1 de 7');
    expect(read.title).toBe(page(1).title);
  });

  it('abrir con el modal ya abierto no hace nada (ni cambia de página ni añade escuchas)', () => {
    const { modal, read, openAt, listeners, onClosed } = setup();
    openAt(3);
    modal.open(onClosed);
    expect(read.indicator).toBe('3 de 7');
    expect(listeners()).toBe(1);
  });
});

describe('Páginas y topes de la guía', () => {
  it('Scenario: Recorrido hacia delante', () => {
    const { read, openAt } = setup();
    openAt(1);
    for (let k = 1; k <= 6; k += 1) {
      read.control(NEXT).click();
      expect(read.indicator).toBe(`${String(k + 1)} de 7`);
      expect(read.title).toBe(page(k + 1).title);
      expect(read.paragraphs).toEqual(page(k + 1).paragraphs);
    }
    expect(read.controls).toEqual([PREV, CLOSE]);
  });

  it('Scenario: Recorrido hacia atrás', () => {
    const { read, openAt } = setup();
    openAt(7);
    for (let k = 0; k < 6; k += 1) read.control(PREV).click();
    expect(read.indicator).toBe('1 de 7');
    expect(read.title).toBe(page(1).title);
    expect(read.controls).not.toContain(PREV);
  });

  it('Scenario: Páginas intermedias con ambos controles', () => {
    const { read, openAt } = setup();
    openAt(1);
    for (let n = 2; n <= 6; n += 1) {
      read.control(NEXT).click();
      expect(read.controls).toEqual([PREV, NEXT, CLOSE]);
    }
  });

  it('Scenario: Foco tras llegar al tope', () => {
    const { read, openAt, key, onClosed } = setup();
    openAt(6);
    read.control(NEXT).click();
    expect(read.indicator).toBe('7 de 7');
    expect(read.controls).not.toContain(NEXT);
    expect(read.focused).toBe(true);
    key('Escape');
    expect(read.visible).toBe(false);
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('el foco sigue en la guía tras Anterior en la página 2 (el botón deja de verse)', () => {
    const { read, openAt } = setup();
    openAt(2);
    read.control(PREV).click();
    expect(read.indicator).toBe('1 de 7');
    expect(read.focused).toBe(true);
  });

  it('Scenario: Una sola página visible', () => {
    const { read, openAt } = setup();
    openAt(4);
    expect(read.titles.map((t) => t.textContent)).toEqual([page(4).title]);
  });

  it('cada cambio de página vuelve el texto al principio (scrollTop 0)', () => {
    const { read, openAt } = setup();
    openAt(2);
    const body = read.root.byClass('guide-modal__body')[0];
    if (!body) throw new Error('sin cuerpo');
    body.scrollTop = 120;
    read.control(NEXT).click();
    expect(body.scrollTop).toBe(0);
  });
});

describe('Cerrar la guía', () => {
  it('Cerrar: oculta, llama a onClosed una vez y suelta el foco interior', () => {
    const { modal, read, openAt, onClosed, listeners } = setup();
    openAt(4);
    read.control(CLOSE).click();
    expect(read.visible).toBe(false);
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(listeners()).toBe(0);
    expect(read.focused).toBe(false);
    modal.close();
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('Scenario: Esc mantenido', () => {
    const { read, openAt, key, onClosed, listeners } = setup();
    openAt(2);
    expect(key('Escape').defaultPrevented).toBe(true);
    const repeats = Array.from({ length: 20 }, () => key('Escape', { repeat: true }));
    expect(read.visible).toBe(false);
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(listeners()).toBe(0);
    // Las repeticiones ya no llegan a la guía (solo a Phaser, que en el menú no hace nada).
    expect(repeats.some((r) => r.defaultPrevented)).toBe(false);
  });
});

describe('Teclado en la guía', () => {
  it('Scenario: Flechas hacia delante hasta el tope', () => {
    const { read, openAt, key } = setup();
    openAt(1);
    for (let k = 0; k < 6; k += 1) key('ArrowRight');
    expect(read.indicator).toBe('7 de 7');
    key('ArrowRight');
    expect(read.indicator).toBe('7 de 7');
    expect(read.visible).toBe(true);
  });

  it('Scenario: Flecha izquierda en la primera página', () => {
    const { read, openAt, key } = setup();
    openAt(1);
    for (let k = 0; k < 3; k += 1) key('ArrowLeft');
    expect(read.indicator).toBe('1 de 7');
    expect(read.visible).toBe(true);
  });

  it('Scenario: Ida y vuelta con flechas', () => {
    const { read, openAt, key } = setup();
    openAt(1);
    for (let k = 0; k < 4; k += 1) key('ArrowRight');
    for (let k = 0; k < 2; k += 1) key('ArrowLeft');
    expect(read.indicator).toBe('3 de 7');
  });

  it('Scenario: Flecha mantenida', () => {
    const { read, openAt, key } = setup();
    openAt(2);
    key('ArrowRight');
    const repeats = Array.from({ length: 30 }, () => key('ArrowRight', { repeat: true }));
    expect(read.indicator).toBe('3 de 7');
    // Las repeticiones tampoco desplazan la página del navegador.
    expect(repeats.every((r) => r.defaultPrevented)).toBe(true);
  });

  it('Scenario: Teclas con modificador', () => {
    const { read, openAt, key } = setup();
    openAt(3);
    const results = [
      key('ArrowLeft', { altKey: true }),
      key('ArrowRight', { ctrlKey: true }),
      key('ArrowRight', { metaKey: true }),
      key('Escape', { ctrlKey: true }),
    ];
    expect(read.visible).toBe(true);
    expect(read.indicator).toBe('3 de 7');
    // Sin preventDefault: Alt + ← sigue siendo «atrás» en el navegador.
    expect(results.map((r) => r.defaultPrevented)).toEqual([false, false, false, false]);
  });

  it('Scenario: Teclas de juego con la guía abierta', () => {
    const { read, openAt, key, onClosed } = setup();
    openAt(3);
    const results = ['r', 'R', '1', '2', '3', 'w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown'].map((k) =>
      key(k),
    );
    expect(read.visible).toBe(true);
    expect(read.indicator).toBe('3 de 7');
    expect(onClosed).not.toHaveBeenCalled();
    expect(results.some((r) => r.defaultPrevented)).toBe(false);
  });

  it('Scenario: Flechas y Esc en el mismo frame', () => {
    const { modal, read, openAt, key, onClosed } = setup();
    openAt(3);
    key('ArrowRight');
    key('Escape');
    expect(read.visible).toBe(false);
    expect(onClosed).toHaveBeenCalledTimes(1);
    modal.open(onClosed);
    expect(read.indicator).toBe('1 de 7');
  });

  it('Esc y flechas llaman a preventDefault (no desplazan la página)', () => {
    const { openAt, key } = setup();
    openAt(3);
    expect(key('ArrowRight').defaultPrevented).toBe(true);
    expect(key('ArrowLeft').defaultPrevented).toBe(true);
    expect(key('Escape').defaultPrevented).toBe(true);
  });
});

describe('Escucha de teclado solo con la guía abierta', () => {
  it('Scenario: Sin escuchador antes de abrir', () => {
    const { listeners, modal } = setup();
    expect(listeners()).toBe(0);
    expect(modal.view.listening).toBe(false);
  });

  it('Scenario: Un escuchador con la guía abierta', () => {
    const { listeners, openAt, modal } = setup();
    openAt(1);
    expect(listeners()).toBe(1);
    expect(modal.view).toEqual({ open: true, page: 1, total: 7, listening: true });
  });

  it('Scenario: Diez aperturas y cierres', () => {
    const { modal, read, listeners, key, onClosed } = setup();
    for (let cycle = 1; cycle <= 10; cycle += 1) {
      modal.open(onClosed);
      expect(listeners()).toBe(1);
      if (cycle % 2 === 1) read.control(CLOSE).click();
      else key('Escape');
      expect(listeners()).toBe(0);
    }
    expect(onClosed).toHaveBeenCalledTimes(10);
    const after = [key('Escape'), key('ArrowRight'), key('ArrowLeft')];
    expect(read.visible).toBe(false);
    expect(after.some((r) => r.defaultPrevented)).toBe(false);
    expect(onClosed).toHaveBeenCalledTimes(10);
  });
});

describe('Iconos de recurso en la guía', () => {
  it('Scenario: Iconos de las páginas de recursos y de obra (en el modal)', () => {
    const { read, openAt } = setup();
    openAt(3);
    expect(read.icons.map((i) => [i.getAttribute('src'), i.getAttribute('alt')])).toEqual([
      [TEST_ICONS.xp, GUIDE_ICON_ALT.xp],
      [TEST_ICONS.gold, GUIDE_ICON_ALT.gold],
      [TEST_ICONS.wood, GUIDE_ICON_ALT.wood],
      [TEST_ICONS.meat, GUIDE_ICON_ALT.meat],
      [TEST_ICONS.stone, GUIDE_ICON_ALT.stone],
    ]);
    expect(read.icons.every((i) => i.className.split(' ').includes('resource-icon'))).toBe(true);
    read.control(NEXT).click();
    read.control(NEXT).click();
    const srcs = read.icons.map((i) => i.getAttribute('src'));
    expect(srcs).toEqual(expect.arrayContaining([TEST_ICONS.wood, TEST_ICONS.stone]));
  });

  it('Scenario: Página sin recursos', () => {
    const { read, openAt } = setup();
    openAt(1);
    expect(read.icons).toHaveLength(0);
  });

  it('Scenario: Hoja de icono que no carga (el render no depende de la carga)', () => {
    const { read, openAt } = setup();
    openAt(3);
    // Ninguna escucha de carga o error en los iconos: título, texto, indicador y controles se
    // pintan en el mismo render, cargue o no la hoja de la madera.
    expect(read.icons.map((i) => i.listenerCount('error') + i.listenerCount('load'))).toEqual([
      0, 0, 0, 0, 0,
    ]);
    expect(read.title).toBe(page(3).title);
    expect(read.paragraphs).toEqual(page(3).paragraphs);
    expect(read.indicator).toBe('3 de 7');
    expect(read.controls).toEqual([PREV, NEXT, CLOSE]);
  });
});
