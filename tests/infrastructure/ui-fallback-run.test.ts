import { describe, expect, it, vi } from 'vitest';
import { RestartRun } from '../../src/application/RestartRun';
import { OPEN_TERRAIN } from '../../src/domain/map/TerrainSource';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import type { UiAppearance } from '../../src/infrastructure/content/appearanceSchema';
import { BuildPanel } from '../../src/infrastructure/dom/BuildPanel';
import { ConfirmDialog } from '../../src/infrastructure/dom/ConfirmDialog';
import { GuideModal } from '../../src/infrastructure/dom/GuideModal';
import { MenuPanel } from '../../src/infrastructure/dom/MenuPanel';
import { PausePanel } from '../../src/infrastructure/dom/PausePanel';
import { ResultsPanel } from '../../src/infrastructure/dom/ResultsPanel';
import { ShopPanel } from '../../src/infrastructure/dom/ShopPanel';
import { MENU_LABELS } from '../../src/infrastructure/dom/menuText';
import { applyUiKit, uiKitVariables } from '../../src/infrastructure/dom/uiKit';
import { MenuController } from '../../src/infrastructure/menu/MenuController';
import { finishBoot } from '../../src/infrastructure/phaser/bootPlan';
import type { RingSprite } from '../../src/infrastructure/phaser/PulseLayer';
import { RenderLayers } from '../../src/infrastructure/phaser/RenderLayers';
import type { SpriteCounts } from '../../src/infrastructure/phaser/renderCounts';
import { createHud, createUpgradeOverlay } from '../../src/infrastructure/phaser/sceneWidgets';
import { screenFrame } from '../../src/infrastructure/phaser/ui/screenFrame';
import type { MapArtCanvas } from '../../src/infrastructure/phaser/TerrainView';
import { UI_FILES } from '../support/appearance';
import {
  aDefaultConfig,
  DEFAULT_WEAPONS,
  DEFAULT_WEAPON_UPGRADES,
  withWeapons,
} from '../support/builders';
import { FAKE_HAZARD_CAPACITY, FakeGraphics, fakeKit } from '../support/FakeSprite';
import { fakeDom, type FakeElement } from '../support/fakeDom';
import { DoomedStartRun, lethalConfig, playToEnd } from '../support/finishedRuns';
import { TEST_ICONS, defaultGuide } from '../support/guide';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { repoLooks } from '../support/looks';
import { planFor } from '../support/mapArt';
import { fakeUiScene, repoUi } from '../support/phaserUi';
import { referenceBot } from '../support/policies';
import {
  aBehaviorConfig,
  aProbeType,
  chooseFirstWhileOpen,
  startSeededRun,
  visitShop,
  visitSite,
} from '../support/runs';
import { startAtDoor, untilShopping } from '../support/shop';
import { aSiteConfig, startWithSites, untilBuilding, withStock } from '../support/sites';

// Specs de 0032 sobre la reserva de las piezas de UI y de la fuente: sprite-rendering ("Partida
// entera con todas las piezas en reserva", "Fuente que no carga"), main-menu, castle-shop,
// build-sites y run-results. Sin navegador: dobles de Phaser y DOM falso.
const CONFIG = aDefaultConfig();
const FRAME_MS = 16.667;
const ui: UiAppearance = repoUi();
const ICONS = {
  gold: { texture: 'Resources/Resources/G_Idle.png', frame: 0, color: 0xe8c547 },
  wood: { texture: 'Resources/Resources/W_Idle.png', frame: 0, color: 0x9c6b3c },
  stone: { texture: 'Deco/05.png', frame: 0, color: 0x9aa0a6 },
};
const UI_KEYS = new Set(UI_FILES);

class Ring implements RingSprite {
  setPosition(): this {
    return this;
  }
  setRadius(): this {
    return this;
  }
  setAlpha(): this {
    return this;
  }
  setVisible(): this {
    return this;
  }
}

const noCanvas: MapArtCanvas = {
  clear: () => undefined,
  tiles: () => undefined,
  sprite: () => undefined,
  rect: () => undefined,
  circle: () => undefined,
  foam: () => undefined,
  frame: () => undefined,
  show: () => undefined,
};

/** Suma de los sprites con aspecto de reserva de la sonda (cualquier `placeholder`). */
function placeholders(counts: SpriteCounts): number {
  let n = Object.values(counts.enemyPlaceholders).reduce((a, b) => a + b, 0);
  const walk = (v: unknown): void => {
    if (!v || typeof v !== 'object') return;
    for (const [k, x] of Object.entries(v)) {
      if (k === 'placeholder' && typeof x === 'number') n += x;
      else walk(x);
    }
  };
  walk(counts);
  return n;
}

