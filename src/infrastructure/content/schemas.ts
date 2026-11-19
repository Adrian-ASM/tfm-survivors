import { z } from 'zod';
import { VIEW_SIZE_MUST_BE_POSITIVE } from '../../domain/arena/View';
import {
  ENEMY_COST_MUST_BE_POSITIVE,
  ENEMY_RADIUS_MUST_FIT,
  ENEMY_SPEED_MUST_BE_POSITIVE,
} from '../../domain/enemy/EnemyType';
import { SPEED_MUST_BE_POSITIVE } from '../../domain/run/RunConfig';
import {
  MAX_ALIVE_MUST_BE_INTEGER,
  MAX_ATTEMPTS_MUST_BE_INTEGER,
  SPAWN_DISTANCE_MUST_BE_NON_NEGATIVE,
} from '../../domain/wave/SpawnRules';
import {
  BUDGET_MUST_BE_NON_NEGATIVE,
  SEGMENT_NEEDS_TYPES,
  WAVES_NEED_SEGMENTS,
} from '../../domain/wave/WaveTable';

// Forma y rangos por campo de cada fichero de content/ (AGENTS.md §3.5-6). Todos estrictos: un
// campo desconocido es un error. Los mensajes son los del dominio; las reglas cruzadas (encaje del
// radio, id únicos, orden de tramos, tipos existentes) las aplica `buildRunRules` desde el
// superRefine del loader.

export const ENEMY_ID_FORMAT =
  'El id de un enemigo usa minúsculas, dígitos y guiones (p. ej. memory-leak).';

const EnemyId = z.string().regex(/^[a-z][a-z0-9-]*$/, { error: ENEMY_ID_FORMAT });
const Count = (error: string) => z.number().int({ error }).min(1, { error });
const Distance = z.number().nonnegative({ error: SPAWN_DISTANCE_MUST_BE_NON_NEGATIVE });

export const PlayerSchema = z.strictObject({
  speed: z.number().positive({ error: SPEED_MUST_BE_POSITIVE }),
  radius: z.number().positive(),
});

export const ArenaSchema = z.strictObject({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  view: z.strictObject({
    width: z.number().positive({ error: VIEW_SIZE_MUST_BE_POSITIVE }),
    height: z.number().positive({ error: VIEW_SIZE_MUST_BE_POSITIVE }),
  }),
});

export const EnemiesSchema = z.strictObject({
  types: z.array(
    z.strictObject({
      id: EnemyId,
      speed: z.number().positive({ error: ENEMY_SPEED_MUST_BE_POSITIVE }),
      radius: z.number().positive({ error: ENEMY_RADIUS_MUST_FIT }),
      cost: z.number().positive({ error: ENEMY_COST_MUST_BE_POSITIVE }),
    }),
  ),
});

export const WavesSchema = z.strictObject({
  maxAlive: Count(MAX_ALIVE_MUST_BE_INTEGER),
  spawn: z.strictObject({
    margin: Distance,
    minDistance: Distance,
    maxAttempts: Count(MAX_ATTEMPTS_MUST_BE_INTEGER),
  }),
  segments: z
    .array(
      z.strictObject({
        fromSecond: z.number().nonnegative(),
        budgetPerSecond: z.number().nonnegative({ error: BUDGET_MUST_BE_NON_NEGATIVE }),
        types: z.array(EnemyId).min(1, { error: SEGMENT_NEEDS_TYPES }),
      }),
    )
    .min(1, { error: WAVES_NEED_SEGMENTS }),
});
