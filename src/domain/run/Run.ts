import { Arena } from '../arena/Arena';
import { Player } from '../player/Player';
import type { PlayerInput } from '../player/PlayerInput';
import { err, invalidConfig, ok, type DomainError, type Result } from '../shared/Result';
import { TICK_SECONDS } from '../shared/Tick';
import { RADIUS_MUST_FIT, SPEED_MUST_BE_POSITIVE, type RunConfig as FullConfig } from './RunConfig';
import type { RunSnapshot } from './RunSnapshot';

export { TICK_SECONDS, RADIUS_MUST_FIT, SPEED_MUST_BE_POSITIVE };

/** Transitorio (tarea 3.1 lo sustituye por la configuración completa): Run.start solo usa esto. */
export type RunConfig = Pick<FullConfig, 'player'> & {
  readonly arena: { readonly width: number; readonly height: number };
};

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
    if (!Number.isFinite(speed) || speed <= 0) {
      return err(invalidConfig('player.speed', SPEED_MUST_BE_POSITIVE));
    }
    if (!arena.value.fits(radius)) {
      return err(invalidConfig('player.radius', RADIUS_MUST_FIT));
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
