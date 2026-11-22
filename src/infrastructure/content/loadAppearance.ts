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
    for (const [path, aspect] of aspectsOf(appearance)) {
      if (!known.has(ASSET_DIR + aspect.sheet.file))
        ctx.addIssue({
          code: 'custom',
          path: [...path, 'sheet', 'file'],
          message: SHEET_NOT_REGISTERED,
        });
    }
  });
  const parsed = schema.safeParse(raw);
  if (parsed.success) return ok(parsed.data);
  const issue = parsed.error.issues[0];
  const field = (issue?.path ?? []).map(String).join('.');
  return err(invalidConfig(field, issue?.message ?? 'Datos de aspecto inválidos'));
}