/**
 * Partida de la 42 con el bot de referencia (opción 0 en cada oferta) pintando cada snapshot con
 * las capas, el HUD, las cartas y los paneles DOM. `uiLoaded` decide si existen las texturas de UI.
 */
function playPainted(ticks: number, uiLoaded: boolean) {
  const run = startSeededRun(CONFIG, 42);
  const bot = referenceBot(CONFIG, run.map);
  const textures = (key: string) => uiLoaded || !UI_KEYS.has(key);
  const view = { width: 1280, height: 720 };
  const { scene, made } = fakeUiScene({ view, textures });
  const frame = screenFrame(view.width, view.height);
  const hud = createHud(scene, frame, ICONS, ui);
  const offer = createUpgradeOverlay(scene, frame, ui);
  const { doc, root } = fakeDom();
  const shop = new ShopPanel(doc, root);
  const build = new BuildPanel(doc, root, { wood: '/w.png', stone: '/s.png' });
  const layers = new RenderLayers(
    {
      kit: fakeKit(),
      warnings: () => new FakeGraphics(),
      ring: () => new Ring(),
      looks: repoLooks(),
      capacity: {
        enemies: 300,
        projectiles: 64,
        pulses: 8,
        pickups: 436,
        sheep: 5,
        corpses: 64,
        visualTicks: new Map([['tests', 8]]),
        hazards: FAKE_HAZARD_CAPACITY,
      },
    },
    { visible: 1, placeholder: 0 },
  );
  layers.paintMap(noCanvas, planFor(run.map, 42));
  const out: string[] = [];
  let maxPlaceholders = 0;
  for (let t = 0; t < ticks && run.status !== 'over'; t++) {
    visitShop(run, bot);
    visitSite(run, bot);
    chooseFirstWhileOpen(run);
    run.tick(bot.input(run.snapshot()));
    const s = run.snapshot();
    layers.advance(FRAME_MS, false);
    layers.render(s);
    hud.sync(s);
    offer.sync(s.status === 'choosing' ? s.offer : []);
    shop.sync(s.shop, { current: s.player.health, max: s.player.maxHealth });
    build.sync(s);
    maxPlaceholders = Math.max(maxPlaceholders, placeholders(layers.counts));
    out.push(JSON.stringify(s));
  }
  return { out, maxPlaceholders, slices: made.filter((m) => m.kind === 'nineslice').length };
}

describe('Reserva de las piezas de UI y de la fuente (0032)', () => {
  it('Scenario: Partida entera con todas las piezas en reserva (3.600 ticks de la 42)', () => {
    const loaded = playPainted(3600, true);
    const fallback = playPainted(3600, false);
    expect(fallback.out).toEqual(loaded.out);
    expect(loaded.out.length).toBeGreaterThan(0);
    expect([loaded.maxPlaceholders, fallback.maxPlaceholders]).toEqual([0, 0]);
    // Con texturas: 3 cartas + 3 paneles del HUD; en reserva, ninguna pieza.
    expect([loaded.slices, fallback.slices]).toEqual([6, 0]);
  }, 60_000);

  it('Scenario: Fuente que no carga (se crea el menú y una partida avanza 600 ticks con su HUD)', async () => {
    const started: string[] = [];
    await finishBoot({
      fontReady: Promise.resolve(false),
      fontFamily: ui.font.family,
      uiKeys: UI_FILES,
      exists: () => true,
      fail: vi.fn(),
      onUiLoaded: vi.fn(),
      start: () => started.push('menu'),
    });
    expect(started).toEqual(['menu']);
    const { out } = playPainted(600, true);
    expect(out).toHaveLength(600);
  });
});

/** Estilo de `#game` falso para publicar las variables de las piezas (cargadas o ninguna). */
function styleWith(loaded: boolean) {
  const props = new Map<string, string>();
  const vars = uiKitVariables(ui, loaded ? UI_KEYS : new Set(), (f) => `/tfm-survivors/${f}`);
  applyUiKit({ setProperty: (n, v) => props.set(n, v) }, vars);
  return props;
}
const byText = (root: FakeElement, label: string) =>
  root.findAll((e) => e.tagName === 'button' && e.textContent === label)[0];

