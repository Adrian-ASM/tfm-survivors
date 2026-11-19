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

/** Proyectil vivo (spec auto-weapons): id único en la partida, nunca reutilizado. */
export interface ProjectileSnapshot {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/** Pulso visible: arma que lo disparó, tick de disparo, centro fijo y radio del criterio. */
export interface PulseSnapshot {
  readonly weapon: string;
  readonly firedAt: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
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
  /** Proyectiles vivos en orden de creación. */
  readonly projectiles: readonly ProjectileSnapshot[];
  /** Pulsos visibles en orden de disparo. */
  readonly pulses: readonly PulseSnapshot[];
}
