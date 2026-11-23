import type { RunConfig } from '../../src/domain/run/RunConfig';
import { BALANCE_SEEDS, STILL_LIMIT_TICKS } from './balanceSeeds';
import { referenceBot } from './policies';
import { play, playReferenceBot, startSeededRun, stillSurvivors } from './runs';

/** Duración objetivo de la partida (content/run.json): 600 s = 36.000 ticks. */
const TEN_MINUTES = 36_000;

/** Mediciones de balance de un contenido (protocolo de calibración, design 0017 D9). */
export interface BalanceMeasure {
  /** Victorias del bot de referencia en `BALANCE_SEEDS`. */
  readonly wins: number;
  /** Semillas en las que el quieto sigue vivo en el tick 10.799, con el mapa generado. */
  readonly stillGenerated: readonly number[];
  /** Ídem con el mapa vacío. */
  readonly stillEmpty: readonly number[];
  /** Tick de la primera oferta del quieto (política fija) con la semilla dada; 0 si no la hay. */
  readonly firstOffer: number;
}

/** Victorias del bot de referencia sobre `BALANCE_SEEDS` con el mapa de cada semilla. */
export function botWins(config: RunConfig): number {
  return BALANCE_SEEDS.filter((seed) => {
    const run = startSeededRun(config, seed);
    const s = playReferenceBot(run, referenceBot(config, run.map), TEN_MINUTES);
    return s.status === 'over' && s.outcome === 'won' && s.tick === TEN_MINUTES;
  }).length;
}

/** Tick de la primera oferta de un jugador quieto con la semilla dada, hasta `limit` (0 si no). */
export function firstOfferTick(config: RunConfig, seed: number, limit: number): number {
  const run = startSeededRun(config, seed);
  let first = 0;
  play(run, limit, (t, r) => {
    if (r.status === 'choosing') first = t;
    return first > 0;
  });
  return first;
}

/** Las cuatro mediciones del criterio de salida de la calibración de oleadas. */
export function measureBalance(
  config: RunConfig,
  offerSeed = 7,
  offerLimit = 10_800,
): BalanceMeasure {
  return {
    wins: botWins(config),
    stillGenerated: stillSurvivors(config, BALANCE_SEEDS, STILL_LIMIT_TICKS),
    stillEmpty: stillSurvivors(config, BALANCE_SEEDS, STILL_LIMIT_TICKS, 'empty'),
    firstOffer: firstOfferTick(config, offerSeed, offerLimit),
  };
}
