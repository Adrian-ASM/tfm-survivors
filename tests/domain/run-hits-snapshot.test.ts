import { describe, expect, it } from 'vitest';
import { seededRun } from '../../src/composition/seedSource';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import type { TerrainSource } from '../../src/domain/map/TerrainSource';
import {
  DEFAULT_CHARACTER_UPGRADES,
  LINTER,
  TESTS,
  aDefaultConfig,
  aStillType,
  withCombat,
  upgradesOf,
  withUpgrades,
} from '../support/builders';
import { aHitConfig, hitsOfTick, linterArrival, untilHit } from '../support/combat';
import { heldInputs } from '../support/inputs';
import { CountingRandom } from '../support/random';
import { chooseFirstWhileOpen, startRun, startSeededRun, ticks } from '../support/runs';
import { startAtDoor } from '../support/shop';
import { aPulse } from '../support/weapons';

const tryWrite = (f: () => void) => {
  try {
    f();
  } catch {
    // congelado: en modo estricto, escribir lanza
  }
};

/** Partida sembrada como en producción con cada generador envuelto para contar sus valores. */
function countedSeeded(config: RunConfig, seed: number) {
  const s = seededRun(seed);
  if (s.terrain.kind !== 'generated') throw new Error('se esperaba el mapa generado');
  const g = s.terrain;
  const counted = {
    random: new CountingRandom(s.random),
    stone: new CountingRandom(s.stoneRandom),
    map: new CountingRandom(g.random),
    structure: new CountingRandom(g.structureRandom),
    resource: new CountingRandom(g.resourceRandom),
    sheep: new CountingRandom(g.sheepRandom),
    site: new CountingRandom(g.siteRandom),
  };
  const terrain: TerrainSource = {
    kind: 'generated',
    random: counted.map,
    structureRandom: counted.structure,
    resourceRandom: counted.resource,
    sheepRandom: counted.sheep,
    siteRandom: counted.site,
  };
  const r = Run.start(config, counted.random, {}, terrain, counted.stone);
  if (!r.ok) throw new Error(r.error.message);
  return { run: r.value, counted };
}

/**
 * Snapshots de `n` ticks con inputs fijos (seed 10, cada uno 120 ticks: con la semilla 42 el
 * jugador alcanza estructuras y ovejas antes del tick 600) y la política de elección fija.
 */
function playFixed(run: Run, n: number): RunSnapshot[] {
  const out: RunSnapshot[] = [];
  for (const input of heldInputs(n, 10, 120)) {
    chooseFirstWhileOpen(run);
    run.tick(input);
    out.push(run.snapshot());
    if (run.status === 'over') break;
  }
  return out;
}

/** El snapshot sin la lista de golpes (lo único que puede cambiar con otra ventana u otro tope). */
const withoutHits = (s: RunSnapshot) => ({ ...s, hits: [] });

