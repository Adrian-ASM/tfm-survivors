import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { RunSnapshot, SheepSnapshot } from '../../src/domain/run/RunSnapshot';
import { PLACEHOLDER_TEXTURE } from '../../src/infrastructure/phaser/art/looks';
import { PickupLayer } from '../../src/infrastructure/phaser/PickupLayer';
import { SheepLayer } from '../../src/infrastructure/phaser/SheepLayer';
import { MEAT_FILE, SHEEP_BOUNCE_FILE, SHEEP_IDLE_FILE } from '../support/appearance';
import { aDefaultConfig } from '../support/builders';
import { FAKE_TINT, fakeKit, type FakeSprite } from '../support/FakeSprite';
import { randomInputs } from '../support/inputs';
import { someLooks } from '../support/looks';
import { planFor } from '../support/mapArt';
import { chooseFirstWhileOpen, startSeededRun } from '../support/runs';
import { SHEEP_AT, aSheepConfig, startWithSheep } from '../support/sheep';

// Spec sprite-rendering (0023), "Pintado de las ovejas", con dobles del motor (sin navegador).
const lamb = (
  id: number,
  x: number,
  y: number,
  over: Partial<SheepSnapshot> = {},
): SheepSnapshot => ({
  id,
  x,
  y,
  radius: 20,
  health: 12,
  state: 'graze',
  damaged: false,
  origin: { x, y },
  ...over,
});

function layer(missing: readonly string[] = [], capacity = 5) {
  const kit = fakeKit();
  const looks = someLooks(undefined, missing);
  return { l: new SheepLayer(capacity, kit, looks.sheep), created: kit.created };
}
const visible = (sprites: FakeSprite[]) => sprites.filter((s) => s.visible);

