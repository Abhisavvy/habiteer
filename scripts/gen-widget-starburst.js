/**
 * Bakes the Combo widget's starburst badge as a raster PNG — the mock's
 * shape is a CSS `clip-path: polygon(...)`, which RemoteViews has no
 * equivalent for (`BorderStyleProps` only has radius, no clip-path), same
 * resolution as the halftone texture and the app icon: pre-bake it.
 *
 * Points are the mock's exact `clip-path` percentages (a 16-point star,
 * read from `Habiteer P2 - Screens.dc.html`'s Combo 2×2 section), scaled
 * into this canvas. Border is approximated as "inside the polygon and
 * within `strokeWidth` of the nearest edge" — clip-path clips the whole
 * box including the border, so the border's outer edge sits exactly on the
 * polygon boundary and grows inward, which this matches without needing a
 * true polygon inset (nontrivial for a concave shape).
 *
 *   node scripts/gen-widget-starburst.js
 *
 * Writes: assets/widget-starburst-light.png, assets/widget-starburst-dark.png
 */
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const SS = 3;
const SIZE = 200;
const RS = SIZE * SS;
const STROKE = 3 * SS * 2; // mock's 3px border, scaled up + doubled for visibility at this size

// clip-path: polygon(50% 0,61% 20%,83% 12%,79% 35%,100% 47%,80% 58%,88% 82%,63% 76%,50% 100%,37% 76%,12% 82%,20% 58%,0 47%,21% 35%,17% 12%,39% 20%)
const POINTS = [
  [0.5, 0], [0.61, 0.2], [0.83, 0.12], [0.79, 0.35], [1, 0.47], [0.8, 0.58], [0.88, 0.82], [0.63, 0.76],
  [0.5, 1], [0.37, 0.76], [0.12, 0.82], [0.2, 0.58], [0, 0.47], [0.21, 0.35], [0.17, 0.12], [0.39, 0.2],
].map(([px, py]) => [px * RS, py * RS]);

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function insidePolygon(x, y) {
  let inside = false;
  for (let i = 0, j = POINTS.length - 1; i < POINTS.length; j = i++) {
    const [xi, yi] = POINTS[i];
    const [xj, yj] = POINTS[j];
    if (yi > y !== yj > y) {
      const xIntersect = xi + ((y - yi) / (yj - yi)) * (xj - xi);
      if (x < xIntersect) inside = !inside;
    }
  }
  return inside;
}

function distToNearestEdge(x, y) {
  let min = Infinity;
  for (let i = 0, j = POINTS.length - 1; i < POINTS.length; j = i++) {
    const [ax, ay] = POINTS[j];
    const [bx, by] = POINTS[i];
    const dx = bx - ax,
      dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = ax + t * dx,
      py = ay + t * dy;
    const d = Math.hypot(x - px, y - py);
    if (d < min) min = d;
  }
  return min;
}

function render(fillHex, strokeHex) {
  const buf = new Uint8Array(RS * RS * 4);
  const fillRgb = hexToRgb(fillHex);
  const strokeRgb = hexToRgb(strokeHex);
  for (let y = 0; y < RS; y++) {
    for (let x = 0; x < RS; x++) {
      const px = x + 0.5,
        py = y + 0.5;
      if (!insidePolygon(px, py)) continue;
      const i = (y * RS + x) * 4;
      const onStroke = distToNearestEdge(px, py) < STROKE;
      const c = onStroke ? strokeRgb : fillRgb;
      buf[i] = c[0];
      buf[i + 1] = c[1];
      buf[i + 2] = c[2];
      buf[i + 3] = 255;
    }
  }
  return downsample(buf);
}

function downsample(buf) {
  const out = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let dy = 0; dy < SS; dy++) {
        for (let dx = 0; dx < SS; dx++) {
          const i = ((y * SS + dy) * RS + (x * SS + dx)) * 4,
            pa = buf[i + 3];
          r += buf[i] * pa;
          g += buf[i + 1] * pa;
          b += buf[i + 2] * pa;
          a += pa;
        }
      }
      const o = (y * SIZE + x) * 4,
        n = SS * SS;
      out[o] = a ? Math.round(r / a) : 0;
      out[o + 1] = a ? Math.round(g / a) : 0;
      out[o + 2] = a ? Math.round(b / a) : 0;
      out[o + 3] = Math.round(a / n);
    }
  }
  return out;
}

const CRC = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePng(rgba) {
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  for (let y = 0; y < SIZE; y++) {
    raw[y * (SIZE * 4 + 1)] = 0;
    rgba.subarray(y * SIZE * 4, (y + 1) * SIZE * 4).forEach((v, i) => {
      raw[y * (SIZE * 4 + 1) + 1 + i] = v;
    });
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

const outDir = path.join(__dirname, "..", "assets");
const jobs = {
  "widget-starburst-light.png": render("#FFC23C", "#241B33"),
  "widget-starburst-dark.png": render("#FFD23F", "#0C0916"),
};
for (const [name, rgba] of Object.entries(jobs)) {
  fs.writeFileSync(path.join(outDir, name), encodePng(rgba));
  console.log(name);
}
