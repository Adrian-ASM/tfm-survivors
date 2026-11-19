import { describe, expect, it } from 'vitest';
import { Arena } from '../../src/domain/arena/Arena';
import { Vector2 } from '../../src/domain/shared/Vector2';

function arena(width = 960, height = 540): Arena {
  const r = Arena.create(width, height);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe('Arena · recorte por eje', () => {
  it.each([
    [-50, 16],
    [16, 16],
    [480, 480],
    [944, 944],
    [2000, 944],
  ])('clampX(%d, 16) = %d', (x, expected) => {
    expect(arena().clampX(x, 16)).toBe(expected);
  });

  it.each([
    [-1, 22],
    [270, 270],
    [999, 518],
  ])('clampY(%d, 22) = %d', (y, expected) => {
    expect(arena().clampY(y, 22)).toBe(expected);
  });

  it.each([
    [Vector2.of(-10, -10), 16],
    [Vector2.of(480, 270), 16],
    [Vector2.of(1000, 600), 16],
    [Vector2.of(938.5, 12), 22],
    [Vector2.of(100, 9999), 270],
  ])('clampCircle(%o, %d) equivale a clampX/clampY', (center, radius) => {
    const a = arena();
    const clamped = a.clampCircle(center, radius);
    expect([clamped.x, clamped.y]).toEqual([
      a.clampX(center.x, radius),
      a.clampY(center.y, radius),
    ]);
  });

  it('enemigo de radio 22 junto al borde derecho queda en 938', () => {
    expect(arena().clampX(950, 22)).toBe(938);
  });
});
