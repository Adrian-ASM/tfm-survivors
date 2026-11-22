import { describe, expect, it } from 'vitest';
import { parseAppearance } from '../../src/infrastructure/content/loadAppearance';
import { nextSceneKey, sheetsToLoad } from '../../src/infrastructure/phaser/bootPlan';
import { GAME_SCENE_KEY, MENU_SCENE_KEY } from '../../src/infrastructure/phaser/sceneKeys';
import { REGISTERED, TORCH_FILE, rawAppearance } from '../support/appearance';

// Spec sprite-rendering "Carga del arte compatible con la CSP" (parte unitaria, design D3).
function appearance(edit: (raw: ReturnType<typeof rawAppearance>) => void = () => undefined) {
  const raw = rawAppearance();
  edit(raw);
  const r = parseAppearance(raw, REGISTERED);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe('BootScene · plan de carga', () => {
  it('una carga por hoja distinta, con la clave = file y el tamaño de frame del aspecto', () => {
    const sheets = sheetsToLoad(appearance());
    expect(sheets).toHaveLength(8);
    expect(new Set(sheets.map((s) => s.key)).size).toBe(8);
    expect(sheets.find((s) => s.key === TORCH_FILE)).toEqual({
      key: TORCH_FILE,
      file: TORCH_FILE,
      frameWidth: 192,
      frameHeight: 192,
    });
  });

  it('dos aspectos con la misma hoja la cargan una vez', () => {
    const a = appearance((raw) => {
      const tnt = raw.enemies['goblin-tnt'] ?? {};
      tnt.sheet = { file: TORCH_FILE, frameWidth: 192, frameHeight: 192 };
    });
    expect(sheetsToLoad(a).filter((s) => s.key === TORCH_FILE)).toHaveLength(1);
  });

  it('Scenario: Con e2e (arranca la partida sin pasar por el menú; sin e2e, el menú)', () => {
    expect([nextSceneKey(true), nextSceneKey(false)]).toEqual([GAME_SCENE_KEY, MENU_SCENE_KEY]);
  });
});
