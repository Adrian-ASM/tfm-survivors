import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import appearanceJson from '../../content/appearance.json';
import provenanceJson from '../../content/asset-provenance.json';
import shopJson from '../../content/shop.json';
import upgradesJson from '../../content/upgrades.json';
import { ICON_DIR } from '../../src/infrastructure/content/appearanceSchema';
import { decodePng } from '../support/png';
import { encodePng, iconProblems } from '../support/pngProbe';

// Spec sprite-rendering (0034), "Datos de los iconos de mejora", y asset-provenance, "Iconos de mejora
// versionados" (design D9): los iconos del repositorio y su forma medida en los PNG.
const root = join(import.meta.dirname, '..', '..');
const icons = appearanceJson.icons;
const generated = provenanceJson.generated.map((g) => g.path);
const usedFiles = [...Object.values(icons.byId), icons.fallback.character, icons.fallback.weapon];
const read = (file: string): Buffer => readFileSync(join(root, ICON_DIR, file));

/** Ids de `upgrades.json` antes del change, en orden (personaje y arma). */
const UPGRADE_IDS = [
  'guardrail',
  'shortcuts',
  'context-window',
  'regeneration',
  'armor',
  'steady-nerves',
  'scholar',
  'prospector',
  'hunter',
  'strict-rules',
  'fast-ci',
  'wide-analysis',
  'hard-asserts',
  'watch-mode',
  'coverage',
];

describe('iconos de mejora del repositorio (0034)', () => {
  it('Scenario: Iconos del repositorio (16 claves exactas, 2 reservas, todo en la lista IA)', () => {
    expect(Object.keys(icons.byId)).toEqual([...UPGRADE_IDS, 'heal']);
    expect(icons.fallback).toEqual({
      character: 'fallback-character.png',
      weapon: 'fallback-weapon.png',
    });
    for (const file of usedFiles) expect(generated, file).toContain(ICON_DIR + file);
    expect([...upgradesJson.character, ...upgradesJson.weapons].map((u) => u.id)).toEqual(
      UPGRADE_IDS,
    );
    expect(shopJson.heal.id).toBe('heal');
  });

  it('Scenario: Lista del repositorio (la lista IA son exactamente las imágenes de los iconos)', () => {
    expect([...generated].sort()).toEqual(usedFiles.map((f) => ICON_DIR + f).sort());
    const versioned = execFileSync('git', ['ls-files', ICON_DIR], { cwd: root, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
    expect(versioned.sort()).toEqual([...generated].sort());
  });

  it('Scenario: Iconos del repositorio medidos (16 + 2, 64 × 64 RGBA, esquinas transparentes)', () => {
    expect(new Set(Object.values(icons.byId)).size).toBe(16);
    expect(usedFiles).toHaveLength(18);
    for (const file of usedFiles) expect(iconProblems(file, read(file)), file).toEqual([]);
  });
});

describe('medida de un icono alterado (0034)', () => {
  const armor = decodePng(read('armor.png'));
  const NAME = 'armor.png';

  it('Scenario: Icono con otro tamaño o sin alfa (48 × 48)', () => {
    const small = encodePng(48, 48, new Uint8Array(48 * 48 * 4));
    expect(iconProblems(NAME, small).join('\n')).toContain(NAME);
  });

  it('Scenario: Icono con otro tamaño o sin alfa (PNG RGB sin alfa)', () => {
    const rgb = encodePng(64, 64, armor.rgba, false);
    expect(iconProblems(NAME, rgb).join('\n')).toMatch(/armor\.png: no es RGBA/);
  });

  it('Scenario: Icono con otro tamaño o sin alfa (esquina superior izquierda opaca)', () => {
    const pixels = Uint8Array.from(armor.rgba);
    pixels.set([255, 255, 255, 255], 0);
    const out = iconProblems(NAME, encodePng(64, 64, pixels));
    expect(out).toEqual(['armor.png: la esquina (0, 0) no es transparente.']);
  });

  it('una copia sin alterar del icono pasa (el codificador de prueba es fiel)', () => {
    expect(iconProblems(NAME, encodePng(64, 64, armor.rgba))).toEqual([]);
  });
});
