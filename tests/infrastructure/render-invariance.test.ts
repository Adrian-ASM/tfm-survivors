import { describe, expect, it } from 'vitest';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import type { RingSprite } from '../../src/infrastructure/phaser/PulseLayer';
import { RenderLayers } from '../../src/infrastructure/phaser/RenderLayers';
import { emptyCounts } from '../../src/infrastructure/phaser/renderCounts';
import type { MapArtCanvas } from '../../src/infrastructure/phaser/TerrainView';
import { aDefaultConfig } from '../support/builders';
import { FAKE_HAZARD_CAPACITY, FakeGraphics, fakeKit } from '../support/FakeSprite';
import { randomInputs } from '../support/inputs';
import { someLooks } from '../support/looks';
import { planFor } from '../support/mapArt';
import { chooseFirstWhileOpen, startSeededRun } from '../support/runs';

// Spec sprite-rendering (0029), "Sonda de render para E2E" (decoración) y la invariancia de la
// simulación con y sin decoración y animación del mapa pintadas en cada frame.
const CONFIG = aDefaultConfig();
const FRAME_MS = 16.667;
const DECOR_SHEETS = ['01', '02', '03', '07', '08', '09', '10', '11', '16', '17', '18'].map(
  (n) => `Deco/${n}.png`,
);

class Ring implements RingSprite {
  visible = true;
  setPosition(): this {
    return this;
  }
  setRadius(): this {
    return this;
  }
  setAlpha(): this {
    return this;
  }
  setVisible(v: boolean): this {
    this.visible = v;
    return this;
  }
}

/** Lienzo del mapa doble: cuenta objetos visibles por textura de decoración y frames recibidos. */
function canvasDouble() {
  const objects: { texture: string; visible: boolean }[] = [];
  let frames = 0;
  const add = (texture = '') => objects.push({ texture, visible: true });
  const canvas: MapArtCanvas = {
    clear: () => {
      objects.length = 0;
    },
    tiles: () => add(),
    sprite: (_layer, s) => add(s.texture),
    rect: () => add(),
    circle: () => add(),
    foam: () => undefined,
    frame: () => {
      frames++;
    },
    show: (i, v) => {
      const o = objects[i];
      if (o) o.visible = v;
    },
  };
  return { canvas, objects, frames: () => frames };
}

function layersFor() {
  return new RenderLayers(
    {
      kit: fakeKit(),
      warnings: () => new FakeGraphics(),
      ring: () => new Ring(),
      looks: someLooks(),
      capacity: {
        enemies: 300,
        projectiles: 64,
        pulses: 8,
        pickups: 436,
        sheep: 5,
        corpses: 64,
        visualTicks: new Map([['tests', 8]]),
        hazards: FAKE_HAZARD_CAPACITY,
      },
    },
    { visible: 1, placeholder: 0 },
  );
}

const view = (s: RunSnapshot) => ({
  x: s.player.x - 640,
  y: s.player.y - 360,
  width: 1280,
  height: 720,
});

