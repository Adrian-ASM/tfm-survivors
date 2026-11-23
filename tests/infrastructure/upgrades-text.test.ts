import { describe, expect, it } from 'vitest';
import { loadRunConfig } from '../../src/infrastructure/content/loadRunConfig';

// Spec upgrades (0013), "Textos medievales de las mejoras": solo cambian `name` y `description`.
const loaded = loadRunConfig();
const upgrades = loaded.ok ? loaded.value.upgrades.upgrades : [];

/** Tabla de la spec: id → [name, description], carácter a carácter. */
const MEDIEVAL_TEXTS: Readonly<Record<string, readonly [string, string]>> = {
  'strict-rules': ['Puntas de acero', 'Las flechas del arco hacen más daño.'],
  'fast-ci': ['Tensado rápido', 'El arco dispara más a menudo.'],
  'wide-analysis': ['Ojo de halcón', 'El arco alcanza objetivos más lejanos.'],
  'hard-asserts': ['Filo templado', 'El tajo hace más daño.'],
  'watch-mode': ['Brazo incansable', 'El tajo se lanza más a menudo.'],
  coverage: ['Barrido amplio', 'El tajo llega más lejos a tu alrededor.'],
  guardrail: ['Cota de malla', 'Más vida máxima (y la misma cantidad de vida actual).'],
  shortcuts: ['Botas de viajero', 'Te mueves más rápido.'],
  'context-window': ['Amuleto del saqueador', 'Atraes las gemas desde más lejos.'],
};

/** Palabras del tema anterior que no pueden quedar en los textos visibles. */
const PREVIOUS_THEME_WORDS = [
  'Skill',
  'Linter',
  'Tests',
  'CI',
  'asserts',
  'watch',
  'cobertura',
  'Guardrail',
  'Atajos',
  'teclado',
  'contexto',
];

/** Copia congelada de content/upgrades.json en `main` antes del change, sin textos. */
const MAIN_UPGRADES_WITHOUT_TEXTS = [
  {
    id: 'strict-rules',
    target: { kind: 'weapon', weapon: 'linter' },
    stat: 'damage',
    perLevel: 3,
    maxLevel: 5,
  },
  {
    id: 'fast-ci',
    target: { kind: 'weapon', weapon: 'linter' },
    stat: 'cooldownTicks',
    perLevel: -4,
    maxLevel: 5,
  },
  {
    id: 'wide-analysis',
    target: { kind: 'weapon', weapon: 'linter' },
    stat: 'range',
    perLevel: 60,
    maxLevel: 5,
  },
  {
    id: 'hard-asserts',
    target: { kind: 'weapon', weapon: 'tests' },
    stat: 'damage',
    perLevel: 2,
    maxLevel: 5,
  },
  {
    id: 'watch-mode',
    target: { kind: 'weapon', weapon: 'tests' },
    stat: 'cooldownTicks',
    perLevel: -12,
    maxLevel: 5,
  },
  {
    id: 'coverage',
    target: { kind: 'weapon', weapon: 'tests' },
    stat: 'radius',
    perLevel: 15,
    maxLevel: 5,
  },
  { id: 'guardrail', target: { kind: 'player' }, stat: 'maxHealth', perLevel: 20, maxLevel: 5 },
  { id: 'shortcuts', target: { kind: 'player' }, stat: 'speed', perLevel: 20, maxLevel: 5 },
  {
    id: 'context-window',
    target: { kind: 'player' },
    stat: 'pickupRadius',
    perLevel: 32,
    maxLevel: 5,
  },
];

describe('Textos medievales de las mejoras (0013)', () => {
  it('Scenario: Textos del catálogo por defecto (9 pares id → name/description)', () => {
    const texts = Object.fromEntries(upgrades.map((u) => [u.id, [u.name, u.description]]));

    expect(texts).toEqual(MEDIEVAL_TEXTS);
  });

  it('Scenario: Sin textos del tema anterior (palabra completa, sin mayúsculas)', () => {
    const visible = upgrades.flatMap((u) => [u.name, u.description]);
    const found = PREVIOUS_THEME_WORDS.filter((word) =>
      visible.some((text) => new RegExp(`(^|[^\\p{L}])${word}([^\\p{L}]|$)`, 'iu').test(text)),
    );

    expect(visible).toHaveLength(18);
    expect(found).toEqual([]);
  });

  it('Scenario: Ids y números sin cambios (mismo orden, sin name ni description)', () => {
    const withoutTexts = upgrades.map(({ id, target, stat, perLevel, maxLevel }) => ({
      id,
      target,
      stat,
      perLevel,
      maxLevel,
    }));

    expect(withoutTexts).toEqual(MAIN_UPGRADES_WITHOUT_TEXTS);
  });
});
