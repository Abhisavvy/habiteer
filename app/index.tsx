import { View, Text, Pressable, StyleSheet } from "react-native";
import { useAuth } from "@/features/auth/useAuth";
import { theme } from "@/constants/theme";

export default function Home() {
  const signOut = useAuth((s) => s.signOut);
  return (
    <View style={styles.root}>
      <Text style={styles.h}>You're in.</Text>
      <Text style={styles.p}>Phase 3 turns this into your daily habits + tasks view.</Text>
      <Pressable style={styles.btn} onPress={signOut}>
        <Text style={styles.btnText}>Sign out</Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 10, backgroundColor: theme.color.paper },
  h: { fontSize: 26, fontWeight: "800", color: theme.color.ink },
  p: { textAlign: "center", color: theme.color.ink, opacity: 0.7 },
  btn: { marginTop: 16, backgroundColor: theme.color.yellow, borderWidth: 3, borderColor: theme.color.ink, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
  btnText: { fontWeight: "800", color: theme.color.ink },
});
