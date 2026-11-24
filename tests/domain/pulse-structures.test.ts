import { describe, expect, it } from 'vitest';
import { FakeTarget, aPulse, anArsenal, weaponsOf } from '../support/weapons';

/** Casa de prueba: centro (1.260, 690), radio de impacto 40 y vida 30. */
const aHouse = (hp = 30) => new FakeTarget(1260, 690, hp, 40);
const testsOnly = () => anArsenal(weaponsOf([aPulse()]));

describe('Pulso sobre estructuras (auto-weapons)', () => {
  it('Scenario: Pulso sobre una casa', () => {
    const inside = testsOnly();
    const house = aHouse();
    inside.step(1, 1260, 819, [], [house]);
    expect(inside.pulses).toHaveLength(1);
    expect(house.hp).toBe(26);
    const outside = testsOnly();
    const far = aHouse();
    outside.step(1, 1260, 820, [], [far]);
    expect(outside.pulses).toHaveLength(0);
    expect(far.hp).toBe(30);
    expect(outside.weapons[0]?.isChargedAt(2)).toBe(true);
  });

  it('Scenario: Pulso sobre un enemigo y una casa', () => {
    const arsenal = testsOnly();
    const house = aHouse();
    const torch = new FakeTarget(1310, 800, 10, 10);
    arsenal.step(1, 1260, 800, [torch], [house]);
    expect([torch.hp, house.hp]).toEqual([6, 26]);
  });

  it('Scenario: Pulso sobre una ruina', () => {
    const arsenal = testsOnly();
    const ruin = aHouse(0);
    for (let n = 1; n <= 300; n++) arsenal.step(n, 1260, 690, [], [ruin]);
    expect(arsenal.pulses).toHaveLength(0);
    expect(ruin.hp).toBe(0);
    expect(arsenal.weapons[0]?.isChargedAt(301)).toBe(true);
  });

  it('Scenario: Sin enemigos en el radio, sin pulso (y sin estructuras)', () => {
    const arsenal = testsOnly();
    const torch = new FakeTarget(1360, 1000, 10, 10);
    let pulses = 0;
    for (let n = 1; n <= 300; n++) {
      arsenal.step(n, 1260, 1000, [torch], []);
      pulses += arsenal.pulses.length;
    }
    expect(pulses).toBe(0);
    expect(arsenal.weapons[0]?.isChargedAt(301)).toBe(true);
  });

  it('el pulso no cuenta como baja la estructura que deja a 0', () => {
    const arsenal = testsOnly();
    expect(arsenal.step(1, 1260, 690, [], [aHouse(4)])).toBe(0);
  });
});
