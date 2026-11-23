import { describe, expect, it } from 'vitest';
import { createPlayfield, type GroundFactory } from '../../src/infrastructure/phaser/GroundView';
import type { RingSprite } from '../../src/infrastructure/phaser/PulseLayer';
import { emptyCounts } from '../../src/infrastructure/phaser/renderCounts';
import {
  paintTerrain,
  terrainFills,
  type TerrainCanvas,
} from '../../src/infrastructure/phaser/TerrainView';
import { aDefaultConfig } from '../support/builders';
import { fakeKit } from '../support/FakeSprite';
import { someLooks } from '../support/looks';
import { mapRules, mapWith } from '../support/mapLayouts';
import { toMapSnapshot } from '../../src/domain/map/MapSnapshot';
import { GameMap } from '../../src/domain/map/GameMap';

// Spec sprite-rendering (0015), "Pintado del mapa".
const WORLD = aDefaultConfig().arena;
const COLORS = { trunk: 0x5b3a1e, water: 0x2f7fc1, bridge: 0xc19a5b };

/** Lienzo falso: registra lo pintado. */
function fakeCanvas(log: string[] = []): TerrainCanvas & { log: string[] } {
  return {
    log,
    clear: () => log.push('clear'),
    rect: (x, y, w, h, color) =>
      log.push(`rect ${String(x)},${String(y)} ${String(w)}x${String(h)} ${color.toString(16)}`),
  };
}

describe('terrainFills y paintTerrain', () => {
  it('Scenario: Celda pintada en su sitio y en su capa (sitio: (600, 240)–(660, 300), trunk)', () => {
    const map = toMapSnapshot(mapWith(mapRules(), { '10,4': 'trunk' }));
    const { fills, counts } = terrainFills(map, COLORS, WORLD);
    expect(fills).toEqual([
      { col: 10, row: 4, color: COLORS.trunk, x: 600, y: 240, width: 60, height: 60 },
    ]);
    expect(counts).toEqual({ trunk: 1, water: 0, bridge: 0 });
  });

  it('una celda de la última columna de un mundo no múltiplo se recorta al mundo', () => {
    const map = toMapSnapshot(mapWith(mapRules(undefined, 4000, 4000), { '66,0': 'water' }));
    const [fill] = terrainFills(map, COLORS, { width: 4000, height: 4000 }).fills;
    expect([fill?.x, fill?.width]).toEqual([3960, 40]);
  });

  // Incidente de fps en CI (PR #36): nada de una capa del tamaño del mundo; solo rectángulos de las
  // celdas no-hierba, con las celdas contiguas del mismo tipo de una fila unidas en uno.
  it('paintTerrain borra y pinta solo las celdas no-hierba, uniendo tramos de una fila', () => {
    const map = toMapSnapshot(
      mapWith(mapRules(), {
        '0,0': 'trunk',
        '1,0': 'trunk',
        '2,0': 'water',
        '4,0': 'water',
        '1,1': 'trunk',
        '2,3': 'bridge',
      }),
    );
    const canvas = fakeCanvas();
    const counts = paintTerrain(canvas, map, COLORS, WORLD);
    const hex = (c: number) => c.toString(16);
    expect(canvas.log).toEqual([
      'clear',
      `rect 0,0 120x60 ${hex(COLORS.trunk)}`,
      `rect 120,0 60x60 ${hex(COLORS.water)}`,
      `rect 240,0 60x60 ${hex(COLORS.water)}`,
      `rect 60,60 60x60 ${hex(COLORS.trunk)}`,
      `rect 120,180 60x60 ${hex(COLORS.bridge)}`,
    ]);
    expect(counts).toEqual({ trunk: 3, water: 2, bridge: 1 });
  });

  it('Scenario: Mapa vacío (ningún rectángulo: sin coste de relleno)', () => {
    const canvas = fakeCanvas();
    paintTerrain(canvas, toMapSnapshot(GameMap.open(mapRules())), COLORS, WORLD);
    expect(canvas.log).toEqual(['clear']);
  });

  it('Scenario: Mapa vacío (0 celdas pintadas de cada tipo)', () => {
    const map = toMapSnapshot(GameMap.open(mapRules()));
    expect(paintTerrain(fakeCanvas(), map, COLORS, WORLD)).toEqual({
      trunk: 0,
      water: 0,
      bridge: 0,
    });
  });
});

describe('Capa del mapa en el área de juego', () => {
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
      () => {
        log.push('terrain');
        return fakeCanvas();
      },
    );
    return { log, ...made };
  }

  it('Scenario: Celda pintada en su sitio y en su capa (capa: tras el fondo, antes del resto)', () => {
    const { log } = playfield();
    expect(log.slice(0, 2)).toEqual(['ground', 'terrain']);
    expect(log.slice(2).every((m) => m === 'ring' || m === 'sprite')).toBe(true);
  });

  it('la sonda cuenta las celdas pintadas y no las cuenta como fondo ni reserva', () => {
    const { layers, terrain } = playfield();
    const map = toMapSnapshot(mapWith(mapRules(), { '10,4': 'trunk', '3,3': 'water' }));
    layers.paintMap(terrain, map, COLORS, WORLD);
    expect(layers.counts.cells).toEqual({ trunk: 1, water: 1, bridge: 0 });
    expect(layers.counts.ground).toEqual({ visible: 1, placeholder: 0 });
  });

  it('Scenario: Sonda en el menú (celdas a 0)', () => {
    expect(emptyCounts(['goblin-torch']).cells).toEqual({ trunk: 0, water: 0, bridge: 0 });
  });
});
