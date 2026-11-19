import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { aSegment } from '../support/builders';
import { StubRandom } from '../support/random';
import { aContactConfig, aProbeType, startRun, ticks } from '../support/runs';

const CENTER = { x: 480, y: 270 };
const UP_RIGHT = PlayerInput.of(1, 1);

/** Jugador con vida 10 y un enemigo de daño 10 que entra en contacto en el tick `n`. */
const deathAt = (n: number) => ({ type: 'probe', x: 480 + 25 + n, y: 270 });

describe('Estado de la partida', () => {
  it('Partida recién creada: en curso', () => {
    expect(startRun(aContactConfig()).snapshot().status).toBe('running');
  });

  it('Partida con vida restante: tras el noveno golpe, vida 10 y en curso', () => {
    const run = startRun(aContactConfig(), { enemies: [{ type: 'probe', ...CENTER }] });
    // Golpes en los ticks 1, 32, 63… (1 + 31·k): el noveno, en el 249.
    const snap = ticks(run, 249).at(-1);
    expect([snap?.player.health, snap?.status]).toEqual([10, 'running']);
  });
});

describe('Fin de partida al llegar a vida 0', () => {
  it('Golpe que deja la vida en 0: tick 100, vida 0 y terminada', () => {
    const run = startRun(aContactConfig({ player: { maxHealth: 10 } }), {
      enemies: [deathAt(100)],
    });
    const snaps = ticks(run, 100);
    expect(snaps[98]).toMatchObject({ tick: 99, status: 'running', player: { health: 10 } });
    expect(snaps[99]).toMatchObject({ tick: 100, status: 'over', player: { health: 0 } });
  });

  it('Varios contactos en el tick de la muerte: vida 0 (no negativa) y terminada', () => {
    const types = [aProbeType(), aProbeType({ id: 'strong', damage: 25 })];
    const enemies = [
      { type: 'probe', ...CENTER },
      { type: 'strong', ...CENTER },
    ];
    const run = startRun(aContactConfig({ types, player: { maxHealth: 10 } }), { enemies });
    expect(ticks(run, 1)[0]).toMatchObject({ status: 'over', player: { health: 0 } });
  });

  it('Sin spawns en el tick de la muerte (el director habría sacado uno en el tick 60)', () => {
    const config = (maxHealth: number) =>
      aContactConfig({ player: { maxHealth }, segments: [aSegment(['probe'], 1)] });
    const setup = { enemies: [deathAt(60)] };
    const alive = startRun(config(1000), setup, new StubRandom(0.5));
    const dying = startRun(config(10), setup, new StubRandom(0.5));
    const control = ticks(alive, 60);
    const snaps = ticks(dying, 60);
    expect(control[59]?.enemies).toHaveLength(2);
    expect(snaps[59]?.status).toBe('over');
    expect(snaps[59]?.enemies).toHaveLength(snaps[58]?.enemies.length ?? -1);
  });
});

describe('Simulación detenida tras terminar', () => {
  const ended = () => {
    const random = new StubRandom(0.5);
    const config = aContactConfig({
      player: { maxHealth: 10 },
      segments: [aSegment(['probe'], 1)],
    });
    const run = startRun(config, { enemies: [deathAt(100)] }, random);
    ticks(run, 100);
    return { run, random };
  };

  it('600 ticks después de terminar: snapshot igual campo a campo, tick incluido', () => {
    const { run } = ended();
    const final = run.snapshot();
    expect(final.status).toBe('over');
    expect(final.enemies.length).toBeGreaterThanOrEqual(1);
    expect(() => ticks(run, 600, UP_RIGHT)).not.toThrow();
    expect(run.snapshot()).toStrictEqual(final);
    expect(run.snapshot().tick).toBe(100);
  });

  it('La terminación no consume azar', () => {
    const a = ended();
    const b = ended();
    const calls = a.random.calls;
    ticks(a.run, 600, UP_RIGHT);
    expect(a.random.calls).toBe(calls);
    expect(a.run.snapshot()).toStrictEqual(b.run.snapshot());
  });

  it('Una partida terminada no vuelve a en curso (36.000 ticks más)', () => {
    const { run } = ended();
    for (let i = 0; i < 36_000; i++) run.tick(UP_RIGHT);
    expect([run.snapshot().status, run.snapshot().player.health]).toEqual(['over', 0]);
  });

  it('Sin persecución con la partida terminada: el enemigo sigue en (300, 270)', () => {
    const enemies = [
      { type: 'probe', ...CENTER },
      { type: 'probe', x: 299, y: 270 },
    ];
    const run = startRun(aContactConfig({ player: { maxHealth: 10 } }), { enemies });
    const [death] = ticks(run, 1);
    expect(death?.status).toBe('over');
    expect(death?.enemies[1]).toMatchObject({ x: 300, y: 270 });
    const after = ticks(run, 60).at(-1);
    expect(after?.enemies[1]).toMatchObject({ x: 300, y: 270 });
    expect(after?.player).toMatchObject(CENTER);
  });
});
