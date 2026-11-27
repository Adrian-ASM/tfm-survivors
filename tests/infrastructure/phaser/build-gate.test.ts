import { describe, expect, it } from 'vitest';
import { BuildOnSite } from '../../../src/application/BuildOnSite';
import { LeaveSite } from '../../../src/application/LeaveSite';
import { TickRun } from '../../../src/application/TickRun';
import { PlayerInput } from '../../../src/domain/player/PlayerInput';
import type { RunSnapshot } from '../../../src/domain/run/RunSnapshot';
import { ManualStepper } from '../../../src/infrastructure/e2e/ManualStepper';
import {
  BuildGate,
  buildVisible,
  type BuildAction,
} from '../../../src/infrastructure/phaser/BuildGate';
import { PauseGate } from '../../../src/infrastructure/phaser/PauseGate';
import { pressedOnce } from '../../../src/infrastructure/dom/TouchBar';
import { playScreen } from '../../../src/infrastructure/phaser/ShopGate';
import { BuildPanel } from '../../../src/infrastructure/dom/BuildPanel';
import { TICK_MS } from '../../support/builders';
import { fakeDom, type FakeElement } from '../../support/fakeDom';
import { aSiteConfig, startWithSites, withStock } from '../../support/sites';

// Spec build-sites 0026 "Panel de obra", main-menu "Pausa con Esc" y simulation-loop "Step en obra":
// la escena pasa Esc y la acción del panel a `BuildGate` antes que a `PauseGate`, y luego un frame a
// `TickRun`. Se reproduce ese orden sin motor (patrón de shop-gate.test).

/** Partida en obra desde el tick 1 con sus casos de uso y las puertas de la escena. */
function scene(wood = 30, stone = 15) {
  const run = startWithSites(aSiteConfig(), withStock(wood, stone));
  const tickRun = new TickRun(run);
  const uc = { buildOnSite: new BuildOnSite(run), leaveSite: new LeaveSite(run) };
  const buildGate = new BuildGate();
  const pause = new PauseGate();
  let last: RunSnapshot = tickRun.execute(TICK_MS, PlayerInput.NONE);
  const screens: string[] = [];
  const frame = (esc: boolean, action: BuildAction = null): RunSnapshot => {
    const site = buildGate.step(esc, action, last.status, uc);
    if (site.snapshot) last = site.snapshot;
    pause.step(site.esc, null, last.status, tickRun);
    last = pause.frame(tickRun, TICK_MS, PlayerInput.of(1, 0), 1);
    screens.push(playScreen(last.status, pause.paused));
    return last;
  };
  return { run, frame, pause, screens, first: last };
}

