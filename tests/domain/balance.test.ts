import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { Run } from '../../src/domain/run/Run';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import {
  DEFAULT_ENEMY_TYPES,
  DEFAULT_WEAPONS,
  aDefaultConfig,
  aRunConfig,
  withWeapons,
} from '../support/builders';
import { play } from '../support/runs';

// Medición de equilibrio (tasks 4.7) con el contenido por defecto, armas incluidas, e input (0, 0).
// Medido en apply: primer golpe con semilla 42 en el tick 4100; con semilla 7, primer pulso en el
// tick 950 y, en 600 ticks, 16 proyectiles y 7 bajas. Plazos de la spec tras el gate: 4.800 y 1.800.
const FIRST_HIT_LIMIT = 4800;
const PULSE_LIMIT = 1800;
const TEN_SECONDS = 600;

function start(seed: number): Run {
  const config = withWeapons(aRunConfig(), DEFAULT_WEAPONS);
  const r = Run.start(config, new Mulberry32RandomGenerator(seed));
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe('Contacto observable con las armas activas', () => {
  it('Scenario: Primer golpe en el núcleo con armas activas (semilla 42, ≤ 4.800 ticks)', () => {
    const run = start(42);
    let firstHit = 0;
    for (let n = 1; n <= FIRST_HIT_LIMIT && firstHit === 0; n++) {
      run.tick(PlayerInput.NONE);
      if (run.snapshot().player.health < 100) firstHit = n;
    }
    const snap = run.snapshot();
    expect(firstHit).toBeGreaterThan(0);
    expect(snap.status).toBe('running');
    const afterOneHit: number[] = DEFAULT_ENEMY_TYPES.map((t) => 100 - t.damage);
    expect(afterOneHit).toContain(snap.player.health);
  });
});

describe('Armas observables en el juego', () => {
  it('Scenario: Jugador quieto con el contenido por defecto (semilla 7)', () => {
    const run = start(7);
    let previous = new Set<number>();
    let lastProjectile = -1;
    let projectiles = 0;
    let kills = 0;
    let firstPulse = 0;
    for (let n = 1; n <= PULSE_LIMIT; n++) {
      run.tick(PlayerInput.NONE);
      const s = run.snapshot();
      if (n <= TEN_SECONDS) {
        for (const p of s.projectiles) {
          if (p.id > lastProjectile) projectiles++;
          lastProjectile = Math.max(lastProjectile, p.id);
        }
        // Sin otro mecanismo de baja, un id que desaparece con la partida en curso es una baja.
        const alive = new Set(s.enemies.map((e) => e.id));
        for (const id of previous) if (!alive.has(id)) kills++;
        previous = alive;
      }
      if (firstPulse === 0 && s.pulses.some((p) => p.weapon === 'tests')) firstPulse = n;
    }
    expect(run.snapshot().status).toBe('running');
    expect(projectiles).toBeGreaterThanOrEqual(1);
    expect(kills).toBeGreaterThanOrEqual(1);
    expect(firstPulse).toBeGreaterThan(0);
  });
});

// Tarea 0.2: aceptación de plazos con el contenido por defecto de 0005 (armas y mejoras), input
// (0, 0) y la política de elección fija. Medido en el punto de control 0.3 con pickupRadius 128 (decisión
// del usuario): primera oferta con semilla 7 en el tick 3332, primer golpe con semilla 42 en el 4122.
const OFFER_LIMIT = 3600;

function startDefault(seed: number): Run {
  const r = Run.start(aDefaultConfig(), new Mulberry32RandomGenerator(seed));
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe('Plazos con progresión (0005, medidos en el punto de control 0.3)', () => {
  it('Scenario: Primera subida en el núcleo (semilla 7: oferta en algún tick ≤ 3.600)', () => {
    const run = startDefault(7);
    let firstOffer = 0;
    play(run, OFFER_LIMIT, (t, r) => {
      if (r.status === 'choosing') firstOffer = t;
      return firstOffer > 0;
    });
    expect(firstOffer).toBeGreaterThan(0);
  });

  it('Scenario: Primer golpe en el núcleo con armas activas (semilla 42, ≤ 4.800)', () => {
    const run = startDefault(42);
    let before = run.snapshot().player;
    const hits: { health: number; prev: number; status: string }[] = [];
    play(run, FIRST_HIT_LIMIT, (_t, r) => {
      const s = r.snapshot();
      if (s.player.health < s.player.maxHealth && s.player.maxHealth === before.maxHealth) {
        hits.push({ health: s.player.health, prev: before.health, status: s.status });
      }
      before = s.player;
      return hits.length > 0;
    });
    expect(hits).toHaveLength(1);
    const { health, prev, status } = hits[0] ?? { health: 0, prev: 0, status: '' };
    expect(status).not.toBe('over');
    expect(DEFAULT_ENEMY_TYPES.map((t) => prev - t.damage)).toContain(health);
  });

  it('Scenario: Jugador quieto con el contenido por defecto (semilla 7: baja ≤ 600, pulso ≤ 1.800)', () => {
    const run = startDefault(7);
    let previous = new Set<number>();
    let kills = 0;
    let firstPulse = 0;
    play(run, PULSE_LIMIT, (t, r) => {
      const s = r.snapshot();
      const alive = new Set(s.enemies.map((e) => e.id));
      if (t <= TEN_SECONDS) for (const id of previous) if (!alive.has(id)) kills++;
      previous = alive;
      if (firstPulse === 0 && s.pulses.some((p) => p.weapon === 'tests')) firstPulse = t;
      return false;
    });
    expect(kills).toBeGreaterThanOrEqual(1);
    expect(firstPulse).toBeGreaterThan(0);
  });

  it('Scenario: Partida con progresión reproducible (semilla 7: ≥ 1 gema y ≥ 1 oferta en 3.600)', () => {
    const run = startDefault(7);
    let gem = false;
    let offer = false;
    play(run, OFFER_LIMIT, (_t, r) => {
      const s = r.snapshot();
      gem ||= s.progression.xp > 0 || s.progression.level > 1;
      offer ||= s.status === 'choosing';
      return gem && offer;
    });
    expect([gem, offer]).toEqual([true, true]);
  });
});
