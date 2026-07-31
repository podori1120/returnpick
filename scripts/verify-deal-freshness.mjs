import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = fs.readFileSync(path.join(process.cwd(), "lib", "dealFreshness.ts"), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const loadedModule = { exports: {} };
new Function("exports", "module", "require", output)(loadedModule.exports, loadedModule, require);

const { getDealFreshness, getDealFreshnessFromTimestamps } = loadedModule.exports;
const now = Date.parse("2026-07-31T12:00:00.000Z");

assert.equal(getDealFreshnessFromTimestamps(["2026-07-31T11:00:00.000Z"], now).status, "fresh");
assert.equal(getDealFreshnessFromTimestamps(["2026-07-30T12:00:00.000Z"], now).status, "fresh");
assert.equal(getDealFreshnessFromTimestamps(["2026-07-30T11:59:59.999Z"], now).status, "stale");
assert.equal(getDealFreshnessFromTimestamps([null, "invalid"], now).status, "unknown");

const latest = getDealFreshnessFromTimestamps(
  ["2026-07-29T12:00:00.000Z", "2026-07-31T10:00:00.000Z", "2026-07-30T12:00:00.000Z"],
  now
);
assert.equal(latest.status, "fresh");
assert.equal(latest.observedAt, "2026-07-31T10:00:00.000Z");
assert.equal(latest.ageHours, 2);

const freshSnapshot = { observed_at: "2026-07-31T11:00:00.000Z" };
assert.equal(
  getDealFreshness({ last_observed_at: "2026-07-30T11:00:00.000Z", latest_snapshot: freshSnapshot }, now).status,
  "stale"
);
assert.equal(getDealFreshness({ last_observed_at: null, latest_snapshot: freshSnapshot }, now).status, "fresh");
assert.equal(getDealFreshness({ last_observed_at: "2026-07-31T11:00:00.000Z" }, now).status, "fresh");
assert.equal(
  getDealFreshness({
    source: "manual_admin",
    last_observed_at: "2026-07-31T11:00:00.000Z",
    latest_snapshot: freshSnapshot
  }, now).status,
  "unknown"
);

console.log(
  "Deal freshness checks passed: 24-hour boundary, unknown state, source observation precedence, and legacy snapshot fallback."
);
