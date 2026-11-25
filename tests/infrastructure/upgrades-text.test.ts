import { describe, expect, it } from 'vitest';
import { loadRunConfig } from '../../src/infrastructure/content/loadRunConfig';

// Spec upgrades (0013), "Textos medievales de las mejoras": solo cambian `name` y `description`.
const loaded = loadRunConfig();
const upgrades = loaded.ok
  ? [...loaded.value.upgrades.character, ...loaded.value.upgrades.weapons]
  : [];
const weaponList = loaded.ok ? loaded.value.upgrades.weapons : [];
const previousCharacter = loaded.ok ? loaded.value.upgrades.character.slice(0, 3) : [];

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
  regeneration: ['Bálsamo de hierbas', 'Recuperas vida poco a poco.'],
  armor: ['Escudo de roble', 'Cada golpe te quita menos vida, pero siempre al menos 1.'],
  'steady-nerves': ['Temple de veterano', 'Tras un golpe, tardas más en volver a ser vulnerable.'],
  scholar: ['Tomo del erudito', 'Las gemas te dan más experiencia.'],
  prospector: ['Bolsa del mercader', 'Ganas más oro cada vez que lo recoges.'],
  hunter: ['Festín del cazador', 'La carne te cura más.'],
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
  it('Scenario: Textos del catálogo por defecto (15 pares id → name/description)', () => {
    const texts = Object.fromEntries(upgrades.map((u) => [u.id, [u.name, u.description]]));

    expect(texts).toEqual(MEDIEVAL_TEXTS);
  });

  it('Scenario: Sin textos del tema anterior (palabra completa, sin mayúsculas)', () => {
    const visible = upgrades.flatMap((u) => [u.name, u.description]);
    const found = PREVIOUS_THEME_WORDS.filter((word) =>
      visible.some((text) => new RegExp(`(^|[^\\p{L}])${word}([^\\p{L}]|$)`, 'iu').test(text)),
    );

    expect(visible).toHaveLength(30);
    expect(found).toEqual([]);
  });

  // 0024: sustituye a "Ids y números sin cambios" (las de arma cambian de catálogo y ganan precios).
  it('Scenario: Mejoras de arma y de personaje sin cambios (campo a campo, sin textos)', () => {
    const withoutTexts = [...weaponList, ...previousCharacter].map(
      ({ id, target, stat, perLevel, maxLevel }) => ({
        id,
        target,
        stat,
        perLevel,
        maxLevel,
      }),
    );

    expect(withoutTexts).toEqual(MAIN_UPGRADES_WITHOUT_TEXTS);
  });
});
