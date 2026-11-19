import { beforeAll, describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { EnemySnapshot, RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import {
  LONG_RUN_HEALTH,
  aRunConfig,
  aSegment,
  aWavesConfig,
  withPlayer,
  aDefaultConfig,
} from '../support/builders';
import { chooseFirstWhileOpen } from '../support/runs';
import { randomInputs } from '../support/inputs';

// Partidas de 10 min (36.000 ticks). Una sola simulación con el contenido por defecto se reutiliza para
// los escenarios de legalidad; sirve además de alarma gruesa de rendimiento dentro de `verify`.
const TEN_MINUTES = 36_000;
const SEED = 7;
const INPUT_SEED = 2026;
/** La auditoría prueba el spawn, no el daño: con vida inalcanzable siguen naciendo los 200. */
const SPAWN_AUDIT = aRunConfig({ maxHealth: LONG_RUN_HEALTH });

interface Violations {
  outside: number;
  tooClose: number;
  births: number;
  maxAlive: number;
}

const inside = ({ x, y, radius }: EnemySnapshot): boolean =>
  x >= radius && x <= 960 - radius && y >= radius && y <= 540 - radius;

function start(config: RunConfig, seed: number): Run {
  const r = Run.start(config, new Mulberry32RandomGenerator(seed));
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

/** Recorre la partida comprobando cada tick: enemigos dentro y nacimientos a ≥ 200 del jugador. */
function audit(inputs: readonly PlayerInput[]): { final: RunSnapshot; v: Violations } {
  const run = start(SPAWN_AUDIT, SEED);
  const v: Violations = { outside: 0, tooClose: 0, births: 0, maxAlive: 0 };
  let nextId = 0;
  for (const input of inputs) {
    run.tick(input);
    const { enemies, player } = run.snapshot();
    v.maxAlive = Math.max(v.maxAlive, enemies.length);
    for (const e of enemies) {
      if (!inside(e)) v.outside += 1;
      if (e.id < nextId) continue;
      v.births += 1;
      nextId = e.id + 1;
      if (Math.hypot(e.x - player.x, e.y - player.y) < 200) v.tooClose += 1;
    }
  }
  return { final: run.snapshot(), v };
}

function finalSnapshot(config: RunConfig, seed: number, inputs: readonly PlayerInput[]) {
  const run = start(config, seed);
  for (const input of inputs) run.tick(input);
  return run.snapshot();
}

describe('Partidas largas (10 min)', () => {
  const inputs = randomInputs(TEN_MINUTES, INPUT_SEED);
  let audited: { final: RunSnapshot; v: Violations };

  beforeAll(() => {
    audited = audit(inputs);
  });

  it('Partida larga sin spawns ilegales', () => {
    // Sin bajas ni muerte del jugador nacen exactamente maxAlive enemigos.
    expect(audited.v.births).toBe(200);
    expect(audited.v.tooClose).toBe(0);
  });

  it('Partida larga (enemigos dentro de la arena en todos los ticks)', () => {
    expect(audited.v.outside).toBe(0);
    expect(audited.v.maxAlive).toBe(200);
  });

  it('Partida larga reproducible', () => {
    expect(audited.final).toMatchObject({ tick: TEN_MINUTES, status: 'over', outcome: 'won' });
    expect(finalSnapshot(SPAWN_AUDIT, SEED, inputs)).toStrictEqual(audited.final);
  });

  // Requisito REMOVED en 0004 ("Una partida sin defensa termina"): se conserva como prueba del
  // contacto sin armas (NO_WEAPONS en aRunConfig), no como regla del contenido por defecto.
  it('Jugador quieto sin armas: termina con vida 0 (semilla 7)', () => {
    const run = start(aRunConfig(), SEED);
    let endedAt = 0;
    for (let n = 1; n <= TEN_MINUTES && endedAt === 0; n++) {
      run.tick(PlayerInput.NONE);
      if (run.snapshot().status === 'over') endedAt = n;
    }
    const snap = run.snapshot();
    expect(snap.status).toBe('over');
    expect(snap.player.health).toBe(0);
    expect(snap.tick).toBe(endedAt);
    expect(endedAt).toBeLessThanOrEqual(TEN_MINUTES);
  });

  it('Scenario: Partida larga reproducible (contenido por defecto, semilla 7, política fija)', () => {
    const final = () => {
      const run = start(aDefaultConfig(), SEED);
      for (const input of inputs) {
        chooseFirstWhileOpen(run);
        run.tick(input);
      }
      return run.snapshot();
    };
    const a = final();
    const b = final();
    const summary = (s: RunSnapshot) => [s.status, s.outcome, s.tick, s.kills];
    expect(a.outcome).not.toBeNull();
    expect(summary(b)).toEqual(summary(a));
    expect(b).toStrictEqual(a);
  });

  it('Partida larga reproducible con la vida por defecto', () => {
    const a = finalSnapshot(aRunConfig(), SEED, inputs);
    expect(finalSnapshot(aRunConfig(), SEED, inputs)).toStrictEqual(a);
  });

  it('Mezcla de tipos', () => {
    const all = ['bug', 'memory-leak', 'merge-conflict'];
    const config = withPlayer(aWavesConfig({ segments: [aSegment(all, 2)] }), {
      maxHealth: LONG_RUN_HEALTH,
    });
    const run = start(config, 1);
    const seen = new Set<string>();
    for (const input of inputs) {
      run.tick(input);
      for (const e of run.snapshot().enemies) seen.add(e.type);
      if (seen.size === all.length) break;
    }
    expect([...seen].sort()).toEqual(all);
  });
});
