import { describe, expect, it } from 'vitest';
import {
  PANEL_MESSAGES,
  PANEL_NOTICES,
  PROGRESS_CORRUPT_WARNING,
  resultsPanelView,
} from '../../src/infrastructure/dom/resultsPanelText';
import { aProgress, records } from '../support/progress';

const OK = { persistent: true, corrupt: false };

describe('Textos del panel de progreso (spec run-results, "Overlay de resultados")', () => {
  it('Scenario: Récords en la primera partida ((20, 3, 41) ⇒ 00:20, 3, 41; sin avisos)', () => {
    const view = resultsPanelView(aProgress(records(20, 3, 41)), OK, null);

    expect(view).toStrictEqual({
      records: ['Mejor tiempo 00:20', 'Mejor nivel 3', 'Máx. bajas 41'],
      notices: [],
      message: null,
    });
  });

  it('Scenario: Récords anteriores mejores que la partida ((300, 10, 120) ⇒ 05:00)', () => {
    const view = resultsPanelView(aProgress(records(300, 10, 120)), OK, null);

    expect(view.records).toEqual(['Mejor tiempo 05:00', 'Mejor nivel 10', 'Máx. bajas 120']);
  });

  it('Scenario: Récords tras importar ((250, 10, 90) ⇒ 04:10 y mensaje con importado)', () => {
    const view = resultsPanelView(aProgress(records(250, 10, 90)), OK, 'imported');

    expect(view.records).toEqual(['Mejor tiempo 04:10', 'Mejor nivel 10', 'Máx. bajas 90']);
    expect(view.message).toContain('importado');
  });

  it('los mensajes y avisos contienen los textos que fija la spec', () => {
    expect([
      PANEL_MESSAGES.imported.includes('importado'),
      PANEL_MESSAGES['too-large'].includes('64 KiB'),
      PANEL_MESSAGES.invalid.includes('no válido'),
      PANEL_NOTICES.notSaved.includes('no se guarda'),
      PANEL_NOTICES.corrupt.includes('dañados'),
      PROGRESS_CORRUPT_WARNING.includes('progress'),
    ]).toEqual([true, true, true, true, true, true]);
  });

  it('avisos de sin persistencia y de datos dañados, en ese orden', () => {
    const view = resultsPanelView(aProgress(), { persistent: false, corrupt: true }, 'invalid');

    expect(view.notices).toEqual([PANEL_NOTICES.notSaved, PANEL_NOTICES.corrupt]);
    expect(view.message).toBe(PANEL_MESSAGES.invalid);
  });
});
