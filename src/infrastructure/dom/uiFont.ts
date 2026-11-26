// Carga de la fuente pixel de la interfaz (0032, design §6, ADR-0028). No usa `load.font` de
// Phaser: su `FontFile` no tiene plazo y no emite `FILE_LOAD_ERROR` si `FontFace.load()` falla.
// Aquí la fuente se registra con `FontFace` + `document.fonts` y se comprueba con `check`.

/** Espera máxima de la fuente antes de crear el menú o la partida (spec sprite-rendering). */
export const FONT_WAIT_MS = 3000;

/** Lo que se usa de `FontFace`. */
export interface FontFaceLike {
  load(): Promise<unknown>;
}

/** Lo que se usa de `document.fonts` (`FontFaceSet`). */
export interface FontSetLike {
  add(face: FontFaceLike): unknown;
  check(font: string): boolean;
}

/** Crea la cara (`new FontFace(family, source)` en el navegador; un doble en los tests). */
export type FontFaceFactory = (family: string, source: string) => FontFaceLike;

/** Temporizador inyectado: resuelve tras `ms` (`setTimeout` en composición, reloj de prueba). */
export type Timer = (ms: number) => Promise<void>;

/**
 * Carga la fuente desde `url` (mismo origen) y la registra. Resuelve `true` solo si la familia
 * figura disponible al terminar (`check`): una carga que falla sin error también da `false`.
 * Nunca rechaza (sin errores no capturados).
 */
export async function loadUiFont(
  fonts: FontSetLike,
  makeFace: FontFaceFactory,
  family: string,
  url: string,
): Promise<boolean> {
  try {
    const face = makeFace(family, `url("${url}") format("woff2")`);
    await face.load();
    fonts.add(face);
    return fonts.check(`16px "${family}"`);
  } catch {
    return false;
  }
}

/** El primero entre `promise` y el plazo: al vencer `ms`, `false`. Nunca rechaza. */
export function withDeadline(
  promise: Promise<boolean>,
  ms: number,
  timer: Timer,
): Promise<boolean> {
  return Promise.race([promise.catch(() => false), timer(ms).then(() => false)]);
}
