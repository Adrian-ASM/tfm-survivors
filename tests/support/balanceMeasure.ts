import type { EnemyTypeConfig } from '../../src/domain/enemy/EnemyType';
import type { Run } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { BALANCE_SEEDS, STILL_LIMIT_TICKS } from './balanceSeeds';
import { botWorld, referenceBot, threateningWarnings, type ReferenceBot } from './policies';
import type { MapMode } from '../../src/composition/seedSource';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { chooseWhileOpen, play, startSeededRun, stillSurvivors, visitShop } from './runs';

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
  /** Vida recuperada en la partida (subidas de vida sin cambio de la máxima: la carne, 0023). */
  readonly healed: number;
  /** Ovejas que han muerto en la partida (0023). */
  readonly sheepDeaths: number;
  /** Economía de la tienda (0024, informativa): ver `EconomyTrace`. */
  readonly economy: EconomyTrace;
}

/** Oro y tienda de una partida del bot v4 (design 0024 §9, M1). */
export interface EconomyTrace {
  /** Oro soltado en el suelo por bajas y por estructuras, y oro de las vetas agotadas. */
  readonly droppedByKills: number;
  readonly droppedByStructures: number;
  readonly veins: number;
  /** Oro que entró en el contador (recogido + vetas, con bonificación) y oro gastado. */
  readonly earned: number;
  readonly spent: number;
  /** Visitas a la tienda, niveles de arma comprados y curaciones compradas. */
  readonly visits: number;
  readonly purchases: number;
  readonly heals: number;
  /** Tick de cada nivel de arma comprado, en orden. */
  readonly purchaseTicks: readonly number[];
}

/** Vida curada entre dos snapshots (0 si cambió la máxima: una mejora no es curación). */
const healedBetween = (a: RunSnapshot, b: RunSnapshot): number =>
  b.player.maxHealth === a.player.maxHealth ? Math.max(0, b.player.health - a.player.health) : 0;

/** Ovejas de `a` que ya no están en `b` (muertas en el tick). */
const sheepLost = (a: RunSnapshot, b: RunSnapshot): number => {
  if (a.sheep.length === 0) return 0;
  const alive = new Set(b.sheep.map((o) => o.id));
  return a.sheep.filter((o) => !alive.has(o.id)).length;
};

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
  let healed = 0;
  let sheepDeaths = 0;
  let last: RunSnapshot | null = null;
  const eco = { droppedByKills: 0, droppedByStructures: 0, veins: 0, earned: 0, spent: 0 };
  const visit = { visits: 0, purchases: 0, heals: 0 };
  const purchaseTicks: number[] = [];
  // Recogibles en orden de creación con ids crecientes: los nuevos del tick están al final.
  let lastPickup = -1;
  const healId = config.shop.heal.id;
  for (let t = 0; t < maxTicks && run.status !== 'over'; t++) {
    let shopped = false;
    if (run.status === 'shopping') {
      const pre = run.snapshot();
      const bought = visitShop(run, bot);
      visit.visits++;
      for (const id of bought) {
        if (id === healId) visit.heals++;
        else {
          visit.purchases++;
          purchaseTicks.push(pre.tick);
        }
      }
      eco.spent += pre.resources.gold - run.snapshot().resources.gold;
      shopped = true;
    }
    const chosen = chooseWhileOpen(run, (offer) => bot.pick(offer));
    // Sin elección ni compra entre ticks el estado no cambia: el `after` del tick anterior es el
    // `before` de este (0022, M1: la mitad de snapshots por tick; los resultados son los mismos).
    const before = chosen > 0 || shopped || !last ? run.snapshot() : last;
    const input = bot.input(before);
    run.tick(input);
    const after = run.snapshot();
    last = after;
    healed += healedBetween(before, after);
    sheepDeaths += sheepLost(before, after);
    eco.earned += Math.max(0, after.resources.gold - before.resources.gold);
    const ruined = after.structures.some((x, i) => x.destroyed && !before.structures[i]?.destroyed);
    const { pickups } = after;
    let first = pickups.length;
    while (first > 0 && (pickups[first - 1]?.id ?? -1) > lastPickup) first--;
    for (const p of pickups.slice(first)) {
      lastPickup = Math.max(lastPickup, p.id);
      if (p.kind !== 'gold') continue;
      const fromStructure =
        ruined && after.structures.some((x) => x.destroyed && x.x === p.x && x.y === p.y);
      if (fromStructure) eco.droppedByStructures += p.value;
      else eco.droppedByKills += p.value;
    }
    const tapped = after.veins.filter((v, i) => v.depleted && !before.veins[i]?.depleted);
    for (const v of tapped) eco.veins += v.gold;
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
  const economy = { ...eco, ...visit, purchaseTicks };
  return {
    final: run.snapshot(),
    fuses: fused.size,
    barrelBlasts,
    w3Damage,
    healed,
    sheepDeaths,
    economy,
  };
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

/** Partida de un jugador quieto con la política fija (spec run-outcome "Perdible", 0023). */
export interface StillTrace {
  readonly seed: number;
  readonly final: RunSnapshot;
  /** Vida recuperada con la carne. */
  readonly healed: number;
  /** Ids de todas las opciones de todas las ofertas abiertas (0024: ninguna de arma). */
  readonly offered: ReadonlySet<string>;
  /** La partida pasó por en tienda en algún tick (0024: el quieto nunca debe). */
  readonly shopped: boolean;
}

/**
 * Juega cada semilla con input (0, 0) y la política de elección fija hasta `STILL_LIMIT_TICKS − 1`
 * (o hasta que termina), contando la vida curada. Sobrevivir en el tick 10.799 cuenta como fallo.
 */
export function traceStillBatch(config: RunConfig, mode: MapMode = 'generated'): StillTrace[] {
  return BALANCE_SEEDS.map((seed) => {
    const run = startSeededRun(config, seed, mode);
    let prev = run.snapshot();
    let healed = 0;
    const offered = new Set<string>();
    let shopped = false;
    for (let t = 1; t < STILL_LIMIT_TICKS && run.status !== 'over'; t++) {
      chooseWhileOpen(run, (offer) => {
        for (const o of offer) offered.add(o.id);
        return 0;
      });
      run.tick(PlayerInput.NONE);
      const now = run.snapshot();
      shopped ||= now.status === 'shopping';
      healed += healedBetween(prev, now);
      prev = now;
    }
    return { seed, final: run.snapshot(), healed, offered, shopped };
  });
}

/** Semillas cuyo quieto no ha perdido antes del tick 10.800. */
export const stillAlive = (traces: readonly StillTrace[]): number[] =>
  traces
    .filter((t) => !(t.final.status === 'over' && t.final.outcome === 'lost'))
    .map((t) => t.seed);

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
