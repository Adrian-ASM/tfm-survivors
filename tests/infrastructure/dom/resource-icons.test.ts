import { describe, expect, it } from 'vitest';
import appearanceJson from '../../../content/appearance.json';
import provenanceJson from '../../../content/asset-provenance.json';
import { assetUrl } from '../../../src/composition/assetUrl';
import { parseAppearance } from '../../../src/infrastructure/content/loadAppearance';
import { resourceIcons } from '../../../src/infrastructure/dom/resourceIcons';
import { MENU_LABELS, buildMissing } from '../../../src/infrastructure/dom/menuText';

// Design 0027 §3: iconos del panel de obra con las hojas del contador del HUD (W_Idle y la roca
// `medium`, Deco/05) y la URL de `BootScene` (mismo origen); textos `madera`, `piedra` y «faltan N».
const appearance = (() => {
  const r = parseAppearance(
    appearanceJson,
    provenanceJson.files.map((f) => f.path),
  );
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
})();

describe('resourceIcons (panel de obra, 0027)', () => {
  it('las URL de W_Idle y de la roca medium con la base y la carpeta del arte', () => {
    const icons = resourceIcons(appearance, (file) => assetUrl('/tfm-survivors/', file));
    expect(icons).toEqual({
      wood: '/tfm-survivors/assets/tiny-swords/Resources/Resources/W_Idle.png',
      stone: '/tfm-survivors/assets/tiny-swords/Deco/05.png',
    });
  });

  it('son las hojas de los recogibles del contenido (las del HUD)', () => {
    const icons = resourceIcons(appearance, (file) => file);
    expect(icons.wood).toBe(appearance.pickups.wood.sheet.file);
    expect(icons.stone).toBe(appearance.pickups.stone.rocks.medium.sheet.file);
  });

  it('textos del panel: alternativas en minúscula y «faltan N»', () => {
    expect([MENU_LABELS.buildWood, MENU_LABELS.buildStone]).toEqual(['madera', 'piedra']);
    expect(buildMissing(5)).toBe('faltan 5');
  });
});
