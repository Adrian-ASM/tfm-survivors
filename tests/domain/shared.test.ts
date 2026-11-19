import { describe, expect, it } from 'vitest';
import { err, ok } from '../../src/domain/shared/Result';
import { Vector2 } from '../../src/domain/shared/Vector2';

describe('Vector2', () => {
  it('suma y escala sin mutar el original', () => {
    const v = Vector2.of(3, 4);
    const w = v.add(Vector2.of(1, 1)).scale(2);
    expect([w.x, w.y]).toEqual([8, 10]);
    expect([v.x, v.y]).toEqual([3, 4]);
  });

  it('calcula el módulo', () => {
    expect(Vector2.of(3, 4).length()).toBe(5);
  });

  it('es inmutable', () => {
    const v = Vector2.of(1, 2);
    expect(() => {
      (v as unknown as { x: number }).x = 9;
    }).toThrow(TypeError);
  });

  it('rechaza componentes no finitas', () => {
    expect(() => Vector2.of(Number.NaN, 0)).toThrow(RangeError);
    expect(() => Vector2.of(0, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('Result', () => {
  it('distingue éxito y error', () => {
    const good = ok(1);
    const bad = err('x');
    expect(good.ok && good.value).toBe(1);
    expect(!bad.ok && bad.error).toBe('x');
  });
});
