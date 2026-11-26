import { describe, expect, it } from 'vitest';
import upgradesJson from '../../content/upgrades.json';
import type { OfferSnapshot, RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { ShopPanel } from '../../src/infrastructure/dom/ShopPanel';
import {
  IconBook,
  iconCatalog,
  iconKey,
  type IconIds,
} from '../../src/infrastructure/icons/upgradeIcons';
import { createUpgradeOverlay } from '../../src/infrastructure/phaser/sceneWidgets';
import { screenFrame } from '../../src/infrastructure/phaser/ui/screenFrame';
import { DEFAULT_WEAPONS, DEFAULT_WEAPON_UPGRADES, withWeapons } from '../support/builders';
import { fakeDom } from '../support/fakeDom';
import { fakeUiScene, repoUi } from '../support/phaserUi';
import { aBehaviorConfig, aProbeType } from '../support/runs';
import { startAtDoor, untilShopping } from '../support/shop';

// Spec sprite-rendering (0034), "Iconos observables en el navegador" (design D7): la sonda lee
// `offerIcons` (UpgradeOverlay.iconStates, vía GameScene) y `shop.products[i].icon` (ShopPanel.view),
// los dos con el mismo IconBook, como los cablea `main.ts`. Pintado con dobles de Phaser y DOM.
const IDS: IconIds = {
  character: upgradesJson.character.map((u) => u.id),
  weapon: [...DEFAULT_WEAPON_UPGRADES.map((u) => u.id), 'heal'],
};
const FALLBACK = { character: 'fallback-character.png', weapon: 'fallback-weapon.png' };
const BY_ID = Object.fromEntries([...IDS.character, ...IDS.weapon].map((id) => [id, `${id}.png`]));

function wired(unloaded: readonly string[]) {
  const book = new IconBook(iconCatalog({ fallback: FALLBACK, byId: BY_ID }, IDS));
  const skip = new Set(unloaded.map(iconKey));
  const all = [...Object.values(BY_ID), FALLBACK.character, FALLBACK.weapon].map(iconKey);
  book.setLoaded(all.filter((k) => !skip.has(k)));
  const view = { width: 1280, height: 720 };
  const { scene } = fakeUiScene({ view });
  const offer = createUpgradeOverlay(scene, screenFrame(view.width, view.height), repoUi(), (id) =>
    book.resolve(id),
  );
  const { doc, root } = fakeDom();
  const shop = new ShopPanel(doc, root, {
    resolve: (id) => book.resolve(id),
    url: (f) => `/tfm-survivors/assets/icons/${f}`,
  });
  const paintShop = (s: RunSnapshot) => {
    shop.sync(s.shop, { current: s.player.health, max: s.player.maxHealth });
    shop.setVisible(s.status === 'shopping');
  };
  // Lo que lee la sonda tras cada pintado.
  const probe = () => ({ offerIcons: offer.iconStates, shop: shop.view.products });
  return { offer, paintShop, probe };
}

const option = (id: string): OfferSnapshot => ({
  id,
  name: id,
  description: id,
  level: 0,
  nextLevel: 1,
});

function shopRun() {
  const run = startAtDoor(
    {
      ...withWeapons(aBehaviorConfig([aProbeType()]), DEFAULT_WEAPONS),
      upgrades: { character: [], weapons: DEFAULT_WEAPON_UPGRADES },
    },
    { resources: { gold: 12, wood: 0 } },
  );
  untilShopping(run, 1);
  return run;
}

describe('iconos en la sonda (sprite-rendering 0034)', () => {
  it('Scenario: Estados en la sonda (cartas painted/fallback/painted; fila heal sin icono)', () => {
    const { offer, paintShop, probe } = wired(['shortcuts.png', 'heal.png', FALLBACK.weapon]);
    offer.sync(['guardrail', 'shortcuts', 'hunter'].map(option));
    const run = shopRun();
    paintShop(run.snapshot());

    expect(probe().offerIcons).toEqual([
      { id: 'guardrail', icon: 'painted' },
      { id: 'shortcuts', icon: 'fallback' },
      { id: 'hunter', icon: 'painted' },
    ]);
    const rows = probe().shop;
    expect(rows.find((p) => p.id === 'heal')?.icon).toBe('none');
    expect(rows.filter((p) => p.id !== 'heal').map((p) => p.icon)).toEqual(
      Array.from({ length: 6 }, () => 'painted'),
    );
    // Leer la sonda no cambia la simulación.
    const before = JSON.stringify(run.snapshot());
    probe();
    expect(JSON.stringify(run.snapshot())).toBe(before);

    // Oferta cerrada y tienda cerrada: listas vacías.
    offer.sync([]);
    run.leaveShop();
    paintShop(run.snapshot());
    expect(probe().offerIcons).toEqual([]);
    expect(probe().shop).toEqual([]);
  });
});
