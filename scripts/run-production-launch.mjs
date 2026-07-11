#!/usr/bin/env node

import { envValue, loadEnvFiles } from "./load-env-files.mjs";

const args = process.argv.slice(2);
const positionalArgs = args.filter((arg) => !arg.startsWith("--"));
const confirmed = args.includes("--confirm") || positionalArgs.includes("confirm");
loadEnvFiles();

function argValue(name) {
  const index = args.indexOf(name);
  if (index === -1) return "";
  return args[index + 1] ?? "";
}

function normalizeBaseUrl(value) {
  const raw = String(value ?? "").trim().replace(/\/+$/, "");
  if (!raw) return "";

  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function isExternalHttpsSiteUrl(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      hostname !== "localhost" &&
      hostname !== "127.0.0.1" &&
      hostname !== "::1" &&
      !hostname.endsWith(".local")
    );
  } catch {
    return false;
  }
}

const launchPresets = {
  quick: {
    sourcingKeywordLimit: 2,
    affiliateLimit: 3,
    priceLimit: 2,
    sourcingTimeBudgetMs: 12_000
  },
  standard: {
    sourcingKeywordLimit: 6,
    affiliateLimit: 8,
    priceLimit: 5,
    sourcingTimeBudgetMs: 22_000
  },
  wide: {
    sourcingKeywordLimit: 10,
    affiliateLimit: 12,
    priceLimit: 8,
    sourcingTimeBudgetMs: 26_000
  }
};

const requestedSiteUrl = argValue("--site") || envValue(["RETURNPICK_SITE_URL", "NEXT_PUBLIC_SITE_URL"]);
const normalizedRequestedSiteUrl = normalizeBaseUrl(requestedSiteUrl);
const siteUrl = normalizedRequestedSiteUrl || "https://returnpick.vercel.app";
const adminPassword = argValue("--admin-password") || envValue(["RETURNPICK_ADMIN_PASSWORD", "ADMIN_PASSWORD"]);
const presetName = argValue("--preset") || positionalArgs.find((arg) => launchPresets[arg]) || "standard";
const preset = launchPresets[presetName];

function headers() {
  return {
    "content-type": "application/json",
    "x-admin-password": adminPassword
  };
}

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson(path, init = {}) {
  const response = await fetchWithTimeout(`${siteUrl}${path}`, init);
  const text = await response.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw_text: text.slice(0, 500) };
  }

  return { response, json };
}

function summarizeReadiness(readiness) {
  if (!readiness || typeof readiness !== "object") return "readiness payload missing";
  const blocking = Array.isArray(readiness.blockingItemIds) ? readiness.blockingItemIds.join(", ") : "";
  return `mode=${readiness.mode ?? "unknown"}, launchReady=${Boolean(readiness.launchReady)}, blocking=${blocking || "none"}`;
}

function readinessBlockingItems(readiness) {
  if (!readiness || typeof readiness !== "object") return [];

  const items = Array.isArray(readiness.items) ? readiness.items : [];
  const blockingIds = Array.isArray(readiness.blockingItemIds) ? readiness.blockingItemIds : [];
  const itemById = new Map(items.map((item) => [item?.id, item]).filter(([id]) => Boolean(id)));

  return blockingIds.map((id) => {
    const item = itemById.get(id);
    return {
      id,
      label: typeof item?.label === "string" ? item.label : id,
      message: typeof item?.message === "string" ? item.message : "",
      nextAction: typeof item?.nextAction === "string" ? item.nextAction : "",
      missingEnv: Array.isArray(item?.missingEnv) ? item.missingEnv.filter(Boolean) : []
    };
  });
}

function printReadinessBlockers(readiness) {
  const blockers = readinessBlockingItems(readiness);
  const blockingEnv = Array.isArray(readiness?.blockingEnv) ? readiness.blockingEnv.filter(Boolean) : [];

  if (!blockers.length && !blockingEnv.length) return;

  console.log(`Blocking launch items: ${blockers.length || "unknown"}`);
  for (const item of blockers.slice(0, 12)) {
    console.log(`- ${item.label} (${item.id})`);
    if (item.message) console.log(`  status: ${item.message}`);
    if (item.missingEnv.length) console.log(`  env: ${item.missingEnv.join(", ")}`);
    if (item.nextAction) console.log(`  next: ${item.nextAction}`);
  }

  const blockerEnv = new Set(blockers.flatMap((item) => item.missingEnv));
  const extraEnv = blockingEnv.filter((name) => !blockerEnv.has(name));
  if (extraEnv.length) console.log(`Missing env values: ${extraEnv.join(", ")}`);
}

function failedRequiredChecks(readiness, checks) {
  if (!readiness || !Array.isArray(checks)) return [{ id: "payload", label: "connection check payload missing", message: "readiness or checks payload missing" }];

  const requiredIds = Array.isArray(readiness.requiredConnectionCheckIds) ? readiness.requiredConnectionCheckIds : [];
  const byId = new Map(checks.map((check) => [check?.id, check]).filter(([id]) => Boolean(id)));
  const missing = requiredIds
    .filter((id) => !byId.has(id))
    .map((id) => ({ id, label: `MISSING_REQUIRED_CONNECTION_CHECK:${id}`, message: "required live check card missing" }));
  const failed = checks.filter((check) => requiredIds.includes(check?.id) && check?.status !== "ok");
  return [...failed, ...missing];
}

