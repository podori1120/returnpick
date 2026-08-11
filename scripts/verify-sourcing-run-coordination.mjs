#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  findCoordinatedActiveRun,
  getCoordinatedSourceMode,
  getSourcingRunExecutionLog,
  getSourcingRunExecutionWindow,
  isCoordinatedActiveRun,
  SOURCING_RUN_COORDINATION_ACTIVE_MAX_AGE_MS,
  SOURCING_RUN_COORDINATION_WINDOW_MS
} from "../lib/sourcingRunCoordination.ts";

const baseMs = Date.parse("2026-08-12T00:00:10.000Z");
const activeStartedAt = new Date(baseMs - 10_000).toISOString();
const sameWindow = getSourcingRunExecutionWindow("public_web_only", baseMs);
const sameWindowLater = getSourcingRunExecutionWindow("public_web_only", baseMs + 6_000);
const continuationSlot = getSourcingRunExecutionWindow("public_web_only", baseMs + 6_000, 8);
const nextWindow = getSourcingRunExecutionWindow("public_web_only", baseMs + SOURCING_RUN_COORDINATION_WINDOW_MS);
const autoWindow = getSourcingRunExecutionWindow("auto", baseMs);

assert.equal(sameWindow.executionKey, sameWindowLater.executionKey, "same mode and window share one deterministic execution key");
assert.notEqual(sameWindow.executionKey, continuationSlot.executionKey, "a new keyword cursor slot can continue within the same window");
assert.notEqual(sameWindow.executionKey, nextWindow.executionKey, "different windows remain independently runnable");
assert.notEqual(sameWindow.executionKey, autoWindow.executionKey, "public-web-only and auto modes remain independently runnable");
assert.ok(SOURCING_RUN_COORDINATION_WINDOW_MS >= 120_000, "coordination window must cover the bounded sourcing budget");
assert.ok(SOURCING_RUN_COORDINATION_ACTIVE_MAX_AGE_MS > SOURCING_RUN_COORDINATION_WINDOW_MS, "active-run lease must outlive one coordination window");
assert.match(sameWindow.executionKey, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
assert.deepEqual(getSourcingRunExecutionLog(sameWindow), {
  coordination: "server_derived_window_v1",
  execution_key: sameWindow.executionKey,
  execution_slot: "default",
  execution_window_start: sameWindow.windowStart,
  execution_window_end: sameWindow.windowEnd,
  source_mode: "public_web_only"
});

function runState(id, sourceMode, startedAt = activeStartedAt, status = "running") {
  return {
    id,
    status,
    started_at: startedAt,
    log_json: sourceMode === undefined ? {} : { source_mode: sourceMode }
  };
}

assert.equal(getCoordinatedSourceMode({ source_mode: "auto" }), "auto");
assert.equal(getCoordinatedSourceMode({ source_mode: "legacy" }), null);
assert.equal(getCoordinatedSourceMode([]), null);
assert.equal(
  isCoordinatedActiveRun(runState("same-mode", "public_web_only"), "public_web_only", baseMs),
  true,
  "an active same-mode run blocks another slot"
);
assert.equal(
  isCoordinatedActiveRun(runState("different-mode", "auto"), "public_web_only", baseMs),
  false,
  "an active different-mode run remains concurrent"
);
assert.equal(
  isCoordinatedActiveRun(
    runState("stale", "public_web_only", new Date(baseMs - SOURCING_RUN_COORDINATION_ACTIVE_MAX_AGE_MS).toISOString()),
    "public_web_only",
    baseMs
  ),
  false,
  "a run at the active age boundary is stale"
);
assert.equal(
  isCoordinatedActiveRun(runState("invalid-time", "public_web_only", "not-a-timestamp"), "public_web_only", baseMs),
  true,
  "an invalid timestamp fails closed"
);
assert.equal(
  isCoordinatedActiveRun(runState("invalid-time-different-mode", "auto", "not-a-timestamp"), "public_web_only", baseMs),
  true,
  "an invalid timestamp fails closed before mode separation"
);
assert.equal(
  isCoordinatedActiveRun(runState("unknown-mode", undefined), "auto", baseMs),
  true,
  "an unknown legacy mode fails closed"
);
assert.equal(
  findCoordinatedActiveRun([runState("different-mode", "auto"), runState("same-mode", "public_web_only")], "public_web_only", baseMs)?.id,
  "same-mode"
);

function createSerializedStateCoordinator(nowMs) {
  const runs = [];
  const locks = new Map();

  async function coordinate({ id, sourceMode, executionSlot }) {
    const previous = locks.get(sourceMode) ?? Promise.resolve();
    let release;
    const current = new Promise((resolve) => {
      release = resolve;
    });
    locks.set(sourceMode, current);
    await previous;

    try {
      const existing = runs.find((candidate) => candidate.id === id);
      if (existing) return { created: false, run: existing };

      const activeConflict = findCoordinatedActiveRun(runs, sourceMode, nowMs);
      if (activeConflict) return { created: false, run: activeConflict };

      // Yield while holding the mode lock to force concurrent callers through
      // the same controlled interleaving path.
      await Promise.resolve();
      const run = runState(id, sourceMode, activeStartedAt);
      run.log_json.execution_slot = executionSlot;
      runs.unshift(run);
      return { created: true, run };
    } finally {
      release();
      if (locks.get(sourceMode) === current) locks.delete(sourceMode);
    }
  }

  return { coordinate, runs };
}

const sameModeCoordinator = createSerializedStateCoordinator(baseMs);
const sameModeResults = await Promise.all([
  sameModeCoordinator.coordinate({ id: "slot-a", sourceMode: "public_web_only", executionSlot: "a" }),
  sameModeCoordinator.coordinate({ id: "slot-b", sourceMode: "public_web_only", executionSlot: "b" })
]);
assert.equal(
  sameModeResults.filter((result) => result.created).length,
  1,
  "controlled same-mode interleaving creates at most one active run"
);
assert.equal(sameModeCoordinator.runs.length, 1);
const idempotentResult = await sameModeCoordinator.coordinate({
  id: sameModeCoordinator.runs[0].id,
  sourceMode: "public_web_only",
  executionSlot: "retry"
});
assert.deepEqual(idempotentResult, { created: false, run: sameModeCoordinator.runs[0] }, "deterministic ids are idempotent");

const differentModeCoordinator = createSerializedStateCoordinator(baseMs);
const differentModeResults = await Promise.all([
  differentModeCoordinator.coordinate({ id: "auto-slot", sourceMode: "auto", executionSlot: "auto" }),
  differentModeCoordinator.coordinate({ id: "web-slot", sourceMode: "public_web_only", executionSlot: "web" })
]);
assert.equal(differentModeResults.filter((result) => result.created).length, 2, "different modes may run concurrently");

const dataStore = readFileSync(new URL("../lib/dataStore.ts", import.meta.url), "utf8");
const schema = readFileSync(new URL("../sql/schema.sql", import.meta.url), "utf8");
const sourcing = readFileSync(new URL("../lib/sourcing.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/admin/sourcing/run/route.ts", import.meta.url), "utf8");
const scheduler = readFileSync(new URL("../lib/scheduler.ts", import.meta.url), "utf8");
const launch = readFileSync(new URL("../app/api/admin/launch/route.ts", import.meta.url), "utf8");
const runner = readFileSync(new URL("./run-production-public-web-intake.mjs", import.meta.url), "utf8");
const liveVerifier = readFileSync(new URL("./verify-sourcing-run-coordination-live.mjs", import.meta.url), "utf8");
const coordinationDataStoreStart = dataStore.indexOf("export async function createCoordinatedSourcingRun");
const coordinationDataStoreEnd = dataStore.indexOf("export async function updateSourcingRun", coordinationDataStoreStart);
const coordinationDataStore = dataStore.slice(coordinationDataStoreStart, coordinationDataStoreEnd);
const coordinationSqlStart = schema.indexOf("create or replace function create_coordinated_sourcing_run");
const coordinationSqlEnd = schema.indexOf("create table if not exists telegram_logs", coordinationSqlStart);
const coordinationSql = schema.slice(coordinationSqlStart, coordinationSqlEnd);

assert.match(dataStore, /createCoordinatedSourcingRun/);
assert.match(dataStore, /memoryRuns\.find\(\(candidate\) => candidate\.id === run\.id\)/);
assert.match(coordinationDataStore, /\.rpc\("create_coordinated_sourcing_run"/);
assert.match(coordinationDataStore, /if \(error\) throw error/);
assert.match(coordinationDataStore, /SOURCING_RUN_COORDINATION_INVALID_RESPONSE/);
assert.doesNotMatch(coordinationDataStore, /\.from\("sourcing_runs"\)/, "Supabase coordination must not preflight or insert directly");
assert.match(schema, /create or replace function create_coordinated_sourcing_run\(/);
assert.match(coordinationSql, /pg_advisory_xact_lock/);
assert.match(coordinationSql, /hashtextextended\([^)]*p_source_mode/);
assert.match(coordinationSql, /security definer/i);
assert.match(coordinationSql, /set search_path = public/);
assert.match(coordinationSql, /p_status is distinct from 'running'/);
assert.match(coordinationSql, /candidate\.started_at is null/);
assert.match(coordinationSql, /clock_timestamp\(\)/);
assert.match(coordinationSql, /jsonb_typeof/);
assert.match(coordinationSql, /candidate\.log_json->>'source_mode' is null/);
assert.match(coordinationSql, /where id = p_run_id/);
assert.match(coordinationSql, /jsonb_build_object\('created', false/);
assert.match(coordinationSql, /jsonb_build_object\('created', true/);
assert.match(
  schema,
  /revoke all on function create_coordinated_sourcing_run\([\s\S]*?\) from public, anon, authenticated;/
);
assert.match(
  schema,
  /grant execute on function create_coordinated_sourcing_run\([\s\S]*?\) to service_role;/
);
assert.match(sourcing, /coordinateExecution\?: boolean/);
assert.match(sourcing, /getSourcingRunExecutionWindow\(sourceMode, Date\.now\(\), requestedKeywordOffset\)/);
assert.match(sourcing, /new SourcingRunConflictError/);
assert.match(sourcing, /\.\.\.executionLog/);
assert.match(route, /coordinateExecution: true/);
assert.match(route, /status: 409/);
assert.match(route, /SOURCING_RUN_CONFLICT/);
assert.match(route, /skipped_reason: "SOURCING_RUN_CONFLICT"/);
assert.match(scheduler, /coordinateExecution: true/);
assert.match(scheduler, /status: "skipped"/);
assert.match(launch, /coordinateExecution: true/);
assert.match(launch, /skipped_reason: "SOURCING_RUN_CONFLICT"/);
assert.match(runner, /CONTINUATION_SOURCING_RUN_CONFLICT/);
assert.match(liveVerifier, /Promise\.all/);
assert.match(liveVerifier, /create_coordinated_sourcing_run/);
assert.match(liveVerifier, /\.delete\(\)\.in\("id", ids\)/);

console.log("Sourcing concurrency check passed: deterministic windows, active/stale/invalid conflict behavior, serialized same-mode state, mode separation, idempotency, advisory-lock SQL grants, and fail-closed RPC wiring.");
