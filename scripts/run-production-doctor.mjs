#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { envValue, loadEnvFiles } from "./load-env-files.mjs";

const args = process.argv.slice(2);
const requireLaunchReady = args.includes("--launch");
const strictScheduler = args.includes("--strict-scheduler");
const skipSchema = args.includes("--skip-schema");
loadEnvFiles();

function argValue(name) {
  const index = args.indexOf(name);
  if (index === -1) return "";
  return args[index + 1] ?? "";
}

function env(name) {
  return envValue(name);
}

function isExternalHttpsSiteUrl(value) {
  try {
    const url = new URL(String(value ?? "").trim());
    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      hostname !== "localhost" &&
      hostname !== "127.0.0.1" &&
      hostname !== "0.0.0.0" &&
      hostname !== "::1" &&
      !hostname.endsWith(".local")
    );
  } catch {
    return false;
  }
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteUrl = argValue("--site") || env("RETURNPICK_SITE_URL") || env("NEXT_PUBLIC_SITE_URL") || "https://returnpick.vercel.app";
const adminPassword = argValue("--admin-password") || env("RETURNPICK_ADMIN_PASSWORD") || env("ADMIN_PASSWORD");
const preset = argValue("--preset") || "standard";
const outcomes = [];

function scriptPath(fileName) {
  return path.join(scriptDir, fileName);
}

function addOutcome(status, name, detail) {
  outcomes.push({ status, name, detail });
}

function sharedAdminArgs() {
  const shared = ["--site", siteUrl];
  if (argValue("--admin-password")) shared.push("--admin-password", argValue("--admin-password"));
  return shared;
}

function runNodeStep(name, fileName, stepArgs, required = true) {
  console.log("");
  console.log(`== ${name} ==`);
  const result = spawnSync(process.execPath, [scriptPath(fileName), ...stepArgs], {
    cwd: path.dirname(scriptDir),
    env: process.env,
    stdio: "inherit",
    windowsHide: true
  });

  if (result.error) {
    addOutcome(required ? "FAIL" : "WARN", name, result.error.message);
    return false;
  }

  if (result.status === 0) {
    addOutcome("PASS", name, "ok");
    return true;
  }

  addOutcome(required ? "FAIL" : "WARN", name, `exit code ${result.status ?? "unknown"}`);
  return false;
}

function handleSchemaStep() {
  if (skipSchema) {
    addOutcome("SKIP", "Supabase schema", "--skip-schema");
    console.log("");
    console.log("== Supabase schema ==");
    console.log("SKIP --skip-schema was provided.");
    return;
  }

  const hasSchemaEnv = Boolean(env("NEXT_PUBLIC_SUPABASE_URL") && env("SUPABASE_SERVICE_ROLE_KEY"));
  if (!hasSchemaEnv) {
    const status = requireLaunchReady ? "FAIL" : "WARN";
    addOutcome(status, "Supabase schema", "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for live schema verification");
    console.log("");
    console.log("== Supabase schema ==");
    console.log(`${status} Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to verify the live DB schema.`);
    return;
  }

  runNodeStep("Supabase schema", "verify-supabase-schema.mjs", [], true);
}

function handleEnvStep() {
  const envArgs = requireLaunchReady ? ["--launch"] : [];
  return runNodeStep("Production env", "verify-production-env.mjs", envArgs, true);
}

function skipAfterEnvFailure() {
  const detail = "Production env preflight failed; fix env values before live checks";
  addOutcome("SKIP", "Scoring contract", detail);
  addOutcome("SKIP", "GitHub hourly scheduler", detail);
  addOutcome("SKIP", "Public web config", detail);
  addOutcome("SKIP", "Supabase schema", detail);
  addOutcome("SKIP", "Production readiness", detail);
  addOutcome("SKIP", "First-launch preflight", detail);
  addOutcome("SKIP", "Sourcing recovery diagnosis", detail);
}

function skipAfterTargetFailure() {
  const detail = "Production target URL must be an external HTTPS URL before live checks";
  addOutcome("SKIP", "Scoring contract", detail);
  addOutcome("SKIP", "GitHub hourly scheduler", detail);
  addOutcome("SKIP", "Public web config", detail);
  addOutcome("SKIP", "Supabase schema", detail);
  addOutcome("SKIP", "Production readiness", detail);
  addOutcome("SKIP", "First-launch preflight", detail);
  addOutcome("SKIP", "Sourcing recovery diagnosis", detail);
}

function handlePublicWebConfigStep() {
  runNodeStep("Public web config", "verify-public-web-config.mjs", [], true);
}

