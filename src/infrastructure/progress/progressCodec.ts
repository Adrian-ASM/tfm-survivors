import { normalizeHistory } from '../../domain/progress/history';
import type { HistoryEntry, Progress } from '../../domain/progress/Progress';
import type { RunOutcome } from '../../domain/run/RunPhase';
import { err, ok, type Result } from '../../domain/shared/Result';
import {
  PROGRESS_SCHEMA_VERSION,
  ProgressDocumentSchema,
  type ProgressDocument,
} from './progressSchema';

/** Por qué un texto no es un progreso válido. */
export interface ProgressDecodeError {
  readonly code: 'not-json' | 'invalid' | 'unknown-version';
  readonly message: string;
}

type DocOutcome = ProgressDocument['history'][number]['outcome'];

const TO_DOC: Readonly<Record<RunOutcome, DocOutcome>> = { won: 'victory', lost: 'defeat' };
const FROM_DOC: Readonly<Record<DocOutcome, RunOutcome>> = { victory: 'won', defeat: 'lost' };

/** Documento v1 con las claves en orden fijo (export y almacenamiento, ADR-0010). */
export function encodeProgress(progress: Progress): string {
  const { bestTimeSeconds, bestLevel, maxKills } = progress.records;
  const doc: ProgressDocument = {
    schemaVersion: PROGRESS_SCHEMA_VERSION,
    records: { bestTimeSeconds, bestLevel, maxKills },
    history: progress.history.map((e) => ({
      playedAt: e.playedAt,
      seed: e.seed,
      outcome: TO_DOC[e.outcome],
      timeSeconds: e.timeSeconds,
      level: e.level,
      kills: e.kills,
    })),
  };
  return JSON.stringify(doc, null, 2);
}

function parseJson(text: string): Result<unknown, ProgressDecodeError> {
  try {
    return ok(JSON.parse(text) as unknown);
  } catch {
    return err({ code: 'not-json', message: 'el contenido no es JSON' });
  }
}

/** `schemaVersion` numérica distinta de la única conocida (otra versión ⇒ rechazo, sin migrar). */
function hasUnknownVersion(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const version = (value as { schemaVersion?: unknown }).schemaVersion;
  return typeof version === 'number' && version !== PROGRESS_SCHEMA_VERSION;
}

/**
 * Valida un texto externo (almacenamiento o fichero) y lo traduce al `Progress` canónico del
 * dominio (historial normalizado). Nunca lanza.
 */
export function decodeProgress(text: string): Result<Progress, ProgressDecodeError> {
  const json = parseJson(text);
  if (!json.ok) return json;
  if (hasUnknownVersion(json.value)) {
    return err({ code: 'unknown-version', message: 'schemaVersion desconocida' });
  }
  const doc = ProgressDocumentSchema.safeParse(json.value);
  if (!doc.success) {
    const issue = doc.error.issues[0];
    const where = issue?.path.join('.') ?? '';
    return err({ code: 'invalid', message: `${where}: ${issue?.message ?? 'esquema'}` });
  }
  const { records, history } = doc.data;
  const entries: HistoryEntry[] = history.map((e) => ({ ...e, outcome: FROM_DOC[e.outcome] }));
  return ok(
    Object.freeze({ records: Object.freeze({ ...records }), history: normalizeHistory(entries) }),
  );
}
