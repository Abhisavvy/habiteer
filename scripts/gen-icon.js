/**
 * Generates the app-icon PNGs for the P2 "Evolved-H" icon (icon-A, Questlight):
 * a hero-violet tile with a paper H (taller right stroke), a gold cap on that
 * stroke, and a gold star sparkle. Pure Node — a hand-written PNG encoder
 * (zlib deflate + CRC32) over a 4x-supersampled RGBA framebuffer for AA. No
 * canvas/native deps, fully reproducible.
 *
 *   node scripts/gen-icon.js
 *
 * Writes: assets/icon.png (master, hero bg + logo),
 *   assets/adaptive-icon-{background,foreground,monochrome}.png
 */
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const SIZE = 512;
const SS = 4;
const RES = SIZE * SS; // supersample resolution

// Questlight tokens
const HERO = [0x6b, 0x3e, 0xf0];
const INK = [0x24, 0x1b, 0x33];
const PAPER = [0xff, 0xfb, 0xf0];
const GOLD = [0xff, 0xc2, 0x3c];

// ---- framebuffer (RGBA, opaque painter's algorithm) ----
function makeBuf() {
  return new Uint8Array(RES * RES * 4); // alpha 0 = transparent
}
function setPx(buf, x, y, c) {
  if (x < 0 || y < 0 || x >= RES || y >= RES) return;
  const i = (y * RES + x) * 4;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
  buf[i + 3] = 255;
}

// viewBox(100)->device transform per mode
function transform(mode) {
  if (mode === "full") {
    const ppv = RES / 100;
    return { ppv, ox: 0, oy: 0 };
  }
  // inset: fit the logo content (bbox center ~57.5,48 / max dim ~64vb) into
  // the center safe zone (~72% of the canvas) for adaptive foreground/mono.
  const ppv = (0.72 * RES) / 64;
  return { ppv, ox: RES / 2 - 57.5 * ppv, oy: RES / 2 - 48 * ppv };
}

function fillRoundRect(buf, t, vx, vy, vw, vh, vr, color) {
  const x0 = t.ox + vx * t.ppv,
    y0 = t.oy + vy * t.ppv,
    w = vw * t.ppv,
    h = vh * t.ppv,
    r = Math.max(0, vr * t.ppv);
  const xi0 = Math.floor(x0),
    yi0 = Math.floor(y0),
    xi1 = Math.ceil(x0 + w),
    yi1 = Math.ceil(y0 + h);
  for (let y = yi0; y < yi1; y++) {
    for (let x = xi0; x < xi1; x++) {
      const px = x + 0.5,
        py = y + 0.5;
      if (px < x0 || px > x0 + w || py < y0 || py > y0 + h) continue;
      // corner rounding
      let cx = null,
        cy = null;
      if (px < x0 + r && py < y0 + r) {
        cx = x0 + r;
        cy = y0 + r;
      } else if (px > x0 + w - r && py < y0 + r) {
        cx = x0 + w - r;
        cy = y0 + r;
      } else if (px < x0 + r && py > y0 + h - r) {
        cx = x0 + r;
        cy = y0 + h - r;
      } else if (px > x0 + w - r && py > y0 + h - r) {
        cx = x0 + w - r;
        cy = y0 + h - r;
      }
      if (cx !== null) {
        const dx = px - cx,
          dy = py - cy;
        if (dx * dx + dy * dy > r * r) continue;
      }
      setPx(buf, x, y, color);
    }
  }
}

// stroked rounded rect: ink border (sw centered on the edge) + inner fill
function strokedRoundRect(buf, t, vx, vy, vw, vh, vr, fill, sw) {
  const h = sw / 2;
  fillRoundRect(buf, t, vx - h, vy - h, vw + sw, vh + sw, vr + h, INK);
  fillRoundRect(buf, t, vx + h, vy + h, vw - sw, vh - sw, Math.max(0, vr - h), fill);
}

