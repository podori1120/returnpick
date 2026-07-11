#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const schemaPath = path.join(process.cwd(), "sql", "schema.sql");

const requiredFragments = [
  { label: "schema version marker", text: "returnpick_schema_meta" },
  { label: "current schema version row", text: "'schema_version'" },
  { label: "strict Coupang Partners URL RPC", text: "is_strict_coupang_partners_url" },
  { label: "product table", text: "create table if not exists sourced_products" },
  { label: "scoring table", text: "create table if not exists deal_scores" },
  { label: "sourcing run log table", text: "create table if not exists sourcing_runs" },
  { label: "Telegram log table", text: "create table if not exists telegram_logs" },
  { label: "affiliate event table", text: "create table if not exists affiliate_events" },
  { label: "product snapshot table", text: "create table if not exists product_snapshots" },
  { label: "published affiliate constraint", text: "sourced_products_public_affiliate_url_check" },
  { label: "public product RLS policy", text: "Public can read published products" },
  { label: "public score RLS policy", text: "Public can read scores for published products" },
  { label: "public snapshot RLS policy", text: "Public can read snapshots for published products" }
];

function readSchema() {
  if (!existsSync(schemaPath)) {
    console.error(`Missing schema file: ${schemaPath}`);
    process.exitCode = 1;
    return "";
  }

  return readFileSync(schemaPath, "utf8");
}

function extractSchemaVersion(sql) {
  const match = sql.match(/values\s*\(\s*'schema_version'\s*,\s*'([^']+)'/i);
  return match?.[1] ?? "";
}

const sql = readSchema();
if (!sql) process.exit();

const missing = requiredFragments.filter((item) => !sql.includes(item.text));
const schemaVersion = extractSchemaVersion(sql);

console.log("ReturnPick Supabase setup runbook");
console.log("=".repeat(40));
console.log(`schema file: ${schemaPath}`);
console.log(`schema version: ${schemaVersion || "(not found)"}`);
console.log(`schema size: ${Buffer.byteLength(sql, "utf8").toLocaleString("en-US")} bytes`);
console.log("");

if (missing.length) {
  console.log("Schema guard failed. Apply is not recommended until these fragments are present:");
  for (const item of missing) console.log(`- ${item.label}: ${item.text}`);
  process.exitCode = 1;
} else {
  console.log("Schema guard passed. The local schema includes the launch-critical tables, RPC, constraint, and RLS policies.");
}

console.log("");
console.log("Supabase SQL apply steps");
console.log("1. Open Supabase Dashboard > SQL Editor > New query.");
console.log("2. Copy the entire local file `C:\\projects\\returnpick\\sql\\schema.sql`.");
console.log("3. Paste the full SQL, run it once, and wait until it finishes without errors.");
console.log("4. Redeploy Vercel Production so server functions use the same env and schema assumptions.");
console.log("5. Run `npm run schema:production` with production Supabase env values available.");
console.log("6. Run `npm run doctor:production:launch` before first live sourcing.");
console.log("");
console.log("Expected live schema checks");
console.log("- returnpick_schema_meta has the schema_version row shown above.");
console.log("- sourcing, scoring, Telegram, affiliate event, and product snapshot tables exist.");
console.log("- is_strict_coupang_partners_url accepts only product-level Coupang Partners short links.");
console.log("- published products are public only when they have a strict product affiliate URL.");
console.log("- service role writes and anon public RLS reads both pass.");
