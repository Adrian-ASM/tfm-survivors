import { describe, expect, it } from 'vitest';
import { parseAppearance } from '../../src/infrastructure/content/loadAppearance';
import { PLACEHOLDER_TEXTURE, resolveLooks } from '../../src/infrastructure/phaser/art/looks';
import {
  floatOffset,
  floatOffsetFrom,
  spawnDelay,
  spawnFrame,
} from '../../src/infrastructure/phaser/art/pickupMotion';
import {
  GOLD_FILE,
  GOLD_SPAWN_FILE,
  MEAT_FILE,
  MEAT_SPAWN_FILE,
  WOOD_FILE,
  WOOD_SPAWN_FILE,
  REGISTERED,
  rawAppearance,
  withPickupMotion,
} from '../support/appearance';
import { someLooks } from '../support/looks';

// Spec sprite-rendering (0030), "Flote de los recogibles" y "Aparición de oro, madera y carne": las
// funciones puras del reloj de render y la resolución de las vistas de aparición.
const F = { amplitude: 4, periodMs: 1600, phaseStepMs: 200 };
const SPAWN = { frames: [0, 1, 2, 3, 4, 5, 6], fps: 10, loop: false };
const EPS = 0.001;

describe('Flote de los recogibles (funciones)', () => {
  it('Scenario: Desplazamiento según el reloj (ids 0, 1 y 2 con R = 0, 400 y 1.200)', () => {
    const at = (ms: number) => [0, 1, 2].map((id) => 200 + floatOffset(F, id, ms));
    const expected = [
      [0, [200, 202.828, 204]],
      [400, [204, 202.828, 200]],
      [1200, [196, 197.172, 200]],
    ] as const;
    for (const [ms, ys] of expected) {
      at(ms).forEach((y, i) => {
        expect(Math.abs(y - (ys[i] ?? 0))).toBeLessThanOrEqual(EPS);
      });
    }
  });

  it('Scenario: Fases distintas con el mismo reloj (ids 0 y 4 con R = 400: 204 y 196)', () => {
    expect(200 + floatOffset(F, 0, 400)).toBeCloseTo(204, 3);
    expect(200 + floatOffset(F, 4, 400)).toBeCloseTo(196, 3);
  });

  it('el flote desde R_f vale 0 en R_f y sigue un seno sin fase por id', () => {
    expect(floatOffsetFrom(F, 1700, 1700)).toBeCloseTo(0, 6);
    expect(floatOffsetFrom(F, 1700, 1700 + 1000 / 60)).toBeCloseTo(0.262, 3);
    expect(floatOffsetFrom(F, 1700, 2100)).toBeCloseTo(4, 6);
    expect(floatOffsetFrom(F, 1700, 2500)).toBeCloseTo(0, 6);
  });

  it('con A 0 no flota; con s 0 todos los ids comparten fase', () => {
    expect(Math.abs(floatOffset({ ...F, amplitude: 0 }, 3, 777))).toBe(0);
    const same = { ...F, phaseStepMs: 0 };
    expect(floatOffset(same, 5, 400)).toBe(floatOffset(same, 0, 400));
  });

  it('dos llamadas iguales dan lo mismo (sin azar ni reloj del sistema)', () => {
    expect(floatOffset(F, 7, 1234.5)).toBe(floatOffset(F, 7, 1234.5));
  });
});

describe('Aparición de oro, madera y carne (funciones)', () => {
  it('frame de la aparición: primero en el retardo, k-ésimo mientras dura y null al terminar', () => {
    expect(spawnFrame(SPAWN, -50)).toBe(0);
    expect(spawnFrame(SPAWN, 0)).toBe(0);
    expect(spawnFrame(SPAWN, 150)).toBe(1);
    expect(spawnFrame(SPAWN, 350)).toBe(3);
    expect(spawnFrame(SPAWN, 650)).toBe(6);
    expect(spawnFrame(SPAWN, 699.999)).toBe(6);
    expect(spawnFrame(SPAWN, 700)).toBeNull();
    expect(spawnFrame({ ...SPAWN, frames: [4, 5] }, -1)).toBe(4);
  });

  it('retardo id · e solo en el primer pintado', () => {
    expect(spawnDelay(120, 7, true)).toBe(840);
    expect(spawnDelay(120, 20, false)).toBe(0);
    expect(spawnDelay(0, 7, true)).toBe(0);
  });
});

