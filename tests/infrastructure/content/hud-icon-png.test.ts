import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import appearanceJson from '../../../content/appearance.json';
import { pixelAt, readPng, type Png } from '../../support/png';

// Spec sprite-rendering (0036), "Datos de los contadores del repositorio": la calavera es un frame
// no vacío de `Dead.png`, y cada recorte del HUD (design D5) es el cuadrado mínimo sobre la caja de
// píxeles con alfa > 0 de su frame, + 2 px por lado: contiene esa caja y su lado no pasa de
// max(w, h) + 8.
const ART = join(import.meta.dirname, '..', '..', '..', 'public', 'assets', 'tiny-swords');

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function alphaBox(png: Png, frame: number, fw: number, fh: number): Box | null {
  const cols = png.width / fw;
  const ox = (frame % cols) * fw;
  const oy = Math.floor(frame / cols) * fh;
  let box: Box | null = null;
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      if (pixelAt(png, ox + x, oy + y)[3] === 0) continue;
      box = box
        ? {
            x0: Math.min(box.x0, x),
            y0: Math.min(box.y0, y),
            x1: Math.max(box.x1, x),
            y1: Math.max(box.y1, y),
          }
        : { x0: x, y0: y, x1: x, y1: y };
    }
  }
  return box;
}

const { corpse, pickups, hud } = appearanceJson;
const ICONS = [
  ['kills', corpse.sheet, hud.icons.kills.frame, hud.icons.kills.crop],
  ['gold', pickups.gold.sheet, pickups.gold.idle.frames[0] ?? 0, hud.icons.gold.crop],
  ['wood', pickups.wood.sheet, pickups.wood.idle.frames[0] ?? 0, hud.icons.wood.crop],
  ['stone', pickups.stone.rocks.medium.sheet, 0, hud.icons.stone.crop],
] as const;

describe('PNG de los iconos del HUD (sprite-rendering 0036)', () => {
  it('Scenario: Datos de los contadores del repositorio (calavera de Dead.png)', () => {
    const png = readPng(join(ART, corpse.sheet.file));
    expect([png.width, png.height]).toEqual([896, 256]);
    const frames = (png.width / corpse.sheet.frameWidth) * (png.height / corpse.sheet.frameHeight);
    expect(frames).toBe(14);
    const frame = hud.icons.kills.frame;
    expect(frame).toBeGreaterThanOrEqual(0);
    expect(frame).toBeLessThanOrEqual(13);
    expect(alphaBox(png, frame, 128, 128)).not.toBeNull();
  });

  it.each(ICONS)('Recorte de %s ajustado al dibujo del frame', (_key, sheet, frame, crop) => {
    const png = readPng(join(ART, sheet.file));
    const box = alphaBox(png, frame, sheet.frameWidth, sheet.frameHeight);
    if (box === null) throw new Error('frame vacío');
    expect(crop.width).toBe(crop.height);
    expect(crop.x).toBeLessThanOrEqual(box.x0);
    expect(crop.y).toBeLessThanOrEqual(box.y0);
    expect(crop.x + crop.width).toBeGreaterThan(box.x1);
    expect(crop.y + crop.height).toBeGreaterThan(box.y1);
    const side = Math.max(box.x1 - box.x0 + 1, box.y1 - box.y0 + 1);
    expect(crop.width).toBeLessThanOrEqual(side + 8);
    expect(crop.x + crop.width).toBeLessThanOrEqual(sheet.frameWidth);
    expect(crop.y + crop.height).toBeLessThanOrEqual(sheet.frameHeight);
  });
});
