import { describe, expect, it } from 'vitest';
import { PUBLIC_URL, isPublicTarget, resolveTargetUrl } from './target';

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

describe('isPublicTarget', () => {
  it('solo el origen https://adrian-asm.github.io es la URL pública', () => {
    expect(isPublicTarget(new URL(PUBLIC_URL))).toBe(true);
    expect(isPublicTarget(new URL('http://localhost:4173/tfm-survivors/'))).toBe(false);
    expect(isPublicTarget(new URL('http://adrian-asm.github.io/tfm-survivors/'))).toBe(false);
  });
});
