import { OPEN_TERRAIN } from '../../src/domain/map/TerrainSource';
import { describe, expect, it } from 'vitest';
import { ImportProgress } from '../../src/application/ImportProgress';
import type { ProgressSession } from '../../src/application/ProgressSession';
import { RecordRun } from '../../src/application/RecordRun';
import { RestartRun } from '../../src/application/RestartRun';
import { normalizeHistory } from '../../src/domain/progress/history';
import { EMPTY_PROGRESS, type Progress } from '../../src/domain/progress/Progress';
import { PANEL_NOTICES } from '../../src/infrastructure/dom/resultsPanelText';
import { decodeProgress, encodeProgress } from '../../src/infrastructure/progress/progressCodec';
import { ResultsProgress } from '../../src/infrastructure/progress/ResultsProgress';
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
import { aProgress, anEntry, records } from '../support/progress';

function presenter(
  options: {
    progress?: Progress;
    corruptPending?: boolean;
    repo?: InMemoryProgressRepository;
  } = {},
) {
  const repo = options.repo ?? new InMemoryProgressRepository();
  const session: ProgressSession = {
    progress: options.progress ?? EMPTY_PROGRESS,
    persistent: true,
    corruptPending: options.corruptPending ?? false,
  };
  const clock = new FixedClock();
  const results = new ResultsProgress(
    session,
    new RecordRun(session, repo, clock, () => 42),
    new ImportProgress(session, repo),
  );
  return { results, repo, session, clock };
}

const lost = () => overAt(1259, 3, 41);
const syncOver = (p: ResultsProgress, snap = lost()) => p.sync(snap, aRunSource(snap));
const fileOf = (text: string): File => new File([text], 'progress.json');
const fileRecords = (r: Progress['records']) =>
  fileOf(encodeProgress(aProgress(r, normalizeHistory([anEntry({ playedAt: 7 })]))));

describe('ResultsProgress (spec run-results y progress-persistence)', () => {
  it('Scenario: Sin overlay durante la partida (en curso y eligiendo mejora ⇒ null)', () => {
    const { results, repo } = presenter();
    const choosing = { ...runningAt(10), status: 'choosing', outcome: null } as const;

    expect([
      results.sync(runningAt(10), aRunSource(runningAt(10))),
      results.sync(choosing, aRunSource(choosing)),
      results.view,
    ]).toEqual([null, null, null]);
    expect(repo.saveAttempts).toBe(0);
  });

  it('Scenario: Un guardado por partida (300 sync en over ⇒ 1 escritura y la misma vista)', () => {
    const { results, repo } = presenter();
    const snap = lost();
    const run = aRunSource(snap);

    const views = Array.from({ length: 300 }, () => results.sync(snap, run));

    expect(repo.writes).toBe(1);
    expect(views[0]?.records).toEqual(['Mejor tiempo 00:20', 'Mejor nivel 3', 'Máx. bajas 41']);
    expect(views.every((v) => v === views[0])).toBe(true);
  });

  it('Scenario: Reinicio inmediato (guardado hecho antes del tick 1 de la partida nueva)', () => {
    const { results, repo } = presenter();
    const restart = new RestartRun(
      lethalConfig(),
      () => ({
        random: new Mulberry32RandomGenerator(7),
        terrain: OPEN_TERRAIN,
        stoneRandom: new Mulberry32RandomGenerator(8),
      }),
      new DoomedStartRun(),
    );
    const first = new DoomedStartRun().execute(lethalConfig(), new Mulberry32RandomGenerator(42));
    if (!first.ok) throw new Error(first.error.message);
    playToEnd(first.value);
    const { tickRun } = first.value;

    results.sync(tickRun.snapshot(), tickRun);
    const next = restart.execute(tickRun);

    expect(next.ok && next.value.tickRun.snapshot().tick).toBe(0);
    expect([repo.writes, repo.stored?.history.length]).toEqual([1, 1]);
  });

  it('Scenario: Récords tras importar ((20, 3, 41) + fichero (250, 10, 90) ⇒ fusionados e importado)', async () => {
    const { results, repo } = presenter();
    syncOver(results);

    const view = await results.importFile(fileRecords(records(250, 10, 90)));

    expect(view?.records).toEqual(['Mejor tiempo 04:10', 'Mejor nivel 10', 'Máx. bajas 90']);
    expect(view?.message).toContain('importado');
    expect(repo.stored?.records).toStrictEqual(records(250, 10, 90));
    expect(results.view).toBe(view);
  });

  it.each([
    ['Fichero demasiado grande', fileOf(' '.repeat(65_537)), '64 KiB'],
    ['Fichero no JSON o fuera de esquema', fileOf('hola'), 'no válido'],
  ])('Scenario: %s (mensaje y progreso G sin cambios)', async (_name, file, text) => {
    const { results, repo, session } = presenter();
    syncOver(results);
    const before = { inUse: session.progress, stored: repo.stored, writes: repo.writes };

    const view = await results.importFile(file);

    expect(view?.message).toContain(text);
    expect({ inUse: session.progress, stored: repo.stored, writes: repo.writes }).toStrictEqual(
      before,
    );
  });

  it('Scenario: Mensajes que no se arrastran (el rechazo no se ve en la partida siguiente)', async () => {
    const { results } = presenter();
    syncOver(results);
    await results.importFile(fileOf('hola'));

    const hidden = results.sync(runningAt(1), aRunSource(runningAt(1)));
    const next = syncOver(results, overAt(900, 5, 30));

    expect(hidden).toBeNull();
    expect(next?.message).toBeNull();
  });

  it('Scenario: Aviso sin persistencia (save falla ⇒ no se guarda, récords y vista)', () => {
    const repo = new InMemoryProgressRepository();
    repo.saveError = { code: 'unavailable' };
    const { results } = presenter({ repo });

    const view = syncOver(results);

    expect(view?.notices).toEqual([PANEL_NOTICES.notSaved]);
    expect(view?.records[0]).toBe('Mejor tiempo 00:20');
  });

  it('Scenario: Aviso de datos dañados solo en la primera partida', () => {
    const { results } = presenter({ corruptPending: true });

    const first = syncOver(results);
    const second = syncOver(results, overAt(900, 5, 30));

    expect(first?.notices).toEqual([PANEL_NOTICES.corrupt]);
    expect(second?.notices).toEqual([]);
  });

  it('Scenario: Récords anteriores mejores que la partida ((300, 8, 120) + nivel 10 ⇒ 05:00, 10, 120)', () => {
    const { results } = presenter({ progress: aProgress(records(300, 8, 120)) });

    const view = syncOver(results, overAt(1259, 10, 41));

    expect(view?.records).toEqual(['Mejor tiempo 05:00', 'Mejor nivel 10', 'Máx. bajas 120']);
  });

  it('Scenario: Exportar tras una partida (exportText decodifica igual al progreso en uso)', () => {
    const { results, session } = presenter();
    syncOver(results);

    expect(decodeProgress(results.exportText())).toStrictEqual({
      ok: true,
      value: session.progress,
    });
    expect(session.progress.history).toHaveLength(1);
  });
});
