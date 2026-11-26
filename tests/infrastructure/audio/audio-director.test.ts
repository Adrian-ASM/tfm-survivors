import { describe, expect, it } from 'vitest';
import type { HitSnapshot, RunSnapshot } from '../../../src/domain/run/RunSnapshot';
import { AudioCues } from '../../../src/infrastructure/audio/audioCues';
import { AudioDirector } from '../../../src/infrastructure/audio/AudioDirector';
import { EffectMixer } from '../../../src/infrastructure/audio/EffectMixer';
import { musicState } from '../../../src/infrastructure/audio/musicState';
import { aDefaultConfig, TICK_MS } from '../../support/builders';
import { FakeSoundOut, scenarioRules } from '../../support/audio';
import { startSeededRun } from '../../support/runs';

const BASE: RunSnapshot = startSeededRun(aDefaultConfig(), 42, 'empty').snapshot();
const snap = (over: Partial<RunSnapshot> = {}): RunSnapshot =>
  ({ ...BASE, ...over }) as RunSnapshot;
const enemyHit = (id: number, tick: number): HitSnapshot => ({
  id,
  tick,
  kind: 'enemy',
  x: 0,
  y: 0,
  amount: 1,
});

const SETTINGS = { music: 50, effects: 80, muted: false };

function director(settings = SETTINGS, out = new FakeSoundOut()) {
  const mixer = new EffectMixer(scenarioRules({ explosion: { gain: 0.5 } }), 8, out);
  const cues = new AudioCues({ towerMatchPx: 24, maxTowerProjectiles: 16 });
  const d = new AudioDirector({ out, cues, mixer, settings });
  return { d, out, mixer };
}

/** Partida en curso: Jugar (newRun), pantalla de juego y snapshot de referencia. */
function playing(settings = SETTINGS, out = new FakeSoundOut()) {
  const ctx = director(settings, out);
  ctx.d.newRun();
  ctx.d.screen('playing');
  ctx.d.frame(snap(), 0, false);
  return ctx;
}

describe('musicState (spec audio, "Música de fondo en bucle")', () => {
  const base = { inRun: true, over: false, paused: false, held: false, hidden: false };

  it('Scenario: Oferta, tienda y obra no paran la música (en curso: playing)', () => {
    expect(musicState(base)).toBe('playing');
  });

  it('Scenario: Menú mudo (sin partida: stopped, también oculta)', () => {
    expect([
      musicState({ ...base, inRun: false }),
      musicState({ ...base, inRun: false, hidden: true }),
    ]).toEqual(['stopped', 'stopped']);
  });

  it('Scenario: Fin de partida y reinicio (terminada: stopped)', () => {
    expect(musicState({ ...base, over: true, paused: true })).toBe('stopped');
  });

  it('Scenario: Pausa con Esc (pausa, retención u oculta: paused)', () => {
    expect([
      musicState({ ...base, paused: true }),
      musicState({ ...base, held: true }),
      musicState({ ...base, hidden: true }),
    ]).toEqual(['paused', 'paused', 'paused']);
  });
});

