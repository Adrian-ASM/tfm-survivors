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

/**
 * Ruta de la hoja (design D2); `parseAppearance` comprueba además que figura en la nota. Admite
 * espacios dentro de la ruta (0022: carpeta `Gold Mine` del pack); `assetUrl` codifica cada segmento.
 */
const SheetFile = z
  .string()
  .regex(/^(?!.*\.\.)[A-Za-z0-9_][A-Za-z0-9_ ./-]*\.png$/, { error: SHEET_FILE_FORMAT });

const SheetSchema = z.strictObject({
  file: SheetFile,
  frameWidth: FrameSize,
  frameHeight: FrameSize,
});

const BaseShape = {
  sheet: SheetSchema,
  scale: z.number().positive({ error: SCALE_MUST_BE_POSITIVE }),
  origin: z.strictObject({ x: Unit, y: Unit }),
  facing: z.enum(['right', 'left']),
  placeholderColor: Hex,
};

export const StillSchema = z.strictObject({ ...BaseShape, idle: AnimSchema });
export const MovingSchema = z.strictObject({ ...BaseShape, idle: AnimSchema, walk: AnimSchema });
export const CorpseSchema = z.strictObject({ ...BaseShape, death: DeathSchema });

/** Tamaños de roca de la piedra (0025): uno por hoja de `Deco`. */
export const ROCK_SIZES = ['small', 'medium', 'large'] as const;
export type RockSize = (typeof ROCK_SIZES)[number];

/**
 * Enemigo (0020): `idle`/`walk` y, si su comportamiento las pide, `fuse` (mecha) y `throw` (carga),
 * de la misma hoja. La exigencia por clase de estado la comprueba la composición con el contenido.
 * `rock` (0025): roca con la que se pinta la piedra que suelta; solo presentación.
 */
export const EnemyAspectSchema = z.strictObject({
  ...BaseShape,
  idle: AnimSchema,
  walk: AnimSchema,
  fuse: AnimSchema.optional(),
  throw: AnimSchema.optional(),
  rock: z.enum(ROCK_SIZES),
});

/** Animación con su propia hoja (oveja, 0023): cada animación puede venir de un fichero distinto. */
const SheetAnimSchema = z.strictObject({
  sheet: SheetSchema,
  frames: Frames,
  fps: Fps,
  loop: z.boolean(),
});

/**
 * Oveja (0023, design §10): `idle` (pasto) y `bounce` (paseo y huida), **cada una con su hoja**
 * (`HappySheep_Idle` y `HappySheep_Bouncing`), con escala, origen, orientación y color de reserva
 * comunes. Pasar a una hoja única (`HappySheep_All`) sería solo cambiar los datos.
 */
export const SheepAspectSchema = z.strictObject({
  scale: BaseShape.scale,
  origin: BaseShape.origin,
  facing: BaseShape.facing,
  placeholderColor: Hex,
  idle: SheetAnimSchema,
  bounce: SheetAnimSchema,
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
export const TREE_MUST_LOOP = 'La animación del árbol va en bucle.';
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

export const DECOR_ITEMS_REQUIRED = 'La decoración necesita al menos un aspecto.';
export const DECOR_MAX_OBJECTS_MUST_BE_INTEGER = 'El tope de decoración es un entero ≥ 0.';
export const DECOR_DENSITY_MUST_BE_POSITIVE = 'La densidad de la decoración es un número > 0.';
export const DECOR_MARGIN_MUST_BE_INTEGER = 'El margen del castillo es un entero ≥ 0.';
export const DECOR_SHEET_REPEATED = 'Dos aspectos de decoración no pueden usar la misma hoja';
export const DECOR_SHEET_IS_ROCK = 'Un aspecto de decoración no puede usar la hoja de una roca';

/**
 * Aspecto de decoración (0029, design §Datos): una sola hoja (que lo identifica), su frame, escala,
 * origen y si es alta (base en la capa baja y parte alta en la alta, como el árbol). Sin pesos,
 * volteo ni `id`.
 */
const DecorItemSchema = z.strictObject({
  sheet: BaseShape.sheet,
  frame: FrameIndex,
  scale: BaseShape.scale,
  origin: BaseShape.origin,
  tall: z.boolean(),
});

/**
 * Decoración del mapa generado (0029): aspectos, tope en objetos de escena (sobre los datos),
 * densidad (celdas válidas por decoración esperada) y margen de la huella del castillo en celdas.
 */
const DecorSchema = z.strictObject({
  density: z.number().positive({ error: DECOR_DENSITY_MUST_BE_POSITIVE }),
  maxObjects: z
    .number()
    .int({ error: DECOR_MAX_OBJECTS_MUST_BE_INTEGER })
    .min(0, { error: DECOR_MAX_OBJECTS_MUST_BE_INTEGER }),
  castleMargin: z
    .number()
    .int({ error: DECOR_MARGIN_MUST_BE_INTEGER })
    .min(0, { error: DECOR_MARGIN_MUST_BE_INTEGER }),
  items: z.array(DecorItemSchema).min(1, { error: DECOR_ITEMS_REQUIRED }),
});

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
  // 0029: el árbol reproduce su `idle` en bucle con una fase por celda (antes, modelos fijos).
  trees: z.strictObject({
    ...MapShape,
    idle: z.strictObject({
      frames: Frames,
      fps: Fps,
      loop: z.literal(true, { error: TREE_MUST_LOOP }),
    }),
    flip: z.boolean(),
  }),
  bridges: z.strictObject({
    image: SheetFile,
    scale: BaseShape.scale,
    origin: BaseShape.origin,
    frames: z.strictObject({ northSouth: RectSchema, eastWest: RectSchema }),
  }),
  castle: z.strictObject({ ...MapShape, frame: FrameIndex }),
  decor: DecorSchema,
});

