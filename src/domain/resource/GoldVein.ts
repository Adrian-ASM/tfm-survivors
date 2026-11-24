import { circlesOverlap } from '../collision/contact';

/**
 * Veta de oro (entidad, spec resources "Vetas de oro al pasar", ADR-0021): punto fijo con su oro y
 * un radio de contacto. Entrega su oro una sola vez, al solapar al jugador, y queda agotada para
 * siempre. No bloquea, no tiene vida, no es objetivo de nada y el imán no la mueve. Interna a `Run`.
 */
export class GoldVein {
  private spent: boolean;

  constructor(
    readonly id: number,
    readonly x: number,
    readonly y: number,
    readonly radius: number,
    readonly gold: number,
    depleted = false,
  ) {
    this.spent = depleted;
  }

  get depleted(): boolean {
    return this.spent;
  }

  /**
   * Paso 7.2: si está activa y su centro está a distancia estrictamente menor que pr + radio del
   * jugador en (px, py), queda agotada y devuelve su oro; si no, 0.
   */
  tap(px: number, py: number, pr: number): number {
    if (this.spent || !circlesOverlap(px, py, pr, this.x, this.y, this.radius)) return 0;
    this.spent = true;
    return this.gold;
  }
}
