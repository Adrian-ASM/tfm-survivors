import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { cellsWith, mapRules } from '../support/mapLayouts';
import { ticks } from '../support/runs';
import { SHEEP_AT, aSheepConfig, firstAt, r3, startWithSheep } from '../support/sheep';

const states = (snaps: readonly RunSnapshot[], from: number, to: number) =>
  snaps.slice(from - 1, to).map((s) => s.sheep[0]?.state);
const at = (snaps: readonly RunSnapshot[], tick: number) => firstAt(snaps[tick - 1]);

// Spec sheep (0023), "Huida del jugador".
describe('Huida del jugador (spec sheep)', () => {
  it('Scenario: Huida en línea recta (997 tras el 1, 949 tras el 17; pasto del 18 al 137)', () => {
    const run = startWithSheep(aSheepConfig(), [SHEEP_AT], { player: { x: 1150, y: 1000 } });
    const snaps = ticks(run, 138);
    expect(at(snaps, 1)).toEqual([997, 1000]);
    expect(at(snaps, 17)).toEqual([949, 1000]);
    expect(states(snaps, 1, 17).every((s) => s === 'flee')).toBe(true);
    for (let t = 18; t <= 137; t++) {
      expect([snaps[t - 1]?.sheep[0]?.state, ...at(snaps, t)], `tick ${String(t)}`).toEqual([
        'graze',
        949,
        1000,
      ]);
    }
    expect(snaps[137]?.sheep[0]?.state).toBe('wander');
  });

  it('Scenario: Tangencia con el radio de huida (distancia 200: sigue en pasto 120 ticks)', () => {
    const run = startWithSheep(aSheepConfig(), [SHEEP_AT], { player: { x: 1200, y: 1000 } });
    for (const s of ticks(run, 120)) {
      expect([s.sheep[0]?.state, ...firstAt(s)]).toEqual(['graze', 1000, 1000]);
    }
  });

  it('Scenario: Huida con la posición del jugador ya movido (1.203 → 1.199,417: huye a 997)', () => {
    const run = startWithSheep(aSheepConfig(), [SHEEP_AT], { player: { x: 1203, y: 1000 } });
    const [s] = ticks(run, 1, PlayerInput.of(-1, 0));
    expect(r3(s?.player.x)).toBe(1199.417);
    expect([s?.sheep[0]?.state, ...firstAt(s)]).toEqual(['flee', 997, 1000]);
  });

  it('Scenario: Jugador sobre la oveja (huye en (1, 0): (1.003, 1.000))', () => {
    const run = startWithSheep(aSheepConfig(), [SHEEP_AT], { player: SHEEP_AT });
    const [s] = ticks(run, 1);
    expect([s?.sheep[0]?.state, ...firstAt(s)]).toEqual(['flee', 1003, 1000]);
  });

  it('Scenario: Un enemigo no la espanta (goblin-torch por su posición en el tick 50)', () => {
    const setup = {
      player: { x: 1300, y: 1000 },
      enemies: [{ type: 'goblin-torch', x: 925, y: 1000 }],
    };
    const a = ticks(startWithSheep(aSheepConfig(), [SHEEP_AT], setup), 120);
    const b = ticks(startWithSheep(aSheepConfig(), [], setup), 120);
    expect(r3(a[49]?.enemies[0]?.x)).toBe(1000);
    for (const s of a) expect([s.sheep[0]?.state, ...firstAt(s)]).toEqual(['graze', 1000, 1000]);
    expect(a.map((s) => s.enemies)).toEqual(b.map((s) => s.enemies));
  });

  it('Ovejas en el snapshot del motor (tick 1: misma oveja en (997, 1.000), en huida)', () => {
    const run = startWithSheep(aSheepConfig(), [SHEEP_AT], { player: { x: 1150, y: 1000 } });
    const [s] = ticks(run, 1);
    expect(s?.sheep).toHaveLength(1);
    expect(s?.sheep[0]).toMatchObject({ id: 0, state: 'flee', health: 12 });
    expect(firstAt(s)).toEqual([997, 1000]);
  });
});

