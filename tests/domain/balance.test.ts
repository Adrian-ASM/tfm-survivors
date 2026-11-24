import { beforeAll, describe, expect, it } from 'vitest';
import type { Run } from '../../src/domain/run/Run';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
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
  withoutSheep,
} from '../support/builders';
import {
  perRun,
  stillAlive,
  traceBotBatch,
  traceStillBatch,
  type BotTrace,
} from '../support/balanceMeasure';
import { BALANCE_BASELINE, BASELINE_FUSES_PER_RUN } from '../support/balanceBaseline';
import { referenceBot } from '../support/policies';
import { play, playReferenceBot, startSeededRun, stillSurvivors } from '../support/runs';

// Medición de equilibrio de 0004 (tasks 4.7): primer golpe con semilla 42 en el tick 4100; con
// semilla 7, primer pulso en el tick 950. Plazos de la spec tras el gate: 4.800 y 1.800. Desde 0005
// (tarea 1.27) se comprueban con el contenido por defecto completo y la política de elección fija.
const FIRST_HIT_LIMIT = 4800;
// 0013 (mundo 1.920 × 1.080): pulso a 4.800 por decisión del usuario; medido en el tick 4.161.
// 0017 (mundo 3.840 × 2.160, anillo 1.500): pulso en el 1.434; primera baja en el 656, plazo de
// la spec 900 ticks (decisión del usuario).
const PULSE_LIMIT = 4800;
const FIRST_KILL_WINDOW = 900;

// Tarea 0.2: aceptación de plazos con el contenido por defecto de 0005 (armas y mejoras), input
// (0, 0) y la política de elección fija. Medido en el punto de control 0.3 con pickupRadius 128 (decisión
// del usuario): primera oferta con semilla 7 en el tick 3332, primer golpe con semilla 42 en el 4122.
// 0013 (mundo 1.920 × 1.080): primera oferta a 4.800 por decisión del usuario; medida en el 4.346.
// 0017 (mundo 3.840 × 2.160, tabla 1,2/2,4/2,4/3,0/4,2): medida en el tick 1.527.
// 0019 (navegación por el mapa, maxAlive 300, curva 9/3): oferta en el 2.082 (semilla 7) y primer
// golpe en el 2.442 (semilla 42); bot de referencia 26/50, 0 quietos en ambos mapas.
// 0020 (comportamientos y peligros, curva 9/4, bot v3): mismos plazos (oferta 2.082, golpe 2.442);
// bot v3 27/50, 0 quietos en ambos mapas (addendum de ADR-0019).
// 0021 (casas, torres, guardias y barril A3): oferta en el 2.082; bot v3 27/50, 0 quietos en ambos
// mapas (pasos de balance en el addendum de ADR-0020).
const OFFER_LIMIT = 4800;

/** Contenido por defecto: crea las partidas y el bot de referencia (mismo mundo para ambos). */
const DEFAULT_CONFIG = aDefaultConfig();
/** Bot de referencia de una partida: ligado a su contenido y a su mapa (0015). */
const botFor = (run: Run) => referenceBot(DEFAULT_CONFIG, run.map);
const playBot = (run: Run, maxTicks: number) => playReferenceBot(run, botFor(run), maxTicks);

