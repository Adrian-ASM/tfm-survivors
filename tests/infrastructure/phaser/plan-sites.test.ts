import { describe, expect, it } from 'vitest';
import type { RectDraw, SpriteDraw } from '../../../src/infrastructure/phaser/map/planMapArt';
import { aDefaultConfig } from '../../support/builders';
import { planFor, repoAppearance } from '../../support/mapArt';
import { startSeededRun } from '../../support/runs';
import { aSiteConfig, startWithSites } from '../../support/sites';

// Spec sprite-rendering 0026, "Pintado de los solares y de los edificios" (plan sin motor). Solar
// de prueba: huella (20..21, 10..11), x en [1.200, 1.320] e y en [600, 720].
const APPEARANCE = repoAppearance();
const TOWER_FILE = APPEARANCE.sites.tower.sheet.file;
const testSiteMap = () => startWithSites(aSiteConfig()).map;
const MAX_MAP_OBJECTS = 950;

describe('planMapArt · solares (spec sprite-rendering 0026)', () => {
  it('tres aspectos por solar: obra, casa y torre, con origen en el borde inferior de la huella', () => {
    const plan = planFor(testSiteMap());
    const [site] = plan.sites;
    const all = [...plan.low, ...plan.high];
    const sprites = (idx: readonly number[]) => idx.map((i) => all[i] as SpriteDraw);
    expect(site?.fallback).toEqual({ free: false, house: false, tower: false });
    const textures = (idx: readonly number[]) => [...new Set(sprites(idx).map((d) => d.texture))];
    expect(textures(site?.free ?? [])).toEqual([APPEARANCE.sites.construction.sheet.file]);
    expect(textures(site?.house ?? [])).toEqual([APPEARANCE.sites.house.sheet.file]);
    expect(textures(site?.tower ?? [])).toEqual([TOWER_FILE]);
    for (const d of sprites([
      ...(site?.free ?? []),
      ...(site?.house ?? []),
      ...(site?.tower ?? []),
    ])) {
      expect([d.x, d.y, d.scale]).toEqual([1260, 720, 0.9375]);
    }
    // Parte baja (bajo y = 660) y alta: 2 objetos por aspecto.
    expect([site?.free.length, site?.house.length, site?.tower.length]).toEqual([2, 2, 2]);
  });

  it('Scenario: Reserva de los edificios (Tower_Blue sin cargar: 1 rectángulo, sin parte alta)', () => {
    const plan = planFor(testSiteMap(), 42, [TOWER_FILE]);
    const [site] = plan.sites;
    const all = [...plan.low, ...plan.high];
    expect(site?.fallback).toEqual({ free: false, house: false, tower: true });
    expect(site?.tower).toHaveLength(1);
    const rect = all[site?.tower[0] ?? -1] as RectDraw;
    expect(rect.kind).toBe('rect');
    expect(rect.color).toBe(APPEARANCE.siteColors.tower);
    expect([rect.x, rect.y, rect.width, rect.height]).toEqual([1200, 600, 120, 120]);
    expect(plan.low.indexOf(rect)).toBeGreaterThanOrEqual(0);
  });

  it.each([42, 123] as const)(
    'Scenario: Presupuesto de objetos con solares · Objetos del mapa sin cambios (%i: 737 y 820 con tope 0)',
    (seed) => {
      const map = startSeededRun(aDefaultConfig(), seed).map;
      // 0029: con el tope de decoración 0, los de antes; con los datos del repositorio, esos más
      // los de su decoración (medidos en apply: 820 y 904), ≤ 950.
      const zero = planFor(map, seed, [], { maxDecor: 0 });
      const plan = planFor(map, seed);
      expect(zero.sites).toHaveLength(6);
      expect(zero.objects).toBe(seed === 42 ? 737 : 820);
      const decor = plan.decor.reduce((n, d) => n + d.pieces, 0);
      expect(plan.objects).toBe(zero.objects + decor);
      expect(plan.objects).toBe(seed === 42 ? 820 : 904);
      expect(plan.objects).toBeLessThanOrEqual(MAX_MAP_OBJECTS);
    },
  );

  it('con el mapa vacío no hay solares en el plan', () => {
    expect(planFor(startSeededRun(aDefaultConfig(), 42, 'empty').map).sites).toEqual([]);
  });
});
