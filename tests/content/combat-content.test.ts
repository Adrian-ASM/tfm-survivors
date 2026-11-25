import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import enemiesJson from '../../content/enemies.json';
import playerJson from '../../content/player.json';
import progressionJson from '../../content/progression.json';
import resourcesJson from '../../content/resources.json';
import sheepJson from '../../content/sheep.json';
import structuresJson from '../../content/structures.json';
import wavesJson from '../../content/waves.json';
import weaponsJson from '../../content/weapons.json';
import { BALANCE_CONTENT_SHA256, COMBAT_CONTENT_SHA256 } from '../support/balanceBaseline';
import upgradesJson from '../../content/upgrades.json';
import shopJson from '../../content/shop.json';

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

/**
 * Huellas de `main` antes de 0024 (tasks 0.1) de lo que la calibración no puede tocar (spec
 * run-outcome 0024): de resources.json, solo montones, vetas, colocación, carne y la madera del
 * barril; de player.json, todo salvo los campos nuevos (`regenIntervalTicks`).
 */
const INTACT_SHA256 = {
  resources: 'd988d575b1f2465931237a2bffd44f5c99eeaf6d07c04a511d3a76d32b1b04ce',
  sheep: 'e4c9383d413ce8f91237d4c9866c56d3a54414ac8a810170949d9bf3b8c87832',
} as const;

// Spec run-outcome (0024), "Presupuesto de oleadas y stats intactos": oleadas, armas, enemigos,
// estructuras (su oro vive en resources.json), XP, montones, vetas, ovejas y carne iguales a `main`.
// Las 9 mejoras previas las compara `upgrades-text.test.ts` ("Mejoras de arma y de personaje sin
// cambios"); `player.speed`, `tests/content/enemies.test.ts`.
describe('Contenido de combate intacto (0024)', () => {
  it('Scenario: Presupuesto de oleadas y stats intactos (huellas de M0 de lo que no se calibra)', () => {
    const { baseXp, xpGrowth, gemRadius, magnetSpeed, maxGems } = progressionJson;
    const { woodPiles, goldVeins, placement, meat, drops } = resourcesJson;
    const player: Record<string, unknown> = { ...playerJson };
    delete player.regenIntervalTicks;

    expect({
      waves: sha(wavesJson),
      enemies: sha(enemiesJson),
      weapons: sha(weaponsJson),
      player: sha(player),
      progression: sha({ baseXp, xpGrowth, gemRadius, magnetSpeed, maxGems }),
      structures: sha(structuresJson),
    }).toEqual({
      waves: COMBAT_CONTENT_SHA256.waves,
      enemies: COMBAT_CONTENT_SHA256.enemies,
      weapons: COMBAT_CONTENT_SHA256.weapons,
      player: COMBAT_CONTENT_SHA256.player,
      progression: COMBAT_CONTENT_SHA256.progression,
      structures: COMBAT_CONTENT_SHA256.structures,
    });
    expect(sha({ woodPiles, goldVeins, placement, meat, woodDrops: drops.enemies })).toBe(
      INTACT_SHA256.resources,
    );
    expect(sha(sheepJson)).toBe(INTACT_SHA256.sheep);
  });
});

// Spec castle-shop (0024), "Línea base nueva congelada": huella del contenido calibrado (M2).
describe('Huella del contenido calibrado (0024)', () => {
  const now = () => ({
    upgrades: sha(upgradesJson),
    player: sha(playerJson),
    resources: sha(resourcesJson),
    progression: sha(progressionJson),
    shop: sha(shopJson),
  });

  it('Scenario: Línea base nueva congelada (huella de mejoras con precios, jugador, recursos, progresión y tienda)', () => {
    expect(now()).toEqual(BALANCE_CONTENT_SHA256);
  });

  it('Scenario: Línea base nueva congelada (un precio de la tienda cambiado en 1 rompe la huella)', () => {
    const changed = structuredClone(upgradesJson);
    const [first] = changed.weapons;
    if (!first) throw new Error('sin mejoras de arma');
    first.prices = first.prices.map((p, i) => (i === 0 ? p + 1 : p));
    const heal = { ...shopJson, heal: { ...shopJson.heal, price: shopJson.heal.price + 1 } };

    expect(sha(changed)).not.toBe(BALANCE_CONTENT_SHA256.upgrades);
    expect(sha(heal)).not.toBe(BALANCE_CONTENT_SHA256.shop);
  });
});
