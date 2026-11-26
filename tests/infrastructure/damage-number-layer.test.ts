import { describe, expect, it } from 'vitest';
import type { HitSnapshot, RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { DamageNumberLayer } from '../../src/infrastructure/phaser/DamageNumberLayer';
import { LINTER, TICK_MS, aStillType } from '../support/builders';
import { aHitConfig, untilHit } from '../support/combat';
import { REPO_COMBAT, aHit, fakeTexts, shown } from '../support/feedback';
import { aBehaviorConfig, startRun, ticks } from '../support/runs';

// Spec sprite-rendering (0031), "Números de daño", con dobles de `Text` y los datos del repositorio.
const C = REPO_COMBAT.colors;

function layer() {
  const texts = fakeTexts();
  return { texts, numbers: new DamageNumberLayer(texts.make, REPO_COMBAT) };
}

const visibleIds = (made: ReturnType<typeof fakeTexts>['made']) =>
  shown(made).map((t) => Number(t.text));

describe('Números de daño (sprite-rendering 0031)', () => {
  it('Scenario: Número de un golpe a un enemigo', () => {
    const { texts, numbers } = layer();
    const hits = [aHit(0, 'enemy', 6)];
    numbers.sync(hits, 5000);
    const [n] = shown(texts.made);
    expect([n?.text, n?.tint, n?.x, n?.y, n?.alpha]).toEqual(['6', C.enemy, 1000, 980, 1]);
    expect([n?.originX, n?.originY]).toEqual([0.5, 0.5]);
    numbers.sync(hits, 5400);
    expect([n?.x, n?.y, n?.alpha]).toEqual([1000, 964, 0.5]);
    numbers.sync(hits, 5800);
    expect(shown(texts.made)).toEqual([]);
    expect(numbers.counts).toMatchObject({ enemy: 0, created: 1 });
  });

  it('Scenario: Color por clase', () => {
    const { texts, numbers } = layer();
    const hits: HitSnapshot[] = [
      aHit(0, 'enemy', 6),
      aHit(1, 'structure', 4),
      aHit(2, 'sheep', 12),
      aHit(3, 'player', 25),
    ];
    numbers.sync(hits, 0);
    expect(shown(texts.made).map((t) => [t.text, t.tint])).toEqual([
      ['6', C.enemy],
      ['4', C.structure],
      ['12', C.sheep],
      ['25', C.player],
    ]);
    expect(C.player >> 16).toBeGreaterThanOrEqual(192);
    expect(numbers.counts).toEqual({ enemy: 1, structure: 1, sheep: 1, player: 1, created: 4 });
  });

  it('Scenario: Golpe letal visible', () => {
    const run = startRun(aHitConfig([LINTER]), {
      player: { x: 1200, y: 1000 },
      enemies: [{ type: 'goblin-torch', x: 1000, y: 1000, health: 4 }],
    });
    const s = untilHit(run);
    expect(s.enemies).toEqual([]);
    const { texts, numbers } = layer();
    numbers.sync(s.hits, 0);
    expect(shown(texts.made).map((t) => [t.text, t.tint, t.x, t.y + 20])).toEqual([
      ['4', C.enemy, 1000, 1000],
    ]);
  });

  it('Scenario: Sin número con el jugador invulnerable', () => {
    const at = { x: 1000, y: 1000 };
    const config = aBehaviorConfig([aStillType({ id: 'hitter', damage: 10 })]);
    const run = startRun(config, { player: at, enemies: [{ type: 'hitter', ...at }] });
    const [t, ...after] = ticks(run, 31);
    const { numbers } = layer();
    numbers.sync(t?.hits ?? [], 0);
    expect(numbers.counts.player).toBe(1);
    after.forEach((s, i) => {
      numbers.sync(s.hits, (i + 1) * TICK_MS);
    });
    expect(numbers.counts.created).toBe(1);
  });

  it('Scenario: Mismo snapshot pintado varias veces', () => {
    const { texts, numbers } = layer();
    const hits = [aHit(0, 'enemy', 6), aHit(1, 'enemy', 4), aHit(2, 'sheep', 12)];
    const poses: string[] = [];
    for (let i = 0; i < 60; i++) {
      numbers.sync(hits, 1000);
      poses.push(JSON.stringify(shown(texts.made).map((t) => [t.x, t.y, t.alpha])));
    }
    expect(new Set(poses).size).toBe(1);
    expect(shown(texts.made)).toHaveLength(3);
    expect(texts.made.reduce((n, t) => n + t.setTexts, 0)).toBe(3);
    numbers.sync(hits, 1000 + TICK_MS);
    expect(numbers.counts.created).toBe(3);
    numbers.sync([...hits, aHit(3, 'enemy', 6)], 1000 + 2 * TICK_MS);
    expect(numbers.counts.created).toBe(4);
  });

  it('Scenario: Un golpe en varios snapshots', () => {
    const { numbers } = layer();
    const g = aHit(0, 'enemy', 6, 1000, 1000, 100);
    const created: number[] = [];
    for (let k = 100; k <= 114; k++) {
      numbers.sync([g], (k - 100) * TICK_MS);
      created.push(numbers.counts.created);
    }
    expect(created).toEqual(created.map(() => 1));
  });

  it('Scenario: Pool lleno', () => {
    const { texts, numbers } = layer();
    const first = Array.from({ length: 48 }, (_, i) => aHit(i, 'enemy', i + 1));
    numbers.sync(first, 0);
    numbers.sync([...first.slice(1), aHit(48, 'enemy', 49)], 10);
    const live = visibleIds(texts.made).sort((a, b) => a - b);
    expect(live).toEqual(Array.from({ length: 48 }, (_, i) => i + 2));
    expect(texts.made).toHaveLength(48);
  });

  it('Scenario: Más golpes nuevos que el pool en un frame', () => {
    const { texts, numbers } = layer();
    const sixty = Array.from({ length: 60 }, (_, i) => aHit(i, 'enemy', i + 1));
    numbers.sync(sixty, 0);
    const live = visibleIds(texts.made).sort((a, b) => a - b);
    expect(live).toEqual(Array.from({ length: 48 }, (_, i) => i + 13));
    expect(numbers.counts).toMatchObject({ enemy: 48, created: 48 });
  });

  it('Scenario: Números congelados en pausa', () => {
    const { texts, numbers } = layer();
    const hits = [aHit(0, 'enemy', 6)];
    numbers.sync(hits, 1000);
    numbers.sync(hits, 1200);
    for (let i = 0; i < 60; i++) {
      numbers.sync(hits, 1200);
      const [n] = shown(texts.made);
      expect(n?.y).toBeCloseTo(1000 - 28, 6);
      expect(n?.alpha).toBeCloseTo(0.75, 6);
    }
    numbers.sync(hits, 1200 + 16.667);
    const [n] = shown(texts.made);
    expect(1 - (n?.alpha ?? 0)).toBeCloseTo(216.667 / 800, 6);
  });

  it('Scenario: Números con avance manual', () => {
    const { texts, numbers } = layer();
    const hits = [aHit(0, 'enemy', 6)];
    const r0 = 3000;
    numbers.sync(hits, r0);
    const after30 = r0 + 30 * TICK_MS;
    numbers.sync(hits, after30);
    expect(after30 - r0).toBeCloseTo(500, 3);
    expect(shown(texts.made)[0]?.alpha).toBeCloseTo(0.375, 6);
    numbers.sync(hits, after30 + 18 * TICK_MS);
    expect(shown(texts.made)).toEqual([]);
  });

  it('Scenario: Destello y número del mismo impacto (números del golpe)', () => {
    const run = startRun(aHitConfig([LINTER]), {
      player: { x: 1200, y: 1000 },
      enemies: [{ type: 'goblin-torch', x: 1000, y: 1000 }],
    });
    const t: RunSnapshot = untilHit(run);
    const frames = [t, ...ticks(run, 4)];
    const { texts, numbers } = layer();
    frames.forEach((s, i) => {
      numbers.sync(s.hits, i * TICK_MS);
    });
    expect(frames.map((s) => s.enemies[0]?.damaged)).toEqual([true, true, true, true, false]);
    expect(numbers.counts.created).toBe(1);
    expect(shown(texts.made).map((x) => [x.text, x.tint])).toEqual([['6', C.enemy]]);
  });
});
