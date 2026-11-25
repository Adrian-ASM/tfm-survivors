/** Punto del mundo. */
interface Point {
  readonly x: number;
  readonly y: number;
}

/** Radio de apertura y distancia de re-armado (re-armado > radio, lo validan las reglas). */
export interface ProximityRules {
  readonly radius: number;
  readonly rearmDistance: number;
}

/**
 * Puerta por proximidad con re-armado (entidad mutable interna a `Run`; extraída de la puerta del
 * castillo, ADR-0023 y ADR-0025): un punto (o ninguno) y si está armada. La usan la tienda (paso
 * 11) y cada solar de obra (paso 12). Sin azar ni asignaciones.
 */
export class ProximityGate {
  private isArmed: boolean;

  constructor(
    readonly point: Point | null,
    private readonly rules: ProximityRules,
    armed = false,
  ) {
    this.isArmed = point !== null && armed;
  }

  get armed(): boolean {
    return this.isArmed;
  }

  get radius(): number {
    return this.rules.radius;
  }

  /**
   * Paso con el jugador en (x, y): desarmada y a d ≥ re-armado ⇒ armada (también con otra fase
   * abierta en el tick); armada, `canOpen` y d < radio (estricto) ⇒ se desarma y devuelve true.
   * Armada y sin `canOpen` sigue armada. Como re-armado > radio, nunca ambas en el mismo paso.
   */
  step(x: number, y: number, canOpen: boolean): boolean {
    const { point } = this;
    if (!point) return false;
    const d = Math.hypot(x - point.x, y - point.y);
    if (!this.isArmed) {
      if (d >= this.rules.rearmDistance) this.isArmed = true;
      return false;
    }
    if (!canOpen || !(d < this.rules.radius)) return false;
    this.isArmed = false;
    return true;
  }
}
