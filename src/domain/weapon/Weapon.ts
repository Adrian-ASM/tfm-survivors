import type { WeaponType } from './WeaponType';

/**
 * Arma equipada (entidad mutable interna a `Arsenal`). La cadencia es un tick absoluto `readyAt`,
 * sin contador por tick: cargada en el tick n si n ≥ readyAt. Empieza cargada (readyAt 0) y, al
 * disparar en T, vuelve a estarlo en T + cooldownTicks. Sin objetivo no dispara y conserva la carga.
 */
export class Weapon {
  private readyAt = 0;

  constructor(readonly type: WeaponType) {}

  isChargedAt(n: number): boolean {
    return n >= this.readyAt;
  }

  fireAt(n: number): void {
    this.readyAt = n + this.type.cooldownTicks;
  }
}
