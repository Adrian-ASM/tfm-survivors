import { describe, expect, it } from 'vitest';
import { parseAppearance } from '../../src/infrastructure/content/loadAppearance';
import {
  addBridgeFrames,
  applyNearest,
  finishBoot,
  iconImagesOf,
  imagesToLoad,
  nextSceneKey,
  sheetsToLoad,
  uiImagesOf,
  type FilterBook,
  type TextureBook,
} from '../../src/infrastructure/phaser/bootPlan';
import { ICON_DIR } from '../../src/infrastructure/content/appearanceSchema';
import { iconKey } from '../../src/infrastructure/icons/upgradeIcons';
import { FONT_WAIT_MS, withDeadline } from '../../src/infrastructure/dom/uiFont';
import { TestTimer, flush } from '../support/testTimer';
import { BRIDGE_FRAME_NAMES } from '../../src/infrastructure/phaser/map/mapLooks';
import { GAME_SCENE_KEY, MENU_SCENE_KEY } from '../../src/infrastructure/phaser/sceneKeys';
import {
  BRIDGE_FILE,
  CASTLE_FILE,
  DECOR_FILES,
  DECOR_SCARECROW_FILE,
  TOWER_FILE,
  REGISTERED,
  UI_FILES,
  TORCH_FILE,
  GOLD_SPAWN_FILE,
  MEAT_SPAWN_FILE,
  WOOD_SPAWN_FILE,
  rawAppearance,
  withPickupMotion,
} from '../support/appearance';
import { GENERATED_PATHS } from '../support/generated';

