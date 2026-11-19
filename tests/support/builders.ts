import type { RunConfig } from '../../src/domain/run/Run';

/** Contenido de partida de la spec (arena 960 × 540, radio 16, velocidad 200 px/s). */
export const aRunConfig = (
  overrides: Partial<{ speed: number; radius: number }> = {},
): RunConfig => ({
  arena: { width: 960, height: 540 },
  player: { speed: overrides.speed ?? 200, radius: overrides.radius ?? 16 },
});

export const TICK_MS = 1000 / 60;
