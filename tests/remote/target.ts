// Soporte puro del smoke remoto (design 0011-public-deploy). Sin red ni navegador: lo usan la config
// remota de Playwright, su globalSetup, el spec remoto y los unitarios de Vitest.
import { err, ok, type Result } from '../../src/domain/shared/Result';

/** URL pública del juego (GitHub Pages) y objetivo por defecto del smoke. */
export const PUBLIC_URL = 'https://adrian-asm.github.io/tfm-survivors/';
const PUBLIC_ORIGIN = new URL(PUBLIC_URL).origin;
const WEB_PROTOCOLS = ['http:', 'https:'];

const invalid = (raw: string): string =>
  `SMOKE_URL no es una URL http: o https: válida: "${raw}"`;

/**
 * URL objetivo del smoke a partir de `SMOKE_URL`: sin valor (o en blanco), la pública; con valor,
 * solo `http:` o `https:`, con la `/` final añadida si falta (spec "Barra final opcional").
 */
export function resolveTargetUrl(raw: string | undefined): Result<URL, string> {
  const text = raw?.trim() ?? '';
  if (text === '') return ok(new URL(PUBLIC_URL));
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return err(invalid(text));
  }
  if (!WEB_PROTOCOLS.includes(url.protocol)) return err(invalid(text));
  if (!url.pathname.endsWith('/')) url.pathname = `${url.pathname}/`;
  return ok(url);
}

/** Indica si la URL objetivo es la pública (los tests de 404 y HTTP→HTTPS solo corren contra ella). */
export const isPublicTarget = (url: URL): boolean => url.origin === PUBLIC_ORIGIN;
