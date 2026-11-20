import { describe, expect, it } from 'vitest';
import { ClearProgress } from '../../src/application/ClearProgress';
import { ImportProgress } from '../../src/application/ImportProgress';
import { LoadProgress } from '../../src/application/LoadProgress';
import { RecordRun } from '../../src/application/RecordRun';
import type { StartedRun } from '../../src/application/StartRun';
import { PlayerInput } from '../../src/domain/player/PlayerInput';
import { EMPTY_PROGRESS } from '../../src/domain/progress/Progress';
import type { RunSnapshot } from '../../src/domain/run/RunSnapshot';
import { PANEL_NOTICES } from '../../src/infrastructure/dom/resultsPanelText';
import { MenuController } from '../../src/infrastructure/menu/MenuController';
import { PauseGate } from '../../src/infrastructure/phaser/PauseGate';
import {
  LocalStorageProgressRepository,
  PROGRESS_STORAGE_KEY,
} from '../../src/infrastructure/progress/LocalStorageProgressRepository';
import { MenuProgress } from '../../src/infrastructure/progress/MenuProgress';
import { decodeProgress, encodeProgress } from '../../src/infrastructure/progress/progressCodec';
import { ResultsProgress } from '../../src/infrastructure/progress/ResultsProgress';
import { Mulberry32RandomGenerator } from '../../src/infrastructure/random/Mulberry32RandomGenerator';
import { TICK_MS } from '../support/builders';
import { FakeStorage, domException } from '../support/FakeStorage';
import { DoomedStartRun, aRunSource, lethalConfig, overAt } from '../support/finishedRuns';
import { FixedClock } from '../support/FixedClock';
import { startDefault } from '../support/frameDriver';
import { aProgress, entriesAt, records } from '../support/progress';

// Progreso en el menú y en partidas abandonadas, con las mismas piezas que conecta
// `wireProgress` (sin DOM): sesión, repositorio de localStorage sobre un Storage falso con
// contadores de escrituras y borrados, ResultsProgress, MenuProgress y MenuController.

const DAMAGED = '{"schemaVersion":1,"records":';
const G = aProgress(records(300, 8, 120), entriesAt(3, 2));
/** Semilla 42 sin input: pierde en el tick 4682; se abandona antes. */
const ABANDON_TICK = 4500;

function wire(storage: () => FakeStorage) {
  const repository = new LocalStorageProgressRepository(storage);
  const loaded = new LoadProgress(repository).execute();
  const { session } = loaded;
  const importProgress = new ImportProgress(session, repository);
  const results = new ResultsProgress(
    session,
    new RecordRun(session, repository, new FixedClock(), () => 42),
    importProgress,
  );
  const menu = new MenuProgress(session, importProgress, new ClearProgress(session, repository));
  return { loaded, session, results, menu, controller: new MenuController() };
}

const storageWith = (value: string): FakeStorage => {
  const storage = new FakeStorage();
  storage.values.set(PROGRESS_STORAGE_KEY, value);
  return storage;
};

/**
 * Juega como `GameScene`: frames de 1 tick por `PauseGate`, política de elección fija y
 * `results.sync` en cada frame pintado. Para en `untilTick` o al terminar.
 */
function play(s: StartedRun, results: ResultsProgress, untilTick: number): RunSnapshot {
  const gate = new PauseGate();
  let snap = s.tickRun.snapshot();
  while (snap.status !== 'over' && snap.tick < untilTick) {
    while (s.tickRun.status === 'choosing') s.chooseUpgrade.execute(0);
    snap = gate.frame(s.tickRun, TICK_MS, PlayerInput.NONE, 1);
    results.sync(snap, s.tickRun);
  }
  return snap;
}

/** Abandona en pausa: Esc y 300 frames sin ticks, y después la partida deja de pintarse. */
function playAndAbandon(results: ResultsProgress, seed: number, untilTick: number): RunSnapshot {
  const s = startDefault(seed);
  const snap = play(s, results, untilTick);
  const gate = new PauseGate();
  gate.step(true, null, s.tickRun.status, s.tickRun);
  for (let i = 0; i < 300; i++) results.sync(gate.frame(s.tickRun, TICK_MS, PlayerInput.NONE, 1), s.tickRun);
  return snap;
}

