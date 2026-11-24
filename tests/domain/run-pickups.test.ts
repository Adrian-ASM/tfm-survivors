import { describe, expect, it } from 'vitest';
import type { RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { aDefaultConfig, aSegment, aWavesConfig, withDuration } from '../support/builders';
import { CountingRandom } from '../support/random';
import { aContactConfig, aProbeType, startRun, ticks } from '../support/runs';
import { withScenarioCurve } from '../support/builders';

const CENTER = { x: 480, y: 270 };

/** Contenido por defecto (curva 5/5) sin oleadas: con el mapa vacío, nada a lo que disparar. */
const quiet = (patch: Partial<RunConfig> = {}): RunConfig => ({
  ...withScenarioCurve(aDefaultConfig()),
  waves: aWavesConfig({ segments: [aSegment(['goblin-torch'], 0)] }).waves,
  ...patch,
});

const at = (setup: RunSetup = {}) => startRun(quiet(), { player: CENTER, ...setup });

describe('Recogida según el tipo (spec xp-gems, resources)', () => {
  it('Scenario: Efecto según el tipo (gold 12 y wood 3 a 20 px: oro 12, madera 3, XP 0)', () => {
    const run = at({
      gems: [
        { kind: 'gold', x: 500, y: 270, value: 12 },
        { kind: 'wood', x: 500, y: 270, value: 3 },
      ],
    });
    const [s] = ticks(run, 1);
    expect(s?.pickups).toEqual([]);
    expect(s?.resources).toEqual({ gold: 12, wood: 3 });
    expect(s?.progression).toMatchObject({ level: 1, xp: 0, pendingLevelUps: 0 });
  });

  it('Scenario: Recogida de oro y de madera en el mismo tick (gold 10, wood 3 y xp 1)', () => {
    const run = at({
      gems: [
        { kind: 'gold', ...CENTER, value: 10 },
        { kind: 'wood', ...CENTER, value: 3 },
        { ...CENTER, value: 1 },
      ],
    });
    const [s] = ticks(run, 1);
    expect(s?.pickups).toEqual([]);
    expect(s?.resources).toEqual({ gold: 10, wood: 3 });
    expect(s?.progression.xp).toBe(1);
  });

  it('Scenario: Solo suben (golpe de 10 y subida de nivel: oro 25 y madera 6)', () => {
    const hitter = aProbeType({ id: 'goblin-torch', speed: 1e-6, damage: 10, health: 1e6 });
    const c = aContactConfig({ types: [hitter] });
    const run = startRun(c, {
      player: CENTER,
      enemies: [{ type: 'goblin-torch', ...CENTER }],
      gems: [{ ...CENTER, value: 5 }],
      resources: { gold: 25, wood: 6 },
    });
    const [s] = ticks(run, 1);
    expect(s?.player.health).toBe(90);
    expect(s?.progression.level).toBe(2);
    expect(s?.resources).toEqual({ gold: 25, wood: 6 });
  });

  it('Scenario: Valores grandes (99.990 + 10 = 100.000 exacto)', () => {
    const run = at({
      gems: [{ kind: 'gold', ...CENTER, value: 10 }],
      resources: { gold: 99_990, wood: 0 },
    });
    const [s] = ticks(run, 1);
    expect(s?.resources.gold).toBe(100_000);
  });

  it('Scenario: Tipos del snapshot (1 de cada tipo: tipo, valor, posición, radio 5 e id)', () => {
    const run = at({
      gems: [
        { x: 1000, y: 900, value: 2 },
        { kind: 'gold', x: 1100, y: 900, value: 8 },
        { kind: 'wood', x: 1200, y: 900, value: 3 },
      ],
    });
    expect(run.snapshot().pickups).toEqual([
      { id: 0, kind: 'xp', value: 2, x: 1000, y: 900, radius: 5 },
      { id: 1, kind: 'gold', value: 8, x: 1100, y: 900, radius: 5 },
      { id: 2, kind: 'wood', value: 3, x: 1200, y: 900, radius: 5 },
    ]);
    expect(run.snapshot().gems).toEqual([{ id: 0, x: 1000, y: 900, radius: 5 }]);
  });

  it('Scenario: Recogibles de varios tipos en el snapshot (g1 recogida: w1, o1, w2)', () => {
    const run = at({
      gems: [
        { kind: 'wood', x: 1000, y: 900, value: 1 },
        { ...CENTER, value: 1 },
        { kind: 'gold', x: 1100, y: 900, value: 2 },
        { kind: 'wood', x: 1200, y: 900, value: 1 },
      ],
    });
    const [s] = ticks(run, 1);
    expect(s?.pickups.map((p) => [p.id, p.kind, p.value, p.radius])).toEqual([
      [0, 'wood', 1, 5],
      [2, 'gold', 2, 5],
      [3, 'wood', 1, 5],
    ]);
  });
});

describe('Recursos en el tick de la victoria (spec simulation-loop)', () => {
  /** Atraídos a 738 px: se recogerían en el tick 120 (738 − 6 · 120 < 21 ≤ 738 − 6 · 119). */
  const incoming: RunSetup = {
    player: CENTER,
    gems: [
      { kind: 'gold', x: CENTER.x + 738, y: 270, value: 4, attracted: true },
      { kind: 'wood', x: CENTER.x + 738, y: 270, value: 2, attracted: true },
    ],
  };

  it('control: con la duración por defecto se recogen en el tick 120', () => {
    const snaps = ticks(startRun(quiet(), incoming), 120);
    expect(snaps[118]?.pickups).toHaveLength(2);
    expect(snaps[119]?.resources).toEqual({ gold: 4, wood: 2 });
  });

  it('Scenario: Sin recursos en el tick de la victoria (recogibles: siguen y contadores a 0)', () => {
    const snaps = ticks(startRun(withDuration(quiet(), 2), incoming), 120);
    const last = snaps[119];
    expect(last).toMatchObject({ status: 'over', outcome: 'won' });
    expect(last?.pickups).toHaveLength(2);
    expect(last?.resources).toEqual({ gold: 0, wood: 0 });
  });
});

describe('Azar y snapshot de los recogibles', () => {
  it('Scenario: Las gemas no consumen azar (10 gemas, 5 gold y 5 wood más)', () => {
    const c = {
      ...quiet(),
      waves: aContactConfig({ segments: [aSegment(['goblin-torch'], 5)] }).waves,
    };
    const extra = [
      ...Array.from({ length: 10 }, (_, i) => ({ x: 20 + i, y: 20, value: 1 })),
      ...Array.from({ length: 5 }, (_, i) => ({
        kind: 'gold' as const,
        x: 40 + i,
        y: 20,
        value: 1,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        kind: 'wood' as const,
        x: 60 + i,
        y: 20,
        value: 1,
      })),
    ];
    const a = new CountingRandom(new Mulberry32RandomGenerator(9));
    const b = new CountingRandom(new Mulberry32RandomGenerator(9));
    const ra = startRun(c, { player: CENTER }, a);
    const rb = startRun(c, { player: CENTER, gems: extra }, b);
    ticks(ra, 400);
    ticks(rb, 400);
    expect(a.calls).toBeGreaterThan(0);
    expect(b.calls).toBe(a.calls);
  });

  it('Scenario: Partida recién creada (mapa vacío: oro, madera, recogibles y vetas vacíos)', () => {
    const s = startRun(quiet()).snapshot();
    expect(s.resources).toEqual({ gold: 0, wood: 0 });
    expect(s.pickups).toEqual([]);
    expect(s.veins).toEqual([]);
    expect(Object.isFrozen(s.resources) && Object.isFrozen(s.pickups)).toBe(true);
  });

  it('Scenario: Snapshot no mutable desde fuera (recogibles, oro y madera)', () => {
    const run = at({
      gems: [
        { x: 1000, y: 900, value: 2 },
        { kind: 'wood', x: 1200, y: 900, value: 3 },
      ],
      resources: { gold: 7, wood: 1 },
    });
    const snap = run.snapshot();
    const tryWrite = (f: () => void) => {
      try {
        f();
      } catch {
        // congelado: en modo estricto, escribir lanza
      }
    };
    tryWrite(() => Object.assign(snap.pickups[1] ?? {}, { x: 0, kind: 'gold', value: 99 }));
    tryWrite(() => (snap.pickups as unknown as unknown[]).pop());
    tryWrite(() => Object.assign(snap.resources, { gold: 1e6, wood: 1e6 }));
    const again = run.snapshot();
    expect(again.pickups.map((p) => [p.kind, p.x, p.value])).toEqual([
      ['xp', 1000, 2],
      ['wood', 1200, 3],
    ]);
    expect(again.resources).toEqual({ gold: 7, wood: 1 });
  });
});