describe('SheepLayer', () => {
  it('Scenario: Oveja en pasto y en huida (idle de HappySheep_Idle; bounce de HappySheep_Bouncing, volteada)', () => {
    const run = startWithSheep(aSheepConfig(), [SHEEP_AT], { player: { x: 1150, y: 1000 } });
    const { l, created } = layer();
    const s0 = run.snapshot();
    l.sync(s0.sheep, s0.tick, 0);
    const [sprite] = visible(created);
    expect([sprite?.texture, sprite?.x, sprite?.y, sprite?.flipX]).toEqual([
      SHEEP_IDLE_FILE,
      1000,
      1000,
      false,
    ]);
    run.tick(PlayerInput.NONE);
    const s1 = run.snapshot();
    l.sync(s1.sheep, s1.tick, 17);
    expect(visible(created)).toEqual([sprite]);
    expect(sprite?.texture).toBe(SHEEP_BOUNCE_FILE);
    expect(sprite?.x).toBeCloseTo(997, 3);
    expect(sprite?.flipX).toBe(true);
    expect(l.counts.byState).toEqual({ graze: 0, wander: 0, flee: 1 });
  });

  it('Scenario: Muertes y reapariciones (5 pintadas; 2 muertas y 1 nueva: 4 visibles)', () => {
    const { l, created } = layer();
    const five = [0, 1, 2, 3, 4].map((i) => lamb(i, 100 * (i + 1), 300));
    l.sync(five, 1, 0);
    const next = [...five.filter((o) => o.id !== 1 && o.id !== 3), lamb(5, 900, 700)];
    l.sync(next, 2, 17);
    const shown = visible(created);
    expect(shown).toHaveLength(4);
    for (const o of next) expect(shown.filter((s) => s.x === o.x && s.y === o.y)).toHaveLength(1);
    expect(l.counts.visible).toBe(4);
  });

  it('Scenario: Reserva de la oveja (sin HappySheep_Bouncing: 2 discos de 40 px del color de la oveja)', () => {
    const { l, created } = layer([SHEEP_BOUNCE_FILE]);
    l.sync([lamb(0, 1000, 1000), lamb(1, 1200, 1000, { state: 'flee' })], 1, 0);
    const shown = visible(created);
    expect(shown).toHaveLength(2);
    for (const s of shown) {
      expect([s.texture, s.tint]).toEqual([PLACEHOLDER_TEXTURE, 0xf0ead6]);
      expect(s.scale * 64).toBeCloseTo(40, 6);
      expect([s.originX, s.originY]).toEqual([0.5, 0.5]);
    }
    expect(shown.map((s) => [s.x, s.y])).toEqual([
      [1000, 1000],
      [1200, 1000],
    ]);
    expect([l.counts.visible, l.counts.placeholder]).toEqual([2, 2]);
  });

  it('Scenario: Indicación de daño en una oveja (destello de T a T + 3, no en T + 4)', () => {
    const { l, created } = layer();
    const modes: number[] = [];
    const sizes: number[][] = [];
    for (let k = 0; k <= 4; k++) {
      l.sync([lamb(0, 500, 500, { damaged: k <= 3 })], 10 + k, 17 * k);
      const [s] = visible(created);
      modes.push(s?.tintMode ?? -1);
      sizes.push([s?.scale ?? 0, s?.x ?? 0, s?.y ?? 0]);
    }
    expect(modes).toEqual([
      FAKE_TINT.fill,
      FAKE_TINT.fill,
      FAKE_TINT.fill,
      FAKE_TINT.fill,
      FAKE_TINT.multiply,
    ]);
    expect(new Set(sizes.map((v) => v.join())).size).toBe(1);
  });

  it('una oveja muerta no queda visible ni deja cadáver; clear() las oculta todas', () => {
    const { l, created } = layer();
    l.sync([lamb(0, 1, 1), lamb(1, 2, 2)], 1, 0);
    l.sync([lamb(1, 2, 2)], 2, 17);
    expect(visible(created)).toHaveLength(1);
    l.clear();
    expect(visible(created)).toHaveLength(0);
    expect(l.counts).toEqual({
      visible: 0,
      placeholder: 0,
      byState: { graze: 0, wander: 0, flee: 0 },
    });
  });

  it.each([
    // 0026: 701 y 784 más los 36 objetos de los 6 solares. 0029: más la decoración (83 y 84).
    [42, 820],
    [123, 904],
  ] as const)(
    'Scenario: Ovejas fuera del plan del mapa (semilla %i: %i objetos, con y sin ovejas)',
    (seed, objects) => {
      const config = aDefaultConfig();
      const run = startSeededRun(config, seed);
      const noSheep = startSeededRun({ ...config, sheep: { ...config.sheep, maxAlive: 0 } }, seed);
      expect(run.snapshot().sheep.length).toBeGreaterThan(0);
      expect(noSheep.snapshot().sheep).toHaveLength(0);
      const plan = planFor(run.map, seed);
      expect(plan.objects).toBe(objects);
      // Sin decoración, los mismos objetos con y sin ovejas (ninguno es de una oveja).
      const zero = { maxDecor: 0 };
      expect(planFor(noSheep.map, seed, [], zero).objects).toBe(
        planFor(run.map, seed, [], zero).objects,
      );
      // La decoración no depende de dónde estén las ovejas: el plan tras moverse es el mismo.
      // (Con tope de ovejas 0 los solares se colocan en otras celdas, regla de 0026, y la decoración
      // sigue a los solares: ver incidencia de apply 0029.)
      for (let i = 0; i < 600; i++) run.tick(PlayerInput.NONE);
      expect(planFor(run.map, seed).decor).toEqual(plan.decor);
    },
  );

  it('Scenario: Pintar las ovejas no cambia la simulación (semilla 42, 1.200 ticks, con y sin hojas)', () => {
    const inputs = randomInputs(1200, 2026);
    const play = (missing: readonly string[]) => {
      const run = startSeededRun(aDefaultConfig(), 42);
      const kit = fakeKit();
      const looks = someLooks(undefined, missing);
      const sheep = new SheepLayer(5, kit, looks.sheep);
      const pickups = new PickupLayer(436, kit, looks.pickups, looks.stones);
      const snaps: RunSnapshot[] = [];
      for (const [i, input] of inputs.entries()) {
        chooseFirstWhileOpen(run);
        run.tick(input);
        const s = run.snapshot();
        sheep.sync(s.sheep, s.tick, i * 17);
        pickups.sync(s.pickups);
        snaps.push(s);
      }
      return { snaps, placeholder: sheep.counts.placeholder };
    };
    const painted = play([]);
    const fallback = play([SHEEP_IDLE_FILE, SHEEP_BOUNCE_FILE, MEAT_FILE]);
    expect(painted.placeholder).toBe(0);
    expect(fallback.placeholder).toBeGreaterThan(0);
    expect(fallback.snaps).toStrictEqual(painted.snaps);
  });
});
