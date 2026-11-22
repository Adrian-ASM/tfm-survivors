import { describe, expect, it } from 'vitest';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { PLACEHOLDER_SIZE, PLACEHOLDER_TEXTURE } from '../../src/infrastructure/phaser/art/looks';
import { PlayerView } from '../../src/infrastructure/phaser/PlayerView';
import { playerVisible } from '../../src/infrastructure/phaser/playerBlink';
import { ARCHER_FILE } from '../support/appearance';
import { fakeKit } from '../support/FakeSprite';
import { someLooks } from '../support/looks';

// Spec sprite-rendering: animación por estado, orientación y parpadeo del jugador (change 0012).
const FRAME_MS = 16.667;
const IDLE = [0, 1];
const WALK = [6, 7, 8, 9];

type PlayerSnap = Pick<RunSnapshot, 'tick' | 'status' | 'player'>;
const snap = (
  tick: number,
  x: number,
  y = 270,
  opts: { invulnerable?: boolean; status?: RunSnapshot['status'] } = {},
): PlayerSnap => ({
  tick,
  status: opts.status ?? 'running',
  player: {
    x,
    y,
    radius: 16,
    health: 50,
    maxHealth: 100,
    invulnerable: opts.invulnerable ?? false,
  },
});

function view(missing: readonly string[] = []) {
  const kit = fakeKit();
  const looks = someLooks(() => undefined, missing);
  const v = new PlayerView(kit, looks.player);
  const sprite = kit.created[0];
  if (!sprite) throw new Error('PlayerView no creó su sprite');
  return { v, sprite };
}

describe('PlayerView', () => {
  it('Scenario: Quieto y andando (30 frames quieto: idle; 30 con input (1, 0): walk)', () => {
    const { v, sprite } = view();
    const frames: number[] = [];
    let ms = 0;
    for (let k = 0; k < 60; k++) {
      const x = k < 30 ? 480 : 480 + 3.333 * (k - 29);
      v.render(snap(k, x), ms);
      frames.push(sprite.frame);
      ms += FRAME_MS;
    }
    expect(frames.slice(0, 30).every((f) => IDLE.includes(f))).toBe(true);
    expect(frames.slice(30).every((f) => WALK.includes(f))).toBe(true);
    expect([sprite.texture, sprite.visible, sprite.scale]).toEqual([ARCHER_FILE, true, 0.5]);
  });

  it('Scenario: Parpadeo con sprite animado (periodo 4, invulnerable 1..30, andando)', () => {
    const { v, sprite } = view();
    v.render(snap(0, 480), 0);
    for (let t = 1; t <= 30; t++) {
      const s = snap(t, 480 + 3 * t, 270, { invulnerable: true });
      v.render(s, t * FRAME_MS);
      expect(sprite.visible).toBe(playerVisible(s));
      expect(v.counts.visible).toBe(playerVisible(s) ? 1 : 0);
      if (sprite.visible) expect(WALK).toContain(sprite.frame);
    }
  });

  it('Scenario: Partida terminada (andando y derrota en el tick n: idle y visible)', () => {
    const { v, sprite } = view();
    for (let t = 0; t < 10; t++) v.render(snap(t, 480 + 3 * t), t * FRAME_MS);
    expect(WALK).toContain(sprite.frame);
    v.render(snap(10, 520, 270, { status: 'over', invulnerable: true }), 10 * FRAME_MS);
    expect(IDLE).toContain(sprite.frame);
    expect(sprite.visible).toBe(true);
  });

  it('Scenario: Primer frame de una partida nueva (miraba a la izquierda; tras R, sin voltear)', () => {
    const { v, sprite } = view();
    for (let t = 0; t < 5; t++) v.render(snap(t, 480 - 3 * t), t * FRAME_MS);
    expect(sprite.flipX).toBe(true);
    v.reset();
    v.render(snap(0, 480), 5 * FRAME_MS);
    expect([sprite.flipX, sprite.frame]).toEqual([false, IDLE[0]]);
  });

  it('Scenario: Frames sin tick (120 Hz: walk sin voltear en los 120)', () => {
    const { v, sprite } = view();
    const ok: boolean[] = [];
    for (let f = 0; f < 120; f++) {
      const tick = Math.floor(f / 2);
      v.render(snap(tick, 480 + 3 * tick), f * 8.333);
      if (f >= 2) ok.push(WALK.includes(sprite.frame) && !sprite.flipX);
    }
    expect(ok.every(Boolean)).toBe(true);
  });

  it('aspecto de reserva: disco de diámetro 2r con el color del aspecto', () => {
    const { v, sprite } = view([ARCHER_FILE]);
    v.render(snap(0, 480), 0);
    expect(sprite.texture).toBe(PLACEHOLDER_TEXTURE);
    expect(sprite.scale * PLACEHOLDER_SIZE).toBeCloseTo(32, 3);
    expect(sprite.tint).toBe(0x4cc38a);
    expect(v.counts.placeholder).toBe(1);
  });
});
