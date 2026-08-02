import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = fs.readFileSync(path.join(process.cwd(), "lib/discoveryUpdates.ts"), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const loadedModule = { exports: {} };
new Function("exports", "module", output)(loadedModule.exports, loadedModule);
const { getDiscoveryUpdates, getProductDiscoveryObservation } = loadedModule.exports;

const base = {
  category: "laptop",
  source: "coupang_partners",
  source_product_id: "cp-1",
  raw_json: {},
  is_published: true,
  sourcing_status: "published",
  latest_score: { total_score: 82 },
  snapshots: [],
  product_snapshots: []
};

const recent = {
  ...base,
  id: "recent",
  title: "실제 자동 수집 상품",
  last_observed_at: "2026-08-02T11:00:00.000Z",
  snapshots: [{
    id: "recent-source",
    product_id: "recent",
    observed_at: "2026-08-02T11:00:01.000Z",
    change_flags: ["SOURCE_PRICE_CHANGED", "STOCK_CHANGED"],
    raw_json: { observation_origin: "sourcing" }
  }]
};
const older = {
  ...base,
  id: "older",
  title: "기존 자동 수집 상품",
  last_observed_at: "2026-08-01T11:00:00.000Z",
  latest_score: { total_score: 95 },
  snapshots: []
};
const manual = {
  ...base,
  id: "manual",
  title: "관리자 수동 등록 상품",
  source: "manual_admin",
  source_product_id: null,
  last_observed_at: "2026-08-02T12:00:00.000Z"
};
const demo = {
  ...base,
  id: "demo",
  title: "로컬 데모 상품",
  source: "mock",
  source_product_id: "seed-demo",
  last_observed_at: "2026-08-02T12:00:00.000Z"
};
const unobserved = {
  ...base,
  id: "unobserved",
  title: "관찰 시각 없는 상품",
  last_observed_at: null
};
const adminEdited = {
  ...base,
  id: "admin-edited",
  title: "관리자 수정이 최근인 상품",
  last_observed_at: "2026-08-01T10:00:00.000Z",
  snapshots: [{
    id: "admin-snapshot",
    product_id: "admin-edited",
    observed_at: "2026-08-02T12:00:00.000Z",
    change_flags: ["SOURCE_PRICE_CHANGED"],
    raw_json: { observation_origin: "admin" }
  }]
};

const isReady = (product) => product.is_published && product.sourcing_status === "published";
const updates = getDiscoveryUpdates([older, manual, recent, demo, unobserved, adminEdited], isReady, 10);

assert.deepEqual(updates.map((item) => item.product.id), ["recent", "older", "admin-edited"]);
assert.deepEqual(updates[0].labels, ["판매가 변동", "재고 변동"]);
assert.equal(updates[1].labels.length, 0, "admin snapshots must not be shown as sourcing changes");
assert.equal(getProductDiscoveryObservation(manual), null);
assert.equal(getProductDiscoveryObservation(unobserved), null);
assert.equal(getDiscoveryUpdates([recent, older], isReady, 1).length, 1);

console.log("Discovery update checks passed: public readiness, non-manual observations, source provenance, ordering, and limit.");
