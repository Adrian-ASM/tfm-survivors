import { SoundPanel } from '../../../src/infrastructure/dom/SoundPanel';
import { aSoundStore } from '../../support/audio';
import { describe, expect, it, vi } from 'vitest';
import { BuildPanel } from '../../../src/infrastructure/dom/BuildPanel';
import { ConfirmDialog } from '../../../src/infrastructure/dom/ConfirmDialog';
import { GuideModal } from '../../../src/infrastructure/dom/GuideModal';
import { MenuPanel } from '../../../src/infrastructure/dom/MenuPanel';
import { PausePanel } from '../../../src/infrastructure/dom/PausePanel';
import { ResultsPanel } from '../../../src/infrastructure/dom/ResultsPanel';
import {
  NO_SHOP_ICONS,
  ShopPanel,
  type ShopIcons,
} from '../../../src/infrastructure/dom/ShopPanel';
import { iconKey } from '../../../src/infrastructure/icons/upgradeIcons';
import { MENU_LABELS } from '../../../src/infrastructure/dom/menuText';
import { MenuController } from '../../../src/infrastructure/menu/MenuController';
import { fakeDom, type FakeElement } from '../../support/fakeDom';
import { TEST_ICONS, defaultGuide } from '../../support/guide';
import { startAtDoor, untilShopping } from '../../support/shop';
import { DEFAULT_WEAPONS, DEFAULT_WEAPON_UPGRADES, withWeapons } from '../../support/builders';
import { aBehaviorConfig, aProbeType } from '../../support/runs';
import { aSiteConfig, startWithSites, untilBuilding, withStock } from '../../support/sites';

// Spec sprite-rendering (0032), "DOM sin cambios": vestir los paneles es solo CSS. Los 7 paneles
// montados en el DOM falso conservan clases, roles, textos visibles, orden de botones y foco (la
// instantánea se tomó con el DOM de antes del change, que no se toca) y ningún elemento tiene
// atributo `style`. Más los escenarios de DOM de castle-shop y build-sites.
const ICONS = { wood: '/assets/W_Idle.png', stone: '/assets/Deco/05.png' } as const;

/** Estructura comparable de un árbol: etiqueta, clases, rol, texto propio y hijos. */
interface Shape {
  tag: string;
  cls: string;
  role: string | null;
  hidden: boolean;
  text?: string;
  children?: Shape[];
}
function shape(el: FakeElement): Shape {
  const kids = el.children.map(shape);
  const own = kids.length === 0 ? el.textContent : undefined;
  return {
    tag: el.tagName,
    cls: el.className,
    role: el.getAttribute('role'),
    hidden: el.hidden,
    ...(own !== undefined && own !== '' ? { text: own } : {}),
    ...(kids.length > 0 ? { children: kids } : {}),
  };
}
const all = (el: FakeElement): FakeElement[] => [el, ...el.findAll(() => true)];
const styled = (el: FakeElement): FakeElement[] =>
  all(el).filter((e) => e.getAttribute('style') !== null || 'style' in e);

function shopRun(gold = 12) {
  const priced = DEFAULT_WEAPON_UPGRADES.map((u) =>
    u.id === 'fast-ci'
      ? { ...u, prices: [15, 20, 25, 30, 35] }
      : { ...u, prices: [10, 15, 20, 25, 30] },
  );
  const run = startAtDoor(
    {
      ...withWeapons(aBehaviorConfig([aProbeType()]), DEFAULT_WEAPONS),
      upgrades: { character: [], weapons: priced },
    },
    { resources: { gold, wood: 0 } },
  );
  untilShopping(run, 1);
  return run;
}

function siteSnapshot(wood: number, stone: number) {
  const run = startWithSites(aSiteConfig(), withStock(wood, stone));
  untilBuilding(run, 1);
  return run.snapshot();
}

/** Iconos de las filas de la tienda (0034): todos cargados, URL bajo la base. */
const SHOP_ICONS: ShopIcons = {
  resolve: (id) => ({ state: 'painted', key: iconKey(`${id}.png`), file: `${id}.png` }),
  url: (file) => `/tfm-survivors/assets/icons/${file}`,
};

