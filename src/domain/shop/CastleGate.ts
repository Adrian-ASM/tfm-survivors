import { ProximityGate } from '../shared/ProximityGate';

/**
 * Puerta del castillo (spec castle-shop 0024): `ProximityGate` sobre la puerta del mapa (o ninguna),
 * nacida desarmada salvo que el escenario diga otra cosa. Paso 11 del tick.
 */
export class CastleGate extends ProximityGate {
  /** La puerta de la tienda (el punto de la puerta por proximidad). */
  get door(): ProximityGate['point'] {
    return this.point;
  }
}
