import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_SIZE, PLACEHOLDER_TEXTURE } from '../../src/infrastructure/phaser/art/looks';
import { CorpseLayer } from '../../src/infrastructure/phaser/CorpseLayer';
import { DEAD_FILE } from '../support/appearance';
import { fakeKit } from '../support/FakeSprite';
import { someLooks } from '../support/looks';

// Spec sprite-rendering, "Animación de muerte de los enemigos" (change 0012, design D6). El fixture
// tiene `death` de 6 frames a 15 fps (400 ms).
const FRAME_MS = 16.667;

function layer(maxCorpses: number, missing: string[] = []) {
  const kit = fakeKit();
  const looks = someLooks(() => undefined, missing);
  const l = new CorpseLayer(maxCorpses, kit, looks.corpse);
  return { l, sprites: kit.created };
}

const shown = (sprites: { visible: boolean }[]) => sprites.filter((s) => s.visible).length;

describe('CorpseLayer', () => {
  it('preasigna maxCorpses sprites ocultos', () => {
    const { sprites } = layer(64);
    expect([sprites.length, shown(sprites)]).toEqual([64, 0]);
  });

  it('Scenario: Muerte y desaparición (visible en los frames 1 a 23, ninguno desde el 26)', () => {
    const { l, sprites } = layer(64);
    let ms = 1000;
    expect(l.spawn(300, 200, false, 10)).toBe(true);
    const visibleAt: boolean[] = [];
    for (let frame = 1; frame <= 31; frame++) {
      l.sync(ms);
      visibleAt[frame] = shown(sprites) === 1;
      if (frame === 1) {
        expect([sprites[0]?.x, sprites[0]?.y, sprites[0]?.texture]).toEqual([300, 200, DEAD_FILE]);
      }
      ms += FRAME_MS;
    }
    expect(visibleAt.slice(1, 24).every(Boolean)).toBe(true);
    expect(visibleAt.slice(26).some(Boolean)).toBe(false);
    expect(l.counts.visible).toBe(0);
  });

  it('el primer frame de la animación es el primero de death y avanza sin bucle', () => {
    const { l, sprites } = layer(1);
    l.spawn(0, 0, false, 10);
    l.sync(0);
    expect(sprites[0]?.frame).toBe(1);
    l.sync(399);
    expect(sprites[0]?.frame).toBe(6);
  });

  it('Scenario: Tope de cadáveres (60 en curso y 7 bajas: 64; e5..e7 sin cadáver)', () => {
    const { l, sprites } = layer(64);
    for (let i = 0; i < 60; i++) l.spawn(i, 0, false, 10);
    l.sync(0);
    const results = Array.from({ length: 7 }, (_, i) => l.spawn(1000 + i, 0, false, 10));
    l.sync(FRAME_MS);
    expect(results).toEqual([true, true, true, true, false, false, false]);
    expect(shown(sprites)).toBe(64);
    expect(l.counts.visible).toBe(64);
  });

  it('Scenario: Tope de un cadáver (al primero le quedan 100 ms; la segunda baja no se ve)', () => {
    const { l, sprites } = layer(1);
    l.spawn(1, 1, false, 10);
    l.sync(0);
    l.sync(300);
    expect(l.spawn(2, 2, false, 10)).toBe(false);
    const counts: number[] = [];
    for (let f = 1; f <= 31; f++) {
      l.sync(300 + f * FRAME_MS);
      counts.push(shown(sprites));
      expect(sprites[0]?.x).toBe(1);
    }
    expect(counts.slice(0, 5).every((c) => c === 1)).toBe(true);
    expect(counts.slice(7).every((c) => c === 0)).toBe(true);
  });

  it('Scenario: Muerte con aspecto de reserva (disco del radio del enemigo, misma duración)', () => {
    const { l, sprites } = layer(4, [DEAD_FILE]);
    l.spawn(300, 200, false, 22);
    const visibleAt: boolean[] = [];
    for (let frame = 1; frame <= 31; frame++) {
      l.sync(frame * FRAME_MS);
      visibleAt[frame] = shown(sprites) === 1;
    }
    expect(sprites[0]?.texture).toBe(PLACEHOLDER_TEXTURE);
    expect((sprites[0]?.scale ?? 0) * PLACEHOLDER_SIZE).toBeCloseTo(44, 3);
    expect(visibleAt.slice(1, 24).every(Boolean)).toBe(true);
    expect(visibleAt.slice(26).some(Boolean)).toBe(false);
    expect(l.counts.placeholder).toBe(0);
  });

  it('voltea según el lado al que miraba el enemigo', () => {
    const { l, sprites } = layer(1);
    l.spawn(0, 0, true, 10);
    l.sync(0);
    expect(sprites[0]?.flipX).toBe(true);
  });

  it('clear() oculta todos y libera los huecos', () => {
    const { l, sprites } = layer(2);
    l.spawn(0, 0, false, 10);
    l.spawn(1, 1, false, 10);
    l.sync(0);
    l.clear();
    expect([shown(sprites), l.counts.visible]).toEqual([0, 0]);
    expect(l.spawn(2, 2, false, 10)).toBe(true);
  });
});
