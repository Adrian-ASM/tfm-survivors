import { describe, expect, it } from 'vitest';
import { Weapon } from '../../src/domain/weapon/Weapon';
import { WeaponType } from '../../src/domain/weapon/WeaponType';
import { LINTER } from '../support/builders';

function linter(): Weapon {
  const type = WeaponType.create(LINTER, 'weapons.weapons.0');
  if (!type.ok) throw new Error(type.error.message);
  return new Weapon(type.value);
}

/** Simula la cronología: dispara en cada tick cargado en el que `hasTarget(n)`. */
function firingTicks(w: Weapon, ticks: number, hasTarget: (n: number) => boolean): number[] {
  const fired: number[] = [];
  for (let n = 1; n <= ticks; n++) {
    if (w.isChargedAt(n) && hasTarget(n)) {
      w.fireAt(n);
      fired.push(n);
    }
  }
  return fired;
}

describe('Weapon · cadencia', () => {
  it('empieza cargada (también antes del primer tick)', () => {
    const w = linter();
    expect([w.isChargedAt(0), w.isChargedAt(1)]).toEqual([true, true]);
  });

  it('Scenario: Carga de las armas en el snapshot (disparo en 1: no cargada de 1 a 30)', () => {
    const w = linter();
    w.fireAt(1);
    expect([w.isChargedAt(1), w.isChargedAt(30), w.isChargedAt(31)]).toEqual([false, false, true]);
  });

  it('Scenario: Cadencia con objetivo permanente (1, 31, …, 181)', () => {
    expect(firingTicks(linter(), 181, () => true)).toEqual([1, 31, 61, 91, 121, 151, 181]);
  });

  it('Scenario: La retención reinicia la cadencia (1, 41, 71, 101)', () => {
    const fired = firingTicks(linter(), 101, (n) => n < 31 || n > 40);
    expect(fired).toEqual([1, 41, 71, 101]);
  });
});
