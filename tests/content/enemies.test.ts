import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
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
const guard = typeOf('goblin-tnt-guard');
const patrol = only(stateOf(guard, guard.behavior.initial), 'patrol');
const alert = only(stateOf(guard, patrol.detect.to), 'alert');
const guardCharge = only(stateOf(guard, alert.exit.to), 'charge');
const back = only(stateOf(guard, alert.lose.to), 'return');
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
    // 0021: patrulla → alerta → carga → espera → alerta; pérdida → vuelta → alerta o patrulla.
    expect(only(stateOf(guard, guardCharge.to), 'wait').to).toBe(alert.name);
    expect(back.detect.to).toBe(alert.name);
    expect(back.to).toBe(guard.behavior.initial);
  });

  it('Scenario: Parámetros del barril por defecto (activación 60, radio 80, mecha 40)', () => {
    expect([barrelChase.exit?.distance, fuse.radius, fuse.ticks]).toEqual([60, 80, 40]);
    expect(Math.ceil((80 + 16 - 60) / (215 / 60))).toBe(11);
    expect(fuse.ticks).toBeGreaterThanOrEqual(11);
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
    // Guardia (0021): lanzamiento, vuelo y detecciones ≤ 360 y < abandono.
    expect(alert.exit.distance).toBeGreaterThan(guard.radius + r);
    expect(alert.exit.distance).toBeLessThanOrEqual(360);
    const flight = guardCharge.dynamite;
    expect(flight.flightTicks).toBeGreaterThanOrEqual(Math.ceil((flight.radius + r) / step));
    for (const d of [patrol.detect.distance, back.detect.distance]) {
      expect(d).toBeLessThanOrEqual(360);
      expect(d).toBeLessThan(alert.lose.distance);
    }
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
    // Dinamita de un guardia (0021), con su puesto en el mapa vacío; huye desde el tick 2.
    const y = 1000 - alert.exit.distance;
    const guarded = startRun(base, {
      player: P,
      enemies: [
        {
          type: 'goblin-tnt-guard',
          x: 1000,
          y,
          post: { x: 1000, y },
          ...inState(guardCharge.name, guardCharge.ticks - 1),
        },
      ],
    });
    expect(ticks(guarded, 1)[0]?.dynamites).toHaveLength(1);
    const fled = ticks(guarded, guardCharge.dynamite.flightTicks, PlayerInput.of(0, 1));
    const landed = guardCharge.dynamite.flightTicks + 1;
    expect(fled.at(-1)?.blasts.some((b) => b.tick === landed)).toBe(true);
    expect(fled.every((s) => s.player.health === 1e6)).toBe(true);
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

/**
 * sha256 del JSON (normalizado) de `main` antes del change: oleadas y armas (0024: las mejoras y el
 * jugador los cubren upgrades-text.test y combat-content.test).
 */
const MAIN_DIGESTS = {
  waves: 'ce5c4b3082e4e06302912116777f62879811a8a2e31b2534bc3da4b83a2028f7',
  weapons: 'bc4c0d1ac14267f69a8c903f222baa224a11dd39fb0a277b892ee8706f28d703',
} as const;
const digest = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');

describe('Presupuesto y stats intactos (run-outcome)', () => {
  it('Scenario: Presupuesto de oleadas y stats intactos', () => {
    expect({
      waves: digest(wavesJson),
      weapons: digest(weaponsJson),
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
    // 0021: del barril solo puede cambiar la vida; el único tipo nuevo es el guardia, con los stats
    // del TNT; la distancia de lanzamiento del TNT de oleada no cambia.
    const { health: barrelHealth, ...barrelStats } = stats[2] ?? { health: 0 };
    expect(barrelHealth).toBeGreaterThan(0);
    expect([stats[0], stats[1], barrelStats, stats[3]]).toEqual([
      { id: 'goblin-torch', speed: 90, radius: 10, cost: 1, damage: 5, health: 10, xp: 1 },
      { id: 'goblin-tnt', speed: 45, radius: 22, cost: 3, damage: 15, health: 45, xp: 4 },
      { id: 'goblin-barrel', speed: 70, radius: 16, cost: 2, damage: undefined, xp: 2 },
      { ...stats[1], id: 'goblin-tnt-guard' },
    ]);
    expect(stats).toHaveLength(4);
    expect(tntChase.exit?.distance).toBe(100);
    expect([config.progression.baseXp, config.progression.xpGrowth]).toEqual([9, 4]);
  });
});
