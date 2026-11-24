import { describe, expect, it } from 'vitest';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import {
  DEFAULT_ENEMY_TYPES,
  aBarrelType,
  aSegment,
  aTntType,
  aWaitType,
  aWavesConfig,
  inState,
  withWeapons,
} from '../support/builders';
import { aBehaviorConfig, enemyById, startRun, ticks } from '../support/runs';
import { aLinter, weaponsOf } from '../support/weapons';

const PLAYER = { x: 1000, y: 1000 };

const only = (s: RunSnapshot) => {
  const e = s.enemies[0];
  if (!e) throw new Error('se esperaba un enemigo');
  return e;
};

describe('Run · estado de comportamiento (enemy-behavior)', () => {
  it('Scenario: Salida por distancia justo en el límite', () => {
    const config = aBehaviorConfig([aWaitType()]);
    const atLimit = startRun(config, {
      player: PLAYER,
      enemies: [{ type: 'waiter', x: 1101, y: 1000 }],
    });
    const beyond = startRun(config, {
      player: PLAYER,
      enemies: [{ type: 'waiter', x: 1101.5, y: 1000 }],
    });
    const [a] = ticks(atLimit, 1);
    const [b] = ticks(beyond, 1);
    expect(a && only(a)).toMatchObject({ x: 1100, state: 'wait', stateKind: 'wait' });
    expect(b && only(b)).toMatchObject({ x: 1100.5, state: 'chase', stateKind: 'chase' });
  });

  it('Scenario: Barril que ya está dentro al aparecer en el escenario', () => {
    const run = startRun(aBehaviorConfig([aBarrelType()]), {
      player: PLAYER,
      enemies: [{ type: 'goblin-barrel', x: 1030, y: 1000 }],
    });
    const [s] = ticks(run, 1);
    const barrel = s && only(s);
    expect(barrel?.stateKind).toBe('fuse');
    expect(barrel?.x).toBeCloseTo(1028.833, 3);
  });

  it('Scenario: Un enemigo en espera no persigue', () => {
    const run = startRun(aBehaviorConfig([aWaitType()]), {
      player: { x: 480, y: 270 },
      enemies: [{ type: 'waiter', x: 100, y: 270, ...inState('wait') }],
    });
    const snaps = ticks(run, 60);
    expect(snaps.map((s) => [only(s).x, only(s).y])).toEqual(snaps.map(() => [100, 270]));
    expect(snaps.every((s) => only(s).stateKind === 'wait')).toBe(true);
  });

  it('Scenario: La espera termina antes de moverse', () => {
    const run = startRun(aBehaviorConfig([aTntType()]), {
      player: PLAYER,
      enemies: [{ type: 'goblin-tnt', x: 1300, y: 1000, ...inState('reload', 59) }],
    });
    const [s] = ticks(run, 1);
    const tnt = s && only(s);
    expect(tnt?.stateKind).toBe('chase');
    expect(tnt?.state).toBe('approach');
    expect(tnt?.x).toBeCloseTo(1300 - 0.75, 3);
  });

  it('Scenario: El daño no cambia el estado', () => {
    const tnt = aTntType({ chargeTicks: 20 });
    const base = aBehaviorConfig([tnt], { player: { maxHealth: 1e6 } });
    const setup = {
      player: PLAYER,
      enemies: [{ type: 'goblin-tnt', x: 1150, y: 1000, ...inState('aim') }],
    };
    const quiet = startRun(base, setup);
    const shot = startRun(withWeapons(base, weaponsOf([aLinter()])), setup);
    const a = ticks(quiet, 100);
    const b = ticks(shot, 100);
    expect(b.some((s) => only(s).health < 45)).toBe(true);
    const view = (s: RunSnapshot) => {
      const e = only(s);
      return [e.state, e.stateKind, e.x, e.y];
    };
    expect(b.map(view)).toEqual(a.map(view));
  });

  it('Scenario: Estado inicial al aparecer (contenido por defecto)', () => {
    const config = aWavesConfig({
      types: DEFAULT_ENEMY_TYPES,
      segments: [aSegment(['goblin-torch', 'goblin-tnt', 'goblin-barrel'], 60)],
    });
    const run = startRun(config);
    const seen = new Map<string, { state: string; stateKind: string }>();
    const known = new Set<number>();
    for (const s of ticks(run, 120)) {
      for (const e of s.enemies) {
        if (known.has(e.id)) continue;
        known.add(e.id);
        if (!seen.has(e.type)) seen.set(e.type, { state: e.state, stateKind: e.stateKind });
      }
    }
    const initial = Object.fromEntries(
      DEFAULT_ENEMY_TYPES.map((t) => [t.id, { state: t.behavior.initial, stateKind: 'chase' }]),
    );
    expect(Object.fromEntries(seen)).toEqual(initial);
  });

  it('Scenario: Estado de comportamiento en el snapshot', () => {
    const run = startRun(aBehaviorConfig([aBarrelType(), aTntType()]), {
      player: PLAYER,
      enemies: [
        { type: 'goblin-barrel', x: 1500, y: 1000, ...inState('fuse') },
        { type: 'goblin-tnt', x: 500, y: 1500, ...inState('reload') },
      ],
    });
    const s = run.snapshot();
    expect(enemyById(s, 0)).toMatchObject({ state: 'fuse', stateKind: 'fuse' });
    expect(enemyById(s, 1)).toMatchObject({ state: 'reload', stateKind: 'wait' });
  });

  it('Scenario: Enemigos en el snapshot (en su estado de persecución)', () => {
    const config = aWavesConfig({ segments: [aSegment(['goblin-torch'], 1)] });
    const s = ticks(startRun(config), 615).at(-1);
    expect(s?.enemies.length).toBe(10);
    expect(s?.enemies.every((e) => e.state === 'chase' && e.stateKind === 'chase')).toBe(true);
  });
});

describe('Run · peligros en el snapshot (simulation-loop)', () => {
  it('Scenario: Partida recién creada (sin dinamitas, avisos ni explosiones, congeladas)', () => {
    const s = startRun(aBehaviorConfig([aTntType()])).snapshot();
    expect([s.dynamites, s.warnings, s.blasts]).toEqual([[], [], []]);
    expect([s.dynamites, s.warnings, s.blasts].every((l) => Object.isFrozen(l))).toBe(true);
  });
});
