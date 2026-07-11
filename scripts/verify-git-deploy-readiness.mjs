#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const requiredTrackedFiles = [
  ".env.example",
  ".github/workflows/returnpick-hourly.yml",
  ".vercelignore",
  "README.md",
  "app/api/admin/api-readiness/route.ts",
  "app/api/admin/launch/route.ts",
  "app/products/approval-sample/page.tsx",
  "components/AdminApiReadinessPanel.tsx",
  "next.config.mjs",
  "package-lock.json",
  "package.json",
  "scripts/check-readiness.mjs",
  "scripts/run-production-deploy.mjs",
  "scripts/run-production-doctor.mjs",
  "scripts/run-production-launch.mjs",
  "sql/schema.sql",
  "vercel.json"
];

function git(args) {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32",
    windowsHide: true
  });

  if (result.error) throw result.error;
  return {
    ok: result.status === 0,
    stdout: String(result.stdout ?? "").trim(),
    stderr: String(result.stderr ?? "").trim()
  };
}

function add(status, name, detail) {
  results.push({ status, name, detail });
}

const results = [];

try {
  const worktree = git(["rev-parse", "--is-inside-work-tree"]);
  if (!worktree.ok || worktree.stdout !== "true") {
    add("FAIL", "Git worktree", "run this command from the ReturnPick Git checkout");
  } else {
    add("PASS", "Git worktree", "ok");

    const tracked = git(["ls-files"]);
    if (!tracked.ok) {
      add("FAIL", "Tracked file inventory", tracked.stderr || "git ls-files failed");
    } else {
      const trackedFiles = new Set(tracked.stdout.split(/\r?\n/).filter(Boolean));
      const missing = requiredTrackedFiles.filter((file) => !trackedFiles.has(file));
      add(
        missing.length ? "FAIL" : "PASS",
        "Required deployment files tracked",
        missing.length ? `not tracked: ${missing.join(", ")}` : `${requiredTrackedFiles.length} required files tracked`
      );
    }

    const status = git(["status", "--porcelain=v1", "--untracked-files=all"]);
    if (!status.ok) {
      add("FAIL", "Clean deployment source", status.stderr || "git status failed");
    } else {
      const dirtyLines = status.stdout.split(/\r?\n/).filter(Boolean);
      add(
        dirtyLines.length ? "FAIL" : "PASS",
        "Clean deployment source",
        dirtyLines.length
          ? `${dirtyLines.length} changed or untracked path(s); commit or intentionally discard them before production deploy`
          : "working tree clean"
      );
    }

    const branch = git(["branch", "--show-current"]);
    add(branch.ok && branch.stdout ? "PASS" : "WARN", "Current branch", branch.stdout || "detached HEAD");

    const upstream = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
    if (!upstream.ok) {
      add("WARN", "Upstream branch", "no upstream configured; push explicitly before relying on Git-based deploys");
    } else {
      const aheadBehind = git(["rev-list", "--left-right", "--count", `${upstream.stdout}...HEAD`]);
      const [behind = "?", ahead = "?"] = aheadBehind.stdout.split(/\s+/);
      add(
        aheadBehind.ok && behind === "0" && ahead === "0" ? "PASS" : "FAIL",
        "Upstream parity",
        aheadBehind.ok ? `${upstream.stdout}: behind ${behind}, ahead ${ahead}` : "could not compare upstream"
      );
    }
  }
} catch (error) {
  add("FAIL", "Git deploy readiness", error instanceof Error ? error.message : String(error));
}

console.log("ReturnPick Git deploy readiness");
console.log("=".repeat(42));
for (const result of results) console.log(`${result.status} ${result.name} - ${result.detail}`);

const failures = results.filter((result) => result.status === "FAIL");
const warnings = results.filter((result) => result.status === "WARN");
console.log("=".repeat(42));
console.log(`summary: ${results.length - failures.length - warnings.length} pass, ${warnings.length} warn, ${failures.length} fail`);

if (failures.length) {
  console.log("Next action: commit the verified ReturnPick source, push the current branch, then rerun `npm run git:check`.");
  process.exitCode = 1;
}
