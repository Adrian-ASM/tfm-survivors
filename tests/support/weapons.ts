import { Arsenal } from '../../src/domain/weapon/Arsenal';
import { WeaponLoadout, type WeaponsConfig } from '../../src/domain/weapon/WeaponLoadout';
import type { WeaponTarget } from '../../src/domain/weapon/WeaponTarget';
import { WeaponType, type WeaponTypeConfig } from '../../src/domain/weapon/WeaponType';
import { LINTER, TESTS } from './builders';

/** Contenido de armas con las armas dadas (tope 32 y destello 4 salvo que se cambien). */
export const weaponsOf = (
  weapons: readonly WeaponTypeConfig[],
  overrides: Partial<Omit<WeaponsConfig, 'weapons'>> = {},
): WeaponsConfig => ({ maxProjectiles: 32, hitFlashTicks: 4, ...overrides, weapons });

export function anArsenal(config: WeaponsConfig): Arsenal {
  const l = WeaponLoadout.create(config);
  if (!l.ok) throw new Error(l.error.message);
  return new Arsenal(l.value);
}

/** Tipo de arma validado (falla si el contenido es inválido). */
export function typeOf(config: WeaponTypeConfig): WeaponType {
  const t = WeaponType.create(config, 'weapons.weapons.0');
  if (!t.ok) throw new Error(t.error.message);
  return t.value;
}

/** Linter de prueba con cambios (p. ej. otra cadencia o id). */
export const aLinter = (patch: Partial<WeaponTypeConfig> = {}): WeaponTypeConfig => ({
  ...LINTER,
  ...patch,
});

/** Tests de prueba con cambios. */
export const aPulse = (patch: Partial<WeaponTypeConfig> = {}): WeaponTypeConfig => ({
  ...TESTS,
  ...patch,
});

/** Doble de enemigo: círculo inmóvil (el test lo coloca) con vida y registro de impactos. */
export class FakeTarget implements WeaponTarget {
  readonly hits: number[] = [];

  constructor(
    public x: number,
    public y: number,
    public hp = 10,
    readonly radius = 10,
    readonly id = 0,
  ) {}

  get alive(): boolean {
    return this.hp > 0;
  }

  takeDamage(amount: number, tick: number): boolean {
    if (!this.alive) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.hits.push(tick);
    return !this.alive;
  }
}

/** Ejecuta los pasos de armas de los ticks from … to (inclusive) y devuelve las bajas totales. */
export function stepTicks(
  arsenal: Arsenal,
  from: number,
  to: number,
  targets: readonly WeaponTarget[],
  px = 480,
  py = 270,
): number {
  let kills = 0;
  for (let n = from; n <= to; n++) kills += arsenal.step(n, px, py, targets);
  return kills;
}
