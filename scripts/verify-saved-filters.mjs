import assert from "node:assert/strict";
import { buildSavedFilterHref, buildSavedFilterLabel, normalizeSavedFilters } from "../lib/savedFilters.ts";

const options = {
  categories: [{ value: "laptop", label: "노트북" }],
  useCases: [{ id: "gaming", label: "게이밍" }],
  priceBands: [{ id: "under_700k", label: "30만~70만원 미만" }]
};

const label = buildSavedFilterLabel(
  new URLSearchParams("search=그램+프로&category=laptop&useCase=gaming&priceBand=under_700k&condition=%EC%B5%9C%EC%83%81&quality=ready&stock=one&minScore=80&minDiscount=20&minPrice=500000&maxPrice=900000&sort=discount"),
  options
);
assert.match(label, /검색: 그램 프로/);
assert.match(label, /노트북/);
assert.match(label, /게이밍/);
assert.match(label, /30만~70만원 미만/);
assert.match(label, /등급 최상/);
assert.match(label, /게시 적합/);
assert.match(label, /재고 1개/);
assert.match(label, /점수 80점 이상/);
assert.match(label, /20% 할인 이상/);
assert.match(label, /최소 500,000원/);
assert.match(label, /최대 900,000원/);
assert.match(label, /할인율 순/);
assert.equal(buildSavedFilterHref("/deals", "?search=%EA%B7%B8%EB%9E%A8&page=3"), "/deals?search=%EA%B7%B8%EB%9E%A8");

const normalized = normalizeSavedFilters([
  { label: "정상 조건", href: "/deals?search=그램&page=3", savedAt: "2026-08-09T00:00:00.000Z" },
  { label: "중복 조건", href: "/deals?search=그램", savedAt: "" },
  { label: "외부 이동", href: "https://example.com", savedAt: "" },
  { label: "프로토콜 상대경로", href: "//example.com", savedAt: "" },
  { label: "", href: "/deals", savedAt: "" },
  null
]);
assert.equal(normalized.length, 1);
assert.equal(normalized[0].href, "/deals?search=%EA%B7%B8%EB%9E%A8");
assert.equal(normalizeSavedFilters("broken").length, 0);

console.log("saved filter checks passed: 16 assertions");
