/**
 * Comic-RPG design tokens — "Questlight" palette (P2 overhaul, Direction A).
 *
 * The legacy key names (violet/jade/fire/yellow/ink/paper/card) are kept but
 * repointed at the new palette, so the whole app recolours to Questlight
 * without editing every reference; new code should prefer the semantic names
 * (hero/success/ember/gold/info/danger/surface).
 */
export const theme = {
  color: {
    // legacy names → Questlight values (keeps existing references working)
    ink: "#241B33",
    paper: "#F7ECD3", // parchment page ground
    card: "#FFFBF0", // == surface
    yellow: "#FFC23C", // == gold
    violet: "#6B3EF0", // == hero
    fire: "#FF6A3D", // == ember
    jade: "#16B98A", // == success

    // semantic names (preferred going forward)
    hero: "#6B3EF0",
    surface: "#FFFBF0",
    gold: "#FFC23C",
    ember: "#FF6A3D",
    success: "#16B98A",
    info: "#35A7EE",
    danger: "#E84667",
  },
  /** Text/foreground colour to place on top of each fill. */
  on: {
    hero: "#FFFFFF",
    gold: "#241B33",
    ember: "#FFFFFF",
    success: "#FFFFFF",
    info: "#FFFFFF",
    danger: "#FFFFFF",
    surface: "#241B33",
  },
  radius: 18, // legacy default (== radii.card)
  border: 3, // legacy default (== borders.standard)
  radii: { card: 18, control: 12, chip: 9, pill: 999 },
  borders: { hairline: 2, standard: 3, bold: 4 },
  /** Solid offset shadow layers (Android HardShadow) — no blur. */
  depth: {
    color: "#241B33",
    e1: { width: 3, height: 3 },
    e2: { width: 5, height: 5 },
    e3: { width: 7, height: 7 },
  },
} as const;