function printFailedChecks(failed) {
  for (const check of failed.slice(0, 12)) {
    console.log(`- ${check.id || check.label}: ${check.message || check.status || "failed"}`);
    const detail = check.detail && typeof check.detail === "object" && !Array.isArray(check.detail) ? check.detail : null;
    const action = detail?.operator_next_action || detail?.next_action;
    if (typeof action === "string" && action.trim()) console.log(`  next: ${action.trim()}`);
  }
}

function detailRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function printRecoveryActions(detail) {
  const actions = Array.isArray(detail?.recovery_actions) ? detail.recovery_actions : [];
  for (const action of actions.slice(0, 6)) {
    if (!action || typeof action !== "object") continue;
    const label = typeof action.label === "string" && action.label.trim() ? action.label.trim() : "recovery action";
    const target = typeof action.target_anchor === "string" && action.target_anchor.trim() ? ` -> #${action.target_anchor.trim()}` : "";
    const nextAction = typeof action.next_action === "string" && action.next_action.trim() ? action.next_action.trim() : "";
    console.log(`  repair: ${label}${target}`);
    if (nextAction) console.log(`    next: ${nextAction}`);
  }
}

function printLaunchSummary(result) {
  console.log(`launch status: ${result?.status ?? "unknown"}`);
  const delta = result?.delta_summary;
  if (delta) {
    console.log(
      `delta: total_added=${delta.total_added ?? 0}, needs_review=${delta.needs_review_delta ?? 0}, affiliate_ready=${delta.affiliate_ready_added ?? 0}, naver_missing_reduced=${delta.naver_missing_reduced ?? 0}`
    );
  }
  if (Array.isArray(result?.steps)) {
    for (const step of result.steps) {
      console.log(`${step.status?.toUpperCase?.() ?? "STEP"} ${step.id || step.label} - ${step.message || ""}`);
      const detail = detailRecord(step.detail);
      const action = detail?.operator_next_action || detail?.next_action;
      if (typeof action === "string" && action.trim()) console.log(`  next: ${action.trim()}`);
      printRecoveryActions(detail);
    }
  }
}

async function main() {
  console.log("ReturnPick production first-launch runner");
  console.log(`site: ${siteUrl}`);
  console.log(`preset: ${presetName}`);
  console.log(`mode: ${confirmed ? "confirmed execution" : "preflight only"}`);
  console.log("=".repeat(46));

  if (!preset) {
    console.error("Unknown --preset. Use quick, standard, or wide.");
    process.exitCode = 1;
    return;
  }

  if (requestedSiteUrl && !normalizedRequestedSiteUrl) {
    console.error("Production launch site URL is invalid. Set NEXT_PUBLIC_SITE_URL or RETURNPICK_SITE_URL to https://your-public-domain.");
    process.exitCode = 1;
    return;
  }

  if (!isExternalHttpsSiteUrl(siteUrl)) {
    console.error("Production launch requires an external HTTPS site URL. Refusing localhost, .local, and http:// targets.");
    console.error("Set NEXT_PUBLIC_SITE_URL or RETURNPICK_SITE_URL to your deployed Vercel URL, then rerun.");
    process.exitCode = 1;
    return;
  }

  if (!adminPassword) {
    console.error("Set RETURNPICK_ADMIN_PASSWORD or ADMIN_PASSWORD before running production launch.");
    process.exitCode = 1;
    return;
  }

  const liveChecks = await readJson("/api/admin/api-readiness", {
    method: "POST",
    headers: headers()
  });

  if (!liveChecks.response.ok) {
    console.error(`Readiness check failed with HTTP ${liveChecks.response.status}`);
    console.error(liveChecks.json?.message || liveChecks.json?.error || liveChecks.json?.raw_text || "unknown error");
    process.exitCode = 1;
    return;
  }

  const readiness = liveChecks.json?.readiness;
  console.log(`readiness: ${summarizeReadiness(readiness)}`);

  if (!readiness?.launchReady) {
    console.log("Production is not launch-ready yet. Fill Vercel env vars, apply Supabase SQL, redeploy, then rerun.");
    printReadinessBlockers(readiness);
    process.exitCode = 1;
    return;
  }

  const failed = failedRequiredChecks(readiness, liveChecks.json?.checks);
  if (failed.length) {
    console.log(`Required live connection checks failed: ${failed.length}`);
    printFailedChecks(failed);
    process.exitCode = 1;
    return;
  }

  console.log("Required live connection checks passed.");

  if (!confirmed) {
    console.log("No data work was started. Rerun with --confirm to execute the first launch.");
    console.log(`Example: npm run launch:production -- ${presetName} confirm`);
    return;
  }

  const launch = await readJson("/api/admin/launch", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(preset)
  });

  if (!launch.response.ok) {
    console.error(`First launch request failed with HTTP ${launch.response.status}`);
    console.error(launch.json?.message || launch.json?.error || launch.json?.raw_text || "unknown error");
    process.exitCode = 1;
    return;
  }

  printLaunchSummary(launch.json);

  if (launch.json?.status !== "completed") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
