#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const policyPath = new URL("../lib/launchCapabilityPolicy.ts", import.meta.url);
const source = readFileSync(policyPath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022
  },
  fileName: "launchCapabilityPolicy.ts"
}).outputText;
const policy = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`);

const readyCoreItems = [
  "supabase",
  "site",
  "approval_link",
  "admin_password",
  "cron_secret"
].map((id) => ({ id, state: "ready" }));
const optionalMissingItems = [
  ...readyCoreItems,
  { id: "coupang", state: "missing" },
  { id: "naver", state: "missing" },
  { id: "telegram", state: "missing" },
  { id: "public_web", state: "disabled" }
];

assert.deepEqual(
  policy.getLaunchBlockingItemIds(optionalMissingItems, false),
  [],
  "Coupang API, Naver, and Telegram must not block manual-link publishing"
);
assert.deepEqual(
  policy.evaluateLaunchReadiness(optionalMissingItems, false),
  {
    apiKeysReady: false,
    runtimeReady: true,
    launchReady: true,
    blockingItemIds: [],
    optionalMissingItemIds: ["coupang", "naver", "telegram"]
  },
  "manual-link readiness must become launch-ready while automation capabilities remain visible"
);
assert.deepEqual(
  policy.getOptionalMissingItemIds(optionalMissingItems),
  ["coupang", "naver", "telegram"],
  "missing optional capabilities must remain visible"
);
assert.equal(policy.isCapabilityReady(optionalMissingItems, "telegram"), false, "Telegram delivery must stay gated without its credentials");

const withoutSupabase = optionalMissingItems.map((item) => (item.id === "supabase" ? { ...item, state: "missing" } : item));
assert.deepEqual(policy.getLaunchBlockingItemIds(withoutSupabase, false), ["supabase"], "durable storage remains a core launch requirement");
assert.deepEqual(
  policy.getLaunchBlockingItemIds(optionalMissingItems, true),
  ["public_web"],
  "explicitly enabling public-web collection must require its safe configuration"
);
assert.deepEqual(
  policy.getRequiredConnectionCheckIds(false),
  ["coupang", "supabase", "data_quality", "site_live", "cron"],
  "API-ready first-launch checks must include Coupang while excluding optional providers"
);
assert.deepEqual(
  policy.getRequiredConnectionCheckIds(false, false),
  ["supabase", "data_quality", "site_live", "cron"],
  "manual-link first-launch checks must wait for Coupang API without blocking"
);
assert.deepEqual(
  policy.getOptionalConnectionCheckIds(false),
  ["coupang", "naver", "telegram"],
  "manual-link mode must expose Coupang API as a non-blocking optional connection"
);
assert.equal(
  policy.hasBlockingLaunchError([{ status: "error", blocking: false }]),
  false,
  "an optional Naver failure must not prevent first-launch confirmation"
);
assert.equal(
  policy.hasBlockingLaunchError([{ status: "error" }]),
  true,
  "core launch failures must remain fail-closed"
);

const apiReadinessSource = readFileSync(new URL("../lib/apiReadiness.ts", import.meta.url), "utf8");
const schedulerSource = readFileSync(new URL("../lib/scheduler.ts", import.meta.url), "utf8");
const launchRouteSource = readFileSync(new URL("../app/api/admin/launch/route.ts", import.meta.url), "utf8");
const readinessCheckSource = readFileSync(new URL("./check-readiness.mjs", import.meta.url), "utf8");
assert.match(apiReadinessSource, /evaluateLaunchReadiness\(items, publicWebEnabled\)/, "API readiness must use the shared policy");
assert.match(schedulerSource, /TELEGRAM_NOT_READY/, "Telegram scheduling must have a capability-only wait state");
assert.match(schedulerSource, /isCapabilityReady\(gate\.readiness\.items, "telegram"\)/, "Telegram scheduling must use the shared policy");
assert.match(launchRouteSource, /blocking: false/, "Naver backfill errors must remain visible but non-blocking");
assert.match(launchRouteSource, /hasBlockingLaunchError\(steps\)/, "first launch must use the shared blocking-step policy");
assert.match(readinessCheckSource, /const optionalLaunchValueSeverity = "warning";/, "optional provider values must never become core launch blockers");
assert.equal(
  (readinessCheckSource.match(/optionalLaunchValueSeverity/g) ?? []).length,
  8,
  "Coupang, Naver, and Telegram format checks must all use the optional launch severity"
);

console.log("Launch capability policy checks passed: core launch is independent from Naver and Telegram, while optional jobs remain gated.");
