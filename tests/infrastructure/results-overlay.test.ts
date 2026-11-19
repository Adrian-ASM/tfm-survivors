import { describe, expect, it } from 'vitest';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { ResultsOverlay } from '../../src/infrastructure/phaser/ResultsOverlay';
import { RESTART_HINT } from '../../src/infrastructure/phaser/resultsText';
import { aDefaultConfig } from '../support/builders';
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