describe('Golpes de combate en el snapshot (0031)', () => {
  it('Scenario: Golpe visible durante la ventana', () => {
    const run = startRun(aHitConfig([LINTER]), {
      player: { x: 1300, y: 1000 },
      enemies: [{ type: 'goblin-tnt', x: 1000, y: 1000 }],
    });
    const first = untilHit(run);
    const g = hitsOfTick(first)[0];
    const before = first.tick - 1;
    const after = ticks(run, 15);
    const seen = (s: RunSnapshot | undefined) => s?.hits.some((h) => h.id === g?.id) ?? false;
    expect(before).toBeGreaterThan(0);
    expect(seen(first)).toBe(true);
    expect(after.slice(0, 14).every(seen)).toBe(true);
    expect(seen(after[14])).toBe(false);
    expect(after[14]?.tick).toBe(first.tick + 15);
  });

  it('Scenario: Partida recién creada sin golpes', () => {
    expect(startSeededRun(aDefaultConfig(), 42).snapshot().hits).toEqual([]);
  });

  it('Scenario: Golpes congelados en la tienda y en la oferta', () => {
    const enemies = [0, 20, 40].map((d) => ({ type: 'goblin-tnt', x: 1020 + d, y: 1030 }));
    const shop = startAtDoor(aHitConfig([TESTS]), { enemies });
    const offer = startRun(
      withUpgrades(aHitConfig([TESTS]), upgradesOf(DEFAULT_CHARACTER_UPGRADES)),
      {
        player: { x: 1000, y: 1000 },
        enemies,
        experience: { level: 1, xp: 4 },
        gems: [{ x: 1000, y: 1000, value: 1 }],
      },
    );
    for (const [run, status] of [
      [shop, 'shopping'],
      [offer, 'choosing'],
    ] as const) {
      run.tick(PlayerInput.NONE);
      const first = run.snapshot();
      expect(first.status).toBe(status);
      const reads = Array.from({ length: 60 }, () => run.snapshot().hits);
      expect(first.hits).toHaveLength(3);
      for (const hits of reads) expect(hits).toBe(first.hits);
    }
  });

  it('Scenario: Ventana con un frame de 15 ticks', () => {
    const drum = aPulse({ cooldownTicks: 1 });
    const config = aHitConfig([drum], { types: [aStillType({ id: 'wall', health: 1e6 })] });
    const run = startRun(config, {
      player: { x: 1000, y: 1000 },
      enemies: [{ type: 'wall', x: 1030, y: 1000 }],
    });
    ticks(run, 200);
    const frame = ticks(run, 15).at(-1);
    expect(frame?.tick).toBe(215);
    expect(frame?.hits.map((h) => h.tick)).toEqual(Array.from({ length: 15 }, (_, i) => 201 + i));
  });

  it('Scenario: Golpes no mutables desde fuera', () => {
    const run = startRun(aHitConfig([LINTER]), {
      player: { x: 1200, y: 1000 },
      enemies: [{ type: 'goblin-tnt', x: 1000, y: 1000 }],
    });
    const hit = untilHit(run);
    const health = hit.enemies[0]?.health;
    const g = hitsOfTick(hit)[0];
    tryWrite(() => Object.assign(hit.hits[0] ?? {}, { amount: 99, kind: 'player' }));
    tryWrite(() => (hit.hits as unknown[]).splice(0));
    const [next] = ticks(run, 1);
    expect(next?.hits.find((h) => h.id === g?.id)).toEqual(g);
    expect(g).toMatchObject({ amount: 6, kind: 'enemy' });
    expect(next?.enemies[0]?.health).toBe(health);
  });

  it('Scenario: Golpes en el snapshot del motor', () => {
    const player = { x: 1200, y: 1000 };
    const g = { type: 'goblin-torch', x: 1000, y: 1000 };
    const n = linterArrival((w) => startRun(aHitConfig(w), { player, enemies: [g] }));
    // Un perseguidor de 10 px por tick que entra en contacto (26 px) justo en el tick n + 1.
    const hitter = aStillType({ id: 'hitter', damage: 10 });
    const chaser = {
      ...hitter,
      speed: 600,
      behavior: { initial: 'chase', states: [{ name: 'chase', kind: 'chase' as const }] },
    };
    const config = aHitConfig([LINTER], { types: [chaser] });
    const far = { type: 'hitter', x: 1200, y: 1000 + 26 + 10 * (n + 1) - 5 };
    const snaps = ticks(startRun(config, { player, enemies: [g, far] }), n + 1);
    expect(snaps.at(-1)?.hits).toEqual([
      { id: 0, tick: n, kind: 'enemy', targetId: 0, x: 1000, y: 1000, amount: 6 },
      { id: 1, tick: n + 1, kind: 'player', x: 1200, y: 1000, amount: 10 },
    ]);
  });

  it('Scenario: Partida recién creada (golpes vacíos y estructuras con vida = vida máxima)', () => {
    const s = startSeededRun(aDefaultConfig(), 42).snapshot();
    expect(s.hits).toEqual([]);
    expect(s.structures.length).toBeGreaterThan(0);
    expect(s.structures.every((t) => t.health === t.maxHealth)).toBe(true);
  });

  it('Scenario: Mismos golpes con la misma semilla', () => {
    const a = playFixed(startSeededRun(aDefaultConfig(), 42), 600).map((s) => s.hits);
    const b = playFixed(startSeededRun(aDefaultConfig(), 42), 600).map((s) => s.hits);
    expect(b).toStrictEqual(a);
    expect(a).toHaveLength(600);
    expect(a.at(-1)?.length).toBeGreaterThan(0);
  });

  it('Scenario: Otra ventana u otro tope no cambian la partida', () => {
    const narrow = countedSeeded(
      withCombat(aDefaultConfig(), { hitWindowTicks: 15, maxHitsPerTick: 1 }),
      42,
    );
    const wide = countedSeeded(
      withCombat(aDefaultConfig(), { hitWindowTicks: 60, maxHitsPerTick: 1000 }),
      42,
    );
    const a = playFixed(narrow.run, 3600);
    const b = playFixed(wide.run, 3600);
    expect(b.map(withoutHits)).toStrictEqual(a.map(withoutHits));
    const calls = (c: typeof narrow.counted) => Object.values(c).map((r) => r.calls);
    expect(calls(wide.counted)).toEqual(calls(narrow.counted));
  });
});
