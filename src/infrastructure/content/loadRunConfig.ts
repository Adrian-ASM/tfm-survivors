import { z } from 'zod';
import arenaJson from '../../../content/arena.json';
import playerJson from '../../../content/player.json';
import { Arena } from '../../domain/arena/Arena';
import { RADIUS_MUST_FIT, SPEED_MUST_BE_POSITIVE, type RunConfig } from '../../domain/run/Run';
import { err, invalidConfig, ok, type DomainError, type Result } from '../../domain/shared/Result';

// Validación del contenido antes de llegar al dominio (AGENTS.md §3.5-6): forma de cada fichero y, sobre el
// conjunto, que el radio del jugador quepa en la arena. La regla de encaje es la del dominio (`Arena.fits`),
// que además la mantiene en `Run.start` como defensa.
const PlayerSchema = z.strictObject({
  speed: z.number().positive({ error: SPEED_MUST_BE_POSITIVE }),
  radius: z.number().positive(),
});

const ArenaSchema = z.strictObject({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const RunConfigSchema = z
  .object({ player: PlayerSchema, arena: ArenaSchema })
  .superRefine(({ player, arena }, ctx) => {
    const created = Arena.create(arena.width, arena.height);
    if (created.ok && !created.value.fits(player.radius)) {
      ctx.addIssue({
        code: 'custom',
        path: ['player', 'radius'],
        message: RADIUS_MUST_FIT,
      });
    }
  });

export function parseRunConfig(raw: {
  player: unknown;
  arena: unknown;
}): Result<RunConfig, DomainError> {
  const parsed = RunConfigSchema.safeParse(raw);
  if (parsed.success) return ok(parsed.data);
  const issue = parsed.error.issues[0];
  const field = (issue?.path ?? []).map(String).join('.');
  return err(invalidConfig(field, issue?.message ?? 'Contenido inválido'));
}

/** Contenido versionado en content/*.json, empaquetado por Vite. */
export function loadRunConfig(): Result<RunConfig, DomainError> {
  return parseRunConfig({ player: playerJson, arena: arenaJson });
}
