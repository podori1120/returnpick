#!/usr/bin/env node

import { blankEnvSources, envRawEntries, envSource, envValue, loadEnvFiles } from "./load-env-files.mjs";

const args = process.argv.slice(2);
const launchMode = args.includes("--launch");
const loadedFiles = loadEnvFiles();
const results = [];

function add(status, name, detail) {
  results.push({ status, name, detail });
}

function looksLikePlaceholderValue(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  return (
    raw.includes("your_") ||
    raw.includes("your-") ||
    raw.includes("change_me") ||
    raw.includes("changeme") ||
    raw.includes("placeholder") ||
    raw.includes("todo") ||
    raw === "test" ||
    raw === "secret" ||
    raw === "password" ||
    raw.startsWith("<") ||
    raw.endsWith(">")
  );
}

function validatePublicHttpsUrl(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
    return url.protocol === "https:" && !url.username && !url.password && !localHosts.has(hostname) && !hostname.endsWith(".local");
  } catch {
    return false;
  }
}

function validateCoupangPartnersUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "link.coupang.com" && /^\/a\/[A-Za-z0-9]{6,16}$/.test(url.pathname);
  } catch {
    return false;
  }
}

function validateProviderSecret(value, minLength = 8) {
  return value.length >= minLength && !/\s/.test(value) && !looksLikePlaceholderValue(value);
}

function validateSupabaseKey(value) {
  return value.length >= 40 && !/\s/.test(value) && !looksLikePlaceholderValue(value);
}

function validateAdminPassword(value) {
  return (
    value.length >= 12 &&
    !/\s/.test(value) &&
    !looksLikePlaceholderValue(value) &&
    !["admin", "password", "test"].includes(value.toLowerCase())
  );
}

function validateTelegramBotToken(value) {
  return !looksLikePlaceholderValue(value) && /^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(value);
}

function validateTelegramChatId(value) {
  return !looksLikePlaceholderValue(value) && (/^-?\d{5,}$/.test(value) || /^@[A-Za-z0-9_]{5,}$/.test(value));
}

function validateBooleanString(value) {
  return value === "true" || value === "false";
}

function validatePositiveInteger(value) {
  return /^\d+$/.test(value) && Number(value) > 0;
}

function validateAffiliateBackfillLimit(value) {
  return validatePositiveInteger(value) && Number(value) <= 20;
}

function splitList(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isPublicWebHost(host) {
  const raw = host.trim().toLowerCase();
  if (!raw) return false;
  if (raw.includes("://") || raw.includes("/") || raw.includes("?") || raw.includes("#")) return false;
  if (raw === "*" || raw.includes("*")) return false;
  if (raw === "localhost" || raw === "127.0.0.1" || raw === "0.0.0.0" || raw === "::1" || raw.endsWith(".local")) return false;
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/.test(raw);
}

function isPublicWebTemplate(template, allowedHosts) {
  if (!template.includes("{keyword}")) return false;
  try {
    const url = new URL(template.replace("{keyword}", "returnpick-test"));
    const hostname = url.hostname.toLowerCase();
    if (!["http:", "https:"].includes(url.protocol)) return false;
    if (url.username || url.password) return false;
    return allowedHosts.has(hostname);
  } catch {
    return false;
  }
}

const checks = [
  { name: "NEXT_PUBLIC_SITE_URL", required: true, validate: validatePublicHttpsUrl, hint: "external HTTPS URL" },
  { name: "NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL", required: false, validate: validateCoupangPartnersUrl, hint: "Coupang Partners short URL" },
  { name: "ADMIN_PASSWORD", required: true, validate: validateAdminPassword, hint: "12+ chars, non-placeholder, no whitespace" },
  { name: "CRON_SECRET", required: true, validate: (value) => validateProviderSecret(value, 16), hint: "16+ chars, non-placeholder" },
  { name: "NEXT_PUBLIC_SUPABASE_URL", required: true, validate: validatePublicHttpsUrl, hint: "Supabase project HTTPS URL" },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", required: true, validate: validateSupabaseKey, hint: "complete anon key" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", required: true, validate: validateSupabaseKey, hint: "complete service role key" },
  { name: "COUPANG_ACCESS_KEY", required: true, validate: (value) => validateProviderSecret(value, 8), hint: "official API key" },
  { name: "COUPANG_SECRET_KEY", required: true, validate: (value) => validateProviderSecret(value, 8), hint: "official API secret" },
  { name: "COUPANG_PARTNER_ID", required: true, validate: (value) => validateProviderSecret(value, 2), hint: "partner ID" },
  { name: "NAVER_CLIENT_ID", required: false, validate: (value) => validateProviderSecret(value, 5), hint: "optional Naver client ID for price comparison" },
  { name: "NAVER_CLIENT_SECRET", required: false, validate: (value) => validateProviderSecret(value, 5), hint: "optional Naver client secret for price comparison" },
  { name: "TELEGRAM_BOT_TOKEN", required: false, validate: validateTelegramBotToken, hint: "optional 123456:bot-token for Telegram delivery" },
  { name: "TELEGRAM_CHAT_ID", required: false, validate: validateTelegramChatId, hint: "optional numeric chat ID or @channel for Telegram delivery" },
  { name: "CRON_USE_MOCK_FALLBACK", required: false, validate: validateBooleanString, hint: "true or false" },
  { name: "SOURCING_TIME_BUDGET_MS", required: false, validate: validatePositiveInteger, hint: "positive integer milliseconds" },
  { name: "SOURCING_KEYWORD_LIMIT", required: false, validate: validatePositiveInteger, hint: "positive integer" },
  { name: "AFFILIATE_BACKFILL_LIMIT", required: false, validate: validateAffiliateBackfillLimit, hint: "positive integer up to 20" },
  { name: "PUBLIC_WEB_CRAWL_ENABLED", required: false, validate: validateBooleanString, hint: "true or false" }
];

