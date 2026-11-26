import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { RunConfig } from '../../src/domain/run/RunConfig';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { parseContent } from '../../src/infrastructure/content/loadRunConfig';
import { rawContent } from '../support/builders';
import { chooseFirstWhileOpen, startSeededRun } from '../support/runs';

// Spec mobile-display (0033), "Escritorio sin cambios fuera del modo móvil": el modo móvil solo
// cambia la presentación y la fuente del input; el núcleo recibe la misma RunConfig y los mismos
// `PlayerInput` (un joystick da módulos fraccionarios, que `PlayerInput.of` ya admite).
const TICKS = 3600;
/** Módulos 0, 0,375 y 1 en varias direcciones, cada uno mantenido 40 ticks. */
const PATTERN = [
  PlayerInput.of(0, 0),
  PlayerInput.of(0.375, 0),
  PlayerInput.of(0, -1),
  PlayerInput.of(-0.6, 0.8),
  PlayerInput.of(0.225, -0.3),
  PlayerInput.of(1, 0),
];
const inputAt = (tick: number): PlayerInput =>
  PATTERN[Math.floor(tick / 40) % PATTERN.length] ?? PlayerInput.NONE;

function configWith(mobile: boolean): RunConfig {
  const raw = rawContent();
  // "Con modo móvil": otras constantes de presentación (como si la carga las usara).
  if (mobile) Object.assign(raw.arena.mobile, { baseHeight: 720, minTextPx: 16 });
  const parsed = parseContent(raw);
  if (!parsed.ok) throw new Error(parsed.error.message);
  return parsed.value.config;
}

function play(config: RunConfig): RunSnapshot[] {
  const run = startSeededRun(config, 7);
  return Array.from({ length: TICKS }, (_, tick) => {
    chooseFirstWhileOpen(run);
    run.tick(inputAt(tick));
    return run.snapshot();
  });
}

describe('Determinismo con y sin modo móvil (0033)', () => {
  it('los inputs del patrón tienen módulos 0, 0,375 y 1', () => {
    const lengths = PATTERN.map((p) => Math.round(p.direction.length() * 1000) / 1000);
    expect(new Set(lengths)).toEqual(new Set([0, 0.375, 1]));
  });

  it('Scenario: Misma partida con y sin modo móvil (semilla 7, 3.600 ticks)', () => {
    const desktop = configWith(false);
    const mobile = configWith(true);
    expect(mobile).toEqual(desktop);

    const a = play(desktop);
    const b = play(mobile);

    expect(a.at(-1)?.tick).toBeGreaterThan(0);
    expect(b).toEqual(a);
  });
});
