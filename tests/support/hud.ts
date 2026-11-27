// Contadores del HUD para los tests (change 0036): las medidas del repositorio (`appearance.json`
// `hud`) y los 4 iconos de prueba con su recorte. Un icono con `texture: null` es la reserva.
import appearanceJson from '../../content/appearance.json';
import type { CounterIcon, HudIcons } from '../../src/infrastructure/phaser/sceneWidgets';
import type { HudMetrics } from '../../src/infrastructure/phaser/ui/uiLayout';

/** Lado de los iconos y paso entre contadores del repositorio (s 24, p 30). */
export const HUD_METRICS: HudMetrics = {
  iconSize: appearanceJson.hud.iconSize,
  pitch: appearanceJson.hud.pitch,
};

export const DEAD_TEXTURE = 'Factions/Knights/Troops/Dead/Dead.png';
export const GOLD_TEXTURE = 'Resources/Resources/G_Idle.png';
export const WOOD_TEXTURE = 'Resources/Resources/W_Idle.png';
export const ROCK_TEXTURE = 'Deco/05.png';
/** Color de reserva del cadáver del repositorio (#b0b4ba). */
export const CORPSE_COLOR = 0xb0b4ba;

const FRAME_128 = { width: 128, height: 128 };
const FRAME_64 = { width: 64, height: 64 };
const { icons } = appearanceJson.hud;

/** Icono de contador de prueba: hoja (o reserva), frame, color y el recorte del repositorio. */
export function hudIcon(
  texture: string | null,
  color: number,
  crop: CounterIcon['crop'],
  frameSize: CounterIcon['frameSize'] = FRAME_128,
  frame = 0,
): CounterIcon {
  return { texture, frame, color, crop, frameSize };
}

/** Los 4 iconos con sus hojas; `missing` deja en reserva los que se indiquen. */
export function testHudIcons(missing: readonly (keyof HudIcons)[] = []): HudIcons {
  const tex = (key: keyof HudIcons, file: string) => (missing.includes(key) ? null : file);
  return {
    kills: hudIcon(tex('kills', DEAD_TEXTURE), CORPSE_COLOR, icons.kills.crop, FRAME_128, 5),
    gold: hudIcon(tex('gold', GOLD_TEXTURE), 0xe8c547, icons.gold.crop),
    wood: hudIcon(tex('wood', WOOD_TEXTURE), 0x9c6b3c, icons.wood.crop),
    stone: hudIcon(tex('stone', ROCK_TEXTURE), 0x9aa0a6, icons.stone.crop, FRAME_64),
  };
}
