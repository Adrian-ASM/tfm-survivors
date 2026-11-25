import { describe, expect, it } from 'vitest';
import { seededRun, type MapMode } from '../../src/composition/seedSource';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run, type RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import type { TerrainSource } from '../../src/domain/map/TerrainSource';
import {
  LONG_RUN_HEALTH,
  aDefaultConfig,
  aSegment,
  aWavesConfig,
  withPlayer,
  withStoneChance,
} from '../support/builders';
import { randomInputs } from '../support/inputs';
import {
  MAP_GOLDEN,
  RESOURCE_GOLDEN,
  SHEEP_GOLDEN,
  STRUCTURE_GOLDEN,
  resourceSignatureOf,
  sheepSignatureOf,
  signatureOf,
  structureSignatureOf,
} from '../support/mapGolden';
import { CountingRandom } from '../support/random';
import { chooseFirstWhileOpen, startSeededRun } from '../support/runs';
import { STONE_GOLDEN, newStones, stoneSignatureForSeed } from '../support/stoneGolden';

// Spec simulation-loop (0025), "Azar de la piedra" y "Determinismo"; resources, "Piedra por enemigo
// abatido" y "Recursos sin efecto en el combate". Test-after (ADR-0018): tiradas en los grupos 1–4.

const ALL_TYPES = (c: RunConfig) => c.enemies.types.map((t) => t.id);
const chanceAll = (c: RunConfig, p: number): RunConfig =>
  withStoneChance(c, Object.fromEntries(ALL_TYPES(c).map((id) => [id, p])));

/** Partida sembrada como `seededRun` con contadores en el azar de la partida y en el de la piedra. */
function counted(config: RunConfig, seed: number, mode: MapMode = 'generated', setup?: RunSetup) {
  const seeding = seededRun(seed, mode);
  const random = new CountingRandom(seeding.random);
  const stones = new CountingRandom(seeding.stoneRandom);
  const sheep =
    seeding.terrain.kind === 'generated' ? new CountingRandom(seeding.terrain.sheepRandom) : null;
  const terrain: TerrainSource =
    seeding.terrain.kind === 'generated' && sheep
      ? { ...seeding.terrain, sheepRandom: sheep }
      : seeding.terrain;
  const r = Run.start(config, random, setup, terrain, stones);
  if (!r.ok) throw new Error(r.error.message);
  return { run: r.value, random, stones, sheep };
}

/** Juega con la política fija hasta `n` ticks o hasta terminar y devuelve los snapshots. */
function play(run: Run, n: number, inputs?: readonly PlayerInput[]): RunSnapshot[] {
  const snaps: RunSnapshot[] = [];
  for (let i = 0; i < n && run.status !== 'over'; i++) {
    chooseFirstWhileOpen(run);
    run.tick(inputs?.[i] ?? PlayerInput.NONE);
    snaps.push(run.snapshot());
  }
  return snaps;
}

/** Piedras soltadas a lo largo de los snapshots (recogibles `stone` nuevos por id). */
function stonesDropped(snaps: readonly RunSnapshot[]): number {
  let last = -1;
  let dropped = 0;
  for (const s of snaps) {
    dropped += newStones(s, last).length;
    last = Math.max(last, ...s.pickups.map((p) => p.id));
  }
  return dropped;
}

describe('Firma dorada de las piedras (simulation-loop 0025)', () => {
  it.each([42, 123] as const)(
    'Scenario: Firma dorada de las piedras · Firma de la piedra regenerada (%i, 0027)',
    (seed) => {
      const signature = stoneSignatureForSeed(seed);

      expect(signature).toEqual(STONE_GOLDEN[seed]);
      expect(signature.dropped).toBeGreaterThanOrEqual(1);
    },
  );

  it.each([42, 123] as const)('Scenario: Firmas anteriores intactas (%i)', (seed) => {
    const run = startSeededRun(aDefaultConfig(), seed);

    expect(signatureOf(run.map.cells)).toBe(MAP_GOLDEN[seed]);
    expect(structureSignatureOf(run.map.structures)).toEqual(STRUCTURE_GOLDEN[seed]);
    expect(resourceSignatureOf(run.map)).toEqual(RESOURCE_GOLDEN[seed]);
    expect(sheepSignatureOf(run.snapshot())).toEqual(SHEEP_GOLDEN[seed]);
  });
});

