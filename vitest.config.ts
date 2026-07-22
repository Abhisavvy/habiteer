import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  // The default 5000ms was consistently too tight for src/lib/db's remote
  // Supabase integration tests — several sequential round-trips per test,
  // plain network latency variance (not a real hang), pushed past it.
  test: { include: ["src/**/*.test.ts"], environment: "node", testTimeout: 20000 },
});