describe('BuildGate (build-sites y main-menu 0026)', () => {
  it('Scenario: Clic en la casa (1 frame: en curso, madera 15, piedra 15, casa y tick n + 1)', () => {
    const { frame, first, pause } = scene();
    expect([first.status, playScreen(first.status, false)]).toEqual(['building', 'build']);

    const s = frame(false, { kind: 'build', building: 'house' });

    expect([s.status, s.tick, s.sites[0]?.state]).toEqual(['running', first.tick + 1, 'house']);
    expect([s.resources.wood, s.resources.stone]).toEqual([15, 15]);
    expect(buildVisible(s.status, pause.paused)).toBe(false);
  });

  it.each<[string, boolean, BuildAction]>([
    ['Esc', true, null],
    ['el botón Salir', false, { kind: 'leave' }],
  ])(
    'Scenario: Salir con Esc o con el botón (%s: tick n + 1, libre, sin pausa)',
    (_n, esc, act) => {
      const { frame, first, pause, screens } = scene();

      const s = frame(esc, act);

      expect([s.status, s.tick, s.sites[0]?.state, pause.paused]).toEqual([
        'running',
        first.tick + 1,
        'free',
        false,
      ]);
      expect(screens).not.toContain('paused');
    },
  );

  it('Scenario: Esc en la obra (mantenida 60 frames: sale y no pausa; otra pulsación pausa)', () => {
    const { frame, pause, screens, run } = scene();

    frame(true);
    for (let i = 0; i < 59; i++) frame(false);
    expect([pause.paused, screens.includes('paused'), run.snapshot().sites[0]?.state]).toEqual([
      false,
      false,
      'free',
    ]);

    frame(true);

    expect(pause.paused).toBe(true);
  });

  it('Scenario: Panel con la torre no asequible (clic en la torre: sin caso de uso, sigue en obra)', () => {
    const { frame, first } = scene(30, 14);
    const { doc, root, fake } = fakeDom();
    const panel = new BuildPanel(doc, root, { wood: 'w.png', stone: 's.png' });
    panel.sync(first);
    panel.setVisible(true);
    const tower = (fake.children[0] as FakeElement).findAll((e) => e.dataset.building === 'tower');
    tower[0]?.click();

    const s = frame(false, panel.takeAction());

    expect([s.status, s.tick, s.sites[0]?.state]).toEqual(['building', first.tick, 'free']);
    expect([s.resources.wood, s.resources.stone]).toEqual([30, 14]);
  });

  it('el movimiento no llega a la simulación con el panel: 0 ticks por frame', () => {
    const { frame, first } = scene();
    const s = Array.from({ length: 600 }, () => frame(false)).at(-1);
    expect([s?.tick, s?.status, s?.player.x]).toEqual([first.tick, 'building', first.player.x]);
  });

  it('Scenario: Sin panel fuera de la obra (en curso, eligiendo, en tienda, en pausa, terminada)', () => {
    expect(buildVisible('running', false)).toBe(false);
    expect(buildVisible('choosing', false)).toBe(false);
    expect(buildVisible('shopping', false)).toBe(false);
    expect(buildVisible('building', true)).toBe(false);
    expect(buildVisible('over', false)).toBe(false);
    expect([buildVisible('building', false), playScreen('building', false)]).toEqual([
      true,
      'build',
    ]);
  });
});

describe('ManualStepper con la obra (simulation-loop 0026)', () => {
  it('Scenario: Step en obra (abre en el 3.er tick: step(10) = 3 y step(5) = 0)', async () => {
    // Desde g = 4 bajo la cara inferior, hacia arriba a 1 px por tick: la primera g ≤ ε (1) es la
    // del tick 3.
    const run = startWithSites(aSiteConfig(), {
      ...withStock(15),
      player: { x: 1260, y: 740 },
    });
    const tickRun = new TickRun(run);
    const gate = new PauseGate();
    const stepper = new ManualStepper();
    const frame = () => {
      const plan = stepper.plan(() => PlayerInput.of(0, -1));
      const r = gate.manualFrame(tickRun, plan.ticks, plan.input);
      stepper.served(r.ticks, tickRun.status === 'running');
      stepper.afterRender();
    };
    const step = async (n: number) => {
      const p = stepper.request(n);
      for (let i = 0; i < 5; i++) frame();
      return p;
    };

    const first = await step(10);
    const second = await step(5);

    expect([first, second, run.snapshot().tick, run.status]).toEqual([3, 0, 3, 'building']);
  });
});

// Spec touch-controls (0033), "Barra táctil": ⏸ es una pulsación de Esc (`pressedOnce` con Esc).
describe('BuildGate con ⏸ (0033)', () => {
  it('Scenario: ⏸ en la tienda y en la obra (obra: sale, solar libre, sin pausa; otro ⏸ pausa)', () => {
    const { frame, pause, screens, run } = scene();

    const left = frame(pressedOnce(false, true));
    const sawPause = screens.includes('paused');
    frame(pressedOnce(false, true));

    expect([left.status, left.sites[0]?.state, sawPause]).toEqual(['running', 'free', false]);
    expect(run.snapshot().sites[0]?.state).toBe('free');
    expect(pause.paused).toBe(true);
  });
});

