import { describe, expect, it } from 'vitest';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import {
  DEFAULT_WEAPONS,
  LINTER,
  TESTS,
  aSegment,
  aWavesConfig,
  withWeapons,
} from '../support/builders';
import { aContactConfig, aProbeType, startRun, ticks } from '../support/runs';
import { weaponsOf } from '../support/weapons';

const PX = 480;
const PY = 270;
const bugType = aProbeType({ id: 'goblin-torch', speed: 90, damage: 5, health: 10 });

/** Ticks (1-based) en los que aparece algún proyectil con id no visto antes. */
function projectileTicks(snaps: readonly RunSnapshot[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const s of snaps) {
    const fresh = s.projectiles.filter((p) => !seen.has(p.id));
    if (fresh.length > 0) out.push(s.tick);
    for (const p of fresh) seen.add(p.id);
  }
  return out;
}

/** Ticks en los que se dispara un pulso (un pulso visible con `firedAt` igual al tick). */
const pulseTicks = (snaps: readonly RunSnapshot[]): number[] =>
  snaps.filter((s) => s.pulses.some((p) => p.firedAt === s.tick)).map((s) => s.tick);

/** Contenido de contacto (sin presupuesto) con el tipo dado y las armas dadas. */
const armed = (weapons = DEFAULT_WEAPONS, type = aProbeType()): RunConfig =>
  withWeapons(aContactConfig({ types: [type] }), weapons);

describe('Run · paso de armas en el tick', () => {
  it('Scenario: Disparo en el tick 1 (bug a 50 px: 1 proyectil y 1 pulso)', () => {
    const bug = aProbeType({ health: 100, speed: 0.001 });
    const run = startRun(armed(DEFAULT_WEAPONS, bug), {
      enemies: [{ type: 'probe', x: PX + 50, y: PY }],
    });
    const [s1] = ticks(run, 1);
    expect([s1?.projectiles.length, s1?.pulses.length]).toEqual([1, 1]);
  });

  it('Scenario: Cadencia con objetivo permanente (Linter 1…181 cada 30; Tests 1, 91, 181)', () => {
    const tough = aProbeType({ health: 1000, speed: 0.001 });
    const run = startRun(armed(DEFAULT_WEAPONS, tough), {
      enemies: [{ type: 'probe', x: PX + 50, y: PY }],
    });
    const snaps = ticks(run, 181);
    expect(projectileTicks(snaps)).toEqual([1, 31, 61, 91, 121, 151, 181]);
    expect(pulseTicks(snaps)).toEqual([1, 91, 181]);
  });

  it('Scenario: Las armas apuntan tras la persecución (101 → 99,5: pulso y vida 6)', () => {
    const bug = aProbeType({ id: 'goblin-torch', speed: 90, health: 10, damage: 5 });
    const run = startRun(armed(weaponsOf([TESTS]), bug), {
      enemies: [{ type: 'goblin-torch', x: PX + 101, y: PY }],
    });
    const [s1] = ticks(run, 1);
    expect(s1?.pulses).toHaveLength(1);
    expect(s1?.enemies.map((e) => [e.x, e.health])).toEqual([[PX + 99.5, 6]]);
  });

  it('Scenario: Un enemigo recién aparecido no es objetivo en su tick de aparición', () => {
    // Vista pequeña, margin 0 y minDistance 0: aparece a ~71 px, dentro de alcance y del pulso.
    const base = aWavesConfig({
      segments: [aSegment(['goblin-torch'], 60)],
      spawn: { margin: 0, minDistance: 0 },
    });
    const config: RunConfig = withWeapons(
      { ...base, arena: { ...base.arena, view: { width: 100, height: 100 } } },
      DEFAULT_WEAPONS,
    );
    const [s1, s2] = ticks(startRun(config), 2);
    expect(s1?.enemies.map((e) => e.health)).toEqual([10]);
    expect([s1?.projectiles.length, s1?.pulses.length]).toEqual([0, 0]);
    expect([s2?.projectiles.length, s2?.pulses.length]).toEqual([1, 1]);
  });

  it('Scenario: La baja impide el contacto en ese tick (vida del jugador sigue en 100)', () => {
    // Bug rápido (20 px/tick) a 100 px: entra en contacto en el tick 4, justo cuando lo alcanza
    // el proyectil del tick 1 (24 px frente a 20 px).
    const fast = aProbeType({ id: 'goblin-torch', speed: 1200, damage: 5, health: 10 });
    const setup = { enemies: [{ type: 'goblin-torch', x: PX + 100, y: PY, health: 4 }] };
    const control = ticks(startRun(armed(weaponsOf([]), fast), setup), 4);
    expect(control.map((s) => s.player.health)).toEqual([100, 100, 100, 95]);
    const snaps = ticks(startRun(armed(weaponsOf([LINTER]), fast), setup), 4);
    expect(snaps[2]?.enemies).toHaveLength(1);
    expect(snaps[3]?.enemies).toHaveLength(0);
    expect(snaps[3]?.player.health).toBe(100);
  });

  it('Scenario: Reposición en el mismo tick y Una baja libera el hueco antes del director (maxAlive 1)', () => {
    const config = withWeapons(
      aContactConfig({ segments: [aSegment(['goblin-torch'], 60)], maxAlive: 1, types: [bugType] }),
      weaponsOf([LINTER]),
    );
    const run = startRun(config, {
      enemies: [{ type: 'goblin-torch', x: PX + 100, y: PY, health: 4 }],
    });
    let snap = run.snapshot();
    while (snap.enemies[0]?.id === 0 && snap.tick < 60) snap = ticks(run, 1)[0] ?? snap;
    expect(snap.tick).toBeLessThan(60);
    expect(snap.enemies).toHaveLength(1);
    expect(snap.enemies[0]?.id).not.toBe(0);
  });
});

