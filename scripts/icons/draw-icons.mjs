// Iconos de mejora en pixel art (change 0034, ADR-0030).
// Cada icono se compone con formas sencillas en una rejilla de 32 × 32: relleno con bisel (luz arriba a la
// izquierda, sombra abajo a la derecha), contorno oscuro automático y salida PNG de 64 × 64 RGBA (×2, vecino
// más próximo) con fondo transparente. Determinista y sin dependencias: `node draw-icons.mjs <carpeta>`.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const N = 32;
const SCALE = 2;
const C = 16;
const OUTLINE = [0x1d, 0x1a, 0x26, 255];

const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
  255,
];
const ramp = (l, m, d) => ({ light: hex(l), mid: hex(m), dark: hex(d) });
const flat = (h) => ramp(h, h, h);
const STEEL = ramp('#e6ebf2', '#a9b4c2', '#647083');
const WOOD = ramp('#dba26a', '#a8693a', '#6b3e22');
const GOLD = ramp('#f7d65c', '#d39b2a', '#8a5d12');
const RED = ramp('#ef7a6a', '#c23b3b', '#76202b');
const LEATHER = ramp('#b07a48', '#7d5230', '#4f321c');
const DARK_LEATHER = ramp('#7d5230', '#5a3a22', '#3a2414');
const BLUE = ramp('#8fc4ff', '#3a6fd0', '#22397a');
const GEM = ramp('#a8ecff', '#3ab0e8', '#1d5f9a');
const GREEN = ramp('#a6e86f', '#4ea83a', '#2a6327');
const CLAY = ramp('#e8a070', '#b5603a', '#743620');
const PAPER = ramp('#fff6d8', '#e8d8a8', '#b09a68');
const MEAT = ramp('#ee8a66', '#b8482e', '#6d2418');
const BONE = ramp('#fffaf0', '#e2d4b2', '#a0906c');
const WHITE = ramp('#ffffff', '#e6eef5', '#a9b8c6');
const AMBER = ramp('#ffd877', '#e09a2a', '#8a5212');
const GLASS = ramp('#f2fbff', '#c4dfee', '#86a6bc');
const SLASH = ramp('#ffffff', '#c6ecff', '#5aa8d8');

// --- Formas (predicados sobre el centro del píxel) -------------------------
const circ = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 < r * r;
const ell =
  (cx, cy, rx, ry, a = 0) =>
  (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const u = dx * Math.cos(a) + dy * Math.sin(a);
    const v = -dx * Math.sin(a) + dy * Math.cos(a);
    return (u / rx) ** 2 + (v / ry) ** 2 < 1;
  };
const rect = (x0, y0, x1, y1) => (x, y) => x > x0 && x < x1 && y > y0 && y < y1;
const poly = (pts) => (x, y) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const or =
  (...ps) =>
  (x, y) =>
    ps.some((p) => p(x, y));
const and =
  (...ps) =>
  (x, y) =>
    ps.every((p) => p(x, y));
const not = (p) => (x, y) => !p(x, y);
// Coordenadas a lo largo del segmento a → b: u (avance desde a) y v (desvío lateral).
const along = (a, b) => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / len;
  const uy = (b[1] - a[1]) / len;
  return {
    len,
    at: (x, y) => {
      const dx = x - a[0];
      const dy = y - a[1];
      return { u: dx * ux + dy * uy, v: -dx * uy + dy * ux };
    },
  };
};
const seg = (a, b, r) => {
  const s = along(a, b);
  return (x, y) => {
    const { u, v } = s.at(x, y);
    const k = Math.max(0, Math.min(s.len, u));
    return (u - k) ** 2 + v * v < r * r;
  };
};
const rotate = (p, a) => (x, y) => {
  const dx = x - C;
  const dy = y - C;
  return p(C + dx * Math.cos(a) + dy * Math.sin(a), C - dx * Math.sin(a) + dy * Math.cos(a));
};
const star = (cx, cy, ro, ri) =>
  poly(
    Array.from({ length: 10 }, (_, i) => {
      const r = i % 2 === 0 ? ro : ri;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    }),
  );

