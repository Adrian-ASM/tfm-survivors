import { describe, expect, it } from 'vitest';
import { Run, type RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import {
  aDefaultConfig,
  aRunConfig,
  aSegment,
  aStillType,
  aWavesConfig,
  withDuration,
  withMeat,
  withPlayer,
  withExtraTypes,
  withScenarioCurve,
} from '../support/builders';
import { CountingRandom } from '../support/random';
import { aContactConfig, aProbeType, startRun, ticks } from '../support/runs';
import { withPlayerStat } from '../support/upgrades';

const CENTER = { x: 480, y: 270 };

/** Contenido por defecto (curva 5/5) sin oleadas: con el mapa vacío, nada a lo que disparar. */
const quiet = (patch: Partial<RunConfig> = {}): RunConfig => ({
  ...withScenarioCurve(aDefaultConfig()),
  waves: aWavesConfig({ segments: [aSegment(['goblin-torch'], 0)] }).waves,
  ...patch,
});

/** `quiet` con un tipo más (`still` de daño 10 o el perseguidor de daño 10). */
const withType = (config: RunConfig, type = aStillType({ damage: 10 })): RunConfig =>
  withExtraTypes(config, type);

const meatAt = (x: number, y: number, value = 1, attracted = false) => ({
  kind: 'meat' as const,
  x,
  y,
  value,
  attracted,
});

/** Partida `quiet` con el jugador en el centro con `health` de vida y estos recogibles. */
type Gems = NonNullable<RunSetup['gems']>;

const healing = (health: number, gems: Gems, config = quiet(), extra: RunSetup = {}) =>
  startRun(config, { player: { ...CENTER, health }, gems, ...extra });

const healthAfter = (run: ReturnType<typeof startRun>, n = 1) => ticks(run, n).at(-1)?.player;

// Spec player-health (0023), "Curación por carne".
describe('Curación por carne (spec player-health)', () => {
  it('Scenario: Curación del 20 % (50 de 100 → 70)', () => {
    const p = healthAfter(healing(50, [meatAt(CENTER.x, CENTER.y)]));
    expect([p?.health, p?.maxHealth]).toEqual([70, 100]);
  });

  it('Scenario: Tope en la vida máxima (90 → 100, no 110)', () => {
    expect(healthAfter(healing(90, [meatAt(CENTER.x, CENTER.y)]))?.health).toBe(100);
  });

  it('Scenario: Relativa a la vida máxima efectiva (guardrail 2: 100 de 140 → 128)', () => {
    const run = healing(100, [meatAt(CENTER.x, CENTER.y)], quiet(), {
      upgrades: { guardrail: 2 },
    });
    expect(run.snapshot().player).toMatchObject({ health: 100, maxHealth: 140 });
    expect(healthAfter(run)?.health).toBe(128);
  });

  it('Scenario: Redondeo hacia abajo y mínimo 1 (15 % de 110 → 16; 1 % de 60 → 1)', () => {
    const c15 = withPlayer(withMeat(quiet(), { healPercent: 15 }), { maxHealth: 110 });
    const c1 = withPlayer(withMeat(quiet(), { healPercent: 1 }), { maxHealth: 60 });
    expect(healthAfter(healing(50, [meatAt(CENTER.x, CENTER.y)], c15))?.health).toBe(66);
    expect(healthAfter(healing(10, [meatAt(CENTER.x, CENTER.y)], c1))?.health).toBe(11);
  });

  it('Scenario: Pieza acumulada por el tope (valor 3: 20 → 80; 50 → 100)', () => {
    expect(healthAfter(healing(20, [meatAt(CENTER.x, CENTER.y, 3)]))?.health).toBe(80);
    expect(healthAfter(healing(50, [meatAt(CENTER.x, CENTER.y, 3)]))?.health).toBe(100);
  });

  it('Scenario: Dos piezas en el mismo tick (30 → 70)', () => {
    const two = [meatAt(CENTER.x, CENTER.y), meatAt(CENTER.x + 5, CENTER.y)];
    expect(healthAfter(healing(30, two))?.health).toBe(70);
  });

  it('Scenario: Golpe y curación en el mismo tick (30 − 10 + 20 = 40, invulnerable)', () => {
    const run = healing(30, [meatAt(CENTER.x, CENTER.y)], withType(quiet()), {
      enemies: [{ type: 'still', ...CENTER }],
    });
    expect(healthAfter(run)).toMatchObject({ health: 40, invulnerable: true });
  });

  it('Scenario: La carne no resucita (10 − 10 = 0, derrota y la carne sigue)', () => {
    const run = healing(10, [meatAt(CENTER.x, CENTER.y)], withType(quiet()), {
      enemies: [{ type: 'still', ...CENTER }],
    });
    const [s] = ticks(run, 1);
    expect(s?.player.health).toBe(0);
    expect(s).toMatchObject({ status: 'over', outcome: 'lost' });
    expect(s?.pickups.map((p) => p.kind)).toEqual(['meat']);
  });

  /** Carne atraída a 738 px: se recogería en el tick 120 (738 − 6 · 120 < 21 ≤ 738 − 6 · 119). */
  const incoming = [meatAt(CENTER.x + 738, CENTER.y, 1, true)];

  it('control: con la duración por defecto la carne se recoge en el tick 120 (50 → 70)', () => {
    const snaps = ticks(healing(50, incoming), 120);
    expect(snaps[118]?.player.health).toBe(50);
    expect(snaps[119]?.player.health).toBe(70);
  });

  it('Scenario: Sin curación en el tick de la victoria (vida 50 y la carne sigue)', () => {
    const snaps = ticks(healing(50, incoming, withDuration(quiet(), 2)), 120);
    const last = snaps[119];
    expect(last).toMatchObject({ status: 'over', outcome: 'won' });
    expect(last?.player.health).toBe(50);
    expect(last?.pickups.map((p) => p.kind)).toEqual(['meat']);
  });

  it('Scenario: La curación no cambia la invulnerabilidad (60 → 80 en el 20, 70 en el 41)', () => {
    // Perseguidor de 1 px/tick a 35,5 px: contacto (< 26) desde el tick 10 y ya sin separarse.
    const chaser = aProbeType({ id: 'chaser', speed: 60, damage: 10, health: 1e6 });
    const c = withType(quiet(), chaser);
    const enemies = [{ type: 'chaser', x: CENTER.x + 35.5, y: CENTER.y }];
    // Carne atraída a 138 px del otro lado: se recoge en el tick 20 (138 − 120 < 21 ≤ 138 − 114).
    const meat = [meatAt(CENTER.x - 138, CENTER.y, 1, true)];
    const withMeatRun = ticks(healing(70, meat, c, { enemies }), 41);
    const without = ticks(healing(70, [], c, { enemies }), 41);
    const hp = (i: number) => withMeatRun[i - 1]?.player.health;
    expect([hp(9), hp(10), hp(19), hp(20), hp(40), hp(41)]).toEqual([70, 60, 60, 80, 80, 70]);
    const marks = (snaps: typeof without) => snaps.slice(9).map((s) => s.player.invulnerable);
    expect(marks(withMeatRun)).toEqual(marks(without));
    expect(marks(without)[0]).toBe(true);
  });
});

// Spec xp-gems (0023), "Carne como recogible" y "Recogida de gemas".
describe('Carne como recogible (spec xp-gems)', () => {
  it('Scenario: Mismo imán para la carne (538 tras el 1, 502 tras el 7, recogida en el 8)', () => {
    const run = startRun(aRunConfig(), { player: CENTER, gems: [meatAt(544, 270)] });
    const snaps = ticks(run, 8);
    expect(snaps[0]?.pickups[0]?.x).toBeCloseTo(538, 3);
    expect(snaps[6]?.pickups[0]?.x).toBeCloseTo(502, 3);
    expect(snaps[7]?.pickups).toEqual([]);
  });

  it('Scenario: Carne fuera del radio (a 129 px durante 36.000 ticks: vida 50)', () => {
    const run = healing(50, [meatAt(609, 270)]);
    const last = ticks(run, 36_000).at(-1);
    expect(last?.pickups.map((p) => [p.kind, p.x, p.y])).toEqual([['meat', 609, 270]]);
    expect(last?.player.health).toBe(50);
  });

  it('Scenario: Efecto según el tipo (gold 12, wood 3 y meat 1: oro 12, madera 3, vida 70)', () => {
    const run = healing(50, [
      { kind: 'gold', x: 500, y: 270, value: 12 },
      { kind: 'wood', x: 500, y: 270, value: 3 },
      meatAt(500, 270),
    ]);
    const [s] = ticks(run, 1);
    expect(s?.pickups).toEqual([]);
    expect(s?.resources).toEqual({ gold: 12, wood: 3, stone: 0 });
    expect(s?.player.health).toBe(70);
    expect(s?.progression).toMatchObject({ level: 1, xp: 0, pendingLevelUps: 0 });
  });

  it('Scenario: Carne con la vida llena (desaparece y la vida sigue en 100)', () => {
    const run = startRun(quiet(), { player: CENTER, gems: [meatAt(490, 270)] });
    const [s] = ticks(run, 1);
    expect(s?.pickups).toEqual([]);
    expect(s?.player.health).toBe(100);
  });

  it('Scenario: Tipos del snapshot (meat con su tipo, valor, posición, radio 5 e id)', () => {
    const run = healing(100, [
      { x: 1000, y: 900, value: 2 },
      { kind: 'gold', x: 1100, y: 900, value: 8 },
      { kind: 'wood', x: 1200, y: 900, value: 3 },
      meatAt(1300, 900),
    ]);
    expect(run.snapshot().pickups.at(-1)).toEqual({
      id: 3,
      kind: 'meat',
      value: 1,
      x: 1300,
      y: 900,
      radius: 5,
    });
    expect(run.snapshot().gems.map((g) => g.id)).toEqual([0]);
  });

  it('Scenario: Recogibles de varios tipos en el snapshot (w1, o1, m1, w2 tras recoger g1)', () => {
    const run = healing(100, [
      { kind: 'wood', x: 1000, y: 900, value: 1 },
      { ...CENTER, value: 1 },
      { kind: 'gold', x: 1100, y: 900, value: 2 },
      meatAt(1150, 900),
      { kind: 'wood', x: 1200, y: 900, value: 1 },
    ]);
    const [s] = ticks(run, 1);
    expect(s?.pickups.map((p) => [p.id, p.kind, p.value, p.radius])).toEqual([
      [0, 'wood', 1, 5],
      [2, 'gold', 2, 5],
      [3, 'meat', 1, 5],
      [4, 'wood', 1, 5],
    ]);
  });
});

describe('Azar de la carne (spec xp-gems y simulation-loop)', () => {
  const busy = (): RunConfig => ({
    ...quiet(),
    waves: aContactConfig({ segments: [aSegment(['goblin-torch'], 5)] }).waves,
  });
  const compare = (extra: Gems, health = 100) => {
    const a = new CountingRandom(new Mulberry32RandomGenerator(9));
    const b = new CountingRandom(new Mulberry32RandomGenerator(9));
    ticks(startRun(busy(), { player: { ...CENTER, health } }, a), 400);
    ticks(startRun(busy(), { player: { ...CENTER, health }, gems: extra }, b), 400);
    return [a.calls, b.calls];
  };

  it('Scenario: La carne no consume azar (4 meat más y 1 recogida)', () => {
    const extra = [
      ...Array.from({ length: 4 }, (_, i) => meatAt(20 + i, 20)),
      meatAt(CENTER.x, CENTER.y),
    ];
    const [a, b] = compare(extra);
    expect(a).toBeGreaterThan(0);
    expect(b).toBe(a);
  });

  it('Scenario: La curación no consume azar (2 meat que curan en el tick 1)', () => {
    const [a, b] = compare([meatAt(CENTER.x, CENTER.y), meatAt(CENTER.x, CENTER.y)], 40);
    expect(a).toBeGreaterThan(0);
    expect(b).toBe(a);
  });
});

describe('Vida inicial de RunSetup (escenarios de curación)', () => {
  it('fija la vida actual sin cambiar la máxima', () => {
    expect(healing(37, []).snapshot().player).toMatchObject({ health: 37, maxHealth: 100 });
  });

  it.each([0, 101, 12.5, Number.NaN])(
    'rechaza una vida fuera de [1, máx] o no entera (%s)',
    (h) => {
      const setup = { player: { ...CENTER, health: h } };
      const r = Run.start(quiet(), new Mulberry32RandomGenerator(1), setup);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.field).toBe('setup.player.health');
    },
  );
});

// Spec player-health (0024), "Curación por carne": curación efectiva = contenido + meatHealPercent.
describe('Carne con meatHealPercent (0024)', () => {
  it('Scenario: Carne con la mejora del cazador (50 de 100, 20 % + 10: 80)', () => {
    const config = withPlayerStat(withMeat(quiet(), { healPercent: 20 }), 'hunter', 10);
    const run = healing(50, [meatAt(CENTER.x, CENTER.y)], config, { upgrades: { hunter: 1 } });

    expect(healthAfter(run)?.health).toBe(80);
  });
});
