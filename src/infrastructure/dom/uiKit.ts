import {
  UI_INKS,
  UI_PIECES,
  type UiAppearance,
  type UiPieceRole,
} from '../content/appearanceSchema';
import { uiMargins } from '../phaser/ui/nineSlice';
import type { StyleLike } from './applyUiScale';

// Adaptador CSS de las piezas de UI (0032, ADR-0028, design §4): `src/styles.css` no escribe ninguna
// URL; lee variables que la composición publica en `#game` por CSSOM al terminar la carga.

/** Tintas que se publican como "activas" de una pieza cargada (texto sobre su imagen). */
const ON_INKS = ['text', 'muted', 'accent', 'danger'] as const;

/** Nombre CSS de un rol: `buttonDangerPressed` → `button-danger-pressed`. */
export function cssRole(role: UiPieceRole): string {
  return role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/** Color `0xRRGGBB` como `#rrggbb`. */
export function cssHex(rgb: number): string {
  return `#${rgb.toString(16).padStart(6, '0')}`;
}

/** `"<family>", monospace`: la familia de `ui` con la caída de siempre (DOM y Phaser). */
export function fontStack(ui: UiAppearance): string {
  return `"${ui.font.family}", monospace`;
}

/**
 * Variables CSS de la interfaz (design §4). Siempre: relleno y tintas de las 8 piezas y la familia.
 * Solo de las piezas cuya hoja cargó (`loaded`, claves = `image`): su URL, sus márgenes, su alto
 * (cabecera), sus tintas activas y el fondo transparente; y la opacidad 1 de las filas no disponibles
 * si cargó `buttonDisabled`. `url(file)` da la URL bajo la base (la misma que carga `BootScene`).
 */
export function uiKitVariables(
  ui: UiAppearance,
  loaded: ReadonlySet<string>,
  url: (file: string) => string,
): Record<string, string> {
  const vars: Record<string, string> = { '--ui-font': fontStack(ui) };
  for (const role of UI_PIECES) {
    const piece = ui.pieces[role];
    const name = `--ui-${cssRole(role)}`;
    vars[`${name}-fill`] = cssHex(piece.fill);
    for (const ink of UI_INKS) vars[`${name}-${ink}`] = cssHex(piece.ink[ink]);
    if (!loaded.has(piece.image)) continue;
    const { top: t, right: r, bottom: b, left: l } = uiMargins(piece);
    vars[`${name}-src`] = `url("${url(piece.image)}")`;
    vars[`${name}-slice`] = `${String(t)} ${String(r)} ${String(b)} ${String(l)}`;
    vars[`${name}-t`] = String(t);
    vars[`${name}-r`] = String(r);
    vars[`${name}-b`] = String(b);
    vars[`${name}-l`] = String(l);
    if ('height' in piece) vars[`${name}-h`] = String(piece.height);
    for (const ink of ON_INKS) vars[`${name}-on-${ink}`] = cssHex(piece.ink[ink]);
    vars[`${name}-on-bg`] = 'transparent';
  }
  if (loaded.has(ui.pieces.buttonDisabled.image)) vars['--ui-disabled-opacity'] = '1';
  return vars;
}

/** Publica las variables en el estilo de `#game` (CSSOM: lo permite `style-src 'self'`). */
export function applyUiKit(style: Pick<StyleLike, 'setProperty'>, vars: Record<string, string>) {
  for (const [name, value] of Object.entries(vars)) style.setProperty(name, value);
}
