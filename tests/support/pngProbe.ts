import { deflateSync } from 'node:zlib';
import { decodePng, pixelAt } from './png';

// Medida de los iconos de mejora (0034, design D9): cabecera IHDR y alfa de las 4 esquinas, con el
// decodificador mínimo de `png.ts` (`node:zlib`, filtros 0–4, sin dependencias). Más un codificador
// mínimo para fabricar copias alteradas en los tests ("Icono con otro tamaño o sin alfa").

export interface PngHeader {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly colorType: number;
  readonly interlace: number;
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** Lado de un icono de mejora (px) y tipo de color RGBA de PNG. */
export const ICON_SIDE = 64;
export const RGBA_COLOR_TYPE = 6;

/** IHDR de un PNG (lanza si no empieza por la firma y el bloque IHDR). */
export function pngHeader(bytes: Buffer): PngHeader {
  if (!bytes.subarray(0, 8).equals(SIGNATURE) || bytes.toString('latin1', 12, 16) !== 'IHDR') {
    throw new Error('no es un PNG');
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    depth: bytes[24] ?? 0,
    colorType: bytes[25] ?? 0,
    interlace: bytes[28] ?? 0,
  };
}

/**
 * Problemas de forma de un icono (vacío si cumple): 64 × 64, profundidad 8, RGBA, sin entrelazado y
 * alfa 0 en las 4 esquinas. Cada mensaje empieza por `name`.
 */
export function iconProblems(name: string, bytes: Buffer): string[] {
  const h = pngHeader(bytes);
  const problems: string[] = [];
  if (h.width !== ICON_SIDE || h.height !== ICON_SIDE)
    problems.push(`${name}: mide ${String(h.width)} × ${String(h.height)}, no 64 × 64.`);
  if (h.depth !== 8 || h.colorType !== RGBA_COLOR_TYPE)
    problems.push(`${name}: no es RGBA de 8 bits (color ${String(h.colorType)}).`);
  if (h.interlace !== 0) problems.push(`${name}: entrelazado.`);
  if (problems.length > 0) return problems;
  const png = decodePng(bytes);
  const corners: [number, number][] = [
    [0, 0],
    [h.width - 1, 0],
    [0, h.height - 1],
    [h.width - 1, h.height - 1],
  ];
  for (const [x, y] of corners) {
    if (pixelAt(png, x, y)[3] !== 0)
      problems.push(`${name}: la esquina (${String(x)}, ${String(y)}) no es transparente.`);
  }
  return problems;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = (CRC_TABLE[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** PNG de 8 bits sin entrelazar (RGBA o RGB) con los píxeles RGBA dados (filtro 0 por fila). */
export function encodePng(width: number, height: number, rgba: Uint8Array, alpha = true): Buffer {
  const channels = alpha ? 4 : 3;
  const raw = Buffer.alloc((width * channels + 1) * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < channels; c++) {
        raw[y * (width * channels + 1) + 1 + x * channels + c] = rgba[(y * width + x) * 4 + c] ?? 0;
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = alpha ? RGBA_COLOR_TYPE : 2;
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
