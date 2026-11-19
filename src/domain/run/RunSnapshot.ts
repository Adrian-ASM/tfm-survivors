import type { RunStatus } from './RunStatus';

/** Enemigo vivo tal y como lo ve el adaptador de render (copia de escalares). */
export interface EnemySnapshot {
  /** Único en la partida (contador desde 0, nunca se reutiliza); no cambia mientras vive. */
  readonly id: number;
  readonly type: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** Vida actual (> 0: solo se listan enemigos vivos). */
  readonly health: number;
}

/** Lo único que el adaptador de render necesita para pintar un frame (spec simulation-loop). */
export interface RunSnapshot {
  readonly tick: number;
  readonly status: RunStatus;
  readonly player: {
    readonly x: number;
    readonly y: number;
    readonly radius: number;
    readonly health: number;
    readonly maxHealth: number;
    /** Un contacto en el tick siguiente no haría daño (spec player-health). */
    readonly invulnerable: boolean;
  };
  /** Enemigos vivos en orden de aparición. */
  readonly enemies: readonly EnemySnapshot[];
}
