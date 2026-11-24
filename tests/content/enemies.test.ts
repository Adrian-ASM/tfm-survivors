import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import playerJson from '../../content/player.json';
import upgradesJson from '../../content/upgrades.json';
import wavesJson from '../../content/waves.json';
import weaponsJson from '../../content/weapons.json';
import type { EnemyTypeConfig } from '../../src/domain/enemy/EnemyType';
import type { StateConfig } from '../../src/domain/enemy/behavior/BehaviorConfig';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { loadRunConfig } from '../../src/infrastructure/content/loadRunConfig';
import {
  NO_UPGRADES,
  NO_WEAPONS,
  aDefaultConfig,
  inState,
  withPlayer,
  withUpgrades,
  withWeapons,
} from '../support/builders';
import { startRun, ticks } from '../support/runs';

// Contenido por defecto de los comportamientos (change 0020, spec enemy-behavior, enemy-spawning y
// run-outcome). Los valores de comportamiento son de calibración (tarea 6.2): aquí solo se fijan la
// forma, las cotas "legible y esquivable" y lo que no puede cambiar.
const loaded = loadRunConfig();
if (!loaded.ok) throw new Error(loaded.error.message);
const config = loaded.value;

const typeOf = (id: string): EnemyTypeConfig => {
  const t = config.enemies.types.find((x) => x.id === id);
  if (!t) throw new Error(`sin tipo ${id}`);
  return t;
};
const stateOf = (t: EnemyTypeConfig, name: string): StateConfig => {
  const s = t.behavior.states.find((x) => x.name === name);
  if (!s) throw new Error(`sin estado ${name}`);
  return s;
};
const kindOfState = (t: EnemyTypeConfig, name: string | undefined) =>
  t.behavior.states.find((x) => x.name === name)?.kind;

function only<K extends StateConfig['kind']>(
  s: StateConfig,
  kind: K,
): Extract<StateConfig, { kind: K }> {
  if (s.kind !== kind) throw new Error(`se esperaba ${kind} y es ${s.kind}`);
  return s as Extract<StateConfig, { kind: K }>;
}

const torch = typeOf('goblin-torch');
const barrel = typeOf('goblin-barrel');
const tnt = typeOf('goblin-tnt');
const barrelChase = only(stateOf(barrel, barrel.behavior.initial), 'chase');
const tntChase = only(stateOf(tnt, tnt.behavior.initial), 'chase');
const fuse = only(stateOf(barrel, barrelChase.exit?.to ?? ''), 'fuse');
const charge = only(stateOf(tnt, tntChase.exit?.to ?? ''), 'charge');
const step = config.player.speed / 60;
const r = config.player.radius;