function handleScoringStep() {
  runNodeStep("Scoring contract", "verify-scoring-rules.mjs", [], true);
}

function handleGithubSchedulerStep() {
  runNodeStep("GitHub hourly scheduler", "verify-github-hourly-scheduler.mjs", [], true);
}

function handleProductionReadinessStep() {
  const readinessArgs = [...sharedAdminArgs()];
  if (requireLaunchReady) readinessArgs.push("--launch");
  if (strictScheduler) readinessArgs.push("--strict-scheduler");
  runNodeStep("Production readiness", "verify-production-readiness.mjs", readinessArgs, true);
}

function handleLaunchPreflightStep() {
  if (!requireLaunchReady) {
    addOutcome("SKIP", "First-launch preflight", "run with --launch to include first-launch preflight");
    return;
  }

  runNodeStep("First-launch preflight", "run-production-launch.mjs", [...sharedAdminArgs(), "--preset", preset], true);
}

function handleSourcingDiagnosisStep() {
  runNodeStep("Sourcing recovery diagnosis", "diagnose-sourcing-recovery.mjs", [], false);
}

function printSummary() {
  console.log("");
  console.log("ReturnPick production doctor summary");
  console.log(`site: ${siteUrl}`);
  console.log(`mode: ${requireLaunchReady ? "launch readiness" : "report"}`);
  console.log(`admin password: ${adminPassword ? "provided" : "missing"}`);
  console.log("=".repeat(46));

  for (const outcome of outcomes) {
    console.log(`${outcome.status} ${outcome.name} - ${outcome.detail}`);
  }

  const failures = outcomes.filter((outcome) => outcome.status === "FAIL");
  const warnings = outcomes.filter((outcome) => outcome.status === "WARN");
  console.log("=".repeat(46));
  console.log(`summary: ${outcomes.length - failures.length - warnings.length} pass/skip, ${warnings.length} warn, ${failures.length} fail`);

  console.log("");
  console.log("Next command checklist");
  if (requireLaunchReady) {
    if (failures.length) {
      console.log("1. If Vercel env values were just edited, run `npm run doctor:production:launch:fresh` to pull the latest Production values.");
      console.log("2. To see only missing or blank env names, run `npm run env:repair`.");
      console.log("3. After the launch doctor passes, run `npm run deploy:production:launch -- confirm`.");
    } else {
      console.log("1. No data work was started by this doctor run.");
      console.log("2. To deploy the verified build, run `npm run deploy:production:launch -- confirm`.");
      console.log("3. To execute the first live collection after deploy, run `npm run launch:production -- standard confirm`.");
      console.log("4. To deploy and run first launch in one guarded flow, run `npm run deploy:production:go-live -- confirm`.");
    }
  } else {
    console.log("1. Report mode does not require all post-approval envs and does not start data work.");
    console.log("2. After the core launch envs and Supabase schema are ready, run `npm run doctor:production:launch:fresh`; Coupang API keys can be added later for automation.");
    console.log("3. If launch doctor passes, run `npm run deploy:production:launch -- confirm`.");
    console.log("4. To deploy and immediately run the first live collection, run `npm run deploy:production:go-live -- confirm`.");
    console.log("5. To see grouped missing env names only, run `npm run env:repair`.");
  }

  if (failures.length) process.exitCode = 1;
}

console.log("ReturnPick production doctor");
console.log("Runs env, scoring contract, GitHub hourly scheduler, public-web, schema, readiness, launch-preflight, and sourcing-diagnosis checks without starting data work.");
console.log(`target: ${siteUrl}`);

const envOk = handleEnvStep();
const targetOk = isExternalHttpsSiteUrl(siteUrl);
if (!targetOk) {
  console.log("");
  console.log("== Production target URL ==");
  console.log("FAIL Production doctor requires an external HTTPS target. Refusing localhost, .local, and http:// targets.");
  console.log("Set NEXT_PUBLIC_SITE_URL, RETURNPICK_SITE_URL, or --site to your deployed Vercel URL, then rerun.");
  addOutcome("FAIL", "Production target URL", "external HTTPS URL required before live checks");
  skipAfterTargetFailure();
} else if (requireLaunchReady && !envOk) {
  skipAfterEnvFailure();
} else {
  handleScoringStep();
  handleGithubSchedulerStep();
  handlePublicWebConfigStep();
  handleSchemaStep();
  handleProductionReadinessStep();
  handleLaunchPreflightStep();
  handleSourcingDiagnosisStep();
}
printSummary();
