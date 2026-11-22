import { describe, expect, it } from 'vitest';
import { parseAppearance } from '../../src/infrastructure/content/loadAppearance';
import {
  PLACEHOLDER_SIZE,
  PLACEHOLDER_TEXTURE,
  lookOrigin,
  lookScale,
  resolveLooks,
} from '../../src/infrastructure/phaser/art/looks';
import { REGISTERED, TNT_FILE, TORCH_FILE, rawAppearance } from '../support/appearance';

// Spec sprite-rendering, "Aspecto de reserva ante un fallo de carga" (change 0012, design "Fallback").
function appearance(edit: (raw: ReturnType<typeof rawAppearance>) => void = () => undefined) {
  const raw = rawAppearance();
  edit(raw);
  const r = parseAppearance(raw, REGISTERED);
  if (!r.ok) throw new Error(`${r.error.field}: ${r.error.message}`);
  return r.value;
}

/** Todas las hojas cargadas con muchos frames, salvo las que se indiquen. */
const loaded =
  (counts: Record<string, number | null> = {}) =>
  (key: string): number | null =>
    key in counts ? (counts[key] ?? null) : 100;

describe('resolveLooks', () => {
  it('con todas las hojas cargadas, cada aspecto usa su hoja, escala, origen y orientación', () => {
    const looks = resolveLooks(appearance(), loaded());
    const torch = looks.enemies.get('goblin-torch');
    expect(torch).toMatchObject({ texture: TORCH_FILE, placeholder: false, scale: 0.5 });
    expect(torch && lookOrigin(torch)).toEqual({ x: 0.5, y: 0.5 });
    expect(looks.player.placeholder).toBe(false);
    expect(looks.corpse.death.frames).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('Scenario: Frame fuera de la hoja (32 × 32 en 128 × 32, walk [0, 1, 2, 7])', () => {
    const a = appearance((raw) => {
      const tnt = raw.enemies['goblin-tnt'] ?? {};
      tnt.sheet = { file: TNT_FILE, frameWidth: 32, frameHeight: 32 };
      tnt.walk = { frames: [0, 1, 2, 7], fps: 10, loop: true };
    });
    const looks = resolveLooks(a, loaded({ [TNT_FILE]: 4 }));
    expect(looks.enemies.get('goblin-tnt')).toMatchObject({
      texture: PLACEHOLDER_TEXTURE,
      placeholder: true,
    });
    expect(looks.enemies.get('goblin-torch')?.placeholder).toBe(false);
  });

  it('Scenario: Hoja que no carga (solo su aspecto pasa a reserva)', () => {
    const looks = resolveLooks(appearance(), loaded({ [TORCH_FILE]: null }));
    expect(looks.enemies.get('goblin-torch')?.placeholder).toBe(true);
    expect(looks.enemies.get('goblin-tnt')?.placeholder).toBe(false);
    expect(looks.enemies.get('goblin-barrel')?.placeholder).toBe(false);
  });

  it('Scenario: Tamaño del aspecto de reserva (radio 10 ⇒ 20 px, centrado, sin voltear)', () => {
    const looks = resolveLooks(appearance(), loaded({ [TORCH_FILE]: null }));
    const torch = looks.enemies.get('goblin-torch');
    if (!torch) throw new Error('falta goblin-torch');
    expect(lookScale(torch, 10) * PLACEHOLDER_SIZE).toBeCloseTo(20, 3);
    expect(lookOrigin(torch)).toEqual({ x: 0.5, y: 0.5 });
    expect(torch.flips).toBe(false);
    expect(torch.color).toBe(0xe5484d);
  });

  it('con arte, la escala no depende del radio', () => {
    const looks = resolveLooks(appearance(), loaded());
    const tnt = looks.enemies.get('goblin-tnt');
    if (!tnt) throw new Error('falta goblin-tnt');
    expect([lookScale(tnt, 22), lookScale(tnt, 30)]).toEqual([0.5, 0.5]);
    expect(tnt.flips).toBe(true);
  });

  it('el cadáver sin hoja conserva su animación de muerte (para su duración)', () => {
    const a = appearance();
    const looks = resolveLooks(a, loaded({ [a.corpse.sheet.file]: null }));
    expect(looks.corpse.placeholder).toBe(true);
    expect(looks.corpse.death.frames).toHaveLength(6);
  });
});
