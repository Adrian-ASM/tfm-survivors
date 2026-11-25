import { describe, expect, it } from 'vitest';
import { CastleGate } from '../../src/domain/shop/CastleGate';

// Spec castle-shop (0024), "Apertura por la puerta con re-armado" (paso 11): con d = distancia del
// jugador a la puerta, se arma si d ≥ re-armado y se abre (y se desarma) si está armada, d < radio
// y la partida sigue en curso.

const DOOR = { x: 1000, y: 1000 };
const gate = (armed = false) => new CastleGate(DOOR, { radius: 40, rearmDistance: 300 }, armed);

describe('CastleGate', () => {
  it('nace desarmada y no se abre en la puerta', () => {
    const g = gate();
    expect(g.step(1000, 1000, true)).toBe(false);
    expect(g.armed).toBe(false);
  });

  it('se arma a d ≥ 300 (no a 299) sin abrirse en ese paso', () => {
    const g = gate();
    expect(g.step(1299, 1000, true)).toBe(false);
    expect(g.armed).toBe(false);
    expect(g.step(1300, 1000, true)).toBe(false);
    expect(g.armed).toBe(true);
  });

  it('armada, se abre a d < 40 y queda desarmada; a d = 40 no', () => {
    const g = gate(true);
    expect(g.step(1040, 1000, true)).toBe(false);
    expect(g.armed).toBe(true);
    expect(g.step(1039.9, 1000, true)).toBe(true);
    expect(g.armed).toBe(false);
    expect(g.step(1000, 1000, true)).toBe(false);
  });

  it('con una oferta abierta en el tick no se abre y sigue armada', () => {
    const g = gate(true);
    expect(g.step(1000, 1000, false)).toBe(false);
    expect(g.armed).toBe(true);
    expect(g.step(1000, 1000, true)).toBe(true);
  });

  it('con una oferta abierta el re-armado sí corre', () => {
    const g = gate();
    g.step(1400, 1000, false);
    expect(g.armed).toBe(true);
  });

  it('sin puerta nunca se arma ni se abre', () => {
    const g = new CastleGate(null, { radius: 40, rearmDistance: 300 }, true);
    expect(g.step(1000, 1000, true)).toBe(false);
    expect(g.door).toBeNull();
  });
});
