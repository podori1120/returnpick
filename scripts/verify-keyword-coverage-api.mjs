import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getSourcingKeywordCoverage, normalizeKeywordKey } from "../lib/keywordCoverage.ts";

const root = process.cwd();
const route = readFileSync(path.join(root, "app", "api", "admin", "keywords", "route.ts"), "utf8");
const runner = readFileSync(path.join(root, "components", "AdminSourcingRunner.tsx"), "utf8");
const packageJson = readFileSync(path.join(root, "package.json"), "utf8");

const defaults = [
  { keyword: "LG 그램", category: "laptop" },
  { keyword: " lg 그램 ", category: "laptop" },
  { keyword: "QHD 모니터", category: "monitor" }
];
const rows = [
  { keyword: " LG 그램 ", category: "laptop", is_active: false },
  { keyword: "lg 그램", category: "laptop", is_active: true },
  { keyword: "공기청정기", category: "air_purifier", is_active: false }
];
const coverage = getSourcingKeywordCoverage(rows, defaults);

assert.equal(normalizeKeywordKey(" LG 그램 "), "lg 그램");
assert.deepEqual(coverage, {
  total_count: 2,
  active_count: 1,
  default_count: 2,
  missing_default_count: 1
});

const getBlock = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
assert.match(getBlock, /const unauthorized = requireAdmin\(request\);\s*if \(unauthorized\) return unauthorized;/, "coverage GET must remain admin-protected");
assert.match(getBlock, /getSourcingKeywordCoverage/, "coverage GET must use the shared normalized helper");
assert.match(getBlock, /keywords,/, "coverage GET must preserve the existing keyword rows");
assert.match(getBlock, /coverage:\s*getSourcingKeywordCoverage\(keywords, DEFAULT_SOURCING_KEYWORDS\)/, "coverage GET must return the normalized coverage object");
assert.doesNotMatch(getBlock, /createKeyword|updateKeyword/, "coverage GET must remain read-only");

const coverageLoader = runner.slice(runner.indexOf("async function loadKeywordCoverage"), runner.indexOf("useEffect(() =>", runner.indexOf("async function loadKeywordCoverage")));
assert.match(coverageLoader, /setKeywordCoverageError/, "coverage failures must use separate state");
assert.doesNotMatch(coverageLoader, /setNotice\(/, "coverage failures must not replace the sourcing run notice");
assert.match(runner, /await loadKeywordCoverage\(\);\s*await loadRuns\(\);/, "a completed run must refresh coverage before the run history");
assert.match(runner, /keywordCoverage \|\| keywordCoverageError/, "coverage errors must remain visible even when stale counts are present");
assert.match(runner, /keywordCoverageError \? <p className="mt-1 font-black text-coral">범위 재조회 실패:/, "coverage failure text must be rendered in the runner");
assert.match(packageJson, /"keyword-coverage:check": "node --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts\/verify-keyword-coverage-api\.mjs"/);

console.log("Keyword coverage API checks passed: auth, read-only GET, normalized counts, and failure-safe runner refresh are covered.");
