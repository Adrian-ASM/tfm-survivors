import { describe, expect, it } from 'vitest';
import { BuyFromShop } from '../../src/application/BuyFromShop';
import { LeaveShop } from '../../src/application/LeaveShop';
import { TickRun } from '../../src/application/TickRun';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { PauseGate } from '../../src/infrastructure/phaser/PauseGate';
import { pressedOnce } from '../../src/infrastructure/dom/TouchBar';
import {
  ShopGate,
  playScreen,
  shopVisible,
  type ShopAction,
} from '../../src/infrastructure/phaser/ShopGate';
import {
  DEFAULT_WEAPONS,
  DEFAULT_WEAPON_UPGRADES,
  TICK_MS,
  withWeapons,
} from '../support/builders';
import { aBehaviorConfig, aProbeType } from '../support/runs';
import { startAtDoor } from '../support/shop';
import { ShopPanel } from '../../src/infrastructure/dom/ShopPanel';
import { fakeDom, type FakeElement } from '../support/fakeDom';

// Spec castle-shop (0024) "Overlay de la tienda" y main-menu "Pausa con Esc": la escena pasa Esc y
// la acción del panel a `ShopGate` antes que a `PauseGate`, y luego un frame a `TickRun`. Aquí se
// reproduce ese orden sin motor (patrón de pause-gate.test).

/** Mejoras de arma con los precios de escenario: `strict-rules` a 10 y `fast-ci` a 15. */
const SCENARIO_WEAPON_UPGRADES = DEFAULT_WEAPON_UPGRADES.map((u) =>
  u.id === 'fast-ci'
    ? { ...u, prices: [15, 20, 25, 30, 35] }
    : { ...u, prices: [10, 15, 20, 25, 30] },
);

/** Partida en tienda desde el tick 1 (oro 12) con sus casos de uso y las dos puertas de la escena. */
function scene(gold = 12) {
  const run = startAtDoor(
    {
      ...withWeapons(aBehaviorConfig([aProbeType()]), DEFAULT_WEAPONS),
      upgrades: { character: [], weapons: SCENARIO_WEAPON_UPGRADES },
    },
    { resources: { gold, wood: 0 } },
  );
  const tickRun = new TickRun(run);
  const uc = { buyFromShop: new BuyFromShop(run), leaveShop: new LeaveShop(run) };
  const shopGate = new ShopGate();
  const pause = new PauseGate();
  let last: RunSnapshot = tickRun.execute(TICK_MS, PlayerInput.NONE);
  const screens: string[] = [];
  /** Un frame de la escena con Esc (flanco de `PauseKey`) y la acción del panel. */
  const frame = (esc: boolean, action: ShopAction = null): RunSnapshot => {
    const shop = shopGate.step(esc, action, last.status, uc);
    if (shop.snapshot) last = shop.snapshot;
    pause.step(shop.esc, null, last.status, tickRun);
    last = pause.frame(tickRun, TICK_MS, PlayerInput.NONE, 1);
    screens.push(playScreen(last.status, pause.paused));
    return last;
  };
  return { run, frame, pause, screens, first: last };
}

describe('ShopGate (castle-shop y main-menu 0024)', () => {
  it.each<[string, boolean, ShopAction]>([
    ['Esc', true, null],
    ['el botón Salir', false, { kind: 'leave' }],
  ])('Scenario: Salir con Esc o con el botón (%s: tick n + 1 y sin pausa)', (_n, esc, action) => {
    const { frame, first, pause, screens } = scene();
    expect(first.status).toBe('shopping');

    const s = frame(esc, action);

    expect([s.status, s.tick, pause.paused]).toEqual(['running', first.tick + 1, false]);
    expect(shopVisible(s.status, pause.paused)).toBe(false);
    expect(screens).not.toContain('paused');
  });

  it('Scenario: Esc en la tienda (mantenida 60 frames: sale y no pausa; otra pulsación pausa)', () => {
    const { frame, pause, screens } = scene();

    frame(true);
    for (let i = 0; i < 59; i++) frame(false);
    expect([pause.paused, screens.includes('paused')]).toEqual([false, false]);

    frame(true);

    expect(pause.paused).toBe(true);
  });

  it('Scenario: Clic en un producto (compra con BuyFromShop) y Clic sin oro (nada cambia)', () => {
    const { frame, run } = scene();
    const before = run.snapshot();

    const failed = frame(false, { kind: 'buy', id: 'fast-ci' });
    expect(failed).toEqual(before);
    const bought = frame(false, { kind: 'buy', id: 'strict-rules' });

    expect([bought.status, bought.resources.gold]).toEqual(['shopping', 2]);
    expect(bought.shop.products[0]).toMatchObject({ id: 'strict-rules', level: 1 });
  });

  it('las teclas de la partida no hacen nada en la tienda: 0 ticks por frame', () => {
    const { frame, first } = scene();

    const s = Array.from({ length: 600 }, () => frame(false)).at(-1);

    expect([s?.tick, s?.status]).toEqual([first.tick, 'shopping']);
  });

  it('Scenario: Sin overlay fuera de la tienda (en curso, eligiendo, en pausa y terminada)', () => {
    expect(shopVisible('running', false)).toBe(false);
    expect(shopVisible('choosing', false)).toBe(false);
    expect(shopVisible('shopping', true)).toBe(false);
    expect(shopVisible('over', false)).toBe(false);
    expect([shopVisible('shopping', false), playScreen('shopping', false)]).toEqual([true, 'shop']);
  });
});

