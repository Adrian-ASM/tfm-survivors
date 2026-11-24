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
  SPAWN_RING_INSIDE_MAX_VIEW,
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
    // Estricto: un punto del anillo sin recorte nunca cae en una vista centrada en el jugador.
    const { maxView } = config.arena;
    if (!(config.waves.spawn.ringRadius > Math.hypot(maxView.width, maxView.height) / 2)) {
      ctx.addIssue({
        code: 'custom',
        path: ['waves', 'spawn', 'ringRadius'],
        message: SPAWN_RING_INSIDE_MAX_VIEW,
      });
      return;
    }
    const rules = buildRunRules(config);
    if (!rules.ok) {
      ctx.addIssue({
        code: 'custom',
        path: rules.error.field.split('.'),
        message: rules.error.message,
      });
    }
  });

/** Contenido crudo de los ficheros de content/, sin validar. */
export interface RawContentFiles {
  player: unknown;
  arena: unknown;
  enemies: unknown;
  waves: unknown;
  weapons: unknown;
  progression: unknown;
  upgrades: unknown;
  run: unknown;
  map: unknown;
}

/** Tamaño en píxeles CSS (presentación): nunca llega al núcleo. */
export interface ViewSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Contenido validado, separado por destino (ADR-0015): `config` es lo único que recibe el núcleo
 * (el mundo, sin ningún tamaño de vista); `maxView` es solo para la presentación.
 */
export interface ParsedContent {
  readonly config: RunConfig;
  readonly maxView: ViewSize;
}

export function parseContent(raw: RawContentFiles): Result<ParsedContent, DomainError> {
  const parsed = RunConfigSchema.safeParse(raw);
  if (parsed.success) {
    const { maxView, ...world } = parsed.data.arena;
    return ok({ config: { ...parsed.data, arena: world }, maxView });
  }
  const issue = parsed.error.issues[0];
  const path = (issue?.path ?? []).map(String);
  // Un campo desconocido se nombra a sí mismo (spec procedural-map: "nombra `lakes`").
  if (issue?.code === 'unrecognized_keys' && issue.keys[0] !== undefined) path.push(issue.keys[0]);
  const message = issue?.message ?? 'Contenido inválido';
  return err(invalidConfig(path.join('.'), namingEnemyType(message, path, raw)));
}

/**
 * Un error dentro de un tipo de enemigo nombra el tipo además del campo (spec enemy-behavior y
 * enemy-spawning: "un error que nombre el tipo y el campo"): la ruta solo lleva su índice.
 */
function namingEnemyType(message: string, path: readonly string[], raw: RawContentFiles): string {
  if (path[0] !== 'enemies' || path[1] !== 'types' || path[2] === undefined) return message;
  const types: unknown = (raw.enemies as { types?: unknown } | null)?.types;
  const entry: unknown = Array.isArray(types) ? types[Number(path[2])] : undefined;
  const id = (entry as { id?: unknown } | undefined)?.id;
  if (typeof id !== 'string' || message.includes(id)) return message;
  return `${message} (${id})`;
}

/** Configuración de partida para el núcleo (sin el tope de vista). */
export function parseRunConfig(raw: RawContentFiles): Result<RunConfig, DomainError> {
  const parsed = parseContent(raw);
  return parsed.ok ? ok(parsed.value.config) : parsed;
}

/** Contenido versionado en content/*.json, empaquetado por Vite. */
export function loadRunConfig(): Result<RunConfig, DomainError> {
  return parseRunConfig(repositoryContent());
}

/** Contenido crudo del repositorio, sin validar (lo valida `parseRunConfig`). */
export function repositoryContent(): RawContentFiles {
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
