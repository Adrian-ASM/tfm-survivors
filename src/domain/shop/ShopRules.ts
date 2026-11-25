import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';

/** Mensajes de las invariantes de la tienda; la validación de contenido (zod) usa los mismos. */
export const SHOP_RADIUS_MUST_BE_POSITIVE = 'El radio de interacción de la puerta debe ser > 0.';
export const SHOP_REARM_MUST_EXCEED_RADIUS =
  'La distancia de re-armado de la tienda debe ser mayor que el radio de interacción.';
export const SHOP_HEAL_MUST_BE_INTEGER =
  'El precio y la porción de la curación de pago deben ser enteros ≥ 1.';
export const SHOP_HEAL_ID_TAKEN = 'El id de la curación de pago coincide con el de una mejora';

/** Contenido de la tienda (content/shop.json, spec castle-shop 0024). */
export interface ShopConfig {
  readonly door: { readonly radius: number; readonly rearmDistance: number };
  readonly heal: {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly amount: number;
    readonly price: number;
  };
}

const isAmount = (v: number): boolean => Number.isInteger(v) && v >= 1;

/**
 * Reglas de la tienda (value object): radio de interacción de la puerta, distancia de re-armado
 * (estrictamente mayor que el radio) y curación de pago (porción y precio enteros ≥ 1). Que el id
 * de la curación no sea el de una mejora lo comprueba `buildRunRules`.
 */
export class ShopRules {
  private constructor(
    readonly radius: number,
    readonly rearmDistance: number,
    readonly heal: ShopConfig['heal'],
  ) {
    Object.freeze(this);
  }

  static create(config: ShopConfig): Result<ShopRules, DomainError> {
    const { radius, rearmDistance } = config.door;
    if (!(Number.isFinite(radius) && radius > 0)) {
      return err(invalidConfig('shop.door.radius', SHOP_RADIUS_MUST_BE_POSITIVE));
    }
    if (!(Number.isFinite(rearmDistance) && rearmDistance > radius)) {
      return err(invalidConfig('shop.door.rearmDistance', SHOP_REARM_MUST_EXCEED_RADIUS));
    }
    const { amount, price } = config.heal;
    if (!isAmount(price)) return err(invalidConfig('shop.heal.price', SHOP_HEAL_MUST_BE_INTEGER));
    if (!isAmount(amount)) {
      return err(invalidConfig('shop.heal.amount', SHOP_HEAL_MUST_BE_INTEGER));
    }
    return ok(new ShopRules(radius, rearmDistance, Object.freeze({ ...config.heal })));
  }
}