/** Los 7 paneles montados y visibles, en el estado del escenario (0034: tienda con iconos). */
function mountAll(shopIcons: ShopIcons = SHOP_ICONS) {
  const { doc, root, fake, fakeDoc } = fakeDom();
  const controller = new MenuController();
  const guide = new GuideModal(doc, root, defaultGuide(), TEST_ICONS);
  // El panel Sonido (0035) cuelga de otro contenedor: los 7 paneles de 0032 siguen en su orden; el
  // menú y la pausa ganan su botón `Sonido` (instantánea regenerada en 0035).
  const soundParent = fakeDoc.createElement('div') as unknown as HTMLElement;
  const sound = new SoundPanel(doc, soundParent, aSoundStore().store);
  const menu = new MenuPanel(
    doc,
    root,
    controller,
    { onExport: vi.fn(), onImport: vi.fn(), onOpenConfirm: vi.fn() },
    guide,
    sound,
  );
  const dialog = new ConfirmDialog(doc, root, { onConfirm: vi.fn(), onCancel: vi.fn() });
  const pause = new PausePanel(doc, root, sound);
  const results = new ResultsPanel(doc, root, { onExport: vi.fn(), onImport: vi.fn() });
  const shop = new ShopPanel(doc, root, shopIcons);
  const build = new BuildPanel(doc, root, ICONS);
  menu.show();
  guide.open(vi.fn());
  guide.close();
  dialog.open();
  pause.setVisible(true);
  results.render({
    records: ['Mejor tiempo 01:00'],
    notices: ['no se guarda', 'dañados'],
    message: 'no válido',
  });
  const s = shopRun().snapshot();
  shop.sync(s.shop, { current: s.player.health, max: s.player.maxHealth });
  shop.setVisible(true);
  const b = siteSnapshot(10, 0);
  build.sync(b);
  build.setVisible(true);
  return { fake, fakeDoc };
}

describe('Paneles DOM sin cambios (sprite-rendering 0032)', () => {
  it('Scenario: DOM sin cambios (clases, roles, textos, orden y foco; sin atributo style)', () => {
    const { fake, fakeDoc } = mountAll();
    const panels = fake.children;
    expect(panels.map((p) => p.className)).toEqual([
      'guide-modal',
      'menu-panel',
      'confirm-dialog',
      'pause-panel',
      'results-panel',
      'shop-panel',
      'build-panel',
    ]);
    expect(panels.flatMap(styled)).toEqual([]);
    expect(fakeDoc.activeElement?.textContent).toBe(MENU_LABELS.cancel);
    expect(panels.map(shape)).toMatchSnapshot();
  });

  it('Scenario: DOM sin cambios (0034: la única diferencia es 1 imagen más por fila de la tienda)', () => {
    const withIcons = mountAll().fake.children.map(shape);
    const without = mountAll(NO_SHOP_ICONS).fake.children.map(shape);
    const strip = (sh: Shape): Shape => ({
      ...sh,
      ...(sh.children ? { children: sh.children.filter((c) => c.tag !== 'img').map(strip) } : {}),
    });
    const imgs = (sh: Shape): number =>
      (sh.tag === 'img' ? 1 : 0) + (sh.children ?? []).reduce((n, c) => n + imgs(c), 0);
    // Con o sin iconos cargados: los 6 paneles que no son la tienda, idénticos; la tienda, igual
    // quitando su imagen de fila (visible u oculta), que es 1 por cada una de las 7 filas.
    expect(withIcons.map(strip)).toEqual(without.map(strip));
    expect(withIcons.filter((_, i) => i !== 5)).toEqual(without.filter((_, i) => i !== 5));
    // La instantánea de arriba (regenerada en 0034) solo gana estas 7 imágenes respecto a la de 0032.
    expect(imgs(withIcons[5] as Shape)).toBe(7);
  });
});

