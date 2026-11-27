import { describe, expect, it } from 'vitest';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { ShopPanel, type ShopIcons } from '../../src/infrastructure/dom/ShopPanel';
import {
  IconBook,
  iconCatalog,
  iconKey,
  type IconIds,
} from '../../src/infrastructure/icons/upgradeIcons';
import { declOf, evalLength, parseCss, stylesText } from '../support/css';
import { MENU_LABELS } from '../../src/infrastructure/dom/menuText';
import { DEFAULT_WEAPONS, DEFAULT_WEAPON_UPGRADES, withWeapons } from '../support/builders';
import { fakeDom, type FakeElement } from '../support/fakeDom';
import { aBehaviorConfig, aProbeType } from '../support/runs';
import { buyAll, startAtDoor, untilShopping } from '../support/shop';

// Spec castle-shop (0024), "Overlay de la tienda" (sin navegador: DOM falso, el panel solo usa
// createElement, clases, atributos y textContent).

const PRICED = DEFAULT_WEAPON_UPGRADES.map((u) =>
  u.id === 'fast-ci'
    ? { ...u, prices: [15, 20, 25, 30, 35] }
    : { ...u, prices: [10, 15, 20, 25, 30] },
);

/** Partida en tienda con oro 12: `strict-rules` a 10 y `fast-ci` a 15. */
function inShop(gold = 12) {
  const run = startAtDoor(
    {
      ...withWeapons(aBehaviorConfig([aProbeType()]), DEFAULT_WEAPONS),
      upgrades: { character: [], weapons: PRICED },
    },
    { resources: { gold, wood: 0 } },
  );
  untilShopping(run, 1);
  return run;
}

function panel() {
  const { doc, root, fake } = fakeDom();
  const shop = new ShopPanel(doc, root);
  const paint = (s: RunSnapshot) => {
    shop.sync(s.shop, { current: s.player.health, max: s.player.maxHealth });
    shop.setVisible(s.status === 'shopping');
  };
  const section = () => fake.children[0] as FakeElement;
  const row = (id: string) => section().findAll((e) => e.dataset.product === id)[0];
  return { shop, paint, section, row };
}

const text = (el: FakeElement | undefined, cls: string) => el?.byClass(cls)[0]?.textContent;

