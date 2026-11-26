import { describe, expect, it } from 'vitest';
import type { StructureSnapshot } from '../../src/domain/run/RunSnapshot';
import {
  barRects,
  damageText,
  newHits,
  numberPose,
} from '../../src/infrastructure/phaser/art/combatFeedback';
import { REPO_COMBAT, aHit } from '../support/feedback';

// Spec sprite-rendering (0031), "Números de daño" y "Barras de vida de las estructuras": funciones
// puras con los datos del repositorio (L 800, H 32, E 20, P 48; barra 48 × 6 a 8 px).
const M = REPO_COMBAT.numbers;
const ids = (n: number, from = 0) =>
  Array.from({ length: n }, (_, i) => aHit(from + i, 'enemy', 6));

const house = (health: number, maxHealth = 60): StructureSnapshot => ({
  id: 0,
  type: 'goblin-house',
  x: 1260,
  y: 690,
  radius: 40,
  col: 20,
  row: 10,
  cols: 2,
  rows: 3,
  health,
  maxHealth,
  destroyed: false,
});

describe('numberPose · movimiento lineal con elevación', () => {
  it('a 0, 400 y 800 ms: (y − 20, 1), (y − 36, 0,5) y oculto', () => {
    expect(numberPose(0, M)).toMatchObject({ visible: true, dy: -20, alpha: 1 });
    expect(numberPose(400, M)).toMatchObject({ visible: true, dy: -36, alpha: 0.5 });
    expect(numberPose(800, M).visible).toBe(false);
    expect(numberPose(-1, M).visible).toBe(false);
  });

  it('a 500 ms la opacidad es 0,375 (avance manual de 30 ticks)', () => {
    expect(numberPose(500, M).alpha).toBeCloseTo(0.375, 10);
  });
});

describe('newHits · deduplicación por id', () => {
  it('solo los de id mayor que el último creado', () => {
    expect(newHits(ids(5), -1, 48)).toBe(0);
    expect(newHits(ids(5), 2, 48)).toBe(3);
    expect(newHits(ids(5), 4, 48)).toBe(5);
    expect(newHits([], -1, 48)).toBe(0);
  });

  it('con más nuevos que el pool, los P de id más alto (60 → desde el 12)', () => {
    expect(newHits(ids(60), -1, 48)).toBe(12);
  });
});

describe('damageText', () => {
  it('cifras decimales sin signo, decimales ni separador', () => {
    expect([6, 12, 1000].map(damageText)).toEqual(['6', '12', '1000']);
  });
});

describe('barRects', () => {
  it('Scenario: Barra al 50 %', () => {
    const { back, fill } = barRects(house(30), REPO_COMBAT.bar, 60);
    expect([back.x, back.y, back.x + back.w, back.y + back.h]).toEqual([1236, 586, 1284, 592]);
    expect([fill.x, fill.y, fill.x + fill.w, fill.y + fill.h]).toEqual([1236, 586, 1260, 592]);
  });

  it('63/90 → 33,6 px sin redondeo; llena → 48 px', () => {
    expect(barRects(house(63, 90), REPO_COMBAT.bar, 60).fill.w).toBeCloseTo(33.6, 10);
    expect(barRects(house(60), REPO_COMBAT.bar, 60).fill.w).toBe(48);
  });
});
