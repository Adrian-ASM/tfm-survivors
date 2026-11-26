import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import type { RingSprite } from '../../src/infrastructure/phaser/PulseLayer';
import { emptyCounts } from '../../src/infrastructure/phaser/renderCounts';
import { RenderLayers } from '../../src/infrastructure/phaser/RenderLayers';
import type { Looks } from '../../src/infrastructure/phaser/art/looks';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { aDefaultConfig, withPlayer } from '../support/builders';
import { FAKE_HAZARD_CAPACITY, FakeGraphics, fakeKit } from '../support/FakeSprite';
import { repoLooks, someLooks } from '../support/looks';
import { chooseFirstWhileOpen, startRun, startSeededRun } from '../support/runs';

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

function view(looks: Looks = someLooks()) {
  const kit = fakeKit();
  const layers = new RenderLayers(
    {
      kit,
      warnings: () => new FakeGraphics(),
      ring: () => new FakeRing(),
      looks,
      capacity: {
        enemies: 200,
        projectiles: 32,
        pulses: 4,
        pickups: 396,
        corpses: 64,
        visualTicks: new Map([['tests', 8]]),
        hazards: FAKE_HAZARD_CAPACITY,
      },
    },
    { visible: 1, placeholder: 0 },
  );
  layers.createHazards();
  const paint = (s: RunSnapshot): void => {
    layers.advance(FRAME_MS, false);
    layers.render(s);
  };
  const c = layers.counts;
  const visible = () => [
    c.enemies.visible,
    c.projectiles.visible,
    c.pulses.visible,
    c.pickups.xp.visible + c.pickups.gold.visible + c.pickups.wood.visible,
  ];
  return { layers, paint, visible, kit };
}

const counts = (s: RunSnapshot) => [
  s.enemies.length,
  s.projectiles.length,
  s.pulses.length,
  s.pickups.length,
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
      pickups: Array.from({ length: 300 }, (_, i) => ({ ...at(i), kind: 'xp' as const, value: 1 })),
    };
    v.paint(ended);
    const before = v.visible();

    v.layers.clear();
    v.paint(fresh);

    expect(before).toEqual([200, 32, 1, 300]);
    expect(v.visible()).toEqual([0, 0, 0, 0]);
    expect(v.layers.counts.player.visible).toBe(1);
  });

  it('Scenario: R con cadáveres en curso (10 cadáveres, 15 enemigos, 40 gemas, 5 gold y 6 wood → 0 en 61 frames)', () => {
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
      // 0022: recogibles de los tres tipos.
      pickups: Array.from({ length: 51 }, (_, i) => ({
        ...at(i),
        kind: i < 40 ? ('xp' as const) : i < 45 ? ('gold' as const) : ('wood' as const),
        value: 1,
      })),
      dynamites: [0, 1].map((id) => ({
        ...at(id),
        targetX: 0,
        targetY: 0,
        radius: 8,
        explodesAt: 600,
      })),
      warnings: [0, 1, 2].map((i) => ({
        ...at(i),
        radius: 48,
        source: 'dynamite',
        explodesAt: 600,
      })),
      blasts: [{ ...at(0), radius: 56, tick: 501 }],
      status: 'over',
      outcome: 'lost',
    } as RunSnapshot;
    v.paint(ended);
    expect([v.layers.counts.corpses.visible, v.layers.counts.enemies.visible]).toEqual([10, 15]);
    const hazards = () => {
      const { warnings, dynamites, explosions } = v.layers.counts;
      return [dynamites.visible, warnings.visible, explosions.visible];
    };
    expect(hazards()).toEqual([2, 3, 1]);

    v.layers.clear();
    v.paint(fresh);
    expect(v.visible()).toEqual([0, 0, 0, 0]);
    expect(hazards()).toEqual([0, 0, 0]);
    expect(v.layers.counts.player.visible).toBe(1);
    for (let f = 0; f <= 60; f++) {
      expect(v.layers.counts.corpses.visible).toBe(0);
      v.paint({ ...fresh, tick: f + 1 });
    }
  });

  it('Scenario: R con apariciones en curso (semilla 42: montones en idle y un oro en el frame 3 → retardo de nuevo)', () => {
    const W_SPAWN = 'Resources/Resources/W_Spawn.png';
    const v = view(repoLooks());
    const fresh = () => startSeededRun(aDefaultConfig(), 42).snapshot();
    const first = fresh();
    const piles = first.pickups.filter((p) => p.kind === 'wood');
    expect(piles).toHaveLength(8);
    for (let f = 0; f < 120; f++) v.paint(first);
    const gold = { id: 999, kind: 'gold' as const, value: 1, x: 3000, y: 300, radius: 5 };
    const withGold = { ...first, pickups: [...first.pickups, gold] };
    for (let f = 0; f < 20; f++) v.paint(withGold);
    const sprite = (p: { x: number; y: number }) =>
      v.kit.created.find((s) => s.visible && s.x === p.x && Math.abs(s.y - p.y) <= 4.001);
    expect([sprite(gold)?.texture, sprite(gold)?.frame]).toEqual([
      'Resources/Resources/G_Spawn.png',
      3,
    ]);
    expect(piles.every((p) => sprite(p)?.texture === 'Resources/Resources/W_Idle.png')).toBe(true);

    v.layers.clear();
    v.paint(fresh());

    expect(piles.map((p) => [sprite(p)?.texture, sprite(p)?.frame])).toEqual(
      piles.map((p) => (p.id === 0 ? [W_SPAWN, 0] : [undefined, undefined])),
    );
    // Los de ids 1 a 7, en su retardo: no se ven ni cuentan como visibles (sí en pickupSpawns).
    expect(v.layers.counts.pickups.wood.visible).toBe(1);
    expect(v.kit.created.some((s) => s.visible && s.texture.includes('G_'))).toBe(false);
    expect(v.layers.counts.pickupSpawns).toEqual({ xp: 0, gold: 0, wood: 8, meat: 0, stone: 0 });
    // El id 0 ya ha empezado (deja el frame 0 a los 100 ms); el 1, en su retardo de 120 ms, sigue oculto.
    for (let f = 0; f < 7; f++) v.paint(fresh());
    expect([sprite(piles[0] ?? gold)?.frame, sprite(piles[1] ?? gold)]).toEqual([1, undefined]);
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
    kinds.push(c.dynamites, c.warnings, c.explosions, c.pickups.meat, c.pickups.stone, c.sheep);
    expect(c.enemyStates).toEqual({
      chase: 0,
      fuse: 0,
      charge: 0,
      wait: 0,
      patrol: 0,
      alert: 0,
      return: 0,
    });
    expect(kinds.every((k) => k.visible === 0 && k.placeholder === 0)).toBe(true);
    expect(c.sheep.byState).toEqual({ graze: 0, wander: 0, flee: 0 });
    expect(c.enemyPlaceholders).toEqual({ 'goblin-torch': 0, 'goblin-tnt': 0, 'goblin-barrel': 0 });
    // 0030: ningún recogible en aparición.
    expect(c.pickupSpawns).toEqual({ xp: 0, gold: 0, wood: 0, meat: 0, stone: 0 });
  });
});
