import { describe, expect, it } from 'vitest';
import type { RunSnapshot } from '../../../src/domain/run/RunSnapshot';
import { BuildPanel } from '../../../src/infrastructure/dom/BuildPanel';
import { MENU_LABELS } from '../../../src/infrastructure/dom/menuText';
import { fakeDom, type FakeElement } from '../../support/fakeDom';
import { aSiteConfig, startWithSites, untilBuilding, withStock } from '../../support/sites';

// Spec build-sites 0026, "Panel de obra" (sin navegador: DOM falso; el panel solo usa
// createElement, clases, atributos y textContent).

function inSite(wood: number, stone: number): RunSnapshot {
  const run = startWithSites(aSiteConfig(), withStock(wood, stone));
  untilBuilding(run, 1);
  return run.snapshot();
}

function panel() {
  const { doc, root, fake } = fakeDom();
  const build = new BuildPanel(doc, root);
  const paint = (s: RunSnapshot) => {
    build.sync(s);
    build.setVisible(s.status === 'building');
  };
  const section = () => fake.children[0] as FakeElement;
  const rows = () => section().findAll((e) => e.dataset.building !== undefined);
  return { build, paint, section, rows };
}

const text = (el: FakeElement | undefined, cls: string) => el?.byClass(cls)[0]?.textContent;

describe('BuildPanel', () => {
  // 0027 (núcleo): la oferta lleva siempre la casa y la torre; la fila no asequible desactivada y
  // con «faltan N» llega con el grupo 3 de tasks.md.
  it('Panel con la torre no asequible (madera 30, piedra 14: casa, torre y Salir)', () => {
    const { paint, section, rows, build } = panel();
    paint(inSite(30, 14));

    expect(section().hidden).toBe(false);
    expect(section().getAttribute('role')).toBe('dialog');
    expect(text(section(), 'build-panel__stock')).toBe('Madera: 30 · Piedra: 14');
    expect(rows().map((r) => r.dataset.building)).toEqual(['house', 'tower']);
    expect(text(rows()[0], 'build-panel__name')).toBe(MENU_LABELS.buildHouse);
    expect(text(rows()[0], 'build-panel__cost')).toBe('15 Madera · 0 Piedra');
    expect(text(section(), 'build-panel__leave')).toBe(MENU_LABELS.buildLeave);
    expect(build.view).toEqual({
      visible: true,
      siteId: 0,
      wood: 30,
      stone: 14,
      options: [
        { kind: 'house', wood: 15, stone: 0 },
        { kind: 'tower', wood: 30, stone: 15 },
      ],
    });
  });

  it('Scenario: Panel con dos opciones (madera 30, piedra 15: la casa y después la torre)', () => {
    const { paint, rows } = panel();
    paint(inSite(30, 15));

    expect(rows().map((r) => r.dataset.building)).toEqual(['house', 'tower']);
    expect(rows().map((r) => text(r, 'build-panel__cost'))).toEqual([
      '15 Madera · 0 Piedra',
      '30 Madera · 15 Piedra',
    ]);
  });

  it('clic en una fila deja la acción de construir; Salir, la de salir; se consumen', () => {
    const { paint, rows, section, build } = panel();
    paint(inSite(30, 15));

    rows()[0]?.click();
    expect(build.takeAction()).toEqual({ kind: 'build', building: 'house' });
    expect(build.takeAction()).toBeNull();
    section().byClass('build-panel__leave')[0]?.click();
    expect(build.takeAction()).toEqual({ kind: 'leave' });
  });

  it('Scenario: Sin panel fuera de la obra (oculto y sin opciones)', () => {
    const { paint, section, build } = panel();
    paint(startWithSites(aSiteConfig(), withStock(0)).snapshot());
    expect(section().hidden).toBe(true);
    expect(build.view).toMatchObject({ visible: false, siteId: null, options: [] });
  });
});
