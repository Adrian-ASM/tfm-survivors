import { describe, expect, it } from 'vitest';
import { seededRun } from '../../src/composition/seedSource';
import type { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import type { TerrainSource } from '../../src/domain/map/TerrainSource';
import { CONTENT_BUILDINGS, aDefaultConfig, withBuildings, withPlayer } from '../support/builders';
import { builderBot } from '../support/policies';
import { CountingRandom } from '../support/random';
import { chooseFirstWhileOpen, visitShop, visitSite } from '../support/runs';

// Spec simulation-loop 0026, "Política de obra fija en los escenarios" y "Determinismo" ("Partida
// con edificios reproducible"). Semilla 42 con su mapa generado.
const CONFIG = aDefaultConfig();
const NO_SITES = withBuildings(CONFIG, {
  ...CONTENT_BUILDINGS,
  sites: { ...CONTENT_BUILDINGS.sites, count: 0 },
});

/** Partida sembrada como la composición, con contadores en el azar de partida, ovejas y piedra. */
function counted(config: RunConfig, setup = {}) {
  const seeding = seededRun(42);
  if (seeding.terrain.kind !== 'generated') throw new Error('mapa generado');
  const random = new CountingRandom(seeding.random);
  const stones = new CountingRandom(seeding.stoneRandom);
  const sheep = new CountingRandom(seeding.terrain.sheepRandom);
  const terrain: TerrainSource = { ...seeding.terrain, sheepRandom: sheep };
  const r = Run.start(config, random, setup, terrain, stones);
  if (!r.ok) throw new Error(r.error.message);
  return { run: r.value, calls: () => [random.calls, sheep.calls, stones.calls] };
}

/** Lo que la política de obra fija no puede cambiar (todo salvo fase, oferta de obra y solares). */
const comparable = (s: RunSnapshot, calls: number[]) =>
  JSON.stringify([
    s.tick,
    s.enemies,
    s.player,
    s.sheep,
    s.pickups,
    s.resources,
    s.progression,
    s.offer,
    s.upgrades,
    s.kills,
    calls,
  ]);

/** Hash corto (FNV-1a) de una cadena: firmas por tick sin guardar los snapshots enteros. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

describe('Política de obra fija (spec simulation-loop 0026)', () => {
  it('Scenario: La política de obra fija no cambia la partida (semilla 42, madera y piedra 100)', () => {
    const setup = { resources: { gold: 0, wood: 100, stone: 100 } };
    const a = counted(CONFIG, setup);
    const b = counted(NO_SITES, setup);
    // Inputs del bot v5 que visita los solares y sale sin construir, grabados en la primera.
    const bot = builderBot(CONFIG, a.run.map, { build: false });
    let opened = 0;
    const left: string[] = [];
    const right: string[] = [];
    for (let t = 0; t < 3600 && a.run.status !== 'over'; t++) {
      if (a.run.status === 'building') opened++;
      visitSite(a.run, bot);
      chooseFirstWhileOpen(a.run);
      chooseFirstWhileOpen(b.run);
      const input: PlayerInput = bot.input(a.run.snapshot());
      a.run.tick(input);
      b.run.tick(input);
      left.push(comparable(a.run.snapshot(), a.calls()));
      right.push(comparable(b.run.snapshot(), b.calls()));
    }
    expect(opened).toBeGreaterThanOrEqual(2);
    expect(left.length).toBe(right.length);
    expect(left.findIndex((x, i) => x !== right[i])).toBe(-1);
  });
});

describe('Partida con edificios reproducible (spec simulation-loop 0026)', () => {
  it('Scenario: Partida con edificios reproducible (semilla 42, bot v5, vida 1.000, torre y casa)', () => {
    const config = withPlayer(CONFIG, { maxHealth: 1000 });
    const play = () => {
      // Madera y piedra de escenario para una torre y una casa (además de lo que recoja).
      const { run } = counted(config, { resources: { gold: 0, wood: 45, stone: 15 } });
      const bot = builderBot(config, run.map);
      const built: [number, string, number, number][] = [];
      const signatures: number[] = [];
      let after = -1;
      for (let t = 0; t < 36_000 && run.status !== 'over'; t++) {
        visitShop(run, bot);
        const kind = visitSite(run, bot);
        if (kind !== null) {
          const s = run.snapshot();
          built.push([s.tick, kind, s.resources.wood, s.resources.stone]);
        }
        chooseFirstWhileOpen(run);
        run.tick(bot.input(run.snapshot()));
        signatures.push(hash(JSON.stringify(run.snapshot())));
        const both = built.some((b) => b[1] === 'house') && built.some((b) => b[1] === 'tower');
        if (both && after < 0) after = t + 3600;
        if (after >= 0 && t >= after) break;
      }
      return { built, signatures };
    };
    const first = play();
    const second = play();
    expect(first.built.map((b) => b[1])).toEqual(expect.arrayContaining(['house', 'tower']));
    expect(second.built).toEqual(first.built);
    expect(second.signatures).toEqual(first.signatures);
  });
});
