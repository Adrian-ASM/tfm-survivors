import { describe, expect, it } from 'vitest';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { ResultsOverlay } from '../../src/infrastructure/phaser/ResultsOverlay';
import { RESTART_HINT } from '../../src/infrastructure/phaser/resultsText';
import { RestartRun } from '../../src/application/RestartRun';
import { StartRun, type StartedRun } from '../../src/application/StartRun';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { TICK_MS, aDefaultConfig } from '../support/builders';
import { startRun } from '../support/runs';
import { FakeVisible } from '../support/sprites';

class FakeText extends FakeVisible {
  text = '';
  writes = 0;
  setText(text: string): this {
    this.text = text;
    this.writes += 1;
    return this;
  }
}

function overlay() {
  const veil = new FakeVisible();
  const texts = {
    title: new FakeText(),
    time: new FakeText(),
    level: new FakeText(),
    kills: new FakeText(),
    hint: new FakeText(),
  };
  return { veil, texts, view: new ResultsOverlay(veil, texts) };
}

const running = (tick = 0): RunSnapshot => ({ ...startRun(aDefaultConfig()).snapshot(), tick });
const lostAt = (tick: number): RunSnapshot => ({
  ...running(tick),
  status: 'over',
  outcome: 'lost',
  kills: 41,
  progression: { ...running().progression, level: 3 },
});

const allVisible = (o: ReturnType<typeof overlay>): boolean[] => [
  o.veil.visible,
  ...Object.values(o.texts).map((t) => t.visible),
];

describe('ResultsOverlay (spec run-results)', () => {
  it('empieza oculto', () => {
    const o = overlay();

    expect([allVisible(o).some(Boolean), o.view.view]).toEqual([false, null]);
  });

  it('Scenario: Sin overlay durante la partida (en curso y eligiendo mejora)', () => {
    const o = overlay();
    const choosing: RunSnapshot = { ...running(10), status: 'choosing', outcome: null };

    o.view.sync(running(5));
    const duringRun = allVisible(o).some(Boolean);
    o.view.sync(choosing);

    expect([duringRun, allVisible(o).some(Boolean), o.view.view]).toEqual([false, false, null]);
  });

  it('Scenario: Aparece en el mismo frame en que termina la partida (tick n − 1 ⇒ n)', () => {
    const o = overlay();
    o.view.sync(running(1258));

    o.view.sync(lostAt(1259));

    expect(allVisible(o).every(Boolean)).toBe(true);
    expect(Object.values(o.texts).map((t) => t.text)).toEqual([
      'Derrota',
      'Tiempo: 00:20',
      'Nivel: 3',
      'Bajas: 41',
      RESTART_HINT,
    ]);
    expect(o.view.view).toMatchObject({ title: 'Derrota', time: '00:20', level: 3, kills: 41 });
  });

  it('solo repinta cuando cambia la clave (resultado + tick)', () => {
    const o = overlay();
    const ended = lostAt(1259);

    for (let i = 0; i < 60; i++) o.view.sync(ended);

    expect([o.texts.title.writes, o.veil.toggles]).toEqual([1, 2]);
  });

  it('se oculta al pintar una partida nueva en curso', () => {
    const o = overlay();
    o.view.sync(lostAt(1259));

    o.view.sync(running(0));

    expect([allVisible(o).some(Boolean), o.view.view]).toEqual([false, null]);
  });
});

/** Partida terminada (derrota con un bug letal en el tick 1, o victoria con 1 s de duración). */
function endedRun(outcome: 'won' | 'lost'): StartedRun {
  const base = aDefaultConfig();
  const lethal = base.enemies.types.map((t) =>
    t.id === 'goblin-torch' ? { ...t, damage: 1e6 } : t,
  );
  const config: RunConfig =
    outcome === 'won'
      ? { ...base, run: { durationSeconds: 1 } }
      : { ...base, enemies: { types: lethal } };
  const setup = outcome === 'won' ? {} : { enemies: [{ type: 'goblin-torch', x: 480, y: 270 }] };
  const r = new StartRun().execute(config, new Mulberry32RandomGenerator(42), setup);
  if (!r.ok) throw new Error(r.error.message);
  for (let i = 0; i < 60 && r.value.tickRun.status !== 'over'; i++) {
    while (r.value.tickRun.status === 'choosing') r.value.chooseUpgrade.execute(0);
    r.value.tickRun.execute(TICK_MS, PlayerInput.NONE);
  }
  return r.value;
}

const restartFrom = (ended: StartedRun): StartedRun => {
  const next = new RestartRun(aDefaultConfig(), () => new Mulberry32RandomGenerator(7)).execute(
    ended.tickRun,
  );
  if (!next.ok) throw new Error(next.error.code);
  return next.value;
};

describe('Reinicio con la tecla R (spec run-results, caso de uso + overlay)', () => {
  it('Scenario: Reinicio tras una derrota (partida nueva en curso y overlay oculto)', () => {
    const o = overlay();
    const ended = endedRun('lost');
    o.view.sync(ended.tickRun.snapshot());
    const shownBefore = o.view.view?.title;

    const fresh = restartFrom(ended).tickRun.execute(TICK_MS, PlayerInput.NONE);
    o.view.sync(fresh);

    expect(shownBefore).toBe('Derrota');
    expect([fresh.status, fresh.outcome, o.view.view, o.veil.visible]).toEqual([
      'running',
      null,
      null,
      false,
    ]);
  });

  it('Scenario: Reinicio tras una victoria (partida nueva en curso, tick ≤ 15)', () => {
    const ended = endedRun('won');

    const fresh = restartFrom(ended).tickRun.execute(TICK_MS, PlayerInput.NONE);

    expect(ended.tickRun.snapshot().outcome).toBe('won');
    expect(fresh).toMatchObject({ status: 'running', outcome: null });
    expect(fresh.tick).toBeLessThanOrEqual(15);
  });

  it('Scenario: Teclas sin efecto con la partida terminada (1, 2, 3 y (1, 1) 60 frames)', () => {
    const o = overlay();
    const ended = endedRun('lost');
    const final = ended.tickRun.snapshot();

    const choices = [0, 1, 2].map((i) => ended.chooseUpgrade.execute(i).ok);
    for (let i = 0; i < 60; i++) {
      o.view.sync(ended.tickRun.execute(TICK_MS, PlayerInput.of(1, 1)));
    }

    expect(choices).toEqual([false, false, false]);
    expect(ended.tickRun.snapshot()).toStrictEqual(final);
    expect(o.veil.visible).toBe(true);
  });
});
