import type { EnemyTypeConfig } from '../../src/domain/enemy/EnemyType';
import type { Run } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { BALANCE_SEEDS, STILL_LIMIT_TICKS } from './balanceSeeds';
import { botWorld, referenceBot, threateningWarnings, type ReferenceBot } from './policies';
import { chooseWhileOpen, play, startSeededRun, stillSurvivors } from './runs';

/** Duración objetivo de la partida (content/run.json): 600 s = 36.000 ticks. */
export const TEN_MINUTES = 36_000;

/** Partida del bot de referencia con los contadores de la medición de balance (0021, design §11). */
export interface BotTrace {
  readonly final: RunSnapshot;
  /** Enemigos que entran en un estado de mecha (solo el `goblin-barrel` tiene mecha). */
  readonly fuses: number;
  /** Explosiones de mecha: explosiones nuevas en la posición de un aviso de mecha del tick previo. */
  readonly barrelBlasts: number;
  /**
   * Firma W3: vida perdida en ticks en que el bot v3 devolvió `NONE` con ≥ 1 aviso amenazante y
   * explotó una dinamita lanzada por un guardia.
   */
  readonly w3Damage: number;
}

/** ¿Es un tipo de guardia (empieza en patrulla, spec enemy-behavior 0021)? */
const isGuard = (t: EnemyTypeConfig): boolean =>
  t.behavior.states.find((s) => s.name === t.behavior.initial)?.kind === 'patrol';

const dynamiteKey = (x: number, y: number, tick: number): string => [x, y, tick].join(',');

/** Lanzador de una dinamita recién creada: el enemigo más cercano a su origen. */
function launcherType(s: RunSnapshot, x: number, y: number): string {
  let best = '';
  let bestD = Infinity;
  for (const e of s.enemies) {
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < bestD) [best, bestD] = [e.type, d];
  }
  return best;
}

/**
 * Como `playReferenceBot`, contando mechas, explosiones de barril y la firma W3. Solo lee los
 * snapshots: el bot y la partida evolucionan igual que sin rastro.
 */
export function playBotTraced(
  config: RunConfig,
  run: Run,
  bot: ReferenceBot,
  maxTicks: number,
): BotTrace {
  const guards = new Set(config.enemies.types.filter(isGuard).map((t) => t.id));
  const world = botWorld(config, run.map);
  const fused = new Set<number>();
  const seenDynamites = new Set<number>();
  const guardDynamites = new Set<string>();
  let lastBlast = -1;
  let barrelBlasts = 0;
  let w3Damage = 0;
  let last: RunSnapshot | null = null;
  for (let t = 0; t < maxTicks && run.status !== 'over'; t++) {
    const chosen = chooseWhileOpen(run, (offer) => bot.pick(offer));
    // Sin elección entre ticks el estado no cambia: el `after` del tick anterior es el `before` de
    // este (0022, M1: la mitad de snapshots por tick; los resultados son los mismos).
    const before = chosen > 0 || !last ? run.snapshot() : last;
    const input = bot.input(before);
    run.tick(input);
    const after = run.snapshot();
    last = after;
    for (const e of after.enemies) if (e.stateKind === 'fuse') fused.add(e.id);
    for (const d of after.dynamites) {
      if (seenDynamites.has(d.id)) continue;
      seenDynamites.add(d.id);
      if (guards.has(launcherType(after, d.x, d.y)))
        guardDynamites.add(dynamiteKey(d.targetX, d.targetY, d.explodesAt));
    }
    const fresh = after.blasts.filter((b) => b.id > lastBlast);
    for (const b of after.blasts) lastBlast = Math.max(lastBlast, b.id);
    const fuseAt = (x: number, y: number) =>
      before.warnings.some((w) => w.source === 'fuse' && w.x === x && w.y === y);
    barrelBlasts += fresh.filter((b) => fuseAt(b.x, b.y)).length;
    const still = input.direction.x === 0 && input.direction.y === 0;
    const lost = before.player.health - after.player.health;
    if (
      still &&
      lost > 0 &&
      threateningWarnings(before, world).length > 0 &&
      fresh.some((b) => guardDynamites.has(dynamiteKey(b.x, b.y, b.tick)))
    )
      w3Damage += lost;
  }
  return { final: run.snapshot(), fuses: fused.size, barrelBlasts, w3Damage };
}

