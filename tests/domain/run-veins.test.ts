import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import {
  aDefaultConfig,
  aDynamite,
  aSegment,
  aWavesConfig,
  withDuration,
  withPlayer,
  withResources,
} from '../support/builders';
import { startOn } from '../support/camps';
import { ticks } from '../support/runs';

// Vetas de oro al pasar (spec resources) y su lugar en el tick y el snapshot (simulation-loop).
// Mapa vacío con vetas declaradas; contenido por defecto sin oleadas, oro por veta 15 y radio 24.

const V1 = { x: 1000, y: 1000 };
const V2 = { x: 2000, y: 1000 };

const veinConfig = (patch: Partial<RunConfig> = {}): RunConfig => {
  const base = aDefaultConfig();
  return {
    ...withResources(base, {
      ...base.resources,
      goldVeins: { ...base.resources.goldVeins, gold: 15, radius: 24 },
    }),
    waves: aWavesConfig({ segments: [aSegment(['goblin-torch'], 0)] }).waves,
    ...patch,
  };
};

const withVeins = (
  veins: readonly { x: number; y: number }[],
  setup: RunSetup,
  config: RunConfig = veinConfig(),
) => startOn(config, { kind: 'open', resources: { veins } }, setup);

const vein = (s: RunSnapshot | undefined, i = 0) => s?.veins[i];

describe('Vetas de oro al pasar (resources)', () => {
  it('Scenario: Veta tocada (distancia 39,9 < 40: oro 15 y agotada)', () => {
    const [s] = ticks(withVeins([V1], { player: { x: 1039.9, y: 1000 } }), 1);
    expect(s?.resources.gold).toBe(15);
    expect(vein(s)?.depleted).toBe(true);
  });

  it('Scenario: Tangencia no es contacto (distancia 40 durante 600 ticks)', () => {
    const snaps = ticks(withVeins([V1], { player: { x: 1040, y: 1000 } }), 600);
    expect(snaps.at(-1)?.resources.gold).toBe(0);
    expect(snaps.every((s) => vein(s)?.depleted === false)).toBe(true);
  });

  it('una veta ya agotada al empezar (RunSetup) no entrega nada', () => {
    const run = withVeins([V1], { player: { ...V1 }, veins: [{ depleted: true }] });
    const snaps = ticks(run, 60);
    expect(snaps.every((s) => s.resources.gold === 0 && vein(s)?.depleted)).toBe(true);
  });

  it('Scenario: Un solo uso (se aleja 200 px, vuelve y 600 ticks más: oro 15)', () => {
    const run = withVeins([V1], { player: { x: 1000, y: 1000 } });
    const first = ticks(run, 1);
    const speed = aDefaultConfig().player.speed / 60;
    const away = Math.round(200 / speed);
    const snaps = [
      ...first,
      ...ticks(run, away, PlayerInput.of(1, 0)),
      ...ticks(run, away, PlayerInput.of(-1, 0)),
      ...ticks(run, 600),
    ];
    expect(snaps.at(-1)?.player.x).toBeCloseTo(1000, 6);
    expect(snaps.every((s) => s.resources.gold === 15 && vein(s)?.depleted === true)).toBe(true);
  });

  it('Scenario: Dos vetas en el mismo tick (15 + 20 = 35, ambas agotadas)', () => {
    const near = [V1, { x: 1030, y: 1000 }];
    const run = withVeins(near, { player: { x: 1015, y: 1000 }, veins: [{}, { gold: 20 }] });
    const s = run.snapshot();
    expect(s.veins.map((v) => v.gold)).toEqual([15, 20]);
    const [after] = ticks(run, 1);
    expect(after?.resources.gold).toBe(35);
    expect(after?.veins.map((v) => v.depleted)).toEqual([true, true]);
  });

  it('Scenario: El radio de recogida no alcanza la veta (a 100 px, 600 ticks)', () => {
    const snaps = ticks(withVeins([V1], { player: { x: 1100, y: 1000 } }), 600);
    const last = snaps.at(-1);
    expect([vein(last)?.x, vein(last)?.y, vein(last)?.depleted]).toEqual([1000, 1000, false]);
    expect(last?.resources.gold).toBe(0);
  });

  it('Scenario: La veta no detiene a nadie ni recibe daño (jugador en (1.115, 1.000))', () => {
    const tough = withPlayer(veinConfig(), { maxHealth: 1e6 });
    const run = withVeins(
      [V1],
      { player: { x: 900, y: 1000 }, dynamites: [aDynamite(V1, 30, { radius: 48, damage: 20 })] },
      tough,
    );
    const snaps = ticks(run, 60, PlayerInput.of(1, 0));
    const last = snaps.at(-1);
    expect(last?.player.x).toBeCloseTo(1115, 3);
    expect(last?.player.y).toBe(1000);
    expect(vein(last)?.depleted).toBe(true);
    expect(Object.keys(vein(last) ?? {})).not.toContain('health');
    expect(snaps.every((s) => s.projectiles.length === 0 && s.pulses.length === 0)).toBe(true);
    expect(snaps[29]?.blasts).toHaveLength(1);
  });
});

