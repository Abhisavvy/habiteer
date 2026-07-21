import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import { supabase } from "@/lib/supabase/client";
import { theme } from "@/constants/theme";

/** Email/password sign-in & sign-up, plus Google OAuth. */
export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const withEmail = async (mode: "in" | "up") => {
    setBusy(true);
    const fn = mode === "in" ? supabase.auth.signInWithPassword : supabase.auth.signUp;
    const { error } = await fn({ email, password });
    setBusy(false);
    if (error) Alert.alert("Sign-in failed", error.message);
  };

  const withGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: "habiteer://" },
    });
    if (error) Alert.alert("Google sign-in failed", error.message);
  };

  return (
    <View style={styles.root}>
      <Text style={styles.logo}>HABITEER</Text>
      <TextInput style={styles.input} placeholder="Email" autoCapitalize="none"
        keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Password" secureTextEntry
        value={password} onChangeText={setPassword} />
      <Pressable style={styles.primary} disabled={busy} onPress={() => withEmail("in")}>
        <Text style={styles.primaryText}>Sign in</Text>
      </Pressable>
      <Pressable style={styles.ghost} disabled={busy} onPress={() => withEmail("up")}>
        <Text style={styles.ghostText}>Create account</Text>
      </Pressable>
      <Pressable style={styles.google} onPress={withGoogle}>
        <Text style={styles.primaryText}>Continue with Google</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", padding: 24, gap: 12, backgroundColor: theme.color.paper },
  logo: { fontSize: 34, fontWeight: "800", color: theme.color.ink, marginBottom: 12 },
  input: { borderWidth: theme.border, borderColor: theme.color.ink, borderRadius: 10,
    padding: 12, backgroundColor: "#fff", fontSize: 16 },
  primary: { backgroundColor: theme.color.violet, borderWidth: theme.border, borderColor: theme.color.ink,
    borderRadius: 10, padding: 14, alignItems: "center" },
  google: { backgroundColor: theme.color.yellow, borderWidth: theme.border, borderColor: theme.color.ink,
    borderRadius: 10, padding: 14, alignItems: "center" },
  primaryText: { fontWeight: "800", fontSize: 16, color: theme.color.ink },
  ghost: { padding: 10, alignItems: "center" },
  ghostText: { fontWeight: "700", color: theme.color.ink },
});
