import type { Progress } from '../../domain/progress/Progress';
import { formatClock } from '../phaser/hudFormat';

/** Resultado del último import mostrado en el panel. */
export type PanelMessage = 'imported' | 'too-large' | 'invalid';

/** Mensajes del import (spec run-results): éxito con `importado`, rechazos con `64 KiB` / `no válido`. */
export const PANEL_MESSAGES: Readonly<Record<PanelMessage, string>> = {
  imported: 'Progreso importado y fusionado',
  'too-large': 'Fichero rechazado: ocupa más de 64 KiB',
  invalid: 'Fichero no válido: no es un progreso de Sprint Survivors',
};

/** Avisos del panel (spec run-results). */
export const PANEL_NOTICES = {
  notSaved: 'El progreso no se guarda en este navegador',
  corrupt: 'Los datos guardados estaban dañados: se han ignorado',
} as const;

/** Único aviso de consola al cargar datos guardados dañados (spec: menciona `progress`). */
export const PROGRESS_CORRUPT_WARNING =
  'Sprint Survivors: el progress guardado está dañado o es de otra versión; se usa el progreso vacío';

/** Estado del progreso que decide los avisos. */
export interface PanelFlags {
  /** El último guardado funcionó (false ⇒ "no se guarda"). */
  readonly persistent: boolean;
  /** Primera partida terminada de una carga con datos dañados. */
  readonly corrupt: boolean;
}

/** Lo que muestra el panel de progreso del overlay de resultados (y lo que expone el probe). */
export interface ResultsPanelView {
  /** `Mejor tiempo mm:ss`, `Mejor nivel N`, `Máx. bajas N`. */
  readonly records: readonly string[];
  readonly notices: readonly string[];
  readonly message: string | null;
}

export function resultsPanelView(
  progress: Progress,
  flags: PanelFlags,
  message: PanelMessage | null,
): ResultsPanelView {
  const { bestTimeSeconds, bestLevel, maxKills } = progress.records;
  const notices: string[] = [];
  if (!flags.persistent) notices.push(PANEL_NOTICES.notSaved);
  if (flags.corrupt) notices.push(PANEL_NOTICES.corrupt);
  return {
    records: [
      `Mejor tiempo ${formatClock(bestTimeSeconds)}`,
      `Mejor nivel ${String(bestLevel)}`,
      `Máx. bajas ${String(maxKills)}`,
    ],
    notices,
    message: message === null ? null : PANEL_MESSAGES[message],
  };
}
