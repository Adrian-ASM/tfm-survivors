/** Estado de la música (spec audio 0035, convenciones). */
export type MusicState = 'stopped' | 'playing' | 'paused';

export interface MusicInputs {
  /** Hay partida (falso en el menú, con o sin guía, diálogo o panel). */
  readonly inRun: boolean;
  /** La partida está terminada (resultados). */
  readonly over: boolean;
  /** Pausa del jugador. */
  readonly paused: boolean;
  /** Retención de 0033 (aviso de orientación). */
  readonly held: boolean;
  /** Pestaña oculta. */
  readonly hidden: boolean;
}

/**
 * Estado de la música (design 0035 D6), puro: parada sin partida o con la partida terminada; en
 * pausa con la pausa, la retención o la pestaña oculta; si no, sonando. Oferta, tienda y obra no
 * son pausa.
 */
export function musicState(i: MusicInputs): MusicState {
  if (!i.inRun || i.over) return 'stopped';
  if (i.paused || i.held || i.hidden) return 'paused';
  return 'playing';
}
