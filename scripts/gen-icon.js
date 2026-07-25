/**
 * Generates the app-icon PNGs for the P2 "Evolved-H" icon (icon-A, Questlight):
 * a hero-violet tile with a paper H (taller right stroke), a gold cap on that
 * stroke, and a gold star sparkle. Pure Node — a hand-written PNG encoder
 * (zlib deflate + CRC32) over a 4x-supersampled RGBA framebuffer for AA. No
 * canvas/native deps, fully reproducible.
 *
 *   node scripts/gen-icon.js
 *
 * The logo's true bounding box (including stroke halves + the star) is computed,
 * then centered in the tile and scaled to a fraction of it, so the glyph is
 * visually centred with even margins — not drawn edge-to-edge.
 *
 * Writes: assets/icon.png (master, hero bg + logo),
 *   assets/adaptive-icon-{background,foreground,monochrome}.png
 */
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const SIZE = 512;
const SS = 4;
const RES = SIZE * SS;

const HERO = [0x6b, 0x3e, 0xf0];
const INK = [0x24, 0x1b, 0x33];
const PAPER = [0xff, 0xfb, 0xf0];
const GOLD = [0xff, 0xc2, 0x3c];

const STROKE = 5; // viewBox stroke width
const STAR_OUTLINE_K = 1.28; // gold star's ink outline scale

// H bars + crossbar + gold cap, in the 100-unit viewBox.
const RRECTS = [
  { x: 26, y: 30, w: 15, h: 46, r: 4 }, // left bar
  { x: 59, y: 22, w: 15, h: 54, r: 4 }, // right (taller) bar
  { x: 41, y: 46, w: 18, h: 14, r: 0 }, // crossbar
  { x: 59, y: 22, w: 15, h: 12, r: 4 }, // gold cap
];

// 5-point star (absolute viewBox points from the mock path).
const STAR = [
  [80, 20], [82.6, 26], [89.0, 26.6], [84.2, 31.0], [85.6, 37.3],
  [80.0, 34.1], [74.4, 37.3], [75.8, 31.0], [71.0, 26.6], [77.4, 26.0],
];
const STAR_C = [80, 29];
function scaledStar(k) {
  return STAR.map(([x, y]) => [STAR_C[0] + (x - STAR_C[0]) * k, STAR_C[1] + (y - STAR_C[1]) * k]);
}

// Union bounding box of everything drawn (stroke-outset for the rects, the
// larger outline scale for the star) — used to centre + fit the glyph.
function logoBBox() {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of RRECTS) {
    minX = Math.min(minX, r.x - STROKE / 2);
    minY = Math.min(minY, r.y - STROKE / 2);
    maxX = Math.max(maxX, r.x + r.w + STROKE / 2);
    maxY = Math.max(maxY, r.y + r.h + STROKE / 2);
  }
  for (const [x, y] of scaledStar(STAR_OUTLINE_K)) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, maxDim: Math.max(maxX - minX, maxY - minY) };
}

/** Transform: centre the logo bbox in the tile, scaled so its max dimension
 * spans `frac` of the tile (leaving even margin all around). */
function transform(frac) {
  const bb = logoBBox();
  const ppv = (frac * RES) / bb.maxDim;
  return { ppv, ox: RES / 2 - bb.cx * ppv, oy: RES / 2 - bb.cy * ppv };
}

function makeBuf() {
  return new Uint8Array(RES * RES * 4);
}
function setPx(buf, x, y, c) {
  if (x < 0 || y < 0 || x >= RES || y >= RES) return;
  const i = (y * RES + x) * 4;
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255;
}

