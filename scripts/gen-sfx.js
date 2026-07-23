/**
 * Synthesizes the app's UI sound effects as self-contained 16-bit PCM WAV
 * files — no external audio packs, keeps the repo $0 and offline-buildable.
 * Each cue is a short additive-synth tone sequence with an attack/decay
 * envelope (so there are no click artifacts at edges). Regenerate with:
 *   node scripts/gen-sfx.js
 * Output: assets/sfx/{complete,redeem,levelup}.wav
 */
const fs = require("fs");
const path = require("path");

const SAMPLE_RATE = 44100;

/** One note: fundamental + a couple of soft harmonics, ADSR-ish envelope. */
function renderNote(freq, durSec, { gain = 0.5, harmonics = [1, 0.35, 0.15] } = {}) {
  const n = Math.floor(SAMPLE_RATE * durSec);
  const out = new Float32Array(n);
  const attack = Math.floor(n * 0.02);
  const release = Math.floor(n * 0.45);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let h = 0; h < harmonics.length; h++) {
      s += harmonics[h] * Math.sin((2 * Math.PI * freq * (h + 1) * i) / SAMPLE_RATE);
    }
    // envelope: linear attack, then exponential-ish decay over the tail
    let env = 1;
    if (i < attack) env = i / attack;
    else if (i > n - release) env = Math.max(0, (n - i) / release);
    out[i] = s * gain * env;
  }
  return out;
}

/** Concatenate note buffers with optional overlap (negative gap) for legato. */
function sequence(segments) {
  const buffers = segments.map((seg) =>
    seg.silence != null ? new Float32Array(Math.floor(SAMPLE_RATE * seg.silence)) : renderNote(seg.freq, seg.dur, seg)
  );
  const total = buffers.reduce((sum, b) => sum + b.length, 0);
  const mix = new Float32Array(total);
  let pos = 0;
  for (const b of buffers) {
    mix.set(b, pos);
    pos += b.length;
  }
  return mix;
}

function toWav(samples) {
  const dataLen = samples.length * 2;
  const buf = Buffer.alloc(44 + dataLen);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); // PCM chunk size
  buf.writeUInt16LE(1, 20); // audio format = PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write("data", 36);
  buf.writeUInt32LE(dataLen, 40);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  return buf;
}

const cues = {
  // Completion: a bright rising two-note "pop".
  complete: sequence([
    { freq: 660, dur: 0.08, gain: 0.45 },
    { freq: 990, dur: 0.16, gain: 0.5 },
  ]),
  // Redeem: a quick coin "cha-ching" — two high, closely-spaced chimes.
  redeem: sequence([
    { freq: 988, dur: 0.09, gain: 0.45 },
    { silence: 0.02 },
    { freq: 1319, dur: 0.22, gain: 0.5 },
  ]),
  // Level up: an ascending major arpeggio C5–E5–G5–C6.
  levelup: sequence([
    { freq: 523, dur: 0.11, gain: 0.42 },
    { freq: 659, dur: 0.11, gain: 0.44 },
    { freq: 784, dur: 0.11, gain: 0.46 },
    { freq: 1047, dur: 0.3, gain: 0.5 },
  ]),
};

const outDir = path.join(__dirname, "..", "assets", "sfx");
fs.mkdirSync(outDir, { recursive: true });
for (const [name, samples] of Object.entries(cues)) {
  const file = path.join(outDir, `${name}.wav`);
  fs.writeFileSync(file, toWav(samples));
  console.log(`wrote ${file} (${samples.length} samples, ${(samples.length / SAMPLE_RATE).toFixed(2)}s)`);
}
