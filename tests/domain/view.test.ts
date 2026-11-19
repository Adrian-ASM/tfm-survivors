import { describe, expect, it } from 'vitest';
import { VIEW_SIZE_MUST_BE_POSITIVE, View } from '../../src/domain/arena/View';

describe('View', () => {
  it('calcula la mitad de la diagonal: √(960² + 540²) / 2 ≈ 550,727', () => {
    const r = View.create(960, 540);
    expect(r.ok && r.value.halfDiagonal).toBeCloseTo(550.7268, 4);
  });

  it('es inmutable', () => {
    const r = View.create(960, 540);
    if (!r.ok) throw new Error(r.error.message);
    expect(() => {
      (r.value as unknown as { width: number }).width = 1;
    }).toThrow(TypeError);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rechaza un ancho %s', (width) => {
    const r = View.create(width, 540);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.field).toBe('arena.view.width');
      expect(r.error.message).toBe(VIEW_SIZE_MUST_BE_POSITIVE);
    }
  });

  it.each([0, -1, Number.NaN])('rechaza un alto %s', (height) => {
    const r = View.create(960, height);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe('arena.view.height');
  });
});
