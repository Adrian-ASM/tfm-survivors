import { z } from 'zod';
import arenaJson from '../../../content/arena.json';
import playerJson from '../../../content/player.json';
import type { RunConfig } from '../../domain/run/Run';
import { err, invalidConfig, ok, type DomainError, type Result } from '../../domain/shared/Result';

// Validación de FORMA del contenido (AGENTS.md §3.5-6). Las invariantes de negocio (p. ej. que el radio quepa
// en la arena) las comprueba el dominio en Run.start.
const PlayerSchema = z.strictObject({
  speed: z.number().positive(),
  radius: z.number().positive(),
});

const ArenaSchema = z.strictObject({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

function parse<T>(schema: z.ZodType<T>, raw: unknown, prefix: string): Result<T, DomainError> {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return ok(parsed.data);
  const issue = parsed.error.issues[0];
  const field = [prefix, ...(issue?.path ?? []).map(String)].join('.');
  return err(invalidConfig(field, issue?.message ?? 'Contenido inválido'));
}

export function parseRunConfig(raw: {
  player: unknown;
  arena: unknown;
}): Result<RunConfig, DomainError> {
  const player = parse(PlayerSchema, raw.player, 'player');
  if (!player.ok) return player;
  const arena = parse(ArenaSchema, raw.arena, 'arena');
  if (!arena.ok) return arena;
  return ok({ player: player.value, arena: arena.value });
}

/** Contenido versionado en content/*.json, empaquetado por Vite. */
export function loadRunConfig(): Result<RunConfig, DomainError> {
  return parseRunConfig({ player: playerJson, arena: arenaJson });
}
