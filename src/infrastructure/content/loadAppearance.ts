import type { z } from 'zod';
import { err, invalidConfig, ok, type DomainError, type Result } from '../../domain/shared/Result';
import {
  ASSET_DIR,
  AppearanceSchema,
  FONT_DIR,
  FONT_NOT_REGISTERED,
  ROCK_SIZES,
  SHEET_NOT_REGISTERED,
  UI_PIECES,
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

/**
 * Hojas de aparición de los recogibles (0030) con su ruta de campo (`pickups.<tipo>.spawn.sheet`):
 * las de oro, madera y carne que declaran `spawn`, en ese orden.
 */
export function pickupSpawnSheetsOf(
  appearance: Appearance,
): [string[], { file: string; frameWidth: number; frameHeight: number }][] {
  const { gold, wood, meat } = appearance.pickups;
  const kinds = [
    ['gold', gold],
    ['wood', wood],
    ['meat', meat],
  ] as const;
  return kinds.flatMap(([kind, p]) =>
    p.spawn
      ? [[['pickups', kind, 'spawn', 'sheet'], p.spawn.sheet] as [string[], typeof p.spawn.sheet]]
      : [],
  );
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
    ...decorSheetsOf(appearance),
  ];
}

/** Hojas de la decoración (0029) con su ruta de campo (`map.decor.items.<i>.sheet.file`). */
export function decorSheetsOf(appearance: Appearance): [string[], string][] {
  return appearance.map.decor.items.map((item, i): [string[], string] => [
    ['map', 'decor', 'items', String(i), 'sheet', 'file'],
    item.sheet.file,
  ]);
}

/** Aspectos de las estructuras (0021) con su ruta de campo, en el orden del fichero. */
export function structureAspectsOf(appearance: Appearance): [string[], StructureAspect][] {
  return Object.entries(appearance.structures).flatMap(([id, looks]) => [
    [['structures', id, 'intact'], looks.intact] as [string[], StructureAspect],
    [['structures', id, 'ruin'], looks.ruin] as [string[], StructureAspect],
  ]);
}

type Issue = z.core.$ZodIssue;

/**
 * Error de una unión (la gema `xp`: con hoja o forma de color, 0030): el primero de la rama con menos
 * errores, con la ruta completa, para que nombre el campo (p. ej. `pickups.xp.diameter`).
 */
function closestIssue(issue: Issue | undefined): Issue | undefined {
  if (issue?.code !== 'invalid_union' || issue.errors.length === 0) return issue;
  const branch = issue.errors.reduce((a, b) => (b.length < a.length ? b : a));
  const inner = branch[0];
  if (!inner) return issue;
  return closestIssue({ ...inner, path: [...issue.path, ...inner.path] });
}

/** Hojas de las piezas de UI (0032) con su ruta de campo (`ui.pieces.<rol>.image`), por rol. */
export function uiSheetsOf(appearance: Appearance): [string[], string][] {
  return UI_PIECES.map((role): [string[], string] => [
    ['ui', 'pieces', role, 'image'],
    appearance.ui.pieces[role].image,
  ]);
}

/** Lo que `registeredPaths` necesita de la nota de procedencia. */
export interface ProvenanceLists {
  readonly files: readonly { readonly path: string }[];
  readonly fonts?: readonly { readonly path: string }[];
}

/**
 * Rutas registradas en la nota (0032): las del arte (`files[]`) y las de las fuentes (`fonts[]`), en
 * una sola lista; no chocan porque viven en carpetas distintas (`ASSET_DIR` y `FONT_DIR`).
 */
export function registeredPaths(note: ProvenanceLists): string[] {
  return [...note.files.map((f) => f.path), ...(note.fonts ?? []).map((f) => f.path)];
}

/**
 * Valida los datos de aspecto (design D9). `registered` son las rutas registradas en la nota de
 * procedencia (`registeredPaths`): una hoja o la fuente solo valen si figuran ahí. El error nombra
 * el campo con su ruta unida por `.`.
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
      ...pickupSpawnSheetsOf(appearance).map(([path, sheet]): [string[], string] => [
        [...path, 'file'],
        sheet.file,
      ]),
      ...uiSheetsOf(appearance),
    ];
    for (const [path, file] of sheets) {
      if (known.has(ASSET_DIR + file)) continue;
      // 0029: en la decoración la hoja la identifica (no hay id): el mensaje la nombra.
      const message =
        path[1] === 'decor' ? `${SHEET_NOT_REGISTERED} ${file}` : SHEET_NOT_REGISTERED;
      ctx.addIssue({ code: 'custom', path, message });
    }
    // 0032: la fuente figura en `fonts[]` de la nota (misma lista de rutas registradas).
    if (!known.has(FONT_DIR + appearance.ui.font.file)) {
      ctx.addIssue({
        code: 'custom',
        path: ['ui', 'font', 'file'],
        message: `${FONT_NOT_REGISTERED} ${appearance.ui.font.file}`,
      });
    }
  });
  const parsed = schema.safeParse(raw);
  if (parsed.success) return ok(parsed.data);
  const issue = closestIssue(parsed.error.issues[0]);
  const path = (issue?.path ?? []).map(String);
  // Un campo desconocido se nombra a sí mismo (spec sprite-rendering: "nombra `lava`").
  if (issue?.code === 'unrecognized_keys' && issue.keys[0] !== undefined) path.push(issue.keys[0]);
  const field = path.join('.');
  return err(invalidConfig(field, issue?.message ?? 'Datos de aspecto inválidos'));
}
