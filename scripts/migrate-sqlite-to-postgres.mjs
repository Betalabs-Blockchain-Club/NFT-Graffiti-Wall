#!/usr/bin/env node
// Additive, repeatable import. The SQLite source is opened read-only and never modified.
import Database from "better-sqlite3";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const sourcePath = resolve(process.argv[2] ?? "data.db");
const connectionString = process.env.DATABASE_URL;
if (!connectionString?.startsWith("postgres")) throw new Error("Set DATABASE_URL to the Neon PostgreSQL connection string.");
const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
const target = new pg.Pool({ connectionString, ssl: connectionString.includes("sslmode=require") || /neon\.tech/.test(connectionString) ? { rejectUnauthorized: true } : undefined, max: 1 });
const tables = {
  artworks: ["id","token_id","nickname","image_cid","metadata_cid","sha256","tx_hash","block_number","minted_at","status","created_at","archived_at","idempotency_key"],
  votes: ["id","artwork_id","category","voter_key","created_at"],
  likes: ["id","artwork_id","browser_id","created_at"],
  api_rate_limits: ["bucket_key","window_start","request_count"],
  config: ["key","value"],
  archive_batches: ["id","created_at","artwork_count","vote_count"]
};
const canonical = (v) => v == null ? null : (v instanceof Date ? v.toISOString() : v);
let total = 0, inserted = 0;
try {
  await target.query(await readFile(new URL("../backend/src/db/schema.sql", import.meta.url), "utf8"));
  await target.query("BEGIN");
  for (const [table, columns] of Object.entries(tables)) {
    const present = new Set(source.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
    if (!present.size) continue;
    const use = columns.filter((c) => present.has(c));
    if (!use.length) continue;
    const rows = source.prepare(`SELECT ${use.join(",")} FROM ${table}`).all();
    for (const row of rows) {
      const values = use.map((column) => canonical(row[column]));
      const marks = values.map((_, i) => `$${i + 1}`).join(",");
      const names = use.join(",");
      const result = await target.query(`INSERT INTO ${table}(${names}) VALUES(${marks}) ON CONFLICT DO NOTHING`, values);
      inserted += result.rowCount ?? 0;
      total++;
    }
    console.log(`${table}: inspected ${rows.length} source rows (conflicts left untouched)`);
  }
  await target.query("SELECT setval(pg_get_serial_sequence('votes','id'), GREATEST(COALESCE((SELECT MAX(id) FROM votes),1),1), true)");
  await target.query("SELECT setval(pg_get_serial_sequence('likes','id'), GREATEST(COALESCE((SELECT MAX(id) FROM likes),1),1), true)");
  await target.query("COMMIT");
  console.log(`Import finished; ${inserted} inserted, ${total - inserted} existing-key conflicts skipped, ${total} source rows inspected. SQLite source was not modified: ${sourcePath}`);
} catch (error) {
  await target.query("ROLLBACK").catch(() => {});
  throw error;
} finally { source.close(); await target.end(); }