const envGroups = [
  {
    label: "site and approval",
    names: ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL"]
  },
  {
    label: "admin and scheduler",
    names: ["ADMIN_PASSWORD", "CRON_SECRET", "CRON_USE_MOCK_FALLBACK", "SOURCING_TIME_BUDGET_MS", "SOURCING_KEYWORD_LIMIT", "AFFILIATE_BACKFILL_LIMIT"]
  },
  {
    label: "Supabase",
    names: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]
  },
  {
    label: "Coupang Partners API",
    names: ["COUPANG_ACCESS_KEY", "COUPANG_SECRET_KEY", "COUPANG_PARTNER_ID"]
  },
  {
    label: "Naver Shopping API",
    names: ["NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"]
  },
  {
    label: "Telegram",
    names: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]
  },
  {
    label: "public web optional source",
    names: ["PUBLIC_WEB_CRAWL_ENABLED", "PUBLIC_WEB_ALLOWED_HOSTS", "PUBLIC_WEB_SEARCH_TEMPLATES"]
  }
];

function outerWhitespaceSource(name) {
  return envRawEntries(name).find((entry) => {
    const raw = String(entry.value ?? "");
    return raw.length > 0 && raw !== raw.trim();
  })?.source ?? "";
}

function checkEnvItem(check) {
  const value = envValue(check.name);
  const blankSources = blankEnvSources(check.name);
  const source = envSource(check.name);
  const mustHave = launchMode && check.required;

  if (!value) {
    const detail = blankSources.length ? `blank in ${blankSources.join(", ")}` : "not set";
    if (mustHave) add("FAIL", check.name, `${detail}; expected ${check.hint}`);
    else add("WARN", check.name, `${detail}; expected ${check.hint}`);
    return;
  }

  const whitespaceSource = outerWhitespaceSource(check.name);
  if (whitespaceSource) {
    add("FAIL", check.name, `value has leading or trailing whitespace in ${whitespaceSource}; paste the value again without spaces`);
    return;
  }

  if (!check.validate(value)) {
    add("FAIL", check.name, `invalid format from ${source || "unknown source"}; expected ${check.hint}`);
    return;
  }

  add("PASS", check.name, `set and valid from ${source || "env"}`);
}

for (const check of checks) checkEnvItem(check);

const anon = envValue("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const service = envValue("SUPABASE_SERVICE_ROLE_KEY");
if (anon && service) {
  add(anon === service ? "FAIL" : "PASS", "SUPABASE_KEYS_DIFFER", anon === service ? "anon and service role keys must be different" : "anon and service role keys differ");
}

if (envValue("PUBLIC_WEB_CRAWL_ENABLED") === "true") {
  const hosts = splitList(envValue("PUBLIC_WEB_ALLOWED_HOSTS"));
  const templates = splitList(envValue("PUBLIC_WEB_SEARCH_TEMPLATES"));
  const hostSet = new Set(hosts.map((host) => host.toLowerCase()));
  add(hosts.length > 0 && hosts.length <= 5 && hosts.every(isPublicWebHost) ? "PASS" : "FAIL", "PUBLIC_WEB_ALLOWED_HOSTS", "1-5 public hostnames without protocol/path/wildcards");
  add(
    templates.length > 0 && templates.length <= 5 && templates.every((template) => isPublicWebTemplate(template, hostSet)) ? "PASS" : "FAIL",
    "PUBLIC_WEB_SEARCH_TEMPLATES",
    "1-5 http(s) templates with {keyword} and allowed hosts"
  );
}

console.log("ReturnPick production env check");
console.log(`mode: ${launchMode ? "launch" : "report"}`);
console.log(`env files: ${loadedFiles.length ? loadedFiles.join(", ") : "none"}`);
console.log("=".repeat(44));

for (const item of results) {
  console.log(`${item.status} ${item.name} - ${item.detail}`);
}

const failures = results.filter((item) => item.status === "FAIL");
const warnings = results.filter((item) => item.status === "WARN");
console.log("=".repeat(44));
console.log(`summary: ${results.length - failures.length - warnings.length} pass, ${warnings.length} warn, ${failures.length} fail`);

function printNextActions() {
  const blockingNames = new Set(
    results
      .filter((item) => item.status === "FAIL")
      .map((item) => item.name)
      .filter((name) => name !== "SUPABASE_KEYS_DIFFER")
  );
  const blankRequiredNames = checks
    .filter((check) => launchMode && check.required && blockingNames.has(check.name))
    .map((check) => check.name);

  if (!blankRequiredNames.length && !failures.length) return;

  console.log("");
  console.log("Next action checklist");
  console.log("1. Open Vercel > returnpick > Settings > Environment Variables > Production.");

  for (const group of envGroups) {
    const names = group.names.filter((name) => blockingNames.has(name));
    if (names.length) console.log(`- ${group.label}: ${names.join(", ")}`);
  }

  if (blockingNames.has("SUPABASE_KEYS_DIFFER")) {
    console.log("- Supabase: NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY must be copied from different Supabase key fields.");
  }

  console.log("2. Save the values, redeploy production, then run `npm run env:vercel:launch` again.");
  console.log("3. After it passes, run `npm run doctor:production:launch` before first live sourcing.");
}

printNextActions();

if (launchMode && warnings.length) {
  console.log("launch mode: core required values must be present before first launch; optional Naver and Telegram gaps remain warnings.");
} else {
  console.log("report mode: missing post-approval provider keys are warnings; invalid present values are failures.");
}

if (failures.length) process.exitCode = 1;
