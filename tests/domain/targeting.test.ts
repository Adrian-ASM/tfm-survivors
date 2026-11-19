import { describe, expect, it } from 'vitest';
import type { WeaponTarget } from '../../src/domain/weapon/WeaponTarget';
import { firstInRadius, nearestInRange, selectTarget } from '../../src/domain/weapon/targeting';

/** Doble de objetivo: círculo de radio 10 con vida; `takeDamage` no se usa al elegir. */
const at = (x: number, y: number, alive = true): WeaponTarget => ({
  x,
  y,
  radius: 10,
  alive,
  takeDamage: () => false,
});

const PX = 480;
const PY = 270;
const LINTER = { mode: 'nearest-in-range', range: 400 } as const;
const TESTS = { mode: 'any-in-radius', radius: 90 } as const;

describe('Criterio nearest-in-range', () => {
  it('Scenario: Elige el más cercano', () => {
    const targets = [at(780, 270), at(480, 120), at(380, 270)];
    expect(selectTarget(LINTER, PX, PY, targets)).toBe(2);
  });

  it('Scenario: Ignora los que están fuera de alcance (401 px)', () => {
    expect(nearestInRange(PX, PY, 400, [at(881, 270)])).toBe(-1);
  });

  it('Scenario: Límite exacto del alcance (400 px)', () => {
    expect(nearestInRange(PX, PY, 400, [at(880, 270)])).toBe(0);
  });

  it('Scenario: Empate por orden de aparición', () => {
    expect(nearestInRange(PX, PY, 400, [at(380, 270), at(580, 270)])).toBe(0);
  });

  it('ignora a los muertos aún no compactados', () => {
    expect(nearestInRange(PX, PY, 400, [at(470, 270, false), at(300, 270)])).toBe(1);
  });

  it('sin objetivos no hay objetivo', () => {
    expect(selectTarget(LINTER, PX, PY, [])).toBe(-1);
  });
});

describe('Criterio any-in-radius', () => {
  it('el primero de la lista que solapa activa el pulso', () => {
    const targets = [at(PX + 150, PY), at(PX + 99, PY), at(PX + 50, PY)];
    expect(selectTarget(TESTS, PX, PY, targets)).toBe(1);
  });

  it('Scenario: Límite exacto del pulso (bug de radio 10 a distancia 100: no hay objetivo)', () => {
    expect(firstInRadius(PX, PY, 90, [at(PX + 100, PY)])).toBe(-1);
  });

  it('ignora a los muertos', () => {
    expect(firstInRadius(PX, PY, 90, [at(PX + 10, PY, false)])).toBe(-1);
  });
});
