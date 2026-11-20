import { describe, expect, it } from 'vitest';
import { PUBLIC_URL, checkReachable, isPublicTarget, resolveTargetUrl } from './target';

// Spec public-deploy, "Smoke a demanda contra una URL": soporte puro del smoke remoto, sin red.
const hrefOf = (raw: string | undefined): string | null => {
  const r = resolveTargetUrl(raw);
  return r.ok ? r.value.href : null;
};
const errorOf = (raw: string): string | null => {
  const r = resolveTargetUrl(raw);
  return r.ok ? null : r.error;
};

describe('resolveTargetUrl (spec public-deploy)', () => {
  it('Scenario: Smoke en verde contra la URL pública (sin URL indicada, la pública)', () => {
    expect([hrefOf(undefined), hrefOf(''), hrefOf('   ')]).toEqual([
      PUBLIC_URL,
      PUBLIC_URL,
      PUBLIC_URL,
    ]);
    expect(PUBLIC_URL).toBe('https://adrian-asm.github.io/tfm-survivors/');
  });

  it('Scenario: Barra final opcional', () => {
    expect(hrefOf('https://adrian-asm.github.io/tfm-survivors')).toBe(PUBLIC_URL);
    expect(hrefOf('http://localhost:4173/tfm-survivors')).toBe(
      'http://localhost:4173/tfm-survivors/',
    );
    expect(hrefOf('http://localhost:4173/tfm-survivors/')).toBe(
      'http://localhost:4173/tfm-survivors/',
    );
  });

  it('Scenario: URL objetivo inválida (ftp://ejemplo y no-es-una-url, con la URL en el mensaje)', () => {
    const ftp = errorOf('ftp://ejemplo');
    const text = errorOf('no-es-una-url');

    expect(ftp).toContain('ftp://ejemplo');
    expect(text).toContain('no-es-una-url');
  });
});

describe('checkReachable (preflight, fetch falso)', () => {
  const url = new URL('https://adrian-asm.github.io/tfm-survivors-no-existe/');
  type Reply = number | 'network';

  /** fetch falso: responde con la secuencia dada y anota cada llamada y su señal. */
  const fakeFetch = (replies: Reply[]) => {
    const calls: { url: string; signal: AbortSignal | null | undefined }[] = [];
    const fetchFn = (input: URL, init?: RequestInit): Promise<Response> => {
      calls.push({ url: input.href, signal: init?.signal });
      const reply = replies[calls.length - 1] ?? 'network';
      return reply === 'network'
        ? Promise.reject(new TypeError('fetch failed'))
        : Promise.resolve(new Response(null, { status: reply }));
    };
    return { calls, fetchFn };
  };
  const sleeps: number[] = [];
  const options = {
    attempts: 3,
    timeoutMs: 10_000,
    gapMs: 5_000,
    sleep: (ms: number) => {
      sleeps.push(ms);
      return Promise.resolve();
    },
  };

  it('devuelve ok al primer 200, sin más intentos', async () => {
    const { calls, fetchFn } = fakeFetch([503, 200, 200]);
    sleeps.length = 0;

    const result = await checkReachable(url, fetchFn, options);

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(2);
    expect(sleeps).toEqual([5_000]);
  });

  it('Scenario: URL objetivo que no responde (404 en todos los intentos)', async () => {
    const { calls, fetchFn } = fakeFetch([404, 404, 404]);
    sleeps.length = 0;

    const result = await checkReachable(url, fetchFn, options);

    expect(result.ok ? null : result.error).toMatch(/no llegó a estado 200/);
    expect(result.ok ? null : result.error).toContain(url.href);
    expect(result.ok ? null : result.error).toContain('404');
    expect(calls).toHaveLength(3);
    expect(calls.every((c) => c.url === url.href && c.signal instanceof AbortSignal)).toBe(true);
    expect(sleeps).toEqual([5_000, 5_000]);
  });

  it('Scenario: URL objetivo que no responde (error de red en todos los intentos)', async () => {
    const { calls, fetchFn } = fakeFetch(['network', 'network', 'network']);

    const result = await checkReachable(url, fetchFn, options);

    expect(result.ok ? null : result.error).toMatch(/no llegó a estado 200 \(error de red/);
    expect(result.ok ? null : result.error).toContain(url.href);
    expect(calls).toHaveLength(3);
  });
});

describe('isPublicTarget', () => {
  it('solo el origen https://adrian-asm.github.io es la URL pública', () => {
    expect(isPublicTarget(new URL(PUBLIC_URL))).toBe(true);
    expect(isPublicTarget(new URL('http://localhost:4173/tfm-survivors/'))).toBe(false);
    expect(isPublicTarget(new URL('http://adrian-asm.github.io/tfm-survivors/'))).toBe(false);
  });
});
