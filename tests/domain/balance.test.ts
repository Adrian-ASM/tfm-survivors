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
import { chooseWhileOpen, play, startSeededRun, stillSurvivors, visitShop } from '../support/runs';

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

// Spec run-outcome (0010), "Partida ganable y perdible": requisito "Perdible" sobre 1..50, con la
// política de tienda fija (0024). M1 de 0024: el quieto muere como muy tarde en el tick 6.081
// (generado) y 6.475 (vacío), frente a 10.800 (margen 4.325 ticks); nunca pasa por la tienda.
describe('Jugador quieto pierde (0010)', () => {
  it('Scenario: Jugador quieto pierde con todas las semillas (mapa generado) · Quieto pierde con ovejas · Quieto pierde con la tienda · Mejoras de arma fuera de la oferta', () => {
    const t0 = performance.now();
    const traces = traceStillBatch(aDefaultConfig());
    const maxTick = Math.max(...traces.map((t) => t.final.tick));
    const healed = traces.reduce((sum, t) => sum + t.healed, 0) / traces.length;
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    console.info(
      `quieto: muerte máx. ${String(maxTick)} · curación ${healed.toFixed(1)} · ${secs} s`,
    );
    expect(stillAlive(traces)).toEqual([]);
    expect(maxTick).toBeLessThan(STILL_LIMIT_TICKS);
    expect(traces.filter((t) => t.shopped).map((t) => t.seed)).toEqual([]);
    // Spec upgrades (0024), "Mejoras de arma fuera de la oferta": ninguna opción del catálogo de arma.
    const weaponIds = new Set(DEFAULT_CONFIG.upgrades.weapons.map((u) => u.id));
    const offeredWeapons = traces.flatMap((t) => [...t.offered].filter((id) => weaponIds.has(id)));
    expect(traces.some((t) => t.offered.size > 0)).toBe(true);
    expect(offeredWeapons).toEqual([]);
  });

  it('Scenario: Jugador quieto pierde también con el mapa vacío · Quieto pierde con la tienda', () => {
    const traces = traceStillBatch(aDefaultConfig(), 'empty');

    expect(stillAlive(traces)).toEqual([]);
    expect(Math.max(...traces.map((t) => t.final.tick))).toBeLessThan(STILL_LIMIT_TICKS);
    expect(traces.some((t) => t.shopped)).toBe(false);
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
// 0024 (M1, bot v4 con tienda): un solo lote, 35,8 s en local (×2,8 ≈ 100 s); sin subir el timeout.
const BOT_BATCH_TIMEOUT_MS = 180_000;

// Spec run-outcome (0021), "Barril que cumple su papel": base medida antes de 0021 con el bot v3
// (16,3 mechas por partida). Con el contenido final de 0024 y el bot v4: 30,44 (M2).
const BARREL_FUSE_BASELINE = 16.3;

// Spec castle-shop (0024), "Balance con la tienda y el bot v4": un solo lote del bot v4 con el
// contenido por defecto (ovejas incluidas), comparado fila a fila con la línea base M2.
describe('Balance con el contenido por defecto y el bot v4 (0024)', () => {
  let traces: BotTrace[] = [];
  let finals: RunSnapshot[] = [];
  let batchMs = 0;

  beforeAll(() => {
    const t0 = performance.now();
    traces = traceBotBatch(DEFAULT_CONFIG);
    batchMs = performance.now() - t0;
    finals = traces.map((t) => t.final);
  }, BOT_BATCH_TIMEOUT_MS);

  it('Scenario: Toda partida del bot termina', () => {
    const unfinished = finals.filter((s) => s.status !== 'over' || s.tick > TEN_MINUTES);

    expect(finals).toHaveLength(BALANCE_SEEDS.length);
    expect(unfinished).toEqual([]);
  });

  it('Scenario: Tasa de victoria del bot de referencia · Victorias del bot v4 (25–35, ≥ 1 compra)', () => {
    const wins = finals.filter(
      (s) => s.status === 'over' && s.outcome === 'won' && s.tick === TEN_MINUTES,
    ).length;

    const message = `victorias del bot de referencia: ${String(wins)}/50`;
    expect(wins, message).toBeGreaterThanOrEqual(WIN_BAND.min);
    expect(wins, message).toBeLessThanOrEqual(WIN_BAND.max);
    expect(traces.some((t) => t.economy.purchases + t.economy.heals > 0)).toBe(true);
  });

  it('Scenario: Línea base nueva congelada (cada semilla igual que la base M2)', () => {
    const rows = finals.map((s, i) => [BALANCE_SEEDS[i], s.outcome, s.tick, s.kills]);

    expect(rows).toEqual(BALANCE_BASELINE.map((r) => [...r]));
  });

  it('Scenario: Barril que cumple su papel · Mechas por partida (> 16,3; 30,44 en M2)', () => {
    const fuses = perRun(traces, (t) => t.fuses);

    expect(fuses, `mechas por partida: ${fuses.toFixed(2)}`).toBeGreaterThan(BARREL_FUSE_BASELINE);
    expect(fuses).toBe(BASELINE_FUSES_PER_RUN);
  });

  it('economía y tiempo del lote del bot v4 (informativo, sin umbral)', () => {
    const e = (pick: (x: BotTrace['economy']) => number) =>
      perRun(traces, (t) => pick(t.economy)).toFixed(2);
    const secs = (batchMs / 1000).toFixed(1);
    console.info(
      `oro ganado ${e((x) => x.earned)} · gastado ${e((x) => x.spent)} · visitas ${e((x) => x.visits)}` +
        ` · compras ${e((x) => x.purchases)} · curaciones ${e((x) => x.heals)} · lote ${secs} s`,
    );
    expect(Number.isFinite(batchMs)).toBe(true);
  });
});

// Spec run-outcome (0010 y 0024), "Bot de referencia para el balance".
describe('Bot de referencia (0010)', () => {
  it('Scenario: Bot reproducible (semilla 7, dos veces, con elecciones y compras)', () => {
    const summary = () => {
      const run = startDefault(7);
      const bot = botFor(run);
      const bought: string[] = [];
      for (let t = 0; t < TEN_MINUTES && run.status !== 'over'; t++) {
        bought.push(...visitShop(run, bot));
        chooseWhileOpen(run, (offer) => bot.pick(offer));
        run.tick(bot.input(run.snapshot()));
      }
      const s = run.snapshot();
      return {
        status: s.status,
        outcome: s.outcome,
        tick: s.tick,
        kills: s.kills,
        up: s.upgrades,
        bought,
      };
    };

    const first = summary();
    expect(first.bought.length).toBeGreaterThan(0);
    expect(summary()).toEqual(first);
  });
});
