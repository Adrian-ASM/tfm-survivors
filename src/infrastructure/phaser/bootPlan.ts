import type { Appearance } from '../content/appearanceSchema';
import { aspectsOf } from '../content/loadAppearance';
import { GAME_SCENE_KEY, MENU_SCENE_KEY } from './sceneKeys';

/** Una hoja a cargar: la clave de textura es su `file` (design D3). */
export interface SheetLoad {
  readonly key: string;
  readonly file: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
}

/** Una carga por `file` distinto, en el orden de los aspectos. Puro: sin motor. */
export function sheetsToLoad(appearance: Appearance): SheetLoad[] {
  const byFile = new Map<string, SheetLoad>();
  for (const [, aspect] of aspectsOf(appearance)) {
    const { file, frameWidth, frameHeight } = aspect.sheet;
    if (!byFile.has(file)) byFile.set(file, { key: file, file, frameWidth, frameHeight });
  }
  return [...byFile.values()];
}

/** Tras la carga: con `?e2e`, la partida (arranque de antes, ADR-0011); sin él, el menú. */
export function nextSceneKey(e2e: boolean): string {
  return e2e ? GAME_SCENE_KEY : MENU_SCENE_KEY;
}
