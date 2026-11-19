import type { RunConfig } from '../../src/domain/run/RunConfig';

/** Tipos de enemigo de la spec (bug, memory-leak, merge-conflict). */
export const DEFAULT_ENEMY_TYPES = [
  { id: 'bug', speed: 90, radius: 10, cost: 1 },
  { id: 'memory-leak', speed: 45, radius: 22, cost: 3 },
  { id: 'merge-conflict', speed: 70, radius: 16, cost: 2 },
] as const;

const ALL = ['bug', 'merge-conflict', 'memory-leak'];

/** Tabla de oleadas y parámetros de spawn de la spec y el design. */
export const DEFAULT_WAVES: RunConfig['waves'] = {
  maxAlive: 200,
  spawn: { margin: 32, minDistance: 200, maxAttempts: 8 },
  segments: [
    { fromSecond: 0, budgetPerSecond: 1, types: ['bug'] },
    { fromSecond: 60, budgetPerSecond: 2, types: ['bug', 'merge-conflict'] },
    { fromSecond: 180, budgetPerSecond: 3.5, types: ALL },
    { fromSecond: 300, budgetPerSecond: 5, types: ALL },
    { fromSecond: 480, budgetPerSecond: 7, types: ALL },
  ],
};

/** Contenido de partida de la spec (arena 960 × 540, radio 16, velocidad 200 px/s). */
export const aRunConfig = (
  overrides: Partial<{ speed: number; radius: number }> = {},
): RunConfig => ({
  arena: { width: 960, height: 540, view: { width: 960, height: 540 } },
  player: { speed: overrides.speed ?? 200, radius: overrides.radius ?? 16 },
  enemies: { types: DEFAULT_ENEMY_TYPES },
  waves: DEFAULT_WAVES,
});

export const TICK_MS = 1000 / 60;
