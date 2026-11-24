import { describe, expect, it } from 'vitest';
import { LINTER, TESTS, withWeapons } from '../support/builders';
import { ticks } from '../support/runs';
import { SHEEP_AT, aSheepConfig, firstAt, startWithSheep } from '../support/sheep';
import { weaponsOf } from '../support/weapons';

const linter = () => withWeapons(aSheepConfig(), weaponsOf([LINTER]));
const tests = () => withWeapons(aSheepConfig(), weaponsOf([TESTS]));

// Spec auto-weapons y simulation-loop (0023) en la partida: las ovejas como tercer nivel.
describe('Armas y ovejas en la partida', () => {
  it('Scenario: Oveja sin enemigos ni estructuras en alcance (la partida dispara a la oveja)', () => {
    const run = startWithSheep(linter(), [SHEEP_AT], { player: { x: 1300, y: 1000 } });
    const [s1, s2] = ticks(run, 2);
    expect(s1?.projectiles.map((p) => [p.x, p.y])).toEqual([[1300, 1000]]);
    expect(s2?.projectiles.map((p) => [p.x, p.y])).toEqual([[1292, 1000]]);
  });

  it('Scenario: Impacto en una oveja (la oveja en pasto pierde 6 en T + 35)', () => {
    const run = startWithSheep(linter(), [SHEEP_AT], { player: { x: 1300, y: 1000 } });
    const snaps = ticks(run, 36);
    expect(snaps[34]?.sheep[0]?.health).toBe(12);
    expect(snaps[35]?.sheep[0]).toMatchObject({ health: 6, damaged: true, state: 'graze' });
    expect(firstAt(snaps[35])).toEqual([1000, 1000]);
  });

  it('Scenario: Las armas apuntan tras la huida de las ovejas (a 111 px: Tests no dispara)', () => {
    const run = startWithSheep(tests(), [SHEEP_AT], { player: { x: 1108, y: 1000 } });
    const [s] = ticks(run, 1);
    expect(firstAt(s)).toEqual([997, 1000]);
    expect(s?.pulses).toEqual([]);
    expect(s?.weapons.map((w) => w.ready)).toEqual([true]);
    expect(s?.sheep[0]?.health).toBe(12);
  });

  it('Scenario: Carga de las armas en el snapshot (ninguna oveja en alcance: Linter 31–100)', () => {
    const setup = {
      player: { x: 2600, y: 1000 },
      enemies: [{ type: 'goblin-torch', x: 2650, y: 1000, health: 1 }],
    };
    const run = startWithSheep(linter(), [SHEEP_AT], setup);
    const ready = ticks(run, 100).map((s) => s.weapons[0]?.ready);
    expect(ready).toEqual(Array.from({ length: 100 }, (_, i) => i + 1 >= 31));
  });
});
