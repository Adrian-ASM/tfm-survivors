import { PANEL_MESSAGES, type PanelMessage } from './resultsPanelText';

/** Mensaje del menú de inicio: los del import (como en resultados) y los del borrado. */
export type MenuMessage = PanelMessage | 'cleared' | 'clear-failed';

/**
 * Textos del menú (spec main-menu y progress-persistence): los del import son los mismos que en el
 * overlay de resultados; el borrado contiene `borrado` y su fallo `no se ha podido borrar`.
 */
export const MENU_MESSAGES: Readonly<Record<MenuMessage, string>> = {
  ...PANEL_MESSAGES,
  cleared: 'Progreso borrado',
  'clear-failed': 'El progreso guardado no se ha podido borrar',
};

/** Etiquetas visibles exactas (spec main-menu). */
export const MENU_LABELS = {
  play: 'Jugar',
  export: 'Exportar',
  import: 'Importar',
  clear: 'Borrar datos',
  confirm: 'Confirmar',
  cancel: 'Cancelar',
  resume: 'Reanudar',
  toMenu: 'Volver al menú',
  pause: 'Pausa',
  title: 'Sprint Survivors',
  confirmQuestion: '¿Borrar el progreso guardado (récords e historial)?',
} as const;
