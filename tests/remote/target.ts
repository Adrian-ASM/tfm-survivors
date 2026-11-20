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

export type FetchFn = (input: URL, init?: RequestInit) => Promise<Response>;

export interface ReachOptions {
  /** Intentos totales (cada uno es un GET con su propio timeout). */
  readonly attempts: number;
  readonly timeoutMs: number;
  /** Espera entre intentos (no tras el último). */
  readonly gapMs: number;
  readonly sleep: (ms: number) => Promise<void>;
}

const describeFailure = (e: unknown): string =>
  `error de red: ${e instanceof Error ? e.message : String(e)}`;

/**
 * Comprobación previa del smoke (spec "URL objetivo que no responde"): `ok` al primer 200; si
 * ningún intento lo da, `err` con la URL y el último estado o error, distinguible de una regresión.
 */
export async function checkReachable(
  url: URL,
  fetchFn: FetchFn,
  { attempts, timeoutMs, gapMs, sleep }: ReachOptions,
): Promise<Result<URL, string>> {
  let last = 'sin intentos';
  for (let i = 0; i < attempts; i += 1) {
    if (i > 0) await sleep(gapMs);
    try {
      const response = await fetchFn(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (response.status === 200) return ok(url);
      last = `estado ${String(response.status)}`;
    } catch (e) {
      last = describeFailure(e);
    }
  }
  return err(`La carga inicial de ${url.href} no llegó a estado 200 (${last})`);
}

/** Indica si la URL objetivo es la pública (los tests de 404 y HTTP→HTTPS solo corren contra ella). */
export const isPublicTarget = (url: URL): boolean => url.origin === PUBLIC_ORIGIN;
