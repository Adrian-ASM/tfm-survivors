import { describe, expect, it } from 'vitest';
import type { EnemySnapshot, RunSnapshot } from '../../src/domain/run/RunSnapshot';
import type { RingSprite } from '../../src/infrastructure/phaser/PulseLayer';
import { RenderLayers } from '../../src/infrastructure/phaser/RenderLayers';
import { aDefaultConfig } from '../support/builders';
import { fakeKit, type FakeSprite } from '../support/FakeSprite';
import { someLooks } from '../support/looks';
import { startRun } from '../support/runs';
import { toMapSnapshot } from '../../src/domain/map/MapSnapshot';
import type { MapArtCanvas } from '../../src/infrastructure/phaser/TerrainView';
import { planFor } from '../support/mapArt';
import { mapForSeed } from '../support/mapStats';

// Spec sprite-rendering: muertes, mundo detenido y sonda (change 0012, design D6/D7 y "Flujo").
// Fixture: cadáver con `death` de 6 frames a 15 fps (400 ms); jugador con walk [6, 7, 8, 9].
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

const BASE = startRun(aDefaultConfig()).snapshot();

const foe = (id: number, x: number, y: number): EnemySnapshot => ({
  id,
  type: 'goblin-torch',
  x,
  y,
  radius: 10,
  health: 10,
  damaged: false,
});

function snap(tick: number, over: Partial<RunSnapshot> = {}): RunSnapshot {
  return { ...BASE, tick, ...over } as RunSnapshot;
}

function setup(maxCorpses = 64) {
  const kit = fakeKit();
  const rings: FakeRing[] = [];
  const looks = someLooks();
  const layers = new RenderLayers(
    {
      kit,
      ring: () => {
        const r = new FakeRing();
        rings.push(r);
        return r;
      },
      looks,
      capacity: {
        enemies: 200,
        projectiles: 32,
        pulses: 4,
        gems: 300,
        corpses: maxCorpses,
        visualTicks: new Map([['tests', 8]]),
      },
    },
    { visible: 1, placeholder: 0 },
  );
  const corpses = () => kit.created.filter((s) => s.texture === looks.corpse.texture && s.visible);
  const enemies = () =>
    kit.created.filter(
      (s) => s.texture === looks.enemies.get('goblin-torch')?.texture && s.visible,
    );
  const player = (): FakeSprite | undefined =>
    kit.created.find((s) => s.texture === looks.player.texture);
  const frame = (s: RunSnapshot, paused = false): void => {
    layers.advance(FRAME_MS, paused);
    layers.render(s);
  };
  return { layers, frame, corpses, enemies, player, rings };
}

describe('RenderLayers · muertes por delta del snapshot', () => {
  it('Scenario: Pulso que mata a varios en el mismo tick (5 cadáveres en sus posiciones)', () => {
    const { frame, corpses, layers } = setup();
    const five = [1, 2, 3, 4, 5].map((i) => foe(i, 100 * i, 50 * i));
    frame(snap(10, { enemies: five }));
    frame(snap(11, { enemies: [], kills: 5 }));
    const shown = corpses().map((c) => [c.x, c.y]);
    expect(shown).toHaveLength(5);
    for (const e of five) expect(shown).toContainEqual([e.x, e.y]);
    expect(layers.counts.corpses.visible).toBe(5);
  });

  it('Scenario: Muerte y desaparición (frames 1 a 23 visible, ninguno desde el 26)', () => {
    const { frame, corpses } = setup();
    frame(snap(1, { enemies: [foe(1, 300, 200)] }));
    const seen: boolean[] = [];
    for (let f = 1; f <= 31; f++) {
      frame(snap(1 + f, { enemies: [] }));
      seen[f] = corpses().length === 1;
    }
    expect(seen.slice(1, 24).every(Boolean)).toBe(true);
    expect(seen.slice(26).some(Boolean)).toBe(false);
  });

  it('Scenario: Fin de la partida (8 → 6 en el tick terminado: 2 cadáveres, 6 enemigos, 60 frames)', () => {
    const { frame, corpses, enemies } = setup();
    const eight = Array.from({ length: 8 }, (_, i) => foe(i, 60 * i, 100));
    frame(snap(99, { enemies: eight }));
    const ended = snap(100, {
      enemies: eight.slice(2),
      status: 'over',
      outcome: 'lost',
    });
    frame(ended);
    expect([corpses().length, enemies().length]).toEqual([2, 6]);
    for (let f = 0; f < 60; f++) {
      frame(ended);
      expect([corpses().length, enemies().length]).toEqual([2, 6]);
    }
  });

  it('Scenario: Muerte a velocidad acelerada (sale en un frame de 8 ticks: 1 cadáver)', () => {
    const { frame, corpses } = setup();
    frame(snap(8, { enemies: [foe(3, 300, 200)] }));
    frame(snap(16, { enemies: [] }));
    expect(corpses().map((c) => [c.x, c.y])).toEqual([[300, 200]]);
  });

  it('Scenario: Cadáver con el mundo detenido (visible en pausa; tras reanudar, se va en 11..14)', () => {
    const { frame, corpses } = setup();
    frame(snap(1, { enemies: [foe(1, 300, 200)] }));
    frame(snap(2, { enemies: [] }));
    for (let f = 0; f < 12; f++) frame(snap(3 + f, { enemies: [] }));
    const paused = snap(15, { enemies: [] });
    for (let f = 0; f < 300; f++) {
      frame(paused, true);
      expect(corpses()).toHaveLength(1);
    }
    const after: boolean[] = [];
    for (let f = 1; f <= 30; f++) {
      frame(snap(15 + f, { enemies: [] }));
      after[f] = corpses().length === 1;
    }
    expect(after.slice(1, 11).every(Boolean)).toBe(true);
    expect(after.slice(15).some(Boolean)).toBe(false);
  });

  it('un enemigo que nunca se pintó no deja cadáver', () => {
    const { frame, corpses } = setup();
    frame(snap(1, { enemies: [] }));
    frame(snap(2, { enemies: [], kills: 1 }));
    expect(corpses()).toHaveLength(0);
  });
});