describe('La piedra no toca el resto de la partida (simulation-loop y resources 0025)', () => {
  it('Scenario: Oleadas intactas (semilla 7, 3.600 ticks: enemigos, ofertas y azar iguales)', () => {
    const inputs = randomInputs(3600, 2026);
    const a = counted(aDefaultConfig(), 7);
    const b = counted(chanceAll(aDefaultConfig(), 0), 7);
    const enemies = (s: RunSnapshot) =>
      JSON.stringify([s.enemies.map((e) => [e.id, e.type, e.x, e.y, e.health, e.state]), s.offer]);
    let diverged = -1;
    for (const [i, input] of inputs.entries()) {
      chooseFirstWhileOpen(a.run);
      chooseFirstWhileOpen(b.run);
      a.run.tick(input);
      b.run.tick(input);
      const same =
        enemies(a.run.snapshot()) === enemies(b.run.snapshot()) &&
        a.random.calls === b.random.calls;
      if (!same && diverged < 0) diverged = i + 1;
    }

    expect(diverged).toBe(-1);
    expect(stonesDropped([a.run.snapshot()]) + a.run.snapshot().resources.stone).toBeGreaterThan(0);
    expect(a.random.next()).toBe(b.random.next());
  });

  it('Scenario: Valores consumidos igual a bajas (semilla 7, 14.400 ticks, ≥ 1 mecha)', () => {
    const inputs = randomInputs(14_400, 2026);
    const { run, stones } = counted(
      withPlayer(aDefaultConfig(), { maxHealth: LONG_RUN_HEALTH }),
      7,
    );
    let mismatch = -1;
    let fuseBlasts = 0;
    let lastBlast = -1;
    for (const [i, input] of inputs.entries()) {
      const before = run.snapshot();
      chooseFirstWhileOpen(run);
      run.tick(input);
      const s = run.snapshot();
      const fresh = s.blasts.filter((b) => b.id > lastBlast);
      for (const b of s.blasts) lastBlast = Math.max(lastBlast, b.id);
      const fromFuse = (x: number, y: number) =>
        before.warnings.some((w) => w.source === 'fuse' && w.x === x && w.y === y);
      fuseBlasts += fresh.filter((b) => fromFuse(b.x, b.y)).length;
      if (stones.calls !== s.kills && mismatch < 0) mismatch = i + 1;
    }

    expect(mismatch).toBe(-1);
    expect(fuseBlasts).toBeGreaterThanOrEqual(1);
    expect(run.snapshot().kills).toBeGreaterThan(0);
  });

  it('Scenario: Ninguna otra fuente de piedra (probabilidad 0, semilla 7, 36.000 ticks)', () => {
    const config = chanceAll(withPlayer(aDefaultConfig(), { maxHealth: LONG_RUN_HEALTH }), 0);
    const inputs = randomInputs(36_000, 2026);
    const { run } = counted(config, 7);
    let stoneSeen = false;
    for (const input of inputs) {
      chooseFirstWhileOpen(run);
      run.tick(input);
      const s = run.snapshot();
      stoneSeen ||= s.resources.stone !== 0 || s.pickups.some((p) => p.kind === 'stone');
    }

    expect(run.snapshot().kills).toBeGreaterThan(0);
    expect(stoneSeen).toBe(false);
  }, 60_000);

  it('Scenario: La piedra solo consume su azar (0 frente a 100: 3 bajas, 2 piedras recogidas)', () => {
    const P = { x: 1950, y: 1250 };
    const quiet = (p: number) => {
      const base = aDefaultConfig();
      const noWaves = aWavesConfig({ segments: [aSegment(['goblin-torch'], 0)] }).waves;
      return chanceAll({ ...base, waves: noWaves }, p);
    };
    const setup: RunSetup = {
      player: P,
      enemies: [
        { type: 'goblin-torch', x: P.x + 8, y: P.y, health: 4 },
        { type: 'goblin-torch', x: P.x - 8, y: P.y, health: 4 },
        { type: 'goblin-torch', x: P.x, y: P.y + 100, health: 4 },
      ],
    };
    const after = (p: number) => {
      const c = counted(quiet(p), 7, 'generated', setup);
      c.run.tick(PlayerInput.NONE);
      const s = c.run.snapshot();
      return {
        kills: s.kills,
        stone: s.resources.stone,
        offer: s.offer.length,
        calls: [c.random.calls, c.sheep?.calls, c.stones.calls],
        next: [c.random.next(), c.sheep?.next(), c.stones.next()],
      };
    };
    const without = after(0);
    const withStone = after(100);

    expect([without.kills, without.stone, withStone.kills, withStone.stone]).toEqual([3, 0, 3, 2]);
    expect([without.offer, withStone.offer]).toEqual([0, 0]);
    expect(withStone.calls).toEqual(without.calls);
    expect(withStone.calls[2]).toBe(3);
    expect(withStone.next).toEqual(without.next);
  });
});

describe('Partidas con piedra reproducibles (simulation-loop "Determinismo" 0025)', () => {
  it('Scenario: Partida con piedra reproducible (semilla 11, 14.400 ticks, vida 1.000)', () => {
    const config = withPlayer(aDefaultConfig(), { maxHealth: 1000 });
    const inputs = randomInputs(14_400, 99);
    const a = play(startSeededRun(config, 11), 14_400, inputs);
    const b = play(startSeededRun(config, 11), 14_400, inputs);

    expect(stonesDropped(a)).toBeGreaterThanOrEqual(1);
    expect(a.some((s) => s.resources.stone > 0)).toBe(true);
    expect(b).toStrictEqual(a);
  }, 60_000);

  it.each([['generated'], ['empty']] as const)(
    'Scenario: Piedra con el mapa vacío y reproducible (semilla 7, mapa %s, quieto)',
    (mode) => {
      const a = play(startSeededRun(aDefaultConfig(), 7, mode), 36_000);
      const b = play(startSeededRun(aDefaultConfig(), 7, mode), 36_000);

      expect(a.at(-1)?.status).toBe('over');
      expect(stonesDropped(a)).toBeGreaterThanOrEqual(1);
      expect(b).toStrictEqual(a);
    },
    60_000,
  );
});
