import { describe, expect, it } from 'vitest';
import { RecordRun } from '../../src/application/RecordRun';
import { RestartRun } from '../../src/application/RestartRun';
import { OPEN_TERRAIN } from '../../src/domain/map/TerrainSource';
import type { ProgressSession } from '../../src/application/ProgressSession';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { EMPTY_PROGRESS, type Progress } from '../../src/domain/progress/Progress';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { FixedClock } from '../support/FixedClock';
import { InMemoryProgressRepository } from '../support/InMemoryProgressRepository';
import {
  DoomedStartRun,
  aRunSource,
  lethalConfig,
  overAt,
  playToEnd,
  runningAt,
} from '../support/finishedRuns';
import { playedAtOf, records } from '../support/progress';

const NOW = 1_763_596_800_000;

const session = (overrides: Partial<ProgressSession> = {}): ProgressSession => ({
  progress: EMPTY_PROGRESS,
  persistent: true,
  corruptPending: false,
  ...overrides,
});

function recorder(s = session(), repo = new InMemoryProgressRepository(), seed = 42) {
  const clock = new FixedClock(NOW);
  return { s, repo, clock, record: new RecordRun(s, repo, clock, () => seed) };
}

const firstDefeat = (): RunSnapshot => overAt(1259, 3, 41);

describe('RecordRun (spec progress-persistence, "Registro" y "Guardado automático")', () => {
  it('Scenario: Primera derrota (tick 1.259, nivel 3, 41 bajas, semilla 42)', () => {
    const { s, repo, record } = recorder();

    const recorded = record.execute(aRunSource(firstDefeat()));

    const expected: Progress = {
      records: records(20, 3, 41),
      history: [{ playedAt: NOW, seed: 42, outcome: 'lost', timeSeconds: 20, level: 3, kills: 41 }],
    };
    expect(recorded).toStrictEqual({
      ok: true,
      value: { progress: expected, saved: true, corrupt: false },
    });
    expect([s.progress, repo.stored]).toStrictEqual([expected, expected]);
  });

  it('Scenario: Un guardado por partida (300 frames en over ⇒ 1 escritura)', () => {
    const { repo, record } = recorder();
    const run = aRunSource(firstDefeat());

    const results = Array.from({ length: 300 }, () => record.execute(run));

    expect(repo.saveAttempts).toBe(1);
    expect(repo.stored?.history).toHaveLength(1);
    expect(run.snapshots).toBe(1);
    expect(results.slice(1).every((r) => !r.ok && r.error.code === 'already-recorded')).toBe(true);
  });

  it('Scenario: Partida sin terminar (running y choosing ⇒ not-over, sin escribir ni leer)', () => {
    const { repo, record } = recorder();
    const running = aRunSource(runningAt(5000));
    const choosing = aRunSource({ ...runningAt(5000), status: 'choosing', outcome: null });

    const results = [record.execute(running), record.execute(choosing)];

    expect(results).toStrictEqual([
      { ok: false, error: { code: 'not-over' } },
      { ok: false, error: { code: 'not-over' } },
    ]);
    expect([repo.saveAttempts, running.snapshots, choosing.snapshots]).toEqual([0, 0, 0]);
  });

  it('Scenario: Varias partidas en la misma carga (3 partidas reales con RestartRun)', () => {
    const { repo, clock, record } = recorder();
    const restart = new RestartRun(
      lethalConfig(),
      () => ({ random: new Mulberry32RandomGenerator(7), terrain: OPEN_TERRAIN }),
      new DoomedStartRun(),
    );
    let current: ReturnType<RestartRun['execute']> = new DoomedStartRun().execute(
      lethalConfig(),
      new Mulberry32RandomGenerator(42),
    );

    for (const at of [1000, 2000, 3000]) {
      if (!current.ok) throw new Error(current.error.code);
      playToEnd(current.value);
      clock.now = at;
      record.execute(current.value.tickRun);
      current = restart.execute(current.value.tickRun);
    }

    expect(repo.writes).toBe(3);
    expect(repo.stored && playedAtOf(repo.stored)).toEqual([3000, 2000, 1000]);
  });

  it.each(['unavailable', 'quota-exceeded'] as const)(
    'Scenario: Almacenamiento lleno al guardar / bloqueado (%s ⇒ sesión con la partida)',
    (code) => {
      const repo = new InMemoryProgressRepository();
      repo.saveError = { code };
      const { s, record } = recorder(session(), repo);

      const recorded = record.execute(aRunSource(firstDefeat()));

      expect(recorded.ok && recorded.value.saved).toBe(false);
      expect(s.progress.records).toStrictEqual(records(20, 3, 41));
      expect([s.persistent, repo.stored]).toStrictEqual([false, null]);
    },
  );

  it('Scenario: Progreso en memoria durante la carga ((20, 3, 41) y (15, 5, 30) ⇒ (20, 5, 41))', () => {
    const repo = new InMemoryProgressRepository();
    repo.saveError = { code: 'unavailable' };
    const { s, record } = recorder(session({ persistent: false }), repo);

    record.execute(aRunSource(overAt(1200, 3, 41)));
    const second = record.execute(aRunSource(overAt(900, 5, 30)));

    expect(second.ok && second.value.progress.records).toStrictEqual(records(20, 5, 41));
    expect(s.progress.history).toHaveLength(2);
  });

  it('un guardado correcto tras uno fallido vuelve a marcar la sesión como persistente', () => {
    const repo = new InMemoryProgressRepository();
    repo.saveError = { code: 'quota-exceeded' };
    const { s, record } = recorder(session(), repo);
    record.execute(aRunSource(overAt(1200, 3, 41)));
    repo.saveError = null;

    const second = record.execute(aRunSource(overAt(900, 5, 30)));

    expect([second.ok && second.value.saved, s.persistent]).toEqual([true, true]);
  });

  it('Scenario: Primer guardado tras datos dañados (corrupt solo en la 1.ª; guardado válido)', () => {
    const { s, repo, record } = recorder(session({ corruptPending: true }));

    const first = record.execute(aRunSource(firstDefeat()));
    const savedAfterFirst = repo.stored;
    const second = record.execute(aRunSource(overAt(900, 5, 30)));

    expect(first.ok && first.value.corrupt).toBe(true);
    expect(savedAfterFirst?.records).toStrictEqual(records(20, 3, 41));
    expect(savedAfterFirst?.history).toHaveLength(1);
    expect(second.ok && second.value.corrupt).toBe(false);
    expect(s.corruptPending).toBe(false);
  });
});
