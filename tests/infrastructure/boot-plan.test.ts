import { describe, expect, it } from 'vitest';
import { parseAppearance } from '../../src/infrastructure/content/loadAppearance';
import {
  addBridgeFrames,
  imagesToLoad,
  nextSceneKey,
  sheetsToLoad,
  type TextureBook,
} from '../../src/infrastructure/phaser/bootPlan';
import { BRIDGE_FRAME_NAMES } from '../../src/infrastructure/phaser/map/mapLooks';
import { GAME_SCENE_KEY, MENU_SCENE_KEY } from '../../src/infrastructure/phaser/sceneKeys';
import {
  BRIDGE_FILE,
  CASTLE_FILE,
  TOWER_FILE,
  REGISTERED,
  TORCH_FILE,
  rawAppearance,
} from '../support/appearance';

// Spec sprite-rendering "Carga del arte compatible con la CSP" (parte unitaria, design D3).
function appearance(edit: (raw: ReturnType<typeof rawAppearance>) => void = () => undefined) {
  const raw = rawAppearance();
  edit(raw);
  const r = parseAppearance(raw, REGISTERED);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe('BootScene · plan de carga', () => {
  it('una carga por hoja distinta, con la clave = file y el tamaño de frame del aspecto', () => {
    const sheets = sheetsToLoad(appearance());
    // 8 de entidades y fondo + dinamita y explosión (0020) + agua, espuma, árbol y castillo (la orilla
    // comparte la del fondo) + casa y torre, intactas y en ruina (0021).
    expect(sheets).toHaveLength(18);
    expect(new Set(sheets.map((s) => s.key)).size).toBe(18);
    expect(sheets.find((s) => s.key === TOWER_FILE)).toMatchObject({
      frameWidth: 256,
      frameHeight: 192,
    });
    expect(sheets.find((s) => s.key === CASTLE_FILE)).toEqual({
      key: CASTLE_FILE,
      file: CASTLE_FILE,
      frameWidth: 320,
      frameHeight: 256,
    });
    expect(sheets.some((s) => s.key === BRIDGE_FILE)).toBe(false);
    expect(sheets.find((s) => s.key === TORCH_FILE)).toEqual({
      key: TORCH_FILE,
      file: TORCH_FILE,
      frameWidth: 192,
      frameHeight: 192,
    });
  });

  it('dos aspectos con la misma hoja la cargan una vez', () => {
    const a = appearance((raw) => {
      const tnt = raw.enemies['goblin-tnt'] ?? {};
      tnt.sheet = { file: TORCH_FILE, frameWidth: 192, frameHeight: 192 };
    });
    expect(sheetsToLoad(a).filter((s) => s.key === TORCH_FILE)).toHaveLength(1);
  });

  it('Scenario: Con e2e (arranca la partida sin pasar por el menú; sin e2e, el menú)', () => {
    expect([nextSceneKey(true), nextSceneKey(false)]).toEqual([GAME_SCENE_KEY, MENU_SCENE_KEY]);
  });

  it('la imagen del puente se carga como imagen (hoja no regular)', () => {
    expect(imagesToLoad(appearance())).toEqual([{ key: BRIDGE_FILE, file: BRIDGE_FILE }]);
  });
});

// Spec sprite-rendering (0016): marcos con nombre del puente añadidos solo si caben en la imagen.
describe('BootScene · marcos del puente', () => {
  /** Libro de texturas doble: tamaño de cada imagen cargada y marcos añadidos. */
  function book(sizes: Record<string, { width: number; height: number }>) {
    const added: string[] = [];
    const textures: TextureBook = {
      size: (key) => sizes[key] ?? null,
      add: (key, name, r) => {
        added.push(
          `${key}#${name}@${String(r.x)},${String(r.y)},${String(r.width)}x${String(r.height)}`,
        );
      },
    };
    return { textures, added };
  }

  it('con la imagen cargada añade los dos marcos con nombre', () => {
    const { textures, added } = book({ [BRIDGE_FILE]: { width: 192, height: 256 } });
    addBridgeFrames(textures, appearance());
    expect(added).toEqual([
      `${BRIDGE_FILE}#${BRIDGE_FRAME_NAMES.northSouth}@0,80,64x160`,
      `${BRIDGE_FILE}#${BRIDGE_FRAME_NAMES.eastWest}@16,0,160x64`,
    ]);
  });

  it('Scenario: Recorte del puente fuera de la hoja (x 400, ancho 64 sobre 384 px: no se añade)', () => {
    const a = appearance((raw) => {
      const bridges = raw.map.bridges as { frames: Record<string, Record<string, number>> };
      bridges.frames.northSouth = { x: 400, y: 0, width: 64, height: 64 };
    });
    const { textures, added } = book({ [BRIDGE_FILE]: { width: 384, height: 256 } });
    addBridgeFrames(textures, a);
    expect(added).toEqual([`${BRIDGE_FILE}#${BRIDGE_FRAME_NAMES.eastWest}@16,0,160x64`]);
  });

  it('Scenario: Hojas del mapa bloqueadas (sin imagen del puente: nada que añadir, sin errores)', () => {
    const { textures, added } = book({});
    expect(() => {
      addBridgeFrames(textures, appearance());
    }).not.toThrow();
    expect(added).toEqual([]);
  });
});
