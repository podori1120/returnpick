#!/usr/bin/env node

import { randomBytes } from "node:crypto";

const args = process.argv.slice(2);
const positionalArgs = args.filter((arg) => !arg.startsWith("--"));

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
    if (url.protocol !== "https:") return "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function normalizeCoupangPartnersUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.hostname !== "link.coupang.com") return "";
    if (!/^\/a\/[A-Za-z0-9]{6,16}$/.test(url.pathname)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function secret(prefix, bytes = 24) {
  return `${prefix}-${randomBytes(bytes).toString("base64url")}`;
}

function envLine(name, value = "") {
  return `${name}=${value}`;
}

const siteUrl =
  normalizeBaseUrl(argValue("--site")) ||
  normalizeBaseUrl(positionalArgs.find((arg) => normalizeBaseUrl(arg))) ||
  normalizeBaseUrl(process.env.RETURNPICK_SITE_URL) ||
  normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
  "https://returnpick.vercel.app";
const approvalUrl =
  normalizeCoupangPartnersUrl(argValue("--approval-url")) ||
  normalizeCoupangPartnersUrl(positionalArgs.find((arg) => normalizeCoupangPartnersUrl(arg))) ||
  normalizeCoupangPartnersUrl(process.env.NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL);
const adminPassword = secret("rp-admin");
const cronSecret = secret("rp-cron");

const vercelEnv = [
  ["NEXT_PUBLIC_SUPABASE_URL"],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  ["SUPABASE_SERVICE_ROLE_KEY"],
  ["ADMIN_PASSWORD", adminPassword],
  ["COUPANG_ACCESS_KEY"],
  ["COUPANG_SECRET_KEY"],
  ["COUPANG_PARTNER_ID"],
  ["NAVER_CLIENT_ID"],
  ["NAVER_CLIENT_SECRET"],
  ["TELEGRAM_BOT_TOKEN"],
  ["TELEGRAM_CHAT_ID"],
  ["NEXT_PUBLIC_SITE_URL", siteUrl],
  ["NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL", approvalUrl],
  ["CRON_SECRET", cronSecret],
  ["CRON_USE_MOCK_FALLBACK", "false"],
  ["SOURCING_TIME_BUDGET_MS", "52000"],
  ["SOURCING_KEYWORD_LIMIT"],
  ["PUBLIC_WEB_CRAWL_ENABLED", "false"],
  ["PUBLIC_WEB_ALLOWED_HOSTS"],
  ["PUBLIC_WEB_SEARCH_TEMPLATES"]
];

console.log("# ReturnPick Vercel Production Environment Variables");
console.log("# Paste these keys into Vercel Project Settings > Environment Variables.");
console.log("# Sensitive provider keys are intentionally blank. Fill them from the official dashboards.");
console.log("# Do not commit real values to git.");
for (const [name, value] of vercelEnv) {
  console.log(envLine(name, value));
}

console.log("");
console.log("# GitHub Actions hourly scheduler values");
console.log("# Add these in GitHub > Settings > Secrets and variables > Actions.");
console.log(envLine("RETURNPICK_CRON_SECRET", cronSecret));
console.log(envLine("RETURNPICK_SITE_URL", siteUrl));

console.log("");
console.log("# Post-deploy checks");
console.log("# PowerShell:");
console.log('# $env:RETURNPICK_ADMIN_PASSWORD="<ADMIN_PASSWORD value above>"');
console.log("# npm run check:production:launch");
console.log("# npm run launch:production -- standard");
console.log("# npm run launch:production -- standard confirm");
