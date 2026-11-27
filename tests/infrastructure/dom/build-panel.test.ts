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
/** Botones con nombre accesible `Salir` (0036: solo la ×): [texto visible, clase]. */
const leaveButtons = (el: FakeElement): [string, string][] =>
  el
    .findAll((e) => e.tagName === 'button' && e.accessibleName === MENU_LABELS.buildLeave)
    .map((b) => [b.textContent, b.className]);
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
    // 0036: la × (nombre accesible `Salir`).
    expect(leaveButtons(section())).toEqual([[MENU_LABELS.close, 'ui-close']]);
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
    const leave = section().byClass('ui-close')[0];
    expect(leave?.getAttribute('disabled')).toBeNull();
    expect(leave?.accessibleName).toBe(MENU_LABELS.buildLeave);
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

  it('clic en una fila asequible deja la acción de construir; la ×, la de salir; se consumen', () => {
    const { paint, rows, section, build } = panel();
    paint(inSite(30, 15));

    rows()[0]?.click();
    expect(build.takeAction()).toEqual({ kind: 'build', building: 'house' });
    expect(build.takeAction()).toBeNull();
    section().byClass('ui-close')[0]?.click();
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

// Spec build-sites (0036): la × de la esquina y, en cada fila, la imagen del edificio y su
// explicación (`BuildAbout`, la que cablea la composición con `buildingIcons` y `Guide.build`).
const ABOUT = {
  icons: {
    house: {
      url: '/tfm-survivors/assets/tiny-swords/Factions/Knights/Buildings/House/House_Blue.png',
      width: 128,
      height: 192,
    },
    tower: {
      url: '/tfm-survivors/assets/tiny-swords/Factions/Knights/Buildings/Tower/Tower_Blue.png',
      width: 128,
      height: 256,
    },
  },
  texts: { house: '+1 oro cada 30 s', tower: 'Dispara flechas a los enemigos cercanos' },
};

function aboutPanel() {
  const { doc, root, fake } = fakeDom();
  const build = new BuildPanel(doc, root, ICONS, ABOUT);
  const paint = (s: RunSnapshot) => {
    build.sync(s);
    build.setVisible(s.status === 'building');
  };
  const section = () => fake.children[0] as FakeElement;
  const rows = () => section().findAll((e) => e.dataset.building !== undefined);
  return { build, paint, section, rows };
}

const buildingImages = (row: FakeElement | undefined) => row?.byClass('build-panel__icon') ?? [];
const altOf = (e: FakeElement | undefined) => (e as unknown as { alt?: string } | undefined)?.alt;

describe('BuildPanel con la × y la explicación (spec build-sites 0036)', () => {
  it('Scenario: Panel con una opción (madera 30, piedra 14: 2 filas y la ×)', () => {
    const { paint, section, rows } = aboutPanel();
    paint(inSite(30, 14));

    expect(section().hidden).toBe(false);
    expect(amounts(section().byClass('build-panel__stock')[0])).toEqual([
      ['madera', '30', false, null],
      ['piedra', '14', false, null],
    ]);
    expect(rows().map((r) => [r.dataset.building, disabled(r)])).toEqual([
      ['house', false],
      ['tower', true],
    ]);
    expect(amounts(rows()[0])).toEqual([['madera', '15', false, null]]);
    expect(leaveButtons(section())).toEqual([[MENU_LABELS.close, 'ui-close']]);
    expect(section().findAll((e) => e.textContent === MENU_LABELS.buildLeave)).toEqual([]);
    expect(section().children.at(-1)?.className).toBe('ui-close');
  });

  it('Scenario: Filas con icono y explicación (madera 30, piedra 15)', () => {
    const { paint, rows } = aboutPanel();
    paint(inSite(30, 15));

    const [house, tower] = rows();
    const img = (row: FakeElement | undefined) => {
      const all = buildingImages(row);
      expect(all).toHaveLength(1);
      const i = all[0];
      return [i?.getAttribute('src'), altOf(i), i?.getAttribute('style')];
    };
    expect(img(house)).toEqual([ABOUT.icons.house.url, '', null]);
    expect(img(tower)).toEqual([ABOUT.icons.tower.url, '', null]);
    for (const row of [house, tower]) {
      const src = buildingImages(row)[0]?.getAttribute('src') ?? '';
      expect(src.startsWith('/tfm-survivors/assets/')).toBe(true);
    }
    expect(text(house, 'build-panel__about')?.trim()).toBe('+1 oro cada 30 s');
    expect(text(tower, 'build-panel__about')?.trim()).toBe(
      'Dispara flechas a los enemigos cercanos',
    );
    for (const row of [house, tower]) {
      const about = row?.byClass('build-panel__about')[0];
      expect(about).not.toBe(row?.byClass('build-panel__name')[0]);
      expect(about).not.toBe(row?.byClass('build-panel__cost')[0]);
    }
  });

  it('Scenario: Proporción del icono del edificio (atributos del frame: 128 : 192 y 128 : 256)', () => {
    const { paint, rows } = aboutPanel();
    paint(inSite(30, 15));
    const size = (row: FakeElement | undefined) => {
      const i = buildingImages(row)[0];
      return [i?.getAttribute('width'), i?.getAttribute('height')];
    };
    expect(rows().map(size)).toEqual([
      ['128', '192'],
      ['128', '256'],
    ]);
  });

  it('Scenario: Explicación en una fila no asequible (madera 10, piedra 0)', () => {
    const { paint, rows, build } = aboutPanel();
    paint(inSite(10, 0));

    for (const row of rows()) {
      expect(disabled(row)).toBe(true);
      expect(buildingImages(row)[0]?.hidden).toBe(false);
      expect(text(row, 'build-panel__about')?.trim()).not.toBe('');
    }
    expect(amounts(rows()[1])).toEqual([
      ['madera', '30', true, 'faltan 20'],
      ['piedra', '15', true, 'faltan 15'],
    ]);
    buildingImages(rows()[1])[0]?.clickBubbling();
    rows()[1]?.byClass('build-panel__about')[0]?.clickBubbling();
    expect(build.takeAction()).toBeNull();
  });

  it('Scenario: Clic en el icono de la casa (deja la acción de construir la casa)', () => {
    const { paint, rows, build } = aboutPanel();
    paint(inSite(30, 15));
    buildingImages(rows()[0])[0]?.clickBubbling();
    expect(build.takeAction()).toEqual({ kind: 'build', building: 'house' });
  });

  it('Scenario: Imagen de edificio que no carga (Tower_Blue: la fila oculta solo su imagen)', () => {
    const { paint, rows, build } = aboutPanel();
    paint(inSite(30, 15));
    const before = collapsed(rows()[1]);
    const tower = buildingImages(rows()[1])[0];
    expect(() => tower?.dispatch('error')).not.toThrow();

    expect(tower?.hidden).toBe(true);
    expect(buildingImages(rows()[0])[0]?.hidden).toBe(false);
    expect(collapsed(rows()[1])).toBe(before);
    expect(text(rows()[1], 'build-panel__name')).toBe(MENU_LABELS.buildTower);
    expect(disabled(rows()[1])).toBe(false);
    expect(build.view.options[1]?.affordable).toBe(true);
  });

  it('sin BuildAbout (4.º parámetro), la imagen va oculta y sin src', () => {
    const { paint, rows } = panel();
    paint(inSite(30, 15));
    for (const row of rows()) {
      const i = buildingImages(row)[0];
      expect([i?.hidden, i?.getAttribute('src')]).toEqual([true, null]);
    }
  });

  it('Scenario: Nombre y coste separados (con la explicación entre medias)', () => {
    const { paint, rows, section } = aboutPanel();
    paint(inSite(30, 15));
    const [house, tower] = rows().map(collapsed);
    expect(house).toBe('Casa +1 oro cada 30 s 15');
    expect(tower).toBe('Torre Dispara flechas a los enemigos cercanos 30 15');
    for (const glued of ['Casa15', 'Torre30', 'Casa+1', 'TorreDispara', 's15', 'cercanos30']) {
      expect(`${house ?? ''}|${tower ?? ''}`).not.toContain(glued);
    }
    const all = [section(), ...section().findAll(() => true)];
    expect(all.filter((e) => e.getAttribute('style') !== null)).toEqual([]);
  });

  it('Scenario: Panel con dos opciones (casa primero y torre después, cada una con su coste)', () => {
    const { paint, rows } = aboutPanel();
    paint(inSite(30, 15));
    expect(rows().map((r) => [r.dataset.building, amounts(r).map((a) => a[1])])).toEqual([
      ['house', ['15']],
      ['tower', ['30', '15']],
    ]);
  });

  it('Scenario: Panel con las dos opciones asequibles (con la ×)', () => {
    const { paint, rows, section } = aboutPanel();
    paint(inSite(30, 15));
    expect(rows().map(disabled)).toEqual([false, false]);
    expect(collapsed(section())).not.toContain('faltan');
    expect(leaveButtons(section())).toHaveLength(1);
  });

  it('Scenario: Panel con la torre no asequible (con la × y las imágenes)', () => {
    const { paint, rows, build, section } = aboutPanel();
    paint(inSite(30, 14));
    expect(rows().map(disabled)).toEqual([false, true]);
    expect(amounts(rows()[1])).toEqual([
      ['madera', '30', false, null],
      ['piedra', '15', true, 'faltan 1'],
    ]);
    rows()[1]?.click();
    expect(build.takeAction()).toBeNull();
    expect(leaveButtons(section())).toHaveLength(1);
  });

  it('Scenario: Panel sin atributo style (madera 10, piedra 0)', () => {
    const { paint, section } = aboutPanel();
    paint(inSite(10, 0));
    const all = [section(), ...section().findAll(() => true)];
    expect(all.filter((e) => e.getAttribute('style') !== null)).toEqual([]);
    const icons = section().byClass('resource-icon');
    expect(icons.every((i) => ['madera', 'piedra'].includes(i.getAttribute('alt') ?? ''))).toBe(
      true,
    );
    const buildings = section().byClass('build-panel__icon');
    expect(buildings).toHaveLength(2);
    expect(buildings.every((i) => altOf(i) === '')).toBe(true);
  });
});