// --- Lienzo -----------------------------------------------------------------
function canvas() {
  const px = Array.from({ length: N * N }, () => null);
  const draw = (pred, tones, texture) => {
    const at = (x, y) => x >= 0 && y >= 0 && x < N && y < N && pred(x + 0.5, y + 0.5);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (!at(x, y)) continue;
        let tone = tones.mid;
        if (!at(x - 1, y) || !at(x, y - 1)) tone = tones.light;
        else if (!at(x + 1, y) || !at(x, y + 1) || !at(x + 1, y + 1)) tone = tones.dark;
        else if (texture) tone = texture(x, y, tones) ?? tone;
        px[y * N + x] = tone;
      }
    }
  };
  const dot = (x, y, color) => {
    px[y * N + x] = color;
  };
  const done = () => {
    const out = px.slice();
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (px[y * N + x]) continue;
        const near = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => {
          const nx = x + dx;
          const ny = y + dy;
          return nx >= 0 && ny >= 0 && nx < N && ny < N && px[ny * N + nx];
        });
        if (near) out[y * N + x] = OUTLINE;
      }
    }
    return out;
  };
  return { draw, dot, done };
}

// --- Iconos de personaje --------------------------------------------------
function guardrail() {
  const c = canvas();
  const sleeveL = [
    [12, 7.5],
    [7, 8.5],
    [4, 18],
    [9, 19],
    [11, 14],
  ];
  const neck = ell(16, 6.5, 4, 3);
  const shirt = or(
    and(rect(10, 8, 22, 28), not(neck)),
    and(rect(9, 7.5, 23, 9), not(neck)),
    poly(sleeveL),
    poly(sleeveL.map(([x, y]) => [N - x, y])),
  );
  c.draw(shirt, STEEL, (x, y, t) =>
    (x + (y % 4 < 2 ? 0 : 1)) % 2 === 0 && y % 2 === 0 ? t.dark : null,
  );
  c.draw(rect(10, 21, 22, 24), LEATHER);
  c.draw(rect(14, 21, 18, 24), GOLD);
  return c.done();
}

function shortcuts() {
  const c = canvas();
  const shaft = rect(9, 3, 19, 21);
  const foot = or(
    poly([
      [9, 17],
      [9, 25],
      [26, 25],
      [26, 21],
      [21, 18],
      [18, 17],
    ]),
    circ(23.5, 22, 3.2),
  );
  c.draw(or(shaft, foot), LEATHER);
  c.draw(rect(8, 3, 20, 8), DARK_LEATHER);
  c.draw(rect(8, 24, 28, 28), DARK_LEATHER);
  c.draw(rect(12, 13, 17, 16), GOLD);
  return c.done();
}

function contextWindow() {
  const c = canvas();
  c.draw(and(ell(16, 11, 10, 8.5), not(ell(16, 11, 8.2, 6.8))), GOLD);
  c.draw(circ(16, 21.5, 7), GOLD);
  c.draw(circ(16, 21.5, 5), GEM);
  c.draw(circ(16, 14.5, 2), GOLD);
  c.dot(14, 19, WHITE.light);
  return c.done();
}

function regeneration() {
  const c = canvas();
  c.draw(ell(10.5, 7, 4.5, 2.2, -0.7), GREEN);
  c.draw(ell(21, 6, 4.5, 2.2, 0.7), GREEN);
  c.draw(or(ell(16, 21, 10, 7.5), rect(11, 11, 21, 16)), CLAY);
  c.draw(rect(10, 9, 22, 13), WOOD);
  c.draw(or(rect(14.5, 17, 17.5, 26), rect(11.5, 20, 20.5, 23)), GREEN);
  return c.done();
}

function armor() {
  const c = canvas();
  const d = (x, y) => Math.hypot(x - 16, y - 16);
  c.draw((x, y) => d(x, y) < 14, STEEL);
  c.draw(
    (x, y) => d(x, y) < 11.5,
    WOOD,
    (x, _y, t) => (x % 5 === 0 ? t.dark : null),
  );
  c.draw((x, y) => d(x, y) < 4, STEEL);
  c.draw((x, y) => d(x, y) < 1.8, GOLD);
  return c.done();
}

function steadyNerves() {
  const c = canvas();
  c.draw(ell(21, 6, 8.5, 3.6, -0.5), RED);
  c.draw(or(and(circ(16, 15, 10.5), rect(0, 0, 32, 20)), rect(5.5, 14, 26.5, 27)), STEEL);
  c.draw(rect(8, 15, 24, 18), flat('#2b2838'));
  c.draw(rect(15, 18, 17, 25), STEEL);
  for (const y of [20, 23]) {
    for (const x of [10, 12, 20, 22]) c.dot(x, y, flat('#2b2838').mid);
  }
  return c.done();
}

function scholar() {
  const c = canvas();
  c.draw(rect(9, 6, 27, 28), PAPER, (_x, y, t) => (y % 2 === 0 ? t.dark : null));
  c.draw(rect(5, 3, 24, 26), BLUE);
  c.draw(rect(5, 3, 9, 26), ramp('#3a6fd0', '#2a4fa0', '#1a2c60'));
  c.draw(
    poly([
      [16.5, 8],
      [21, 14.5],
      [16.5, 21],
      [12, 14.5],
    ]),
    GOLD,
  );
  c.draw(rect(20, 12, 25, 17), GOLD);
  return c.done();
}

