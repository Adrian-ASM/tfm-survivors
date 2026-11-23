import { beforeAll, describe, expect, it } from 'vitest';
import { Run } from '../../src/domain/run/Run';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import {
  BALANCE_SEEDS,
  STILL_DEFEAT_SEED,
  STILL_LIMIT_TICKS,
  WIN_BAND,
} from '../support/balanceSeeds';
import {
  DEFAULT_ENEMY_TYPES,
  LONG_RUN_HEALTH,
  aDefaultConfig,
  withPlayer,
} from '../support/builders';
import { referenceBot } from '../support/policies';
import { play, playReferenceBot, stillSurvivors } from '../support/runs';

// Medición de equilibrio de 0004 (tasks 4.7): primer golpe con semilla 42 en el tick 4100; con
// semilla 7, primer pulso en el tick 950. Plazos de la spec tras el gate: 4.800 y 1.800. Desde 0005
// (tarea 1.27) se comprueban con el contenido por defecto completo y la política de elección fija.
const FIRST_HIT_LIMIT = 4800;
// 0013 (mundo 1.920 × 1.080): pulso a 4.800 por decisión del usuario; medido en el tick 4.161.
const PULSE_LIMIT = 4800;
const TEN_SECONDS = 600;

// Tarea 0.2: aceptación de plazos con el contenido por defecto de 0005 (armas y mejoras), input
// (0, 0) y la política de elección fija. Medido en el punto de control 0.3 con pickupRadius 128 (decisión
// del usuario): primera oferta con semilla 7 en el tick 3332, primer golpe con semilla 42 en el 4122.
// 0013 (mundo 1.920 × 1.080): primera oferta a 4.800 por decisión del usuario; medida en el 4.346.
const OFFER_LIMIT = 4800;

/** Contenido por defecto: crea las partidas y el bot de referencia (mismo mundo para ambos). */
const DEFAULT_CONFIG = aDefaultConfig();
const BOT = referenceBot(DEFAULT_CONFIG);

function startDefault(seed: number): Run {
  const r = Run.start(DEFAULT_CONFIG, new Mulberry32RandomGenerator(seed));
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe('Plazos con progresión (0005, medidos en el punto de control 0.3)', () => {
  it('Scenario: Primera subida en el núcleo (semilla 7: oferta en algún tick ≤ 4.800)', () => {
    const run = startDefault(7);
    let firstOffer = 0;
    play(run, OFFER_LIMIT, (t, r) => {
      if (r.status === 'choosing') firstOffer = t;
      return firstOffer > 0;
    });
    expect(firstOffer).toBeGreaterThan(0);
  });

  it('Scenario: Primer golpe en el núcleo con armas activas (semilla 42, ≤ 4.800)', () => {
    const run = startDefault(42);
    let before = run.snapshot().player;
    const hits: { health: number; prev: number; status: string }[] = [];
    play(run, FIRST_HIT_LIMIT, (_t, r) => {
      const s = r.snapshot();
      if (s.player.health < s.player.maxHealth && s.player.maxHealth === before.maxHealth) {
        hits.push({ health: s.player.health, prev: before.health, status: s.status });
      }
      before = s.player;
      return hits.length > 0;
    });
    expect(hits).toHaveLength(1);
    const { health, prev, status } = hits[0] ?? { health: 0, prev: 0, status: '' };
    expect(status).not.toBe('over');
    expect(DEFAULT_ENEMY_TYPES.map((t) => prev - t.damage)).toContain(health);
  });

  it('Scenario: Jugador quieto con el contenido por defecto (semilla 7: baja ≤ 600, pulso ≤ 4.800)', () => {
    const run = startDefault(7);
    let previous = new Set<number>();
    let kills = 0;
    let firstPulse = 0;
    play(run, PULSE_LIMIT, (t, r) => {
      const s = r.snapshot();
      const alive = new Set(s.enemies.map((e) => e.id));
      if (t <= TEN_SECONDS) for (const id of previous) if (!alive.has(id)) kills++;
      previous = alive;
      if (firstPulse === 0 && s.pulses.some((p) => p.weapon === 'tests')) firstPulse = t;
      return false;
    });
    expect(kills).toBeGreaterThanOrEqual(1);
    expect(firstPulse).toBeGreaterThan(0);
  });

  it('Scenario: Partida con progresión reproducible (semilla 7: ≥ 1 gema y ≥ 1 oferta en 4.800)', () => {
    const run = startDefault(7);
    let gem = false;
    let offer = false;
    play(run, OFFER_LIMIT, (_t, r) => {
      const s = r.snapshot();
      gem ||= s.progression.xp > 0 || s.progression.level > 1;
      offer ||= s.status === 'choosing';
      return gem && offer;
    });
    expect([gem, offer]).toEqual([true, true]);
  });
});

// Spec run-outcome (0010), "Partida ganable y perdible": requisito "Perdible" sobre 1..50.
describe('Jugador quieto pierde (0010)', () => {
  it('Scenario: Jugador quieto pierde con todas las semillas', () => {
    expect(stillSurvivors(aDefaultConfig(), BALANCE_SEEDS, STILL_LIMIT_TICKS)).toEqual([]);
  });

  it('Scenario: Muerte quieta en el límite de 180 s (viva en el tick 10.799 cuenta como fallo)', () => {
    const immortal = withPlayer(aDefaultConfig(), { maxHealth: LONG_RUN_HEALTH });

    expect(stillSurvivors(immortal, [7], STILL_LIMIT_TICKS)).toEqual([7]);
  });

  it('la semilla de derrota de los E2E pertenece al conjunto', () => {
    expect(BALANCE_SEEDS).toContain(STILL_DEFEAT_SEED);
  });
});

/** Duración objetivo de la partida (content/run.json): 600 s = 36.000 ticks. */
const TEN_MINUTES = 36_000;

// Spec run-outcome (0010), "Partida ganable y perdible": requisito "Ganable" sobre 1..50. Las 50
// partidas se juegan una vez (timeout propio: el global es de 20 s y en CI puede doblarse).
const BOT_BATCH_TIMEOUT_MS = 60_000;

describe('Balance con el contenido por defecto (0010)', () => {
  let finals: RunSnapshot[] = [];

  beforeAll(() => {
    finals = BALANCE_SEEDS.map((seed) => playReferenceBot(startDefault(seed), BOT, TEN_MINUTES));
  }, BOT_BATCH_TIMEOUT_MS);

  it('Scenario: Toda partida del bot termina', () => {
    const unfinished = finals.filter((s) => s.status !== 'over' || s.tick > TEN_MINUTES);

    expect(finals).toHaveLength(BALANCE_SEEDS.length);
    expect(unfinished).toEqual([]);
  });

  it('Scenario: Tasa de victoria del bot de referencia', () => {
    const wins = finals.filter(
      (s) => s.status === 'over' && s.outcome === 'won' && s.tick === TEN_MINUTES,
    ).length;

    const message = `victorias del bot de referencia: ${String(wins)}/50`;
    expect(wins, message).toBeGreaterThanOrEqual(WIN_BAND.min);
    expect(wins, message).toBeLessThanOrEqual(WIN_BAND.max);
  });
});

// Spec run-outcome (0010), "Bot de referencia para el balance".
describe('Bot de referencia (0010)', () => {
  it('Scenario: Bot reproducible (semilla 7, dos veces)', () => {
    const summary = () => {
      const s = playReferenceBot(startDefault(7), BOT, TEN_MINUTES);
      return { status: s.status, outcome: s.outcome, tick: s.tick, kills: s.kills, up: s.upgrades };
    };

    expect(summary()).toEqual(summary());
  });
});