describe('Vetas en el tick y en el snapshot (simulation-loop)', () => {
  /** Jugador a 215 px/s que toca V1 por primera vez en el tick 120 (468,2 px de margen). */
  const approach: RunSetup = { player: { x: 1000 - (40 + 119.5 * (215 / 60)), y: 1000 } };
  const firstContact = (s: readonly RunSnapshot[]) => s.findIndex((x) => vein(x)?.depleted) + 1;

  it('control: con la duración por defecto la veta se agota en el tick 120', () => {
    const snaps = ticks(withVeins([V1], approach), 130, PlayerInput.of(1, 0));
    expect(firstContact(snaps)).toBe(120);
  });

  it('Scenario: Sin vetas en el tick de la victoria (victoria, veta activa y oro sin cambios)', () => {
    const run = withVeins([V1], approach, withDuration(veinConfig(), 2));
    const last = ticks(run, 120, PlayerInput.of(1, 0)).at(-1);
    expect(last).toMatchObject({ status: 'over', outcome: 'won' });
    expect(vein(last)?.depleted).toBe(false);
    expect(last?.resources.gold).toBe(0);
  });

  it('Scenario: Vetas en el snapshot del motor (v1, v2; v1 agotada en el tick n)', () => {
    const run = withVeins([V1, V2], { player: { x: 1200, y: 1000 } });
    const s0 = run.snapshot();
    const snaps = ticks(run, 120, PlayerInput.of(-1, 0));
    const n = firstContact(snaps);
    const sn = snaps[n - 1];
    const fixed = (s: RunSnapshot | undefined) =>
      s?.veins.map((v) => [v.id, v.x, v.y, v.radius, v.gold]);
    expect(fixed(s0)).toEqual([
      [0, 1000, 1000, 24, 15],
      [1, 2000, 1000, 24, 15],
    ]);
    expect(fixed(sn)).toEqual(fixed(s0));
    expect(s0.veins.map((v) => v.depleted)).toEqual([false, false]);
    expect(sn?.veins.map((v) => v.depleted)).toEqual([true, false]);
  });

  it('Scenario: Recogibles antes que las vetas (gold 10 y veta 15: oro 25 en el tick n)', () => {
    const P = { x: 1020, y: 1000 };
    const [s] = ticks(withVeins([V1], { player: P, gems: [{ kind: 'gold', ...P, value: 10 }] }), 1);
    expect(s?.resources.gold).toBe(25);
    expect(s?.pickups).toEqual([]);
    expect(vein(s)?.depleted).toBe(true);
  });

  it('Scenario: Snapshot no mutable desde fuera (estado y oro de una veta y su lista)', () => {
    const run = withVeins([V1], { player: { x: 1500, y: 1000 } });
    const snap = run.snapshot();
    const tryWrite = (f: () => void) => {
      try {
        f();
      } catch {
        // congelado: en modo estricto, escribir lanza
      }
    };
    tryWrite(() => Object.assign(snap.veins[0] ?? {}, { depleted: true, gold: 999 }));
    tryWrite(() => (snap.veins as unknown as unknown[]).pop());
    expect(Object.isFrozen(snap.veins) && Object.isFrozen(snap.veins[0])).toBe(true);
    const again = run.snapshot();
    expect(again.veins).toEqual([
      { id: 0, x: 1000, y: 1000, radius: 24, gold: 15, depleted: false },
    ]);
  });
});
