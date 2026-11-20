import type { Plugin } from 'vite';

// CSP de la página (design 0007, sección CSP). La política estricta de producción vive literal en
// index.html; en `vite` (serve) el cliente de HMR inyecta <style> y abre un WebSocket, así que
// `devCsp` la relaja solo ahí. La build nunca pasa por este plugin.

const META = /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")([^"]*)("[^>]*>)/i;

/** Contenido de la meta CSP del HTML, o `null` si no hay. */
export const cspOf = (html: string): string | null => META.exec(html)?.[2] ?? null;

/** Directivas de una política, en orden: `default-src 'self'; …` ⇒ Map(directiva → fuentes). */
export function parseCsp(policy: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  for (const part of policy.split(';')) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) directives.set(name.toLowerCase(), values);
  }
  return directives;
}

const serializeCsp = (directives: Map<string, string[]>): string =>
  [...directives].map(([name, values]) => [name, ...values].join(' ')).join('; ');

/** Fuentes que añade el servidor de desarrollo a cada directiva. */
const DEV_EXTRA: Readonly<Record<string, readonly string[]>> = {
  'style-src': ["'unsafe-inline'"],
  'connect-src': ['ws:', 'wss:'],
};

/** Política de desarrollo: solo cambian `style-src` y `connect-src`. */
export function relaxCspForDev(html: string): string {
  return html.replace(META, (_match, open: string, policy: string, close: string) => {
    const directives = parseCsp(policy);
    for (const [name, extra] of Object.entries(DEV_EXTRA)) {
      directives.set(name, [...(directives.get(name) ?? []), ...extra]);
    }
    return `${open}${serializeCsp(directives)}${close}`;
  });
}

/** Plugin de Vite que relaja la CSP solo en `serve` (dev/HMR). */
export const devCsp = (): Plugin => ({
  name: 'sprint-survivors:dev-csp',
  apply: 'serve',
  transformIndexHtml: (html) => relaxCspForDev(html),
});
