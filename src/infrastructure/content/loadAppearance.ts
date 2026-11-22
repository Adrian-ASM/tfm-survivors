import { err, invalidConfig, ok, type DomainError, type Result } from '../../domain/shared/Result';
import { AppearanceSchema, type Appearance } from './appearanceSchema';

/**
 * Valida los datos de aspecto (design D9). `registered` son las rutas de `files[].path` de la nota de
 * procedencia: una hoja solo vale si figura ahí. El error nombra el campo con su ruta unida por `.`.
 */
export function parseAppearance(
  raw: unknown,
  registered: readonly string[],
): Result<Appearance, DomainError> {
  void registered;
  const parsed = AppearanceSchema.safeParse(raw);
  if (parsed.success) return ok(parsed.data);
  const issue = parsed.error.issues[0];
  const field = (issue?.path ?? []).map(String).join('.');
  return err(invalidConfig(field, issue?.message ?? 'Datos de aspecto inválidos'));
}