/**
 * Aspecto de una estructura (0021): hoja regular, escala, origen, orientación e `idle` (frame 0 en
 * el plan). Sin color propio: la reserva usa los de `structureColors`.
 */
export const StructureAspectSchema = z.strictObject({
  sheet: BaseShape.sheet,
  scale: BaseShape.scale,
  origin: BaseShape.origin,
  facing: BaseShape.facing,
  idle: AnimSchema,
});

/** Aspectos de un tipo de estructura: intacto y ruina, los dos obligatorios. */
const StructureLooksSchema = z.strictObject({
  intact: StructureAspectSchema,
  ruin: StructureAspectSchema,
});

/** Clave del color de reserva de las ruinas en `structureColors` (uno para todos los tipos). */
export const RUIN_COLOR_KEY = 'ruin';
export const RUIN_COLOR_REQUIRED =
  'Falta el color de reserva de las ruinas (structureColors.ruin).';
export const STRUCTURE_COLORS_MUST_DIFFER =
  'Los colores de reserva de las estructuras son distintos entre sí y de los del mapa.';

/**
 * Colores de reserva de las estructuras (0021): uno por tipo y el de ruina, distintos dos a dos y
 * de los del mapa. El error de un color repetido nombra el primero en el orden del fichero que
 * repite uno anterior o uno del mapa; el de ruina se compara primero.
 */
function checkStructureColors(
  colors: Readonly<Record<string, number>>,
  terrain: Readonly<Record<string, number>>,
  ctx: z.RefinementCtx,
): void {
  const ruin = colors[RUIN_COLOR_KEY];
  if (ruin === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['structureColors', RUIN_COLOR_KEY],
      message: RUIN_COLOR_REQUIRED,
    });
    return;
  }
  const seen = new Set<number>(Object.values(terrain));
  const keys = [RUIN_COLOR_KEY, ...Object.keys(colors).filter((k) => k !== RUIN_COLOR_KEY)];
  for (const key of keys) {
    const color = colors[key] ?? 0;
    if (seen.has(color)) {
      ctx.addIssue({
        code: 'custom',
        path: ['structureColors', key],
        message: STRUCTURE_COLORS_MUST_DIFFER,
      });
      return;
    }
    seen.add(color);
  }
}

/** Aspectos de los solares (0026): la obra común a todo solar libre, la casa y la torre. */
const SiteLooksSchema = z.strictObject({
  construction: StructureAspectSchema,
  house: StructureAspectSchema,
  tower: StructureAspectSchema,
});

export const SITE_COLORS_MUST_DIFFER =
  'Los colores de reserva de los solares son distintos entre sí y de los del mapa y las estructuras.';

/** Colores de reserva de los solares (0026): obra, casa y torre, `#RRGGBB`. */
const SiteColorsSchema = z.strictObject({ construction: Hex, house: Hex, tower: Hex });

/**
 * Colores de los solares distintos dos a dos y de los del mapa y de las estructuras (spec
 * sprite-rendering 0026); el error nombra el primero repetido en el orden obra, casa, torre.
 */
