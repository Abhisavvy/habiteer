import "dotenv/config";
import { Client } from "pg";
import { mkdirSync, writeFileSync } from "node:fs";

/**
 * Manual logical backup of the Habiteer Supabase database.
 *
 * WHY: the Supabase free tier has NO automated backups / point-in-time
 * recovery (those are Pro+), so this is the only restore path. Run it
 * periodically: `npm run db:backup`.
 *
 * WHAT: dumps every public-schema table's rows to a timestamped JSON file in
 * backups/ (git-ignored — it contains user data). The SCHEMA itself is already
 * versioned in git (drizzle migrations + rls.sql/rpc.sql/constants.sql), so a
 * restore = recreate the schema on a fresh project, then re-insert this JSON.
 * A read-only snapshot of auth.users is included for reference (auth is
 * otherwise Supabase-managed and restored via their own tooling).
 */
const c = new Client({ connectionString: process.env.DATABASE_URL });

(async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set (put it in .env)");
  await c.connect();

  const tables: string[] = (
    await c.query(`select tablename from pg_tables where schemaname = 'public' order by tablename`)
  ).rows.map((r: { tablename: string }) => r.tablename);

  const dump: Record<string, unknown[]> = {};
  let total = 0;
  for (const t of tables) {
    const { rows } = await c.query(`select * from public."${t}"`);
    dump[t] = rows;
    total += rows.length;
  }

  // Reference-only snapshot of auth identities (Supabase manages the auth schema).
  let authUsers: unknown[] = [];
  try {
    authUsers = (await c.query(`select id, email, created_at from auth.users order by created_at`)).rows;
  } catch {
    /* ignore if not readable */
  }

  mkdirSync("backups", { recursive: true });
  const stamp = (await c.query(`select to_char(now(), 'YYYYMMDD"T"HH24MISS') s`)).rows[0].s;
  const file = `backups/habiteer-${stamp}.json`;
  writeFileSync(
    file,
    JSON.stringify({ takenAt: new Date().toISOString(), authUsers, tables: dump }, null, 2)
  );
  console.log(`Backed up ${tables.length} public tables (${total} rows) + ${authUsers.length} auth users`);
  console.log(`-> ${file}`);
  await c.end();
})().catch((e) => {
  console.error("Backup failed:", e.message);
  process.exit(1);
});
