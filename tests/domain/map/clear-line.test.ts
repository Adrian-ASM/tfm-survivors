import { describe, expect, it } from 'vitest';
import type { CellType } from '../../../src/domain/map/CellType';
import { FlowField } from '../../../src/domain/map/FlowField';
import { GameMap } from '../../../src/domain/map/GameMap';
import { Mulberry32RandomGenerator } from '../../../src/infrastructure/random/Mulberry32RandomGenerator';
import { mapRules, mapWith, type Layout } from '../../support/mapLayouts';

// Spec enemy-behavior, "Línea libre hasta el jugador" (change 0019, design §2.4).
const RULES = mapRules();

const lineOn = (layout: Layout, ex: number, ey: number, px: number, py: number): boolean =>
  new FlowField(mapWith(RULES, layout)).hasClearLine(ex, ey, px, py);

describe('Línea libre hasta el jugador (spec enemy-behavior)', () => {
  it('Scenario: Obstáculo fuera del segmento (tronco en (3, 6)): hay línea libre', () => {
    expect(lineOn({ '3,6': 'trunk' }, 100, 270, 480, 270)).toBe(true);
  });

  it('Scenario: Obstáculo que corta el segmento (tronco en (5, 4)): sin línea libre', () => {
    expect(lineOn({ '5,4': 'trunk' }, 100, 270, 480, 270)).toBe(false);
  });

  it('Scenario: Agua y castillo también cortan la línea (puente no)', () => {
    const at = (type: CellType) => lineOn({ '5,4': type }, 100, 270, 480, 270);
    expect(at('water')).toBe(false);
    expect(at('castle')).toBe(false);
    expect(at('bridge')).toBe(true);
  });

  it('Scenario: Sin cortar por una esquina (troncos en (4, 3) y (3, 4))', () => {
    expect(lineOn({ '4,3': 'trunk', '3,4': 'trunk' }, 210, 210, 270, 270)).toBe(false);
    expect(lineOn({}, 210, 210, 270, 270)).toBe(true);
  });

  it('una sola celda lateral bloqueada en la esquina también corta (en los cuatro sentidos)', () => {
    expect(lineOn({ '4,3': 'trunk' }, 210, 210, 270, 270)).toBe(false);
    expect(lineOn({ '3,4': 'trunk' }, 270, 270, 210, 210)).toBe(false);
    expect(lineOn({ '3,3': 'trunk' }, 270, 210, 210, 270)).toBe(false);
    expect(lineOn({ '4,4': 'trunk' }, 210, 270, 270, 210)).toBe(false);
  });

  it('Scenario: Segmento sobre el borde de una celda bloqueada (y = 300 está en la fila 5)', () => {
    expect(lineOn({ '3,5': 'trunk' }, 100, 300, 480, 300)).toBe(false);
    expect(lineOn({ '3,4': 'trunk' }, 100, 300, 480, 300)).toBe(true);
  });

  it('un segmento vertical sobre una línea de columnas recorre la columna de mayor índice', () => {
    expect(lineOn({ '4,3': 'trunk' }, 240, 100, 240, 400)).toBe(false);
    expect(lineOn({ '3,3': 'trunk' }, 240, 100, 240, 400)).toBe(true);
  });

  it('un enemigo sobre una celda bloqueada no tiene línea libre', () => {
    expect(lineOn({ '1,4': 'trunk' }, 100, 270, 480, 270)).toBe(false);
  });

  it('sentido inverso: la misma celda bloqueada corta el segmento de vuelta', () => {
    expect(lineOn({ '5,4': 'trunk' }, 480, 270, 100, 270)).toBe(false);
    expect(lineOn({ '5,4': 'trunk' }, 480, 290, 100, 250)).toBe(false);
  });

  it('Con el mapa vacío todo enemigo tiene siempre línea libre', () => {
    const field = new FlowField(GameMap.open(RULES));
    const random = new Mulberry32RandomGenerator(5);
    for (let i = 0; i < 500; i++) {
      const [ex, ey, px, py] = [
        random.next() * RULES.width,
        random.next() * RULES.height,
        random.next() * RULES.width,
        random.next() * RULES.height,
      ];
      expect(field.hasClearLine(ex, ey, px, py)).toBe(true);
    }
  });

  it('en diagonal larga: un tronco que la recta cruza corta y uno al lado no', () => {
    // De (30, 30) a (630, 330): pendiente 1/2; en x ∈ [300, 360] la y va de 165 a 195 (fila 2).
    expect(lineOn({ '5,2': 'trunk' }, 30, 30, 630, 330)).toBe(false);
    expect(lineOn({ '5,4': 'trunk' }, 30, 30, 630, 330)).toBe(true);
  });
});
