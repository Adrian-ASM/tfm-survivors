import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

// Decodificador PNG mínimo para tests (0032, tarea 1.1): IHDR + IDAT con `zlib` y desfiltrado de
// las 5 clases de filtro. Solo profundidad 8 y color RGBA (6), RGB (2), gris (0) o gris + alfa (4),
// sin entrelazado: lo que usan las piezas de UI de Update 010. Devuelve siempre RGBA.

export interface Png {
  readonly width: number;
  readonly height: number;
  /** RGBA, fila a fila, 4 bytes por píxel. */
  readonly rgba: Uint8Array;
}

const CHANNELS: Readonly<Record<number, number>> = { 0: 1, 2: 3, 4: 2, 6: 4 };
const SIGNATURE_BYTES = 8;

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function unfilter(raw: Buffer, width: number, height: number, bpp: number): Uint8Array {
  const stride = width * bpp;
  const out = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const type = raw[y * (stride + 1)] ?? 0;
    const src = y * (stride + 1) + 1;
    const row = y * stride;
    for (let x = 0; x < stride; x++) {
      const v = raw[src + x] ?? 0;
      const a = x >= bpp ? (out[row + x - bpp] ?? 0) : 0;
      const b = y > 0 ? (out[row - stride + x] ?? 0) : 0;
      const c = x >= bpp && y > 0 ? (out[row - stride + x - bpp] ?? 0) : 0;
      const predictor = [0, a, b, (a + b) >> 1, paeth(a, b, c)][type] ?? 0;
      out[row + x] = (v + predictor) & 0xff;
    }
  }
  return out;
}

function toRgba(pixels: Uint8Array, count: number, channels: number): Uint8Array {
  if (channels === 4) return pixels;
  const out = new Uint8Array(count * 4);
  for (let i = 0; i < count; i++) {
    const p = pixels.subarray(i * channels, i * channels + channels);
    const gray = channels <= 2;
    out[i * 4] = p[0] ?? 0;
    out[i * 4 + 1] = gray ? (p[0] ?? 0) : (p[1] ?? 0);
    out[i * 4 + 2] = gray ? (p[0] ?? 0) : (p[2] ?? 0);
    out[i * 4 + 3] = channels === 2 ? (p[1] ?? 255) : 255;
  }
  return out;
}

/** Decodifica un PNG de 8 bits sin entrelazar. Lanza si no lo es. */
export function decodePng(bytes: Buffer): Png {
  let pos = SIGNATURE_BYTES;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Buffer[] = [];
  while (pos < bytes.length) {
    const length = bytes.readUInt32BE(pos);
    const type = bytes.toString('latin1', pos + 4, pos + 8);
    const data = bytes.subarray(pos + 8, pos + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const depth = data[8];
      channels = CHANNELS[data[9] ?? -1] ?? 0;
      if (depth !== 8 || channels === 0 || data[12] !== 0) {
        throw new Error(
          `PNG no soportado (profundidad ${String(depth)}, color ${String(data[9])})`,
        );
      }
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + length;
  }
  const pixels = unfilter(inflateSync(Buffer.concat(idat)), width, height, channels);
  return { width, height, rgba: toRgba(pixels, width * height, channels) };
}

export function readPng(path: string): Png {
  return decodePng(readFileSync(path));
}

/** Píxel (x, y) como [r, g, b, a]. */
export function pixelAt(png: Png, x: number, y: number): [number, number, number, number] {
  const i = (y * png.width + x) * 4;
  const p = png.rgba;
  return [p[i] ?? 0, p[i + 1] ?? 0, p[i + 2] ?? 0, p[i + 3] ?? 0];
}

/** Color medio (RGB, redondeado) de los píxeles opacos de un rectángulo [x0, x1) × [y0, y1). */
export function meanColor(
  png: Png,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): [number, number, number] {
  const sum = [0, 0, 0];
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const [r, g, b, a] = pixelAt(png, x, y);
      if (a < 255) continue;
      sum[0] = (sum[0] ?? 0) + r;
      sum[1] = (sum[1] ?? 0) + g;
      sum[2] = (sum[2] ?? 0) + b;
      n++;
    }
  }
  return [0, 1, 2].map((c) => Math.round((sum[c] ?? 0) / Math.max(1, n))) as [
    number,
    number,
    number,
  ];
}