// Spec sheep (0023), "Movimiento de las ovejas por el mapa".
describe('Movimiento por el mapa (spec sheep)', () => {
  it('Scenario: Huida contra un tronco (tangente en (980, 1.000) del tick 7 al 60, en huida)', () => {
    const cells = cellsWith(mapRules(), { '15,16': 'trunk' });
    const run = startWithSheep(aSheepConfig(), [SHEEP_AT], { player: { x: 1100, y: 1000 } }, { cells });
    const snaps = ticks(run, 60);
    expect(at(snaps, 6)).toEqual([982, 1000]);
    for (let t = 7; t <= 60; t++) expect(at(snaps, t), `tick ${String(t)}`).toEqual([980, 1000]);
    expect(snaps.every((s) => s.sheep[0]?.state === 'flee')).toBe(true);
    expect(snaps.every((s) => (s.sheep[0]?.x ?? 0) - 20 >= 960 - 1e-9)).toBe(true);
  });

  it('Scenario: El puente es caminable para la oveja (fila 9 de agua salvo (16, 9): (990, 590))', () => {
    const layout: Record<string, 'water' | 'bridge'> = {};
    for (let c = 0; c < 64; c++) layout[`${String(c)},9`] = c === 16 ? 'bridge' : 'water';
    const cells = cellsWith(mapRules(), layout);
    const run = startWithSheep(
      aSheepConfig(),
      [{ x: 990, y: 500 }],
      { player: { x: 990, y: 400 } },
      { cells },
    );
    expect(firstAt(ticks(run, 30).at(-1))).toEqual([990, 590]);
  });
});

// Spec sheep (0023), "Deambular de las ovejas".
describe('Deambular (spec sheep)', () => {
  it('Scenario: Pasto y paseo de una oveja declarada (pasto 0–120, paseo 121–180, pasto 181–300)', () => {
    const run = startWithSheep(aSheepConfig());
    const snaps = [run.snapshot(), ...ticks(run, 300)];
    for (let t = 0; t <= 120; t++) {
      expect([snaps[t]?.sheep[0]?.state, ...firstAt(snaps[t])], `tick ${String(t)}`).toEqual([
        'graze',
        1000,
        1000,
      ]);
    }
    const step = (t: number) => {
      const a = snaps[t - 1]?.sheep[0];
      const b = snaps[t]?.sheep[0];
      return [r3((b?.x ?? 0) - (a?.x ?? 0)), r3((b?.y ?? 0) - (a?.y ?? 0))];
    };
    const first = step(121);
    expect(Math.hypot(first[0] ?? 0, first[1] ?? 0)).toBeCloseTo(1, 3);
    for (let t = 121; t <= 180; t++) {
      expect(snaps[t]?.sheep[0]?.state, `tick ${String(t)}`).toBe('wander');
      expect(step(t), `tick ${String(t)}`).toEqual(first);
    }
    const parked = firstAt(snaps[180]);
    for (let t = 181; t <= 300; t++) {
      expect([snaps[t]?.sheep[0]?.state, ...firstAt(snaps[t])], `tick ${String(t)}`).toEqual([
        'graze',
        ...parked,
      ]);
    }
  });

  it('Scenario: Vuelta al origen fuera del radio de pasto (1.399 tras el 121, 1.340 tras el 180, 1.280 tras el 360)', () => {
    const run = startWithSheep(aSheepConfig(), [{ x: 1400, y: 1000 }], {
      sheep: [{ origin: SHEEP_AT }],
    });
    const snaps = ticks(run, 360);
    expect(at(snaps, 121)).toEqual([1399, 1000]);
    expect(at(snaps, 180)).toEqual([1340, 1000]);
    for (let t = 181; t <= 300; t++) expect(at(snaps, t)).toEqual([1340, 1000]);
    expect(at(snaps, 360)).toEqual([1280, 1000]);
  });

  it('Scenario: Límite exacto del radio de pasto (a 300 del origen: la dirección del azar)', () => {
    const move = (x: number) => {
      const setup = x === 1000 ? {} : { sheep: [{ origin: SHEEP_AT }] };
      const snaps = ticks(startWithSheep(aSheepConfig(), [{ x, y: 1000 }], setup), 180);
      const a = snaps[119]?.sheep[0];
      const b = snaps[179]?.sheep[0];
      return [r3(((b?.x ?? 0) - (a?.x ?? 0)) / 60), r3(((b?.y ?? 0) - (a?.y ?? 0)) / 60)];
    };
    expect(move(1300)).toEqual(move(1000));
  });

  it('Scenario: Una oveja que no huye no se aleja de su origen (≤ 360 durante 36.000 ticks)', () => {
    const run = startWithSheep(aSheepConfig());
    let far = 0;
    for (let t = 0; t < 36_000; t++) {
      run.tick(PlayerInput.NONE);
      const o = run.snapshot().sheep[0];
      far = Math.max(far, Math.hypot((o?.x ?? 0) - 1000, (o?.y ?? 0) - 1000));
    }
    expect(far).toBeGreaterThan(0);
    expect(far).toBeLessThanOrEqual(360);
  });
});
