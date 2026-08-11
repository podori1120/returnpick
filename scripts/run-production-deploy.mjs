#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const positionalArgs = args.filter((arg) => !arg.startsWith("--"));
const confirmed = args.includes("--confirm") || positionalArgs.includes("confirm");
const executeFirstLaunch = args.includes("--first-launch") || positionalArgs.includes("first-launch") || positionalArgs.includes("go-live");
const preset = argValue("--preset") || positionalArgs.find((arg) => ["quick", "standard", "wide"].includes(arg)) || "standard";
const npxCommand = "npx";
const outcomes = [];

function argValue(name) {
  const index = args.indexOf(name);
  if (index === -1) return "";
  return args[index + 1] ?? "";
}

function say(message = "") {
  process.stderr.write(`${message}\n`);
}

function runStep(name, command, stepArgs) {
  say("");
  say(`== ${name} ==`);
  const result = spawnSync(command, stepArgs, {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    shell: process.platform === "win32" && command !== process.execPath,
    windowsHide: true
  });

  if (result.stdout) process.stderr.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.error) {
    outcomes.push({ status: "FAIL", name, detail: result.error.message });
    return false;
  }

  if (result.status === 0) {
    outcomes.push({ status: "PASS", name, detail: "ok" });
    return true;
  }

  outcomes.push({ status: "FAIL", name, detail: `exit code ${result.status ?? "unknown"}` });
  return false;
}

function nextActionForOutcome(outcome) {
  if (!outcome || outcome.status !== "FAIL") return "";
  if (outcome.name === "Pull Vercel production env") {
    return "Run `npx vercel login`, confirm the project is linked, then rerun this command.";
  }
  if (outcome.name === "Check Git deployment state") {
    return "Commit the verified source and push the current branch, then rerun `npm run git:check` before deploying.";
  }
  if (outcome.name === "Check Vercel env names") {
    return "Open Vercel Production Environment Variables, add the missing names, then rerun `npm run deploy:production:launch`.";
  }
  if (outcome.name === "Check launch env values") {
    return "Fill the blank/invalid Production values shown above, redeploy with `npm run deploy:production:launch -- confirm`, then run go-live when ready.";
  }
  if (outcome.name === "Vercel production deploy") {
    return "Fix the Vercel deploy error above, then rerun `npm run deploy:production:launch -- confirm`.";
  }
  if (outcome.name === "Post-deploy launch doctor") {
    return "Fix the launch doctor blocker above, then rerun `npm run doctor:production:launch:fresh`.";
  }
  if (outcome.name === "Production first launch") {
    return "Fix the first-launch blocker above, then rerun `npm run launch:production -- standard confirm` or use the admin first-launch panel.";
  }
  return "Fix the failed step above, then rerun the command.";
}

function printSummary() {
  say("");
  say("ReturnPick production deploy summary");
  say("=".repeat(46));
  for (const outcome of outcomes) {
    say(`${outcome.status} ${outcome.name} - ${outcome.detail}`);
    const nextAction = nextActionForOutcome(outcome);
    if (nextAction) say(`  next: ${nextAction}`);
  }
  const failed = outcomes.filter((outcome) => outcome.status === "FAIL");
  say("=".repeat(46));
  say(`summary: ${outcomes.length - failed.length} pass, ${failed.length} fail`);
  if (failed.length) process.exitCode = 1;
}

say("ReturnPick guarded production deploy");
say(`mode: ${confirmed ? "confirmed deploy" : "preflight only"}`);
say(`first launch: ${executeFirstLaunch ? `requested (${preset})` : "not requested"}`);
say("No data work is started by this command.");

const steps = [
  ["Check Git deployment state", process.execPath, ["scripts/verify-git-deploy-readiness.mjs"]],
  ["Pull Vercel production env", npxCommand, ["vercel", "env", "pull", ".env.production", "--environment=production", "--yes"]],
  ["Check Vercel env names", process.execPath, ["scripts/verify-vercel-env-names.mjs", "production"]],
  // `vercel env pull` masks sensitive values locally. The preceding env-name
  // check plus the mandatory post-deploy live doctor are the safe evidence
  // path; real blank/invalid values still fail in the checker.
  ["Check launch env values", process.execPath, ["scripts/verify-production-env.mjs", "--launch", "--allow-vercel-masked"]]
];

let stopped = false;

for (const [name, command, stepArgs] of steps) {
  if (!runStep(name, command, stepArgs)) {
    say("");
    say("Stop: fix the failed step before deploying production.");
    stopped = true;
    break;
  }
}

if (stopped) {
  printSummary();
} else if (!confirmed) {
  say("");
  say("Preflight passed. No deploy was started.");
  say("To deploy after reviewing the checks, run:");
  say("npm run deploy:production:launch -- confirm");
  say("To deploy and immediately run the guarded first launch, run:");
  say("npm run deploy:production:go-live -- confirm");
  printSummary();
} else if (!runStep("Vercel production deploy", npxCommand, ["vercel", "deploy", "--prod"])) {
  say("");
  say("Stop: deploy failed. Production doctor was not run.");
  printSummary();
} else {
  const doctorOk = runStep("Post-deploy launch doctor", process.execPath, ["scripts/run-production-doctor.mjs", "--launch", "--allow-vercel-masked", "--preset", preset]);
  if (doctorOk && executeFirstLaunch) {
    runStep("Production first launch", process.execPath, ["scripts/run-production-launch.mjs", "--preset", preset, "--confirm"]);
  }
  printSummary();
}
