import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import guideJson from '../../../content/guide.json';
import type { RunConfig } from '../../../src/domain/run/RunConfig';
import {
  GUIDE_MARKERS,
  formatCount,
  formatSeconds,
  markersOf,
} from '../../../src/infrastructure/content/guideMarkers';
import {
  GUIDE_MARKER_UNRESOLVED,
  type Guide,
} from '../../../src/infrastructure/content/guideSchema';
import { parseGuide } from '../../../src/infrastructure/content/loadGuide';
import { parseContent } from '../../../src/infrastructure/content/loadRunConfig';
import { rawContent } from '../../support/builders';

const ROOT = join(import.meta.dirname, '..', '..', '..');

// Spec menu-guide, "Cifras de la guía tomadas del contenido" (change 0028, design §2).
const defaultConfig = (): RunConfig => {
  const r = parseContent(rawContent());
  if (!r.ok) throw new Error(r.error.message);
  return r.value.config;
};

const shown = (config: RunConfig): Guide => {
  const r = parseGuide(guideJson, config);
  if (!r.ok) throw new Error(`${r.error.field}: ${r.error.message}`);
  return r.value;
};

const texts = (g: Guide): string[] => g.pages.flatMap((p) => [p.title, ...p.paragraphs]);

// 0036: los textos de la obra (`build`) también son texto crudo de la guía.
const rawTexts = (): string[] => [
  ...guideJson.pages.flatMap((p) => [p.title, ...p.paragraphs]),
  guideJson.build.house,
  guideJson.build.tower,
];

/** Texto mostrado del primer párrafo crudo que usa `{key}`, para comprobar su sustitución. */
function shownWith(g: Guide, key: string): { raw: string; text: string } {
  for (const [i, p] of guideJson.pages.entries()) {
    const j = p.paragraphs.findIndex((t) => t.includes(`{${key}}`));
    const text = g.pages[i]?.paragraphs[j];
    if (j >= 0 && text !== undefined) return { raw: p.paragraphs[j] ?? '', text };
  }
  throw new Error(`ningún párrafo usa ${key}`);
}

/** El crudo con cada marcador sustituido por su valor esperado. */
const expected = (raw: string, values: Readonly<Record<string, string | undefined>>) =>
  raw.replace(/\{([^{}]*)\}/g, (_, k: string) => values[k] ?? `{${k}}`);

describe('formatos de las cifras', () => {
  it('formatCount: punto de miles fijo', () => {
    expect([0, 8, 999, 1000, 1800, 1234567].map(formatCount)).toEqual([
      '0',
      '8',
      '999',
      '1.000',
      '1.800',
      '1.234.567',
    ]);
  });

  it('formatSeconds: como mucho una decimal, con coma', () => {
    expect([1800, 2400, 1350, 90, 60_000].map(formatSeconds)).toEqual([
      '30',
      '40',
      '22,5',
      '1,5',
      '1.000',
    ]);
  });
});

