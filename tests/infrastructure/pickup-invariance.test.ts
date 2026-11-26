import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import type { Appearance } from '../../src/infrastructure/content/appearanceSchema';
import type { RingSprite } from '../../src/infrastructure/phaser/PulseLayer';
import { RenderLayers } from '../../src/infrastructure/phaser/RenderLayers';
import type { MapArtCanvas } from '../../src/infrastructure/phaser/TerrainView';
import { aDefaultConfig } from '../support/builders';
import { FAKE_HAZARD_CAPACITY, FakeGraphics, fakeKit } from '../support/FakeSprite';
import { randomInputs } from '../support/inputs';
import { repoLooks } from '../support/looks';
import { planFor } from '../support/mapArt';
import { chooseFirstWhileOpen, startRun, startSeededRun } from '../support/runs';

// Spec sprite-rendering (0030) y xp-gems: el flote, la aparición y el tamaño pintado de los
// recogibles son solo presentación. La partida (semilla 42, 1.200 ticks con inputs y política de
// elección fijos) es la misma con los datos de aspecto del repositorio y con sus variantes, y el plan
// del mapa no cuenta ningún recogible.
const CONFIG = aDefaultConfig();
const FRAME_MS = 16.667;

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

/** Datos de aspecto sin `spawn` en oro, madera y carne. */
const noSpawn = (a: Appearance): Appearance => {
  const { gold, wood, meat } = a.pickups;
  const drop = <T extends { spawn?: unknown }>(p: T): T => {
    const out = { ...p };
    delete out.spawn;
    return out;
  };
  return { ...a, pickups: { ...a.pickups, gold: drop(gold), wood: drop(wood), meat: drop(meat) } };
};
/** Sin `spawn` y con la amplitud del flote 0. */
const still = (a: Appearance): Appearance => {
  const b = noSpawn(a);
  return {
    ...b,
    pickupMotion: { ...b.pickupMotion, float: { ...b.pickupMotion.float, amplitude: 0 } },
  };
};
/** Escalas y diámetro de antes de 0030: oro, madera y carne 0,3; rocas 0,5; gema de 10 px. */
const oldScales = (a: Appearance): Appearance => {
  const { xp, gold, wood, meat, stone } = a.pickups;
  const rocks = Object.fromEntries(
    Object.entries(stone.rocks).map(([k, r]) => [k, { ...r, scale: 0.5 }]),
  ) as typeof stone.rocks;
  return {
    ...a,
    pickups: {
      xp: 'diameter' in xp ? { ...xp, diameter: 10 } : xp,
      gold: { ...gold, scale: 0.3 },
      wood: { ...wood, scale: 0.3 },
      meat: { ...meat, scale: 0.3 },
      stone: { ...stone, rocks },
    },
  };
};

function layersFor(edit: (a: Appearance) => Appearance) {
  return new RenderLayers(
    {
      kit: fakeKit(),
      warnings: () => new FakeGraphics(),
      ring: () => new Ring(),
      looks: repoLooks([], edit),
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
}

/** 1.200 ticks de la 42 pintando cada snapshot con las capas de esos datos de aspecto. */
function play(edit: (a: Appearance) => Appearance): string[] {
  const layers = layersFor(edit);
  const run = startSeededRun(CONFIG, 42);
  const out: string[] = [];
  for (const input of randomInputs(1200, 30)) {
    chooseFirstWhileOpen(run);
    run.tick(input);
    const s = run.snapshot();
    layers.advance(FRAME_MS, false);
    layers.render(s);
    out.push(JSON.stringify(s));
  }
  expect(layers.counts.pickups.wood.visible + layers.counts.pickups.xp.visible).toBeGreaterThan(0);
  return out;
}

const same = (a: string[], b: string[]): number => a.findIndex((s, i) => s !== b[i]);

describe('Recogibles: presentación sin efecto en la simulación (0030)', () => {
  const repo = play((a) => a);

  it('Scenario: Flotar no cambia la simulación (repositorio frente a A 0 y sin aparición)', () => {
    const other = play(still);
    expect(other).toHaveLength(1200);
    expect(same(other, repo)).toBe(-1);
  });

  it('Scenario: Aparecer no cambia la simulación (repositorio frente a sin spawn)', () => {
    expect(same(play(noSpawn), repo)).toBe(-1);
  });

  it('Scenario: Escalas de los recogibles sin efecto en la simulación (0,3 / 0,5 y gema de 10 px)', () => {
    const other = play(oldScales);
    expect(same(other, repo)).toBe(-1);
    const gained = (snaps: string[]) =>
      snaps.map((s) => (JSON.parse(s) as RunSnapshot).pickups.length);
    expect(gained(other)).toEqual(gained(repo));
  });
});

describe('El tamaño pintado no cambia la recogida (xp-gems 0030)', () => {
  it('Scenario: El tamaño pintado no cambia la recogida (gema y oro a 100 px: mismo tick, XP y oro)', () => {
    const collect = (edit: (a: Appearance) => Appearance) => {
      const layers = layersFor(edit);
      const P = { x: 1000, y: 1000 };
      const run = startRun(CONFIG, {
        player: P,
        gems: [
          { x: P.x + 100, y: P.y, value: 3 },
          { x: P.x, y: P.y + 100, value: 4, kind: 'gold' },
        ],
      });
      const start = run.snapshot();
      expect(start.pickups).toHaveLength(2);
      for (let t = 1; t <= 600; t++) {
        run.tick(PlayerInput.NONE);
        const s = run.snapshot();
        layers.advance(FRAME_MS, false);
        layers.render(s);
        // Los dos a la misma distancia: se recogen en el mismo tick (nunca queda uno solo).
        expect(s.pickups.length).not.toBe(1);
        if (s.pickups.length === 0) {
          return { tick: s.tick, xp: s.progression, gold: s.resources.gold };
        }
      }
      throw new Error('no se recogieron en 600 ticks');
    };
    const repo = collect((a) => a);
    const before = collect(oldScales);

    expect(before).toEqual(repo);
    expect(repo.gold).toBe(4);
    expect([CONFIG.progression.gemRadius, CONFIG.player.pickupRadius]).toEqual([5, 128]);
  });
});

describe('Totales del mapa con los recogibles pintados (0030)', () => {
  /** Lienzo doble del mapa: solo cuenta los objetos creados. */
  const canvas = (): { canvas: MapArtCanvas; count: () => number } => {
    let n = 0;
    const add = () => {
      n++;
    };
    return {
      canvas: {
        clear: () => {
          n = 0;
        },
        tiles: add,
        sprite: add,
        rect: add,
        circle: add,
        foam: () => undefined,
        frame: () => undefined,
        show: () => undefined,
      },
      count: () => n,
    };
  };

  it.each([
    [42, 820],
    [123, 904],
  ] as const)(
    'Scenario: Totales del mapa con estructuras y vetas (semilla %i: %i objetos con el reloj a 0 y a 10.000)',
    (seed, objects) => {
      const run = startSeededRun(CONFIG, seed);
      const plan = planFor(run.map, seed);
      const totals = new Set<string>();
      for (const ms of [0, 10_000]) {
        const layers = layersFor((a) => a);
        const d = canvas();
        layers.paintMap(d.canvas, plan);
        layers.advance(ms, false);
        layers.render(run.snapshot());
        expect(layers.counts.pickups.wood.visible).toBeGreaterThan(0);
        totals.add(JSON.stringify({ ...layers.counts.mapArt, drawn: null, made: d.count() }));
      }
      expect(totals.size).toBe(1);
      expect(plan.objects).toBe(objects);
    },
  );
});
