import { Vector2 } from '../shared/Vector2';

const clampUnit = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(-1, v)) : 0);

/**
 * Intención de movimiento del jugador en un tick (value object).
 * Invariantes: cada componente en [-1, 1] y módulo ≤ 1 (la diagonal no es más rápida que un eje).
 */
export class PlayerInput {
  static readonly NONE = new PlayerInput(Vector2.ZERO);

  private constructor(readonly direction: Vector2) {
    Object.freeze(this);
  }

  static of(x: number, y: number): PlayerInput {
    const raw = Vector2.of(clampUnit(x), clampUnit(y));
    const length = raw.length();
    return new PlayerInput(length > 1 ? raw.scale(1 / length) : raw);
  }
}