function prospector() {
  const c = canvas();
  c.draw(
    or(
      circ(15, 19, 9.5),
      poly([
        [11, 10],
        [19, 10],
        [18, 13],
        [12, 13],
      ]),
      ell(15, 8, 5.5, 2.8),
    ),
    LEATHER,
  );
  c.draw(rect(10.5, 10.5, 19.5, 13), GOLD);
  for (const [x, y, r] of [
    [24, 24, 5],
    [8, 26, 3.8],
  ]) {
    c.draw(circ(x, y, r), GOLD);
    c.draw(circ(x, y, r - 2.4), ramp('#d39b2a', '#d39b2a', '#d39b2a'));
  }
  return c.done();
}

function hunter() {
  const c = canvas();
  c.draw(seg([16, 17], [24, 25], 2), BONE);
  c.draw(circ(26, 23.5, 2.6), BONE);
  c.draw(circ(23.5, 26.5, 2.6), BONE);
  c.draw(ell(12.5, 12.5, 9.5, 7.5, -0.75), MEAT, (x, y, t) =>
    (x * 3 + y * 5) % 11 === 0 ? t.light : null,
  );
  return c.done();
}

// --- Iconos de arma -------------------------------------------------------
function arrow(tail, tip, { feather = RED, shaft = WOOD, head = STEEL } = {}) {
  const s = along(tail, tip);
  return [
    [
      (x, y) => {
        const { u, v } = s.at(x, y);
        return u > -1 && u < 8 && Math.abs(v) < 4.2 - u * 0.15 && Math.abs(v) > 0.6;
      },
      feather,
    ],
    [
      (x, y) => {
        const { u, v } = s.at(x, y);
        return u > -1 && u < s.len - 7 && Math.abs(v) < 1.1;
      },
      shaft,
    ],
    [
      (x, y) => {
        const { u, v } = s.at(x, y);
        return u >= s.len - 10 && u <= s.len && Math.abs(v) <= (s.len - u) * 0.55;
      },
      head,
    ],
  ];
}

function strictRules() {
  const c = canvas();
  for (const [p, t] of arrow([5, 27], [28, 4])) c.draw(p, t);
  return c.done();
}

function fastCi() {
  const c = canvas();
  const a = -Math.PI / 4;
  const limb = and(circ(4, 16, 15), not(circ(4, 16, 11.8)), rect(7.5, 0, 32, 32));
  c.draw(rotate(seg([8, 3.6], [8, 28.4], 0.6), a), flat('#f2ead8'));
  c.draw(rotate(limb, a), WOOD);
  c.draw(rotate(and(limb, rect(0, 13, 32, 19)), a), DARK_LEATHER);
  return c.done();
}

function wideAnalysis() {
  const c = canvas();
  const lens = and(circ(16, 6.5, 15), circ(16, 25.5, 15));
  c.draw(lens, WHITE);
  c.draw(and(lens, circ(16, 16, 5.6)), AMBER);
  c.draw(circ(16, 16, 2.4), flat('#1d1a26'));
  c.dot(14, 13, WHITE.light);
  c.dot(13, 14, WHITE.light);
  return c.done();
}

function blade(a, b, tones) {
  const s = along(a, b);
  return [
    (x, y) => {
      const { u, v } = s.at(x, y);
      if (u < 0 || u > s.len) return false;
      return Math.abs(v) <= Math.min(2.3, (s.len - u) * 0.6);
    },
    tones,
  ];
}

function hardAsserts() {
  const c = canvas();
  const [bp, bt] = blade([10, 22], [27, 5], STEEL);
  c.draw(bp, bt);
  const edge = along([10, 22], [27, 5]);
  c.draw((x, y) => {
    const { u, v } = edge.at(x, y);
    return u > 1 && u < edge.len - 3 && v > -0.2 && v < 0.8;
  }, flat('#ffffff'));
  c.draw(seg([5.5, 18], [14, 26.5], 1.5), GOLD);
  c.draw(seg([9, 23], [5, 27], 1.3), LEATHER);
  c.draw(circ(4, 28, 2), GOLD);
  return c.done();
}

// Dos espadas cortas cruzadas: la de la derecha debajo y la de la izquierda encima.
function watchMode() {
  const c = canvas();
  const mirror = (p) => (x, y) => p(N - x, y);
  const sword = (m) => {
    const [bp, bt] = blade([10, 22], [26, 6], STEEL);
    c.draw(m(bp), bt);
    c.draw(m(seg([6.5, 18.5], [13.5, 25.5], 1.4)), GOLD);
    c.draw(m(seg([10, 22], [6.5, 25.5], 1.3)), LEATHER);
    c.draw(m(circ(5.5, 26.5, 1.9)), GOLD);
  };
  sword(mirror);
  sword((p) => p);
  return c.done();
}