describe('RenderLayers · mundo detenido', () => {
  it('Scenario: Mundo detenido (pausa, elección y fin: mismo frame de hoja en 300 frames)', () => {
    for (const mode of ['paused', 'choosing', 'over'] as const) {
      const { frame, enemies, player } = setup();
      const three = (t: number) => [
        foe(1, 100 + 3 * t, 100),
        foe(2, 200 + 3 * t, 100),
        foe(3, 300 + 3 * t, 100),
      ];
      const moving = (t: number) => ({
        enemies: three(t),
        player: { ...BASE.player, x: 300 + 3 * t },
      });
      for (let t = 0; t < 500; t++) frame(snap(t, moving(t)));
      const stopped =
        mode === 'paused'
          ? snap(500, moving(500))
          : snap(500, {
              ...moving(500),
              status: mode,
              ...(mode === 'over' ? { outcome: 'lost' } : {}),
            } as Partial<RunSnapshot>);
      frame(stopped, mode === 'paused');
      const first = [...enemies().map((s) => s.frame), player()?.frame];
      for (let f = 0; f < 300; f++) {
        frame(stopped, mode === 'paused');
        expect([...enemies().map((s) => s.frame), player()?.frame], mode).toEqual(first);
      }
    }
  });
});

// Spec sprite-rendering (0016), "Pintado del mapa": espuma en bucle en tiempo de render (design §5.4).
describe('RenderLayers · espuma animada', () => {
  function withFoam() {
    const s = setup();
    const calls: number[] = [];
    const canvas: MapArtCanvas = {
      clear: () => undefined,
      tiles: () => undefined,
      sprite: () => undefined,
      rect: () => undefined,
      foam: (f) => calls.push(f),
      show: () => undefined,
    };
    const plan = planFor(toMapSnapshot(mapForSeed(aDefaultConfig(), 123)), 123);
    s.layers.paintMap(canvas, plan);
    return { ...s, calls, plan };
  }

  it('Scenario: Pintado del mapa (espuma en bucle: 8 frames por segundo, solo al cambiar)', () => {
    const { frame, calls, plan } = withFoam();
    expect(plan.foam?.fps).toBe(8);
    for (let i = 0; i < 59; i++) frame(snap(i)); // 983 ms: frames 0..7
    expect(calls).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    for (let i = 0; i < 8; i++) frame(snap(60 + i));
    expect(calls.at(-1)).toBe(0);
  });

  it('congelada en pausa y sin avance del reloj (modo manual sin step)', () => {
    const { frame, layers, calls } = withFoam();
    frame(snap(0));
    for (let i = 0; i < 120; i++) frame(snap(1), true);
    for (let i = 0; i < 120; i++) {
      layers.advance(0, false);
      layers.render(snap(1));
    }
    expect(calls).toEqual([0]);
  });

  it('sin espuma con arte no llama nunca a foam', () => {
    const s = setup();
    const calls: number[] = [];
    const canvas: MapArtCanvas = {
      clear: () => undefined,
      tiles: () => undefined,
      sprite: () => undefined,
      rect: () => undefined,
      foam: (f) => calls.push(f),
      show: () => undefined,
    };
    s.layers.paintMap(
      canvas,
      planFor(toMapSnapshot(mapForSeed(aDefaultConfig(), 123)), 123, [
        'Terrain/Water/Foam/Foam.png',
      ]),
    );
    for (let i = 0; i < 60; i++) s.frame(snap(i));
    expect(calls).toEqual([]);
  });
});

describe('RenderLayers · recuentos para la sonda', () => {
  it('Scenario: Pulso sin sprite (1 anillo, ningún sprite de hoja)', () => {
    const { frame, layers, rings } = setup();
    frame(snap(5, { pulses: [{ weapon: 'tests', firedAt: 5, x: 480, y: 270, radius: 90 }] }));
    expect(rings.filter((r) => r.visible)).toHaveLength(1);
    expect(layers.counts.pulses).toEqual({ visible: 1, placeholder: 0 });
  });

  it('Scenario: Recuento coherente con el snapshot (recuentos = elementos del snapshot)', () => {
    const { frame, layers } = setup();
    const s = snap(3, {
      enemies: [foe(1, 10, 10), foe(2, 20, 20)],
      projectiles: [{ id: 1, x: 1, y: 1, radius: 4 }],
      gems: [
        { id: 1, x: 5, y: 5, radius: 5 },
        { id: 2, x: 6, y: 6, radius: 5 },
        { id: 3, x: 7, y: 7, radius: 5 },
      ],
    });
    frame(s);
    const c = layers.counts;
    expect([c.enemies.visible, c.projectiles.visible, c.gems.visible, c.player.visible]).toEqual([
      2, 1, 3, 1,
    ]);
    expect(c.ground).toEqual({ visible: 1, placeholder: 0 });
    expect(c.enemyPlaceholders).toEqual({ 'goblin-torch': 0, 'goblin-tnt': 0, 'goblin-barrel': 0 });
  });
});
