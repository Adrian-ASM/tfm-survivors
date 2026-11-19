import type { RunConfig } from '../../src/domain/run/Run';

/** Contenido de partida de la spec (arena 960 × 540, radio 16, velocidad 200 px/s). */
export const aRunConfig = (
  overrides: Partial<{ speed: number; radius: number }> = {},
): RunConfig => ({
  arena: { width: 960, height: 540 },
  player: { speed: overrides.speed ?? 200, radius: overrides.radius ?? 16 },
});

/** PRNG determinista solo para generar datos de test (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TICK_MS = 1000 / 60;
