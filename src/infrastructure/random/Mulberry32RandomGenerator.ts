import type { RandomGenerator } from '../../domain/shared/RandomGenerator';

/** Constantes del algoritmo mulberry32 (Tommy Ettinger, dominio público). */
const INCREMENT = 0x6d2b79f5;
const UINT32_RANGE = 4294967296;

/**
 * Adaptador de RandomGenerator: PRNG mulberry32 de 32 bits, rápido y reproducible por semilla.
 * Solo la composición lo instancia (AGENTS.md §3.4).
 */
export class Mulberry32RandomGenerator implements RandomGenerator {
  private state: number;

  constructor(readonly seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + INCREMENT) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE;
  }
}
