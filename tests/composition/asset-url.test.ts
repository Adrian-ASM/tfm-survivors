import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assetUrl, iconUrl } from '../../src/composition/assetUrl';
import { iconImagesOf } from '../../src/infrastructure/phaser/bootPlan';
import { repoAppearance } from '../support/mapArt';

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

// Spec sprite-rendering (0034), "Carga y escalado de los iconos" (design D5): URL de un icono =
// BASE_URL + 'assets/icons/' + file.
describe('iconUrl (0034)', () => {
  const BASE = '/tfm-survivors/';
  const root = join(import.meta.dirname, '..', '..');
  const check = (u: string) => {
    expect(u.startsWith('/tfm-survivors/assets/')).toBe(true);
    expect(u).not.toMatch(/^(https?:|\/\/|data:|blob:)/);
  };

  it('Scenario: URLs de los iconos bajo la base (forma, con ficheros de prueba)', () => {
    const files = ['armor.png', 'fallback-character.png', 'heal.png'];
    for (const f of files) {
      const u = iconUrl(BASE, f);
      expect(u).toBe(`/tfm-survivors/assets/icons/${f}`);
      check(u);
    }
  });

  // Con la sección `icons` del repositorio (tarea 6.1 en adelante): cada icono y reserva existe en
  // `public/`, que Vite copia entero a `dist/`. Mientras no haya sección, no hay ficheros que pedir.
  it('Scenario: URLs de los iconos bajo la base (cada fichero del repositorio existe)', () => {
    for (const { file } of iconImagesOf(repoAppearance())) {
      const u = iconUrl(BASE, file);
      check(u);
      expect(existsSync(join(root, 'public', decodeURIComponent(u.slice(BASE.length)))), u).toBe(
        true,
      );
    }
  });
});
