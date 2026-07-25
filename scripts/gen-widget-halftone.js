/**
 * Bakes the widget card's halftone-textured fill as a raster PNG — a rounded
 * rect (transparent outside it) filled with the card color, then a repeating
 * dot pattern on top, matching `Halftone.tsx`'s own technique (a low-opacity
 * dot grid over a solid ground).
 *
 * Why a PNG and not an inline SVG via `SvgWidget`: AndroidSVG renders through
 * a plain `ImageView` that never sets a ScaleType, so it defaults to
 * `FIT_CENTER` (aspect-preserving, letterboxed) — a non-square SVG can't fill
 * a differently-proportioned widget without visible transparent gaps on two
 * sides. `ImageWidget` with `resizeMode="stretch"` maps to `ImageView.
 * ScaleType.FIT_XY`, which genuinely stretches non-uniformly to the view's
 * real bounds regardless of source aspect — the only path in this library
 * that reliably fills an unknown-aspect widget with no gaps. The tradeoff:
 * dots drawn at a fixed source aspect (480×240, matching the "Today 4×2"
 * mock's own ~2:1 card) get mildly stretched on a differently-shaped resize —
 * a minor cosmetic effect, not a functional gap.
 *
 * The rounded-rect clip is baked directly into the PNG's alpha channel (not
 * left to `ImageWidget`'s own `radius` prop, which wraps the bitmap in a
 * `RoundedBitmapDrawable` — redundant and an extra variable once the PNG is
 * already correctly shaped), so the card's corners are always exactly right
 * regardless of how the native layer composes on top of it.
 *
 *   node scripts/gen-widget-halftone.js
 *
 * Writes: assets/widget-halftone-light.png, assets/widget-halftone-dark.png
 */
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const W = 480;
const H = 240;
const SS = 3;
const RW = W * SS;
const RH = H * SS;
const RADIUS = 28 * SS; // matches HabitWidget.tsx's CARD_RADIUS(16dp) scaled up for this canvas
const CELL = 22 * SS; // dot grid spacing, in supersampled px
const DOT_R = 3.2 * SS;

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function makeBuf() {
  return new Uint8Array(RW * RH * 4);
}
function setPx(buf, x, y, c, a = 255) {
  if (x < 0 || y < 0 || x >= RW || y >= RH) return;
  const i = (y * RW + x) * 4;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
  buf[i + 3] = a;
}
function insideRoundedRect(x, y) {
  const px = x + 0.5,
    py = y + 0.5;
  if (px >= RADIUS && px <= RW - RADIUS) return py >= 0 && py <= RH;
  if (py >= RADIUS && py <= RH - RADIUS) return px >= 0 && px <= RW;
  const cx = px < RADIUS ? RADIUS : RW - RADIUS;
  const cy = py < RADIUS ? RADIUS : RH - RADIUS;
  const dx = px - cx,
    dy = py - cy;
  return dx * dx + dy * dy <= RADIUS * RADIUS;
}

function render(cardColorHex, dotColorHex, dotOpacity) {
  const buf = makeBuf();
  const cardRgb = hexToRgb(cardColorHex);
  const dotRgb = hexToRgb(dotColorHex);
  for (let y = 0; y < RH; y++) {
    for (let x = 0; x < RW; x++) {
      if (!insideRoundedRect(x, y)) continue;
      setPx(buf, x, y, cardRgb, 255);
    }
  }
  // Dot grid, alpha-blended onto the card fill (pre-baked, since RemoteViews
  // has no runtime opacity compositing anyway — this bakes the exact same
  // visual result Halftone.tsx's opacity prop produces).
  for (let gy = CELL / 2; gy < RH; gy += CELL) {
    for (let gx = CELL / 2; gx < RW; gx += CELL) {
      for (let y = Math.floor(gy - DOT_R); y <= Math.ceil(gy + DOT_R); y++) {
        for (let x = Math.floor(gx - DOT_R); x <= Math.ceil(gx + DOT_R); x++) {
          if (!insideRoundedRect(x, y)) continue;
          const dx = x + 0.5 - gx,
            dy = y + 0.5 - gy;
          if (dx * dx + dy * dy > DOT_R * DOT_R) continue;
          const i = (y * RW + x) * 4;
          const base = [buf[i], buf[i + 1], buf[i + 2]];
          const blended = base.map((c, k) => Math.round(c * (1 - dotOpacity) + dotRgb[k] * dotOpacity));
          setPx(buf, x, y, blended, 255);
        }
      }
    }
  }
  return downsample(buf);
}

