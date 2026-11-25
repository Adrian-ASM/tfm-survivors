import type { Run } from '../domain/run/Run';
import type { RunSnapshot } from '../domain/run/RunSnapshot';
import { ok, type Result } from '../domain/shared/Result';
import type { ShopError } from '../domain/shop/ShopError';

/**
 * Caso de uso: salir de la tienda (spec castle-shop 0024). Devuelve el snapshot en curso sin
 * ejecutar ticks; fuera de la tienda, un error tipado sin cambios.
 */
export class LeaveShop {
  constructor(private readonly run: Run) {}

  execute(): Result<RunSnapshot, ShopError> {
    const left = this.run.leaveShop();
    return left.ok ? ok(this.run.snapshot()) : left;
  }
}