/** Contenido por defecto con el mapa que genera la semilla, sembrado como la composición (0015). */
const startDefault = (seed: number): Run => startSeededRun(DEFAULT_CONFIG, seed);

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
    expect(DEFAULT_ENEMY_TYPES.map((t) => prev - (t.damage ?? 0))).toContain(health);
  });

  it('Scenario: Jugador quieto con el contenido por defecto (semilla 7: baja ≤ 900, pulso ≤ 4.800)', () => {
    const run = startDefault(7);
    let previous = new Set<number>();
    let kills = 0;
    let firstPulse = 0;
    play(run, PULSE_LIMIT, (t, r) => {
      const s = r.snapshot();
      const alive = new Set(s.enemies.map((e) => e.id));
      if (t <= FIRST_KILL_WINDOW) for (const id of previous) if (!alive.has(id)) kills++;
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

// Spec run-outcome (0019), "Plazos del jugador quieto con el contenido final": con la navegación
// por el mapa, maxAlive 300 y la curva 9/3 (0019; los mismos con la 9/4 y los peligros de 0020), medido
// en apply con la semilla 7: primer golpe en el
// tick 2.276, primer pulso en el 1.524, primera oferta en el 2.082 y primera baja en el 728.
describe('Plazos del jugador quieto con el contenido final (0019)', () => {
  it('Scenario: Plazos del jugador quieto con el contenido final (semilla 7)', () => {
    const run = startDefault(7);
    const first = { hit: 0, pulse: 0, offer: 0, kill: 0 };
    const maxHealth = run.snapshot().player.maxHealth;
    play(run, OFFER_LIMIT, (t, r) => {
      const s = r.snapshot();
      if (!first.hit && s.player.maxHealth === maxHealth && s.player.health < maxHealth)
        first.hit = t;
      if (!first.pulse && s.pulses.some((p) => p.weapon === 'tests')) first.pulse = t;
      if (!first.offer && s.status === 'choosing') first.offer = t;
      if (!first.kill && s.kills > 0) first.kill = t;
      return Object.values(first).every((v) => v > 0);
    });
    expect(Object.values(first).every((v) => v > 0)).toBe(true);
    expect(Math.max(first.hit, first.pulse, first.offer)).toBeLessThanOrEqual(FIRST_HIT_LIMIT);
    expect(first.kill).toBeLessThanOrEqual(FIRST_KILL_WINDOW);
  });
});

// Spec run-outcome (0010), "Partida ganable y perdible": requisito "Perdible" sobre 1..50.
// 0023 (M1): con ovejas y con tope 0 el quieto muere como muy tarde en el tick 6.802 (generado) y
// 7.948 (vacío, sin ovejas en ningún caso), los mismos de M0; curación media del quieto 0,0.
describe('Jugador quieto pierde (0010)', () => {
  it('Scenario: Jugador quieto pierde con todas las semillas (mapa generado) · Quieto pierde con ovejas', () => {
    const t0 = performance.now();
    const traces = traceStillBatch(aDefaultConfig());
    const maxTick = Math.max(...traces.map((t) => t.final.tick));
    const healed = traces.reduce((sum, t) => sum + t.healed, 0) / traces.length;
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    console.info(`quieto con ovejas: muerte máx. ${String(maxTick)} · curación ${healed.toFixed(1)} · ${secs} s`);
    expect(stillAlive(traces)).toEqual([]);
    expect(maxTick).toBeLessThan(STILL_LIMIT_TICKS);
  });

  // Spec resources (0023): "Quieto pierde con todas las semillas sin ovejas" (mapa generado).
  it('Scenario: Quieto pierde con todas las semillas sin ovejas (tope 0, mapa generado)', () => {
    const config = withoutSheep(aDefaultConfig());
    expect(stillSurvivors(config, BALANCE_SEEDS, STILL_LIMIT_TICKS)).toEqual([]);
  });

  // El mapa vacío no tiene ovejas: cubre a la vez "Quieto pierde con ovejas" y "sin ovejas" (0023).
  it('Scenario: Jugador quieto pierde también con el mapa vacío', () => {
    expect(stillSurvivors(aDefaultConfig(), BALANCE_SEEDS, STILL_LIMIT_TICKS, 'empty')).toEqual([]);
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
// 0020: con el bot v3 y los peligros el lote pasó de 60 s en el runner de CI (≈ 70 s; ~25 s en local).
// 0021: con estructuras, guardias y el rastro de mechas, ~30 s en local (≈ 85 s equivalentes en CI).
// 0023 (M1): dos lotes, con ovejas (29,1 s en local) y con tope 0 (26,7 s); cada uno con su timeout.
const BOT_BATCH_TIMEOUT_MS = 180_000;

// Spec run-outcome (0021), "Barril que cumple su papel": base medida antes del change con el bot v3
// (16,3 mechas y 6,6 explosiones por partida; el rastro lo reproduce con el barril de 0020). Con el
// contenido final, medido en apply: 26,9 mechas y 14,6 explosiones por partida.
const BARREL_FUSE_BASELINE = 16.3;

// Spec sheep (0023), "Balance con las ovejas y la carne": el lote del contenido por defecto (con
// ovejas) en la banda 25–35. M1: 28/50 (base 27: la 9 pierde, la 10 y la 50 ganan), 26,76 mechas,
// curación media del bot 4,2 y 0,30 ovejas muertas por partida, sin recalibrar.
describe('Balance con el contenido por defecto (0010)', () => {
  let traces: BotTrace[] = [];
  let finals: RunSnapshot[] = [];
  let batchMs = 0;

  beforeAll(() => {
    const t0 = performance.now();
    traces = traceBotBatch(DEFAULT_CONFIG);
    batchMs = performance.now() - t0;
    finals = traces.map((t) => t.final);
  }, BOT_BATCH_TIMEOUT_MS);

  it('Scenario: Mechas por partida (media > 16,3 con el contenido final)', () => {
    const fuses = perRun(traces, (t) => t.fuses);

    expect(traces).toHaveLength(BALANCE_SEEDS.length);
    expect(fuses, `mechas por partida: ${fuses.toFixed(2)}`).toBeGreaterThan(BARREL_FUSE_BASELINE);
  });

  it('Scenario: Toda partida del bot termina', () => {
    const unfinished = finals.filter((s) => s.status !== 'over' || s.tick > TEN_MINUTES);

    expect(finals).toHaveLength(BALANCE_SEEDS.length);
    expect(unfinished).toEqual([]);
  });

  it('curación, ovejas muertas y tiempo del lote del bot v3 con ovejas (informativo, sin umbral)', () => {
    const healed = perRun(traces, (t) => t.healed);
    const deaths = perRun(traces, (t) => t.sheepDeaths);
    const secs = (batchMs / 1000).toFixed(1);
    console.info(`curación ${healed.toFixed(1)} · ovejas muertas ${deaths.toFixed(2)} · lote ${secs} s`);
    expect(Number.isFinite(healed + deaths)).toBe(true);
  });

  it('oro y madera medios por partida del bot v3 (informativo, sin umbral)', () => {
    const gold = perRun(traces, (t) => t.final.resources.gold);
    const wood = perRun(traces, (t) => t.final.resources.wood);
    console.info(`oro medio ${gold.toFixed(1)} · madera media ${wood.toFixed(1)} por partida`);
    expect(Number.isFinite(gold + wood)).toBe(true);
  });

  it('Scenario: Tasa de victoria del bot de referencia · Victorias del bot con ovejas', () => {
    const wins = finals.filter(
      (s) => s.status === 'over' && s.outcome === 'won' && s.tick === TEN_MINUTES,
    ).length;

    const message = `victorias del bot de referencia: ${String(wins)}/50`;
    expect(wins, message).toBeGreaterThanOrEqual(WIN_BAND.min);
    expect(wins, message).toBeLessThanOrEqual(WIN_BAND.max);
  });
});

// Spec resources (0022 y 0023), "Balance sin recalibrar con los recursos": con el tope de ovejas a 0,
// misma semilla, mismo resultado, tick y bajas que la línea base M0 (`balanceBaseline.ts`). Una
// diferencia es un fallo de determinismo (la carne, el cuarto tipo o la reserva por niveles
// cambiarían algo sin ovejas), no un balance que recalibrar.
describe('Balance sin ovejas (0023, tope 0)', () => {
  let traces: BotTrace[] = [];
  let finals: RunSnapshot[] = [];

  beforeAll(() => {
    const t0 = performance.now();
    traces = traceBotBatch(withoutSheep(DEFAULT_CONFIG));
    finals = traces.map((t) => t.final);
    console.info(`lote sin ovejas ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  }, BOT_BATCH_TIMEOUT_MS);

  it('Scenario: Victorias del bot de referencia sin ovejas (27, cada semilla igual que la base)', () => {
    const rows = finals.map((s, i) => [BALANCE_SEEDS[i], s.outcome, s.tick, s.kills]);
    const wins = finals.filter((s) => s.outcome === 'won' && s.tick === TEN_MINUTES).length;

    expect(rows).toEqual(BALANCE_BASELINE.map((r) => [...r]));
    expect(wins).toBe(27);
  });

  it('Scenario: Mechas por partida intactas sin ovejas (26,9 como la base, > 16,3)', () => {
    const fuses = perRun(traces, (t) => t.fuses);

    expect(fuses).toBe(BASELINE_FUSES_PER_RUN);
    expect(fuses.toFixed(1)).toBe('26.9');
    expect(fuses).toBeGreaterThan(BARREL_FUSE_BASELINE);
    expect(perRun(traces, (t) => t.healed + t.sheepDeaths)).toBe(0);
  });
});

// Spec run-outcome (0010), "Bot de referencia para el balance".
describe('Bot de referencia (0010)', () => {
  it('Scenario: Bot reproducible (semilla 7, dos veces)', () => {
    const summary = () => {
      const s = playBot(startDefault(7), TEN_MINUTES);
      return { status: s.status, outcome: s.outcome, tick: s.tick, kills: s.kills, up: s.upgrades };
    };

    expect(summary()).toEqual(summary());
  });
});
