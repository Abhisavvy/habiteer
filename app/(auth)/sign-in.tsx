import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import * as WebBrowser from "expo-web-browser";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import { supabase } from "@/lib/supabase/client";
import { theme } from "@/constants/theme";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_REDIRECT_TO = "habiteer://";

/** Email/password sign-in & sign-up, plus Google OAuth. */
export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const withEmail = async (mode: "in" | "up") => {
    setBusy(true);
    try {
      const { error } =
        mode === "in"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });
      if (error) Alert.alert("Sign-in failed", error.message);
      else if (mode === "up") {
        Alert.alert("Check your email", "We sent a confirmation link — tap it, then sign in.");
      }
    } finally {
      setBusy(false);
    }
  };

  const withGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: GOOGLE_REDIRECT_TO, skipBrowserRedirect: true },
    });
    if (error) return Alert.alert("Google sign-in failed", error.message);
    if (!data?.url) return;

    const result = await WebBrowser.openAuthSessionAsync(data.url, GOOGLE_REDIRECT_TO);
    if (result.type !== "success" || !result.url) return;

    const { params, errorCode } = QueryParams.getQueryParams(result.url);
    if (errorCode) return Alert.alert("Google sign-in failed", errorCode);

    const { access_token, refresh_token } = params;
    if (!access_token || !refresh_token) return;

    const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
    if (sessionError) Alert.alert("Google sign-in failed", sessionError.message);
  };

  return (
    <View style={styles.root}>
      <Text style={styles.logo}>HABITEER</Text>
      <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#8A8395" autoCapitalize="none"
        keyboardType="email-address" value={email} onChangeText={setEmail} />
      <View style={styles.passwordWrap}>
        <TextInput
          style={[styles.input, styles.passwordInput]}
          placeholder="Password"
          placeholderTextColor="#8A8395"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
        />
        <Pressable
          style={styles.eyeBtn}
          onPress={() => setShowPassword((s) => !s)}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? (
            <EyeOff size={20} strokeWidth={2} color={theme.color.ink} />
          ) : (
            <Eye size={20} strokeWidth={2} color={theme.color.ink} />
          )}
        </Pressable>
      </View>
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
    padding: 12, backgroundColor: "#fff", fontSize: 16, color: theme.color.ink },
  passwordWrap: { position: "relative" },
  passwordInput: { paddingRight: 44 },
  eyeBtn: { position: "absolute", right: 12, top: 0, bottom: 0, justifyContent: "center" },
  primary: { backgroundColor: theme.color.violet, borderWidth: theme.border, borderColor: theme.color.ink,
    borderRadius: 10, padding: 14, alignItems: "center" },
  google: { backgroundColor: theme.color.yellow, borderWidth: theme.border, borderColor: theme.color.ink,
    borderRadius: 10, padding: 14, alignItems: "center" },
  primaryText: { fontWeight: "800", fontSize: 16, color: theme.color.ink },
  ghost: { padding: 10, alignItems: "center" },
  ghostText: { fontWeight: "700", color: theme.color.ink },
});
