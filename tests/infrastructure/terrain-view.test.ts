import { describe, expect, it } from 'vitest';
import { toMapSnapshot } from '../../src/domain/map/MapSnapshot';
import {
  createPlayfield,
  type GroundFactory,
  type MapArtLayers,
} from '../../src/infrastructure/phaser/GroundView';
import type { RingSprite } from '../../src/infrastructure/phaser/PulseLayer';
import { emptyCounts } from '../../src/infrastructure/phaser/renderCounts';
import type { MapArtCanvas } from '../../src/infrastructure/phaser/TerrainView';
import { aDefaultConfig } from '../support/builders';
import { fakeKit } from '../support/FakeSprite';
import { someLooks } from '../support/looks';
import { planFor } from '../support/mapArt';
import { mapRules, mapWith } from '../support/mapLayouts';
import { mapForSeed } from '../support/mapStats';

// Spec sprite-rendering (0016), "Capas del mapa y de las entidades" y "Sonda de render para E2E".
const WORLD = aDefaultConfig().arena;

/** Lienzo del mapa falso: no pinta nada. */
const quietCanvas = (): MapArtCanvas => ({
  clear: () => undefined,
  tiles: () => undefined,
  sprite: () => undefined,
  rect: () => undefined,
  foam: () => undefined,
});

/** Área de juego con fábricas falsas que registran el orden de creación (= orden de pintado). */
function playfield() {
  const log: string[] = [];
  const kit = fakeKit();
  const create = kit.create.bind(kit);
  const ground: GroundFactory = {
    tiles: () => log.push('ground'),
    rect: () => log.push('ground'),
  };
  const ring = (): RingSprite => {
    log.push('ring');
    return { setPosition: () => 0, setRadius: () => 0, setAlpha: () => 0, setVisible: () => 0 };
  };
  const mapArt: MapArtLayers = {
    low: () => log.push('map-low'),
    high: () => {
      log.push('map-high');
      return quietCanvas();
    },
  };
  const made = createPlayfield(
    {
      kit: {
        tint: kit.tint,
        create: () => {
          log.push('sprite');
          return create();
        },
      },
      ring,
      looks: someLooks(() => undefined),
      capacity: {
        enemies: 1,
        projectiles: 1,
        pulses: 1,
        gems: 1,
        corpses: 1,
        visualTicks: new Map(),
      },
    },
    ground,
    WORLD,
    mapArt,
  );
  return { log, ...made };
}

describe('Capas del mapa en el área de juego', () => {
  it('Scenario: Tronco y copa (capa baja tras el fondo y antes de las entidades; alta después)', () => {
    const { log } = playfield();
    expect(log.slice(0, 2)).toEqual(['ground', 'map-low']);
    expect(log.at(-1)).toBe('map-high');
    const entities = log.slice(2, -1);
    expect(entities.length).toBeGreaterThan(0);
    expect(entities.every((m) => m === 'ring' || m === 'sprite')).toBe(true);
  });

  it('Scenario: Proyectiles y gemas bajo las copas (todas las entidades entre las dos capas)', () => {
    const { log } = playfield();
    const high = log.indexOf('map-high');
    expect(log.lastIndexOf('sprite')).toBeLessThan(high);
    expect(log.lastIndexOf('ring')).toBeLessThan(high);
    expect(log.indexOf('map-low')).toBeLessThan(log.indexOf('sprite'));
  });

  it('la sonda cuenta las celdas y los elementos del mapa, no como fondo ni reserva', () => {
    const { layers, mapArt } = playfield();
    const plan = planFor(toMapSnapshot(mapForSeed(aDefaultConfig(), 42)));
    layers.paintMap(mapArt, plan);
    expect(layers.counts.cells).toEqual(plan.cells);
    expect(layers.counts.mapArt).toEqual({ ...plan.counts, objects: plan.objects });
    expect(layers.counts.ground).toEqual({ visible: 1, placeholder: 0 });
  });

  it('repintar con otro mapa sustituye los recuentos', () => {
    const { layers, mapArt } = playfield();
    layers.paintMap(mapArt, planFor(toMapSnapshot(mapForSeed(aDefaultConfig(), 42))));
    const empty = planFor(toMapSnapshot(mapWith(mapRules(), {})));
    layers.paintMap(mapArt, empty);
    expect(layers.counts.cells).toEqual({ trunk: 0, water: 0, bridge: 0, castle: 0 });
    expect(layers.counts.mapArt.objects).toBe(0);
  });

  it('Scenario: Sonda en el menú (celdas, elementos y objetos del mapa a 0)', () => {
    const counts = emptyCounts(['goblin-torch']);
    expect(counts.cells).toEqual({ trunk: 0, water: 0, bridge: 0, castle: 0 });
    const none = { painted: 0, fallback: 0 };
    expect(counts.mapArt).toEqual({
      water: none,
      shore: none,
      foam: none,
      tree: none,
      canopy: none,
      bridge: none,
      castle: none,
      objects: 0,
    });
  });
});