function fillRoundRect(buf, t, vx, vy, vw, vh, vr, color) {
  const x0 = t.ox + vx * t.ppv, y0 = t.oy + vy * t.ppv, w = vw * t.ppv, h = vh * t.ppv, r = Math.max(0, vr * t.ppv);
  for (let y = Math.floor(y0); y < Math.ceil(y0 + h); y++) {
    for (let x = Math.floor(x0); x < Math.ceil(x0 + w); x++) {
      const px = x + 0.5, py = y + 0.5;
      if (px < x0 || px > x0 + w || py < y0 || py > y0 + h) continue;
      let cx = null, cy = null;
      if (px < x0 + r && py < y0 + r) { cx = x0 + r; cy = y0 + r; }
      else if (px > x0 + w - r && py < y0 + r) { cx = x0 + w - r; cy = y0 + r; }
      else if (px < x0 + r && py > y0 + h - r) { cx = x0 + r; cy = y0 + h - r; }
      else if (px > x0 + w - r && py > y0 + h - r) { cx = x0 + w - r; cy = y0 + h - r; }
      if (cx !== null) { const dx = px - cx, dy = py - cy; if (dx * dx + dy * dy > r * r) continue; }
      setPx(buf, x, y, color);
    }
  }
}
function strokedRoundRect(buf, t, vx, vy, vw, vh, vr, fill, sw) {
  const h = sw / 2;
  fillRoundRect(buf, t, vx - h, vy - h, vw + sw, vh + sw, vr + h, INK);
  fillRoundRect(buf, t, vx + h, vy + h, vw - sw, vh - sw, Math.max(0, vr - h), fill);
}
function fillPolygon(buf, t, pts, color) {
  const dp = pts.map(([vx, vy]) => [t.ox + vx * t.ppv, t.oy + vy * t.ppv]);
  let minY = Infinity, maxY = -Infinity;
  for (const [, y] of dp) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const py = y + 0.5, xs = [];
    for (let i = 0; i < dp.length; i++) {
      const [x1, y1] = dp[i], [x2, y2] = dp[(i + 1) % dp.length];
      if (y1 <= py && y2 > py) xs.push(x1 + ((py - y1) / (y2 - y1)) * (x2 - x1));
      else if (y2 <= py && y1 > py) xs.push(x2 + ((py - y2) / (y1 - y2)) * (x1 - x2));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2)
      for (let x = Math.floor(xs[k]); x < Math.ceil(xs[k + 1]); x++) {
        const px = x + 0.5;
        if (px >= xs[k] && px <= xs[k + 1]) setPx(buf, x, y, color);
      }
  }
}

function drawLogo(buf, t, mono) {
  if (mono) {
    for (const r of RRECTS) fillRoundRect(buf, t, r.x, r.y, r.w, r.h, r.r, INK);
    fillPolygon(buf, t, scaledStar(1), INK);
    return;
  }
  const fills = [PAPER, PAPER, PAPER, GOLD];
  RRECTS.forEach((r, i) => strokedRoundRect(buf, t, r.x, r.y, r.w, r.h, r.r, fills[i], STROKE));
  fillPolygon(buf, t, scaledStar(STAR_OUTLINE_K), INK);
  fillPolygon(buf, t, scaledStar(1), GOLD);
}

function render({ bg, logo, mono, frac }) {
  const buf = makeBuf();
  if (bg) for (let i = 0; i < RES * RES; i++) { buf[i * 4] = bg[0]; buf[i * 4 + 1] = bg[1]; buf[i * 4 + 2] = bg[2]; buf[i * 4 + 3] = 255; }
  if (logo) drawLogo(buf, transform(frac), mono);
  return downsample(buf);
}

function downsample(buf) {
  const out = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let dy = 0; dy < SS; dy++)
        for (let dx = 0; dx < SS; dx++) {
          const i = ((y * SS + dy) * RES + (x * SS + dx)) * 4, pa = buf[i + 3];
          r += buf[i] * pa; g += buf[i + 1] * pa; b += buf[i + 2] * pa; a += pa;
        }
      const o = (y * SIZE + x) * 4, n = SS * SS;
      out[o] = a ? Math.round(r / a) : 0;
      out[o + 1] = a ? Math.round(g / a) : 0;
      out[o + 2] = a ? Math.round(b / a) : 0;
      out[o + 3] = Math.round(a / n);
    }
  return out;
}

const CRC = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii"), crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePng(rgba) {
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  for (let y = 0; y < SIZE; y++) {
    raw[y * (SIZE * 4 + 1)] = 0;
    rgba.subarray(y * SIZE * 4, (y + 1) * SIZE * 4).forEach((v, i) => { raw[y * (SIZE * 4 + 1) + 1 + i] = v; });
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4); ihdr[8] = 8; ihdr[9] = 6;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

const outDir = path.join(__dirname, "..", "assets");
// Master + background fill the tile edge-to-edge (bg); the logo itself is
// centred and scaled to a modest fraction of the tile so it reads as an
// icon glyph with real breathing room, not a shape crammed edge-to-edge
// (0.62/0.6 looked oversized and off-balance — user feedback). Adaptive
// foreground/monochrome sit inside the ~0.66 Android mask safe-zone, so
// 0.42 there keeps the glyph safely clear of every launcher mask shape
// (circle, squircle, rounded square) with margin to spare.
const jobs = {
  "icon.png": { bg: HERO, logo: true, frac: 0.46 },
  "adaptive-icon-background.png": { bg: HERO, logo: false },
  "adaptive-icon-foreground.png": { logo: true, frac: 0.42 },
  "adaptive-icon-monochrome.png": { logo: true, mono: true, frac: 0.42 },
};
for (const [name, opts] of Object.entries(jobs)) {
  fs.writeFileSync(path.join(outDir, name), encodePng(render(opts)));
  console.log(name);
}
