import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { EnemyLayer, type CircleSprite } from '../../src/infrastructure/phaser/EnemyLayer';
import { GemLayer } from '../../src/infrastructure/phaser/GemLayer';
import { ProjectileLayer } from '../../src/infrastructure/phaser/ProjectileLayer';
import { PulseLayer, type RingSprite } from '../../src/infrastructure/phaser/PulseLayer';
import { SlotPool } from '../../src/infrastructure/phaser/SlotPool';
import { aDefaultConfig, withPlayer } from '../support/builders';
import { chooseFirstWhileOpen, startRun } from '../support/runs';

class FakeSprite implements CircleSprite, RingSprite {
  visible = true;
  setPosition(): this {
    return this;
  }
  setRadius(): this {
    return this;
  }
  setFillStyle(): this {
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

/** Las 4 capas de la escena con sus sprites dobles, como en `GameScene`. */
function layers() {
  const sprites = { enemies: [] as FakeSprite[], gems: [] as FakeSprite[] };
  const projectiles: FakeSprite[] = [];
  const pulses: FakeSprite[] = [];
  const make = (into: FakeSprite[]) => () => {
    const s = new FakeSprite();
    into.push(s);
    return s;
  };
  const enemyLayer = new EnemyLayer(200, make(sprites.enemies));
  const gemLayer = new GemLayer(300, make(sprites.gems));
  const projectileLayer = new ProjectileLayer(32, make(projectiles));
  const pulseLayer = new PulseLayer(4, new Map([['tests', 8]]), make(pulses));
  const visible = () =>
    [sprites.enemies, projectiles, pulses, sprites.gems].map(
      (list) => list.filter((s) => s.visible).length,
    );
  const paint = (s: RunSnapshot) => {
    enemyLayer.sync(s.enemies);
    gemLayer.sync(s.gems);
    projectileLayer.sync(s.projectiles);
    pulseLayer.sync(s.pulses, s.tick);
  };
  const clear = () => {
    enemyLayer.clear();
    gemLayer.clear();
    projectileLayer.clear();
    pulseLayer.clear();
  };
  return { paint, clear, visible };
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

describe('SlotPool.clear()', () => {
  it('oculta todo y un id que reaparece entra con appearing = true', () => {
    const shows: boolean[] = [];
    let hidden = 0;
    const pool = new SlotPool<{ id: number }, object>(4, () => ({}), {
      show: (_s, _item, appearing) => shows.push(appearing),
      hide: () => {
        hidden += 1;
      },
    });
    pool.sync([{ id: 0 }, { id: 1 }]);

    pool.clear();
    pool.sync([{ id: 0 }]);

    expect(hidden).toBe(2);
    expect(shows).toEqual([true, true, true]);
  });
});

describe('Vista limpia tras reiniciar (spec run-results, capas)', () => {
  it('Scenario: Primer frame tras reiniciar (de 200/32/1/300 sprites a 0 en el tick 0)', () => {
    const view = layers();
    const fresh = startRun(aDefaultConfig()).snapshot();
    const at = (id: number) => ({ id, x: 100 + (id % 50), y: 100, radius: 5 });
    const ended: RunSnapshot = {
      ...fresh,
      tick: 900,
      enemies: Array.from({ length: 200 }, (_, i) => ({
        ...at(i),
        type: 'bug',
        health: 10,
        damaged: false,
      })),
      projectiles: Array.from({ length: 32 }, (_, i) => at(i)),
      pulses: [{ weapon: 'tests', firedAt: 898, x: 480, y: 270, radius: 90 }],
      gems: Array.from({ length: 300 }, (_, i) => at(i)),
    };
    view.paint(ended);
    const before = view.visible();

    view.clear();
    view.paint(fresh);

    expect(before).toEqual([200, 32, 1, 300]);
    expect(view.visible()).toEqual([0, 0, 0, 0]);
  });

  it('Scenario: Cinco reinicios seguidos (en la sexta, sprites visibles = elementos del snapshot)', () => {
    const view = layers();
    for (let game = 1; game <= 5; game++) {
      const snaps = playedSnapshots(game, 900);
      for (const s of snaps) view.paint(s);
      const last = snaps.at(-1);
      expect([last?.enemies.length, last?.gems.length].every((n) => (n ?? 0) > 0)).toBe(true);
      view.clear();
    }

    const sixth = playedSnapshots(6, 600);
    const mismatches = sixth.filter((s) => {
      view.paint(s);
      return view.visible().join() !== counts(s).join();
    });

    expect(mismatches).toHaveLength(0);
  });
});