describe('Panel de la tienda con piezas (castle-shop 0032)', () => {
  it('Scenario: Filas comprables y no comprables (clase y clic sin efecto)', () => {
    const { doc, root, fake } = fakeDom();
    const shop = new ShopPanel(doc, root);
    const run = shopRun(12);
    const before = run.snapshot();
    shop.sync(before.shop, { current: before.player.health, max: before.player.maxHealth });
    shop.setVisible(true);
    const row = (id: string) => fake.findAll((e) => e.dataset.product === id)[0];

    // `strict-rules` (10) es `button`; `fast-ci` (15) es fila no disponible → `buttonDisabled`.
    expect(row('strict-rules')?.className).toBe('shop-panel__product');
    expect(row('fast-ci')?.className).toBe('shop-panel__product is-unavailable');
    expect(row('fast-ci')?.byClass('shop-panel__notice')[0]?.textContent).toBe('Oro insuficiente');

    row('fast-ci')?.click();
    const action = shop.takeAction();
    expect(action).toEqual({ kind: 'buy', id: 'fast-ci' });
    // El clic intenta la compra, que falla sin cambiar nada.
    expect(run.buy('fast-ci').ok).toBe(false);
    expect(run.snapshot()).toEqual(before);
    expect(fake.children[0]?.hidden).toBe(false);
    expect(styled(fake)).toEqual([]);
  });

  it('Scenario: Tienda con desplazamiento interno a ×1 en 1.280 × 720 (la última fila responde)', () => {
    const { doc, root, fake } = fakeDom();
    const shop = new ShopPanel(doc, root);
    const s = shopRun(100).snapshot();
    shop.sync(s.shop, { current: s.player.health, max: s.player.maxHealth });
    const rows = fake.findAll((e) => e.dataset.product !== undefined);
    expect(rows).toHaveLength(7);
    // La lista desplazable es el contenedor de las 7 filas; el oro y Salir quedan fuera de ella.
    const list = fake.byClass('shop-panel__products')[0];
    expect(rows.every((r) => list?.contains(r))).toBe(true);
    expect(list?.contains(fake.byClass('shop-panel__gold')[0] ?? null)).toBe(false);
    expect(list?.contains(fake.byClass('shop-panel__leave')[0] ?? null)).toBe(false);
    rows.at(-1)?.click();
    expect(shop.takeAction()).toEqual({ kind: 'buy', id: rows.at(-1)?.dataset.product });
  });
});

describe('Panel de obra con piezas (build-sites 0032)', () => {
  it('Scenario: Torre no asequible con piezas (madera 30, piedra 14)', () => {
    const { doc, root, fake } = fakeDom();
    const build = new BuildPanel(doc, root, ICONS);
    build.sync(siteSnapshot(30, 14));
    const rows = fake.findAll((e) => e.dataset.building !== undefined);
    expect(rows.map((r) => r.className)).toEqual([
      'build-panel__option',
      'build-panel__option is-unavailable',
    ]);
    const tower = rows[1];
    expect(tower?.getAttribute('disabled')).not.toBeNull();
    const amounts = tower?.byClass('build-panel__amount') ?? [];
    const short = amounts.map((a) => [
      a.byClass('build-panel__value')[0]?.textContent,
      a.className.includes('is-short'),
      a.byClass('build-panel__missing')[0]?.textContent ?? null,
    ]);
    // La cifra 15 de piedra y «faltan 1» van en `.is-short` (tinta danger de la fila); 30 no.
    expect(short).toEqual([
      ['30', false, null],
      ['15', true, 'faltan 1'],
    ]);
  });

  it('Scenario: Panel sin atributo style (madera 10, piedra 0; alternativas de los iconos)', () => {
    const { doc, root, fake } = fakeDom();
    const build = new BuildPanel(doc, root, ICONS);
    build.sync(siteSnapshot(10, 0));
    build.setVisible(true);
    expect(styled(fake)).toEqual([]);
    const alts = fake.byClass('resource-icon').map((i) => i.getAttribute('alt'));
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.every((a) => a === 'madera' || a === 'piedra')).toBe(true);
  });
});