describe('Flujos con las piezas en reserva (0032)', () => {
  /** Menú → Jugar → Esc (pausa) → Volver al menú → Borrar datos → Cancelar: lo que pasa en cada paso. */
  function menuFlow(loaded: boolean): unknown[] {
    const style = styleWith(loaded);
    const { doc, root, fake } = fakeDom();
    const controller = new MenuController();
    const guide = new GuideModal(doc, root, defaultGuide(), TEST_ICONS);
    const actions = { onExport: vi.fn(), onImport: vi.fn(), onOpenConfirm: vi.fn() };
    const menu = new MenuPanel(doc, root, controller, actions, guide);
    const dialog = new ConfirmDialog(doc, root, {
      onConfirm: vi.fn(),
      onCancel: () => {
        if (!controller.cancel()) return;
        dialog.close();
        menu.setLocked(false);
      },
    });
    actions.onOpenConfirm.mockImplementation(() => {
      menu.setLocked(true);
      dialog.open();
    });
    const pause = new PausePanel(doc, root);
    const log: unknown[] = [style.has('--ui-panel-src')];
    menu.show();
    byText(fake, MENU_LABELS.play)?.click();
    log.push(controller.takePlay());
    menu.hide();
    pause.setVisible(true);
    byText(fake, MENU_LABELS.toMenu)?.click();
    log.push(pause.takeAction());
    pause.setVisible(false);
    menu.show();
    byText(fake, MENU_LABELS.clear)?.click();
    log.push(fake.byClass('confirm-dialog')[0]?.hidden);
    byText(fake, MENU_LABELS.cancel)?.click();
    log.push(fake.byClass('confirm-dialog')[0]?.hidden);
    return log;
  }

  it('Scenario: Flujo del menú con las piezas en reserva (mismo resultado en cada paso)', () => {
    const [loadedVars, ...loaded] = menuFlow(true);
    const [fallbackVars, ...fallback] = menuFlow(false);
    expect([loadedVars, fallbackVars]).toEqual([true, false]);
    expect(fallback).toEqual(loaded);
    expect(loaded).toEqual([true, 'menu', false, true]);
  });

  it('Scenario: Compra con las piezas en reserva (oro 12 → 2 y strict-rules en nivel 1)', () => {
    styleWith(false);
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
      { resources: { gold: 12, wood: 0 } },
    );
    untilShopping(run, 1);
    const { doc, root, fake } = fakeDom();
    const shop = new ShopPanel(doc, root);
    const paint = (s: RunSnapshot) => {
      shop.sync(s.shop, { current: s.player.health, max: s.player.maxHealth });
      shop.setVisible(s.status === 'shopping');
    };
    paint(run.snapshot());
    fake.findAll((e) => e.dataset.product === 'strict-rules')[0]?.click();
    const action = shop.takeAction();
    if (action?.kind !== 'buy') throw new Error('sin compra');
    expect(run.buy(action.id).ok).toBe(true);
    paint(run.snapshot());
    expect(shop.view.gold).toBe(2);
    expect(shop.view.products.find((p) => p.id === 'strict-rules')?.level).toBe(1);
  });

  it('Scenario: Construir con las piezas en reserva (casa; panel oculto y tick n + 1)', () => {
    styleWith(false);
    const run = startWithSites(aSiteConfig(), withStock(30, 15));
    untilBuilding(run, 1);
    const n = run.snapshot().tick;
    const { doc, root, fake } = fakeDom();
    const build = new BuildPanel(doc, root, { wood: '/w.png', stone: '/s.png' });
    const paint = (s: RunSnapshot) => {
      build.sync(s);
      build.setVisible(s.status === 'building');
    };
    paint(run.snapshot());
    fake.findAll((e) => e.dataset.building === 'house')[0]?.click();
    const action = build.takeAction();
    if (action?.kind !== 'build') throw new Error('sin obra');
    expect(run.build(action.building).ok).toBe(true);
    run.tick(PlayerInput.NONE);
    const s = run.snapshot();
    paint(s);
    expect(fake.byClass('build-panel')[0]?.hidden).toBe(true);
    expect(s.sites.some((site) => site.state === 'house')).toBe(true);
    expect(s.tick).toBe(n + 1);
  });

  it('Scenario: Botones de resultados con las piezas en reserva (Exportar 1 vez; R 1 partida)', () => {
    styleWith(false);
    const { doc, root, fake } = fakeDom();
    const onExport = vi.fn();
    const panel = new ResultsPanel(doc, root, { onExport, onImport: vi.fn() });
    panel.render({ records: [], notices: [], message: null });
    byText(fake, 'Exportar')?.click();
    expect(onExport).toHaveBeenCalledTimes(1);
    // Partida terminada (bug letal encima del jugador) y R: exactamente 1 partida nueva.
    const config = lethalConfig();
    const current = new DoomedStartRun().execute(config, new Mulberry32RandomGenerator(1));
    if (!current.ok) throw new Error(current.error.message);
    playToEnd(current.value);
    expect(current.value.tickRun.status).toBe('over');
    let restarts = 0;
    const restart = new RestartRun(config, () => {
      restarts++;
      return {
        random: new Mulberry32RandomGenerator(2),
        terrain: OPEN_TERRAIN,
        stoneRandom: new Mulberry32RandomGenerator(3),
      };
    });
    const next = restart.execute(current.value.tickRun);
    expect(next.ok).toBe(true);
    expect(restarts).toBe(1);
  });
});
