import { z } from 'zod';
import arenaJson from '../../../content/arena.json';
import enemiesJson from '../../../content/enemies.json';
import playerJson from '../../../content/player.json';
import wavesJson from '../../../content/waves.json';
import { buildRunRules, type RunConfig } from '../../domain/run/RunConfig';
import { err, invalidConfig, ok, type DomainError, type Result } from '../../domain/shared/Result';
import { ArenaSchema, EnemiesSchema, PlayerSchema, WavesSchema } from './schemas';

// Validación del contenido antes de llegar al dominio (AGENTS.md §3.5-6): forma y rangos de cada
// fichero (schemas.ts) y, sobre el conjunto, las reglas cruzadas. Estas tienen una sola implementación,
// `buildRunRules` del dominio, que además las mantiene en `Run.start` como defensa.
const RunConfigSchema = z
  .object({ player: PlayerSchema, arena: ArenaSchema, enemies: EnemiesSchema, waves: WavesSchema })
  .superRefine((config, ctx) => {
    const rules = buildRunRules(config);
    if (!rules.ok) {
      ctx.addIssue({
        code: 'custom',
        path: rules.error.field.split('.'),
        message: rules.error.message,
      });
    }
  });

export function parseRunConfig(raw: {
  player: unknown;
  arena: unknown;
  enemies: unknown;
  waves: unknown;
}): Result<RunConfig, DomainError> {
  const parsed = RunConfigSchema.safeParse(raw);
  if (parsed.success) return ok(parsed.data);
  const issue = parsed.error.issues[0];
  const field = (issue?.path ?? []).map(String).join('.');
  return err(invalidConfig(field, issue?.message ?? 'Contenido inválido'));
}

/** Contenido versionado en content/*.json, empaquetado por Vite. */
export function loadRunConfig(): Result<RunConfig, DomainError> {
  return parseRunConfig({
    player: playerJson,
    arena: arenaJson,
    enemies: enemiesJson,
    waves: wavesJson,
  });
}
