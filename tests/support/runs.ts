import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run, type RunSetup } from '../../src/domain/run/Run';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { EnemySnapshot, RunSnapshot } from '../../src/domain/run/RunSnapshot';
import type { RandomGenerator } from '../../src/domain/shared/RandomGenerator';
import type { EnemyTypeConfig } from '../../src/domain/enemy/EnemyType';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { aRunConfig, aSegment, aWavesConfig } from './builders';

/** Tipo de enemigo de prueba: radio 10, velocidad 60 (1 unidad por tick), daño 10, vida 5, XP 1. */
export const aProbeType = (overrides: Partial<EnemyTypeConfig> = {}): EnemyTypeConfig => ({
  id: 'probe',
  speed: 60,
  radius: 10,
  cost: 1,
  damage: 10,
  health: 5,
  xp: 1,
  ...overrides,
});

type PlayerConfig = RunConfig['player'];
type Segments = RunConfig['waves']['segments'];

/**
 * Contenido para escenarios de contacto: los tipos dados (por defecto `probe`), el jugador por
 * defecto con los cambios dados y, salvo que se pasen tramos, sin presupuesto (solo están los
 * enemigos del `RunSetup`).
 */
export function aContactConfig(
  options: {
    types?: readonly EnemyTypeConfig[];
    player?: Partial<PlayerConfig>;
    segments?: Segments;
    maxAlive?: number;
    maxBudget?: number;
  } = {},
): RunConfig {
  const types = options.types ?? [aProbeType()];
  const base = aWavesConfig({
    types,
    segments: options.segments ?? [aSegment([types[0]?.id ?? 'probe'], 0)],
    ...(options.maxAlive === undefined ? {} : { maxAlive: options.maxAlive }),
    ...(options.maxBudget === undefined ? {} : { maxBudget: options.maxBudget }),
  });
  return { ...base, player: aRunConfig(options.player).player };
}

export function startRun(config: RunConfig, setup?: RunSetup, random?: RandomGenerator): Run {
  const r = Run.start(config, random ?? new Mulberry32RandomGenerator(42), setup);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

/** Ejecuta n ticks con el input dado y devuelve los snapshots tras cada uno (índice 0 = tick 1). */
export function ticks(run: Run, n: number, input = PlayerInput.NONE): RunSnapshot[] {
  const snaps: RunSnapshot[] = [];
  for (let i = 0; i < n; i++) {
    run.tick(input);
    snaps.push(run.snapshot());
  }
  return snaps;
}

/** Enemigo del snapshot por id (falla si no está). */
export function enemyById(snap: RunSnapshot, id: number): EnemySnapshot {
  const e = snap.enemies.find((x) => x.id === id);
  if (!e) throw new Error(`se esperaba el enemigo ${String(id)}`);
  return e;
}

/** `count` enemigos del tipo dado en el mismo punto. */
export const pile = (count: number, type: string, x: number, y: number) =>
  Array.from({ length: count }, () => ({ type, x, y }));
