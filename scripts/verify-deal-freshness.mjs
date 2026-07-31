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

const { getDealFreshnessFromTimestamps } = loadedModule.exports;
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

console.log("Deal freshness checks passed: fresh boundary, stale state, unknown state, and latest observation selection.");
