/** Lo único que el adaptador de render necesita para pintar un frame (spec simulation-loop). */
export interface RunSnapshot {
  readonly tick: number;
  readonly player: {
    readonly x: number;
    readonly y: number;
    readonly radius: number;
  };
}
