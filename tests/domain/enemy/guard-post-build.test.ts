import { describe, expect, it } from 'vitest';
import { Arena } from '../../../src/domain/arena/Arena';
import { Enemy } from '../../../src/domain/enemy/Enemy';
import { EnemyCatalog } from '../../../src/domain/enemy/EnemyCatalog';
import type { EnemyType } from '../../../src/domain/enemy/EnemyType';
import { GuardPost } from '../../../src/domain/enemy/GuardPost';
import { Horde } from '../../../src/domain/enemy/Horde';
import { FlowField } from '../../../src/domain/map/FlowField';
import { GameMap } from '../../../src/domain/map/GameMap';
import { TICK_SECONDS } from '../../../src/domain/run/Run';
import { aDefaultConfig } from '../../support/builders';
import { aCampScenario, aGuardAt, aGuardType } from '../../support/camps';
import { mapRules } from '../../support/mapLayouts';
import { advance } from '../../support/runs';
import { FOOTPRINT, TEST_SITE, startWithSites } from '../../support/sites';

// Spec enemy-behavior 0026, "Navegación con edificios construidos": con `Horde`, `GuardPost` y el
// mapa con `build` directo (la obra en una partida llega en el grupo 3). Huella del solar de
// prueba: celdas (20..21, 10..11), x en [1.200, 1.320] e y en [600, 720].
const CONTENT = aDefaultConfig();
const ARENA = (() => {
  const r = Arena.create(CONTENT.arena.width, CONTENT.arena.height);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
})();
const RULES = mapRules();
const GUARD: EnemyType = (() => {
  const r = EnemyCatalog.create([aGuardType()], ARENA);
  if (!r.ok) throw new Error(r.error.message);
  const t = r.value.get('guard');
  if (!t) throw new Error('sin guardia');
  return t;
})();
const TORCH: EnemyType = (() => {
  const r = EnemyCatalog.create(CONTENT.enemies.types, ARENA);
  if (!r.ok) throw new Error(r.error.message);
  const t = r.value.get('goblin-torch');
  if (!t) throw new Error('sin goblin-torch');
  return t;
})();
const FAR_PLAYER = { x: 3500, y: 2000 };
const RETURN = GUARD.behavior.names.indexOf('return');

const build = (map: GameMap) =>
  map.build(TEST_SITE.col, TEST_SITE.row, FOOTPRINT.cols, FOOTPRINT.rows);
const inFootprint = (map: GameMap, x: number, y: number) => map.isBuilt(map.colAt(x), map.rowAt(y));

describe('Guardias con edificios construidos (spec enemy-behavior 0026)', () => {
  // 0027: el solar libre es la huella marcada desde el tick 0 y la torre la misma huella (casa =
  // torre = solar), así que los dos casos navegan sobre la misma capa de obra.
  it.each([['solar libre'], ['torre construida']])(
    'Scenario: El guardia vuelve rodeando un solar (%s)',
    () => {
      const map = GameMap.open(RULES);
      const Q = { x: 1260, y: 830 };
      const post = new GuardPost(Q.x, Q.y, GUARD, map, ARENA);
      build(map);
      const guard = Enemy.spawn(0, GUARD, 1260, 500, ARENA, GUARD.health, RETURN, 0, post);
      const horde = new Horde([guard], ARENA);
      const field = new FlowField(map);
      const path: [number, number][] = [];
      for (let n = 1; n <= 1200; n++) {
        horde.act(n, FAR_PLAYER.x, FAR_PLAYER.y, TICK_SECONDS, field);
        path.push([guard.x, guard.y]);
      }
      expect(path.some(([x, y]) => inFootprint(map, x, y))).toBe(false);
      const reached = path.some(
        ([x, y]) => Math.abs(x - Q.x) <= 0.001 && Math.abs(y - Q.y) <= 0.001,
      );
      expect(reached).toBe(true);
    },
  );

  it('Scenario: Mismo movimiento con la misma obra en otro momento', () => {
    const P = { x: 1260, y: 900 };
    const run = (warmUp: boolean): [number, number][] => {
      const map = GameMap.open(RULES);
      const field = new FlowField(map);
      const enemies = [
        Enemy.spawn(0, TORCH, 1260, 400, ARENA),
        Enemy.spawn(1, TORCH, 1150, 500, ARENA),
      ];
      const horde = new Horde(enemies, ARENA);
      if (warmUp) {
        // La otra partida consultó el campo con otro objetivo antes de la obra.
        field.retarget(5, 5);
        field.distanceAt(0, 0);
      }
      build(map);
      const out: [number, number][] = [];
      for (let n = 1; n <= 600; n++) {
        field.retarget(map.colAt(P.x), map.rowAt(P.y));
        horde.act(n, P.x, P.y, TICK_SECONDS, field);
        for (const e of enemies) out.push([e.x, e.y]);
      }
      return out;
    };
    const early = run(false);
    const probe = GameMap.open(RULES);
    build(probe);
    expect(run(true)).toEqual(early);
    expect(early.some(([x, y]) => inFootprint(probe, x, y))).toBe(false);
    expect(early.some(([x, y]) => x === P.x && y === P.y)).toBe(true);
  });
});

// Spec build-sites 0027, "Punto de patrulla sobre el solar libre": despeje inicial de los puestos.
describe('Puestos de guardia con los solares libres (spec build-sites 0027)', () => {
  it('Scenario: Punto de patrulla sobre el solar libre (1.200 ticks con el jugador lejos)', () => {
    // Casa goblin (30..31, 10..12) con puerta en (1.890, 810): la esquina 1 de la patrulla (radio 60)
    // es (1.950, 750), celda (32, 12), de la huella del solar (32..33, 11..12). Recolocada desde el
    // nacimiento al centro de la celda caminable más cercana, (1.890, 750).
    const base = aCampScenario();
    const types = base.enemies.types.map((t) =>
      t.id === 'guard' ? aGuardType({ detect: 5, lose: 10 }) : t,
    );
    const run = startWithSites(
      { ...base, enemies: { ...base.enemies, types } },
      { player: { x: 3500, y: 2000 }, enemies: [aGuardAt(1890, 810, { house: 0 })] },
      [{ col: 32, row: 11 }],
      { structures: [{ type: 'goblin-house', col: 30, row: 10, cols: 2, rows: 3 }] },
    );
    const path = advance(run, 1200);
    const onSite = (x: number, y: number) => x >= 1920 && x < 2040 && y >= 660 && y < 780;
    expect(path.some((s) => s.enemies.some((e) => onSite(e.x, e.y)))).toBe(false);
    expect(path.some((s) => s.enemies.some((e) => e.x === 1890 && e.y === 750))).toBe(true);
  });
});
