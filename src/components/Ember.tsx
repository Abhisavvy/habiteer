import Svg, { Path, Ellipse, Circle } from "react-native-svg";

/**
 * Ember — the app's comic-RPG companion mascot (P2, mascot-1). A purple flame
 * sprite with a little gold crown; appears in the header, splash, empty states,
 * level-up, and the companion widget. Ported verbatim from the design
 * deliverable's SVG (viewBox 130×130).
 *
 * `expression` swaps the eyes/mouth for celebrate / sleepy states (used on
 * level-up and on a missed-day empty state); default is neutral.
 */
export function Ember({ size = 96, expression = "neutral" }: { size?: number; expression?: "neutral" | "celebrate" | "sleepy" }) {
  const s = 4.5;
  return (
    <Svg width={size} height={size} viewBox="0 0 130 130">
      {/* body */}
      <Path
        d="M28 100 C28 60 42 40 65 40 C88 40 102 60 102 100 C102 104 100 106 96 106 C92 106 91 100 86 100 C81 100 80 107 74 107 C68 107 68 100 65 100 C62 100 62 107 56 107 C50 107 49 100 44 100 C39 100 38 106 34 106 C30 106 28 104 28 100 Z"
        fill="#8A6BF2"
        stroke="#241B33"
        strokeWidth={s}
        strokeLinejoin="round"
      />
      {/* belly */}
      <Path d="M46 78 C46 64 54 58 65 58 C76 58 84 64 84 78 C84 88 76 93 65 93 C54 93 46 88 46 78 Z" fill="#C9BCFA" />
      {/* eyes */}
      {expression === "sleepy" ? (
        <>
          <Path d="M48 75 h14" stroke="#241B33" strokeWidth={3} strokeLinecap="round" />
          <Path d="M68 75 h14" stroke="#241B33" strokeWidth={3} strokeLinecap="round" />
        </>
      ) : (
        <>
          <Ellipse cx={55} cy={74} rx={7.5} ry={8.5} fill="#fff" stroke="#241B33" strokeWidth={3} />
          <Ellipse cx={75} cy={74} rx={7.5} ry={8.5} fill="#fff" stroke="#241B33" strokeWidth={3} />
          <Circle cx={56} cy={76} r={3.2} fill="#241B33" />
          <Circle cx={76} cy={76} r={3.2} fill="#241B33" />
          <Circle cx={57.4} cy={74.6} r={1.1} fill="#fff" />
          <Circle cx={77.4} cy={74.6} r={1.1} fill="#fff" />
        </>
      )}
      {/* mouth */}
      {expression === "celebrate" ? (
        <Path d="M56 82 Q65 94 74 82 Z" fill="#241B33" />
      ) : (
        <Path d="M58 84 Q65 89 72 84" fill="none" stroke="#241B33" strokeWidth={2.8} strokeLinecap="round" />
      )}
      {/* crown */}
      <Path d="M50 40 l4 -16 22 0 4 16" fill="#FFC23C" stroke="#241B33" strokeWidth={4} strokeLinejoin="round" />
      <Circle cx={54} cy={26} r={3} fill="#FF6A3D" stroke="#241B33" strokeWidth={2.5} />
      <Circle cx={65} cy={24} r={3} fill="#FF6A3D" stroke="#241B33" strokeWidth={2.5} />
      <Circle cx={76} cy={26} r={3} fill="#FF6A3D" stroke="#241B33" strokeWidth={2.5} />
    </Svg>
  );
}