function checkSiteColors(a: z.output<typeof AppearanceShape>, ctx: z.RefinementCtx): void {
  const seen = new Set<number>([...Object.values(a.terrain), ...Object.values(a.structureColors)]);
  for (const key of ['construction', 'house', 'tower'] as const) {
    const color = a.siteColors[key];
    if (seen.has(color)) {
      ctx.addIssue({ code: 'custom', path: ['siteColors', key], message: SITE_COLORS_MUST_DIFFER });
      return;
    }
    seen.add(color);
  }
}

/**
 * Gema (`xp`) sin hoja (0022, design §5): forma de color con el pintado de reserva. Nunca cuenta como
 * reserva en la sonda y no exige `idle`.
 */
const XpShapeSchema = z.strictObject({ shape: z.literal(true), placeholderColor: Hex });

/** Roca de la piedra (0025): un aspecto quieto sin color propio (el de reserva es de `stone`). */
const RockAspectSchema = z.strictObject({
  sheet: BaseShape.sheet,
  scale: BaseShape.scale,
  origin: BaseShape.origin,
  facing: BaseShape.facing,
  idle: AnimSchema,
});

/** Piedra (0025): un color de reserva y exactamente las tres rocas. */
const StoneLooksSchema = z.strictObject({
  placeholderColor: Hex,
  rocks: z.strictObject({
    small: RockAspectSchema,
    medium: RockAspectSchema,
    large: RockAspectSchema,
  }),
});

/**
 * Aspectos de los recogibles (0022, 0023, 0025): exactamente los tipos de la unión `xp | gold |
 * wood | meat | stone`. La gema puede tener hoja (distinta de las de oro, madera, carne y piedra) o
 * ser una forma de color.
 */
const PickupLooksSchema = z.strictObject({
  xp: z.union([StillSchema, XpShapeSchema]),
  gold: StillSchema,
  wood: StillSchema,
  meat: StillSchema,
  stone: StoneLooksSchema,
});

/** Aspectos de la veta (0022): activa y agotada, sin color propio (la reserva usa `veinColor`). */
const VeinLooksSchema = z.strictObject({
  active: StructureAspectSchema,
  depleted: StructureAspectSchema,
});

export const XP_SHEET_MUST_DIFFER =
  'La hoja de la gema (xp) debe ser distinta de las del oro, la madera, la carne y la piedra.';
export const RESOURCE_COLORS_MUST_DIFFER =
  'Los colores de reserva de los recogibles y de la veta son distintos dos a dos, de los del mapa y ' +
  'de los de las estructuras.';

/**
 * Colores de reserva de los recogibles (xp, gold, wood, meat) y de la veta (0022, 0023): distintos dos a dos y
 * de los del mapa y de las estructuras, y el de la oveja (0023), distinto de todos ellos. El error
 * nombra el primero, en ese orden (la carne y la oveja, de 0023, van tras la veta, y la piedra, de
 * 0025, tras la oveja), que repite uno.
 */
function checkResourceColors(a: z.output<typeof AppearanceShape>, ctx: z.RefinementCtx): void {
  const seen = new Set<number>([...Object.values(a.terrain), ...Object.values(a.structureColors)]);
  const colors: [string[], number][] = [
    [['pickups', 'xp', 'placeholderColor'], a.pickups.xp.placeholderColor],
    [['pickups', 'gold', 'placeholderColor'], a.pickups.gold.placeholderColor],
    [['pickups', 'wood', 'placeholderColor'], a.pickups.wood.placeholderColor],
    [['veinColor'], a.veinColor],
    [['pickups', 'meat', 'placeholderColor'], a.pickups.meat.placeholderColor],
    [['sheep', 'placeholderColor'], a.sheep.placeholderColor],
    [['pickups', 'stone', 'placeholderColor'], a.pickups.stone.placeholderColor],
  ];
  for (const [path, color] of colors) {
    if (seen.has(color)) {
      ctx.addIssue({ code: 'custom', path, message: RESOURCE_COLORS_MUST_DIFFER });
      return;
    }
    seen.add(color);
  }
  const { xp, gold, wood, meat, stone } = a.pickups;
  const rocks = ROCK_SIZES.map((size) => stone.rocks[size].sheet.file);
  const others = [gold.sheet.file, wood.sheet.file, meat.sheet.file, ...rocks];
  if ('sheet' in xp && others.includes(xp.sheet.file)) {
    ctx.addIssue({
      code: 'custom',
      path: ['pickups', 'xp', 'sheet', 'file'],
      message: XP_SHEET_MUST_DIFFER,
    });
  }
}

