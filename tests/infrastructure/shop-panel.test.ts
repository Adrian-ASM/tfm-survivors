import { describe, expect, it } from 'vitest';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { ShopPanel } from '../../src/infrastructure/dom/ShopPanel';
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
  it('Scenario: Overlay con oro justo (oro 12, 7 filas, Salir; fast-ci con Oro insuficiente)', () => {
    const { paint, section, row, shop } = panel();
    paint(inShop().snapshot());

    expect(section().hidden).toBe(false);
    expect(section().getAttribute('role')).toBe('dialog');
    expect(text(section(), 'shop-panel__gold')).toBe(`${MENU_LABELS.shopGoldLabel}: 12`);
    expect(section().findAll((e) => e.dataset.product !== undefined)).toHaveLength(7);
    expect(text(section(), 'shop-panel__leave')).toBe(MENU_LABELS.shopLeave);
    expect(row('strict-rules')?.className).toBe('shop-panel__product');
    expect(text(row('strict-rules'), 'shop-panel__notice')).toBe('');
    expect(row('fast-ci')?.getAttribute('aria-disabled')).toBe('true');
    expect(text(row('fast-ci'), 'shop-panel__notice')).toBe('Oro insuficiente');
    expect(text(row('strict-rules'), 'shop-panel__level')).toBe('0/5');
    expect(shop.view.products.map((p) => p.id)).toEqual([...PRICED.map((u) => u.id), 'heal']);
    expect(shop.view.products[1]).toEqual({ id: 'fast-ci', level: 0, price: 15, buyable: false });
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

  it('Salir deja la acción leave; producto al máximo muestra Máximo; vida llena en la curación', () => {
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

    section().byClass('shop-panel__leave')[0]?.click();

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
