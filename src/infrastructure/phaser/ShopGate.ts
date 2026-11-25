import type { RunSnapshot } from '../../domain/run/RunSnapshot';
import type { RunStatus } from '../../domain/run/RunStatus';
import type { Result } from '../../domain/shared/Result';
import type { ShopError } from '../../domain/shop/ShopError';

/** Acción pulsada en el overlay de la tienda en este frame. */
export type ShopAction =
  { readonly kind: 'buy'; readonly id: string } | { readonly kind: 'leave' } | null;

/** Los casos de uso de la tienda (los de `StartedRun`). */
export interface ShopUseCases {
  readonly buyFromShop: { execute(id: string): Result<RunSnapshot, ShopError> };
  readonly leaveShop: { execute(): Result<RunSnapshot, ShopError> };
}

/** Resultado del paso: si Esc queda libre para la pausa y el snapshot nuevo (si cambió algo). */
export interface ShopStep {
  readonly esc: boolean;
  readonly snapshot: RunSnapshot | null;
}

/** El overlay de la tienda se ve si y solo si la partida está en tienda y no en pausa. */
export const shopVisible = (status: RunStatus | undefined, paused: boolean): boolean =>
  !paused && status === 'shopping';

/** Pantalla de la sonda E2E para un frame de partida: pausa, tienda o en juego. */
export const playScreen = (
  status: RunStatus | undefined,
  paused: boolean,
): 'paused' | 'shop' | 'playing' =>
  paused ? 'paused' : shopVisible(status, paused) ? 'shop' : 'playing';

/**
 * Reglas de la tienda en la escena (spec castle-shop y main-menu 0024), sin import del motor
 * (patrón `PauseGate`): con la partida en tienda, Esc o `Salir` ⇒ `LeaveShop` y Esc se consume
 * (nunca abre la pausa ese frame); `Comprar` ⇒ `BuyFromShop` (un error no cambia nada). Fuera de la
 * tienda no hace nada y deja pasar Esc. Va antes de `PauseGate` en `GameScene.update`.
 */
export class ShopGate {
  step(esc: boolean, action: ShopAction, status: RunStatus, run: ShopUseCases): ShopStep {
    if (status !== 'shopping') return { esc, snapshot: null };
    if (esc || action?.kind === 'leave') {
      const left = run.leaveShop.execute();
      return { esc: false, snapshot: left.ok ? left.value : null };
    }
    if (action?.kind === 'buy') {
      const bought = run.buyFromShop.execute(action.id);
      return { esc: false, snapshot: bought.ok ? bought.value : null };
    }
    return { esc: false, snapshot: null };
  }
}
