import { describe, expect, it } from 'vitest';
import type { RunSnapshot } from '../../../src/domain/run/RunSnapshot';
import { BuildPanel } from '../../../src/infrastructure/dom/BuildPanel';
import { MENU_LABELS } from '../../../src/infrastructure/dom/menuText';
import { fakeDom, type FakeElement } from '../../support/fakeDom';
import { aSiteConfig, startWithSites, untilBuilding, withStock } from '../../support/sites';

// Spec build-sites 0027, "Panel de obra" (sin navegador: DOM falso; el panel solo usa
// createElement, clases, atributos y textContent). Costes por defecto: casa 15 madera; torre 30
// madera y 15 piedra.
const ICONS = { wood: '/assets/W_Idle.png', stone: '/assets/Deco/05.png' } as const;

function inSite(wood: number, stone: number): RunSnapshot {
  const run = startWithSites(aSiteConfig(), withStock(wood, stone));
  untilBuilding(run, 1);
  return run.snapshot();
}

function panel() {
  const { doc, root, fake } = fakeDom();
  const build = new BuildPanel(doc, root, ICONS);
  const paint = (s: RunSnapshot) => {
    build.sync(s);
    build.setVisible(s.status === 'building');
  };
  const section = () => fake.children[0] as FakeElement;
  const rows = () => section().findAll((e) => e.dataset.building !== undefined);
  return { build, paint, section, rows };
}

const text = (el: FakeElement | undefined, cls: string) => el?.byClass(cls)[0]?.textContent;
const collapsed = (el: FakeElement | undefined) =>
  (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const disabled = (el: FakeElement | undefined) =>
  el?.getAttribute('disabled') !== null && el?.getAttribute('aria-disabled') === 'true';

/** Por cada recurso pintado de una fila: [alt del icono, cifra, en rojo, «faltan …» o null]. */
function amounts(el: FakeElement | undefined): [string | null, string, boolean, string | null][] {
  return (el?.byClass('build-panel__amount') ?? []).map((a) => [
    a.byClass('resource-icon')[0]?.getAttribute('alt') ?? null,
    text(a, 'build-panel__value') ?? '',
    a.className.split(' ').includes('is-short'),
    text(a, 'build-panel__missing') ?? null,
  ]);
}

describe('BuildPanel (spec build-sites 0027)', () => {
  it('Scenario: Panel con las dos opciones asequibles (madera 30, piedra 15)', () => {
    const { paint, section, rows, build } = panel();
    paint(inSite(30, 15));

    expect(section().hidden).toBe(false);
    expect(section().getAttribute('role')).toBe('dialog');
    const stock = section().byClass('build-panel__stock')[0];
    expect(amounts(stock)).toEqual([
      ['madera', '30', false, null],
      ['piedra', '15', false, null],
    ]);
    expect(rows().map((r) => r.dataset.building)).toEqual(['house', 'tower']);
    expect(rows().map(disabled)).toEqual([false, false]);
    expect(amounts(rows()[0])).toEqual([['madera', '15', false, null]]);
    expect(amounts(rows()[1])).toEqual([
      ['madera', '30', false, null],
      ['piedra', '15', false, null],
    ]);
    expect(text(section(), 'build-panel__leave')).toBe(MENU_LABELS.buildLeave);
    expect(collapsed(section())).not.toContain('faltan');
    expect(build.view.options.map((o) => o.affordable)).toEqual([true, true]);
  });

  it('Scenario: Panel con la torre no asequible (madera 30, piedra 14; clic en la torre)', () => {
    const { paint, rows, build } = panel();
    paint(inSite(30, 14));

    expect(rows().map(disabled)).toEqual([false, true]);
    expect(rows().map((r) => r.className.split(' ').includes('is-unavailable'))).toEqual([
      false,
      true,
    ]);
    expect(amounts(rows()[1])).toEqual([
      ['madera', '30', false, null],
      ['piedra', '15', true, 'faltan 1'],
    ]);
    rows()[1]?.click();
    expect(build.takeAction()).toBeNull();
    expect(build.view).toEqual({
      visible: true,
      siteId: 0,
      wood: 30,
      stone: 14,
      options: [
        { kind: 'house', wood: 15, stone: 0, affordable: true, missing: { wood: 0, stone: 0 } },
        { kind: 'tower', wood: 30, stone: 15, affordable: false, missing: { wood: 0, stone: 1 } },
      ],
    });
  });

  it('Scenario: Panel sin nada asequible (madera 10, piedra 0)', () => {
    const { paint, rows, section } = panel();
    paint(inSite(10, 0));

    expect(rows().map(disabled)).toEqual([true, true]);
    expect(amounts(rows()[0])).toEqual([['madera', '15', true, 'faltan 5']]);
    expect(amounts(rows()[1])).toEqual([
      ['madera', '30', true, 'faltan 20'],
      ['piedra', '15', true, 'faltan 15'],
    ]);
    const leave = section().byClass('build-panel__leave')[0];
    expect(leave?.getAttribute('disabled')).toBeNull();
  });

  it('Scenario: Nombre y coste separados (sin «Casa15» ni «Torre30», sin style, con alt)', () => {
    const { paint, rows, section } = panel();
    paint(inSite(30, 15));

    for (const row of rows()) {
      expect(row.byClass('build-panel__name')).toHaveLength(1);
      expect(row.byClass('build-panel__cost')).toHaveLength(1);
      expect(collapsed(row)).toMatch(/^(Casa|Torre) \d/);
    }
    expect(collapsed(rows()[0])).not.toContain('Casa15');
    expect(collapsed(rows()[1])).not.toContain('Torre30');
    const all = [section(), ...section().findAll(() => true)];
    expect(all.filter((e) => e.getAttribute('style') !== null)).toEqual([]);
    const icons = section().byClass('resource-icon');
    expect(icons.length).toBeGreaterThan(0);
    expect(icons.every((i) => ['madera', 'piedra'].includes(i.getAttribute('alt') ?? ''))).toBe(
      true,
    );
    expect(icons.every((i) => Object.values(ICONS).includes(i.getAttribute('src') as never))).toBe(
      true,
    );
  });

  it('clic en una fila asequible deja la acción de construir; Salir, la de salir; se consumen', () => {
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
    paint(
      startWithSites(aSiteConfig(), { ...withStock(0), player: { x: 3000, y: 2000 } }).snapshot(),
    );
    expect(section().hidden).toBe(true);
    expect(build.view).toMatchObject({ visible: false, siteId: null, options: [] });
  });
});
