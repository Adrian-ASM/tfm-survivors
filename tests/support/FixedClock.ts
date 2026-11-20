import type { Clock } from '../../src/domain/shared/Clock';

/** Reloj de pared de prueba: marca `now` hasta que el test lo cambia. */
export class FixedClock implements Clock {
  constructor(public now = 1_763_596_800_000) {}

  nowMs(): number {
    return this.now;
  }
}