function fillPolygon(buf, t, pts, color) {
  const dp = pts.map(([vx, vy]) => [t.ox + vx * t.ppv, t.oy + vy * t.ppv]);
  let minY = Infinity,
    maxY = -Infinity;
  for (const [, y] of dp) {
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const py = y + 0.5;
    const xs = [];
    for (let i = 0; i < dp.length; i++) {
      const [x1, y1] = dp[i],
        [x2, y2] = dp[(i + 1) % dp.length];
      if (y1 <= py && y2 > py) {
        xs.push(x1 + ((py - y1) / (y2 - y1)) * (x2 - x1));
      } else if (y2 <= py && y1 > py) {
        xs.push(x2 + ((py - y2) / (y1 - y2)) * (x1 - x2));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.floor(xs[k]); x < Math.ceil(xs[k + 1]); x++) {
        const px = x + 0.5;
        if (px >= xs[k] && px <= xs[k + 1]) setPx(buf, x, y, color);
      }
    }
  }
}

// The 5-point star (absolute viewBox points derived from the mock path).
const STAR = [
  [80, 20],
  [82.6, 26],
  [89.0, 26.6],
  [84.2, 31.0],
  [85.6, 37.3],
  [80.0, 34.1],
  [74.4, 37.3],
  [75.8, 31.0],
  [71.0, 26.6],
  [77.4, 26.0],
];
function scaledStar(k) {
  const cx = 80,
    cy = 29; // rough centroid
  return STAR.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
}

function drawLogo(buf, t, mono) {
  if (mono) {
    // solid ink silhouette
    fillRoundRect(buf, t, 26, 30, 15, 46, 4, INK);
    fillRoundRect(buf, t, 59, 22, 15, 54, 4, INK);
    fillRoundRect(buf, t, 41, 46, 18, 14, 0, INK);
    fillPolygon(buf, t, scaledStar(1), INK);
    return;
  }
  strokedRoundRect(buf, t, 26, 30, 15, 46, 4, PAPER, 5); // left bar
  strokedRoundRect(buf, t, 59, 22, 15, 54, 4, PAPER, 5); // right (taller) bar
  strokedRoundRect(buf, t, 41, 46, 18, 14, 0, PAPER, 5); // crossbar
  strokedRoundRect(buf, t, 59, 22, 15, 12, 4, GOLD, 5); // gold cap
  fillPolygon(buf, t, scaledStar(1.5), INK); // star ink outline
  fillPolygon(buf, t, scaledStar(1), GOLD); // gold star
}

function render({ bg, logo, mono }) {
  const buf = makeBuf();
  if (bg) {
    for (let i = 0; i < RES * RES; i++) {
      buf[i * 4] = bg[0];
      buf[i * 4 + 1] = bg[1];
      buf[i * 4 + 2] = bg[2];
      buf[i * 4 + 3] = 255;
    }
  }
  if (logo) drawLogo(buf, transform(bg ? "full" : "inset"), mono);
  return downsample(buf);
}

// box-downsample RES->SIZE averaging RGBA (alpha-weighted for clean edges)
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
          const i = ((y * SS + dy) * RES + (x * SS + dx)) * 4;
          const pa = buf[i + 3];
          r += buf[i] * pa;
          g += buf[i + 1] * pa;
          b += buf[i + 2] * pa;
          a += pa;
        }
      }
      const o = (y * SIZE + x) * 4;
      const n = SS * SS;
      out[o] = a ? Math.round(r / a) : 0;
      out[o + 1] = a ? Math.round(g / a) : 0;
      out[o + 2] = a ? Math.round(b / a) : 0;
      out[o + 3] = Math.round(a / n);
    }
  }
  return out;
}

// ---- PNG encoding ----
const CRC = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
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
    raw[y * (SIZE * 4 + 1)] = 0; // filter none
    rgba.subarray(y * SIZE * 4, (y + 1) * SIZE * 4).forEach((v, i) => {
      raw[y * (SIZE * 4 + 1) + 1 + i] = v;
    });
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const outDir = path.join(__dirname, "..", "assets");
const jobs = {
  "icon.png": { bg: HERO, logo: true },
  "adaptive-icon-background.png": { bg: HERO, logo: false },
  "adaptive-icon-foreground.png": { logo: true },
  "adaptive-icon-monochrome.png": { logo: true, mono: true },
};
for (const [name, opts] of Object.entries(jobs)) {
  const png = encodePng(render(opts));
  fs.writeFileSync(path.join(outDir, name), png);
  console.log(name, png.length, "bytes");
}
