import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import enemiesJson from '../../content/enemies.json';
import playerJson from '../../content/player.json';
import progressionJson from '../../content/progression.json';
import resourcesJson from '../../content/resources.json';
import structuresJson from '../../content/structures.json';
import upgradesJson from '../../content/upgrades.json';
import wavesJson from '../../content/waves.json';
import weaponsJson from '../../content/weapons.json';
import { COMBAT_CONTENT_SHA256 } from '../support/balanceBaseline';

/** JSON canónico (claves ordenadas en todos los niveles), el mismo con el que se hizo la huella M0. */
const canon = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (v !== null && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canon(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
};
const sha = (v: unknown): string => createHash('sha256').update(canon(v)).digest('hex');

// Spec resources (0022), "Balance sin recalibrar con los recursos": los campos de combate del
// contenido son los de `main` antes del change (huella congelada en M0, tasks 0.1).
describe('Contenido de combate intacto (resources)', () => {
  // Spec sheep (0023), "Contenido de combate intacto": lo mismo sin los campos de ovejas y carne.
  it('Scenario: Contenido de combate intacto (huella de M0 campo a campo, sin ovejas ni carne)', () => {
    const { baseXp, xpGrowth, gemRadius, magnetSpeed, maxGems } = progressionJson;
    const resources: Partial<typeof resourcesJson> = { ...resourcesJson };
    delete resources.meat;
    const now = {
      waves: sha(wavesJson),
      enemies: sha(enemiesJson),
      weapons: sha(weaponsJson),
      upgrades: sha(upgradesJson),
      player: sha(playerJson),
      progression: sha({ baseXp, xpGrowth, gemRadius, magnetSpeed, maxGems }),
      structures: sha(structuresJson),
      resources: sha(resources),
    };
    expect(now).toEqual(COMBAT_CONTENT_SHA256);
  });
});
