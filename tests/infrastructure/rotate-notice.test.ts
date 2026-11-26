import { describe, expect, it } from 'vitest';
import { ROTATE_TEXT, RotateNotice, isPortrait } from '../../src/infrastructure/dom/RotateNotice';
import { fakeDom, type FakeElement } from '../support/fakeDom';

// Spec touch-controls (0033), "Aviso de orientación vertical" (sin navegador: DOM falso).
describe('RotateNotice (0033)', () => {
  it('oculto al crearse, con role alert y el texto «Gira el móvil»', () => {
    const { doc, root, fake } = fakeDom();
    const notice = new RotateNotice(doc, root);
    const el = fake.children[0] as FakeElement;

    expect([el.className, el.getAttribute('role'), el.textContent]).toEqual([
      'rotate-notice',
      'alert',
      'Gira el móvil',
    ]);
    expect(ROTATE_TEXT).toBe('Gira el móvil');
    expect([el.hidden, notice.visible]).toEqual([true, false]);
  });

  it('Scenario: Girar en mitad de la partida (vertical: visible; horizontal: oculto)', () => {
    const { doc, root, fake } = fakeDom();
    const notice = new RotateNotice(doc, root);
    const el = fake.children[0] as FakeElement;

    notice.setVisible(isPortrait({ width: 390, height: 844 }));
    const portrait = el.hidden;
    notice.setVisible(isPortrait({ width: 844, height: 390 }));

    expect([portrait, el.hidden]).toEqual([false, true]);
  });

  it('Scenario: Ventana cuadrada (500 × 500: sin aviso)', () => {
    expect(isPortrait({ width: 500, height: 500 })).toBe(false);
    expect(isPortrait({ width: 500, height: 501 })).toBe(true);
  });

  it('Scenario: Aviso en el menú (no toca los demás nodos: la guía sigue abierta)', () => {
    const { doc, root, fake } = fakeDom();
    const guide = doc.createElement('section') as unknown as FakeElement;
    guide.textContent = '3 de 7';
    fake.append(guide);
    const notice = new RotateNotice(doc, root);

    notice.setVisible(true);
    notice.setVisible(false);

    expect([guide.hidden, guide.textContent]).toEqual([false, '3 de 7']);
    expect(fake.children).toHaveLength(2);
  });
});
