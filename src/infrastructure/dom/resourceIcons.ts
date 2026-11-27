import type { Appearance } from '../content/appearanceSchema';

/**
 * URL del icono de cada recurso (frame 0 de su hoja, recortado por CSS): la del panel de obra
 * (0027) y la de la guía del menú (0028).
 */
export interface ResourceIcons {
  readonly xp: string;
  readonly gold: string;
  readonly wood: string;
  readonly meat: string;
  readonly stone: string;
}

const HEX = 16;
const RGB_DIGITS = 6;

/**
 * Rombo con el color de la gema en un SVG `data:` (design 0028 §6): `img-src 'self' data:` ya lo
 * admite y el color llega validado por zod (`#rrggbb` ya convertido a número), así que solo se
 * vuelve a escribir en hexadecimal y se codifica la URL. Sin estilos en línea (CSP).
 */
export function gemShapeUrl(rgb: number): string {
  const color = `#${rgb.toString(HEX).padStart(RGB_DIGITS, '0')}`;
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">' +
    `<path d="M8 1L15 8L8 15L1 8Z" fill="${color}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Iconos de los cinco recursos con las mismas hojas que el contador del HUD (`counterIcon`):
 * `pickups.gold` (`G_Idle`), `pickups.wood` (`W_Idle`), `pickups.meat` (`M_Idle`) y la roca
 * `medium` de `pickups.stone` (`Deco/05`), con la URL que carga `BootScene` (mismo origen). La gema
 * usa su hoja si la tiene y, si se pinta como forma, el rombo de su color. Función pura: sin Phaser
 * ni DOM.
 */
export function resourceIcons(
  appearance: Pick<Appearance, 'pickups'>,
  assetUrl: (file: string) => string,
): ResourceIcons {
  const { xp, gold, wood, meat, stone } = appearance.pickups;
  return Object.freeze({
    xp: 'sheet' in xp ? assetUrl(xp.sheet.file) : gemShapeUrl(xp.placeholderColor),
    gold: assetUrl(gold.sheet.file),
    wood: assetUrl(wood.sheet.file),
    meat: assetUrl(meat.sheet.file),
    stone: assetUrl(stone.rocks.medium.sheet.file),
  });
}

/** Imagen de un edificio del panel de obra (0036): URL y tamaño de su frame (la proporción). */
export interface BuildingIcon {
  readonly url: string;
  readonly width: number;
  readonly height: number;
}

/**
 * Imagen de la casa y de la torre del panel de obra (0036, design D6): la hoja con la que se pinta el
 * edificio construido (`sites.house` y `sites.tower`, `House_Blue` y `Tower_Blue`), con la URL que
 * carga `BootScene` y el tamaño de su frame. Función pura.
 */
export function buildingIcons(
  appearance: Pick<Appearance, 'sites'>,
  assetUrl: (file: string) => string,
): Readonly<Record<'house' | 'tower', BuildingIcon>> {
  const icon = ({ sheet }: Appearance['sites']['house']): BuildingIcon =>
    Object.freeze({
      url: assetUrl(sheet.file),
      width: sheet.frameWidth,
      height: sheet.frameHeight,
    });
  return Object.freeze({
    house: icon(appearance.sites.house),
    tower: icon(appearance.sites.tower),
  });
}
