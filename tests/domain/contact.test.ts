import { describe, expect, it } from 'vitest';
import {
  circlesOverlap,
  contactDamage,
  type ContactTarget,
} from '../../src/domain/collision/contact';

const at = (x: number, damage: number, radius = 10): ContactTarget => ({
  x,
  y: 270,
  radius,
  damage,
});

describe('circlesOverlap · solape estricto', () => {
  it('Tangencia exacta no es contacto (26 = 16 + 10)', () => {
    expect(circlesOverlap(480, 270, 16, 506, 270, 10)).toBe(false);
  });

  it('a distancia 25 < 26 hay contacto', () => {
    expect(circlesOverlap(480, 270, 16, 505, 270, 10)).toBe(true);
  });

  it('con los centros en el mismo punto (d = 0) hay contacto', () => {
    expect(circlesOverlap(480, 270, 16, 480, 270, 10)).toBe(true);
  });

  it('en diagonal compara con cuadrados (3-4-5)', () => {
    expect(circlesOverlap(0, 0, 3, 3, 4, 2)).toBe(false);
    expect(circlesOverlap(0, 0, 3, 3, 4, 2.001)).toBe(true);
  });
});

describe('contactDamage · el mayor daño en contacto', () => {
  it('Contactos simultáneos de daño distinto, en los dos órdenes', () => {
    expect(contactDamage(480, 270, 16, [at(480, 10), at(480, 25)])).toBe(25);
    expect(contactDamage(480, 270, 16, [at(480, 25), at(480, 10)])).toBe(25);
  });

  it('ignora a los que no tocan aunque hagan más daño', () => {
    expect(contactDamage(480, 270, 16, [at(506, 99), at(490, 10)])).toBe(10);
  });

  it('sin contacto vale 0', () => {
    expect(contactDamage(480, 270, 16, [at(600, 10)])).toBe(0);
  });

  it('con la lista vacía vale 0', () => {
    expect(contactDamage(480, 270, 16, [])).toBe(0);
  });
});
