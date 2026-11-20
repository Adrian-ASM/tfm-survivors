import { describe, expect, it } from 'vitest';
import { normalizeHistory } from '../../src/domain/progress/history';
import { EMPTY_PROGRESS, type Progress } from '../../src/domain/progress/Progress';
import { decodeProgress, encodeProgress } from '../../src/infrastructure/progress/progressCodec';
import { aProgress, anEntry, entriesAt, records } from '../support/progress';

const VALID =
  '{"schemaVersion":1,"records":{"bestTimeSeconds":20,"bestLevel":3,"maxKills":41},"history":[{' +
  '"playedAt":1763596800000,"seed":42,"outcome":"defeat","timeSeconds":20,"level":3,"kills":41}]}';

type Doc = Record<string, unknown> & {
  records: Record<string, unknown>;
  history: Record<string, unknown>[];
};

const validDoc = (): Doc => JSON.parse(VALID) as Doc;
const firstEntry = (d: Doc): Record<string, unknown> => d.history[0] ?? {};

const MAX = Number.MAX_SAFE_INTEGER;
const MAX_SEED = 4_294_967_295;

const variant = (change: (d: Doc) => void): string => {
  const d = validDoc();
  change(d);
  return JSON.stringify(d);
};

const decodeError = (text: string): string | null => {
  const r = decodeProgress(text);
  return r.ok ? null : r.error.code;
};

describe('Validación del progreso (spec progress-persistence)', () => {
  it('Scenario: Documento válido (el literal de la spec)', () => {
    expect(decodeProgress(VALID)).toStrictEqual({
      ok: true,
      value: aProgress(records(20, 3, 41), [anEntry()]),
    });
  });

  it('Scenario: Valores en los límites (seed 0 y 2³² − 1, kills 0, maxKills 2⁵³ − 1, 10 entradas)', () => {
    const text = variant((d) => {
      d.records.maxKills = MAX;
      d.history = Array.from({ length: 10 }, (_, i) => ({
        ...firstEntry(validDoc()),
        playedAt: i,
        seed: i === 0 ? 0 : MAX_SEED,
        kills: 0,
      }));
    });

    const r = decodeProgress(text);

    expect(r.ok && r.value.history.length).toBe(10);
    expect(r.ok && r.value.records.maxKills).toBe(MAX);
  });

  const INVALID: [string, string][] = [
    ['schemaVersion "1"', variant((d) => (d.schemaVersion = '1'))],
    ['schemaVersion 0', variant((d) => (d.schemaVersion = 0))],
    ['schemaVersion 2', variant((d) => (d.schemaVersion = 2))],
    ['sin records', variant((d) => delete (d as Partial<Doc>).records)],
    ['note en la raíz', variant((d) => (d.note = '<script>'))],
    ['note en records', variant((d) => (d.records.note = '<script>'))],
    ['note en una entrada', variant((d) => (firstEntry(d).note = '<script>'))],
    ['bestLevel −1', variant((d) => (d.records.bestLevel = -1))],
    ['timeSeconds 1,5', variant((d) => (firstEntry(d).timeSeconds = 1.5))],
    ['kills 1e400', VALID.replace('"kills":41}', '"kills":1e400}')],
    ['maxKills 2⁵³', VALID.replace('"maxKills":41', '"maxKills":9007199254740992')],
    ['seed −1', variant((d) => (firstEntry(d).seed = -1))],
    ['seed 2³²', variant((d) => (firstEntry(d).seed = MAX_SEED + 1))],
    ['level 0 en una entrada', variant((d) => (firstEntry(d).level = 0))],
    ['outcome "win"', variant((d) => (firstEntry(d).outcome = 'win'))],
    ['11 entradas', variant((d) => (d.history = Array.from({ length: 11 }, () => firstEntry(d))))],
    ['null', 'null'],
    ['[]', '[]'],
    ['texto vacío', ''],
    ['__proto__ propio', VALID.replace('{"schemaVersion"', '{"__proto__":{"x":1},"schemaVersion"')],
  ];

  it.each(INVALID)('Scenario: Documentos inválidos (%s)', (_name, text) => {
    expect(decodeProgress(text).ok).toBe(false);
  });

  it('clasifica el fallo: no JSON, versión desconocida o fuera de esquema', () => {
    expect([
      decodeError('hola'),
      decodeError(''),
      decodeError('{"schemaVersion":1,"records":'),
      decodeError(variant((d) => (d.schemaVersion = 2))),
      decodeError(variant((d) => (d.note = 'x'))),
    ]).toEqual(['not-json', 'not-json', 'not-json', 'unknown-version', 'invalid']);
  });

  it('normaliza el historial al decodificar (orden y duplicados no invalidan)', () => {
    const text = variant((d) => {
      const e = firstEntry(d);
      d.history = [
        { ...e, playedAt: 1 },
        { ...e, playedAt: 3 },
        { ...e, playedAt: 1 },
      ];
    });

    const r = decodeProgress(text);

    expect(r.ok && r.value.history.map((e) => e.playedAt)).toEqual([3, 1]);
  });
});

describe('Formato del fichero (spec progress-persistence, "Exportar el progreso")', () => {
  it('codifica el documento v1 con victory/defeat y las claves en orden fijo', () => {
    const p = aProgress(records(20, 3, 41), [anEntry()]);

    expect(JSON.parse(encodeProgress(p))).toStrictEqual(JSON.parse(VALID));
    expect(encodeProgress(p)).toBe(JSON.stringify(JSON.parse(VALID), null, 2));
  });

  it('el progreso vacío también es un documento válido', () => {
    expect(decodeProgress(encodeProgress(EMPTY_PROGRESS))).toStrictEqual({
      ok: true,
      value: EMPTY_PROGRESS,
    });
  });

  it('Scenario: Ida y vuelta (decode(encode(P)) = P)', () => {
    const p: Progress = aProgress(
      records(300, 10, 120),
      normalizeHistory([...entriesAt(5, 7), anEntry({ outcome: 'won', playedAt: 5, seed: 1 })]),
    );

    expect(decodeProgress(encodeProgress(p))).toStrictEqual({ ok: true, value: p });
  });

  it('Scenario: Tamaño del fichero máximo (10 entradas y números máximos < 65.536 bytes)', () => {
    const history = Array.from({ length: 10 }, (_, i) =>
      anEntry({
        playedAt: MAX - i,
        seed: MAX_SEED,
        outcome: 'won',
        timeSeconds: MAX,
        level: MAX,
        kills: MAX,
      }),
    );
    const text = encodeProgress(aProgress(records(MAX, MAX, MAX), history));

    expect(new TextEncoder().encode(text).byteLength).toBeLessThan(65_536);
    expect(decodeProgress(text).ok).toBe(true);
  });
});
