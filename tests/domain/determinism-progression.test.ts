import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { Run, RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { OfferSnapshot, RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import {
  DEFAULT_UPGRADE_LIST,
  LONG_RUN_HEALTH,
  aDefaultConfig,
  withPlayer,
} from '../support/builders';
import { randomInputs } from '../support/inputs';
import { chooseFirstWhileOpen, play, startRun } from '../support/runs';

// Determinismo con el contenido por defecto de 0005 (armas y mejoras) y la POLÍTICA DE ELECCIÓN
// FIJA (opción 0 en cada oferta) salvo donde el escenario elige otra cosa.
const run = (seed: number, config: RunConfig = aDefaultConfig(), setup?: RunSetup): Run =>
  startRun(config, setup, new Mulberry32RandomGenerator(seed));

/** Snapshots tras cada tick con los inputs dados y la política fija. */
function snapshots(r: Run, inputs: readonly PlayerInput[]): RunSnapshot[] {
  return inputs.map((input) => {
    chooseFirstWhileOpen(r);
    r.tick(input);
    return r.snapshot();
  });
}

const still = (n: number) => Array.from({ length: n }, () => PlayerInput.NONE);

describe('Determinismo con progresión y elecciones', () => {
  it('Scenario: Dos partidas idénticas (semilla 42, 600 inputs, política fija)', () => {
    const inputs = randomInputs(600, 2026);
    const a = snapshots(run(42), inputs);
    const b = snapshots(run(42), inputs);
    for (let i = 0; i < inputs.length; i++) expect(a[i]).toStrictEqual(b[i]);
  });

  it('Scenario: Partida con progresión reproducible (semilla 7, quieto, 3.600: gema y oferta)', () => {
    const a = snapshots(run(7), still(3600));
    const b = snapshots(run(7), still(3600));
    expect(a.some((s) => s.progression.xp > 0 || s.progression.level > 1)).toBe(true);
    expect(a.some((s) => s.offer.length > 0)).toBe(true);
    expect(a.at(-1)?.upgrades.length).toBeGreaterThan(0);
    for (let i = 0; i < a.length; i++) expect(a[i]).toStrictEqual(b[i]);
  });

  it('Scenario: Partida con contactos reproducible (semilla 42, quieto, 4.800 ticks)', () => {
    const a = snapshots(run(42), still(4800));
    const b = snapshots(run(42), still(4800));
    expect(a.some((s) => s.player.health < s.player.maxHealth)).toBe(true);
    for (let i = 0; i < a.length; i++) expect(a[i]).toStrictEqual(b[i]);
  });

  it('Scenario: Partida con armas reproducible (semilla 7, quieto, 3.600 ticks, ≥ 1 baja)', () => {
    const a = snapshots(run(7), still(3600));
    const b = snapshots(run(7), still(3600));
    expect(a.some((s) => s.gems.length > 0 || s.progression.xp > 0)).toBe(true);
    expect(a.some((s) => s.pulses.length > 0 && s.enemies.some((e) => e.damaged))).toBe(true);
    for (let i = 0; i < a.length; i++) expect(a[i]).toStrictEqual(b[i]);
  });

  it('Scenario: Elecciones distintas divergen (índice 0 frente a 1 en la misma primera oferta)', () => {
    const first = (r: Run): RunSnapshot => {
      play(r, 3600, (_t, x) => x.status === 'choosing');
      return r.snapshot();
    };
    const a = run(7);
    const b = run(7);
    const [sa, sb] = [first(a), first(b)];
    expect(sa.offer).toHaveLength(3);
    expect(sa).toStrictEqual(sb);
    expect(a.chooseUpgrade(0).ok).toBe(true);
    expect(b.chooseUpgrade(1).ok).toBe(true);
    expect(a.snapshot().upgrades).not.toEqual(b.snapshot().upgrades);
  });

  it('Scenario: Partida larga reproducible (semilla 7, 36.000 inputs, política fija)', () => {
    const inputs = randomInputs(36_000, 2026);
    const finalSnapshot = () => {
      const r = run(7);
      for (const input of inputs) {
        chooseFirstWhileOpen(r);
        r.tick(input);
      }
      return r.snapshot();
    };
    const a = finalSnapshot();
    expect(a.tick).toBeGreaterThan(0);
    expect(finalSnapshot()).toStrictEqual(a);
  });

  it('Scenario: Oferta reproducible (semilla 42: las 10 primeras ofertas, opción a opción)', () => {
    const config = withPlayer(aDefaultConfig(), { maxHealth: LONG_RUN_HEALTH });
    const inputs = randomInputs(36_000, 42);
    const offers = () => {
      const r = run(42, config);
      const out: (readonly OfferSnapshot[])[] = [];
      for (const input of inputs) {
        while (r.status === 'choosing') {
          out.push(r.snapshot().offer);
          r.chooseUpgrade(0);
        }
        if (out.length >= 10) break;
        r.tick(input);
      }
      return out.slice(0, 10);
    };
    const a = offers();
    expect(a).toHaveLength(10);
    expect(offers()).toStrictEqual(a);
  });

  it('Scenario: Todas las mejoras pueden salir (semilla 1, opción 0 hasta tenerlas al máximo)', () => {
    const setup = { player: { x: 480, y: 270 }, gems: [{ x: 500, y: 270, value: 6000 }] };
    const r = run(1, aDefaultConfig(), setup);
    r.tick(PlayerInput.NONE);
    const seen = new Set<string>();
    let repeated = 0;
    let offers = 0;
    while (r.status === 'choosing') {
      const ids = r.snapshot().offer.map((o) => o.id);
      if (new Set(ids).size !== ids.length) repeated++;
      for (const id of ids) seen.add(id);
      offers++;
      r.chooseUpgrade(0);
    }
    const total = DEFAULT_UPGRADE_LIST.reduce((n, u) => n + u.maxLevel, 0);
    expect(offers).toBe(total);
    expect(r.snapshot().upgrades.map((u) => u.level)).toEqual(Array(9).fill(5));
    expect([...seen].sort()).toEqual(DEFAULT_UPGRADE_LIST.map((u) => u.id).sort());
    expect(repeated).toBe(0);
  });
});
