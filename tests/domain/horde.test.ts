import { describe, expect, it } from 'vitest';
import { Enemy } from '../../src/domain/enemy/Enemy';
import type { EnemyType } from '../../src/domain/enemy/EnemyType';
import { Horde } from '../../src/domain/enemy/Horde';
import { buildRunRules, type RunRules } from '../../src/domain/run/RunConfig';
import { aRunConfig } from '../support/builders';

function rules(): RunRules {
  const r = buildRunRules(aRunConfig());
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

const { arena, catalog } = rules();
const bug = catalog.get('goblin-torch') as EnemyType;

/** Horda con `count` bugs iniciales (ids 0 … count − 1). */
function hordeOf(count: number): Horde {
  const enemies = Array.from({ length: count }, (_, i) => Enemy.spawn(i, bug, 100, 100, arena));
  return new Horde(enemies, arena);
}

const killAt = (horde: Horde, indexes: readonly number[]): void => {
  for (const i of indexes) horde.alive[i]?.takeDamage(1000, 1);
};
const ids = (horde: Horde): number[] => horde.alive.map((e) => e.id);

describe('Horde (enemigos vivos de la partida)', () => {
  it('Scenario: Bajas sin reordenar (a3 y a7 de 10; las bajas suben en 2)', () => {
    const horde = hordeOf(10);
    killAt(horde, [2, 6]);

    horde.removeDead(() => undefined);

    expect(ids(horde)).toEqual([0, 1, 3, 4, 5, 7, 8, 9]);
    expect(horde.kills).toBe(2);
  });

  it('Scenario: Baja del primero y del último (de 200)', () => {
    const horde = hordeOf(200);
    killAt(horde, [0, 199]);

    horde.removeDead(() => undefined);

    expect(ids(horde)).toEqual(Array.from({ length: 198 }, (_, i) => i + 1));
  });

  it('llama a onDeath con cada muerto, en el orden de la lista', () => {
    const horde = hordeOf(5);
    killAt(horde, [3, 1]);
    const dead: number[] = [];

    horde.removeDead((e) => dead.push(e.id));

    expect(dead).toEqual([1, 3]);
  });

  it('Scenario: Una baja cuenta una sola vez (dos golpes letales y dos pases)', () => {
    const horde = hordeOf(3);
    horde.alive[1]?.takeDamage(6, 1);
    horde.alive[1]?.takeDamage(6, 1);

    horde.removeDead(() => undefined);
    horde.removeDead(() => undefined);

    expect(horde.kills).toBe(1);
  });

  it('los ids nuevos siguen a los iniciales y no se reutilizan tras una baja', () => {
    const horde = hordeOf(3);
    killAt(horde, [2]);
    horde.removeDead(() => undefined);

    horde.spawn(bug, 50, 50);
    horde.spawn(bug, 60, 60);

    expect(ids(horde)).toEqual([0, 1, 3, 4]);
    expect(horde.kills).toBe(1);
  });

  it('empieza sin bajas', () => {
    expect(hordeOf(4).kills).toBe(0);
  });
});
