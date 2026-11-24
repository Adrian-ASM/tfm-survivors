import { describe, expect, it } from 'vitest';
import { FakeTarget, aLinter, aPulse, anArsenal, weaponsOf } from '../support/weapons';

// Spec auto-weapons (0023): las ovejas vivas son el tercer nivel de objetivo (enemigos →
// estructuras no destruidas → ovejas). Dobles: la casa de prueba (centro (1.260, 690), radio 40,
// vida 30) y la oveja de prueba (radio 20, vida 12), quietas (los escenarios las colocan).
const aHouse = (hp = 30) => new FakeTarget(1260, 690, hp, 40);
const aSheep = (x: number, y: number, hp = 12) => new FakeTarget(x, y, hp, 20);
const linterOnly = () => anArsenal(weaponsOf([aLinter()]));
const testsOnly = () => anArsenal(weaponsOf([aPulse()]));

/** Dirección del proyectil `id` tras su primer avance (8 px/tick), redondeada. */
function direction(arsenal: ReturnType<typeof linterOnly>, x0: number, y0: number, id = 0) {
  const p = arsenal.projectiles.find((q) => q.id === id);
  return [Math.round(((p?.x ?? 0) - x0) / 8), Math.round(((p?.y ?? 0) - y0) / 8)];
}

describe('Objetivo de reserva: ovejas (spec auto-weapons)', () => {
  it('Scenario: Oveja sin enemigos ni estructuras en alcance (proyectil con dirección (−1, 0))', () => {
    const arsenal = linterOnly();
    const sheep = aSheep(1000, 1000);
    arsenal.step(1, 1300, 1000, [], [], [sheep]);
    expect(arsenal.projectiles).toHaveLength(1);
    arsenal.step(2, 1300, 1000, [], [], [sheep]);
    expect(direction(arsenal, 1300, 1000)).toEqual([-1, 0]);
  });

  it('Scenario: La estructura gana a la oveja aunque esté más lejos (casa a 310, oveja a 200)', () => {
    const sheep = aSheep(1260, 1200);
    const withHouse = linterOnly();
    withHouse.step(1, 1260, 1000, [], [aHouse()], [sheep]);
    withHouse.step(2, 1260, 1000, [], [aHouse()], [sheep]);
    expect(direction(withHouse, 1260, 1000)).toEqual([0, -1]);
    const ruinOnly = linterOnly();
    ruinOnly.step(1, 1260, 1000, [], [aHouse(0)], [sheep]);
    ruinOnly.step(2, 1260, 1000, [], [aHouse(0)], [sheep]);
    expect(direction(ruinOnly, 1260, 1000)).toEqual([0, 1]);
  });

  it('Scenario: El enemigo gana a la oveja (oveja a 50, enemigo a 350)', () => {
    const arsenal = linterOnly();
    const enemy = new FakeTarget(1000, 650);
    const sheep = aSheep(1000, 1050);
    arsenal.step(1, 1000, 1000, [enemy], [], [sheep]);
    arsenal.step(2, 1000, 1000, [enemy], [], [sheep]);
    expect(direction(arsenal, 1000, 1000)).toEqual([0, -1]);
  });

  it('Scenario: Límite del alcance con una oveja (400 es objetivo, 401 no y sigue cargado)', () => {
    const at400 = linterOnly();
    at400.step(1, 1400, 1000, [], [], [aSheep(1000, 1000)]);
    expect(at400.projectiles).toHaveLength(1);
    const at401 = linterOnly();
    at401.step(1, 1401, 1000, [], [], [aSheep(1000, 1000)]);
    expect(at401.projectiles).toHaveLength(0);
    expect(at401.weapons[0]?.isChargedAt(1)).toBe(true);
  });

  it('Scenario: Empate entre ovejas (o1 en (1.000, 700) antes que o2 en (1.000, 1.300))', () => {
    const arsenal = linterOnly();
    const flock = [aSheep(1000, 700), aSheep(1000, 1300)];
    arsenal.step(1, 1000, 1000, [], [], flock);
    arsenal.step(2, 1000, 1000, [], [], flock);
    expect(direction(arsenal, 1000, 1000)).toEqual([0, -1]);
  });

  it('Scenario: Una ruina no es objetivo (sin enemigos ni ovejas, 120 ticks)', () => {
    const arsenal = linterOnly();
    const ruin = aHouse(0);
    for (let n = 1; n <= 120; n++) arsenal.step(n, 1260, 1000, [], [ruin], []);
    expect(arsenal.projectiles).toHaveLength(0);
    expect(arsenal.weapons[0]?.isChargedAt(120)).toBe(true);
  });
});

