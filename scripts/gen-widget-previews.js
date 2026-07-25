/**
 * Structural preview thumbnails for the widget picker (long-press home
 * screen → widgets → Habiteer) — one per widget in the suite. These are
 * NOT the live-rendered widgets (RemoteViews renders those); Android just
 * needs a static image to show while picking. No font/glyph rasterizer is
 * available in this environment, so text is "greeked" as solid bars — the
 * same honest convention the original widget-preview.png used (see
 * PROGRESS.md) — every other element (card color, borders, ember/gold/
 * success accents) is the real token color, not a placeholder.
 *
 *   node scripts/gen-widget-previews.js
 *
 * Writes: assets/widget-preview-today-expanded.png (360×240)
 *         assets/widget-preview-companion.png (240×240)
 *         assets/widget-preview-streak.png (240×240)
 */
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const SS = 3;
const INK = [0x24, 0x1b, 0x33];
const PAPER = [0xf7, 0xec, 0xd3];
const EMBER = [0xff, 0x6a, 0x3d];
const GOLD = [0xff, 0xc2, 0x3c];
const SUCCESS = [0x16, 0xb9, 0x8a];
const HERO = [0x6b, 0x3e, 0xf0];
const WHITE = [255, 255, 255];

function canvas(w, h) {
  const rw = w * SS,
    rh = h * SS;
  const buf = new Uint8Array(rw * rh * 4);
  function setPx(x, y, c, a = 255) {
    if (x < 0 || y < 0 || x >= rw || y >= rh) return;
    const i = (y * rw + x) * 4;
    buf[i] = c[0];
    buf[i + 1] = c[1];
    buf[i + 2] = c[2];
    buf[i + 3] = a;
  }
  function fillRoundRect(x0, y0, w0, h0, r, color) {
    for (let y = y0; y < y0 + h0; y++) {
      for (let x = x0; x < x0 + w0; x++) {
        const px = x + 0.5,
          py = y + 0.5;
        if (px < x0 || px > x0 + w0 || py < y0 || py > y0 + h0) continue;
        let cx = null,
          cy = null;
        if (px < x0 + r && py < y0 + r) {
          cx = x0 + r;
          cy = y0 + r;
        } else if (px > x0 + w0 - r && py < y0 + r) {
          cx = x0 + w0 - r;
          cy = y0 + r;
        } else if (px < x0 + r && py > y0 + h0 - r) {
          cx = x0 + r;
          cy = y0 + h0 - r;
        } else if (px > x0 + w0 - r && py > y0 + h0 - r) {
          cx = x0 + w0 - r;
          cy = y0 + h0 - r;
        }
        if (cx !== null) {
          const dx = px - cx,
            dy = py - cy;
          if (dx * dx + dy * dy > r * r) continue;
        }
        setPx(x, y, color);
      }
    }
  }
  function fillCircle(cx, cy, r, color) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x + 0.5 - cx,
          dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r * r) setPx(x, y, color);
      }
  }
  function strokeRoundRect(x0, y0, w0, h0, r, sw, color) {
    fillRoundRect(x0 - sw / 2, y0 - sw / 2, w0 + sw, h0 + sw, r + sw / 2, color);
  }
  return { rw, rh, buf, setPx, fillRoundRect, fillCircle, strokeRoundRect };
}

function downsample(c, w, h) {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let dy = 0; dy < SS; dy++)
        for (let dx = 0; dx < SS; dx++) {
          const i = ((y * SS + dy) * c.rw + (x * SS + dx)) * 4,
            pa = c.buf[i + 3];
          r += c.buf[i] * pa;
          g += c.buf[i + 1] * pa;
          b += c.buf[i + 2] * pa;
          a += pa;
        }
      const o = (y * w + x) * 4,
        n = SS * SS;
      out[o] = a ? Math.round(r / a) : 0;
      out[o + 1] = a ? Math.round(g / a) : 0;
      out[o + 2] = a ? Math.round(b / a) : 0;
      out[o + 3] = Math.round(a / n);
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
function encodePng(rgba, w, h) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.subarray(y * w * 4, (y + 1) * w * 4).forEach((v, i) => {
      raw[y * (w * 4 + 1) + 1 + i] = v;
    });
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

function save(name, w, h, draw) {
  const c = canvas(w, h);
  draw(c);
  fs.writeFileSync(path.join(__dirname, "..", "assets", name), encodePng(downsample(c, w, h), w, h));
  console.log(name);
}

const S = (n) => n * SS; // scale a design-space unit into supersampled px

