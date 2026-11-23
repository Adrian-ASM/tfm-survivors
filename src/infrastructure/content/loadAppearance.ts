import { err, invalidConfig, ok, type DomainError, type Result } from '../../domain/shared/Result';
import {
  ASSET_DIR,
  AppearanceSchema,
  SHEET_NOT_REGISTERED,
  type Appearance,
  type Aspect,
} from './appearanceSchema';

/** Cada aspecto con su ruta de campo, en el orden del fichero (el error nombra el primero). */
export function aspectsOf(appearance: Appearance): [string[], Aspect][] {
  return [
    [['player'], appearance.player],
    ...Object.entries(appearance.enemies).map(([id, a]): [string[], Aspect] => [
      ['enemies', id],
      a,
    ]),
    [['projectile'], appearance.projectile],
    [['gem'], appearance.gem],
    [['ground'], appearance.ground],
    [['corpse'], appearance.corpse],
  ];
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
