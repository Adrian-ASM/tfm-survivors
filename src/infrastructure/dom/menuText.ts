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
  guide: 'Cómo jugar',
  export: 'Exportar',
  import: 'Importar',
  clear: 'Borrar datos',
  confirm: 'Confirmar',
  cancel: 'Cancelar',
  resume: 'Reanudar',
  toMenu: 'Volver al menú',
  pause: 'Pausa',
  title: 'Greentide Vanguard',
  confirmQuestion: '¿Borrar el progreso guardado (récords e historial)?',
  shop: 'Tienda',
  shopLeave: 'Salir',
  shopGoldLabel: 'Oro',
  shopGold: 'de oro',
  shopMax: 'Máximo',
  shopNoGold: 'Oro insuficiente',
  shopFullHealth: 'Vida llena',
  build: 'Obra',
  buildLeave: 'Salir',
  buildWood: 'madera',
  buildStone: 'piedra',
  buildHouse: 'Casa',
  buildTower: 'Torre',
  guidePrev: 'Anterior',
  guideNext: 'Siguiente',
  guideClose: 'Cerrar',
  sound: 'Sonido',
  soundMusic: 'Música',
  soundEffects: 'Efectos',
  soundMute: 'Silenciar todo',
  soundClose: 'Cerrar',
} as const;

/** Valor visible de un deslizador del panel Sonido (spec audio): «N %». */
export const soundPercent = (n: number): string => `${String(n)} %`;

/** Indicador de página de la guía (spec menu-guide): «n de total». */
export const guidePage = (n: number, total: number): string => `${String(n)} de ${String(total)}`;

/** Texto alternativo de cada icono de recurso de la guía (etiquetas de UI, no texto de páginas). */
export const GUIDE_ICON_ALT = {
  xp: 'gemas',
  gold: 'oro',
  wood: 'madera',
  meat: 'carne',
  stone: 'piedra',
} as const;

/** Texto de lo que falta de un recurso en el panel de obra (0027): «faltan N». */
export const buildMissing = (n: number): string => `faltan ${String(n)}`;
