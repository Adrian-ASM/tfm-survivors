import { describe, expect, it } from 'vitest';
import type { EnemyTypeConfig } from '../../src/domain/enemy/EnemyType';
import type { RunSetup } from '../../src/domain/run/Run';
import type { WeaponsConfig } from '../../src/domain/weapon/WeaponLoadout';
import {
  DEFAULT_ENEMY_TYPES,
  DEFAULT_WEAPONS,
  LINTER,
  LONG_RUN_HEALTH,
  NO_WEAPONS,
  TESTS,
  withWeapons,
} from '../support/builders';
import { aContactConfig, startRun, ticks } from '../support/runs';
import { weaponsOf } from '../support/weapons';

const PX = 480;
const PY = 270;

/** Partida con el catálogo por defecto, jugador inmortal en el centro y las armas dadas. */
function play(weapons: WeaponsConfig, setup: RunSetup, n: number) {
  const types: readonly EnemyTypeConfig[] = DEFAULT_ENEMY_TYPES;
  const config = aContactConfig({ types, player: { maxHealth: LONG_RUN_HEALTH } });
  return ticks(startRun(withWeapons(config, weapons), setup), n);
}

/** Vidas distintas del enemigo 0 en orden, y si ha desaparecido al final. */
function history(snaps: ReturnType<typeof play>): { lives: number[]; gone: boolean } {
  const lives: number[] = [];
  for (const s of snaps) {
    const h = s.enemies.find((e) => e.id === 0)?.health;
    if (h !== undefined && lives.at(-1) !== h) lives.push(h);
  }
  return { lives, gone: !snaps.at(-1)?.enemies.some((e) => e.id === 0) };
}

const one = (type: string, health?: number): RunSetup => ({
  enemies: [{ type, x: PX + 100, y: PY, ...(health === undefined ? {} : { health }) }],
});

describe('Run · daño acumulado con las armas por defecto', () => {
  it('Scenario: Ningún arma mata a un bug de un impacto (Linter → 4; Tests → 6)', () => {
    expect(history(play(weaponsOf([LINTER]), one('goblin-torch'), 29))).toEqual({
      lives: [10, 4],
      gone: false,
    });
    const near = { enemies: [{ type: 'goblin-torch', x: PX + 50, y: PY }] };
    expect(history(play(weaponsOf([TESTS]), near, 1))).toEqual({ lives: [6], gone: false });
  });

  it('Scenario: Linter mata a un bug en 2 impactos (no aparece en el snapshot del tick n)', () => {
    const snaps = play(weaponsOf([LINTER]), one('goblin-torch', 4), 30);
    const n = snaps.findIndex((s) => s.enemies.length === 0);
    expect(n).toBeGreaterThan(0);
    // En el tick n desaparece a la vez el proyectil que lo ha alcanzado.
    expect(snaps[n - 1]?.projectiles).toHaveLength(1);
    expect(snaps[n]?.projectiles).toHaveLength(0);
  });

  it('Scenario: Tests mata a un bug en 3 pulsos (vida 2 tras 2 pulsos)', () => {
    const near = { enemies: [{ type: 'goblin-torch', x: PX + 50, y: PY }] };
    const snaps = play(weaponsOf([TESTS]), near, 181);
    expect(history(snaps.slice(0, 180))).toEqual({ lives: [6, 2], gone: false });
    expect(history(snaps)).toMatchObject({ gone: true });
    expect(snaps[180]?.enemies).toEqual([]);
  });

  it('Scenario: Combinación de armas (6 + 4 = 10: baja exacta)', () => {
    const near = { enemies: [{ type: 'goblin-torch', x: PX + 50, y: PY }] };
    expect(history(play(DEFAULT_WEAPONS, near, 30))).toEqual({ lives: [6], gone: true });
  });

  it('Scenario: Enemigos más resistentes (goblin-barrel 4 impactos; goblin-tnt 8)', () => {
    const merge = history(play(weaponsOf([LINTER]), one('goblin-barrel'), 30 * 4));
    expect(merge).toEqual({ lives: [20, 14, 8, 2], gone: true });
    const leak = history(play(weaponsOf([LINTER]), one('goblin-tnt'), 30 * 8));
    expect(leak).toEqual({ lives: [45, 39, 33, 27, 21, 15, 9, 3], gone: true });
  });
});

describe('Run · un enemigo dañado sigue persiguiendo', () => {
  it.each([
    ['Linter', weaponsOf([LINTER])],
    ['Tests', weaponsOf([TESTS])],
  ])('Scenario: Misma trayectoria con y sin daño; El impacto no empuja (%s)', (_name, weapons) => {
    const setup = { enemies: [{ type: 'goblin-torch', x: 380, y: PY }] };
    const hit = play(weapons, setup, 20);
    const clean = play(NO_WEAPONS, setup, 20);
    expect(hit.some((s) => s.enemies[0]?.damaged)).toBe(true);
    for (let i = 0; i < 20; i++) {
      const [a, b] = [hit[i]?.enemies[0], clean[i]?.enemies[0]];
      expect(Math.abs((a?.x ?? 0) - (b?.x ?? 0))).toBeLessThanOrEqual(0.001);
      expect(Math.abs((a?.y ?? 0) - (b?.y ?? 0))).toBeLessThanOrEqual(0.001);
    }
  });
});
