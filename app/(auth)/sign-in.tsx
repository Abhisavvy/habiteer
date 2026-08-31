import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, Image, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import * as WebBrowser from "expo-web-browser";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import { fetchEnabledProviders, isProviderEnabled } from "@/features/auth/providers";
import { supabase } from "@/lib/supabase/client";
import { HardShadow } from "@/components/HardShadow";
import { theme } from "@/constants/theme";
import { fonts } from "@/constants/fonts";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_REDIRECT_TO = "habiteer://";

/** Email/password sign-in & sign-up, plus Google OAuth. */
export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Whether this project actually has Google configured. Starts true so the
  // button never flickers in on a normal launch; only an explicit `false` from
  // the project hides it. See features/auth/providers.ts for why it fails open.
  const [googleEnabled, setGoogleEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchEnabledProviders().then((settings) => {
      if (!cancelled) setGoogleEnabled(isProviderEnabled(settings, "google"));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const withEmail = async (mode: "in" | "up") => {
    setBusy(true);
    try {
      const { data, error } =
        mode === "in"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });
      if (error) Alert.alert(mode === "in" ? "Sign-in failed" : "Sign-up failed", error.message);
      // Only tell someone to check their email if a confirmation is ACTUALLY
      // pending. When the project has email confirmation off, signUp returns a
      // session and they are already signed in — the old unconditional message
      // sent them off to tap a link that was never sent, which reads exactly
      // like the sign-up having failed. onAuthStateChange handles the
      // navigation, so the success path needs no alert at all.
      else if (mode === "up" && !data.session) {
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
    // Previously a silent return: the tap did nothing at all and gave no reason,
    // which is indistinguishable from the button being dead.
    if (!data?.url) {
      return Alert.alert("Google sign-in failed", "Couldn't start Google sign-in. Try email instead.");
    }

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
      <View style={styles.topBlock}>
        <HardShadow style={styles.icon}>
          <Image source={require("../../assets/icon.png")} style={styles.iconImage} />
        </HardShadow>
        <Text style={styles.wordmark}>HABITEER</Text>
        <Text style={styles.tagline}>Level up your day.</Text>
      </View>

      <View style={styles.formBlock}>
        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
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
                <EyeOff size={19} strokeWidth={2} color="rgba(26,21,35,0.5)" />
              ) : (
                <Eye size={19} strokeWidth={2} color="rgba(26,21,35,0.5)" />
              )}
            </Pressable>
          </View>
        </View>

        <HardShadow style={styles.signInBtn} disabled={busy} onPress={() => withEmail("in")}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.signInText}>Sign in</Text>}
        </HardShadow>

        <HardShadow style={styles.createBtn} disabled={busy} onPress={() => withEmail("up")}>
          <Text style={styles.createText}>Create account</Text>
        </HardShadow>

        {/* Hidden entirely when the project has no Google provider — a button
            that is guaranteed to error is worse than no button. The divider goes
            with it, or an orphan "or" is left dangling under Create account. */}
        {googleEnabled && (
          <>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <HardShadow style={styles.googleBtn} disabled={busy} onPress={withGoogle}>
              <View style={styles.googleBadge}>
                <Text style={styles.googleG}>G</Text>
              </View>
              <Text style={styles.googleText}>Continue with Google</Text>
            </HardShadow>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.paper, paddingHorizontal: 22 },
  topBlock: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8 },
  icon: {
    width: 88,
    height: 88,
    borderRadius: 22,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    overflow: "hidden",
    shadowColor: theme.color.ink,
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  iconImage: { width: "100%", height: "100%" },
  wordmark: { fontSize: 36, color: theme.color.ink, letterSpacing: 0.5, marginTop: 12, fontFamily: fonts.heading },
  tagline: { fontWeight: "600", fontSize: 14, color: theme.color.hero, fontFamily: fonts.display600 },
  formBlock: { gap: 14, paddingBottom: 26 },
  field: { gap: 6 },
  label: {
    fontWeight: "700",
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "rgba(26,21,35,0.6)",
    fontFamily: fonts.mono700,
  },
  input: {
    fontSize: 15,
    color: theme.color.ink,
    backgroundColor: "#fff",
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 11,
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontFamily: fonts.display600,
  },
  passwordWrap: { position: "relative" },
  passwordInput: { paddingRight: 44 },
  eyeBtn: { position: "absolute", right: 12, top: 0, bottom: 0, justifyContent: "center" },
  signInBtn: {
    marginTop: 4,
    height: 54,
    backgroundColor: theme.color.violet,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.color.ink,
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  signInText: { fontWeight: "700", fontSize: 17, color: "#fff", fontFamily: fonts.display700 },
  createBtn: {
    height: 52,
    backgroundColor: "#fff",
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.color.ink,
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  createText: { fontWeight: "700", fontSize: 16, color: theme.color.ink, fontFamily: fonts.display700 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 2 },
  dividerLine: { flex: 1, height: 2, backgroundColor: "rgba(26,21,35,0.15)" },
  dividerText: { fontWeight: "600", fontSize: 12, color: "rgba(26,21,35,0.45)", fontFamily: fonts.display600 },
  googleBtn: {
    height: 50,
    flexDirection: "row",
    gap: 10,
    backgroundColor: theme.color.surface,
    borderWidth: theme.border,
    borderColor: theme.color.ink,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.color.ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  googleBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: theme.color.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  googleText: { fontWeight: "700", fontSize: 15, color: theme.color.ink, fontFamily: fonts.display700 },
  googleG: { fontWeight: "800", fontSize: 14, color: theme.color.hero, fontFamily: fonts.display700 },
});
