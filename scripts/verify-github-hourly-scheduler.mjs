#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { envValue, loadEnvFiles } from "./load-env-files.mjs";

loadEnvFiles();

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const workflowPath = path.join(repoRoot, ".github", "workflows", "returnpick-hourly.yml");
const results = [];

function add(status, name, detail) {
  results.push({ status, name, detail });
}

function has(text, value) {
  return text.includes(value);
}

function normalizeSiteUrl(value) {
  const raw = String(value ?? "").trim().replace(/\/+$/, "");
  if (!raw) return "";

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function checkWorkflow(text) {
  const checks = [
    ["workflow name", has(text, "name: ReturnPick Hourly Scheduler")],
    ["hourly schedule", has(text, 'cron: "0 * * * *"')],
    ["manual dispatch", has(text, "workflow_dispatch:") && has(text, "run_telegram:")],
    ["single concurrency group", has(text, "concurrency:") && has(text, "returnpick-hourly-scheduler")],
    ["secret name", has(text, "RETURNPICK_CRON_SECRET")],
    ["site variable name", has(text, "RETURNPICK_SITE_URL")],
    ["protected sourcing endpoint", has(text, "/api/cron/sourcing")],
    ["protected affiliate backfill endpoint", has(text, "/api/cron/affiliate-backfill")],
    ["protected telegram endpoint", has(text, "/api/cron/telegram-digest?limit=1")],
    ["authorization header", has(text, "Authorization: Bearer") && has(text, "CRON_SECRET")],
    ["fail on http errors", has(text, "--fail-with-body") && has(text, "--max-time 75")],
    ["https-only target", has(text, "ReturnPick site URL must start with https://")]
  ];

  for (const [name, ok] of checks) {
    add(ok ? "PASS" : "FAIL", name, ok ? "ok" : "missing or invalid workflow fragment");
  }
}

function checkOperatorInputs() {
  const siteUrl = normalizeSiteUrl(envValue(["RETURNPICK_SITE_URL", "NEXT_PUBLIC_SITE_URL"])) || "https://returnpick.vercel.app";
  add("PASS", "recommended RETURNPICK_SITE_URL", siteUrl);
  add("WARN", "GitHub secret visibility", "Set Repository secret RETURNPICK_CRON_SECRET to the same value as Vercel CRON_SECRET; local scripts cannot read GitHub repository secrets.");
}

console.log("ReturnPick GitHub hourly scheduler check");
console.log(`workflow: ${path.relative(repoRoot, workflowPath)}`);
console.log("=".repeat(46));

if (!fs.existsSync(workflowPath)) {
  add("FAIL", "workflow file", ".github/workflows/returnpick-hourly.yml is missing");
} else {
  add("PASS", "workflow file", ".github/workflows/returnpick-hourly.yml");
  checkWorkflow(fs.readFileSync(workflowPath, "utf8"));
}

checkOperatorInputs();

for (const result of results) {
  console.log(`${result.status} ${result.name} - ${result.detail}`);
}

const failures = results.filter((result) => result.status === "FAIL");
const warnings = results.filter((result) => result.status === "WARN");
console.log("=".repeat(46));
console.log(`summary: ${results.length - failures.length - warnings.length} pass, ${warnings.length} warn, ${failures.length} fail`);

if (failures.length) {
  process.exitCode = 1;
}
