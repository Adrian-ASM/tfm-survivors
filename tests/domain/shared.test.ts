import { describe, expect, it } from 'vitest';
import { err, ok } from '../../src/domain/shared/Result';
import { Vector2 } from '../../src/domain/shared/Vector2';
import { assertNever } from '../../src/domain/shared/assertNever';

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

  it('calcula la distancia a otro punto, simétrica y 0 consigo mismo', () => {
    const a = Vector2.of(1, 2);
    const b = Vector2.of(4, 6);
    expect(a.distanceTo(b)).toBe(5);
    expect(b.distanceTo(a)).toBe(5);
    expect(a.distanceTo(a)).toBe(0);
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

describe('assertNever', () => {
  it('lanza si se alcanza una variante no contemplada', () => {
    expect(() => assertNever('laser' as never)).toThrow('laser');
  });
});
