import type { RandomGenerator } from '../../src/domain/shared/RandomGenerator';

const checked = (v: number): number => {
  if (!(v >= 0 && v < 1))
    throw new RangeError(`StubRandom requiere un valor en [0, 1) (${String(v)})`);
  return v;
};

/** Doble de RandomGenerator: devuelve siempre `value` (fijable desde el test) y cuenta las llamadas. */
export class StubRandom implements RandomGenerator {
  private current: number;
  calls = 0;

  constructor(value: number) {
    this.current = checked(value);
  }

  get value(): number {
    return this.current;
  }

  set value(v: number) {
    this.current = checked(v);
  }

  next(): number {
    this.calls += 1;
    return this.current;
  }
}
