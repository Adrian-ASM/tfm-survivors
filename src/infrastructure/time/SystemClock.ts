import type { Clock } from '../../domain/shared/Clock';

/** Reloj de pared del navegador: el único `Date.now` del juego, fuera del núcleo. */
export class SystemClock implements Clock {
  nowMs(): number {
    return Date.now();
  }
}