function downsample(buf) {
  const out = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let dy = 0; dy < SS; dy++) {
        for (let dx = 0; dx < SS; dx++) {
          const i = ((y * SS + dy) * RW + (x * SS + dx)) * 4,
            pa = buf[i + 3];
          r += buf[i] * pa;
          g += buf[i + 1] * pa;
          b += buf[i + 2] * pa;
          a += pa;
        }
      }
      const o = (y * W + x) * 4,
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
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0;
    rgba.subarray(y * W * 4, (y + 1) * W * 4).forEach((v, i) => {
      raw[y * (W * 4 + 1) + 1 + i] = v;
    });
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

// Daily strip 4×4's violet header banner gets its own subtle white-dot
// texture on top of the solid fill (`rgba(255,255,255,.18)` over the banner,
// per the mock — identical value in both light/dark, since it's layered on
// the banner's own fixed violet, not the theme-swapped card). No rounded-
// rect clip needed here (unlike the card halftone): it's stretched to fill
// a rectangular banner area whose own top-corner rounding already comes
// from `WidgetCardFrame`'s header slot, and the dots need to reach every
// edge of that rectangle with no transparent margin.
const BW = 480;
const BH = 160;
function renderBannerDots(dotOpacity) {
  const rw = BW * SS,
    rh = BH * SS;
  const buf = new Uint8Array(rw * rh * 4);
  const white = [255, 255, 255];
  for (let gy = CELL / 2; gy < rh; gy += CELL) {
    for (let gx = CELL / 2; gx < rw; gx += CELL) {
      for (let y = Math.floor(gy - DOT_R); y <= Math.ceil(gy + DOT_R); y++) {
        for (let x = Math.floor(gx - DOT_R); x <= Math.ceil(gx + DOT_R); x++) {
          if (x < 0 || y < 0 || x >= rw || y >= rh) continue;
          const dx = x + 0.5 - gx,
            dy = y + 0.5 - gy;
          if (dx * dx + dy * dy > DOT_R * DOT_R) continue;
          const i = (y * rw + x) * 4;
          buf[i] = white[0];
          buf[i + 1] = white[1];
          buf[i + 2] = white[2];
          buf[i + 3] = Math.round(255 * dotOpacity);
        }
      }
    }
  }
  // Downsample at this canvas's own size (the shared `downsample()` above is
  // hardcoded to W×H) — same box-filter/alpha-weighted average, just local.
  const out = new Uint8Array(BW * BH * 4);
  for (let y = 0; y < BH; y++) {
    for (let x = 0; x < BW; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let dy = 0; dy < SS; dy++) {
        for (let dx = 0; dx < SS; dx++) {
          const i = ((y * SS + dy) * rw + (x * SS + dx)) * 4,
            pa = buf[i + 3];
          r += buf[i] * pa;
          g += buf[i + 1] * pa;
          b += buf[i + 2] * pa;
          a += pa;
        }
      }
      const o = (y * BW + x) * 4,
        n = SS * SS;
      out[o] = a ? Math.round(r / a) : 0;
      out[o + 1] = a ? Math.round(g / a) : 0;
      out[o + 2] = a ? Math.round(b / a) : 0;
      out[o + 3] = Math.round(a / n);
    }
  }
  return out;
}
function encodePngSized(rgba, w, h) {
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

const outDir = path.join(__dirname, "..", "assets");
const jobs = {
  // Exact card fill + dot rgba read from the P2 mock's "07 WIDGET SUITE"
  // light/dark sections (Habiteer P2 - Screens.dc.html) — dark previously
  // used the older, unrelated S8 mockup's card color (#151021) and a
  // stronger dot opacity; both are wrong for the current Night Patrol spec.
  "widget-halftone-light.png": render("#F7ECD3", "#241B33", 0.09),
  "widget-halftone-dark.png": render("#2E2447", "#FFFFFF", 0.06),
};
for (const [name, rgba] of Object.entries(jobs)) {
  fs.writeFileSync(path.join(outDir, name), encodePng(rgba));
  console.log(name);
}
fs.writeFileSync(path.join(outDir, "widget-banner-dots.png"), encodePngSized(renderBannerDots(0.18), BW, BH));
console.log("widget-banner-dots.png");
