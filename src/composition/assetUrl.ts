/** Carpeta del arte versionado dentro de `public/` (design D2). */
export const ASSET_URL_DIR = 'assets/tiny-swords/';

/**
 * URL de una hoja: base de Vite (`import.meta.env.BASE_URL`) + carpeta del arte + `file`, con cada
 * segmento codificado. `file` ya ha pasado la regex de los datos de aspecto (sin `..` ni esquema).
 */
export function assetUrl(base: string, file: string): string {
  return base + ASSET_URL_DIR + file.split('/').map(encodeURIComponent).join('/');
}

/** Carpeta de las fuentes versionadas dentro de `public/` (0032). */
export const FONT_URL_DIR = 'assets/fonts/';

/** URL de la fuente de la interfaz: base + carpeta de fuentes + `file` (ya validado por regex). */
export function fontUrl(base: string, file: string): string {
  return base + FONT_URL_DIR + encodeURIComponent(file);
}

/** Carpeta de los iconos de mejora generados con IA dentro de `public/` (0034, ADR-0030). */
export const ICON_URL_DIR = 'assets/icons/';

/** URL de un icono de mejora: base + carpeta de iconos + `file` (plano, ya validado por regex). */
export function iconUrl(base: string, file: string): string {
  return base + ICON_URL_DIR + encodeURIComponent(file);
}

/** Carpeta del audio versionado dentro de `public/` (0035, design D8). */
export const AUDIO_URL_DIR = 'assets/audio/';

/** URL de un fichero de audio: base + carpeta de audio + `file` (plano, ya validado por regex). */
export function audioUrl(base: string, file: string): string {
  return base + AUDIO_URL_DIR + encodeURIComponent(file);
}