describe('Vistas de la aparición resueltas (looks)', () => {
  it('con todas las hojas: la aparición usa la hoja spawn con la escala y el origen de idle', () => {
    const looks = someLooks((r) => {
      withPickupMotion(r);
    });
    const files = { gold: GOLD_SPAWN_FILE, wood: WOOD_SPAWN_FILE, meat: MEAT_SPAWN_FILE };
    for (const [kind, file] of Object.entries(files) as [keyof typeof files, string][]) {
      const look = looks.pickups[kind];
      expect(look.spawn?.texture).toBe(file);
      expect(look.spawn?.idle.frames).toEqual(SPAWN.frames);
      expect([look.spawn?.scale, look.spawn?.origin]).toEqual([look.scale, look.origin]);
      expect(look.spawn?.placeholder).toBe(false);
    }
    expect([looks.pickups.xp.spawn, looks.pickups.stone.spawn]).toEqual([null, null]);
    expect(looks.pickupMotion.float).toEqual(F);
  });

  it('Scenario: Frame de aparición fuera de la hoja (spawn de meat 0..7 sobre 7 frames: idle M_Idle)', () => {
    const raw = rawAppearance();
    withPickupMotion(raw);
    (raw.pickups.meat as { spawn: { frames: number[] } }).spawn.frames = [0, 1, 2, 3, 4, 5, 6, 7];
    const parsed = parseAppearance(raw, REGISTERED);
    if (!parsed.ok) throw new Error(parsed.error.message);
    const looks = resolveLooks(parsed.value, (key) => (key === MEAT_SPAWN_FILE ? 7 : 100));

    expect(looks.pickups.meat.spawn).toBeNull();
    expect([looks.pickups.meat.texture, looks.pickups.meat.placeholder]).toEqual([
      MEAT_FILE,
      false,
    ]);
    expect(looks.pickups.gold.spawn?.texture).toBe(GOLD_SPAWN_FILE);
  });

  it('Scenario: Hoja idle que no carga con la aparición cargada (M_Idle sin cargar: reserva sin spawn)', () => {
    const looks = someLooks(
      (r) => {
        withPickupMotion(r);
      },
      [MEAT_FILE],
    );

    expect(looks.pickups.meat.spawn).toBeNull();
    expect([looks.pickups.meat.texture, looks.pickups.meat.placeholder]).toEqual([
      PLACEHOLDER_TEXTURE,
      true,
    ]);
    expect(looks.pickups.wood.spawn?.texture).toBe(WOOD_SPAWN_FILE);
  });

  it('Hoja de aparición que no carga (W_Spawn sin cargar: spawn null, W_Idle sin reserva)', () => {
    const looks = someLooks(
      (r) => {
        withPickupMotion(r);
      },
      [WOOD_SPAWN_FILE],
    );

    expect(looks.pickups.wood.spawn).toBeNull();
    expect([looks.pickups.wood.texture, looks.pickups.wood.placeholder]).toEqual([
      WOOD_FILE,
      false,
    ]);
    expect(looks.pickups.gold.spawn?.texture).toBe(GOLD_SPAWN_FILE);
    expect(looks.pickups.gold.texture).toBe(GOLD_FILE);
  });

  it('la gema sin hoja tiene el radio de su diámetro; los aspectos con hoja, ninguno', () => {
    const looks = someLooks((r) => ((r.pickups.xp as { diameter: number }).diameter = 20));
    expect(looks.pickups.xp.shapeRadius).toBe(10);
    expect([looks.pickups.gold.shapeRadius, looks.pickups.stone.shapeRadius]).toEqual([null, null]);
  });
});
