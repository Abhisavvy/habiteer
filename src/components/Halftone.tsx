import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, Pattern, Circle, Rect } from "react-native-svg";

/**
 * Comic halftone/screentone dot texture (P2). Fills its parent as an absolute
 * background layer — put it behind content on parchment surfaces. Default is
 * ink dots at ~10% for light grounds; pass color="#FFFFFF"/opacity≈0.22 for a
 * hero-coloured ground. Non-interactive.
 */
export function Halftone({
  color = "#241B33",
  opacity = 0.1,
  cell = 13,
  dot = 1.7,
  id = "habiteer-halftone",
  style,
}: {
  color?: string;
  opacity?: number;
  cell?: number;
  dot?: number;
  id?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Svg style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Defs>
        <Pattern id={id} x={0} y={0} width={cell} height={cell} patternUnits="userSpaceOnUse">
          <Circle cx={cell / 2} cy={cell / 2} r={dot} fill={color} opacity={opacity} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
