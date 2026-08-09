#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { envValue, loadEnvFiles } from "./load-env-files.mjs";

loadEnvFiles();

const EXPECTED_SCHEMA_VERSION = "2026-08-09-blogger-keyset-queue";
const requiredTables = [
  "returnpick_schema_meta",
  "sourcing_keywords",
  "sourced_products",
  "deal_scores",
  "sourcing_runs",
  "telegram_logs",
  "distribution_deliveries",
  "affiliate_events",
  "product_snapshots"
];
const requiredSchemaChecks = [
  { table: "sourcing_keywords", columns: "id,keyword,keyword_key,category,is_active" },
  { table: "sourced_products", columns: "id,affiliate_url,naver_lowest_price,condition_grade,sourcing_status,last_observed_at" },
  { table: "deal_scores", columns: "id,product_id,total_score,risk_flags,score_detail" },
  { table: "telegram_logs", columns: "id,product_id,target_type,target_key,status,created_at" },
  { table: "distribution_deliveries", columns: "id,product_id,channel,status,delivery_mode,request_key,provider_post_id,attempt_count,updated_at" },
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

async function distributionDeliverySmokeCheck(client) {
  const productId = randomUUID();
  const firstInsert = await client
    .from("sourced_products")
    .insert({
      id: productId,
      source: "schema_verifier",
      source_product_id: `distribution-ledger-${productId}`,
      category: "laptop",
      title: "ReturnPick distribution ledger smoke",
      sourcing_status: "candidate",
      is_published: false,
      raw_json: { verifier: true, smoke_test: "distribution_ledger" }
    })
    .select("id")
    .single();
  if (firstInsert.error) return result(false, "write:distribution_ledger", `product insert: ${firstInsert.error.message}`);

  const firstDelivery = await client
    .from("distribution_deliveries")
    .insert({
      product_id: productId,
      channel: "schema_verifier",
      status: "pending",
      delivery_mode: "draft",
      request_key: randomUUID(),
      attempt_count: 1
    })
    .select("id,request_key,attempt_count")
    .single();
  const duplicateDelivery = firstDelivery.error
    ? null
    : await client
        .from("distribution_deliveries")
        .insert({
          product_id: productId,
          channel: "schema_verifier",
          status: "pending",
          delivery_mode: "draft",
          request_key: randomUUID(),
          attempt_count: 1
        })
        .select("id")
        .single();
  const duplicateRejected = duplicateDelivery?.error?.code === "23505";
  const failedTransition = firstDelivery.error
    ? null
    : await client
        .from("distribution_deliveries")
        .update({ status: "failed", last_error: "OAUTH_PREWRITE_SMOKE" })
        .eq("id", firstDelivery.data.id)
        .eq("status", "pending")
        .eq("request_key", firstDelivery.data.request_key)
        .select("id,request_key,attempt_count")
        .maybeSingle();
  const retryKey = randomUUID();
  const retryClaim = failedTransition?.data
    ? await client
        .from("distribution_deliveries")
        .update({ status: "pending", request_key: retryKey, attempt_count: 2, last_error: null })
        .eq("id", failedTransition.data.id)
        .eq("status", "failed")
        .eq("request_key", failedTransition.data.request_key)
        .select("id,request_key,attempt_count")
        .maybeSingle()
    : null;
  const staleRequestRejected = retryClaim?.data
    ? await client
        .from("distribution_deliveries")
        .update({ status: "succeeded" })
        .eq("id", retryClaim.data.id)
        .eq("status", "pending")
        .eq("request_key", firstDelivery.data.request_key)
        .select("id")
        .maybeSingle()
    : null;
  const candidateRpc = await client.rpc("list_distribution_candidate_ids", {
    p_channel: "schema_verifier",
    p_limit: 5,
    p_after_score: null,
    p_after_created_at: null,
    p_after_id: null
  });
  const cleanupDelivery = await client.from("distribution_deliveries").delete().eq("product_id", productId);
  const cleanupProduct = await client.from("sourced_products").delete().eq("id", productId);
  const errors = [
    firstDelivery.error ? `first delivery insert: ${firstDelivery.error.message}` : null,
    duplicateRejected ? null : duplicateDelivery?.error?.message ?? "duplicate delivery insert was accepted",
    failedTransition?.error ? `failed transition: ${failedTransition.error.message}` : null,
    failedTransition && !failedTransition.error && !failedTransition.data ? "failed transition CAS returned no row" : null,
    retryClaim?.error ? `failed retry claim: ${retryClaim.error.message}` : null,
    retryClaim && !retryClaim.error && (!retryClaim.data || retryClaim.data.request_key !== retryKey || retryClaim.data.attempt_count !== 2)
      ? "failed retry CAS did not rotate request_key and increment attempt_count"
      : null,
    staleRequestRejected?.error ? `stale request-key probe: ${staleRequestRejected.error.message}` : null,
    staleRequestRejected?.data ? "stale request_key updated a newer attempt" : null,
    candidateRpc.error ? `candidate RPC: ${candidateRpc.error.message}` : null,
    !candidateRpc.error && !Array.isArray(candidateRpc.data) ? "candidate RPC did not return an array" : null,
    cleanupDelivery.error ? `delivery cleanup: ${cleanupDelivery.error.message}` : null,
    cleanupProduct.error ? `product cleanup: ${cleanupProduct.error.message}` : null
  ].filter(Boolean);

  return result(
    !errors.length,
    "write:distribution_ledger",
    errors.length ? errors.join(" | ") : "unique claim, request-key CAS retry, stale-worker rejection, keyset candidate RPC, and cleanup passed"
  );
}

async function publicColumnBoundaryCheck(url, serviceClient, anonKey) {
  if (!anonKey) return result(false, "public:column_boundary", "NEXT_PUBLIC_SUPABASE_ANON_KEY is required for the anon column smoke test");

  const anonClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const productId = randomUUID();
  const scoreId = randomUUID();
  const snapshotId = randomUUID();
  const affiliateUrl = `https://link.coupang.com/a/rp${productId.replace(/-/g, "").slice(0, 10)}`;

  const productInsert = await serviceClient
    .from("sourced_products")
    .insert({
      id: productId,
      source: "schema_verifier",
      source_product_id: `public-column-${productId}`,
      category: "laptop",
      title: "ReturnPick public column boundary smoke",
      affiliate_url: affiliateUrl,
      source_price: 1000000,
      return_price: 800000,
      condition_grade: "최상",
      sourcing_status: "published",
      is_published: true,
      raw_json: { verifier: true },
      admin_memo: "must not be visible to anon",
      rejection_reason: "must not be visible to anon"
    })
    .select("id")
    .single();
  if (productInsert.error) return result(false, "public:column_boundary", `product insert: ${productInsert.error.message}`);

  const scoreInsert = await serviceClient
    .from("deal_scores")
    .insert({
      id: scoreId,
      product_id: productId,
      total_score: 80,
      price_score: 24,
      condition_score: 17,
      spec_score: 16,
      category_risk_score: 8,
      hidden_cost_score: 7,
      as_score: 4,
      timing_score: 4,
      verdict: "추천",
      reasons: ["schema verifier"],
      risk_flags: [],
      score_detail: { verifier: true }
    })
    .select("id")
    .single();
  if (scoreInsert.error) {
    await serviceClient.from("sourced_products").delete().eq("id", productId);
    return result(false, "public:column_boundary", `score insert: ${scoreInsert.error.message}`);
  }

  const snapshotInsert = await serviceClient
    .from("product_snapshots")
    .insert({
      id: snapshotId,
      product_id: productId,
      source_price: 1000000,
      return_price: 800000,
      condition_grade: "최상",
      change_flags: ["SCHEMA_VERIFIER"],
      raw_json: { verifier: true }
    })
    .select("id")
    .single();
  if (snapshotInsert.error) {
    await serviceClient.from("sourced_products").delete().eq("id", productId);
    return result(false, "public:column_boundary", `snapshot insert: ${snapshotInsert.error.message}`);
  }

  const checks = [];
  const publicProduct = await anonClient
    .from("sourced_products")
    .select("id,title,affiliate_url,public_note,last_observed_at")
    .eq("id", productId)
    .maybeSingle();
  checks.push(!publicProduct.error && publicProduct.data?.id === productId ? "public product columns readable" : `public product columns: ${publicProduct.error?.message ?? "not readable"}`);

  const privateProduct = await anonClient
    .from("sourced_products")
    .select("raw_json,admin_memo,rejection_reason")
    .eq("id", productId)
    .maybeSingle();
  checks.push(privateProduct.error ? "internal product columns denied" : "internal product columns unexpectedly readable");

  const publicScore = await anonClient
    .from("deal_scores")
    .select("id,total_score,verdict,score_detail")
    .eq("id", scoreId)
    .maybeSingle();
  checks.push(!publicScore.error && publicScore.data?.id === scoreId ? "public score columns readable" : `public score columns: ${publicScore.error?.message ?? "not readable"}`);

  const publicSnapshot = await anonClient
    .from("product_snapshots")
    .select("id,return_price,condition_grade,change_flags")
    .eq("id", snapshotId)
    .maybeSingle();
  checks.push(!publicSnapshot.error && publicSnapshot.data?.id === snapshotId ? "public snapshot columns readable" : `public snapshot columns: ${publicSnapshot.error?.message ?? "not readable"}`);

  const privateSnapshot = await anonClient
    .from("product_snapshots")
    .select("raw_json")
    .eq("id", snapshotId)
    .maybeSingle();
  checks.push(privateSnapshot.error ? "internal snapshot columns denied" : "internal snapshot columns unexpectedly readable");

  const anonCandidateRpc = await anonClient.rpc("list_distribution_candidate_ids", {
    p_channel: "schema_verifier_anon",
    p_limit: 1,
    p_after_score: null,
    p_after_created_at: null,
    p_after_id: null
  });
  checks.push(anonCandidateRpc.error ? "anon candidate RPC denied" : "anon candidate RPC unexpectedly executable");

  const cleanup = await serviceClient.from("sourced_products").delete().eq("id", productId);
  if (cleanup.error) checks.push(`cleanup: ${cleanup.error.message}`);

  const failed = checks.filter((check) => check.includes("unexpectedly") || check.includes(": ") || check.startsWith("public product columns") || check.startsWith("public score columns") || check.startsWith("public snapshot columns") || check.startsWith("cleanup"));
  return result(!failed.length, "public:column_boundary", checks.join("; "));
}

async function authenticatedCandidateRpcBoundaryCheck(url, serviceClient, anonKey) {
  const userIdSuffix = randomUUID();
  const email = `returnpick-schema-${userIdSuffix}@example.invalid`;
  const password = `Rp!${randomUUID()}-${randomUUID()}`;
  const created = await serviceClient.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) {
    return result(false, "authenticated:candidate_rpc_denied", `temporary auth user: ${created.error?.message ?? "not created"}`);
  }

  let detail = "authenticated candidate RPC was unexpectedly executable";
  let ok = false;
  try {
    const authenticatedClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const signedIn = await authenticatedClient.auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.session) {
      detail = `temporary auth sign-in: ${signedIn.error?.message ?? "no session"}`;
    } else {
      const candidateRpc = await authenticatedClient.rpc("list_distribution_candidate_ids", {
        p_channel: "schema_verifier_authenticated",
        p_limit: 1,
        p_after_score: null,
        p_after_created_at: null,
        p_after_id: null
      });
      ok = Boolean(candidateRpc.error);
      detail = ok ? "authenticated candidate RPC denied" : detail;
    }
  } finally {
    const deleted = await serviceClient.auth.admin.deleteUser(created.data.user.id);
    if (deleted.error) {
      ok = false;
      detail = `${detail}; temporary auth cleanup: ${deleted.error.message}`;
    }
  }

  return result(ok, "authenticated:candidate_rpc_denied", detail);
}

async function main() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");

  console.log("ReturnPick Supabase production schema check");
  console.log(`url: ${url || "(missing)"}`);
  console.log(`anon key: ${mask(anonKey) || "(missing)"}`);
  console.log(`service key: ${mask(serviceRoleKey) || "(missing)"}`);
  console.log("=".repeat(44));

  if (!url || !anonKey || !serviceRoleKey) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY before running this check.");
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
  checks.push(await distributionDeliverySmokeCheck(client));
  checks.push(await writeSmokeCheck(client));
  checks.push(await publicColumnBoundaryCheck(url, client, anonKey));
  checks.push(await authenticatedCandidateRpcBoundaryCheck(url, client, anonKey));

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
