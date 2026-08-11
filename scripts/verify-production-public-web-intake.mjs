#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runProductionPublicWebIntake } from "./run-production-public-web-intake.mjs";

const secret = "test-admin-secret-never-print";
const siteUrl = "https://returnpick.vercel.app";
const oldRun = {
  id: "old-run",
  status: "completed",
  started_at: "2026-08-09T00:00:00.000Z",
  finished_at: "2026-08-09T00:01:00.000Z",
  log_json: { source_mode: "public_web_only" }
};
const keywords = Array.from({ length: 26 }, (_, index) => ({
  id: `keyword-${index + 1}`,
  category: "monitor",
  keyword: `keyword ${index + 1}`,
  is_active: true,
  min_price: null,
  max_price: null,
  min_discount_rate: null
}));
const runnerSource = readFileSync(new URL("./run-production-public-web-intake.mjs", import.meta.url), "utf8");
assert(!runnerSource.includes('argumentValue(args, "--admin-password")'));

function jsonResponse(status, body) {
  return { status, json: async () => body };
}

function readiness(profile = {}) {
  const requiredConnectionCheckIds = ["supabase", "data_quality", "site_live", "cron", "public_web"];
  return {
    storage: { status: "verified" },
    readiness: { runtimeReady: true, launchReady: true, requiredConnectionCheckIds },
    publicWebProfile: {
      id: "hotdeals_discovery_v2",
      enabled: true,
      exactMatch: true,
      hostCount: 1,
      templateCount: 1,
      ...profile
    },
    checks: requiredConnectionCheckIds.map((id) => ({ id, status: "ok" }))
  };
}

function sourcingBody(id, { offset = 0, next = 8, found = 0, inserted = 0, updated = 0, errors = 0 } = {}) {
  return {
    source_mode: "public_web_only",
    run: {
      id,
      status: "completed",
      keyword_count: 8,
      found_count: found,
      inserted_count: inserted,
      updated_count: updated,
      error_count: errors,
      log_json: {
        active_keyword_count: 26,
        processed_keyword_count: 8,
        keyword_start_offset: offset,
        next_keyword_offset: next,
        stopped_by_time_budget: false,
        logs: []
      }
    },
    diagnosis: { signals: { publicWebDiagnosticStatuses: ["FETCHED_HTML"] } }
  };
}

function createFetch({
  initialRuns = [oldRun],
  readinessBody = readiness(),
  firstBody = sourcingBody("first-run", { offset: 10, next: 18 }),
  secondBody = sourcingBody("second-run", { offset: 18, next: 26 }),
  changedKeywords = null,
  firstStatus = 200,
  firstError = null,
  firstBodyOverride = null
} = {}) {
  const calls = [];
  let sourcingPosts = 0;
  const fetchImpl = async (url, init = {}) => {
    const parsed = new URL(url);
    const method = init.method ?? "GET";
    calls.push({ path: parsed.pathname, method, body: init.body, password: init.headers?.["x-admin-password"] });
    assert.equal(init.headers?.["x-admin-password"], secret);
    assert.equal(init.redirect, "error");

    if (parsed.pathname === "/api/admin/api-readiness" && method === "POST") {
      return jsonResponse(200, readinessBody);
    }
    if (parsed.pathname === "/api/admin/keywords" && method === "GET") {
      const keywordGets = calls.filter((call) => call.path === parsed.pathname && call.method === method).length;
      return jsonResponse(200, { keywords: keywordGets > 1 && changedKeywords ? changedKeywords : keywords });
    }
    if (parsed.pathname === "/api/admin/sourcing/run" && method === "GET") {
      if (sourcingPosts === 0) return jsonResponse(200, { runs: initialRuns });
      return jsonResponse(200, { runs: [{ ...firstBody.run, started_at: "2026-08-10T00:00:00.000Z" }] });
    }
    if (parsed.pathname === "/api/admin/sourcing/run" && method === "POST") {
      sourcingPosts += 1;
      if (sourcingPosts === 1 && firstError) throw firstError;
      if (sourcingPosts === 1) return jsonResponse(firstStatus, firstBodyOverride ?? firstBody);
      return jsonResponse(200, secondBody);
    }
    return jsonResponse(404, { error: "NOT_FOUND" });
  };
  return { calls, fetchImpl };
}

async function run(fetchImpl, now = () => Date.parse("2026-08-11T00:00:00.000Z")) {
  return runProductionPublicWebIntake({ siteUrl, adminPassword: secret, fetchImpl, now, requestTimeoutMs: 1_000 });
}

{
  const harness = createFetch();
  const result = await run(harness.fetchImpl);
  assert.equal(result.exitCode, 0);
  assert.equal(result.report.status, "COMPLETED_REVIEW_ONLY");
  assert.equal(result.report.profile, "hotdeals_discovery_v2");
  assert.equal(result.report.continuation, true);
  assert.equal(result.report.runs.length, 2);
  const sourcingPosts = harness.calls.filter((call) => call.path === "/api/admin/sourcing/run" && call.method === "POST");
  assert.equal(sourcingPosts.length, 2);
  assert.deepEqual(JSON.parse(sourcingPosts[0].body), {
    sourceMode: "public_web_only",
    requiredPublicWebProfile: "hotdeals_discovery_v2",
    useMockFallback: false,
    keywordLimit: 8,
    timeBudgetMs: 52_000
  });
  assert.equal(JSON.parse(sourcingPosts[1].body).keywordLimit, 8);
  assert(!JSON.stringify(result.report).includes(secret));
}

