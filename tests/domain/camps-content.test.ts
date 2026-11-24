import { beforeAll, describe, expect, it } from 'vitest';
import { GameMap } from '../../src/domain/map/GameMap';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { Run } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { EnemySnapshot, RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { LONG_RUN_HEALTH, aDefaultConfig, withPlayer } from '../support/builders';
import { mapRules } from '../support/mapLayouts';
import { chooseFirstWhileOpen, startSeededRun } from '../support/runs';

// Integración de las casas, torres y guardias con el contenido por defecto y el mapa generado
// (change 0021, tarea 5.4): goblin-structures "Sin casas ni torres", enemy-spawning "Guardias en el
// mapa generado" y "Guardias junto a la oleada", y simulation-loop "Partida con estructuras y
// guardias reproducible".
const GUARD = 'goblin-tnt-guard';
const CONFIG = withPlayer(aDefaultConfig(), { maxHealth: LONG_RUN_HEALTH });
const RULES = mapRules(CONFIG.map, CONFIG.arena.width, CONFIG.arena.height);
const HOUSE = CONFIG.structures.types['goblin-house'];
const INTERVAL = HOUSE?.guards?.everyTicks ?? 0;

/** Juega `n` ticks con la política fija y los inputs dados; devuelve los snapshots. */
function snapshots(
  run: Run,
  n: number,
  input: (t: number) => PlayerInput = () => PlayerInput.NONE,
  done: (s: RunSnapshot) => boolean = () => false,
) {
  const out: RunSnapshot[] = [];
  for (let t = 1; t <= n && run.status !== 'over'; t++) {
    chooseFirstWhileOpen(run);
    run.tick(input(t));
    const s = run.snapshot();
    out.push(s);
    if (done(s)) break;
  }
  return out;
}

/** Enemigos nuevos de cada snapshot (por id, que nunca se reutiliza), con su tick. */
function births(list: readonly RunSnapshot[]): { tick: number; enemy: EnemySnapshot }[] {
  const seen = new Set<number>();
  const out: { tick: number; enemy: EnemySnapshot }[] = [];
  for (const s of list) {
    for (const e of s.enemies) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push({ tick: s.tick, enemy: e });
    }
  }
  return out;
}

function mapOf(run: Run): GameMap {
  const built = GameMap.fromCells(run.map.cells, RULES);
  if (!built.ok) throw new Error(built.error.message);
  return built.value;
}

describe('Casas y torres con el contenido por defecto', () => {
  it('Scenario: Sin casas ni torres (0 casas y 0 torres, semilla 42, 3.600 ticks)', () => {
    const types = Object.fromEntries(
      Object.entries(CONFIG.structures.types).map(([id, t]) => [id, { ...t, count: 0 }]),
    );
    const config: RunConfig = { ...CONFIG, structures: { ...CONFIG.structures, types } };
    const run = startSeededRun(config, 42);
    expect(run.snapshot().structures).toEqual([]);
    const list = snapshots(run, 3600);
    expect(list).toHaveLength(3600);
    expect(list.every((s) => s.structures.length === 0)).toBe(true);
    expect(list.some((s) => s.enemies.some((e) => e.type === GUARD))).toBe(false);
  });

  it('Scenario: Guardias en el mapa generado (semilla 42, intervalo + 1 ticks)', () => {
    const run = startSeededRun(CONFIG, 42);
    const houses = run.map.structures.filter((s) => s.door !== null);
    expect(houses.length).toBeGreaterThanOrEqual(1);
    const map = mapOf(run);
    const guards = births(snapshots(run, INTERVAL + 1)).filter((b) => b.enemy.type === GUARD);
    expect(guards).toHaveLength(houses.length);
    for (const house of houses) {
      const at = guards.filter((g) => g.enemy.x === house.door?.x && g.enemy.y === house.door.y);
      expect(at, `casa ${String(house.id)}`).toHaveLength(1);
      const { x, y } = at[0]?.enemy ?? { x: -1, y: -1 };
      expect(map.isWalkable(map.colAt(x), map.rowAt(y))).toBe(true);
    }
  });

  it('Scenario: Guardias junto a la oleada (semilla 7, 3.600 ticks)', () => {
    const run = startSeededRun(CONFIG, 7);
    const doors = run.map.structures.flatMap((s) =>
      s.door ? [`${String(s.door.x)},${String(s.door.y)}`] : [],
    );
    const segments = CONFIG.waves.segments;
    /** Tipos del tramo activo en el tiempo (s) dado. */
    const activeAt = (seconds: number) =>
      segments.filter((g) => g.fromSecond <= seconds).at(-1)?.types ?? [];
    const all = births(snapshots(run, 3600));
    expect(all.some((b) => b.enemy.type === GUARD)).toBe(true);
    const offenders = all.filter(({ tick, enemy }) => {
      if (enemy.type === GUARD) return !doors.includes(`${String(enemy.x)},${String(enemy.y)}`);
      const allowed = [...activeAt((tick - 1) / 60), ...activeAt(tick / 60)];
      return !allowed.includes(enemy.type);
    });
    expect(offenders).toEqual([]);
  });
});

