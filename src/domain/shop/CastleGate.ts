/** Punto del mundo. */
interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Puerta del castillo (entidad mutable interna a `Run`, spec castle-shop 0024): la puerta del mapa
 * (o ninguna) y si la tienda está armada. Paso 11 del tick; sin azar ni asignaciones.
 */
export class CastleGate {
  private isArmed: boolean;

  constructor(
    readonly door: Point | null,
    private readonly rules: { readonly radius: number; readonly rearmDistance: number },
    armed = false,
  ) {
    this.isArmed = door !== null && armed;
  }

  get armed(): boolean {
    return this.isArmed;
  }

  get radius(): number {
    return this.rules.radius;
  }

  /**
   * Paso 11 con el jugador en (x, y): desarmada y a d ≥ re-armado ⇒ armada (también con una oferta
   * abierta en el tick); armada, `canOpen` (la partida sigue en curso) y d < radio (estricto) ⇒ se
   * desarma y devuelve true (la partida pasa a en tienda). Como re-armado > radio, nunca ambas.
   */
  step(x: number, y: number, canOpen: boolean): boolean {
    const { door } = this;
    if (!door) return false;
    const d = Math.hypot(x - door.x, y - door.y);
    if (!this.isArmed) {
      if (d >= this.rules.rearmDistance) this.isArmed = true;
      return false;
    }
    if (!canOpen || !(d < this.rules.radius)) return false;
    this.isArmed = false;
    return true;
  }
}
