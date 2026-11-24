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
export const EXPLODE_MUST_NOT_LOOP = 'La animación de la explosión no va en bucle.';
export const ALPHA_OUT_OF_RANGE = 'La opacidad de un aviso está en (0, 1).';
export const MAX_BLAST_SPRITES_MUST_BE_INTEGER =
  'El tope de explosiones pintadas es un entero ≥ 1.';

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

/**
 * Enemigo (0020): `idle`/`walk` y, si su comportamiento las pide, `fuse` (mecha) y `throw` (carga),
 * de la misma hoja. La exigencia por clase de estado la comprueba la composición con el contenido.
 */
export const EnemyAspectSchema = z.strictObject({
  ...BaseShape,
  idle: AnimSchema,
  walk: AnimSchema,
  fuse: AnimSchema.optional(),
  throw: AnimSchema.optional(),
});

/** Explosión (0020): `explode` se reproduce una vez y se queda en su último frame. */
export const ExplosionSchema = z.strictObject({
  ...BaseShape,
  explode: z.strictObject({
    frames: Frames,
    fps: Fps,
    loop: z.literal(false, { error: EXPLODE_MUST_NOT_LOOP }),
  }),
});

const Alpha = z
  .number({ error: ALPHA_OUT_OF_RANGE })
  .gt(0, { error: ALPHA_OUT_OF_RANGE })
  .lt(1, { error: ALPHA_OUT_OF_RANGE });
const WarningLook = z.strictObject({ color: Hex, alpha: Alpha });

/** Avisos en el suelo (0020): forma de color sin hoja, uno por origen; deja ver lo que cubre. */
const WarningsSchema = z.strictObject({ fuse: WarningLook, dynamite: WarningLook });

export const TERRAIN_COLORS_MUST_DIFFER =
  'Los colores del mapa (trunk, water, bridge, castle) son distintos dos a dos.';

const TERRAIN_KEYS = ['trunk', 'water', 'bridge', 'castle'] as const;

/**
 * Colores lisos de las celdas del mapa (changes 0015 y 0016): uno por tipo no-hierba, `#RRGGBB`,
 * distintos dos a dos. El error de un color repetido nombra el último de los dos en el orden del
 * fichero.
 */
const TerrainSchema = z
  .strictObject({ trunk: Hex, water: Hex, bridge: Hex, castle: Hex })
  .superRefine((colors, ctx) => {
    const seen = new Set<number>();
    for (const key of TERRAIN_KEYS) {
      if (seen.has(colors[key])) {
        ctx.addIssue({ code: 'custom', path: [key], message: TERRAIN_COLORS_MUST_DIFFER });
      }
      seen.add(colors[key]);
    }
  });

export const FOAM_MUST_LOOP = 'La animación de la espuma va en bucle.';
export const MODELS_REQUIRED = 'El árbol necesita al menos un modelo.';
export const RECT_ORIGIN_MUST_BE_INTEGER = 'El recorte empieza en enteros ≥ 0.';

/**
 * Casos de orilla (design 0016 §12.2 B2): lados de la celda de tierra que dan a río, con las letras
 * en orden N-E-S-W. 15 casos: el vacío no es orilla.
 */
export const SHORE_CASES = [
  'N',
  'E',
  'S',
  'W',
  'NE',
  'NS',
  'NW',
  'ES',
  'EW',
  'SW',
  'NES',
  'NEW',
  'NSW',
  'ESW',
  'NESW',
] as const;
export type ShoreCase = (typeof SHORE_CASES)[number];

const FrameIndex = z
  .number()
  .int({ error: FRAME_INDEX_MUST_BE_INTEGER })
  .min(0, { error: FRAME_INDEX_MUST_BE_INTEGER });
const RectStart = z
  .number()
  .int({ error: RECT_ORIGIN_MUST_BE_INTEGER })
  .min(0, { error: RECT_ORIGIN_MUST_BE_INTEGER });
/** Recorte en px de una hoja no regular; el encaje en la imagen se comprueba al cargarla. */
const RectSchema = z.strictObject({
  x: RectStart,
  y: RectStart,
  width: FrameSize,
  height: FrameSize,
});

/** Lo común a cada aspecto del mapa: hoja regular, escala y origen. */
const MapShape = {
  sheet: BaseShape.sheet,
  scale: BaseShape.scale,
  origin: BaseShape.origin,
};

/** Aspectos del mapa (change 0016, design §5.1 y §12.2 B2); todo estricto. */
const MapAppearanceSchema = z.strictObject({
  water: z.strictObject({ ...MapShape, frame: FrameIndex }),
  shore: z.strictObject({
    ...MapShape,
    cases: z.strictObject(
      Object.fromEntries(SHORE_CASES.map((k) => [k, FrameIndex])) as Record<
        ShoreCase,
        typeof FrameIndex
      >,
    ),
  }),
  foam: z.strictObject({
    ...MapShape,
    idle: z.strictObject({
      frames: Frames,
      fps: Fps,
      loop: z.literal(true, { error: FOAM_MUST_LOOP }),
    }),
  }),
  trees: z.strictObject({
    ...MapShape,
    models: z.array(z.strictObject({ frame: FrameIndex })).min(1, { error: MODELS_REQUIRED }),
    flip: z.boolean(),
  }),
  bridges: z.strictObject({
    image: SheetFile,
    scale: BaseShape.scale,
    origin: BaseShape.origin,
    frames: z.strictObject({ northSouth: RectSchema, eastWest: RectSchema }),
  }),
  castle: z.strictObject({ ...MapShape, frame: FrameIndex }),
});

export const AppearanceSchema = z.strictObject({
  maxCorpses: z
    .number()
    .int({ error: MAX_CORPSES_MUST_BE_INTEGER })
    .min(1, { error: MAX_CORPSES_MUST_BE_INTEGER }),
  player: MovingSchema,
  maxBlastSprites: z
    .number()
    .int({ error: MAX_BLAST_SPRITES_MUST_BE_INTEGER })
    .min(1, { error: MAX_BLAST_SPRITES_MUST_BE_INTEGER }),
  enemies: z.record(z.string(), EnemyAspectSchema),
  projectile: StillSchema,
  gem: StillSchema,
  ground: StillSchema,
  corpse: CorpseSchema,
  dynamite: StillSchema,
  explosion: ExplosionSchema,
  warnings: WarningsSchema,
  terrain: TerrainSchema,
  map: MapAppearanceSchema,
});

export type Appearance = z.output<typeof AppearanceSchema>;
export type MapAppearance = z.output<typeof MapAppearanceSchema>;
/** Recorte en px de una hoja no regular (marcos del puente). */
export type SheetRect = z.output<typeof RectSchema>;
export type Anim =
  z.output<typeof AnimSchema> | z.output<typeof DeathSchema> | ExplosionAspect['explode'];
export type StillAspect = z.output<typeof StillSchema>;
export type MovingAspect = z.output<typeof MovingSchema>;
export type CorpseAspect = z.output<typeof CorpseSchema>;
export type EnemyAspect = z.output<typeof EnemyAspectSchema>;
export type ExplosionAspect = z.output<typeof ExplosionSchema>;
export type WarningLooks = z.output<typeof WarningsSchema>;
/** Lo común a todos los aspectos: hoja, escala, origen, orientación y color de reserva. */
export type Aspect = StillAspect | MovingAspect | CorpseAspect | EnemyAspect | ExplosionAspect;