describe('Comportamientos del contenido por defecto', () => {
  it('Scenario: Comportamientos del contenido por defecto', () => {
    expect(torch.behavior.states).toHaveLength(1);
    expect(only(stateOf(torch, torch.behavior.initial), 'chase').exit).toBeUndefined();
    expect(kindOfState(barrel, barrelChase.exit?.to)).toBe('fuse');
    expect(kindOfState(tnt, tntChase.exit?.to)).toBe('charge');
    const wait = only(stateOf(tnt, charge.to), 'wait');
    expect(wait.to).toBe(tnt.behavior.initial);
  });

  it('Scenario: Sin contacto del barril por defecto', () => {
    expect(barrel.damage).toBeUndefined();
  });

  it('Scenario: Cotas del contenido por defecto', () => {
    const activation = barrelChase.exit?.distance ?? 0;
    const launch = tntChase.exit?.distance ?? 0;
    expect(activation).toBeLessThan(fuse.radius);
    expect(fuse.ticks).toBeGreaterThanOrEqual(Math.ceil((fuse.radius + r - activation) / step));
    expect(launch).toBeGreaterThan(tnt.radius + r);
    expect(launch).toBeLessThanOrEqual(360);
    const { flightTicks, radius } = charge.dynamite;
    expect(flightTicks).toBeGreaterThanOrEqual(Math.ceil((radius + r) / step));
  });

  it('Scenario: Esquiva con el contenido por defecto (dinamita y barril)', () => {
    const base = withPlayer(withUpgrades(withWeapons(aDefaultConfig(), NO_WEAPONS), NO_UPGRADES), {
      maxHealth: 1e6,
    });
    const P = { x: 1000, y: 1000 };
    // Dinamita recién lanzada al jugador en el tick 1; huye en línea recta desde el tick 2.
    const thrown = startRun(base, {
      player: P,
      enemies: [
        {
          type: 'goblin-tnt',
          x: 1000,
          y: 1000 - (tntChase.exit?.distance ?? 0),
          ...inState(charge.name, charge.ticks - 1),
        },
      ],
    });
    const [first] = ticks(thrown, 1);
    expect(first?.dynamites).toHaveLength(1);
    const after = ticks(thrown, charge.dynamite.flightTicks, PlayerInput.of(0, 1));
    expect(after.at(-1)?.blasts.some((b) => b.tick === charge.dynamite.flightTicks + 1)).toBe(true);
    expect(after.every((s) => s.player.health === 1e6)).toBe(true);
    // Barril que acaba de entrar en mecha a la distancia de activación; huye desde el tick 1.
    const lit = startRun(base, {
      player: P,
      enemies: [
        {
          type: 'goblin-barrel',
          x: 1000 + (barrelChase.exit?.distance ?? 0),
          y: 1000,
          ...inState(fuse.name),
        },
      ],
    });
    const run = ticks(lit, fuse.ticks, PlayerInput.of(-1, 0));
    expect(run.at(-1)?.blasts).toHaveLength(1);
    expect(run.every((s) => s.player.health === 1e6)).toBe(true);
  });

  it('Scenario: Velocidad por tipo · Dos tipos, dos velocidades (el TNT sigue en persecución)', () => {
    const base = withUpgrades(withWeapons(aDefaultConfig(), NO_WEAPONS), NO_UPGRADES);
    const run = startRun(base, {
      player: { x: 900, y: 270 },
      enemies: [
        { type: 'goblin-torch', x: 100, y: 100 },
        { type: 'goblin-tnt', x: 100, y: 440 },
      ],
    });
    const snaps = ticks(run, 60);
    const [t, n] = snaps.at(-1)?.enemies ?? [];
    expect(Math.hypot((t?.x ?? 0) - 100, (t?.y ?? 0) - 100)).toBeCloseTo(90, 3);
    expect(Math.hypot((n?.x ?? 0) - 100, (n?.y ?? 0) - 440)).toBeCloseTo(45, 3);
    expect(snaps.every((s) => s.enemies[1]?.stateKind === 'chase')).toBe(true);
  });
});

/** sha256 del JSON (normalizado) de `main` antes del change: oleadas, armas, mejoras y jugador. */
const MAIN_DIGESTS = {
  waves: 'ce5c4b3082e4e06302912116777f62879811a8a2e31b2534bc3da4b83a2028f7',
  weapons: 'bc4c0d1ac14267f69a8c903f222baa224a11dd39fb0a277b892ee8706f28d703',
  upgrades: 'bc89143d0570d23e8cfab229294637a328d9d14bffdff006866192ef886beba9',
  player: '6e5dc270b8372f9b7e4cecc364e4231ff924d07dd77a8df293aaac72a0f22c08',
} as const;
const digest = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');

describe('Presupuesto y stats intactos (run-outcome)', () => {
  it('Scenario: Presupuesto de oleadas y stats intactos', () => {
    expect({
      waves: digest(wavesJson),
      weapons: digest(weaponsJson),
      upgrades: digest(upgradesJson),
      player: digest(playerJson),
    }).toEqual(MAIN_DIGESTS);
    expect([config.waves.maxAlive, config.waves.spawn.ringRadius, config.player.speed]).toEqual([
      300, 1500, 215,
    ]);
    const stats = config.enemies.types.map(({ id, speed, radius, cost, damage, health, xp }) => ({
      id,
      speed,
      radius,
      cost,
      damage,
      health,
      xp,
    }));
    expect(stats).toEqual([
      { id: 'goblin-torch', speed: 90, radius: 10, cost: 1, damage: 5, health: 10, xp: 1 },
      { id: 'goblin-tnt', speed: 45, radius: 22, cost: 3, damage: 15, health: 45, xp: 4 },
      { id: 'goblin-barrel', speed: 70, radius: 16, cost: 2, damage: undefined, health: 20, xp: 2 },
    ]);
  });
});
