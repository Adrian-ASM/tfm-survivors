import { err, invalidConfig, ok, type DomainError, type Result } from '../../domain/shared/Result';
import {
  ASSET_DIR,
  AppearanceSchema,
  ROCK_SIZES,
  SHEET_NOT_REGISTERED,
  type Appearance,
  type Aspect,
  type StillAspect,
  type StructureAspect,
} from './appearanceSchema';

/**
 * Aspectos con hoja de los recogibles (0022, 0025): la gema solo si tiene hoja; luego oro, madera,
 * carne y las tres rocas de la piedra, cada una con el color de reserva de `stone` (así la carga, la
 * nota de procedencia y la reserva por hoja las tratan como cualquier otro aspecto).
 */
export function pickupAspectsOf(appearance: Appearance): [string[], StillAspect][] {
  const { xp, gold, wood, meat, stone } = appearance.pickups;
  const out: [string[], StillAspect][] = 'sheet' in xp ? [[['pickups', 'xp'], xp]] : [];
  out.push([['pickups', 'gold'], gold], [['pickups', 'wood'], wood], [['pickups', 'meat'], meat]);
  for (const size of ROCK_SIZES) {
    const rock = { ...stone.rocks[size], placeholderColor: stone.placeholderColor };
    out.push([['pickups', 'stone', 'rocks', size], rock]);
  }
  return out;
}

/** Hojas de la oveja (0023) con su ruta de campo: la de `idle` y la de `bounce`. */
export function sheepSheetsOf(
  appearance: Appearance,
): [string[], { file: string; frameWidth: number; frameHeight: number }][] {
  const { idle, bounce } = appearance.sheep;
  return [
    [['sheep', 'idle', 'sheet'], idle.sheet],
    [['sheep', 'bounce', 'sheet'], bounce.sheet],
  ];
}

/** Aspectos de la veta (0022) con su ruta de campo: activa y agotada. */
export function veinAspectsOf(appearance: Appearance): [string[], StructureAspect][] {
  return [
    [['veins', 'active'], appearance.veins.active],
    [['veins', 'depleted'], appearance.veins.depleted],
  ];
}

/** Aspectos de los solares (0026) con su ruta: obra común, casa y torre. */
export function siteAspectsOf(appearance: Appearance): [string[], StructureAspect][] {
  return [
    [['sites', 'construction'], appearance.sites.construction],
    [['sites', 'house'], appearance.sites.house],
    [['sites', 'tower'], appearance.sites.tower],
  ];
}

/** Cada aspecto con su ruta de campo, en el orden del fichero (el error nombra el primero). */
export function aspectsOf(appearance: Appearance): [string[], Aspect][] {
  return [
    [['player'], appearance.player],
    ...Object.entries(appearance.enemies).map(([id, a]): [string[], Aspect] => [
      ['enemies', id],
      a,
    ]),
    [['projectile'], appearance.projectile],
    ...pickupAspectsOf(appearance),
    [['ground'], appearance.ground],
    [['corpse'], appearance.corpse],
    [['dynamite'], appearance.dynamite],
    [['explosion'], appearance.explosion],
  ];
}

export const TILE_SCALE_MISMATCH =
  'La baldosa a escala debe medir exactamente el tamaño de celda del mapa (ancho y alto).';

/** Error de redondeo admitido al comparar baldosa × escala con la celda (spec, ≤ 0,001). */
const TILE_SCALE_TOLERANCE = 0.001;

/**
 * Baldosas del fondo, del agua y de la orilla a la escala de la celda (spec sprite-rendering 0016):
 * `frameWidth · scale = frameHeight · scale = cellSize` (± 0,001). El error nombra la escala.
 */
export function checkTileScales(
  appearance: Appearance,
  cellSize: number,
): Result<true, DomainError> {
  const tiles = [
    ['ground.scale', appearance.ground],
    ['map.water.scale', appearance.map.water],
    ['map.shore.scale', appearance.map.shore],
  ] as const;
  for (const [field, { sheet, scale }] of tiles) {
    const fits = [sheet.frameWidth, sheet.frameHeight].every(
      (side) => Math.abs(side * scale - cellSize) <= TILE_SCALE_TOLERANCE,
    );
    if (!fits) return err(invalidConfig(field, TILE_SCALE_MISMATCH));
  }
  return ok(true);
}

/** Hojas e imágenes de los aspectos del mapa con su ruta de campo (change 0016). */
export function mapSheetsOf(appearance: Appearance): [string[], string][] {
  const { water, shore, foam, trees, bridges, castle } = appearance.map;
  const sheet = (key: string, file: string): [string[], string] => [
    ['map', key, 'sheet', 'file'],
    file,
  ];
  return [
    sheet('water', water.sheet.file),
    sheet('shore', shore.sheet.file),
    sheet('foam', foam.sheet.file),
    sheet('trees', trees.sheet.file),
    [['map', 'bridges', 'image'], bridges.image],
    sheet('castle', castle.sheet.file),
  ];
}

/** Aspectos de las estructuras (0021) con su ruta de campo, en el orden del fichero. */
export function structureAspectsOf(appearance: Appearance): [string[], StructureAspect][] {
  return Object.entries(appearance.structures).flatMap(([id, looks]) => [
    [['structures', id, 'intact'], looks.intact] as [string[], StructureAspect],
    [['structures', id, 'ruin'], looks.ruin] as [string[], StructureAspect],
  ]);
}

/**
 * Valida los datos de aspecto (design D9). `registered` son las rutas de `files[].path` de la nota de
 * procedencia: una hoja solo vale si figura ahí. El error nombra el campo con su ruta unida por `.`.
 */
export function parseAppearance(
  raw: unknown,
  registered: readonly string[],
): Result<Appearance, DomainError> {
  const known = new Set(registered);
  const schema = AppearanceSchema.superRefine((appearance, ctx) => {
    const sheets: [string[], string][] = [
      ...aspectsOf(appearance).map(([path, a]): [string[], string] => [
        [...path, 'sheet', 'file'],
        a.sheet.file,
      ]),
      ...mapSheetsOf(appearance),
      ...structureAspectsOf(appearance).map(([path, a]): [string[], string] => [
        [...path, 'sheet', 'file'],
        a.sheet.file,
      ]),
      ...veinAspectsOf(appearance).map(([path, a]): [string[], string] => [
        [...path, 'sheet', 'file'],
        a.sheet.file,
      ]),
      ...sheepSheetsOf(appearance).map(([path, sheet]): [string[], string] => [
        [...path, 'file'],
        sheet.file,
      ]),
      ...siteAspectsOf(appearance).map(([path, a]): [string[], string] => [
        [...path, 'sheet', 'file'],
        a.sheet.file,
      ]),
    ];
    for (const [path, file] of sheets) {
      if (!known.has(ASSET_DIR + file))
        ctx.addIssue({ code: 'custom', path, message: SHEET_NOT_REGISTERED });
    }
  });
  const parsed = schema.safeParse(raw);
  if (parsed.success) return ok(parsed.data);
  const issue = parsed.error.issues[0];
  const path = (issue?.path ?? []).map(String);
  // Un campo desconocido se nombra a sí mismo (spec sprite-rendering: "nombra `lava`").
  if (issue?.code === 'unrecognized_keys' && issue.keys[0] !== undefined) path.push(issue.keys[0]);
  const field = path.join('.');
  return err(invalidConfig(field, issue?.message ?? 'Datos de aspecto inválidos'));
}
