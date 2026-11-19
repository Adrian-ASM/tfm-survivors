import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { aContactConfig, aProbeType, pile, startRun, ticks } from '../support/runs';

const CENTER = { x: 480, y: 270 };
const health = (snaps: { player: { health: number } }[]): number[] =>
  snaps.map((s) => s.player.health);

describe('Contacto jugador-enemigo', () => {
  it('Tangencia exacta no es contacto (enemigo en 506, distancia 26 = 16 + 10)', () => {
    const run = startRun(aContactConfig(), { enemies: [{ type: 'probe', x: 507, y: 270 }] });
    const [snap] = ticks(run, 1);
    expect(snap?.enemies[0]?.x).toBe(506);
    expect(snap?.player.health).toBe(100);
  });

  it('Solapamiento tras la persecución (enemigo en 505, distancia 25)', () => {
    const run = startRun(aContactConfig(), { enemies: [{ type: 'probe', x: 507, y: 270 }] });
    const snaps = ticks(run, 2);
    expect(health(snaps)).toEqual([100, 90]);
  });

  it('Sin contacto no hay daño (600 ticks sin enemigos)', () => {
    const run = startRun(aContactConfig());
    const snaps = ticks(run, 600);
    expect(snaps.at(-1)?.player.health).toBe(100);
  });
});

describe('Daño discreto por contacto', () => {
  it('Un golpe de un enemigo: el enemigo sigue vivo, en su sitio y con su vida', () => {
    const run = startRun(aContactConfig(), { enemies: [{ type: 'probe', ...CENTER }] });
    const [snap] = ticks(run, 1);
    expect(snap?.player.health).toBe(90);
    expect(snap?.enemies).toEqual([{ id: 0, type: 'probe', ...CENTER, radius: 10, health: 5 }]);
  });

  it('Varios contactos en el mismo tick: un solo golpe (90, no 70)', () => {
    const run = startRun(aContactConfig(), { enemies: pile(3, 'probe', CENTER.x, CENTER.y) });
    expect(ticks(run, 1)[0]?.player.health).toBe(90);
  });

  it.each([
    ['débil primero', ['weak', 'strong']],
    ['fuerte primero', ['strong', 'weak']],
  ])('Contactos simultáneos de daño distinto (%s): vida 75', (_name, order) => {
    const types = [aProbeType({ id: 'weak' }), aProbeType({ id: 'strong', damage: 25 })];
    const enemies = order.map((type) => ({ type, ...CENTER }));
    const run = startRun(aContactConfig({ types }), { enemies });
    expect(ticks(run, 1)[0]?.player.health).toBe(75);
  });
});

describe('Invulnerabilidad temporal tras un golpe', () => {
  const continuous = () =>
    ticks(
      startRun(aContactConfig({ player: { invulnerabilityTicks: 30 } }), {
        enemies: [{ type: 'probe', ...CENTER }],
      }),
      32,
    );

  it('Contacto continuo con un enemigo: 90 tras el tick 1 y el 31, 80 tras el 32', () => {
    const snaps = continuous();
    expect([snaps[0], snaps[30], snaps[31]].map((s) => s?.player.health)).toEqual([90, 90, 80]);
  });

  it('Fin de la invulnerabilidad justo en el tick N (snapshots 1 a 32)', () => {
    const flags = continuous().map((s) => s.player.invulnerable);
    expect(flags.slice(0, 30).every(Boolean)).toBe(true);
    expect(flags[30]).toBe(false);
    expect(flags[31]).toBe(true);
  });

  it('Contacto nuevo que llega justo al expirar (golpe en 10; contacto nuevo en 40 y 41)', () => {
    // Con velocidad 60 (1 u/tick), el que sale de x = 515 toca en el tick 10 y el de 545 en el 40.
    const enemies = [
      { type: 'probe', x: 515, y: 270 },
      { type: 'probe', x: 545, y: 270 },
    ];
    const snaps = ticks(startRun(aContactConfig(), { enemies }), 41);
    expect([snaps[8], snaps[9], snaps[39], snaps[40]].map((s) => s?.player.health)).toEqual([
      100, 90, 90, 80,
    ]);
  });

  it('Un enemigo más fuerte no rompe la invulnerabilidad (daño 50 en contacto desde el 5)', () => {
    const types = [aProbeType(), aProbeType({ id: 'strong', damage: 50 })];
    const enemies = [
      { type: 'probe', ...CENTER },
      { type: 'strong', x: 510, y: 270 },
    ];
    const snaps = ticks(startRun(aContactConfig({ types }), { enemies }), 31);
    expect(snaps[4]?.enemies[1]?.x).toBe(505);
    expect(snaps[30]?.player.health).toBe(90);
  });

  it('200 enemigos encima del jugador: 980 tras 61 ticks y nunca más de 10 por tick', () => {
    const config = aContactConfig({ player: { maxHealth: 1000 } });
    const run = startRun(config, { enemies: pile(200, 'probe', CENTER.x, CENTER.y) });
    const values = [1000, ...health(ticks(run, 61))];
    expect(values.at(-1)).toBe(980);
    const drops = values.slice(1).map((v, i) => (values[i] ?? v) - v);
    expect(Math.max(...drops)).toBe(10);
    expect(drops.filter((d) => d > 0)).toHaveLength(2);
  });
});

describe('Orden de los pasos del tick', () => {
  const moving = (x: number) =>
    ticks(
      startRun(aContactConfig(), { enemies: [{ type: 'probe', x, y: 270 }] }),
      1,
      PlayerInput.of(1, 0),
    )[0];

  it('El contacto usa las posiciones tras moverse ambos (distancia 25,667 < 26)', () => {
    const snap = moving(510);
    expect(snap?.player.x).toBeCloseTo(483.333, 3);
    expect(snap?.enemies[0]?.x).toBe(509);
    expect(snap?.player.health).toBe(90);
  });

  it('Solo el movimiento del jugador no basta (distancia 27,667 > 26)', () => {
    expect(moving(512)?.player.health).toBe(100);
  });
});
