import { describe, expect, it } from 'vitest';
import { STONE_PER_DROP, StoneDrops } from '../../../src/domain/resource/StoneDrops';
import { CountingRandom, ScriptedRandom, StubRandom } from '../../support/random';

// Spec resources (0025), "Piedra por enemigo abatido": toda baja consume exactamente 1 valor del
// azar de la piedra y suelta si está abatida y ⌊u × 100⌋ < p (design §3).

const chances =
  (table: Record<string, number>) =>
  (typeId: string): number =>
    table[typeId] ?? 0;

const rules = (table: Record<string, number>) => ({ stoneChanceFor: chances(table) });

describe('StoneDrops (spec resources, "Piedra por enemigo abatido")', () => {
  it('la piedra soltada vale siempre 1 (no es contenido)', () => {
    expect(STONE_PER_DROP).toBe(1);
  });

  it('sin azar de la piedra nunca suelta y no consume nada', () => {
    const drops = new StoneDrops(rules({ 'goblin-torch': 100 }), null);

    expect(drops.roll('goblin-torch', false)).toBe(false);
  });

  it.each([
    [25, false],
    [26, true],
  ])('Scenario: Umbral de la tirada (u = 0,25, p = %i)', (p, drops) => {
    const random = new StubRandom(0.25);
    const stones = new StoneDrops(rules({ 'goblin-torch': p }), random);

    expect(stones.roll('goblin-torch', false)).toBe(drops);
    expect(random.calls).toBe(1);
  });

  it.each([
    [0.99999, 100, true],
    [0, 1, true],
    [0.0199, 1, false],
  ])('Scenario: Valor límite de la tirada (u = %f, p = %i)', (u, p, drops) => {
    const stones = new StoneDrops(rules({ 'goblin-torch': p }), new StubRandom(u));

    expect(stones.roll('goblin-torch', false)).toBe(drops);
  });

  it('Scenario: Tipo con 0 consume y no suelta (20 tiradas de goblin-tnt)', () => {
    const random = new CountingRandom(new StubRandom(0));
    const stones = new StoneDrops(rules({ 'goblin-tnt': 0 }), random);

    const results = Array.from({ length: 20 }, () => stones.roll('goblin-tnt', false));

    expect(results.some(Boolean)).toBe(false);
    expect(random.calls).toBe(20);
  });

  it('Scenario: El barril que explota consume y no suelta (p = 100)', () => {
    const random = new StubRandom(0);
    const stones = new StoneDrops(rules({ 'goblin-barrel': 100 }), random);

    expect(stones.roll('goblin-barrel', true)).toBe(false);
    expect(random.calls).toBe(1);
  });

  it('un tipo sin entrada en la tabla consume y no suelta', () => {
    const random = new StubRandom(0);
    const stones = new StoneDrops(rules({}), random);

    expect(stones.roll('goblin-torch', false)).toBe(false);
    expect(random.calls).toBe(1);
  });

  it.each([
    [0, [false, true, true]],
    [60, [true, true, true]],
  ])(
    'Scenario: La probabilidad de un tipo no desplaza las tiradas de los demás (tnt %i)',
    (tnt, expected) => {
      const stones = new StoneDrops(
        rules({ 'goblin-tnt': tnt, 'goblin-torch': 10 }),
        new ScriptedRandom([0.5, 0.05, 0.05]),
      );

      const order = ['goblin-tnt', 'goblin-torch', 'goblin-torch'];

      expect(order.map((id) => stones.roll(id, false))).toEqual(expected);
    },
  );
});
