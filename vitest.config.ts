import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  // The default 5000ms was consistently too tight for src/lib/db's remote
  // Supabase integration tests — several sequential round-trips per test,
  // plain network latency variance (not a real hang), pushed past it.
  //
  // Raised 20000 -> 40000 when the project moved to ap-southeast-2 (Sydney)
  // from ap-northeast-2. Per-round-trip latency roughly doubled, and the tests
  // that call fundCoins are the worst case: it earns coins for real through
  // fn_complete_trackable in a loop, so a 50-coin stake is several sequential
  // round trips before the test body even starts.
  test: { include: ["src/**/*.test.ts"], environment: "node", testTimeout: 40000 },
});
