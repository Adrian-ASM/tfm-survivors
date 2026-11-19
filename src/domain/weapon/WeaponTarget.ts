/**
 * Lo que un arma necesita de un enemigo (`Enemy` lo cumple de forma estructural): su círculo, si
 * sigue vivo y cómo recibir daño. `takeDamage` devuelve true si el golpe lo da de baja.
 */
export interface WeaponTarget {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly alive: boolean;
  takeDamage(amount: number, tick: number): boolean;
}
