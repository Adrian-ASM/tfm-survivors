import { describe, expect, it } from 'vitest';
import appearanceJson from '../../../content/appearance.json';
import { cropPose } from '../../../src/infrastructure/phaser/ui/hudIconPose';

// Design 0036 D5: el centro del recorte cae en el ancla del icono (origen relativo al frame) y la
// escala hace que el recorte mida el lado del icono en pantalla (spec hud, "Iconos de los
// contadores del HUD": lado s·k).
describe('cropPose (0036)', () => {
  it('Scenario: Iconos mayores a ×1 y a ×2 (recorte de la calavera a 24 y a 48 px)', () => {
    const { crop } = appearanceJson.hud.icons.kills;
    const frame = { width: 128, height: 128 };
    for (const k of [1, 2]) {
      const pose = cropPose(crop, frame, 24 * k);
      expect(pose.originX).toBeCloseTo((crop.x + crop.width / 2) / 128, 12);
      expect(pose.originY).toBeCloseTo((crop.y + crop.height / 2) / 128, 12);
      expect(crop.width * pose.scale).toBeCloseTo(24 * k, 9);
    }
  });

  it('un frame no cuadrado (64 × 128): el origen se mide sobre su ancho y su alto', () => {
    const pose = cropPose({ x: 16, y: 32, width: 32, height: 32 }, { width: 64, height: 128 }, 16);
    expect(pose).toEqual({ originX: 0.5, originY: 0.375, scale: 0.5 });
  });

  it('el recorte del frame entero centra el frame y lo escala al lado', () => {
    const pose = cropPose({ x: 0, y: 0, width: 64, height: 64 }, { width: 64, height: 64 }, 24);
    expect(pose).toEqual({ originX: 0.5, originY: 0.5, scale: 24 / 64 });
  });
});