describe('GUIDE_MARKERS con el contenido', () => {
  it('Scenario: Cifras con el contenido por defecto', () => {
    const config = defaultConfig();
    const values = Object.fromEntries(
      Object.entries(GUIDE_MARKERS).map(([k, f]) => [k, f(config)]),
    );
    expect(values).toEqual({
      'run.duration': '10:00',
      'upgrades.offerSize': '3',
      'upgrades.characterCount': '9',
      'upgrades.weaponCount': '6',
      'progression.levelUpHealPercent': '10',
      'resources.meat.healPercent': '20',
      'shop.heal.price': '8',
      'buildings.house.wood': '15',
      'buildings.house.incomeGold': '1',
      'buildings.house.incomeSeconds': '30',
      'buildings.tower.wood': '30',
      'buildings.tower.stone': '15',
      'structures.houseCount': '4',
      'structures.towerCount': '3',
    });
    const g = shown(config);
    for (const [i, p] of guideJson.pages.entries()) {
      const out = g.pages[i];
      expect(out?.title).toBe(expected(p.title, values));
      expect(out?.paragraphs).toEqual(p.paragraphs.map((t) => expected(t, values)));
    }
    expect(texts(g).some((t) => /[{}]/.test(t))).toBe(false);
  });

  it('Scenario: Las cifras siguen al contenido', () => {
    const base = defaultConfig();
    const config: RunConfig = {
      ...base,
      run: { durationSeconds: 900 },
      resources: { ...base.resources, meat: { ...base.resources.meat, healPercent: 35 } },
      buildings: {
        ...base.buildings,
        house: { cost: { wood: 1800, stone: 0 }, income: { gold: 4, everyTicks: 2400 } },
        tower: { ...base.buildings.tower, cost: { wood: 37, stone: 19 } },
      },
    };
    const g = shown(config);
    const cases: [string, string][] = [
      ['buildings.house.wood', '1.800'],
      ['buildings.house.incomeGold', '4'],
      ['buildings.house.incomeSeconds', '40'],
      ['buildings.tower.wood', '37'],
      ['buildings.tower.stone', '19'],
      ['resources.meat.healPercent', '35'],
      ['run.duration', '15:00'],
    ];
    for (const [key, value] of cases) {
      const { raw, text } = shownWith(g, key);
      expect(text).toContain(value);
      expect(text).toBe(
        raw.replace(/\{([^{}]*)\}/g, (_, k: string) => GUIDE_MARKERS[k]?.(config) ?? ''),
      );
    }
    expect(texts(g).some((t) => /[{}]/.test(t) || t.includes('10:00'))).toBe(false);
  });

  it('Scenario: Segundos con decimal (1.350 ticks dan 22,5)', () => {
    const base = defaultConfig();
    const config: RunConfig = {
      ...base,
      buildings: {
        ...base.buildings,
        house: { ...base.buildings.house, income: { gold: 1, everyTicks: 1350 } },
      },
    };
    const { text } = shownWith(shown(config), 'buildings.house.incomeSeconds');
    expect(text).toContain('cada 22,5 s');
  });

  it('Scenario: La explicación sigue al contenido', () => {
    const base = defaultConfig();
    const withIncome = (gold: number, everyTicks: number): RunConfig => ({
      ...base,
      buildings: {
        ...base.buildings,
        house: { ...base.buildings.house, income: { gold, everyTicks } },
      },
    });
    expect(shown(base).build).toEqual({
      house: '+1 oro cada 30 s',
      tower: 'Dispara flechas a los enemigos cercanos',
    });
    expect(shown(withIncome(4, 2400)).build.house).toBe('+4 oro cada 40 s');
    expect(shown(withIncome(1, 1350)).build.house).toBe('+1 oro cada 22,5 s');
  });

  it('Scenario: Marcador sin valor en el contenido (sin goblin-tower)', () => {
    const base = defaultConfig();
    const types = Object.fromEntries(
      Object.entries(base.structures.types).filter(([id]) => id !== 'goblin-tower'),
    );
    const config: RunConfig = { ...base, structures: { ...base.structures, types } };
    const r = parseGuide(guideJson, config);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.message).toContain(`${GUIDE_MARKER_UNRESOLVED}: structures.towerCount`);
    expect(r.error.field).toMatch(/^guide\.pages\.\d+\.paragraphs\.\d+$/);
  });

  it('Sustituir marcadores no cambia el contenido cargado', () => {
    const config = defaultConfig();
    const before = structuredClone(config);
    shown(config);
    expect(config).toEqual(before);
  });
});

describe('content/guide.json', () => {
  it('Scenario: Sin cifras escritas a mano', () => {
    expect(rawTexts().filter((t) => /[0-9]/.test(t))).toEqual([]);
  });

  it('Scenario: Catálogo usado entero', () => {
    const used = new Set(rawTexts().flatMap(markersOf));
    expect([...used].sort()).toEqual(Object.keys(GUIDE_MARKERS).sort());
  });

  it('iconos: la página 3 con los cinco, la 5 con madera y piedra y la 1 sin iconos', () => {
    const icons = guideJson.pages.map((p) => ('icons' in p ? p.icons : []));
    expect(icons[2]).toEqual(['xp', 'gold', 'wood', 'meat', 'stone']);
    expect(icons[4]).toEqual(expect.arrayContaining(['wood', 'stone']));
    expect(icons[0]).toEqual([]);
  });
});

describe('Textos de la obra y de la tienda (0036)', () => {
  it('Scenario: Sin textos de la obra en el código', () => {
    const files = readdirSync(join(ROOT, 'src'), { recursive: true, encoding: 'utf8' }).filter(
      (f) => /\.(ts|js|css|html)$/.test(f),
    );
    expect(files.length).toBeGreaterThan(0);
    const offending = files.filter((f) => {
      const text = readFileSync(join(ROOT, 'src', f), 'utf8');
      return text.includes('oro cada') || text.includes('Dispara flechas');
    });
    expect(offending).toEqual([]);
  });

  it('Scenario: Página de la tienda con la ×', () => {
    const g = shown(defaultConfig());
    const castle = g.pages[3];
    expect(castle?.id).toBe('castle');
    expect(castle?.paragraphs.at(-1)).toBe(
      'Con oro mejoras tus armas (6 mejoras en total) o compras una cura por 8 de oro. Sal de la ' +
        'tienda con la × de su esquina o con Esc.',
    );
    expect(texts(g).filter((t) => t.includes('Salir'))).toEqual([]);
  });
});
