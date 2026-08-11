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
  const dispatchStart = text.indexOf("workflow_dispatch:");
  const concurrencyStart = text.indexOf("concurrency:", dispatchStart);
  const dispatchBlock = dispatchStart >= 0
    ? text.slice(dispatchStart, concurrencyStart > dispatchStart ? concurrencyStart : undefined)
    : "";
  const bloggerGuard = /if \[\[ "\$\{RUN_BLOGGER:-true\}" != "false" \]\]; then[\s\S]*?call_returnpick "\/api\/cron\/blogger-digest"[\s\S]*?else[\s\S]*?Blogger digest skipped by workflow_dispatch input\./;
  const telegramGuard = /if \[\[ "\$\{RUN_TELEGRAM:-true\}" != "false" \]\]; then[\s\S]*?call_returnpick "\/api\/cron\/telegram-digest\?limit=1"/;
  const bloggerThenTelegram = /if \[\[ "\$\{RUN_BLOGGER:-true\}" != "false" \]\]; then[\s\S]*?else[\s\S]*?Blogger digest skipped by workflow_dispatch input\.[\s\S]*?\n\s*fi\s*\n\s*if \[\[ "\$\{RUN_TELEGRAM:-true\}" != "false" \]\]/;
  const endpointOrder = [
    'call_returnpick "/api/cron/sourcing"',
    'call_returnpick "/api/cron/affiliate-backfill"',
    'call_returnpick "/api/cron/blogger-digest"',
    'call_returnpick "/api/cron/telegram-digest?limit=1"'
  ].map((fragment) => text.indexOf(fragment));
  const endpointOrderIsValid = endpointOrder.every((index) => index >= 0)
    && endpointOrder.every((index, position) => position === 0 || endpointOrder[position - 1] < index);
  const bloggerInputBinding = "RUN_BLOGGER: ${{ github.event.inputs.run_blogger }}";
  const hasCorrectBloggerBinding = (value) => has(value, bloggerInputBinding)
    && !has(value, "RUN_BLOGGER: ${{ github.event.inputs.run_telegram }}");
  const mutatedBinding = text.replace(bloggerInputBinding, "RUN_BLOGGER: ${{ github.event.inputs.run_telegram }}");

  const checks = [
    ["workflow name", has(text, "name: ReturnPick Hourly Scheduler")],
    ["hourly schedule", has(text, 'cron: "0 * * * *"')],
    ["manual dispatch", has(text, "workflow_dispatch:") && has(text, "run_telegram:") && has(text, "run_blogger:")],
    ["Blogger manual default enabled", /run_blogger:\s+description:[\s\S]*?default:\s*true[\s\S]*?type:\s*boolean/.test(dispatchBlock)],
    ["Blogger input binding", hasCorrectBloggerBinding(text) && !hasCorrectBloggerBinding(mutatedBinding)],
    ["Blogger explicit opt-out", bloggerGuard.test(text)],
    ["single concurrency group", has(text, "concurrency:") && has(text, "returnpick-hourly-scheduler")],
    ["secret name", has(text, "RETURNPICK_CRON_SECRET")],
    ["site variable name", has(text, "RETURNPICK_SITE_URL")],
    ["protected sourcing endpoint", has(text, "/api/cron/sourcing")],
    ["protected affiliate backfill endpoint", has(text, "/api/cron/affiliate-backfill")],
    ["protected Blogger endpoint", has(text, "/api/cron/blogger-digest")],
    ["protected telegram endpoint", has(text, "/api/cron/telegram-digest?limit=1")],
    ["endpoint order", endpointOrderIsValid],
    ["Telegram remains independently guarded", bloggerGuard.test(text) && telegramGuard.test(text) && bloggerThenTelegram.test(text)],
    ["authorization header", has(text, "Authorization: Bearer") && has(text, "CRON_SECRET")],
    ["fail on http errors", has(text, "--fail-with-body") && has(text, "--max-time 75")],
    ["inspect response status", has(text, "jq -r '.result.status // .status // empty'") && has(text, "::warning::") && has(text, "::error::")],
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