function doomed(): StartedRun {
  const r = new DoomedStartRun().execute(lethalConfig(), new Mulberry32RandomGenerator(5));
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe('Partida abandonada con Volver al menú (spec progress-persistence y main-menu)', () => {
  it('Scenario: La partida abandonada no se guarda (0 escrituras, G byte a byte, export = G)', () => {
    const storage = storageWith(encodeProgress(G));
    const { results, menu, session } = wire(() => storage);

    const abandoned = playAndAbandon(results, 42, ABANDON_TICK);

    expect([abandoned.status, abandoned.tick]).toEqual(['running', ABANDON_TICK]);
    expect(abandoned.kills).toBeGreaterThan(0);
    expect([storage.writes, storage.removals]).toEqual([0, 0]);
    expect(storage.values.get(PROGRESS_STORAGE_KEY)).toBe(encodeProgress(G));
    expect(session.progress).toStrictEqual(G);
    expect(decodeProgress(menu.exportText())).toStrictEqual({ ok: true, value: G });
  });

  it('Scenario: Partida abandonada con Volver al menú (Jugar y terminar después: historial +1)', () => {
    const storage = storageWith(encodeProgress(G));
    const { results } = wire(() => storage);
    playAndAbandon(results, 42, ABANDON_TICK);

    const ended = play(doomed(), results, Number.POSITIVE_INFINITY);

    expect(ended.status).toBe('over');
    expect(storage.writes).toBe(1);
    const saved = decodeProgress(storage.values.get(PROGRESS_STORAGE_KEY) ?? '');
    expect(saved.ok ? saved.value.history.length : -1).toBe(G.history.length + 1);
  });

  it('Scenario: Aviso de datos dañados tras una partida abandonada (la siguiente que termina lo muestra)', () => {
    const storage = storageWith(DAMAGED);
    const { results, loaded } = wire(() => storage);
    playAndAbandon(results, 42, 600);
    const beforeEnd = storage.values.get(PROGRESS_STORAGE_KEY);

    play(doomed(), results, Number.POSITIVE_INFINITY);

    expect([loaded.issue, beforeEnd]).toEqual(['corrupt', DAMAGED]);
    expect(results.view?.notices).toContain(PANEL_NOTICES.corrupt);
    expect(PANEL_NOTICES.corrupt).toContain('dañados');
  });
});

describe('Datos dañados y almacenamiento bloqueado en el menú (spec progress-persistence)', () => {
  it('Scenario: Datos dañados con el menú abierto (Exportar y Cancelar: valor intacto y export vacío)', () => {
    const storage = storageWith(DAMAGED);
    const { menu, controller } = wire(() => storage);

    const exported = menu.exportText();
    const opened = controller.openConfirm();
    const cancelled = controller.cancel();

    expect([opened, cancelled]).toEqual([true, true]);
    expect(decodeProgress(exported)).toStrictEqual({ ok: true, value: EMPTY_PROGRESS });
    expect(storage.values.get(PROGRESS_STORAGE_KEY)).toBe(DAMAGED);
    expect([storage.writes, storage.removals]).toEqual([0, 0]);
  });

  it('Scenario: Borrar datos dañados (tras confirmar, una carga posterior es el vacío sin avisos)', () => {
    const storage = storageWith(DAMAGED);
    const { menu, controller } = wire(() => storage);
    controller.openConfirm();

    const view = controller.confirm() ? menu.clear() : null;
    const reload = wire(() => storage).loaded;

    expect(view?.message).toContain('borrado');
    expect([reload.issue, reload.session.progress]).toStrictEqual([null, EMPTY_PROGRESS]);
  });

  it('Scenario: Borrar sin almacenamiento (partida terminada (20, 3, 41), R, Esc y Volver al menú)', () => {
    const blocked = (): FakeStorage => {
      throw domException('SecurityError');
    };
    const { results, menu, controller, session } = wire(blocked);
    const over = overAt(1259, 3, 41);
    results.sync(over, aRunSource(over));
    const recorded = session.progress.records;
    // R: partida nueva; Esc y Volver al menú: se abandona sin terminar.
    playAndAbandon(results, 7, 60);
    controller.show();
    controller.openConfirm();

    const view = controller.confirm() ? menu.clear() : null;

    expect(recorded).toStrictEqual(records(20, 3, 41));
    expect(view?.message).toContain('borrado');
    expect(decodeProgress(menu.exportText())).toStrictEqual({ ok: true, value: EMPTY_PROGRESS });
  });

  it('Scenario: Menú con almacenamiento bloqueado (leer, escribir y borrar lanzan SecurityError)', () => {
    const storage = new FakeStorage();
    storage.getError = domException('SecurityError');
    storage.setError = domException('SecurityError');
    storage.removeError = domException('SecurityError');
    const { loaded, menu, controller } = wire(() => storage);

    const exported = menu.exportText();
    controller.openConfirm();
    const cleared = controller.confirm() ? menu.clear() : null;

    expect(loaded.issue).toBe('unavailable');
    expect(decodeProgress(exported)).toStrictEqual({ ok: true, value: EMPTY_PROGRESS });
    expect(cleared?.message).toContain('borrado');
    expect([controller.requestPlay(), controller.takePlay()]).toEqual([true, true]);
  });
});