describe('ShopPanel', () => {
  it('Scenario: Overlay con oro justo (oro 12, 7 filas, la ×; fast-ci con Oro insuficiente)', () => {
    const { paint, section, row, shop } = panel();
    paint(inShop().snapshot());

    expect(section().hidden).toBe(false);
    expect(section().getAttribute('role')).toBe('dialog');
    expect(text(section(), 'shop-panel__gold')).toBe(`${MENU_LABELS.shopGoldLabel}: 12`);
    expect(section().findAll((e) => e.dataset.product !== undefined)).toHaveLength(7);
    // 0036: 1 botón con nombre accesible `Salir` (la ×) y ningún texto visible `Salir`.
    const leave = section().findAll((e) => e.accessibleName === MENU_LABELS.shopLeave);
    expect(leave.map((b) => [b.tagName, b.textContent, b.className])).toEqual([
      ['button', MENU_LABELS.close, 'ui-close'],
    ]);
    expect(section().findAll((e) => e.textContent === MENU_LABELS.shopLeave)).toEqual([]);
    expect(section().children.at(-1)).toBe(leave[0]);
    expect(
      section().findAll(
        (e) => e.dataset.product !== undefined && !!e.byClass('shop-panel__icon')[0],
      ),
    ).toHaveLength(7);
    expect(row('strict-rules')?.className).toBe('shop-panel__product');
    expect(text(row('strict-rules'), 'shop-panel__notice')).toBe('');
    expect(row('fast-ci')?.getAttribute('aria-disabled')).toBe('true');
    expect(text(row('fast-ci'), 'shop-panel__notice')).toBe('Oro insuficiente');
    expect(text(row('strict-rules'), 'shop-panel__level')).toBe('0/5');
    expect(shop.view.products.map((p) => p.id)).toEqual([...PRICED.map((u) => u.id), 'heal']);
    expect(shop.view.products[1]).toEqual({
      id: 'fast-ci',
      level: 0,
      price: 15,
      buyable: false,
      icon: 'none',
    });
  });

  it('Scenario: Clic en un producto (deja la compra; tras ella, oro 2, nivel 1 y sin oro)', () => {
    const { paint, row, shop } = panel();
    const run = inShop();
    paint(run.snapshot());

    row('strict-rules')?.click();
    const action = shop.takeAction();
    expect(action).toEqual({ kind: 'buy', id: 'strict-rules' });
    paint(buyAll(run, ['strict-rules']));

    expect(shop.view.gold).toBe(2);
    expect(text(row('strict-rules'), 'shop-panel__level')).toBe('1/5');
    expect(text(row('strict-rules'), 'shop-panel__notice')).toBe('Oro insuficiente');
    expect(shop.takeAction()).toBeNull();
  });

  it('Scenario: Clic sin oro (la fila deja el intento; la compra falla y el overlay sigue)', () => {
    const { paint, row, shop, section } = panel();
    const run = inShop();
    paint(run.snapshot());
    const before = run.snapshot();

    row('fast-ci')?.click();
    const action = shop.takeAction();
    expect(action).toEqual({ kind: 'buy', id: 'fast-ci' });
    expect(run.buy('fast-ci').ok).toBe(false);
    paint(run.snapshot());

    expect(run.snapshot()).toEqual(before);
    expect(section().hidden).toBe(false);
  });

  it('la × deja la acción leave; producto al máximo muestra Máximo; vida llena en la curación', () => {
    const { paint, section, row, shop } = panel();
    const run = startAtDoor(
      {
        ...withWeapons(aBehaviorConfig([aProbeType()]), DEFAULT_WEAPONS),
        upgrades: { character: [], weapons: PRICED },
      },
      { resources: { gold: 100, wood: 0 }, upgrades: { coverage: 5 } },
    );
    untilShopping(run, 1);
    paint(run.snapshot());

    section().byClass('ui-close')[0]?.click();

    expect(shop.takeAction()).toEqual({ kind: 'leave' });
    expect(text(row('coverage'), 'shop-panel__price')).toBe('Máximo');
    expect(text(row('heal'), 'shop-panel__notice')).toBe('Vida llena');
  });

  it('Scenario: Sin overlay fuera de la tienda (en curso: oculto; sin cambios no reconstruye)', () => {
    const { paint, section, shop } = panel();
    const run = inShop();
    run.leaveShop();
    paint(run.snapshot());
    const list = section().byClass('shop-panel__products')[0]?.children[0];
    paint(run.snapshot());

    expect([section().hidden, shop.view.visible]).toEqual([true, false]);
    expect(section().byClass('shop-panel__products')[0]?.children[0]).toBe(list);
  });
});

// Spec castle-shop (0034), "Icono en las filas de la tienda" (design D6). Datos de iconos de prueba
// con la forma de los del repositorio (la sección real llega en la tarea 6.1).
const ICON_BASE = '/tfm-survivors/assets/icons/';
const SHOP_IDS = [...PRICED.map((u) => u.id), 'heal'];
const FALLBACK = { character: 'fallback-character.png', weapon: 'fallback-weapon.png' };
const IDS: IconIds = { character: ['guardrail'], weapon: SHOP_IDS };

function iconsWith(opts: { drop?: string[]; unloaded?: string[] } = {}): ShopIcons {
  const byId = Object.fromEntries(
    SHOP_IDS.filter((id) => !(opts.drop ?? []).includes(id)).map((id) => [id, `${id}.png`]),
  );
  const book = new IconBook(iconCatalog({ fallback: FALLBACK, byId }, IDS));
  const unloaded = new Set((opts.unloaded ?? []).map(iconKey));
  const all = [...SHOP_IDS.map((id) => `${id}.png`), FALLBACK.character, FALLBACK.weapon];
  book.setLoaded(all.map(iconKey).filter((k) => !unloaded.has(k)));
  return { resolve: (id) => book.resolve(id), url: (file) => ICON_BASE + file };
}

