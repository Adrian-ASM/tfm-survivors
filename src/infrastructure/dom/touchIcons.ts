/**
 * Iconos de la barra táctil (0033): SVG en `data:` para `<img>`, que la CSP admite con
 * `img-src data:` (sin glifos de texto ni estilos en línea). Trazo claro sobre el botón del kit.
 */
const svg = (body: string): string =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ` +
      `stroke="#f4ead2" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">` +
      `${body}</svg>`,
  )}`;

export const TOUCH_ICONS = {
  pause: svg('<path d="M8 5v14M16 5v14"/>'),
  restart: svg('<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/>'),
  fullscreen: svg('<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>'),
  // Altavoz (0035): con ondas sin silencio; tachado con silencio.
  sound: svg('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>'),
  muted: svg('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l5 6M21 9l-5 6"/>'),
} as const;
