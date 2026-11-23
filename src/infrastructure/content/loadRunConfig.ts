import { z } from 'zod';
import arenaJson from '../../../content/arena.json';
import enemiesJson from '../../../content/enemies.json';
import mapJson from '../../../content/map.json';
import playerJson from '../../../content/player.json';
import progressionJson from '../../../content/progression.json';
import runJson from '../../../content/run.json';
import upgradesJson from '../../../content/upgrades.json';
import wavesJson from '../../../content/waves.json';
import weaponsJson from '../../../content/weapons.json';
import { buildRunRules, type RunConfig } from '../../domain/run/RunConfig';
import { err, invalidConfig, ok, type DomainError, type Result } from '../../domain/shared/Result';
import {
  ArenaSchema,
  EnemiesSchema,
  MapSchema,
  PlayerSchema,
  ProgressionSchema,
  RunSchema,
  UpgradesSchema,
  WavesSchema,
  WeaponsSchema,
} from './schemas';

// Validación del contenido antes de llegar al dominio (AGENTS.md §3.5-6): forma y rangos de cada
// fichero (schemas.ts) y, sobre el conjunto, las reglas cruzadas. Estas tienen una sola implementación,
// `buildRunRules` del dominio, que además las mantiene en `Run.start` como defensa.
const RunConfigSchema = z
  .object({
    player: PlayerSchema,
    arena: ArenaSchema,
    enemies: EnemiesSchema,
    waves: WavesSchema,
    weapons: WeaponsSchema,
    progression: ProgressionSchema,
    upgrades: UpgradesSchema,
    run: RunSchema,
    map: MapSchema,
  })
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
  weapons: unknown;
  progression: unknown;
  upgrades: unknown;
  run: unknown;
  map: unknown;
}): Result<RunConfig, DomainError> {
  const parsed = RunConfigSchema.safeParse(raw);
  if (parsed.success) return ok(parsed.data);
  const issue = parsed.error.issues[0];
  const path = (issue?.path ?? []).map(String);
  // Un campo desconocido se nombra a sí mismo (spec procedural-map: "nombra `lakes`").
  if (issue?.code === 'unrecognized_keys' && issue.keys[0] !== undefined) path.push(issue.keys[0]);
  return err(invalidConfig(path.join('.'), issue?.message ?? 'Contenido inválido'));
}

/** Contenido versionado en content/*.json, empaquetado por Vite. */
export function loadRunConfig(): Result<RunConfig, DomainError> {
  return parseRunConfig(repositoryContent());
}

/** Contenido crudo del repositorio, sin validar (lo valida `parseRunConfig`). */
export function repositoryContent(): Parameters<typeof parseRunConfig>[0] {
  return {
    player: playerJson,
    arena: arenaJson,
    enemies: enemiesJson,
    waves: wavesJson,
    weapons: weaponsJson,
    progression: progressionJson,
    upgrades: upgradesJson,
    run: runJson,
    map: mapJson,
  };
}
