#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { envValue, loadEnvFiles } from "./load-env-files.mjs";

loadEnvFiles();

const EXPECTED_SCHEMA_VERSION = "2026-08-01-affiliate-surface-attribution";
const requiredTables = [
  "returnpick_schema_meta",
  "sourcing_keywords",
  "sourced_products",
  "deal_scores",
  "sourcing_runs",
  "telegram_logs",
  "affiliate_events",
  "product_snapshots"
];
const requiredSchemaChecks = [
  { table: "sourcing_keywords", columns: "id,keyword,keyword_key,category,is_active" },
  { table: "sourced_products", columns: "id,affiliate_url,naver_lowest_price,condition_grade,sourcing_status,last_observed_at" },
  { table: "deal_scores", columns: "id,product_id,total_score,risk_flags,score_detail" },
  { table: "telegram_logs", columns: "id,product_id,target_type,target_key,status,created_at" },
  { table: "affiliate_events", columns: "id,event_type,channel,context,utm_source,anon_session_id" },
  { table: "product_snapshots", columns: "id,product_id,change_flags,observed_at" }
];

function env(name) {
  return envValue(name);
}

function mask(value) {
  if (!value) return "";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function result(ok, name, detail) {
  return { ok, name, detail };
}

async function tableCheck(client, table) {
  const { error } = await client.from(table).select("id", { count: "exact", head: true });
  return result(!error, `table:${table}`, error?.message ?? "select head ok");
}

async function columnCheck(client, check) {
  const { error } = await client.from(check.table).select(check.columns, { count: "exact", head: true }).limit(1);
  return result(!error, `columns:${check.table}`, error?.message ?? check.columns);
}

async function schemaVersionCheck(client) {
  const { data, error } = await client
    .from("returnpick_schema_meta")
    .select("key,value,updated_at")
    .eq("key", "schema_version")
    .maybeSingle();

  if (error) return result(false, "schema_version", error.message);
  if (!data) return result(false, "schema_version", "missing returnpick_schema_meta.schema_version row");
  if (data.value !== EXPECTED_SCHEMA_VERSION) {
    return result(false, "schema_version", `expected ${EXPECTED_SCHEMA_VERSION}, got ${data.value || "empty"}`);
  }
  return result(true, "schema_version", `${data.value} at ${data.updated_at ?? "unknown time"}`);
}

async function strictAffiliateFunctionCheck(client) {
  const probes = [
    { url: "https://link.coupang.com/a/AbCd1234", expected: true },
    { url: "https://www.coupang.com/vp/products/123", expected: false },
    { url: "https://link.coupang.com/a/readiness", expected: false }
  ];

  for (const probe of probes) {
    const { data, error } = await client.rpc("is_strict_coupang_partners_url", { value: probe.url });
    if (error) return result(false, "rpc:is_strict_coupang_partners_url", error.message);
    if (data !== probe.expected) {
      return result(false, "rpc:is_strict_coupang_partners_url", `${probe.url} expected ${probe.expected}, got ${data}`);
    }
  }

  return result(true, "rpc:is_strict_coupang_partners_url", "valid short link accepted; regular/sample-like links rejected");
}

async function writeSmokeCheck(client) {
  const runInsert = await client
    .from("sourcing_runs")
    .insert({
      status: "schema_live_check",
      keyword_count: 0,
      found_count: 0,
      inserted_count: 0,
      updated_count: 0,
      error_count: 0,
      log_json: { source: "scripts/verify-supabase-schema.mjs" }
    })
    .select("id")
    .single();
  if (runInsert.error) return result(false, "write:sourcing_runs", runInsert.error.message);

  const eventInsert = await client
    .from("affiliate_events")
    .insert({
      event_type: "detail_view",
      channel: "schema_live_check",
      context: "schema_live_check",
      anon_session_id: "00000000-0000-4000-8000-000000000000",
      referrer: "https://returnpick.vercel.app/schema-live-check",
      utm_source: "schema_live_check"
    })
    .select("id")
    .single();
  if (eventInsert.error) {
    await client.from("sourcing_runs").delete().eq("id", runInsert.data.id);
    return result(false, "write:affiliate_events", eventInsert.error.message);
  }

  const runDelete = await client.from("sourcing_runs").delete().eq("id", runInsert.data.id);
  const eventDelete = await client.from("affiliate_events").delete().eq("id", eventInsert.data.id);
  const cleanupErrors = [runDelete.error?.message, eventDelete.error?.message].filter(Boolean);
  if (cleanupErrors.length) return result(false, "write:cleanup", cleanupErrors.join(" | "));

  return result(true, "write:smoke", "sourcing_runs and affiliate_events insert/delete ok");
}

async function main() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");

  console.log("ReturnPick Supabase production schema check");
  console.log(`url: ${url || "(missing)"}`);
  console.log(`service key: ${mask(serviceRoleKey) || "(missing)"}`);
  console.log("=".repeat(44));

  if (!url || !serviceRoleKey) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this check.");
    process.exitCode = 1;
    return;
  }

  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const checks = [];

  for (const table of requiredTables) checks.push(await tableCheck(client, table));
  for (const check of requiredSchemaChecks) checks.push(await columnCheck(client, check));
  checks.push(await schemaVersionCheck(client));
  checks.push(await strictAffiliateFunctionCheck(client));
  checks.push(await writeSmokeCheck(client));

  for (const check of checks) {
    console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name} - ${check.detail}`);
  }

  const failed = checks.filter((check) => !check.ok);
  console.log("=".repeat(44));
  console.log(`summary: ${checks.length - failed.length} pass, ${failed.length} fail`);

  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
