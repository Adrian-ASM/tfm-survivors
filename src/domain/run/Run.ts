import { Arena } from '../arena/Arena';
import { Player } from '../player/Player';
import type { PlayerInput } from '../player/PlayerInput';
import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import type { RunSnapshot } from './RunSnapshot';

/** Duración de un tick de simulación (spec simulation-loop: paso fijo de 1/60 s). */
export const TICK_SECONDS = 1 / 60;

/** Configuración de partida ya validada en forma (zod, infraestructura); aquí se validan invariantes. */
export interface RunConfig {
  readonly arena: { readonly width: number; readonly height: number };
  readonly player: { readonly speed: number; readonly radius: number };
}

/** Partida en curso (aggregate root). Único punto de entrada para cambiar el estado de la simulación. */
export class Run {
  private tickCount = 0;

  private constructor(
    private readonly arena: Arena,
    private player: Player,
  ) {}

  static start(config: RunConfig): Result<Run, DomainError> {
    const arena = Arena.create(config.arena.width, config.arena.height);
    if (!arena.ok) return arena;
    const { speed, radius } = config.player;
    if (!Number.isFinite(speed) || speed < 0) {
      return err(invalidConfig('player.speed', 'La velocidad del jugador no puede ser negativa.'));
    }
    if (!arena.value.fits(radius)) {
      return err(invalidConfig('player.radius', 'El radio del jugador no cabe en la arena.'));
    }
    return ok(new Run(arena.value, Player.spawn(arena.value.center, radius, speed)));
  }

  tick(input: PlayerInput): void {
    this.player = this.player.move(input, TICK_SECONDS, this.arena);
    this.tickCount += 1;
  }

  /** Copia congelada del estado: el adaptador puede leerla pero no alterar la partida. */
  snapshot(): RunSnapshot {
    const { position, radius } = this.player;
    return Object.freeze({
      tick: this.tickCount,
      player: Object.freeze({ x: position.x, y: position.y, radius }),
    });
  }
}