describe('Proyectiles y ovejas (spec auto-weapons)', () => {
  it('Scenario: Impacto en una oveja ((1.028, 1.000) en T + 34 con vida 12; vida 6 en T + 35)', () => {
    const arsenal = linterOnly();
    const sheep = aSheep(1000, 1000);
    const T = 1;
    for (let n = T; n <= T + 34; n++) arsenal.step(n, 1300, 1000, [], [], [sheep]);
    expect(arsenal.projectiles.find((p) => p.id === 0)?.x).toBe(1028);
    expect(sheep.hp).toBe(12);
    arsenal.step(T + 35, 1300, 1000, [], [], [sheep]);
    expect(arsenal.projectiles.find((p) => p.id === 0)).toBeUndefined();
    expect([sheep.hp, sheep.hits]).toEqual([6, [T + 35]]);
  });

  it('Scenario: Un proyectil dirigido a un enemigo atraviesa una oveja (impacto en T + 49)', () => {
    const arsenal = linterOnly();
    const sheep = aSheep(1000, 1000);
    const enemy = new FakeTarget(900, 1000, 10, 10);
    const T = 1;
    const hp: number[] = [];
    for (let n = T; n <= T + 49; n++) {
      arsenal.step(n, 1300, 1000, [enemy], [], [sheep]);
      hp.push(sheep.hp);
    }
    expect(hp.every((h) => h === 12)).toBe(true);
    expect([enemy.hits, enemy.hp]).toEqual([[T + 49], 4]);
  });

  it('Scenario: Un proyectil dirigido a una oveja da antes a un enemigo (impacto en T + 18)', () => {
    const arsenal = linterOnly();
    const sheep = aSheep(1000, 1000);
    const enemy = new FakeTarget(1150, 1000, 10, 10);
    const T = 1;
    arsenal.step(T, 1300, 1000, [], [], [sheep]);
    for (let n = T + 1; n <= T + 35; n++) arsenal.step(n, 1300, 1000, [enemy], [], [sheep]);
    expect([enemy.hits, enemy.hp]).toEqual([[T + 18], 4]);
    expect(arsenal.projectiles.find((p) => p.id === 0)).toBeUndefined();
    expect(sheep.hp).toBe(12);
  });

  it('Scenario: Proyectiles entre estructuras y ovejas (cada uno daña solo a su nivel)', () => {
    const toHouse = linterOnly();
    const house = aHouse();
    const sheepA = aSheep(1260, 690);
    for (let n = 1; n <= 40; n++) toHouse.step(n, 1260, 1000, [], [house], [sheepA]);
    expect([house.hp, sheepA.hp]).toEqual([24, 12]);

    const toSheep = linterOnly();
    const ruin = aHouse(0);
    const sheepB = aSheep(1260, 690);
    for (let n = 1; n <= 40; n++) toSheep.step(n, 1260, 1000, [], [ruin], [sheepB]);
    expect([ruin.hp, sheepB.hp]).toEqual([0, 6]);
  });
});

describe('Pulso y ovejas (spec auto-weapons)', () => {
  it('Scenario: Pulso sobre una oveja sola (a 109 dispara: vida 8; a 110 no y sigue cargado)', () => {
    const in109 = testsOnly();
    const a = aSheep(1000, 1000);
    in109.step(1, 1109, 1000, [], [], [a]);
    expect(a.hp).toBe(8);
    const at110 = testsOnly();
    const b = aSheep(1000, 1000);
    at110.step(1, 1110, 1000, [], [], [b]);
    expect(b.hp).toBe(12);
    expect(at110.pulses).toHaveLength(0);
    expect(at110.weapons[0]?.isChargedAt(1)).toBe(true);
  });

  it('Scenario: Pulso disparado por un enemigo que alcanza a una oveja (torch 6, oveja 8)', () => {
    const arsenal = testsOnly();
    const torch = new FakeTarget(1050, 1000, 10, 10);
    const sheep = aSheep(1100, 1000);
    arsenal.step(1, 1000, 1000, [torch], [], [sheep]);
    expect([torch.hp, sheep.hp]).toEqual([6, 8]);
  });

  it('Scenario: Pulso sobre una ruina (sin enemigos ni ovejas: 300 ticks sin pulso)', () => {
    const arsenal = testsOnly();
    const ruin = aHouse(0);
    for (let n = 1; n <= 300; n++) arsenal.step(n, 1260, 690, [], [ruin], []);
    expect(arsenal.pulses).toHaveLength(0);
    expect(ruin.hp).toBe(0);
  });

  it('las bajas devueltas son solo de enemigos: dejar una oveja a 0 no cuenta', () => {
    const arsenal = testsOnly();
    const sheep = aSheep(1000, 1000, 4);
    expect(arsenal.step(1, 1050, 1000, [], [], [sheep])).toBe(0);
    expect(sheep.hp).toBe(0);
  });
});
