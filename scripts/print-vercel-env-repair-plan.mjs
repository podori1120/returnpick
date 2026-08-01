#!/usr/bin/env node

import { blankEnvSources, envValue, loadEnvFiles } from "./load-env-files.mjs";

const loadedFiles = loadEnvFiles();

const requiredGroups = [
  {
    label: "site and approval",
    names: ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL"],
    action: "Set the public Vercel site URL and the manually created Coupang Partners approval link."
  },
  {
    label: "admin and scheduler",
    names: ["ADMIN_PASSWORD", "CRON_SECRET"],
    action: "Use strong random values. Keep CRON_SECRET identical wherever an external scheduler calls the cron APIs."
  },
  {
    label: "Supabase",
    names: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
    action: "Copy the project URL, anon key, and service role key from Supabase. The two keys must be different."
  },
];

const optionalGroups = [
  {
    label: "Naver Shopping API",
    names: ["NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"],
    action: "Add the official Naver Shopping Search API credentials to activate verified price comparison; missing values do not block sourcing or site publishing."
  },
  {
    label: "Telegram",
    names: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
    action: "Add the BotFather token and target chat ID to activate delivery; missing values gate only the Telegram job."
  },
  {
    label: "Coupang Partners API automation",
    names: ["COUPANG_ACCESS_KEY", "COUPANG_SECRET_KEY", "COUPANG_PARTNER_ID"],
    action: "After final approval, add the official Partners API values to activate automatic sourcing and deeplink repair; manual product-level links remain usable without them."
  }
];

const operationalDefaults = [
  {
    name: "CRON_USE_MOCK_FALLBACK",
    defaultValue: "false",
    action: "Keep production automation on real approved sources only."
  },
  {
    name: "SOURCING_TIME_BUDGET_MS",
    defaultValue: "52000",
    action: "Leave serverless sourcing under the practical Vercel function budget."
  },
  {
    name: "PUBLIC_WEB_CRAWL_ENABLED",
    defaultValue: "false",
    action: "Keep public web reference collection off unless you have configured allowlisted robots-safe hosts."
  },
  {
    name: "SOURCING_KEYWORD_LIMIT",
    defaultValue: "",
    action: "Leave blank unless first launch is slow; use a small number like 8 only when throttling is needed."
  },
  {
    name: "SOURCING_ENRICHMENT_CONCURRENCY",
    defaultValue: "2",
    action: "Keep the default at 2; raise to 3 or 4 only after provider responses are stable, never above 4."
  },
  {
    name: "AFFILIATE_BACKFILL_LIMIT",
    defaultValue: "10",
    action: "Limit the number of missing product-level Partners links repaired per hourly run; keep this at or below 20."
  }
];

function valueState(name) {
  if (envValue(name)) return "set";
  return blankEnvSources(name).length ? "blank" : "missing";
}

function namesByState(names, states) {
  const stateSet = new Set(states);
  return names.filter((name) => stateSet.has(valueState(name)));
}

function printNameList(names) {
  for (const name of names) console.log(`  - ${name}`);
}

console.log("ReturnPick Vercel env repair plan");
console.log("=".repeat(42));
console.log(`local env snapshot: ${loadedFiles.length ? loadedFiles.join(", ") : "none"}`);
console.log("secret values: never printed");
console.log("");
console.log("1. Open Vercel > returnpick > Settings > Environment Variables > Production.");
console.log("2. Fill the core launch values below, then redeploy Production.");
console.log("");

let missingRequiredCount = 0;

for (const group of requiredGroups) {
  const blankOrMissing = namesByState(group.names, ["blank", "missing"]);
  const alreadySet = namesByState(group.names, ["set"]);
  missingRequiredCount += blankOrMissing.length;

  console.log(`[${group.label}]`);
  if (blankOrMissing.length) {
    console.log("Required values to fill:");
    printNameList(blankOrMissing);
  } else {
    console.log("Required values to fill: none from this local snapshot.");
  }
  console.log(`Already set locally: ${alreadySet.length}/${group.names.length}`);
  console.log(`Next action: ${group.action}`);
  console.log("");
}

console.log("Optional capabilities (do not block core launch)");
for (const group of optionalGroups) {
  const blankOrMissing = namesByState(group.names, ["blank", "missing"]);
  const alreadySet = namesByState(group.names, ["set"]);

  console.log(`[${group.label}]`);
  if (blankOrMissing.length) {
    console.log("Optional values still blank:");
    printNameList(blankOrMissing);
  } else {
    console.log("Optional values still blank: none from this local snapshot.");
  }
  console.log(`Already set locally: ${alreadySet.length}/${group.names.length}`);
  console.log(`Capability action: ${group.action}`);
  console.log("");
}

const defaultTargets = operationalDefaults.filter((item) => valueState(item.name) !== "set");
const schedulerSiteUrl = envValue(["RETURNPICK_SITE_URL", "NEXT_PUBLIC_SITE_URL"]) || "https://returnpick.vercel.app";

console.log("Safe non-secret operational defaults");
if (!defaultTargets.length) {
  console.log("- none missing from this local snapshot.");
} else {
  for (const item of defaultTargets) {
    const renderedValue = item.defaultValue ? item.defaultValue : "(leave blank unless needed)";
    console.log(`- ${item.name}=${renderedValue}`);
    console.log(`  ${item.action}`);
  }
}

console.log("");
console.log("External hourly scheduler (GitHub Actions)");
console.log("- Repository secret RETURNPICK_CRON_SECRET must equal the Vercel CRON_SECRET value. The value is never printed here.");
console.log(`- Repository variable RETURNPICK_SITE_URL should be ${schedulerSiteUrl}.`);
console.log("- After saving GitHub settings, manually run the `ReturnPick Hourly Scheduler` workflow. Confirm `/api/cron/sourcing` runs; `/api/cron/telegram-digest?limit=1` may safely return TELEGRAM_NOT_READY until its optional values are added.");
console.log("- This keeps hourly operation available even when Vercel Cron is configured with the deployable daily fallback.");

console.log("");
console.log("After saving values in Vercel");
console.log("1. Redeploy Production.");
console.log("2. Run `npm run env:vercel:launch`.");
console.log("3. When that passes, run `npm run doctor:production:launch`.");
console.log("4. When doctor passes, run `npm run launch:production -- standard confirm`.");
console.log("");

if (missingRequiredCount) {
  console.log(`Status: ${missingRequiredCount} required value(s) still need attention before launch.`);
} else {
  console.log("Status: no missing required values in this local snapshot. Run the launch checks next.");
}