const AppearanceShape = z.strictObject({
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
  /** Por tipo de recogible (0022, 0023, 0025): `xp` (la gema), `gold`, `wood`, `meat` y `stone`. */
  pickups: PickupLooksSchema,
  /** Oveja (0023): `idle` y `bounce` con su hoja cada una. */
  sheep: SheepAspectSchema,
  ground: StillSchema,
  corpse: CorpseSchema,
  dynamite: StillSchema,
  explosion: ExplosionSchema,
  warnings: WarningsSchema,
  terrain: TerrainSchema,
  map: MapAppearanceSchema,
  /** Por tipo de estructura del contenido (0021); el cruce con el contenido lo hace el arranque. */
  structures: z.record(z.string(), StructureLooksSchema),
  structureColors: z.record(z.string(), Hex),
  /** Veta activa y agotada (0022), en el plan del mapa. */
  veins: VeinLooksSchema,
  /** Color de reserva de la veta: círculo de su radio de contacto. */
  veinColor: Hex,
  /** Solares (0026): obra común, casa y torre, en el plan del mapa. */
  sites: SiteLooksSchema,
  siteColors: SiteColorsSchema,
});

/**
 * Hojas de la decoración (0029): distintas entre sí (la hoja identifica el aspecto) y ninguna de una
 * roca de la piedra. El error nombra la hoja en el mensaje y el campo en la ruta.
 */
function checkDecorSheets(a: z.output<typeof AppearanceShape>, ctx: z.RefinementCtx): void {
  const rocks = new Set(ROCK_SIZES.map((size) => a.pickups.stone.rocks[size].sheet.file));
  const seen = new Set<string>();
  a.map.decor.items.forEach((item, i) => {
    const file = item.sheet.file;
    const path = ['map', 'decor', 'items', i, 'sheet', 'file'];
    if (rocks.has(file)) {
      ctx.addIssue({ code: 'custom', path, message: `${DECOR_SHEET_IS_ROCK}: ${file}.` });
    } else if (seen.has(file)) {
      ctx.addIssue({ code: 'custom', path, message: `${DECOR_SHEET_REPEATED}: ${file}.` });
    }
    seen.add(file);
  });
}

export const AppearanceSchema = AppearanceShape.superRefine((a, ctx) => {
  checkStructureColors(a.structureColors, a.terrain, ctx);
  checkResourceColors(a, ctx);
  checkSiteColors(a, ctx);
  checkDecorSheets(a, ctx);
});

export type Appearance = z.output<typeof AppearanceSchema>;
export type StructureAspect = z.output<typeof StructureAspectSchema>;
export type StructureLooksAppearance = z.output<typeof StructureLooksSchema>;
export type SiteLooksAppearance = z.output<typeof SiteLooksSchema>;
export type SiteColors = z.output<typeof SiteColorsSchema>;
export type MapAppearance = z.output<typeof MapAppearanceSchema>;
/** Decoración del mapa generado (0029). */
export type DecorAppearance = z.output<typeof DecorSchema>;
export type DecorItem = z.output<typeof DecorItemSchema>;
/** Recorte en px de una hoja no regular (marcos del puente). */
export type SheetRect = z.output<typeof RectSchema>;
export type Anim =
  z.output<typeof AnimSchema> | z.output<typeof DeathSchema> | ExplosionAspect['explode'];
export type StillAspect = z.output<typeof StillSchema>;
/** Gema sin hoja (0022): forma de color. */
export type XpShapeAspect = z.output<typeof XpShapeSchema>;
export type PickupLooksAppearance = z.output<typeof PickupLooksSchema>;
export type StoneLooksAppearance = z.output<typeof StoneLooksSchema>;
export type SheepAspect = z.output<typeof SheepAspectSchema>;
export type VeinLooksAppearance = z.output<typeof VeinLooksSchema>;
export type MovingAspect = z.output<typeof MovingSchema>;
export type CorpseAspect = z.output<typeof CorpseSchema>;
export type EnemyAspect = z.output<typeof EnemyAspectSchema>;
export type ExplosionAspect = z.output<typeof ExplosionSchema>;
export type WarningLooks = z.output<typeof WarningsSchema>;
/** Lo común a todos los aspectos: hoja, escala, origen, orientación y color de reserva. */
export type Aspect = StillAspect | MovingAspect | CorpseAspect | EnemyAspect | ExplosionAspect;
