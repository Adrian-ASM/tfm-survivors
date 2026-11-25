import type { RandomGenerator } from '../shared/RandomGenerator';

/** Valor de cada piedra soltada: regla fijada por la propuesta de 0025, no es contenido. */
export const STONE_PER_DROP = 1;

/** Probabilidad entera 0..100 de piedra por tipo de enemigo (la cumple `ResourceRules`). */
export interface StoneChances {
  stoneChanceFor(typeId: string): number;
}

/**
 * Tirada de piedra por baja (spec resources 0025, ADR-0024): con azar de la piedra, **toda** baja
 * consume exactamente 1 valor u y suelta si está abatida y ⌊u × 100⌋ < p. Sin azar (partida de
 * escenario) nunca suelta y no consume nada. Colaborador interno de `Run`.
 */
export class StoneDrops {
  constructor(
    private readonly chances: StoneChances,
    private readonly random: RandomGenerator | null,
  ) {}

  /** ¿Suelta piedra la baja de `typeId`? `detonated`: barril que explotó por su mecha. */
  roll(typeId: string, detonated: boolean): boolean {
    if (this.random === null) return false;
    const r = Math.floor(this.random.next() * 100);
    return !detonated && r < this.chances.stoneChanceFor(typeId);
  }
}