{
  const recentRun = {
    ...oldRun,
    id: "recent-run",
    finished_at: "2026-08-11T00:00:00.000Z"
  };
  const harness = createFetch({ initialRuns: [recentRun] });
  const result = await run(harness.fetchImpl);
  assert.equal(result.report.status, "BLOCKED_NOOP");
  assert.equal(result.report.reason, "RECENT_OR_RUNNING_SOURCING");
  assert.equal(harness.calls.some((call) => call.path === "/api/admin/sourcing/run" && call.method === "POST"), false);
}

{
  const hiddenRunningRun = {
    ...oldRun,
    id: "hidden-running-run",
    status: "running",
    started_at: "2026-08-01T00:00:00.000Z",
    finished_at: null
  };
  const harness = createFetch({ initialRuns: [oldRun, hiddenRunningRun] });
  const result = await run(harness.fetchImpl);
  assert.equal(result.report.status, "BLOCKED_NOOP");
  assert.equal(result.report.reason, "RECENT_OR_RUNNING_SOURCING");
  assert.equal(harness.calls.some((call) => call.path === "/api/admin/sourcing/run" && call.method === "POST"), false);
}

{
  const harness = createFetch({ readinessBody: readiness({ id: "custom", exactMatch: false }) });
  const result = await run(harness.fetchImpl);
  assert.equal(result.report.status, "BLOCKED_NOOP");
  assert.equal(result.report.reason, "READINESS_GUARD_FAILED");
  assert.equal(harness.calls.length, 1);
}

{
  const firstBody = sourcingBody("first-with-candidate", { found: 1, inserted: 1, offset: 10, next: 18 });
  const harness = createFetch({ firstBody });
  const result = await run(harness.fetchImpl);
  assert.equal(result.report.status, "COMPLETED_REVIEW_ONLY");
  assert.equal(result.report.continuation, false);
  assert.equal(result.report.runs[0].inserted_count, 1);
  assert.equal(
    harness.calls.filter((call) => call.path === "/api/admin/sourcing/run" && call.method === "POST").length,
    1
  );
}

for (const [field, value] of [
  ["id", "changed-id"],
  ["category", "laptop"],
  ["keyword", "changed keyword"],
  ["min_price", 100_000],
  ["max_price", 900_000],
  ["min_discount_rate", 0.15]
]) {
  const changedKeywords = keywords.map((keyword, index) => (index === 0 ? { ...keyword, [field]: value } : keyword));
  const harness = createFetch({ changedKeywords });
  const result = await run(harness.fetchImpl);
  assert.equal(result.report.status, "COMPLETED_REVIEW_ONLY");
  assert.equal(result.report.continuation, false);
  assert.equal(
    harness.calls.filter((call) => call.path === "/api/admin/sourcing/run" && call.method === "POST").length,
    1
  );
}

{
  const mismatch = { error: "PUBLIC_WEB_PROFILE_MISMATCH" };
  const harness = createFetch({ firstBody: mismatch, firstStatus: 409 });
  const result = await run(harness.fetchImpl);
  assert.equal(result.report.status, "BLOCKED_NOOP");
  assert.equal(result.report.reason, "PUBLIC_WEB_PROFILE_MISMATCH");
}

{
  const harness = createFetch({
    firstStatus: 409,
    firstBodyOverride: { error: "SOURCING_RUN_CONFLICT" }
  });
  const result = await run(harness.fetchImpl);
  assert.equal(result.exitCode, 3);
  assert.equal(result.report.status, "BLOCKED_NOOP");
  assert.equal(result.report.reason, "SOURCING_RUN_CONFLICT");
}

{
  const writeError = new Error("ambiguous write response");
  writeError.name = "AbortError";
  const harness = createFetch({ firstError: writeError });
  const result = await run(harness.fetchImpl);
  assert.equal(result.report.status, "PARTIAL");
  assert.equal(result.report.reason, "REQUEST_TIMEOUT");
  assert.equal(
    harness.calls.filter((call) => call.path === "/api/admin/sourcing/run" && call.method === "POST").length,
    1
  );
}

{
  let called = false;
  const result = await runProductionPublicWebIntake({
    siteUrl,
    adminPassword: "",
    fetchImpl: async () => {
      called = true;
      return jsonResponse(500, {});
    }
  });
  assert.equal(result.report.status, "BLOCKED_AUTH");
  assert.equal(called, false);
}

{
  let called = false;
  const result = await runProductionPublicWebIntake({
    siteUrl: "https://attacker.example",
    adminPassword: secret,
    fetchImpl: async () => {
      called = true;
      return jsonResponse(200, {});
    }
  });
  assert.equal(result.report.status, "BLOCKED_NOOP");
  assert.equal(result.report.reason, "INVALID_SITE_URL");
  assert.equal(called, false);
}

console.log("Production public-web intake checks passed (16 scenarios).");