describe('AudioDirector (spec audio, música, pausa y volúmenes)', () => {
  it('Scenario: Menú mudo', () => {
    const { d, out } = director();
    for (let i = 0; i < 300; i++) d.screen('menu');

    expect([d.music, out.orders, out.musicPlaying]).toEqual(['stopped', 0, 0]);
  });

  it('Scenario: Jugar arranca la música', () => {
    const { d, out } = director();
    d.screen('menu');
    out.positionMs = 7_000;

    d.newRun();
    d.newRun();
    d.screen('playing');

    expect([d.music, out.positionMs, out.musicPlaying]).toEqual(['playing', 0, 1]);
  });

  it('Scenario: Oferta, tienda y obra no paran la música', () => {
    const { d, out } = playing();
    out.positionMs = 12_000;
    const states: string[] = [];
    for (const status of ['choosing', 'shopping', 'building'] as const) {
      d.screen(status === 'shopping' ? 'shop' : status === 'building' ? 'build' : 'playing');
      d.frame(snap({ status }), 0, false);
      out.advance(2_000);
      states.push(d.music);
    }

    expect(states).toEqual(['playing', 'playing', 'playing']);
    expect(out.positionMs).toBeCloseTo(18_000, -2);
  });

  it('Scenario: Fin de partida y reinicio', () => {
    const { d, out } = playing();
    out.positionMs = 40_000;
    const over = snap({ status: 'over', outcome: 'lost' });
    for (let i = 0; i < 120; i++) d.frame(over, 0, false);
    const atResults = d.music;

    d.newRun();
    d.frame(snap(), 0, false);

    expect([atResults, d.music, out.positionMs]).toEqual(['stopped', 'playing', 0]);
  });

  it('Scenario: Volver al menú', () => {
    const { d, out } = playing();
    d.screen('paused');
    const paused = d.music;

    d.screen('menu');
    const inMenu = d.music;
    d.newRun();
    d.screen('playing');

    expect([paused, inMenu, d.music, out.positionMs]).toEqual(['paused', 'stopped', 'playing', 0]);
  });

  it('Scenario: Bucle', () => {
    const { d, out } = playing(SETTINGS, new FakeSoundOut(30_000));

    for (let i = 0; i < 31; i++) {
      d.frame(snap(), i * 1000, false);
      out.advance(1_000);
    }

    expect(d.music).toBe('playing');
    expect(out.positionMs).toBeCloseTo(1_000, -2);
  });

  it('Scenario: Pausa con Esc', () => {
    const { d, out } = playing();
    out.positionMs = 20_000;
    out.sounding = 3;

    d.screen('paused');
    out.advance(5_000);
    const during = [d.music, out.positionMs, out.sounding];
    d.screen('playing');

    expect(during).toEqual(['paused', 20_000, 0]);
    expect([d.music, out.positionMs]).toEqual(['playing', 20_000]);
  });

  it('Scenario: Retención por orientación', () => {
    const { d, out } = playing();
    out.positionMs = 9_000;

    d.frame(snap(), 100, true);
    const held = d.music;
    out.advance(3_000);
    d.frame(snap(), 100, false);

    expect([held, d.music, out.positionMs]).toEqual(['paused', 'playing', 9_000]);
  });

  it('Scenario: Pestaña oculta sobre la pausa', () => {
    const { d } = playing();
    d.screen('paused');

    d.setHidden(true);
    d.setHidden(false);

    expect(d.music).toBe('paused');
  });

  it('Scenario: Pestaña oculta en curso', () => {
    const { d, mixer } = playing();

    d.setHidden(true);
    const hidden = d.music;
    d.frame(snap({ tick: 60, hits: [enemyHit(0, 59), enemyHit(1, 60)] }), 60 * TICK_MS, false);
    d.setHidden(false);

    expect([hidden, d.music]).toEqual(['paused', 'playing']);
    expect(mixer.stats.byType.impactWeapon).toEqual({ requested: 2, played: 0, dropped: 2 });
  });

  it('Scenario: Pestaña oculta en el menú', () => {
    const { d } = director();
    d.screen('menu');

    d.setHidden(true);
    d.setHidden(false);

    expect(d.music).toBe('stopped');
  });

  it('Scenario: Volúmenes efectivos', () => {
    const { d, out } = playing();

    d.frame(snap({ blasts: [{ id: 0, tick: 0, x: 0, y: 0, radius: 64 }] }), 10, false);

    expect(out.musicVolume).toBeCloseTo(0.5, 10);
    expect(out.played.find((p) => p.type === 'explosion')?.volume).toBeCloseTo(0.4, 10);
    expect(d.volumes).toEqual({ music: 0.5, effects: 0.8 });
  });

  it('Scenario: Silencio y vuelta', () => {
    const { d, out } = playing();
    out.positionMs = 8_000;

    d.setSettings({ ...SETTINGS, muted: true });
    const muted = [d.volumes.music, d.volumes.effects, out.musicVolume, out.effectsVolume, d.music];
    out.advance(2_000);
    d.setSettings(SETTINGS);

    expect(muted).toEqual([0, 0, 0, 0, 'playing']);
    expect([d.volumes, out.musicVolume, out.positionMs]).toEqual([
      { music: 0.5, effects: 0.8 },
      0.5,
      10_000,
    ]);
    expect(d.settings).toEqual(SETTINGS);
  });

  it('Scenario: Cambio al instante', () => {
    const { d, out } = playing();
    out.positionMs = 4_000;

    d.setSettings({ ...SETTINGS, music: 20 });

    expect([out.musicVolume, out.positionMs, d.music]).toEqual([0.2, 4_000, 'playing']);
  });
});
