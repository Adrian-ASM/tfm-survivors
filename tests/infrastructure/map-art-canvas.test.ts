import { describe, expect, it } from 'vitest';
import { toMapSnapshot } from '../../src/domain/map/MapSnapshot';
import type { SpriteDraw } from '../../src/infrastructure/phaser/map/planMapArt';
import { paintMapArt, type MapArtCanvas } from '../../src/infrastructure/phaser/TerrainView';
import { aDefaultConfig } from '../support/builders';
import { planFor } from '../support/mapArt';
import { mapRules, mapWith } from '../support/mapLayouts';
import { mapForSeed } from '../support/mapStats';
import { startSeededRun } from '../support/runs';

// Spec sprite-rendering (0016), "Pintado del mapa": un objeto por entrada del plan y nada del mapa
// anterior al repintar (design §5.4, costura sin motor).

/** Lienzo doble: objetos visibles por capa tras cada operación. */
function fakeCanvas() {
  const visible: string[] = [];
  const log: string[] = [];
  const canvas: MapArtCanvas = {
    clear: () => {
      log.push('clear');
      visible.length = 0;
    },
    tiles: (t) => visible.push(`low:tiles:${t.texture}`),
    sprite: (layer, s: SpriteDraw) => visible.push(`${layer}:${s.role}`),
    rect: () => visible.push('low:rect'),
    circle: () => visible.push('low:circle'),
    foam: (frame) => log.push(`foam ${String(frame)}`),
    frame: () => undefined,
    show: () => undefined,
  };
  return { canvas, visible, log };
}

const seed42 = () => planFor(toMapSnapshot(mapForSeed(aDefaultConfig(), 42)));

describe('paintMapArt', () => {
  it('un objeto por entrada del plan (objetos pintados = objetos del plan)', () => {
    const { canvas, visible } = fakeCanvas();
    const plan = seed42();
    paintMapArt(canvas, plan);
    expect(visible).toHaveLength(plan.objects);
    expect(visible.filter((v) => v.startsWith('high:'))).toHaveLength(plan.high.length);
    expect(visible.filter((v) => v === 'high:roof')).toHaveLength(1);
  });

  it('Scenario: Partida nueva con otro mapa (borra antes de repintar: nada del anterior)', () => {
    const { canvas, visible, log } = fakeCanvas();
    paintMapArt(canvas, seed42());
    const next = planFor(toMapSnapshot(mapWith(mapRules(), { '3,3': 'trunk' })), 7);
    paintMapArt(canvas, next);
    expect(log.filter((l) => l === 'clear')).toHaveLength(2);
    expect(visible.sort()).toEqual(['high:canopy', 'low:trunk']);
  });

  it('Scenario: Mapa vacío (ningún objeto del mapa)', () => {
    const { canvas, visible } = fakeCanvas();
    const empty = planFor(toMapSnapshot(mapWith(mapRules(), {})));
    paintMapArt(canvas, empty);
    expect(visible).toEqual([]);
  });

  it('devuelve los recuentos del plan para la sonda', () => {
    const { canvas } = fakeCanvas();
    const plan = seed42();
    expect(paintMapArt(canvas, plan)).toEqual({
      cells: plan.cells,
      mapArt: { ...plan.counts, objects: plan.objects },
    });
  });

  // 0029: `frame(i)` usa el mismo índice que `show(i)` (orden de llamada desde `clear`).
  it('Scenario: `drawn` igual al recorte (los índices de los grupos de animación son sprites animables en el orden pintado)', () => {
    const { canvas, visible } = fakeCanvas();
    const plan = planFor(startSeededRun(aDefaultConfig(), 42).map, 42);
    paintMapArt(canvas, plan);
    const roles = plan.animations.flatMap((g) => g.indices.map((i) => visible[i]));
    expect(roles.length).toBeGreaterThan(0);
    expect(new Set(roles)).toEqual(
      new Set(['low:trunk', 'high:canopy', 'low:structure', 'high:structure-top']),
    );
    expect(visible).toHaveLength(plan.objects);
    expect(visible.filter((v) => v.endsWith(':decor') || v.endsWith(':decor-top')).length).toBe(
      plan.decor.reduce((n, d) => n + d.pieces, 0),
    );
  });
});
