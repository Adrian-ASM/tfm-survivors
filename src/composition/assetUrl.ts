/** Carpeta del arte versionado dentro de `public/` (design D2). */
export const ASSET_URL_DIR = 'assets/tiny-swords/';

/**
 * URL de una hoja: base de Vite (`import.meta.env.BASE_URL`) + carpeta del arte + `file`, con cada
 * segmento codificado. `file` ya ha pasado la regex de los datos de aspecto (sin `..` ni esquema).
 */
export function assetUrl(base: string, file: string): string {
  return base + ASSET_URL_DIR + file.split('/').map(encodeURIComponent).join('/');
}
