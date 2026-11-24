import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { withWeapons } from '../support/builders';
import { HOUSE_AT_20_10, aCampScenario, startDeclared } from '../support/camps';
import { FakeTarget, aLinter, anArsenal, weaponsOf } from '../support/weapons';

/** Casa de prueba: centro (1.260, 690), radio de impacto 40 y vida 30. */
const aHouse = (hp = 30) => new FakeTarget(1260, 690, hp, 40);
const linterOnly = () => anArsenal(weaponsOf([aLinter()]));

/** Dirección del único proyectil tras su primer avance (8 px por tick). */
function directionAfter(arsenal: ReturnType<typeof linterOnly>, x0: number, y0: number) {
  const p = arsenal.projectiles[0];
  if (!p) throw new Error('sin proyectil');
  return [Math.round((p.x - x0) / 8), Math.round((p.y - y0) / 8)];
}

describe('Arsenal · estructuras como objetivo de reserva (auto-weapons)', () => {
  it('Scenario: Estructura sin enemigos en alcance', () => {
    const arsenal = linterOnly();
    arsenal.step(1, 1260, 1000, [], [aHouse()]);
    expect(arsenal.projectiles).toHaveLength(1);
    arsenal.step(2, 1260, 1000, [], [aHouse()]);
    expect(directionAfter(arsenal, 1260, 1000)).toEqual([0, -1]);
  });

  it('Scenario: El enemigo gana aunque esté más lejos', () => {
    const arsenal = linterOnly();
    const enemy = new FakeTarget(1260, 1390, 1e6);
    arsenal.step(1, 1260, 1000, [enemy], [aHouse()]);
    arsenal.step(2, 1260, 1000, [enemy], [aHouse()]);
    expect(directionAfter(arsenal, 1260, 1000)).toEqual([0, 1]);
  });

  it('Scenario: Límite del alcance con una estructura', () => {
    const atLimit = linterOnly();
    atLimit.step(1, 1260, 1090, [], [aHouse()]);
    expect(atLimit.projectiles).toHaveLength(1);
    const beyond = linterOnly();
    beyond.step(1, 1260, 1091, [], [aHouse()]);
    expect(beyond.projectiles).toHaveLength(0);
    expect(beyond.weapons[0]?.isChargedAt(2)).toBe(true);
  });

  it('Scenario: Empate entre estructuras', () => {
    const arsenal = linterOnly();
    const s1 = new FakeTarget(1000, 700, 30, 40);
    const s2 = new FakeTarget(1000, 1300, 30, 40);
    arsenal.step(1, 1000, 1000, [], [s1, s2]);
    arsenal.step(2, 1000, 1000, [], [s1, s2]);
    expect(directionAfter(arsenal, 1000, 1000)).toEqual([0, -1]);
  });

  it('Scenario: Una ruina no es objetivo', () => {
    const arsenal = linterOnly();
    const ruin = aHouse(0);
    for (let n = 1; n <= 120; n++) arsenal.step(n, 1260, 1000, [], [ruin]);
    expect(arsenal.projectiles).toHaveLength(0);
    expect(arsenal.weapons[0]?.isChargedAt(121)).toBe(true);
  });

  it('Scenario: Carga de las armas en el snapshot (sin estructuras no destruidas en alcance)', () => {
    const arsenal = linterOnly();
    const enemy = new FakeTarget(1310, 1000, 4);
    const ruin = aHouse(0);
    const far = new FakeTarget(1260, 2000, 30, 40);
    const ready: boolean[] = [];
    for (let n = 1; n <= 100; n++) {
      arsenal.step(n, 1260, 1000, n === 1 ? [enemy] : [], [ruin, far]);
      ready.push(arsenal.weapons[0]?.isChargedAt(n) ?? false);
    }
    expect(ready).toEqual(Array.from({ length: 100 }, (_, i) => i + 1 >= 31));
  });

  it('en la partida, el Linter apunta a una casa declarada sin enemigos en alcance', () => {
    const config = withWeapons(aCampScenario(), weaponsOf([aLinter()]));
    const run = startDeclared(config, [HOUSE_AT_20_10], { player: { x: 1260, y: 1000 } });
    run.tick(PlayerInput.NONE);
    run.tick(PlayerInput.NONE);
    expect(run.snapshot().projectiles.map((p) => [p.x, p.y])).toEqual([[1260, 992]]);
  });
});
