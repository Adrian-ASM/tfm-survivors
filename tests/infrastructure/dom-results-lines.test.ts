import { describe, expect, it } from 'vitest';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { DomResultsLines, type TextElement } from '../../src/infrastructure/dom/DomResultsLines';
import { ResultsOverlay } from '../../src/infrastructure/phaser/ResultsOverlay';
import { RESTART_HINT } from '../../src/infrastructure/phaser/resultsText';
import { aDefaultConfig } from '../support/builders';
import { startRun } from '../support/runs';
import { FakeVisible } from '../support/sprites';

// Spec run-results (0017), "Resultados centrados" (design D11): las 5 líneas son DOM, en un único
// bloque con el panel; Phaser solo pinta el velo. Dobles mínimos (Vitest corre en node, sin jsdom).
const element = (): TextElement => ({ textContent: '', hidden: false });

function lines() {
  const els = {
    title: element(),
    time: element(),
    level: element(),
    kills: element(),
    hint: element(),
  };
  return { els, dom: new DomResultsLines(els) };
}

const running = (): RunSnapshot => startRun(aDefaultConfig()).snapshot();
const lostAt = (tick: number): RunSnapshot => ({
  ...running(),
  tick,
  status: 'over',
  outcome: 'lost',
  kills: 41,
  progression: { ...running().progression, level: 3 },
});

describe('DomResultsLines (0017)', () => {
  it('Scenario: Resultados centrados (al terminar rellena las 5 líneas DOM y las muestra)', () => {
    const { els, dom } = lines();
    const overlay = new ResultsOverlay(new FakeVisible(), dom.texts);

    overlay.sync(lostAt(1259));

    expect(Object.values(els).map((e) => e.hidden)).toEqual([false, false, false, false, false]);
    expect([els.time.textContent, els.level.textContent, els.kills.textContent]).toEqual([
      'Tiempo: 00:20',
      'Nivel: 3',
      'Bajas: 41',
    ]);
    expect(els.title.textContent).not.toBe('');
    expect(els.hint.textContent).toBe(RESTART_HINT);
  });

  it('Scenario: Botones tras redimensionar (al volver a playing las oculta; empieza oculto)', () => {
    const { els, dom } = lines();
    const overlay = new ResultsOverlay(new FakeVisible(), dom.texts);
    expect(Object.values(els).every((e) => e.hidden)).toBe(true);

    overlay.sync(lostAt(600));
    overlay.sync(running());

    expect(Object.values(els).every((e) => e.hidden)).toBe(true);
  });
});

// Spec hud (0036), "Bajas en el HUD": el HUD muestra solo el número; los resultados no cambian.
describe('Resultados con las bajas de siempre (hud 0036)', () => {
  it('Scenario: Resultados sin cambios (41 bajas: «Bajas: 41»)', () => {
    const { els, dom } = lines();
    new ResultsOverlay(new FakeVisible(), dom.texts).sync(lostAt(1259));
    expect(els.kills.textContent).toBe('Bajas: 41');
  });
});
