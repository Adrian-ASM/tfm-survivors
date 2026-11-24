import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import type { RingSprite } from '../../src/infrastructure/phaser/PulseLayer';
import { emptyCounts } from '../../src/infrastructure/phaser/renderCounts';
import { RenderLayers } from '../../src/infrastructure/phaser/RenderLayers';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { aDefaultConfig, withPlayer } from '../support/builders';
import { fakeKit } from '../support/FakeSprite';
import { someLooks } from '../support/looks';
import { chooseFirstWhileOpen, startRun } from '../support/runs';

// Specs run-results ("Primer frame tras reiniciar", "Cinco reinicios seguidos") y sprite-rendering
// ("R con cadáveres en curso", "Sonda en el menú") sobre `RenderLayers` (change 0012).
const FRAME_MS = 16.667;

class FakeRing implements RingSprite {
  visible = true;
  setPosition(): this {
    return this;
  }
  setRadius(): this {
    return this;
  }
  setAlpha(): this {
    return this;
  }
  setVisible(visible: boolean): this {
    this.visible = visible;
    return this;
  }
}

function view() {
  const layers = new RenderLayers(
    {
      kit: fakeKit(),
      ring: () => new FakeRing(),
      looks: someLooks(),
      capacity: {
        enemies: 200,
        projectiles: 32,
        pulses: 4,
        gems: 300,
        corpses: 64,
        visualTicks: new Map([['tests', 8]]),
      },
    },
    { visible: 1, placeholder: 0 },
  );
  const paint = (s: RunSnapshot): void => {
    layers.advance(FRAME_MS, false);
    layers.render(s);
  };
  const c = layers.counts;
  const visible = () => [
    c.enemies.visible,
    c.projectiles.visible,
    c.pulses.visible,
    c.gems.visible,
  ];
  return { layers, paint, visible };
}

const counts = (s: RunSnapshot) => [
  s.enemies.length,
  s.projectiles.length,
  s.pulses.length,
  s.gems.length,
];

/** Partida por defecto (vida inalcanzable) jugada `n` ticks con la política de elección fija. */
function playedSnapshots(seed: number, n: number): RunSnapshot[] {
  const config = withPlayer(aDefaultConfig(), { maxHealth: 1e9 });
  const run = startRun(config, {}, new Mulberry32RandomGenerator(seed));
  return Array.from({ length: n }, () => {
    chooseFirstWhileOpen(run);
    run.tick(PlayerInput.NONE);
    return run.snapshot();
  });
}

const at = (id: number) => ({ id, x: 100 + (id % 50), y: 100, radius: 5 });

describe('Vista limpia tras reiniciar (spec run-results y sprite-rendering)', () => {
  it('Scenario: Primer frame tras reiniciar (de 200/32/1/300 sprites a 0 en el tick 0)', () => {
    const v = view();
    const fresh = startRun(aDefaultConfig()).snapshot();
    const ended: RunSnapshot = {
      ...fresh,
      tick: 900,
      enemies: Array.from({ length: 200 }, (_, i) => ({
        ...at(i),
        type: 'goblin-torch',
        health: 10,
        damaged: false,
        state: 'chase',
        stateKind: 'chase' as const,
      })),
      projectiles: Array.from({ length: 32 }, (_, i) => at(i)),
      pulses: [{ weapon: 'tests', firedAt: 898, x: 480, y: 270, radius: 90 }],
      gems: Array.from({ length: 300 }, (_, i) => at(i)),
    };
    v.paint(ended);
    const before = v.visible();

    v.layers.clear();
    v.paint(fresh);

    expect(before).toEqual([200, 32, 1, 300]);
    expect(v.visible()).toEqual([0, 0, 0, 0]);
    expect(v.layers.counts.player.visible).toBe(1);
  });

  it('Scenario: R con cadáveres en curso (10 cadáveres, 15 enemigos y 40 gemas → 0 en 61 frames)', () => {
    const v = view();
    const fresh = startRun(aDefaultConfig()).snapshot();
    const foes = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        ...at(i),
        type: 'goblin-torch',
        health: 10,
        damaged: false,
        state: 'chase',
        stateKind: 'chase' as const,
      }));
    v.paint({ ...fresh, tick: 500, enemies: foes(25) });
    const ended = {
      ...fresh,
      tick: 501,
      enemies: foes(25).slice(10),
      gems: Array.from({ length: 40 }, (_, i) => at(i)),
      status: 'over',
      outcome: 'lost',
    } as RunSnapshot;
    v.paint(ended);
    expect([v.layers.counts.corpses.visible, v.layers.counts.enemies.visible]).toEqual([10, 15]);

    v.layers.clear();
    v.paint(fresh);
    expect(v.visible()).toEqual([0, 0, 0, 0]);
    expect(v.layers.counts.player.visible).toBe(1);
    for (let f = 0; f <= 60; f++) {
      expect(v.layers.counts.corpses.visible).toBe(0);
      v.paint({ ...fresh, tick: f + 1 });
    }
  });

  it('Scenario: Cinco reinicios seguidos (en la sexta, sprites visibles = elementos del snapshot)', () => {
    const v = view();
    for (let game = 1; game <= 5; game++) {
      const snaps = playedSnapshots(game, 900);
      for (const s of snaps) v.paint(s);
      const last = snaps.at(-1);
      expect([last?.enemies.length, last?.gems.length].every((n) => (n ?? 0) > 0)).toBe(true);
      v.layers.clear();
    }

    const sixth = playedSnapshots(6, 600);
    const mismatches = sixth.filter((s) => {
      v.paint(s);
      return v.visible().join() !== counts(s).join() || v.layers.counts.corpses.visible > 64;
    });

    expect(mismatches).toHaveLength(0);
  });

  it('Scenario: Sonda en el menú (recuentos a 0 con las claves de enemigo)', () => {
    const c = emptyCounts(['goblin-torch', 'goblin-tnt', 'goblin-barrel']);
    const kinds = [c.player, c.enemies, c.corpses, c.projectiles, c.pulses, c.gems];
    expect(kinds.every((k) => k.visible === 0 && k.placeholder === 0)).toBe(true);
    expect(c.enemyPlaceholders).toEqual({ 'goblin-torch': 0, 'goblin-tnt': 0, 'goblin-barrel': 0 });
  });
});