describe('Sonda de render · decoración (0029)', () => {
  it('Scenario: Recuento de la decoración sin una hoja (Deco/18.png: no pintadas = espantapájaros)', () => {
    const run = startSeededRun(CONFIG, 42);
    const full = planFor(run.map, 42);
    const plan = planFor(run.map, 42, ['Deco/18.png']);
    const layers = layersFor();
    const { canvas, objects } = canvasDouble();
    layers.paintMap(canvas, plan);
    const scarecrows = full.decor.filter((d) => d.file === 'Deco/18.png').length;
    expect(layers.counts.mapArt.decor).toEqual({
      planned: full.decor.length,
      painted: full.decor.length - scarecrows,
      unpainted: scarecrows,
    });
    expect(layers.counts.mapArt.objects).toBe(full.objects - 2 * scarecrows);
    expect(objects.some((o) => o.texture === 'Deco/18.png')).toBe(false);
  });

  it('Scenario: Partida nueva y menú (R con la 43: solo su decoración; menú: 0)', () => {
    const layers = layersFor();
    const { canvas, objects } = canvasDouble();
    const run42 = startSeededRun(CONFIG, 42);
    layers.paintMap(canvas, planFor(run42.map, 42));
    layers.render(run42.snapshot());
    layers.cullMap(view(run42.snapshot()));
    const run43 = startSeededRun(CONFIG, 43);
    const plan43 = planFor(run43.map, 43);
    layers.clear();
    layers.paintMap(canvas, plan43);
    layers.render(run43.snapshot());
    const painted = objects.filter((o) => o.texture.startsWith('Deco/')).length;
    expect(painted).toBe(plan43.decor.reduce((n, d) => n + d.pieces, 0));
    expect(layers.counts.mapArt.decor.planned).toBe(plan43.decor.length);
    expect(objects).toHaveLength(plan43.objects);
    expect(emptyCounts(['goblin-torch']).mapArt.decor).toEqual({
      planned: 0,
      painted: 0,
      unpainted: 0,
    });
  });

  it('Scenario: Mapa vacío (0 decoraciones en la sonda)', () => {
    const run = startSeededRun(CONFIG, 42, 'empty');
    const layers = layersFor();
    layers.paintMap(canvasDouble().canvas, planFor(run.map, 42));
    expect(layers.counts.mapArt.decor).toEqual({ planned: 0, painted: 0, unpainted: 0 });
    expect([layers.counts.mapArt.objects, layers.counts.mapArt.drawn]).toEqual([0, 0]);
  });

  it('Scenario: Recuento coherente con el snapshot (recuentos de decoración iguales en 600 frames)', () => {
    const run = startSeededRun(CONFIG, 42);
    const layers = layersFor();
    const { canvas } = canvasDouble();
    layers.paintMap(canvas, planFor(run.map, 42));
    const first = JSON.stringify(layers.counts.mapArt.decor);
    const inputs = randomInputs(600, 5);
    const seen = new Set<string>();
    for (const input of inputs) {
      chooseFirstWhileOpen(run);
      run.tick(input);
      const s = run.snapshot();
      layers.advance(FRAME_MS, false);
      layers.render(s);
      layers.cullMap(view(s));
      seen.add(JSON.stringify(layers.counts.mapArt.decor));
    }
    expect([...seen]).toEqual([first]);
  });
});

describe('Invariancia de la simulación con el mapa pintado (0029)', () => {
  /** 1.200 ticks de la 42 con las capas pintando el mapa en cada frame (o sin capas). */
  const play = (paint: ((s: RunSnapshot) => void) | null) => {
    const run = startSeededRun(CONFIG, 42);
    const out: string[] = [];
    for (const input of randomInputs(1200, 29)) {
      chooseFirstWhileOpen(run);
      run.tick(input);
      const s = run.snapshot();
      paint?.(s);
      out.push(JSON.stringify(s));
    }
    return out;
  };
  const painter = (missing: readonly string[]) => {
    const layers = layersFor();
    const d = canvasDouble();
    layers.paintMap(d.canvas, planFor(startSeededRun(CONFIG, 42).map, 42, missing));
    const paint = (s: RunSnapshot) => {
      layers.advance(FRAME_MS, false);
      layers.render(s);
      layers.cullMap(view(s));
    };
    return { paint, frames: d.frames };
  };

  it('Scenario: Pintar la decoración no cambia la simulación (con capas y con las 11 hojas sin cargar)', () => {
    const bare = play(null);
    const withArt = painter([]);
    expect(play(withArt.paint)).toEqual(bare);
    expect(play(painter(DECOR_SHEETS).paint)).toEqual(bare);
  });

  it('Scenario: Animar no cambia la simulación (las capas animan árboles y torres; snapshots iguales)', () => {
    const bare = play(null);
    const animated = painter([]);
    expect(play(animated.paint)).toEqual(bare);
    expect(animated.frames()).toBeGreaterThan(0);
  });
});
