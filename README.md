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
2. Project Settings -> API: copy the **Project URL** and **anon key** into `.env` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`).
3. Settings -> Database: copy the connection string into `DATABASE_URL` (used only for migrations).
4. Authentication -> Providers: enable **Email**, and enable **Google** (paste your Google OAuth client id/secret).

### 3. Google OAuth
1. Google Cloud Console -> Credentials -> OAuth client (Web).
2. Add the Supabase auth callback URL (shown in the Google provider screen) as an authorized redirect URI.
3. Put the client id in `.env` (`EXPO_PUBLIC_GOOGLE_CLIENT_ID`).

### 4. Database schema
```bash
npm run db:generate   # generate migration from src/lib/db/schema.ts
npm run db:push       # apply to Supabase
```
Then run `src/lib/db/rls.sql` in the Supabase SQL editor to enable Row-Level Security + the leaderboard view.

## Run
```bash
npx expo start        # press 'a' for Android (device/emulator)
```
Build a shareable APK later with EAS (`npx eas build -p android --profile preview`).

## Test
```bash
npm test              # gamification core (Vitest) — currently green
```