const ready = (s: RunSnapshot | undefined): boolean[] => (s?.weapons ?? []).map((w) => w.ready);

describe('Run · snapshot con armas', () => {
  it('Scenario: Armas equipadas en una partida nueva (linter y tests cargadas, sin disparos)', () => {
    const snap = startRun(armed()).snapshot();
    expect(snap.weapons).toEqual([
      { id: 'linter', ready: true },
      { id: 'tests', ready: true },
    ]);
    expect([snap.enemies, snap.projectiles, snap.pulses]).toEqual([[], [], []]);
  });

  it('Scenario: Carga de las armas en el snapshot (Linter 31–100, Tests 91–100)', () => {
    const run = startRun(armed(DEFAULT_WEAPONS, bugType), {
      enemies: [{ type: 'goblin-torch', x: PX + 50, y: PY, health: 4 }],
    });
    const snaps = ticks(run, 100);
    expect(snaps[1]?.enemies).toEqual([]);
    const linter = snaps.map((s) => s.weapons[0]?.ready);
    const tests = snaps.map((s) => s.weapons[1]?.ready);
    expect(linter).toEqual(Array.from({ length: 100 }, (_, i) => i + 1 >= 31));
    expect(tests).toEqual(Array.from({ length: 100 }, (_, i) => i + 1 >= 91));
    expect(ready(snaps[99])).toEqual([true, true]);
  });

  it('Scenario: Pulso identificado en el snapshot (disparo en 40, leído en 43)', () => {
    // Bug lento (1 px/tick) que empieza a 139 px: entra en el radio del pulso (< 100) en el tick 40.
    const slow = aProbeType({ id: 'goblin-torch', speed: 60, health: 100 });
    const run = startRun(armed(weaponsOf([TESTS]), slow), {
      enemies: [{ type: 'goblin-torch', x: PX + 139, y: PY }],
    });
    const snaps = ticks(run, 43);
    expect(snaps.filter((s) => s.pulses.length > 0).map((s) => s.tick)).toEqual([40, 41, 42, 43]);
    expect(snaps[42]?.pulses).toEqual([{ weapon: 'tests', firedAt: 40, x: PX, y: PY, radius: 90 }]);
  });

  it('indica daño reciente de T a T + 3 (hitFlashTicks 4)', () => {
    const tough = aProbeType({ id: 'goblin-torch', speed: 60, health: 100 });
    const run = startRun(armed(weaponsOf([TESTS]), tough), {
      enemies: [{ type: 'goblin-torch', x: PX + 139, y: PY }],
    });
    const snaps = ticks(run, 45);
    const flags = snaps.slice(38, 45).map((s) => s.enemies[0]?.damaged);
    expect(flags).toEqual([false, true, true, true, true, false, false]);
  });

  it('Scenario: Snapshot no mutable desde fuera (proyectiles, pulsos y armas)', () => {
    const tough = aProbeType({ health: 1000, speed: 0.001 });
    const run = startRun(armed(DEFAULT_WEAPONS, tough), {
      enemies: [{ type: 'probe', x: PX + 300, y: PY }],
    });
    ticks(run, 10);
    const snap = run.snapshot();
    const p = snap.projectiles[0];
    expect(p).toBeDefined();
    expect(() => {
      (p as { x: number }).x = 0;
    }).toThrow(TypeError);
    expect(() => {
      (snap.projectiles as unknown[]).length = 0;
    }).toThrow(TypeError);
    expect(() => {
      (snap.pulses as unknown[]).push(1);
    }).toThrow(TypeError);
    expect(() => {
      (snap.weapons[0] as { ready: boolean }).ready = false;
    }).toThrow(TypeError);
    expect(() => {
      (snap.enemies[0] as { damaged: boolean }).damaged = true;
    }).toThrow(TypeError);
    ticks(run, 1);
    expect(run.snapshot().projectiles[0]?.x).toBeCloseTo((p?.x ?? 0) + 8, 9);
  });
});
