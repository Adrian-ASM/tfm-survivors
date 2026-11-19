import type { Arena } from '../arena/Arena';
import type { Vector2 } from '../shared/Vector2';
import type { PlayerInput } from './PlayerInput';

/** Jugador (entidad). Inmutable: cada movimiento devuelve un Player nuevo. */
export class Player {
  private constructor(
    readonly position: Vector2,
    readonly radius: number,
    readonly speed: number,
  ) {
    Object.freeze(this);
  }

  /** Crea un jugador; radio y velocidad ya validados por Run.start. */
  static spawn(position: Vector2, radius: number, speed: number): Player {
    return new Player(position, radius, speed);
  }

  /** Avanza dt segundos sin inercia y sin salir de la arena. */
  move(input: PlayerInput, dtSeconds: number, arena: Arena): Player {
    const next = this.position.add(input.direction.scale(this.speed * dtSeconds));
    return new Player(arena.clampCircle(next, this.radius), this.radius, this.speed);
  }
}
