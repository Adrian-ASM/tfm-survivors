import { describe, expect, it } from 'vitest';
import { declOf, parseCss } from '../../support/css';

// Spec audio, main-menu, world-camera y mobile-display (0035): el panel Sonido se centra como los
// demás paneles DOM (celda única de la rejilla de #game, sin posición propia) y, en móvil, va a
// escala 1, desplazable y con controles de ≥ 44 px. Guardarraíl de CSS sin navegador; el centrado y
// el arrastre reales se comprueban a mano en verify (regla e2e-lite).
const rules = parseCss();
const decl = (selector: string, prop: string) => declOf(rules, selector, prop);
const hasRule = (selector: string) => rules.some((r) => r.selectors.includes(selector));

describe('styles.css · panel Sonido (0035)', () => {
  it('Scenario: Panel centrado (hijo de la rejilla de #game, sin posición fija ni absoluta)', () => {
    expect(decl('#game', 'place-items')).toBe('center');
    expect(decl('#game > *', 'grid-area')).toBe('1 / 1');
    expect(decl('.sound-panel', 'position')).toBe('relative');
    expect(decl('.sound-panel', 'width')).toBe('min(24em, calc(100vw - 2em))');
    expect(decl('.sound-panel', 'max-height')).toBe('calc(100vh - 2em)');
  });

  it('Scenario: Panel Sonido abierto al redimensionar (centrado por CSS: no depende del tamaño)', () => {
    // Sin medidas en px fijos ni reglas por tamaño: la rejilla lo recoloca en cada cambio.
    const own = rules.filter((r) => r.selectors.some((s) => s.startsWith('.sound-panel')));
    const positions = own.flatMap((r) =>
      ['left', 'top', 'right', 'bottom'].filter((p) => r.decls.has(p)),
    );
    expect(positions).toEqual([]);
  });

  it('Scenario: Redimensionado con el panel Sonido abierto (encima del menú y de la pausa)', () => {
    expect(Number(decl('.sound-panel', 'z-index'))).toBeGreaterThan(
      Number(decl('.pause-panel', 'z-index')),
    );
    expect(decl('.sound-panel[hidden]', 'display')).toBe('none');
  });

  it('Scenario: Paneles en un móvil horizontal (panel Sonido desplazable y a escala 1)', () => {
    expect(decl('.is-mobile .sound-panel', 'overflow-y')).toBe('auto');
    expect(decl('.is-mobile .sound-panel', 'max-width')).toBe(
      'calc(100vw - 2 * var(--touch-bar-reserve))',
    );
  });

  it('Scenario: Deslizador táctil del panel Sonido (deslizadores, casilla y Cerrar ≥ 44 px)', () => {
    for (const sel of ['.is-mobile .sound-panel input', '.is-mobile .sound-panel button']) {
      expect(hasRule(sel)).toBe(true);
      expect([decl(sel, 'min-width'), decl(sel, 'min-height')]).toEqual(['44px', '44px']);
      expect(decl(sel, 'touch-action')).toBe('manipulation');
    }
  });
});
