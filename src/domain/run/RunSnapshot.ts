/** Enemigo vivo tal y como lo ve el adaptador de render (copia de escalares). */
export interface EnemySnapshot {
  /** Único en la partida (contador desde 0, nunca se reutiliza); no cambia mientras vive. */
  readonly id: number;
  readonly type: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/** Lo único que el adaptador de render necesita para pintar un frame (spec simulation-loop). */
export interface RunSnapshot {
  readonly tick: number;
  readonly player: {
    readonly x: number;
    readonly y: number;
    readonly radius: number;
  };
  /** Enemigos vivos en orden de aparición. */
  readonly enemies: readonly EnemySnapshot[];
}
