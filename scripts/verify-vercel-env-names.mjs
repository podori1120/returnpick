#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const environment = argValue("--environment") || firstPositionalArg() || "production";
const supportedEnvironments = new Set(["production", "preview", "development"]);

const requiredNames = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL",
  "ADMIN_PASSWORD",
  "CRON_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "COUPANG_ACCESS_KEY",
  "COUPANG_SECRET_KEY",
  "COUPANG_PARTNER_ID"
];

const recommendedNames = [
  "NAVER_CLIENT_ID",
  "NAVER_CLIENT_SECRET",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "CRON_USE_MOCK_FALLBACK",
  "SOURCING_TIME_BUDGET_MS",
  "SOURCING_KEYWORD_LIMIT",
  "PUBLIC_WEB_CRAWL_ENABLED",
  "PUBLIC_WEB_ALLOWED_HOSTS",
  "PUBLIC_WEB_SEARCH_TEMPLATES"
];

function argValue(name) {
  const index = args.indexOf(name);
  if (index === -1) return "";
  return String(args[index + 1] ?? "").trim();
}

function firstPositionalArg() {
  return args.find((arg) => !arg.startsWith("--")) ?? "";
}

function parseEnvNames(output) {
  const knownNames = new Set([...requiredNames, ...recommendedNames]);
  const found = new Set();

  for (const line of output.split(/\r?\n/)) {
    const name = line.trim().split(/\s+/)[0];
    if (knownNames.has(name)) found.add(name);
  }

  return found;
}

function printGroup(label, names) {
  if (!names.length) return;
  console.log(`${label}: ${names.join(", ")}`);
}

if (!supportedEnvironments.has(environment)) {
  console.error(`Unsupported environment "${environment}". Use production, preview, or development.`);
  process.exit(1);
}

const result = spawnSync("npx", ["vercel", "env", "ls", environment], {
  cwd: process.cwd(),
  encoding: "utf8",
  shell: process.platform === "win32",
  windowsHide: true
});

if (result.error) {
  console.error(`Could not run Vercel CLI: ${result.error.message}`);
  process.exit(1);
}

const combinedOutput = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;

if (result.status !== 0) {
  console.error("Vercel env lookup failed. Run `npx vercel login` and `npx vercel link` first.");
  const safeLines = combinedOutput
    .split(/\r?\n/)
    .filter((line) => line.includes("Error") || line.includes("not found") || line.includes("login") || line.includes("link"))
    .slice(0, 6);
  for (const line of safeLines) console.error(line);
  process.exit(result.status ?? 1);
}

const found = parseEnvNames(combinedOutput);
const missingRequired = requiredNames.filter((name) => !found.has(name));
const missingRecommended = recommendedNames.filter((name) => !found.has(name));

console.log("ReturnPick Vercel env name check");
console.log(`environment: ${environment}`);
console.log("values: hidden by Vercel; this check verifies names only");
console.log("=".repeat(46));
console.log(`required: ${requiredNames.length - missingRequired.length}/${requiredNames.length} present`);
console.log(`recommended: ${recommendedNames.length - missingRecommended.length}/${recommendedNames.length} present`);
printGroup("missing required", missingRequired);
printGroup("missing recommended", missingRecommended);
console.log("=".repeat(46));

if (missingRequired.length) {
  console.log("Add the missing required names in Vercel Environment Variables, then redeploy.");
  process.exitCode = 1;
} else {
  console.log("All required Vercel environment variable names are present.");
}
