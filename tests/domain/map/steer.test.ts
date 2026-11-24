import { describe, expect, it } from 'vitest';
import { FlowField } from '../../../src/domain/map/FlowField';
import { GameMap } from '../../../src/domain/map/GameMap';
import { DEFAULT_MAP } from '../../support/builders';
import { castleBlock, mapRules, mapWith, type Layout } from '../../support/mapLayouts';

// Spec enemy-behavior, "Navegación por el campo de flujo" (change 0019, design §2.3 y §2.5).
const RULES = mapRules();

/** Objetivo de `steer` para un enemigo en (ex, ey) con el jugador en (px, py) sobre `map`. */
function steerOn(map: GameMap, ex: number, ey: number, px: number, py: number) {
  const field = new FlowField(map);
  field.retarget(map.colAt(px), map.rowAt(py));
  const out = { x: Number.NaN, y: Number.NaN };
  field.steer(ex, ey, px, py, out);
  return out;
}

const closed: Layout = { '10,4': 'trunk', '9,5': 'trunk', '11,5': 'trunk', '10,6': 'trunk' };

describe('Objetivo de cada enemigo con el campo (spec enemy-behavior)', () => {
  it('Scenario: Empate resuelto igual siempre (desde (32, 14) gana el vecino izquierdo)', () => {
    const map = mapWith(RULES, castleBlock());
    const field = new FlowField(map);
    field.retarget(32, 19);
    expect(field.distanceAt(31, 14)).toBe(10);
    expect(field.distanceAt(33, 14)).toBe(10);
    expect(field.distanceAt(32, 14)).toBe(11);
    expect(steerOn(map, 1950, 870, 1950, 1170)).toEqual({ x: 1890, y: 870 });
  });

  it('Scenario: Celda sin distancia en el campo (objetivo = jugador)', () => {
    const map = mapWith(RULES, closed);
    expect(steerOn(map, 630, 330, 1230, 330)).toEqual({ x: 1230, y: 330 });
    expect(steerOn(map, 630, 270, 1230, 270)).toEqual({ x: 1230, y: 270 });
  });

  it('con línea libre el objetivo es el jugador aunque el campo diga otra cosa', () => {
    const map = mapWith(RULES, { '3,6': 'trunk' });
    expect(steerOn(map, 100, 270, 480, 270)).toEqual({ x: 480, y: 270 });
  });

  it('en la celda del jugador el objetivo es el jugador (también sin línea libre)', () => {
    // Tronco en (8, 4); jugador y enemigo en la (8, 5): el objetivo es el centro del jugador.
    const map = mapWith(RULES, { '8,4': 'trunk' });
    expect(steerOn(map, 530, 350, 510, 330)).toEqual({ x: 510, y: 330 });
  });

  it('sin línea libre: centro de la siguiente celda (muro de troncos en la columna 10)', () => {
    const wall: Record<string, 'trunk'> = {};
    for (let r = 2; r <= 6; r++) wall[`10,${String(r)}`] = 'trunk';
    const map = mapWith(RULES, wall);
    // (330, 270) es la celda (5, 4): el vecino izquierdo no baja; derecho (6, 4) sí.
    expect(steerOn(map, 330, 270, 930, 270)).toEqual({ x: 390, y: 270 });
  });

  it('el centro de la siguiente celda es el del rectángulo recortado en el borde del mundo', () => {
    const rules = mapRules(DEFAULT_MAP, 4000, 4000);
    const map = mapWith(rules, { '6,65': 'trunk' });
    // Enemigo en (5, 65), jugador en (10, 66): la siguiente es la (5, 66), y en [3.960, 4.000].
    expect(steerOn(map, 330, 3930, 630, 3980)).toEqual({ x: 330, y: 3980 });
  });

  it('con un mapa sin celdas bloqueadas el objetivo es siempre el jugador y no hay BFS', () => {
    const field = new FlowField(GameMap.open(RULES));
    field.retarget(0, 0);
    const out = { x: 0, y: 0 };
    field.steer(3000, 2000, 10, 10, out);
    expect(out).toEqual({ x: 10, y: 10 });
    expect(field.computations).toBe(0);
  });

  it('reutiliza el objeto de salida y hace una sola BFS por celda objetivo', () => {
    const map = mapWith(RULES, castleBlock());
    const field = new FlowField(map);
    field.retarget(32, 19);
    const out = { x: 0, y: 0 };
    field.steer(1950, 870, 1950, 1170, out);
    const first = { ...out };
    field.steer(2010, 870, 1950, 1170, out);
    expect(first).toEqual({ x: 1890, y: 870 });
    expect(out).toEqual({ x: 2070, y: 870 });
    expect(field.computations).toBe(1);
  });
});
