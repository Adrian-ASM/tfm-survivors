import { describe, expect, it } from 'vitest';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import type { Run } from '../../src/domain/run/Run';
import type { CombatLooks } from '../../src/infrastructure/content/appearanceSchema';
import { followView } from '../../src/infrastructure/phaser/CameraRig';
import { createPlayfield } from '../../src/infrastructure/phaser/GroundView';
import { RenderLayers } from '../../src/infrastructure/phaser/RenderLayers';
import { emptyCounts } from '../../src/infrastructure/phaser/renderCounts';
import type { MapArtCanvas } from '../../src/infrastructure/phaser/TerrainView';
import { SHEEP_IDLE_FILE } from '../support/appearance';
import { LINTER, TICK_MS, aDefaultConfig, withWeapons } from '../support/builders';
import { untilHit } from '../support/combat';
import { FakeBarCanvas, REPO_COMBAT, aHit, fakeTexts, type FakeText } from '../support/feedback';
import { FAKE_HAZARD_CAPACITY, FakeGraphics, fakeKit } from '../support/FakeSprite';
import { heldInputs } from '../support/inputs';
import { someLooks } from '../support/looks';
import { planFor, WORLD } from '../support/mapArt';
import { chooseFirstWhileOpen, startSeededRun } from '../support/runs';
import { SHEEP_AT, aSheepConfig, startWithSheep } from '../support/sheep';
import { weaponsOf } from '../support/weapons';

// Spec sprite-rendering (0031): capa de combate dentro de las capas de la partida, con dobles del
// motor y snapshots reales de `Run`.
const CAPACITY = {
  enemies: 300,
  projectiles: 32,
  pulses: 4,
  pickups: 436,
  sheep: 5,
  corpses: 64,
  visualTicks: new Map([['tests', 8]]),
  hazards: FAKE_HAZARD_CAPACITY,
};

const noCanvas: MapArtCanvas = {
  clear: () => undefined,
  tiles: () => undefined,
  sprite: () => undefined,
  rect: () => undefined,
  circle: () => undefined,
  foam: () => undefined,
  frame: () => undefined,
  show: () => undefined,
};

function layers(o: { combat?: CombatLooks; missing?: readonly string[] } = {}) {
  const texts = fakeTexts();
  const canvas = new FakeBarCanvas();
  const layer = new RenderLayers(
    {
      kit: fakeKit(),
      ring: () => ({
        setPosition: () => 0,
        setRadius: () => 0,
        setAlpha: () => 0,
        setVisible: () => 0,
      }),
      warnings: () => new FakeGraphics(),
      looks: someLooks(() => undefined, o.missing ?? []),
      capacity: CAPACITY,
      feedback: { text: texts.make, bars: () => canvas, looks: o.combat ?? REPO_COMBAT },
    },
    { visible: 1, placeholder: 0 },
  );
  layer.createHazards();
  layer.createFeedback();
  return { layer, texts, canvas };
}

const numbersSum = (l: RenderLayers): number => {
  const d = l.counts.damageNumbers;
  return d.enemy + d.structure + d.sheep + d.player;
};

/**
 * 0036: estructuras dañadas (vida < máxima en algún snapshot pintado de la partida) y no destruidas;
 * `seen` acumula los ids dañados desde el primer frame.
 */
const damagedNotRuined = (s: RunSnapshot, seen: Set<number>): number => {
  for (const x of s.structures) if (!x.destroyed && x.health < x.maxHealth) seen.add(x.id);
  return s.structures.filter((x) => !x.destroyed && seen.has(x.id)).length;
};

/** Juega `n` ticks con inputs fijos y la política de elección fija, pintando cada snapshot. */
function playPainted(run: Run, n: number, paint: (s: RunSnapshot) => void): RunSnapshot[] {
  const out: RunSnapshot[] = [];
  for (const input of heldInputs(n, 10, 120)) {
    chooseFirstWhileOpen(run);
    run.tick(input);
    const s = run.snapshot();
    paint(s);
    out.push(s);
    if (run.status === 'over') break;
  }
  return out;
}

