import { describe, expect, it } from 'vitest';
import { ImportProgress } from '../../src/application/ImportProgress';
import { LoadProgress } from '../../src/application/LoadProgress';
import { RecordRun } from '../../src/application/RecordRun';
import { createRunLauncher } from '../../src/composition/runLauncher';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import type { Progress } from '../../src/domain/progress/Progress';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { PauseGate } from '../../src/infrastructure/phaser/PauseGate';
import { ResultsProgress } from '../../src/infrastructure/progress/ResultsProgress';
import { resolveAdvance } from '../../src/infrastructure/url/resolveAdvance';
import { resolveManual } from '../../src/infrastructure/url/resolveManual';
import { resolveSeed } from '../../src/infrastructure/url/resolveSeed';
import { aDefaultConfig } from '../support/builders';
import { FixedClock } from '../support/FixedClock';
import { InMemoryProgressRepository } from '../support/InMemoryProgressRepository';

// Spec simulation-loop (0014), "Manual ignorado fuera de E2E", AND final: al terminar se guardan
// récord e historial como sin `manual`. Sustituye a la partida entera con `page.clock` del E2E
// (W7): misma ruta que `main.ts` (resolveSeed, resolveAdvance, sin ManualStepper, createRunLauncher,
// frames por PauseGate a `advance.speed`) y guardado en memoria, sin navegador.

const FRAME_60HZ = 16.667;
/** Tope de frames: una partida quieta pierde antes de 180 s (change 0010); 10 min sobra. */
const MAX_FRAMES = 36_000;
/** Semilla "aleatoria" fija para las URLs sin `seed` válida. */
const FALLBACK_SEED = 7;

interface LoadResult {
  readonly manual: boolean;
  readonly warnings: readonly string[];
  readonly firstFrameTicks: number;
  readonly ended: RunSnapshot;
  readonly saved: Progress | null;
}

/**
 * Una carga del juego sin `?e2e` con `search`, cableada como `bootstrap`: pulsa Jugar y deja
 * correr frames de 60 Hz sin input (opción 0 si hay oferta) hasta el fin, con `results.sync` en
 * cada frame pintado.
 */
function loadAndPlay(search: string): LoadResult {
  const { seed } = resolveSeed(search, () => FALLBACK_SEED);
  const advance = resolveAdvance(search);
  const repository = new InMemoryProgressRepository();
  const { session } = new LoadProgress(repository).execute();
  const results = new ResultsProgress(
    session,
    new RecordRun(session, repository, new FixedClock(), () => seed),
    new ImportProgress(session, repository),
  );
  const run = createRunLauncher({
    config: aDefaultConfig(),
    urlSeed: seed,
    randomSeed: () => FALLBACK_SEED,
    onStart: () => undefined,
    onContentError: (error) => {
      throw new Error(error.message);
    },
  }).launch();
  if (!run) throw new Error('sin partida');

  const gate = new PauseGate();
  let snap = run.tickRun.snapshot();
  let firstFrameTicks = -1;
  for (let f = 0; f < MAX_FRAMES && snap.status !== 'over'; f++) {
    while (run.tickRun.status === 'choosing') run.chooseUpgrade.execute(0);
    const before = snap.tick;
    snap = gate.frame(run.tickRun, FRAME_60HZ, PlayerInput.NONE, advance.speed);
    if (f === 0) firstFrameTicks = snap.tick - before;
    results.sync(snap, run.tickRun);
  }
  return {
    manual: advance.manual,
    warnings: advance.warnings,
    firstFrameTicks,
    ended: snap,
    saved: repository.stored,
  };
}

describe('Manual ignorado fuera de E2E: guardado como sin manual (spec simulation-loop, 0014)', () => {
  it.each([
    ['?manual', ''],
    ['?manual=1&seed=42', '?seed=42'],
    ['?manual=abc', ''],
  ])('Scenario: Manual ignorado fuera de E2E (%s frente a "%s")', (search, reference) => {
    const expected = loadAndPlay(reference);

    const actual = loadAndPlay(search);

    expect(resolveManual(search)).toEqual({ manual: false });
    expect([actual.manual, actual.warnings, actual.firstFrameTicks]).toEqual([false, [], 1]);
    expect(actual.ended.status).toBe('over');
    const [entry] = actual.saved?.history ?? [];
    expect(actual.saved?.history).toHaveLength(1);
    expect(actual.saved?.records).toStrictEqual({
      bestTimeSeconds: entry?.timeSeconds,
      bestLevel: entry?.level,
      maxKills: entry?.kills,
    });
    expect(entry?.seed).toBe(search.includes('seed=42') ? 42 : FALLBACK_SEED);
    expect(actual.saved).toStrictEqual(expected.saved);
  });
});