// Spec touch-controls (0033), "Barra táctil": ⏸ es una pulsación de Esc (`pressedOnce` con Esc).
describe('ShopGate con ⏸ (0033)', () => {
  it('Scenario: ⏸ en la tienda y en la obra (tienda: sale sin pausa; un segundo ⏸ pausa)', () => {
    const { frame, pause, screens } = scene();
    const tap = (tapped: boolean) => frame(pressedOnce(false, tapped));

    const left = tap(true);
    const screensAfterLeave = [...screens];
    tap(true);

    expect([left.status, screensAfterLeave.includes('paused')]).toEqual(['running', false]);
    expect(pause.paused).toBe(true);
  });
});

// Spec castle-shop (0036), "Overlay de la tienda": la × del panel real deja `leave`, que la escena
// pasa a `ShopGate` como Esc. En Node no hay hoja de estilos: es el caso de las piezas en reserva.
describe('La × de la tienda (castle-shop 0036)', () => {
  /** La escena con el `ShopPanel` real pintado con cada snapshot (como `GameScene.update`). */
  function withPanel() {
    const s = scene();
    const { doc, root, fake, fakeDoc } = fakeDom();
    const panel = new ShopPanel(doc, root);
    const paint = (snap: RunSnapshot) => {
      panel.sync(snap.shop, { current: snap.player.health, max: snap.player.maxHealth });
      panel.setVisible(shopVisible(snap.status, s.pause.paused));
    };
    paint(s.first);
    const section = fake.byClass('shop-panel')[0] as FakeElement;
    const x = () => section.byClass('ui-close')[0] as FakeElement;
    /** Un frame con la acción que haya dejado el panel. */
    const frame = (esc = false) => {
      const snap = s.frame(esc, panel.takeAction());
      paint(snap);
      return snap;
    };
    return { ...s, panel, section, x, frame, fakeDoc };
  }

  it('Scenario: Salir con Esc o con la × (mismo snapshot campo a campo)', () => {
    const esc = withPanel();
    const byEsc = esc.frame(true);
    const click = withPanel();
    click.x().click();
    const byX = click.frame();

    expect(byX).toEqual(byEsc);
    expect([byX.status, byX.tick]).toEqual(['running', click.first.tick + 1]);
    expect(click.section.hidden).toBe(true);
    expect(click.screens).not.toContain('paused');
    expect(click.section.contains(click.fakeDoc.activeElement)).toBe(false);
  });

  it('Scenario: La × con el teclado (Intro sobre la × con el foco)', () => {
    const s = withPanel();
    s.x().focus();
    // Intro sobre un `button` con el foco lanza su `click` (comportamiento del navegador).
    s.x().click();
    const snap = s.frame();

    expect([s.section.hidden, snap.tick, s.pause.paused]).toEqual([true, s.first.tick + 1, false]);
    expect(s.screens).not.toContain('paused');
  });

  it('Scenario: Compra con las piezas en reserva (compra, frame, × y otro frame)', () => {
    const s = withPanel();
    (s.section.findAll((e) => e.dataset.product === 'strict-rules')[0] as FakeElement).click();
    s.frame();
    expect(s.panel.view.gold).toBe(2);
    expect(s.panel.view.products.find((p) => p.id === 'strict-rules')?.level).toBe(1);

    s.x().click();
    s.frame();
    expect(s.section.hidden).toBe(true);
    expect(s.screens).not.toContain('paused');
  });
});
