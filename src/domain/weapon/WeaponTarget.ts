/**
 * Lo que un arma necesita de un objetivo (`Enemy`, `Structure` y `Sheep` lo cumplen de forma
 * estructural): su id, su círculo, su vida, si sigue vivo y cómo recibir daño. `takeDamage` devuelve
 * true si el golpe lo da de baja. `id` y `hp` los lee el registro de golpes (0031).
 */
export interface WeaponTarget {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly hp: number;
  readonly alive: boolean;
  takeDamage(amount: number, tick: number): boolean;
}
