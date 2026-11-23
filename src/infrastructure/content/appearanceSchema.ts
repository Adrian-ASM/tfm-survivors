import { z } from 'zod';

// Datos de aspecto (change 0012, design D9): cómo se pinta cada elemento. Es presentación, no
// contenido de juego: vive en infraestructura y no llega al dominio. Estricto en todos los niveles.

export const FRAME_SIZE_MUST_BE_INTEGER = 'El tamaño de frame es un entero ≥ 1.';
export const SCALE_MUST_BE_POSITIVE = 'La escala es un número > 0.';
export const ORIGIN_OUT_OF_RANGE = 'El origen está en [0, 1].';
export const FPS_MUST_BE_POSITIVE = 'Los fps son un número > 0.';
export const FRAMES_REQUIRED = 'Una animación tiene al menos un frame.';
export const FRAME_INDEX_MUST_BE_INTEGER = 'Un índice de frame es un entero ≥ 0.';
export const MAX_CORPSES_MUST_BE_INTEGER = 'El tope de cadáveres es un entero ≥ 1.';
export const COLOR_FORMAT = 'El color de reserva es #rrggbb.';
export const DEATH_MUST_NOT_LOOP = 'La animación de muerte no va en bucle.';

const FrameSize = z
  .number()
  .int({ error: FRAME_SIZE_MUST_BE_INTEGER })
  .min(1, { error: FRAME_SIZE_MUST_BE_INTEGER });
const Unit = z
  .number()
  .min(0, { error: ORIGIN_OUT_OF_RANGE })
  .max(1, { error: ORIGIN_OUT_OF_RANGE });
const Hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, { error: COLOR_FORMAT })
  .transform((s) => Number.parseInt(s.slice(1), 16));

const Frames = z
  .array(
    z
      .number()
      .int({ error: FRAME_INDEX_MUST_BE_INTEGER })
      .min(0, { error: FRAME_INDEX_MUST_BE_INTEGER }),
  )
  .min(1, { error: FRAMES_REQUIRED });
const Fps = z.number().positive({ error: FPS_MUST_BE_POSITIVE });

const AnimSchema = z.strictObject({ frames: Frames, fps: Fps, loop: z.boolean() });
const DeathSchema = z.strictObject({
  frames: Frames,
  fps: Fps,
  loop: z.literal(false, { error: DEATH_MUST_NOT_LOOP }),
});

export const SHEET_FILE_FORMAT =
  'La hoja es una ruta .png relativa a la carpeta de assets, sin "..", sin "/" inicial ni esquema.';
export const SHEET_NOT_REGISTERED =
  'La hoja no figura en la nota de procedencia (content/asset-provenance.json).';
/** Carpeta versionada del arte: la ruta en la nota es esta carpeta + `file`. */
export const ASSET_DIR = 'public/assets/tiny-swords/';

/** Ruta de la hoja (design D2); `parseAppearance` comprueba además que figura en la nota. */
const SheetFile = z
  .string()
  .regex(/^(?!.*\.\.)[A-Za-z0-9_][A-Za-z0-9_./-]*\.png$/, { error: SHEET_FILE_FORMAT });

const BaseShape = {
  sheet: z.strictObject({ file: SheetFile, frameWidth: FrameSize, frameHeight: FrameSize }),
  scale: z.number().positive({ error: SCALE_MUST_BE_POSITIVE }),
  origin: z.strictObject({ x: Unit, y: Unit }),
  facing: z.enum(['right', 'left']),
  placeholderColor: Hex,
};

export const StillSchema = z.strictObject({ ...BaseShape, idle: AnimSchema });
export const MovingSchema = z.strictObject({ ...BaseShape, idle: AnimSchema, walk: AnimSchema });
export const CorpseSchema = z.strictObject({ ...BaseShape, death: DeathSchema });

export const TERRAIN_COLORS_MUST_DIFFER =
  'Los colores del mapa (trunk, water, bridge) son distintos dos a dos.';

/**
 * Colores lisos de las celdas del mapa (change 0015): uno por tipo no-hierba, `#RRGGBB`, distintos
 * dos a dos. El error de un color repetido nombra el último de los dos en el orden del fichero.
 */
const TerrainSchema = z
  .strictObject({ trunk: Hex, water: Hex, bridge: Hex })
  .superRefine((colors, ctx) => {
    const seen = new Set<number>();
    for (const key of ['trunk', 'water', 'bridge'] as const) {
      if (seen.has(colors[key])) {
        ctx.addIssue({ code: 'custom', path: [key], message: TERRAIN_COLORS_MUST_DIFFER });
      }
      seen.add(colors[key]);
    }
  });

export const AppearanceSchema = z.strictObject({
  maxCorpses: z
    .number()
    .int({ error: MAX_CORPSES_MUST_BE_INTEGER })
    .min(1, { error: MAX_CORPSES_MUST_BE_INTEGER }),
  player: MovingSchema,
  enemies: z.record(z.string(), MovingSchema),
  projectile: StillSchema,
  gem: StillSchema,
  ground: StillSchema,
  corpse: CorpseSchema,
  terrain: TerrainSchema,
});

export type Appearance = z.output<typeof AppearanceSchema>;
export type Anim = z.output<typeof AnimSchema> | z.output<typeof DeathSchema>;
export type StillAspect = z.output<typeof StillSchema>;
export type MovingAspect = z.output<typeof MovingSchema>;
export type CorpseAspect = z.output<typeof CorpseSchema>;
/** Lo común a todos los aspectos: hoja, escala, origen, orientación y color de reserva. */
export type Aspect = StillAspect | MovingAspect | CorpseAspect;
