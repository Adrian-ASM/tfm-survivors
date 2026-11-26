// Flote y aparición de los recogibles por reloj de render (change 0030, design D2). Puro: sin motor,
// sin azar y sin reloj del sistema; el resultado depende solo de los argumentos.
import type { AnimSpec } from './animation';

/** Parámetros del flote: amplitud A (px), periodo T (ms) y paso de fase s (ms). */
export interface FloatSpec {
  readonly amplitude: number;
  readonly periodMs: number;
  readonly phaseStepMs: number;
}

/** Flote y desfase de aparición de los datos de aspecto (`pickupMotion`). */
export interface PickupMotion {
  readonly float: FloatSpec;
  readonly spawnStaggerMs: number;
}

const TAU = 2 * Math.PI;

/**
 * Flote con fase por id (piedra, gema y tipos sin aparición o con `spawn` fallida):
 * A · sen(2π · (ms + id · s) / T).
 */
export function floatOffset(f: FloatSpec, id: number, ms: number): number {
  return f.amplitude * Math.sin((TAU * (ms + id * f.phaseStepMs)) / f.periodMs);
}

/** Flote sin salto tras una aparición: A · sen(2π · (ms − R_f) / T), que vale 0 en R_f. */
export function floatOffsetFrom(f: FloatSpec, floatFrom: number, ms: number): number {
  return f.amplitude * Math.sin((TAU * (ms - floatFrom)) / f.periodMs);
}

/** Retardo de la aparición: id · e en el primer pintado de la partida, 0 después. */
export function spawnDelay(staggerMs: number, id: number, initial: boolean): number {
  return initial ? id * staggerMs : 0;
}

/** Valor de `spawnFrame` durante el retardo (k < 0): el recogible no se ve (0030, decisión del autor). */
export const SPAWN_HIDDEN = -1;

/**
 * Frame de hoja de la aparición a `elapsed` = R − R_a ms de su inicio: `SPAWN_HIDDEN` durante el retardo
 * (k < 0, oculto), el de posición k mientras dura (0 ≤ k < n) y `null` cuando ha terminado (k ≥ n), con
 * k = ⌊elapsed · fps / 1.000⌋.
 */
export function spawnFrame(spawn: AnimSpec, elapsed: number): number | null {
  const k = Math.floor((elapsed * spawn.fps) / 1000);
  if (k < 0) return SPAWN_HIDDEN;
  if (k >= spawn.frames.length) return null;
  return spawn.frames[k] ?? 0;
}
