#!/usr/bin/env node

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { envValue, loadEnvFiles } from "./load-env-files.mjs";

loadEnvFiles();

const url = envValue("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = envValue("SUPABASE_SERVICE_ROLE_KEY");

if (!url || !serviceRoleKey) {
  console.log("Sourcing coordination live check skipped: Supabase service configuration is unavailable.");
  process.exit(0);
}

const client = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const sourceMode = "public_web_only";
const timestamp = new Date().toISOString();
const activeRows = await client
  .from("sourcing_runs")
  .select("id,status,started_at,log_json")
  .eq("status", "running")
  .limit(50);

if (activeRows.error) {
  console.error("Sourcing coordination live check blocked: active-run preflight failed.");
  process.exitCode = 1;
} else {
  const activeSameMode = (activeRows.data ?? []).some((row) => {
    const mode = row?.log_json && typeof row.log_json === "object" ? row.log_json.source_mode : null;
    const startedAt = typeof row?.started_at === "string" ? Date.parse(row.started_at) : Number.NaN;
    return (
      (mode === sourceMode || mode == null || !["auto", "public_web_only"].includes(mode)) &&
      (!Number.isFinite(startedAt) || Math.abs(Date.now() - startedAt) < 300_000)
    );
  });

  if (activeSameMode) {
    console.log("Sourcing coordination live check skipped: an active same-mode run already exists.");
    process.exit(0);
  }

  const ids = [randomUUID(), randomUUID()];
  const payload = (id, slot) => ({
    p_run_id: id,
    p_status: "running",
    p_source_mode: sourceMode,
    p_started_at: timestamp,
    p_finished_at: null,
    p_keyword_count: 0,
    p_found_count: 0,
    p_inserted_count: 0,
    p_updated_count: 0,
    p_error_count: 0,
    p_error_message: null,
    p_log_json: {
      coordination: "live_concurrency_check",
      execution_slot: slot,
      source_mode: sourceMode
    }
  });

  let results;
  try {
    results = await Promise.all(ids.map((id, index) => client.rpc("create_coordinated_sourcing_run", payload(id, `live-${index}`))));
    for (const result of results) {
      if (result.error) throw new Error("SOURCING_COORDINATION_RPC_FAILED");
      assert.equal(typeof result.data?.created, "boolean", "RPC must return a created boolean");
      assert.ok(result.data?.run && typeof result.data.run === "object", "RPC must return the run record");
    }
    assert.equal(
      results.filter((result) => result.data?.created === true).length,
      1,
      "same-mode concurrent calls must create exactly one active run"
    );
    console.log("Sourcing coordination live check passed: same-mode concurrent RPC calls created one active run.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "SOURCING_COORDINATION_LIVE_CHECK_FAILED");
    process.exitCode = 1;
  } finally {
    const cleanup = await client.from("sourcing_runs").delete().in("id", ids);
    if (cleanup.error) {
      console.error("Sourcing coordination live check cleanup failed.");
      process.exitCode = 1;
    }
  }
}
