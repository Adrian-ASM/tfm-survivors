import { describe, expect, it } from 'vitest';
import { withWeapons } from '../support/builders';
import { HOUSE_AT_20_10, aCampScenario, startDeclared } from '../support/camps';
import { ticks } from '../support/runs';
import { FakeTarget, aLinter, anArsenal, weaponsOf } from '../support/weapons';

const PX = 1260;
const PY = 1000;
/** Casa de prueba: centro (1.260, 690), radio de impacto 40 y vida 30. */
const aHouse = (hp = 30) => new FakeTarget(1260, 690, hp, 40);
const linterOnly = () => anArsenal(weaponsOf([aLinter()]));

/** Proyectil con id `id` en el arsenal, o `undefined`. */
const projectile = (a: ReturnType<typeof linterOnly>, id: number) =>
  a.projectiles.find((p) => p.id === id);

describe('Proyectiles contra estructuras (auto-weapons)', () => {
  it('Scenario: Impacto en una casa', () => {
    const arsenal = linterOnly();
    const house = aHouse();
    const T = 1;
    arsenal.step(T, PX, PY, [], [house]);
    for (let n = T + 1; n <= T + 33; n++) arsenal.step(n, PX, PY, [], [house]);
    expect(projectile(arsenal, 0)?.y).toBe(736);
    expect(house.hp).toBe(30);
    arsenal.step(T + 34, PX, PY, [], [house]);
    expect(projectile(arsenal, 0)).toBeUndefined();
    expect(house.hp).toBe(24);
    expect(house.hits).toEqual([T + 34]);
  });

  it('Scenario: Un proyectil dirigido a un enemigo atraviesa la casa', () => {
    const arsenal = linterOnly();
    const house = aHouse();
    const enemy = new FakeTarget(1260, 640, 10, 10);
    const T = 1;
    const houseHp: number[] = [];
    arsenal.step(T, PX, PY, [enemy], [house]);
    for (let n = T + 1; n <= T + 44; n++) {
      arsenal.step(n, PX, PY, [enemy], [house]);
      houseHp.push(house.hp);
    }
    expect(houseHp.every((hp) => hp === 30)).toBe(true);
    expect(enemy.hits).toEqual([T + 44]);
    expect(enemy.hp).toBe(4);
  });

  it('Scenario: Un proyectil dirigido a la casa da antes a un enemigo', () => {
    const arsenal = linterOnly();
    const house = aHouse();
    const enemy = new FakeTarget(1260, 800, 10, 10);
    const T = 1;
    arsenal.step(T, PX, PY, [], [house]);
    let kills = 0;
    for (let n = T + 1; n <= T + 34; n++) kills += arsenal.step(n, PX, PY, [enemy], [house]);
    expect(enemy.hits).toEqual([T + 24]);
    expect(enemy.hp).toBe(4);
    expect(projectile(arsenal, 0)).toBeUndefined();
    expect(house.hp).toBe(30);
    expect(kills).toBe(0);
  });

  it('las bajas devueltas son solo de enemigos: dejar una estructura a 0 no cuenta', () => {
    const arsenal = linterOnly();
    const house = aHouse(6);
    let kills = 0;
    for (let n = 1; n <= 35; n++) kills += arsenal.step(n, PX, PY, [], [house]);
    expect(house.hp).toBe(0);
    expect(kills).toBe(0);
  });

  it('Scenario: Daño que no destruye', () => {
    const config = withWeapons(aCampScenario(), weaponsOf([aLinter()]));
    const run = startDeclared(config, [HOUSE_AT_20_10], { player: { x: PX, y: PY } });
    const snaps = ticks(run, 35);
    expect(snaps[33]?.structures[0]?.health).toBe(30);
    expect(snaps[34]?.structures[0]).toMatchObject({ health: 24, destroyed: false });
    expect(snaps[34]?.projectiles.some((p) => p.id === 0)).toBe(false);
  });

  it('Scenario: Daño mayor que la vida (la vida no baja de 0)', () => {
    const config = withWeapons(aCampScenario({ tower: { health: 4 } }), weaponsOf([aLinter()]));
    const tower = { type: 'goblin-tower', col: 20, row: 10, cols: 2, rows: 3 };
    const run = startDeclared(config, [tower], { player: { x: PX, y: PY } });
    const snaps = ticks(run, 35);
    expect(snaps[34]?.structures[0]?.health).toBe(0);
  });
});