/** ¿Victoria en el tick 36.000 (spec run-outcome)? */
export const isWin = (s: RunSnapshot): boolean =>
  s.status === 'over' && s.outcome === 'won' && s.tick === TEN_MINUTES;

/** Juega el bot de referencia con rastro en cada semilla de `BALANCE_SEEDS`, con su mapa. */
export function traceBotBatch(config: RunConfig): BotTrace[] {
  return BALANCE_SEEDS.map((seed) => {
    const run = startSeededRun(config, seed);
    return playBotTraced(config, run, referenceBot(config, run.map), TEN_MINUTES);
  });
}

/** Media por partida de un contador del rastro. */
export const perRun = (traces: readonly BotTrace[], pick: (t: BotTrace) => number): number =>
  traces.reduce((sum, t) => sum + pick(t), 0) / traces.length;

/** Mediciones de balance de un contenido (protocolo de calibración, design 0017 D9 y 0021 §11). */
export interface BalanceMeasure {
  /** Victorias del bot de referencia en `BALANCE_SEEDS`. */
  readonly wins: number;
  /** Semillas en las que el quieto sigue vivo en el tick 10.799, con el mapa generado. */
  readonly stillGenerated: readonly number[];
  /** Ídem con el mapa vacío. */
  readonly stillEmpty: readonly number[];
  /** Tick de la primera oferta del quieto (política fija) con la semilla dada; 0 si no la hay. */
  readonly firstOffer: number;
  /** Mechas y explosiones de barril por partida del bot (0021). */
  readonly fusesPerRun: number;
  readonly barrelBlastsPerRun: number;
  /** Semillas (ganadas o no) con firma W3 > 0. */
  readonly w3Seeds: readonly number[];
  /** Semillas ganadas por el bot. */
  readonly wonSeeds: readonly number[];
  /** Tiempo del lote del bot en esta máquina, en ms. */
  readonly batchMs: number;
}

/** Victorias del bot de referencia sobre `BALANCE_SEEDS` con el mapa de cada semilla. */
export function botWins(config: RunConfig): number {
  return traceBotBatch(config).filter((t) => isWin(t.final)).length;
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

/** Las mediciones del criterio de salida de la calibración (0017 D9, ampliadas en 0021 §11). */
export function measureBalance(
  config: RunConfig,
  offerSeed = 7,
  offerLimit = 10_800,
): BalanceMeasure {
  const start = performance.now();
  const traces = traceBotBatch(config);
  const batchMs = performance.now() - start;
  const seedsWhere = (ok: (t: BotTrace) => boolean) =>
    BALANCE_SEEDS.filter((_, i) => {
      const t = traces[i];
      return t !== undefined && ok(t);
    });
  return {
    wins: traces.filter((t) => isWin(t.final)).length,
    stillGenerated: stillSurvivors(config, BALANCE_SEEDS, STILL_LIMIT_TICKS),
    stillEmpty: stillSurvivors(config, BALANCE_SEEDS, STILL_LIMIT_TICKS, 'empty'),
    firstOffer: firstOfferTick(config, offerSeed, offerLimit),
    fusesPerRun: perRun(traces, (t) => t.fuses),
    barrelBlastsPerRun: perRun(traces, (t) => t.barrelBlasts),
    w3Seeds: seedsWhere((t) => t.w3Damage > 0),
    wonSeeds: seedsWhere((t) => isWin(t.final)),
    batchMs,
  };
}
