import type { Appearance } from '../content/appearanceSchema';

/** URL de la hoja del icono de cada recurso del panel de obra (frame 0, recortado por CSS). */
export interface ResourceIcons {
  readonly wood: string;
  readonly stone: string;
}

/**
 * Iconos de madera y piedra del panel de obra (design 0027 §3): las mismas hojas que el contador
 * del HUD (`counterIcon`), la de `pickups.wood` (`W_Idle`) y la de la roca `medium` de
 * `pickups.stone` (`Deco/05`), con la URL que carga `BootScene` (mismo origen: CSP
 * `img-src 'self'`). Función pura: no conoce Phaser ni el DOM.
 */
export function resourceIcons(
  appearance: Pick<Appearance, 'pickups'>,
  assetUrl: (file: string) => string,
): ResourceIcons {
  const { wood, stone } = appearance.pickups;
  return Object.freeze({
    wood: assetUrl(wood.sheet.file),
    stone: assetUrl(stone.rocks.medium.sheet.file),
  });
}
