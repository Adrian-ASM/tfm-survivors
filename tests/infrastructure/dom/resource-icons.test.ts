import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import appearanceJson from '../../../content/appearance.json';
import provenanceJson from '../../../content/asset-provenance.json';
import { assetUrl } from '../../../src/composition/assetUrl';
import { ASSET_DIR } from '../../../src/infrastructure/content/appearanceSchema';
import { parseAppearance } from '../../../src/infrastructure/content/loadAppearance';
import { gemShapeUrl, resourceIcons } from '../../../src/infrastructure/dom/resourceIcons';
import { MENU_LABELS, buildMissing } from '../../../src/infrastructure/dom/menuText';

// Design 0027 §3 y 0028 §6: iconos de recurso con las hojas del contador del HUD (G_Idle, W_Idle,
// M_Idle y la roca `medium`, Deco/05) y la URL de `BootScene` (mismo origen); la gema como forma de
// su color en un SVG `data:`; textos `madera`, `piedra` y «faltan N».
const REGISTERED = provenanceJson.files.map((f) => f.path);

const parsed = (raw: unknown) => {
  const r = parseAppearance(raw, REGISTERED);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};
const appearance = parsed(appearanceJson);

/** SVG decodificado de una URL `data:image/svg+xml,…`. */
const svgOf = (url: string): string => {
  const prefix = 'data:image/svg+xml,';
  expect(url.startsWith(prefix)).toBe(true);
  return decodeURIComponent(url.slice(prefix.length));
};

const root = join(import.meta.dirname, '..', '..', '..');
/** Ancho y alto de un PNG leídos de su cabecera IHDR (bytes 16..23, big-endian). */
function pngSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(join(root, ASSET_DIR, file));
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe('resourceIcons (panel de obra 0027 y guía 0028)', () => {
  it('Scenario: Iconos de las páginas de recursos y de obra (hojas del HUD)', () => {
    const icons = resourceIcons(appearance, (file) => assetUrl('/tfm-survivors/', file));
    const base = '/tfm-survivors/assets/tiny-swords/';
    expect({ ...icons, xp: undefined }).toEqual({
      xp: undefined,
      gold: `${base}Resources/Resources/G_Idle.png`,
      wood: `${base}Resources/Resources/W_Idle.png`,
      meat: `${base}Resources/Resources/M_Idle.png`,
      stone: `${base}Deco/05.png`,
    });
    // La gema del contenido por defecto se pinta como forma: rombo de su color.
    expect(svgOf(icons.xp)).toContain(`fill="${appearanceJson.pickups.xp.placeholderColor}"`);
  });

  it('Scenario: Iconos de la guía y de la obra (hojas idle, ninguna *_Spawn; gema con su color)', () => {
    const icons = resourceIcons(appearance, (file) => file);

    expect([icons.gold, icons.wood, icons.meat, icons.stone]).toEqual([
      'Resources/Resources/G_Idle.png',
      'Resources/Resources/W_Idle.png',
      'Resources/Resources/M_Idle.png',
      'Deco/05.png',
    ]);
    const urls: string[] = [icons.xp, icons.gold, icons.wood, icons.meat, icons.stone];
    expect(urls.some((url) => url.includes('_Spawn'))).toBe(false);
    expect(svgOf(icons.xp)).toContain(`fill="${appearanceJson.pickups.xp.placeholderColor}"`);
  });

  it('son las hojas de los recogibles del contenido (las del HUD)', () => {
    const icons = resourceIcons(appearance, (file) => file);
    const { gold, wood, meat, stone } = appearance.pickups;
    expect([icons.gold, icons.wood, icons.meat, icons.stone]).toEqual([
      gold.sheet.file,
      wood.sheet.file,
      meat.sheet.file,
      stone.rocks.medium.sheet.file,
    ]);
  });

  it('Scenario: Color de la gema desde el contenido (#12AB34)', () => {
    const raw = structuredClone(appearanceJson);
    raw.pickups.xp.placeholderColor = '#12AB34';
    const icons = resourceIcons(parsed(raw), (file) => file);
    expect(svgOf(icons.xp).toLowerCase()).toContain('fill="#12ab34"');
  });

  it('la forma de la gema es un SVG sin estilos ni scripts en línea', () => {
    const svg = svgOf(gemShapeUrl(0x0000ff));
    expect(svg).toContain('fill="#0000ff"');
    expect(svg).not.toMatch(/style|script|on\w+=/i);
  });

  it('con hoja propia, la gema usa su hoja', () => {
    const withSheet = {
      pickups: { ...appearance.pickups, xp: appearance.pickups.gold },
    } as typeof appearance;
    expect(resourceIcons(withSheet, (f) => f).xp).toBe(appearance.pickups.gold.sheet.file);
  });

  it('hojas de una fila (IHDR): alto = frameHeight, condición del recorte por CSS', () => {
    const { gold, wood, meat, stone } = appearance.pickups;
    for (const { sheet } of [gold, wood, meat, stone.rocks.medium]) {
      expect(pngSize(sheet.file).height).toBe(sheet.frameHeight);
    }
  });

  it('Scenario: Sin assets nuevos (cada hoja de icono figura en la nota de procedencia)', () => {
    const icons = resourceIcons(appearance, (file) => ASSET_DIR + file);
    const files = [icons.gold, icons.wood, icons.meat, icons.stone];
    expect(files.filter((f) => !REGISTERED.includes(f))).toEqual([]);
  });

  it('textos del panel: alternativas en minúscula y «faltan N»', () => {
    expect([MENU_LABELS.buildWood, MENU_LABELS.buildStone]).toEqual(['madera', 'piedra']);
    expect(buildMissing(5)).toBe('faltan 5');
  });
});
