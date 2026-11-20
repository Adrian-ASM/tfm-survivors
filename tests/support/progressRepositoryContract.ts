import { describe, expect, it } from 'vitest';
import type { ProgressRepository } from '../../src/application/ProgressRepository';
import { normalizeHistory } from '../../src/domain/progress/history';
import { aProgress, anEntry, entriesAt, records } from './progress';

const first = aProgress(records(20, 3, 41), normalizeHistory([anEntry()]));
const second = aProgress(
  records(300, 10, 120),
  normalizeHistory([...entriesAt(1, 2), anEntry({ outcome: 'won', seed: 4_294_967_295 })]),
);

/**
 * Contrato del puerto ProgressRepository (patrón de randomContract.ts). `makeStorage` crea un
 * almacenamiento vacío y devuelve una fábrica de repositorios sobre él: dos llamadas a la fábrica
 * son dos cargas de la página sobre el mismo almacenamiento.
 */
export function describeProgressRepositoryContract(
  name: string,
  makeStorage: () => () => ProgressRepository,
): void {
  describe(`Contrato ProgressRepository · ${name}`, () => {
    it('sin nada guardado, load da ok(null)', () => {
      expect(makeStorage()().load()).toStrictEqual({ ok: true, value: null });
    });

    it('save y load devuelven el mismo progreso campo a campo', () => {
      const repo = makeStorage()();

      expect(repo.save(first).ok).toBe(true);
      expect(repo.load()).toStrictEqual({ ok: true, value: first });
    });

    it('un segundo save sobrescribe el primero', () => {
      const repo = makeStorage()();
      repo.save(first);
      repo.save(second);

      expect(repo.load()).toStrictEqual({ ok: true, value: second });
    });

    it('Scenario: Recarga tras una partida (instancia nueva sobre el mismo almacenamiento)', () => {
      const reload = makeStorage();
      reload().save(first);

      expect(reload().load()).toStrictEqual({ ok: true, value: first });
    });

    it('Scenario: Borrado confirmado (tras clear, load da ok(null))', () => {
      const repo = makeStorage()();
      repo.save(first);

      expect(repo.clear()).toStrictEqual({ ok: true, value: undefined });
      expect(repo.load()).toStrictEqual({ ok: true, value: null });
    });

    it('Scenario: Borrar el progreso vacío (clear sin nada guardado da ok, dos veces)', () => {
      const reload = makeStorage();
      const repo = reload();

      expect([repo.clear(), repo.clear()]).toStrictEqual([
        { ok: true, value: undefined },
        { ok: true, value: undefined },
      ]);
      expect(reload().load()).toStrictEqual({ ok: true, value: null });
    });
  });
}
