import { describe, expect, it } from 'vitest';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { Run } from '../../src/domain/run/Run';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { LONG_RUN_HEALTH, aDefaultConfig, withPlayer } from '../support/builders';
import { randomInputs } from '../support/inputs';
import { chooseFirstWhileOpen, startSeededRun } from '../support/runs';

// Spec simulation-loop y enemy-hazards (0020): determinismo con los comportamientos y los peligros
// del contenido final. Los snapshots se comparan serializados en cada tick (sin tolerancia).
const LONG = 14_400;

/** Ejecuta las dos partidas a la par y devuelve si en algún tick difieren, más lo observado. */
function lockstep(a: Run, b: Run, inputs: readonly ReturnType<typeof randomInputs>[number][]) {
  let diverged = -1;
  let barrelBlasts = 0;
  let launches = 0;
  let prev: RunSnapshot = a.snapshot();
  inputs.forEach((input, i) => {
    if (diverged >= 0) return;
    chooseFirstWhileOpen(a);
    chooseFirstWhileOpen(b);
    a.tick(input);
    b.tick(input);
    const [sa, sb] = [a.snapshot(), b.snapshot()];
    if (JSON.stringify(sa) !== JSON.stringify(sb)) diverged = i + 1;
    const known = new Set(prev.dynamites.map((d) => d.id));
    launches += sa.dynamites.filter((d) => !known.has(d.id)).length;
    // Un barril ha explotado si hay una explosión de este tick en el centro de su aviso de mecha.
    barrelBlasts += prev.warnings.filter(
      (w) =>
        w.source === 'fuse' &&
        sa.blasts.some((b) => b.tick === sa.tick && b.x === w.x && b.y === w.y),
    ).length;
    prev = sa;
  });
  return { diverged, barrelBlasts, launches };
}

describe('Determinismo con peligros', () => {
  it('Scenario: Partida con peligros reproducible (semilla 12, 14.400 ticks, input aleatorio)', () => {
    const config = withPlayer(aDefaultConfig(), { maxHealth: LONG_RUN_HEALTH });
    const inputs = randomInputs(LONG, 2020);
    const r = lockstep(startSeededRun(config, 12), startSeededRun(config, 12), inputs);
    expect(r.diverged).toBe(-1);
    expect(r.barrelBlasts).toBeGreaterThanOrEqual(1);
    expect(r.launches).toBeGreaterThanOrEqual(1);
  });

  it('Scenario: Mismos peligros con cualquier ventana (el núcleo no recibe ventana: semilla 42, quieto)', () => {
    const config = aDefaultConfig();
    const hazards = () => {
      const run = startSeededRun(config, 42);
      const out: string[] = [];
      for (let t = 0; t < 10_800 && run.status !== 'over'; t++) {
        chooseFirstWhileOpen(run);
        run.tick(PlayerInput.NONE);
        const { dynamites, warnings, blasts } = run.snapshot();
        out.push(JSON.stringify({ dynamites, warnings, blasts }));
      }
      return out;
    };
    const a = hazards();
    expect(a.some((s) => s !== '{"dynamites":[],"warnings":[],"blasts":[]}')).toBe(true);
    expect(hazards()).toEqual(a);
  });
});
