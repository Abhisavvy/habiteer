import { useEffect, useRef, useState } from "react";
import { Animated, Text } from "react-native";
import type { StyleProp, TextStyle } from "react-native";
import { getReduceMotionCached } from "@/hooks/useReduceMotion";

/**
 * Tweens a displayed number from its previous value to `value` over ~500ms
 * whenever it changes (coin balance, XP progress) instead of snapping —
 * mount and reduce-motion both snap instantly (no "counting up from 0" on
 * first render, no motion under the OS setting).
 */
export function AnimatedNumber({
  value,
  style,
  format = (n) => Math.round(n).toLocaleString(),
}: {
  value: number;
  style?: StyleProp<TextStyle>;
  format?: (n: number) => string;
}) {
  const anim = useRef(new Animated.Value(value)).current;
  const [display, setDisplay] = useState(value);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (getReduceMotionCached() !== false) {
      anim.setValue(value);
      setDisplay(value);
      return;
    }
    const id = anim.addListener(({ value: v }) => setDisplay(v));
    Animated.timing(anim, { toValue: value, duration: 500, useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [value, anim]);

  return <Text style={style}>{format(display)}</Text>;
}