// --- Today 4×4 preview (360×240): header bar + progress bar + 3 rows ---
save("widget-preview-today-expanded.png", 360, 240, (c) => {
  c.fillRoundRect(0, 0, c.rw, c.rh, S(16), PAPER);
  c.strokeRoundRect(S(2), S(2), c.rw - S(4), c.rh - S(4), S(14), S(3), INK);
  // icon tile
  c.fillRoundRect(S(14), S(14), S(30), S(30), S(9), EMBER);
  // header text bars
  c.fillRoundRect(S(52), S(16), S(70), S(12), S(4), INK);
  c.fillRoundRect(S(52), S(32), S(100), S(7), S(3), [80, 74, 92]);
  // streak + coin bars
  c.fillRoundRect(S(250), S(18), S(28), S(10), S(3), EMBER);
  c.fillRoundRect(S(300), S(18), S(40), S(10), S(3), GOLD);
  // progress bar
  c.fillRoundRect(S(14), S(56), c.rw - S(28), S(8), S(4), WHITE);
  c.fillRoundRect(S(14), S(56), (c.rw - S(28)) * 0.7, S(8), S(4), HERO);
  // rows
  for (let i = 0; i < 3; i++) {
    const y = S(78) + i * S(46);
    c.fillRoundRect(S(14), y, S(20), S(20), S(6), i < 2 ? SUCCESS : WHITE);
    if (i < 2) {
      // check glyph, approximated as a small diagonal bar pair — skip for
      // simplicity, filled square already reads as "done" at thumbnail size.
    } else {
      c.strokeRoundRect(S(14), y, S(20), S(20), S(6), S(2), INK);
    }
    c.fillRoundRect(S(42), y + S(4), S(180), S(12), S(4), i < 2 ? [130, 122, 145] : INK);
    c.fillRoundRect(S(310), y + S(4), S(30), S(12), S(4), i < 2 ? [180, 174, 190] : EMBER);
  }
});

// --- Companion 2×2 preview (240×240): Ember-ish blob + LVL bar + streak bar ---
save("widget-preview-companion.png", 240, 240, (c) => {
  c.fillRoundRect(0, 0, c.rw, c.rh, S(16), PAPER);
  c.strokeRoundRect(S(2), S(2), c.rw - S(4), c.rh - S(4), S(14), S(3), INK);
  const cx = c.rw / 2;
  c.fillCircle(cx, S(90), S(46), [138, 107, 242]);
  c.fillCircle(cx - S(14), S(84), S(9), WHITE);
  c.fillCircle(cx + S(14), S(84), S(9), WHITE);
  c.fillCircle(cx - S(14), S(86), S(4), INK);
  c.fillCircle(cx + S(14), S(86), S(4), INK);
  // crown
  c.fillRoundRect(cx - S(16), S(40), S(32), S(10), S(3), GOLD);
  // LVL bar + streak bar, centered
  c.fillRoundRect(cx - S(34), S(152), S(68), S(16), S(5), HERO);
  c.fillRoundRect(cx - S(30), S(176), S(60), S(10), S(4), EMBER);
});

// --- Streak 2×2 preview (240×240): solid ember card + big number bar ---
save("widget-preview-streak.png", 240, 240, (c) => {
  c.fillRoundRect(0, 0, c.rw, c.rh, S(16), EMBER);
  c.strokeRoundRect(S(2), S(2), c.rw - S(4), c.rh - S(4), S(14), S(3), INK);
  const cx = c.rw / 2;
  c.fillCircle(cx, S(70), S(26), GOLD); // 🔥 stand-in
  c.fillRoundRect(cx - S(30), S(112), S(60), S(40), S(8), GOLD); // big number bar
  c.fillRoundRect(cx - S(46), S(168), S(92), S(14), S(5), WHITE); // "DAY STREAK" bar
});

// --- Combo 2×2 preview (240×240): paper card + gold starburst stand-in ---
// A true 16-point star isn't in this canvas helper's toolkit (fillRoundRect/
// fillCircle only) — a rotated square reads as "badge-shaped" at thumbnail
// size, same "structural, not literal" convention every other preview here
// already uses (greeked text, stand-in shapes for real icons).
save("widget-preview-combo.png", 240, 240, (c) => {
  c.fillRoundRect(0, 0, c.rw, c.rh, S(16), PAPER);
  c.strokeRoundRect(S(2), S(2), c.rw - S(4), c.rh - S(4), S(14), S(3), INK);
  const cx = c.rw / 2,
    cy = c.rh / 2;
  const half = S(46);
  c.fillRoundRect(cx - half, cy - half, half * 2, half * 2, S(10), GOLD); // starburst stand-in
  c.strokeRoundRect(cx - half, cy - half, half * 2, half * 2, S(10), S(3), INK);
  c.fillRoundRect(cx - S(20), cy - S(6), S(40), S(24), S(4), INK); // "×N" bar
});

// --- Quest 4×2 preview (360×180): paper card + progress bar + reward tag ---
save("widget-preview-quest.png", 360, 180, (c) => {
  c.fillRoundRect(0, 0, c.rw, c.rh, S(16), PAPER);
  c.strokeRoundRect(S(2), S(2), c.rw - S(4), c.rh - S(4), S(14), S(3), INK);
  c.fillRoundRect(S(14), S(14), S(140), S(12), S(4), INK); // "QUEST OF THE DAY" bar
  c.fillRoundRect(S(14), S(36), S(100), S(8), S(3), [130, 122, 145]); // "Complete N habits" bar
  c.fillRoundRect(S(14), S(56), c.rw - S(28), S(12), S(6), WHITE);
  c.strokeRoundRect(S(14), S(56), c.rw - S(28), S(12), S(6), S(2), INK);
  c.fillRoundRect(S(14), S(56), (c.rw - S(28)) * 0.66, S(12), S(6), SUCCESS);
  c.fillRoundRect(S(14), S(84), S(60), S(9), S(3), [180, 174, 190]); // "N / M done" bar
  c.fillRoundRect(c.rw - S(90), S(78), S(76), S(22), S(6), GOLD); // reward tag
  c.strokeRoundRect(c.rw - S(90), S(78), S(76), S(22), S(6), S(2), INK);
});
