import { describe, expect, it } from 'vitest';
import { loadRunConfig } from '../../src/infrastructure/content/loadRunConfig';
import {
  DEFAULT_ENEMY_TYPES,
  DEFAULT_PROGRESSION,
  DEFAULT_UPGRADE_LIST,
  DEFAULT_UPGRADES,
  DEFAULT_WAVES,
  CONTENT_STRUCTURES,
  aDefaultConfig,
} from '../support/builders';
import { DEFAULT_STRUCTURES, TNT_GUARD } from '../support/camps';

// Change 0019 (tarea 3.3): los valores por defecto de los tests son los de content/, una sola
// fuente para la calibración del balance. Si alguien vuelve a copiar números a mano, esto falla.
describe('Builders de contenido por defecto = content/*.json validado', () => {
  const loaded = loadRunConfig();
  if (!loaded.ok) throw new Error(loaded.error.message);
  const content = loaded.value;

  it('tipos de enemigo, progresión, mejoras y oleadas iguales a los cargados por loadRunConfig', () => {
    expect(DEFAULT_ENEMY_TYPES).toEqual(content.enemies.types);
    expect(DEFAULT_PROGRESSION).toEqual(content.progression);
    expect(DEFAULT_UPGRADES).toEqual(content.upgrades);
    expect(DEFAULT_WAVES).toEqual(content.waves);
  });

  // 0021: las estructuras del contenido por defecto y las de los escenarios con campamentos.
  it('estructuras y guardia de los builders iguales a los cargados por loadRunConfig', () => {
    expect(CONTENT_STRUCTURES).toEqual(content.structures);
    expect(aDefaultConfig().structures).toEqual(content.structures);
    expect(DEFAULT_STRUCTURES).toEqual(content.structures);
    expect(content.enemies.types.find((t) => t.id === TNT_GUARD.id)).toEqual(TNT_GUARD);
  });

  it('las constantes no comparten referencia con el JSON importado (no se puede mutar el contenido)', () => {
    expect(DEFAULT_ENEMY_TYPES).not.toBe(content.enemies.types);
    expect(Object.isFrozen(DEFAULT_ENEMY_TYPES)).toBe(true);
    expect(Object.isFrozen(DEFAULT_UPGRADE_LIST)).toBe(true);
  });
});
