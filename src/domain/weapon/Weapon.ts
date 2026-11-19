import type { WeaponType } from './WeaponType';

/**
 * Arma equipada (entidad mutable interna a `Arsenal`). La cadencia es un tick absoluto `readyAt`,
 * sin contador por tick: cargada en el tick n si n ≥ readyAt. Empieza cargada (readyAt 0) y, al
 * disparar en T, vuelve a estarlo en T + cooldownTicks. Sin objetivo no dispara y conserva la carga.
 * Su tipo es el efectivo (base + mejoras, ADR-0008): solo `Arsenal.retune` lo cambia.
 */
export class Weapon {
  private readyAt = 0;
  private current: WeaponType;

  constructor(type: WeaponType) {
    this.current = type;
  }

  get type(): WeaponType {
    return this.current;
  }

  isChargedAt(n: number): boolean {
    return n >= this.readyAt;
  }

  fireAt(n: number): void {
    this.readyAt = n + this.current.cooldownTicks;
  }

  /** Cambia el tipo efectivo sin tocar `readyAt`: la cadencia nueva rige desde el siguiente disparo. */
  retune(type: WeaponType): void {
    this.current = type;
  }
}
