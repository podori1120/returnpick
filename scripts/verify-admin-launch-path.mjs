#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/adminLaunchPath.ts", import.meta.url), "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  fileName: "adminLaunchPath.ts"
}).outputText;
const { getAdminLaunchPath, isAdminStorageStatus } = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString("base64")}`);

assert.deepEqual(
  getAdminLaunchPath({ readinessKnown: false, launchReady: false, catalogLaunchReady: false, storageStatus: null }),
  { mode: "unknown", anchor: "admin-api-readiness", label: "설정 보강" },
  "unknown readiness must stay on the readiness panel"
);
assert.deepEqual(
  getAdminLaunchPath({ readinessKnown: true, launchReady: false, catalogLaunchReady: false, storageStatus: "unconfigured" }),
  { mode: "temporary", anchor: "admin-bootstrap-catalog", label: "임시 카탈로그 입력" },
  "unconfigured Supabase must expose the bounded temporary catalog path"
);
assert.deepEqual(
  getAdminLaunchPath({ readinessKnown: true, launchReady: false, catalogLaunchReady: false, storageStatus: "unverified" }),
  { mode: "recovery", anchor: "admin-api-readiness", label: "저장소 확인" },
  "unverified Supabase must return to live storage verification"
);
assert.deepEqual(
  getAdminLaunchPath({ readinessKnown: true, launchReady: false, catalogLaunchReady: false, storageStatus: "verified" }),
  { mode: "persistent", anchor: "admin-api-readiness", label: "설정 보강" },
  "verified storage without launch readiness must stay on setup"
);
assert.deepEqual(
  getAdminLaunchPath({ readinessKnown: true, launchReady: true, catalogLaunchReady: true, storageStatus: "verified" }),
  { mode: "persistent", anchor: "admin-first-launch", label: "첫 가동" },
  "verified launch readiness must go to first launch"
);
assert.deepEqual(
  getAdminLaunchPath({ readinessKnown: true, launchReady: false, catalogLaunchReady: true, storageStatus: "unconfigured" }),
  { mode: "temporary", anchor: "admin-bootstrap-catalog", label: "카탈로그 공개" },
  "validated bootstrap catalog must go to limited public launch"
);
assert.deepEqual(
  getAdminLaunchPath({ readinessKnown: true, launchReady: false, catalogLaunchReady: true, storageStatus: "verified" }),
  { mode: "persistent", anchor: "admin-api-readiness", label: "설정 보강" },
  "verified storage must keep the persistent workflow even when limited catalog launch is possible"
);
assert.equal(isAdminStorageStatus("future_status"), false, "future storage statuses must fail closed");
assert.deepEqual(
  getAdminLaunchPath({ readinessKnown: true, launchReady: true, catalogLaunchReady: true, storageStatus: "future_status" }),
  { mode: "unknown", anchor: "admin-api-readiness", label: "설정 보강" },
  "future storage statuses must not expose a persistent launch path"
);

console.log("Admin launch path behavior checks passed: unknown, unconfigured, unverified, and verified storage states remain distinct.");
