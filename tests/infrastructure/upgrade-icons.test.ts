import { describe, expect, it } from 'vitest';
import upgradesJson from '../../content/upgrades.json';
import shopJson from '../../content/shop.json';
import {
  IconBook,
  iconCatalog,
  iconKey,
  resolveIcon,
  type IconIds,
} from '../../src/infrastructure/icons/upgradeIcons';

// Spec sprite-rendering (0034), "Resolución del icono" (design D3). Datos de iconos con la forma de
// los del repositorio (16 ids y 2 reservas); la sección real llega en la tarea 6.1.
const IDS: IconIds = {
  character: upgradesJson.character.map((u) => u.id),
  weapon: [...upgradesJson.weapons.map((u) => u.id), shopJson.heal.id],
};
const ICONS = {
  fallback: { character: 'fallback-character.png', weapon: 'fallback-weapon.png' },
  byId: Object.fromEntries([...IDS.character, ...IDS.weapon].map((id) => [id, `${id}.png`])),
};
const catalog = iconCatalog(ICONS, IDS);
const ALL = [...Object.values(ICONS.byId), ICONS.fallback.character, ICONS.fallback.weapon].map(
  iconKey,
);
const without = (...files: string[]): Set<string> => {
  const drop = new Set(files.map(iconKey));
  return new Set(ALL.filter((k) => !drop.has(k)));
};

describe('resolución del icono (spec sprite-rendering 0034)', () => {
  it.each([
    ['armor con todo cargado', 'armor', without(), 'painted', 'armor.png'],
    ['armor sin su imagen', 'armor', without('armor.png'), 'fallback', 'fallback-character.png'],
    [
      'armor sin su imagen ni la reserva de personaje',
      'armor',
      without('armor.png', 'fallback-character.png'),
      'none',
      null,
    ],
    [
      'coverage sin su imagen',
      'coverage',
      without('coverage.png'),
      'fallback',
      'fallback-weapon.png',
    ],
    [
      'heal sin su imagen (reserva de arma)',
      'heal',
      without('heal.png'),
      'fallback',
      'fallback-weapon.png',
    ],
  ] as const)('Scenario: Tabla de resolución (%s)', (_label, id, loaded, state, file) => {
    const choice = resolveIcon(catalog, id, loaded);
    expect(choice.state).toBe(state);
    expect(choice.file).toBe(file);
    expect(choice.key).toBe(file === null ? null : iconKey(file));
  });

  it('Scenario: Reserva de otra categoría sin efecto', () => {
    const loaded = without('armor.png', 'fallback-weapon.png');
    expect(resolveIcon(catalog, 'armor', loaded)).toEqual({
      state: 'fallback',
      key: iconKey('fallback-character.png'),
      file: 'fallback-character.png',
    });
  });

  it('una mejora sin entrada usa la reserva de su categoría', () => {
    const partial = iconCatalog({ ...ICONS, byId: {} }, IDS);
    expect(resolveIcon(partial, 'armor', new Set(ALL)).state).toBe('fallback');
    expect(resolveIcon(partial, 'coverage', new Set(ALL)).file).toBe('fallback-weapon.png');
    expect(resolveIcon(partial, 'heal', new Set(ALL)).file).toBe('fallback-weapon.png');
  });

  it('sin sección de iconos (transitorio, design D9) todo es none', () => {
    const empty = iconCatalog(undefined, IDS);
    for (const id of [...IDS.character, ...IDS.weapon]) {
      expect(resolveIcon(empty, id, new Set(ALL)).state).toBe('none');
    }
  });

  it('un id fuera del catálogo se trata como personaje sin fichero', () => {
    expect(resolveIcon(catalog, 'dragon-slayer', new Set(ALL)).file).toBe('fallback-character.png');
  });

  it('la clave de textura lleva el prefijo icon:', () => {
    expect(iconKey('armor.png')).toBe('icon:armor.png');
  });

  it('IconBook: todo none antes de la carga y resuelve con lo cargado después', () => {
    const book = new IconBook(catalog);
    expect(book.resolve('armor').state).toBe('none');
    book.setLoaded([iconKey('fallback-character.png')]);
    expect(book.resolve('armor').state).toBe('fallback');
    book.setLoaded(ALL);
    expect(book.resolve('armor').state).toBe('painted');
  });
});
