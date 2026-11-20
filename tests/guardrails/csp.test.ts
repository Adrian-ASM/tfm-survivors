import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cspOf, parseCsp, relaxCspForDev } from '../../config/csp';

// Spec progress-persistence, "Política de seguridad de contenido". La build copia esta meta tal
// cual (el plugin de desarrollo solo actúa en `serve`); el E2E lo comprueba en la página servida.
const html = readFileSync(join(import.meta.dirname, '..', '..', 'index.html'), 'utf8');
const META = /<meta\s+http-equiv="Content-Security-Policy"[^>]*>/gi;

const policy = parseCsp(cspOf(html) ?? '');
const sources = (directive: string): string[] => policy.get(directive) ?? [];

describe('CSP de index.html (spec progress-persistence)', () => {
  it('Scenario: CSP presente y restrictiva (exactamente una meta)', () => {
    expect(html.match(META)).toHaveLength(1);
  });

  it('es el primer elemento de <head> tras <meta charset>', () => {
    const head = /<head>([\s\S]*?)<\/head>/i.exec(html)?.[1] ?? '';
    const tags = head.match(/<[a-z][^>]*>/gi) ?? [];

    expect(tags[0]).toMatch(/<meta charset=/i);
    expect(tags[1]).toMatch(/http-equiv="Content-Security-Policy"/);
  });

  it("default-src 'self' y object-src 'none'", () => {
    expect([sources('default-src'), sources('object-src')]).toEqual([["'self'"], ["'none'"]]);
  });

  it("sin 'unsafe-eval' en ninguna directiva y sin 'unsafe-inline' en script-src ni default-src", () => {
    const all = [...policy.values()].flat();

    expect(all).not.toContain("'unsafe-eval'");
    expect([...sources('script-src'), ...sources('default-src')]).not.toContain("'unsafe-inline'");
  });

  it('sin http:, https: ni * como origen, ni conexiones externas', () => {
    const all = [...policy.values()].flat();

    expect(all.filter((s) => /^(https?:|\*)/.test(s))).toEqual([]);
    expect(sources('connect-src')).toEqual(["'self'"]);
    expect(sources('script-src')).toEqual(["'self'"]);
  });

  it('no usa directivas que Chrome ignora en <meta> y avisa por consola', () => {
    expect(['frame-ancestors', 'report-uri', 'sandbox'].filter((d) => policy.has(d))).toEqual([]);
  });
});

describe('relaxCspForDev (solo `vite` en desarrollo)', () => {
  const relaxed = parseCsp(cspOf(relaxCspForDev(html)) ?? '');

  it("añade 'unsafe-inline' a style-src y ws: wss: a connect-src", () => {
    expect(relaxed.get('style-src')).toEqual(["'self'", "'unsafe-inline'"]);
    expect(relaxed.get('connect-src')).toEqual(["'self'", 'ws:', 'wss:']);
  });

  it('no cambia ninguna otra directiva', () => {
    const others = (p: Map<string, string[]>) =>
      [...p].filter(([d]) => d !== 'style-src' && d !== 'connect-src');

    expect(others(relaxed)).toEqual(others(policy));
  });

  it('sigue habiendo una sola meta', () => {
    expect(relaxCspForDev(html).match(META)).toHaveLength(1);
  });
});