describe('Capa de combate en las capas de la partida (sprite-rendering 0031)', () => {
  it('Scenario: Barras y números sobre la parte alta y los peligros', () => {
    const order: string[] = [];
    const texts = fakeTexts();
    const kit = fakeKit();
    const create = kit.create.bind(kit);
    createPlayfield(
      {
        kit: { tint: kit.tint, create: () => (order.push('sprite'), create()) },
        ring: () => {
          order.push('ring');
          return {
            setPosition: () => 0,
            setRadius: () => 0,
            setAlpha: () => 0,
            setVisible: () => 0,
          };
        },
        warnings: () => (order.push('warnings'), new FakeGraphics()),
        looks: someLooks(),
        capacity: CAPACITY,
        feedback: {
          text: () => (order.push('number'), texts.make()),
          bars: () => (order.push('bars'), new FakeBarCanvas()),
          looks: REPO_COMBAT,
        },
      },
      { tiles: () => order.push('ground'), rect: () => order.push('ground') },
      WORLD,
      {
        low: () => order.push('low'),
        high: () => (order.push('high'), noCanvas),
      },
    );
    const at = (k: string) => order.indexOf(k);
    const lastOf = (k: string) => order.lastIndexOf(k);
    // Parte alta del mapa < avisos < dinamitas y explosiones < barras < números; el HUD y los
    // overlays los crea la escena después de `createPlayfield` (siempre encima).
    expect(at('high')).toBeLessThan(at('warnings'));
    expect(lastOf('sprite')).toBeLessThan(at('bars'));
    expect(at('warnings')).toBeLessThan(at('bars'));
    expect(at('bars')).toBeLessThan(at('number'));
    expect(order.at(-1)).toBe('number');
    expect(order.filter((k) => k === 'number')).toHaveLength(REPO_COMBAT.numbers.pool);
  });

  it('Scenario: R y menú con números de daño y barras', () => {
    const { layer } = layers();
    const s42 = startSeededRun(aDefaultConfig(), 42).snapshot();
    // 1 casa destruida y otras 2 estructuras dañadas con barra (0036).
    const ruined = s42.structures.map((x, i) => {
      if (i === 0) return { ...x, health: 0, destroyed: true };
      return i <= 2 ? { ...x, health: x.maxHealth - 5 } : x;
    });
    const hits = [0, 1, 2, 3, 4].map((i) => aHit(i, 'enemy', 6));
    layer.render({ ...s42, status: 'over', outcome: 'lost', structures: ruined, hits });
    expect(numbersSum(layer)).toBe(5);
    expect(layer.counts.healthBars).toBe(2);
    layer.clear();
    const s43Run = startSeededRun(aDefaultConfig(), 43);
    const s43 = s43Run.snapshot();
    layer.render(s43);
    expect(layer.counts.damageNumbers).toEqual({
      enemy: 0,
      structure: 0,
      sheep: 0,
      player: 0,
      created: 0,
    });
    expect(layer.counts.healthBars).toBe(0);
    layer.render({ ...s43, tick: 1, hits: [aHit(0, 'enemy', 6)] });
    expect(layer.counts.damageNumbers.created).toBe(1);
    // Menú: la sonda usa los recuentos vacíos en todos sus frames.
    const menu = emptyCounts(['goblin-torch']);
    expect([menu.damageNumbers, menu.healthBars]).toEqual([
      { enemy: 0, structure: 0, sheep: 0, player: 0, created: 0 },
      0,
    ]);
  });

  it('Scenario: Recuentos coherentes con el snapshot', () => {
    const { layer } = layers();
    let created = 0;
    const run = startSeededRun(aDefaultConfig(), 42);
    const seen = new Set<number>();
    const bars: number[] = [];
    const frames = playPainted(run, 600, (s) => {
      layer.advance(TICK_MS, false);
      layer.render(s);
      bars.push(layer.counts.healthBars);
      expect(layer.counts.healthBars).toBe(damagedNotRuined(s, seen));
      expect(numbersSum(layer)).toBeLessThanOrEqual(48);
      expect(layer.counts.damageNumbers.created).toBeGreaterThanOrEqual(created);
      created = layer.counts.damageNumbers.created;
    });
    expect(frames).toHaveLength(600);
    expect(created).toBeGreaterThan(0);
    // En el primer frame de la semilla 42 ninguna está dañada: 7 estructuras y 0 barras.
    expect([frames[0]?.structures.length, bars[0]]).toEqual([7, 0]);
  });

  it('Scenario: Partida nueva sin barras (R y Volver al menú → Jugar con la semilla 42)', () => {
    const { layer } = layers();
    const s42 = startSeededRun(aDefaultConfig(), 42).snapshot();
    const hurt = s42.structures.map((x, i) => (i < 2 ? { ...x, health: x.maxHealth - 10 } : x));
    // R: `clear` y la partida nueva con los mismos ids.
    layer.render({ ...s42, structures: hurt });
    expect(layer.counts.healthBars).toBe(2);
    layer.clear();
    layer.render(startSeededRun(aDefaultConfig(), 42).snapshot());
    expect(layer.counts.healthBars).toBe(0);
    // Menú → Jugar: `clear` al volver y `paintMap` (setCellSize) de la partida nueva.
    layer.render({ ...s42, structures: hurt });
    expect(layer.counts.healthBars).toBe(2);
    layer.clear();
    const fresh = startSeededRun(aDefaultConfig(), 42);
    layer.paintMap(noCanvas, planFor(fresh.map, 42));
    layer.render(fresh.snapshot());
    expect(layer.counts.healthBars).toBe(0);
  });

  it('Scenario: Los números siguen a la cámara, no al objetivo', () => {
    const { layer, texts } = layers();
    const base = startSeededRun(aDefaultConfig(), 42, 'empty').snapshot();
    const player = { ...base.player, x: 1920, y: 1080 };
    const hit = aHit(0, 'enemy', 6, 2160, 1140);
    const view = followView(player, { width: 1280, height: 720 }, WORLD);
    layer.render({ ...base, tick: 1, player, hits: [hit] });
    const n = texts.made.find((t: FakeText) => t.visible);
    expect([(n?.x ?? 0) - view.x, (n?.y ?? 0) - view.y]).toEqual([880, 400]);
    for (let k = 2; k <= 5; k++) {
      layer.advance(TICK_MS, false);
      layer.render({ ...base, tick: k, player, hits: [hit] });
      expect(n?.x).toBe(2160);
    }
  });

  it('Scenario: Pintar números no cambia la simulación', () => {
    const tiny = { ...REPO_COMBAT, numbers: { ...REPO_COMBAT.numbers, pool: 1, durationMs: 1 } };
    const a = layers();
    const b = layers({ combat: tiny });
    const paintWith = (l: RenderLayers) => (s: RunSnapshot) => {
      l.advance(TICK_MS, false);
      l.render(s);
    };
    const runA = playPainted(startSeededRun(aDefaultConfig(), 42), 1200, paintWith(a.layer));
    const runB = playPainted(startSeededRun(aDefaultConfig(), 42), 1200, paintWith(b.layer));
    expect(runB).toStrictEqual(runA);
    for (const [seed, objects] of [
      [42, 820],
      [123, 904],
    ] as const) {
      expect(planFor(startSeededRun(aDefaultConfig(), seed).map, seed).objects).toBe(objects);
    }
  });

  it('Scenario: Número de daño en una oveja', () => {
    for (const missing of [[], [SHEEP_IDLE_FILE]]) {
      const { layer, texts } = layers({ missing });
      const config = withWeapons(aSheepConfig(), weaponsOf([LINTER]));
      const run = startWithSheep(config, [SHEEP_AT], { player: { x: 1300, y: 1000 } });
      layer.render(untilHit(run));
      const n = texts.made.filter((t) => t.visible);
      expect(n.map((t) => [t.text, t.tint])).toEqual([['6', REPO_COMBAT.colors.sheep]]);
      expect(layer.counts.healthBars).toBe(0);
    }
  });
});