function iconPanel(icons: ShopIcons) {
  const { doc, root, fake } = fakeDom();
  const shop = new ShopPanel(doc, root, icons);
  const paint = (s: RunSnapshot) => {
    shop.sync(s.shop, { current: s.player.health, max: s.player.maxHealth });
    shop.setVisible(s.status === 'shopping');
  };
  const section = () => fake.children[0] as FakeElement;
  const row = (id: string) => section().findAll((e) => e.dataset.product === id)[0];
  const imgs = (id: string) => row(id)?.findAll((e) => e.tagName === 'img') ?? [];
  return { shop, paint, row, imgs };
}

const TEXT_CLASSES = ['name', 'description', 'level', 'price', 'notice'].map(
  (c) => `shop-panel__${c}`,
);
const textsOf = (el: FakeElement | undefined) => TEXT_CLASSES.map((c) => text(el, c));

describe('ShopPanel · icono en las filas (castle-shop 0034)', () => {
  it('Scenario: Siete filas con su icono (URL propia bajo la base, alt vacío, sin style)', () => {
    const run = inShop();
    const plain = panel();
    plain.paint(run.snapshot());
    const { paint, row, imgs, shop } = iconPanel(iconsWith());
    paint(run.snapshot());

    expect(shop.view.products.map((p) => p.id)).toEqual([
      'strict-rules',
      'fast-ci',
      'wide-analysis',
      'hard-asserts',
      'watch-mode',
      'coverage',
      'heal',
    ]);
    for (const id of SHOP_IDS) {
      const found = imgs(id);
      expect(found, id).toHaveLength(1);
      const img = found[0] as FakeElement & { src?: string; alt?: string };
      expect(img.src).toBe(`${ICON_BASE}${id}.png`);
      expect(img.src?.startsWith('/tfm-survivors/assets/')).toBe(true);
      expect(img.alt).toBe('');
      expect(img.hidden).toBe(false);
      expect(img.getAttribute('style')).toBeNull();
      expect(img.className).toBe('shop-panel__icon');
      expect(textsOf(row(id))).toEqual(textsOf(plain.row(id)));
    }
    expect(shop.view.products.every((p) => p.icon === 'painted')).toBe(true);
  });

  it.each([
    ['watch-mode', 'watch-mode'],
    ['heal', 'heal'],
  ])('Scenario: Producto sin icono propio (sin %s: reserva de arma)', (_label, id) => {
    const { paint, imgs, shop } = iconPanel(iconsWith({ drop: [id] }));
    paint(inShop().snapshot());
    const img = imgs(id)[0] as FakeElement & { src?: string };
    expect(img.src).toBe(`${ICON_BASE}${FALLBACK.weapon}`);
    expect(shop.view.products.find((p) => p.id === id)?.icon).toBe('fallback');
  });

  it.each([
    ['sin la imagen de strict-rules', ['strict-rules.png'], 'fallback'],
    ['sin ella ni la reserva de arma', ['strict-rules.png', FALLBACK.weapon], 'none'],
  ] as const)('Scenario: Imagen que no carga (%s)', (_label, unloaded, state) => {
    const run = inShop();
    const plain = panel();
    plain.paint(run.snapshot());
    const { paint, row, imgs, shop } = iconPanel(iconsWith({ unloaded: [...unloaded] }));
    paint(run.snapshot());

    const img = imgs('strict-rules')[0] as FakeElement & { src?: string };
    expect(imgs('strict-rules')).toHaveLength(1);
    expect(shop.view.products[0]?.icon).toBe(state);
    if (state === 'fallback') expect(img.src).toBe(`${ICON_BASE}${FALLBACK.weapon}`);
    expect(img.hidden).toBe(state === 'none');
    expect(img.src ?? '').not.toMatch(/^(data:|blob:)/);
    expect(textsOf(row('strict-rules'))).toEqual(textsOf(plain.row('strict-rules')));

    row('strict-rules')?.click();
    expect(shop.takeAction()).toEqual({ kind: 'buy', id: 'strict-rules' });
    paint(buyAll(run, ['strict-rules']));
    expect(shop.view.gold).toBe(2);
    expect(text(row('strict-rules'), 'shop-panel__level')).toBe('1/5');
  });

  it('Scenario: Clic sobre el icono (oro 2 y strict-rules en nivel 1)', () => {
    const run = inShop();
    const { paint, row, imgs, shop } = iconPanel(iconsWith());
    paint(run.snapshot());

    imgs('strict-rules')[0]?.clickBubbling();
    const action = shop.takeAction();
    expect(action).toEqual({ kind: 'buy', id: 'strict-rules' });
    paint(buyAll(run, ['strict-rules']));

    expect(shop.view.gold).toBe(2);
    expect(text(row('strict-rules'), 'shop-panel__level')).toBe('1/5');
  });

  it('Scenario: Overlay con oro justo (cada una de las 7 filas con 1 icono)', () => {
    const { paint, imgs, row } = iconPanel(iconsWith());
    paint(inShop().snapshot());
    expect(SHOP_IDS.map((id) => imgs(id).length)).toEqual([1, 1, 1, 1, 1, 1, 1]);
    expect(row('strict-rules')?.className).toBe('shop-panel__product');
    expect(text(row('fast-ci'), 'shop-panel__notice')).toBe('Oro insuficiente');
  });

  it('Scenario: Clic en un producto (con iconos: oro 2, nivel 1 y Oro insuficiente)', () => {
    const run = inShop();
    const { paint, row, shop } = iconPanel(iconsWith());
    paint(run.snapshot());
    row('strict-rules')?.click();
    expect(shop.takeAction()).toEqual({ kind: 'buy', id: 'strict-rules' });
    paint(buyAll(run, ['strict-rules']));
    expect(shop.view.gold).toBe(2);
    expect(text(row('strict-rules'), 'shop-panel__notice')).toBe('Oro insuficiente');
  });

  it('Scenario: Clic sin oro (con iconos: la compra falla y el snapshot no cambia)', () => {
    const run = inShop();
    const { paint, imgs, shop } = iconPanel(iconsWith());
    paint(run.snapshot());
    const before = run.snapshot();
    imgs('fast-ci')[0]?.clickBubbling();
    expect(shop.takeAction()).toEqual({ kind: 'buy', id: 'fast-ci' });
    expect(run.buy('fast-ci').ok).toBe(false);
    expect(run.snapshot()).toEqual(before);
  });

  it('Scenario: Reglas del icono de fila (pixelated, ancho = alto ∝ --ui-scale, sin url()', () => {
    const rules = parseCss();
    const sel = '.shop-panel__icon';
    expect(declOf(rules, sel, 'image-rendering')).toBe('pixelated');
    const width = declOf(rules, sel, 'width');
    expect(declOf(rules, sel, 'height')).toBe(width);
    expect(width).toContain('var(--ui-scale');
    const at = (k: number) => evalLength(width, { emPx: 14, vars: { '--ui-scale': k } });
    expect([at(1), at(2)]).toEqual([32, 64]);
    expect(declOf(rules, `${sel}[hidden]`, 'display')).toBe('none');
    // En modo móvil (--ui-scale 1) ninguna regla lo cambia y 32 ≤ 44 px de alto mínimo de fila.
    const mobile = rules.filter((r) =>
      r.selectors.some((s) => s.includes('.is-mobile') && s.includes(sel)),
    );
    expect(mobile).toEqual([]);
    expect(at(1)).toBeLessThanOrEqual(44);
    expect(stylesText()).not.toContain('url(');
  });
});
