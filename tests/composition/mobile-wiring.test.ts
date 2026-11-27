import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MOBILE_ACTIVE_POINTERS,
  MOBILE_CLASS,
  wireMobile,
  type MobileEnv,
} from '../../src/composition/mobileWiring';
import type { FullscreenLike } from '../../src/infrastructure/dom/FullscreenControl';
import { TOUCH_LABELS } from '../../src/infrastructure/dom/TouchBar';
import { DEFAULT_MOBILE } from '../support/builders';
import { fakeDom, type FakeElement } from '../support/fakeDom';
import { HUD_METRICS } from '../support/hud';

// Spec mobile-display y touch-controls (0033), cableado de la composición (design §1, §4 y §5).
const WITH_API: FullscreenLike = {
  enabled: true,
  element: null,
  request: () => Promise.resolve(),
  exit: () => Promise.resolve(),
};
const WITHOUT_API: FullscreenLike = { enabled: false, element: null };

function env(fullscreen = WITH_API) {
  const { doc, root, fake } = fakeDom();
  const classes = new Map<string, boolean>();
  const e: MobileEnv = {
    doc,
    root,
    classes: { toggle: (token, force) => classes.set(token, force) },
    fullscreen,
    hud: HUD_METRICS,
  };
  return { e, fake, classes };
}

const all = (root: FakeElement): FakeElement[] => root.findAll(() => true);

describe('wireMobile (0033)', () => {
  it('Scenario: Sin controles táctiles en escritorio (ningún nodo, ni dependencias, ni clase)', () => {
    const { e, fake, classes } = env();

    const setup = wireMobile(false, DEFAULT_MOBILE, e);

    expect(fake.children).toEqual([]);
    expect(setup.sceneDeps).toEqual({});
    expect(setup.input).toBeUndefined();
    expect([setup.on, setup.viewport.mobile, classes.get(MOBILE_CLASS)]).toEqual([
      false,
      false,
      false,
    ]);
    setup.orient({ width: 600, height: 900 });
    expect(fake.children).toEqual([]);
  });

  it('con modo móvil: clase, barra, aviso, dos punteros y las tres dependencias de la escena', () => {
    const { e, fake, classes } = env();

    const setup = wireMobile(true, DEFAULT_MOBILE, e);

    expect(classes.get(MOBILE_CLASS)).toBe(true);
    expect(fake.children.map((c) => c.className)).toEqual(['touch-bar', 'rotate-notice']);
    expect(setup.input).toEqual({ activePointers: MOBILE_ACTIVE_POINTERS });
    expect(MOBILE_ACTIVE_POINTERS).toBe(2);
    expect(Object.keys(setup.sceneDeps).sort()).toEqual(['frameRule', 'hold', 'touch']);
    expect(setup.sceneDeps.touch?.joystick).toEqual(DEFAULT_MOBILE.joystick);
  });

  it('Scenario: Barra en el menú (⛶ solo si el navegador ofrece la pantalla completa)', () => {
    const withApi = env(WITH_API);
    const withoutApi = env(WITHOUT_API);
    wireMobile(true, DEFAULT_MOBILE, withApi.e);
    wireMobile(true, DEFAULT_MOBILE, withoutApi.e);
    const fs = (f: FakeElement) =>
      f.findAll((el) => el.getAttribute('aria-label') === TOUCH_LABELS.fullscreen);

    expect(fs(withApi.fake)).toHaveLength(1);
    expect(fs(withoutApi.fake)).toHaveLength(0);
  });

  it('Scenario: Girar en mitad de la partida (vertical: aviso y retención; cuadrada: no)', () => {
    const { e, fake } = env();
    const setup = wireMobile(true, DEFAULT_MOBILE, e);
    const notice = fake.byClass('rotate-notice')[0];
    const hold = setup.sceneDeps.hold ?? (() => null);

    setup.orient({ width: 390, height: 844 });
    const portrait = [notice?.hidden, hold()];
    setup.orient({ width: 500, height: 500 });
    const square = [notice?.hidden, hold()];
    setup.orient({ width: 844, height: 390 });

    expect(portrait).toEqual([false, true]);
    expect(square).toEqual([true, false]);
    expect([notice?.hidden, hold()]).toEqual([true, false]);
  });

  it('Scenario: Escala DOM sin crecer en pantallas grandes (2.560 × 1.440: móvil 1, escritorio ≥ 2)', () => {
    const mobile = wireMobile(true, DEFAULT_MOBILE, env().e);
    const desktop = wireMobile(false, DEFAULT_MOBILE, env().e);
    const big = { width: 2560, height: 1440 };

    expect(mobile.domFrame(big).uiScale).toBe(1);
    expect(desktop.domFrame(big).uiScale).toBeGreaterThanOrEqual(2);
  });

  it('Scenario: Sin estilos inline (ningún nodo propio con atributo style)', () => {
    const { e, fake } = env();
    const setup = wireMobile(true, DEFAULT_MOBILE, e);
    setup.orient({ width: 390, height: 844 });
    setup.sceneDeps.touch?.bar.sync({ inRun: true, ended: true });

    expect(all(fake).filter((el) => el.getAttribute('style') !== null)).toEqual([]);
  });

  it('Scenario: Sin estilos inline (el código táctil no escribe estilos: solo clases y hidden)', () => {
    const root = join(import.meta.dirname, '..', '..', 'src');
    const files = [
      'composition/mobileWiring.ts',
      'infrastructure/dom/TouchBar.ts',
      'infrastructure/dom/RotateNotice.ts',
      'infrastructure/dom/FullscreenControl.ts',
      'infrastructure/dom/touchIcons.ts',
    ];
    const hits = files.filter((f) =>
      /\.style\b|['"]style['"]|cssText/.test(readFileSync(join(root, f), 'utf8')),
    );
    expect(hits).toEqual([]);
  });
});
