import type { Run } from '../domain/run/Run';
import type { RunSnapshot } from '../domain/run/RunSnapshot';
import { ok, type Result } from '../domain/shared/Result';
import type { ShopError } from '../domain/shop/ShopError';

/**
 * Caso de uso: comprar un producto de la tienda por su id (spec castle-shop 0024). Devuelve el
 * snapshot tras la compra; un error tipado no cambia la partida ni consume azar.
 */
export class BuyFromShop {
  constructor(private readonly run: Run) {}

  execute(productId: string): Result<RunSnapshot, ShopError> {
    const bought = this.run.buy(productId);
    return bought.ok ? ok(this.run.snapshot()) : bought;
  }
}