function coverage() {
  const c = canvas();
  c.draw(and(circ(14.5, 17.5, 12.5), not(circ(18.5, 13.5, 11.2))), SLASH);
  for (const [x, y] of [
    [26, 22],
    [24, 26],
    [21, 28.5],
  ])
    c.draw(circ(x, y, 1.1), SLASH);
  return c.done();
}

// --- Tienda y reservas ----------------------------------------------------
function heal() {
  const c = canvas();
  c.draw(or(circ(16, 20.5, 9), rect(12.5, 7, 19.5, 14)), GLASS);
  c.draw(and(circ(16, 20.5, 7.3), rect(0, 17, 32, 32)), RED);
  c.draw(rect(11.5, 3, 20.5, 8.5), WOOD);
  c.dot(11, 18, WHITE.light);
  c.dot(11, 19, WHITE.light);
  c.dot(12, 16, WHITE.light);
  return c.done();
}

function medallion(inner) {
  const c = canvas();
  c.draw(circ(16, 16, 13.5), GOLD);
  c.draw(circ(16, 16, 11), inner);
  return c;
}

function fallbackCharacter() {
  const c = medallion(BLUE);
  c.draw(star(16, 16.5, 7.5, 3.2), PAPER);
  return c.done();
}

function fallbackWeapon() {
  const c = medallion(RED);
  c.draw(
    poly([
      [14.6, 20],
      [14.6, 8.5],
      [16, 6],
      [17.4, 8.5],
      [17.4, 20],
    ]),
    STEEL,
  );
  c.draw(rect(11, 19.5, 21, 22), GOLD);
  c.draw(rect(14.8, 21.5, 17.2, 25), LEATHER);
  c.draw(circ(16, 25.8, 1.6), GOLD);
  return c.done();
}

export const ICONS = {
  guardrail,
  shortcuts,
  'context-window': contextWindow,
  regeneration,
  armor,
  'steady-nerves': steadyNerves,
  scholar,
  prospector,
  hunter,
  'strict-rules': strictRules,
  'fast-ci': fastCi,
  'wide-analysis': wideAnalysis,
  'hard-asserts': hardAsserts,
  'watch-mode': watchMode,
  coverage,
  heal,
  'fallback-character': fallbackCharacter,
  'fallback-weapon': fallbackWeapon,
};

// --- PNG ------------------------------------------------------------------
const CRC = new Uint32Array(256).map((_, n) => {
  let k = n;
  for (let i = 0; i < 8; i++) k = k & 1 ? 0xedb88320 ^ (k >>> 1) : k >>> 1;
  return k >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function encodePng(w, h, pixelAt) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) raw.set(pixelAt(x, y), y * (w * 4 + 1) + 1 + x * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = process.argv[2];
if (!outDir) {
  console.error('uso: node draw-icons.mjs <carpeta> [--preview <png>]');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
const CLEAR = [0, 0, 0, 0];
const drawn = Object.entries(ICONS).map(([id, fn]) => [id, fn()]);
for (const [id, px] of drawn) {
  const w = N * SCALE;
  const file = encodePng(
    w,
    w,
    (x, y) => px[Math.floor(y / SCALE) * N + Math.floor(x / SCALE)] ?? CLEAR,
  );
  writeFileSync(join(outDir, `${id}.png`), file);
}
const previewAt = process.argv.indexOf('--preview');
if (previewAt > 0) {
  const cols = 6;
  const gap = 4;
  const rows = Math.ceil(drawn.length / cols);
  const W = cols * (N + gap) + gap;
  const H = rows * (N + gap) + gap;
  const bg = hex('#3b4252');
  const big = 4;
  const sheet = encodePng(W * big, H * big, (X, Y) => {
    const x = Math.floor(X / big);
    const y = Math.floor(Y / big);
    const col = Math.floor((x - gap) / (N + gap));
    const row = Math.floor((y - gap) / (N + gap));
    const lx = x - gap - col * (N + gap);
    const ly = y - gap - row * (N + gap);
    const icon = drawn[row * cols + col];
    if (!icon || lx < 0 || ly < 0 || lx >= N || ly >= N) return bg;
    return icon[1][ly * N + lx] ?? bg;
  });
  writeFileSync(process.argv[previewAt + 1], sheet);
}
console.log(`ok: ${drawn.length} iconos en ${outDir}`);
