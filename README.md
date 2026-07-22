# Habiteer

Gamified habit + task tracker. Expo (React Native) client, Supabase backend, Android home-screen widget. Free to run on Android.

## One-time setup

### 1. Install
```bash
npm install
npx expo install --fix   # aligns native package versions to your Expo SDK
```

### 2. Supabase (free tier)
1. Create a project at supabase.com.
2. Project Settings -> API: copy the **Project URL** and **publishable/anon key** into `.env` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`). Never use the secret/service-role key here.
3. Settings -> Database -> Connect: copy the **session pooler** connection string (not "Direct connection" — that hostname can resolve IPv6-only on some networks) into `DATABASE_URL` (used only for migrations/admin scripts, never shipped to the client).
4. Authentication -> Providers: enable **Email**, and enable **Google** (paste your Google OAuth client id/secret) if you want Google sign-in.
5. Add a persistent test account for the integration tests: `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` in `.env` (any real-looking email works if "Confirm email" is off).

### 3. Google OAuth
1. Google Cloud Console -> Credentials -> OAuth client (Web).
2. Add the Supabase auth callback URL (shown in the Google provider screen) as an authorized redirect URI.
3. Put the client id in `.env` (`EXPO_PUBLIC_GOOGLE_CLIENT_ID`).

### 4. Database schema
```bash
npm run db:generate    # generate migration from src/lib/db/schema.ts
npm run db:push        # apply to Supabase
npm run db:gen-sql      # regenerate generated/constants.sql from the gamification lib
npm run db:apply-sql    # apply generated constants + rls.sql + rpc.sql via DATABASE_URL
```

### 5. Android SDK (one-time, for the dev client — see "Run" below)
Expo Go **cannot** run this app — the home-screen widget needs a custom
native module, which Expo Go doesn't support. You need a local Android
toolchain instead:
```bash
brew install openjdk@17
brew install --cask android-commandlinetools
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0" "ndk;27.1.12297006"
```
Then add to `~/.zshrc` (adjust if your shell differs):
```bash
export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"
```
On the phone: Settings -> About phone -> tap Build number 7x to unlock
Developer options -> enable **USB debugging** (and, on Xiaomi/MIUI devices
specifically, also **Install via USB**, a separate toggle that blocks `adb
install` if left off). Connect via USB and confirm with `adb devices`.

## Run
```bash
npx expo prebuild -p android   # generates android/ — only needed after changing
                                # native config (app.config.ts plugins, new
                                # native deps); android/ is gitignored (CNG)
npx expo run:android           # builds the dev client, installs on the
                                # USB-connected device, starts Metro
```
After the first `run:android`, day-to-day iteration is just editing JS/TS —
Metro fast-refreshes into the already-installed dev client exactly like Expo
Go used to, no rebuild needed unless native config changes again.

Build a shareable release APK later with EAS (`npx eas build -p android --profile preview`) or a local release build.

## Test
```bash
npm test              # gamification core + RPC integration tests (Vitest) — currently green
npx tsc --noEmit       # type-check
```