// Spec build-sites (0036), "Panel de obra" y "Explicación de los edificios en el panel de obra": la
// × y las filas del panel real pasan por `BuildGate` como en la escena. Sin hoja de estilos en Node
// (piezas en reserva).
describe('La × y el icono del edificio en la obra (build-sites 0036)', () => {
  const ABOUT = {
    icons: {
      house: { url: '/tfm-survivors/assets/h.png', width: 128, height: 192 },
      tower: { url: '/tfm-survivors/assets/t.png', width: 128, height: 256 },
    },
    texts: { house: '+1 oro cada 30 s', tower: 'Dispara flechas a los enemigos cercanos' },
  };

  function withPanel(wood = 30, stone = 15) {
    const s = scene(wood, stone);
    const { doc, root, fake, fakeDoc } = fakeDom();
    const panel = new BuildPanel(doc, root, { wood: 'w.png', stone: 's.png' }, ABOUT);
    const paint = (snap: RunSnapshot) => {
      panel.sync(snap);
      panel.setVisible(buildVisible(snap.status, s.pause.paused));
    };
    paint(s.first);
    const section = fake.byClass('build-panel')[0] as FakeElement;
    const row = (kind: string) =>
      section.findAll((e) => e.dataset.building === kind)[0] as FakeElement;
    const frame = (esc = false) => {
      const snap = s.frame(esc, panel.takeAction());
      paint(snap);
      return snap;
    };
    const x = () => section.byClass('ui-close')[0] as FakeElement;
    return { ...s, panel, section, row, frame, x, fakeDoc };
  }

  it('Scenario: Salir con Esc o con la × (mismo snapshot campo a campo)', () => {
    const esc = withPanel();
    const byEsc = esc.frame(true);
    const click = withPanel();
    click.x().click();
    const byX = click.frame();

    expect(byX).toEqual(byEsc);
    expect([byX.status, byX.tick, byX.sites[0]?.state]).toEqual([
      'running',
      click.first.tick + 1,
      'free',
    ]);
    expect([click.section.hidden, click.screens.includes('paused')]).toEqual([true, false]);
    expect(click.section.contains(click.fakeDoc.activeElement)).toBe(false);
  });

  it('Scenario: Panel sin nada asequible (la × está activa y sale de la obra)', () => {
    const s = withPanel(10, 0);
    expect(['house', 'tower'].map((k) => s.row(k).getAttribute('disabled'))).toEqual(['', '']);
    expect(s.x().getAttribute('disabled')).toBeNull();
    s.x().click();
    const snap = s.frame();
    expect([snap.status, snap.sites[0]?.state, s.section.hidden]).toEqual([
      'running',
      'free',
      true,
    ]);
  });

  it('Scenario: Clic en el icono de la casa (construye: casa y tick n + 1)', () => {
    const s = withPanel();
    s.row('house').byClass('build-panel__icon')[0]?.clickBubbling();
    const snap = s.frame();
    expect([s.section.hidden, snap.sites[0]?.state, snap.tick]).toEqual([
      true,
      'house',
      s.first.tick + 1,
    ]);
  });

  it('Scenario: Explicación en una fila no asequible (clic en imagen y explicación de la torre)', () => {
    const s = withPanel(10, 0);
    const tower = s.row('tower');
    tower.byClass('build-panel__icon')[0]?.clickBubbling();
    tower.byClass('build-panel__about')[0]?.clickBubbling();
    expect(s.panel.takeAction()).toBeNull();
    const snap = s.frame();
    expect([snap.status, snap.tick, snap.sites[0]?.state]).toEqual([
      'building',
      s.first.tick,
      'free',
    ]);
  });

  it('Scenario: Construir con las piezas en reserva (clic en la casa y 1 frame)', () => {
    const s = withPanel();
    s.row('house').click();
    const snap = s.frame();
    expect([s.section.hidden, snap.sites[0]?.state, snap.tick]).toEqual([
      true,
      'house',
      s.first.tick + 1,
    ]);
  });
});
