import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

/**
 * Applies the generated constants, RLS policies, and RPC functions to the
 * live dev database via DATABASE_URL. Safe to re-run: every statement in
 * these files uses CREATE OR REPLACE / IF NOT EXISTS / DROP ... IF EXISTS.
 */
const FILES = [
  "src/lib/db/generated/constants.sql",
  "src/lib/db/rls.sql",
  "src/lib/db/rpc.sql",
];

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    for (const relPath of FILES) {
      const fullPath = join(__dirname, "..", relPath);
      const sql = readFileSync(fullPath, "utf8");
      console.log(`Applying ${relPath}...`);
      await client.query(sql);
      console.log(`  OK`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