/**
 * Ruta de la semilla 42 (inputs calculados en la primera partida y repetidos en la segunda):
 * 1. Hasta la primera casa (huella en columnas 18–19 y filas 14–16, centro (1.140, 930)): oeste por
 *    la fila 19, norte por la columna 28 y oeste por la fila 16 hasta (1.450, 990), a 316 px del
 *    centro, dentro del alcance 400 del Linter; ahí, quieto hasta que la casa queda destruida (al
 *    principio de la partida, cuando aún hay pocos enemigos en alcance).
 * 2. Hasta la cuarta casa (columnas 34–35 y filas 5–7, puerta (2.130, 510)): este por la fila 16 y
 *    norte por la columna 28 hasta la fila 12, y este hasta (1.950, 750), a 134 px de la esquina
 *    (2.010, 630) de la patrulla de sus guardias (detección 240); ahí, quieto.
 */
const ROUTE = [
  { x: 1700, y: 1170 },
  { x: 1700, y: 990 },
  { x: 1450, y: 990, untilDestroyed: 0 },
  { x: 1710, y: 990 },
  { x: 1710, y: 750 },
  { x: 1950, y: 750 },
] as const;
const ARRIVED = 4;

/** Input hacia el siguiente punto de la ruta (por ejes), o quieto al final. */
function routeInput(s: RunSnapshot, leg: { i: number }): PlayerInput {
  let target: (typeof ROUTE)[number] | undefined = ROUTE[leg.i];
  while (target && Math.hypot(target.x - s.player.x, target.y - s.player.y) <= ARRIVED) {
    const hold = 'untilDestroyed' in target ? target.untilDestroyed : undefined;
    if (hold !== undefined && s.structures[hold]?.destroyed !== true) return PlayerInput.NONE;
    leg.i += 1;
    target = ROUTE[leg.i];
  }
  if (!target) return PlayerInput.NONE;
  const dx = target.x - s.player.x;
  const dy = target.y - s.player.y;
  const sign = (v: number) => (Math.abs(v) <= ARRIVED ? 0 : Math.sign(v));
  return PlayerInput.of(sign(dx), sign(dy));
}

describe('Partida con estructuras y guardias reproducible (semilla 42)', () => {
  const LIMIT = 14_400;
  let first: RunSnapshot[];
  let inputs: PlayerInput[];
  let alerted = false;
  beforeAll(() => {
    const run = startSeededRun(CONFIG, 42);
    const leg = { i: 0 };
    inputs = [];
    first = snapshots(
      run,
      LIMIT,
      () => {
        const input = routeInput(run.snapshot(), leg);
        inputs.push(input);
        return input;
      },
      (s) => {
        alerted ||= s.enemies.some((e) => e.type === GUARD && e.stateKind === 'alert');
        return alerted && s.structures[0]?.destroyed === true;
      },
    );
  }, 120_000);

  it('Scenario: Partida con estructuras y guardias reproducible', () => {
    const destroyedAt = first.find((s) => s.structures[0]?.destroyed)?.tick;
    expect(destroyedAt, 'la primera casa queda destruida').toBeDefined();
    const alerted = first.some((s) =>
      s.enemies.some((e) => e.type === GUARD && e.stateKind === 'alert'),
    );
    expect(alerted).toBe(true);
    const twin = snapshots(
      startSeededRun(CONFIG, 42),
      first.length,
      (t) => inputs[t - 1] ?? PlayerInput.NONE,
    );
    expect(twin.find((s) => s.structures[0]?.destroyed)?.tick).toBe(destroyedAt);
    expect(twin).toEqual(first);
  });
});
