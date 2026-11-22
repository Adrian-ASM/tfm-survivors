import { describe, expect, it } from 'vitest';
import { assetUrl } from '../../src/composition/assetUrl';

// Change 0012, design D2: URL de una hoja = BASE_URL + 'assets/tiny-swords/' + file.
describe('assetUrl', () => {
  it('bajo la base de Pages', () => {
    expect(assetUrl('/tfm-survivors/', 'Terrain/Ground/Tilemap_Flat.png')).toBe(
      '/tfm-survivors/assets/tiny-swords/Terrain/Ground/Tilemap_Flat.png',
    );
  });

  it('en la raíz y con espacios codificados por segmento', () => {
    expect(assetUrl('/', 'a b/c.png')).toBe('/assets/tiny-swords/a%20b/c.png');
  });
});
