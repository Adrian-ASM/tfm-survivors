import type { EnemyType } from '../enemy/EnemyType';
import type { RandomGenerator } from '../shared/RandomGenerator';
import { TICKS_PER_SECOND } from '../shared/Tick';
import type { SpawnRules } from './SpawnRules';
import type { WaveSegment, WaveTable } from './WaveTable';

/** Intenta colocar un enemigo del tipo dado; devuelve false si no hay posición válida (spawn aplazado). */
export type SpawnAttempt = (type: EnemyType) => boolean;

/**
 * Director de oleadas por presupuesto (servicio de dominio con estado; lo posee `Run`).
 * El presupuesto se lleva en unidades × 60 (`budget60`): sumar `budgetPerSecond` por tick y comparar con
 * `cost × 60` es exacto con valores enteros, cosa que no pasa sumando 1/60 en coma flotante.
 */
export class WaveDirector {
  private budget60 = 0;
  private pending: EnemyType | null = null;
  private segmentIndex = 0;

  constructor(
    private readonly table: WaveTable,
    private readonly rules: SpawnRules,
    private readonly random: RandomGenerator,
  ) {}

  /**
   * Tick n (el que mostrará el snapshot), con `alive` enemigos vivos antes de aparecer los nuevos.
   * - Con el tope alcanzado no se acumula ni se consume azar (la política al bajar del tope es de 0003).
   * - Al cambiar de tramo se conserva el presupuesto y se vuelve a elegir el tipo pendiente.
   * - Si `place` no encuentra posición, el spawn se aplaza: no se gasta, se mantiene el pendiente y el
   *   tick termina; el presupuesto sigue acumulándose en los ticks siguientes.
   */
  step(tick: number, alive: number, place: SpawnAttempt): void {
    this.advanceSegment(tick);
    const { maxAlive } = this.rules;
    if (alive >= maxAlive) return;
    const segment = this.segment();
    this.budget60 += segment.budgetPerSecond;
    for (let count = alive; count < maxAlive; count++) {
      const type = this.pending ?? this.pick(segment);
      this.pending = type;
      if (this.budget60 < type.cost * TICKS_PER_SECOND || !place(type)) return;
      this.budget60 -= type.cost * TICKS_PER_SECOND;
      this.pending = null;
    }
  }

  private advanceSegment(tick: number): void {
    const index = this.table.indexAt(tick, this.segmentIndex);
    if (index === this.segmentIndex) return;
    this.segmentIndex = index;
    this.pending = null;
  }

  private segment(): WaveSegment {
    const segment = this.table.segments[this.segmentIndex];
    if (!segment) throw new RangeError('WaveTable sin tramos (invariante rota)');
    return segment;
  }

  private pick(segment: WaveSegment): EnemyType {
    const type = segment.types[Math.floor(this.random.next() * segment.types.length)];
    if (!type) throw new RangeError('El generador devolvió un valor fuera de [0, 1)');
    return type;
  }
}