// Spec sprite-rendering "Carga del arte compatible con la CSP" (parte unitaria, design D3).
function appearance(edit: (raw: ReturnType<typeof rawAppearance>) => void = () => undefined) {
  const raw = rawAppearance();
  edit(raw);
  const r = parseAppearance(raw, REGISTERED, GENERATED_PATHS);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe('BootScene · plan de carga', () => {
  it('una carga por hoja distinta, con la clave = file y el tamaño de frame del aspecto', () => {
    const sheets = sheetsToLoad(appearance());
    // 8 de entidades y fondo + dinamita y explosión (0020) + agua, espuma, árbol y castillo (la orilla
    // comparte la del fondo) + casa y torre, intactas y en ruina (0021). 0022: la gema pasa a forma de
    // color (sin hoja), su bolsa es la del oro y se suman la madera y las dos vetas: 18 + 3 = 21.
    // 0023: más la carne (M_Idle) y las dos hojas de la oveja (idle y bounce) = 24.
    // 0025: más las tres rocas de la piedra (Deco/04–06) = 27. 0026: más obra, casa y torre = 30.
    // 0029: más las 11 hojas de la decoración = 41.
    expect(sheets).toHaveLength(41);
    expect(new Set(sheets.map((s) => s.key)).size).toBe(41);
    expect(sheets.find((s) => s.key === DECOR_SCARECROW_FILE)).toEqual({
      key: DECOR_SCARECROW_FILE,
      file: DECOR_SCARECROW_FILE,
      frameWidth: 192,
      frameHeight: 192,
    });
    expect(DECOR_FILES.every((f) => sheets.some((s) => s.key === f))).toBe(true);
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

  it('0030: las hojas de aparición de oro, madera y carne se cargan una vez cada una', () => {
    const sheets = sheetsToLoad(
      appearance((raw) => {
        withPickupMotion(raw);
      }),
    );
    expect(sheets).toHaveLength(44);
    for (const file of [GOLD_SPAWN_FILE, WOOD_SPAWN_FILE, MEAT_SPAWN_FILE]) {
      expect(sheets.filter((s) => s.key === file)).toEqual([
        { key: file, file, frameWidth: 128, frameHeight: 128 },
      ]);
    }
  });

  it('una decoración con la hoja de otro aspecto la carga una vez', () => {
    const a = appearance((raw) => {
      const decor = raw.map.decor as { items: { sheet: { file: string } }[] };
      const first = decor.items[0];
      if (first) first.sheet.file = TORCH_FILE;
    });
    expect(sheetsToLoad(a).filter((s) => s.key === TORCH_FILE)).toHaveLength(1);
    expect(sheetsToLoad(a)).toHaveLength(40);
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
    expect(imagesToLoad(appearance())[0]).toEqual({ key: BRIDGE_FILE, file: BRIDGE_FILE });
  });

  it('0032: las 8 piezas de UI se cargan como imágenes enteras, clave = image', () => {
    const ui = uiImagesOf(appearance());
    expect(ui.map((i) => i.file)).toEqual(UI_FILES);
    expect(ui.every((i) => i.key === i.file)).toBe(true);
    expect(imagesToLoad(appearance())).toEqual([{ key: BRIDGE_FILE, file: BRIDGE_FILE }, ...ui]);
  });
});

// Spec sprite-rendering (0032): el menú nace tras la carga y tras la fuente o su plazo de 3.000 ms.
describe('BootScene · final del arranque con la fuente (finishBoot)', () => {
  function boot(fontReady: Promise<boolean>, missing: readonly string[] = []) {
    const events: string[] = [];
    const failed: string[] = [];
    let loaded: ReadonlySet<string> | null = null;
    const done = finishBoot({
      fontReady,
      fontFamily: 'Departure Mono',
      uiKeys: UI_FILES,
      exists: (key) => !missing.includes(key),
      fail: (key) => failed.push(key),
      onUiLoaded: (l) => {
        loaded = l;
        events.push('ui');
      },
      start: () => events.push('start'),
    });
    return { events, failed, done, loaded: () => loaded };
  }

  it('Scenario: Fuente que no responde (el menú se crea como muy tarde a los 3.000 ms)', async () => {
    const clock = new TestTimer();
    const fontReady = withDeadline(
      new Promise<boolean>(() => undefined),
      FONT_WAIT_MS,
      clock.timer,
    );
    const b = boot(fontReady);
    await clock.advance(2999);
    expect(b.events).toEqual([]);
    await clock.advance(1);
    expect(b.events).toEqual(['ui', 'start']);
    expect(b.failed).toEqual(['Departure Mono']);
  });

  it('Scenario: Fuente que no carga (se crea el menú sin errores; la familia en failed)', async () => {
    const b = boot(Promise.resolve(false));
    await b.done;
    expect(b.events).toEqual(['ui', 'start']);
    expect(b.failed).toEqual(['Departure Mono']);
  });

  it('una promesa de fuente que rechaza no rompe el arranque', async () => {
    const b = boot(Promise.reject(new Error('x')));
    await expect(b.done).resolves.toBeUndefined();
    expect(b.events).toEqual(['ui', 'start']);
  });

  it('con la fuente cargada: avisa de las piezas cuya textura existe y arranca', async () => {
    const missing = [UI_FILES[0] ?? ''];
    const b = boot(Promise.resolve(true), missing);
    await b.done;
    expect(b.failed).toEqual([]);
    expect([...(b.loaded() ?? [])]).toEqual(UI_FILES.slice(1));
    expect(b.events).toEqual(['ui', 'start']);
  });

  it('nunca antes de la carga: sin resolver la fuente no arranca', async () => {
    const b = boot(new Promise<boolean>(() => undefined));
    await flush();
    expect(b.events).toEqual([]);
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

// Spec sprite-rendering (0034), "Carga y escalado de los iconos" (design D5). Iconos de prueba (la
// sección real llega en la tarea 6.1).
describe('BootScene · iconos de mejora (0034)', () => {
  const ICONS = {
    fallback: { character: 'fallback-character.png', weapon: 'fallback-weapon.png' },
    byId: { armor: 'armor.png', guardrail: 'guardrail.png', hunter: 'armor.png' },
  };
  const FILES = ['fallback-character.png', 'fallback-weapon.png', 'armor.png', 'guardrail.png'];
  const withIcons = () => {
    const raw = rawAppearance();
    raw.icons = structuredClone(ICONS);
    const r = parseAppearance(
      raw,
      REGISTERED,
      FILES.map((f) => ICON_DIR + f),
    );
    if (!r.ok) throw new Error(r.error.message);
    return r.value;
  };
  /** Texturas dobles: existen las de `present`; anota a cuáles se aplica NEAREST. */
  function filters(present: readonly string[]): FilterBook & { nearest: string[] } {
    const nearest: string[] = [];
    return {
      nearest,
      exists: (key) => present.includes(key),
      setNearest: (key) => {
        nearest.push(key);
      },
    };
  }

  it('una imagen por fichero distinto de byId y de las reservas, con clave icon:<file>', () => {
    const icons = iconImagesOf(withIcons());
    expect(icons.map((i) => i.file).sort()).toEqual([...FILES].sort());
    expect(icons.every((i) => i.key === iconKey(i.file))).toBe(true);
  });

  it('con los datos del repositorio se piden las 16 + 2 imágenes', () => {
    expect(iconImagesOf(appearance())).toHaveLength(18);
  });

  it('Scenario: Filtro sin suavizado (cada textura de icono y de reserva con NEAREST)', () => {
    const keys = iconImagesOf(withIcons()).map((i) => i.key);
    const book = filters(keys);
    const loaded = applyNearest(book, keys);
    expect(book.nearest.sort()).toEqual([...keys].sort());
    expect([...loaded].sort()).toEqual([...keys].sort());
  });

  it('Scenario: Icono que falla sin reserva de sprites (claves aparte; el fallo no lanza)', () => {
    const a = withIcons();
    const keys = iconImagesOf(a).map((i) => i.key);
    // Ninguna clave de icono es la de una hoja, una imagen del mapa o una pieza de UI.
    const art = new Set([...sheetsToLoad(a), ...imagesToLoad(a)].map((s) => s.key));
    expect(keys.some((k) => art.has(k))).toBe(false);
    // Con los iconos sin cargar no se filtra nada y no se informa de ninguno como cargado.
    const failed = [iconKey('armor.png'), iconKey('fallback-character.png')];
    const book = filters(keys.filter((k) => !failed.includes(k)));
    let loaded = new Set<string>();
    expect(() => (loaded = applyNearest(book, keys))).not.toThrow();
    expect(failed.some((k) => loaded.has(k) || book.nearest.includes(k))).toBe(false);
    expect(loaded.size).toBe(keys.length - failed.length);
  });
});
