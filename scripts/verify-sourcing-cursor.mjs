#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

const source = readFileSync(new URL("../lib/sourcingCursor.ts", import.meta.url), "utf8")
  .replace(/^import .*;\r?\n/gm, "")
  .replace(/^export /gm, "");
const sourcingSource = readFileSync(new URL("../lib/sourcing.ts", import.meta.url), "utf8");
const orderSource = readFileSync(new URL("../lib/sourcingKeywordOrder.ts", import.meta.url), "utf8")
  .replace(/^import .*;\r?\n/gm, "")
  .replace(/^export /gm, "");
const mockModule = `
const mockRuns = [];
const mockKeywords = [];
const keywordCalls = [];
let keywordError = null;
function listSourcingExecutionRuns(limit) {
  const pageSize = Math.max(limit * 3, limit);
  const executionRuns = [];
  let pageStart = 0;
  while (executionRuns.length < limit) {
    const page = mockRuns.slice(pageStart, pageStart + pageSize);
    executionRuns.push(...page.filter(isSourcingExecutionRun));
    if (page.length < pageSize) break;
    pageStart += page.length;
  }
  return Promise.resolve(executionRuns.slice(0, limit));
}
function listKeywords(options) {
  keywordCalls.push(options);
  return keywordError ? Promise.reject(keywordError) : Promise.resolve(mockKeywords.slice());
}
function setKeywordError(value) { keywordError = value; }
function isSourcingExecutionRun(run) {
  return Boolean(run) && !(run.status === "launch_confirmed" && run.log_json?.kind === "post_approval_first_launch");
}
${orderSource}
${source}
export { getNextSourcingKeywordOffset };
export { getNextSourcingKeywordCursor };
export { getSourcingKeywordOffsetAfterDefaultSeed };
export { getSourcingKeywordOrderSnapshot };
export { mockRuns, mockKeywords, keywordCalls };
export { setKeywordError };
`;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(mockModule, { mode: "transform" })).toString("base64")}`;
const cursor = await import(moduleUrl);

assert.match(
  sourcingSource,
  /getSourcingKeywordOffsetAfterDefaultSeed\([\s\S]*?defaultKeywordSeed\.missing_count/,
  "sourcing must reset the requested cursor after seeding default keywords"
);
assert.equal(
  cursor.getSourcingKeywordOffsetAfterDefaultSeed(32, 1),
  0,
  "a newly detected default keyword must restart the cursor before public-web priority ordering"
);
assert.equal(
  cursor.getSourcingKeywordOffsetAfterDefaultSeed(32, 0),
  32,
  "an unchanged keyword catalog must preserve the requested continuation cursor"
);

function run(id, { startedAt, finishedAt = null, offset, launchMarker = false, sourceMode, keywordOrderSnapshot, keywordOrderVersion, defaultKeywordsInserted = 1, defaultKeywordsMissing = 0 } = {}) {
  return {
    id,
    status: launchMarker ? "launch_confirmed" : "completed",
    started_at: startedAt,
    finished_at: finishedAt,
    log_json: {
      ...(offset === undefined ? {} : { next_keyword_offset: offset }),
      ...(sourceMode ? { source_mode: sourceMode } : {}),
      ...(keywordOrderSnapshot ? { keyword_order_snapshot: keywordOrderSnapshot } : {}),
      ...(keywordOrderVersion ? { keyword_order_version: keywordOrderVersion } : {}),
      ...(defaultKeywordsMissing > 0 ? { logs: [{ status: "default_keywords_seeded", inserted_count: defaultKeywordsInserted, missing_count: defaultKeywordsMissing }] } : {}),
      ...(launchMarker ? { kind: "post_approval_first_launch" } : {})
    }
  };
}

function keyword(createdAt, updatedAt = createdAt) {
  return { created_at: createdAt, updated_at: updatedAt };
}

function richKeyword(id, min_price, createdAt = "2026-08-09T00:00:00.000Z") {
  return {
    id,
    keyword: id,
    category: "laptop",
    is_active: true,
    min_price,
    max_price: null,
    min_discount_rate: null,
    created_at: createdAt,
    updated_at: createdAt
  };
}

async function expectOffset(name, expected, runs, keywords, error = null, sourceMode = "auto") {
  cursor.mockRuns.splice(0, cursor.mockRuns.length, ...runs);
  cursor.mockKeywords.splice(0, cursor.mockKeywords.length, ...keywords);
  cursor.setKeywordError(error);
  const actual = await cursor.getNextSourcingKeywordOffset(sourceMode);
  assert.equal(actual, expected, name);
}

await expectOffset(
  "no execution run falls back to zero",
  0,
  [],
  [keyword("2026-08-09T00:00:00.000Z")]
);

await expectOffset(
  "no new keyword keeps the latest numeric offset",
  11,
  [run("latest", { startedAt: "2026-08-11T00:00:00.000Z", finishedAt: "2026-08-11T00:01:00.000Z", offset: 11 })],
  [keyword("2026-08-09T00:00:00.000Z")]
);

await expectOffset(
  "keyword created after the latest run resets to zero",
  0,
  [run("latest", { startedAt: "2026-08-10T00:00:00.000Z", finishedAt: "2026-08-10T00:01:00.000Z", offset: 4 })],
  [keyword("2026-08-10T00:02:00.000Z")]
);

await expectOffset(
  "the post-reset execution resumes its own numeric offset",
  5,
  [run("post-reset", { startedAt: "2026-08-10T00:03:00.000Z", finishedAt: "2026-08-10T00:04:00.000Z", offset: 5 }), run("latest-before-keyword", { startedAt: "2026-08-10T00:00:00.000Z", finishedAt: "2026-08-10T00:01:00.000Z", offset: 4 })],
  [keyword("2026-08-10T00:02:00.000Z")]
);

await expectOffset(
  "launch markers do not become the latest execution",
  11,
  [
    run("launch", { startedAt: "2026-08-12T00:00:00.000Z", finishedAt: "2026-08-12T00:00:01.000Z", offset: 0, launchMarker: true }),
    run("latest", { startedAt: "2026-08-11T00:00:00.000Z", finishedAt: "2026-08-11T00:01:00.000Z", offset: 11 })
  ],
  [keyword("2026-08-09T00:00:00.000Z")]
);

await expectOffset(
  "a saturated marker page still reaches the latest execution",
  11,
  [
    ...Array.from({ length: 30 }, (_, index) => run(`launch-${index}`, {
      startedAt: `2026-08-12T00:${String(index).padStart(2, "0")}:00.000Z`,
      finishedAt: `2026-08-12T00:${String(index).padStart(2, "0")}:01.000Z`,
      offset: 0,
      launchMarker: true
    })),
    run("latest", { startedAt: "2026-08-11T00:00:00.000Z", finishedAt: "2026-08-11T00:01:00.000Z", offset: 11 })
  ],
  [keyword("2026-08-09T00:00:00.000Z")]
);

await expectOffset(
  "started_at is the safe fallback when latest finished_at is missing",
  0,
  [run("latest", { startedAt: "2026-08-10T00:00:00.000Z", offset: 4 })],
  [keyword("2026-08-10T00:01:00.000Z")]
);

await expectOffset(
  "malformed latest timestamps fail safe to numeric fallback",
  11,
  [run("latest", { startedAt: "not-a-date", finishedAt: "also-not-a-date", offset: 11 })],
  [keyword("2026-08-12T00:00:00.000Z")]
);

await expectOffset(
  "malformed active keyword timestamps fail safe to numeric fallback",
  11,
  [run("latest", { startedAt: "2026-08-11T00:00:00.000Z", finishedAt: "2026-08-11T00:01:00.000Z", offset: 11 })],
  [keyword("not-a-date")]
);

await expectOffset(
  "any malformed active keyword timestamp fails safe even after a newer valid keyword",
  11,
  [run("latest", { startedAt: "2026-08-11T00:00:00.000Z", finishedAt: "2026-08-11T00:01:00.000Z", offset: 11 })],
  [keyword("2026-08-10T00:02:00.000Z"), keyword("not-a-date")]
);

await expectOffset(
  "keyword lookup failure falls back to the latest numeric offset",
  11,
  [run("latest", { startedAt: "2026-08-11T00:00:00.000Z", finishedAt: "2026-08-11T00:01:00.000Z", offset: 11 })],
  [keyword("2026-08-12T00:00:00.000Z")],
  new Error("KEYWORD_LOOKUP_FAILED")
);

const publicKeywords = [richKeyword("low", 500_000), richKeyword("high", 1_200_000)];
const publicSnapshot = cursor.getSourcingKeywordOrderSnapshot(publicKeywords, "public_web_only");
await expectOffset(
  "public-web mode does not reuse an automatic cursor",
  0,
  [run("latest-auto", { startedAt: "2026-08-11T00:00:00.000Z", finishedAt: "2026-08-11T00:01:00.000Z", offset: 7 })],
  publicKeywords,
  null,
  "public_web_only"
);
const seededPublicKeywords = [...publicKeywords, richKeyword("seeded", 1_500_000, "2026-08-13T02:09:00.000Z")];
cursor.mockRuns.splice(0, cursor.mockRuns.length, run("latest-before-seed", {
  startedAt: "2026-08-13T02:08:00.000Z",
  finishedAt: "2026-08-13T02:08:10.000Z",
  offset: 32,
  sourceMode: "public_web_only",
  keywordOrderSnapshot: publicSnapshot
}));
cursor.mockKeywords.splice(0, cursor.mockKeywords.length, ...publicKeywords);
const cursorReadBeforeConcurrentSeed = await cursor.getNextSourcingKeywordCursor("public_web_only");
cursor.mockKeywords.splice(0, cursor.mockKeywords.length, ...seededPublicKeywords);
const seededPublicSnapshot = cursor.getSourcingKeywordOrderSnapshot(seededPublicKeywords, "public_web_only");
assert.equal(cursorReadBeforeConcurrentSeed.offset, 32, "the first mode reads its continuation before the concurrent seed");
assert.equal(
  cursor.getSourcingKeywordOffsetAfterDefaultSeed(
    cursorReadBeforeConcurrentSeed.offset,
    0,
    cursorReadBeforeConcurrentSeed.keywordOrderSnapshot,
    seededPublicSnapshot
  ),
  0,
  "a concurrent seed observed after cursor lookup must restart the stale continuation"
);
await expectOffset(
  "automatic mode does not reuse a public-web cursor",
  0,
  [run("latest-public", { startedAt: "2026-08-11T00:00:00.000Z", finishedAt: "2026-08-11T00:01:00.000Z", offset: 7, sourceMode: "public_web_only", keywordOrderSnapshot: publicSnapshot })],
  publicKeywords,
  null,
  "auto"
);
await expectOffset(
  "public-web mode resumes only its matching snapshot",
  7,
  [run("latest-public", { startedAt: "2026-08-11T00:00:00.000Z", finishedAt: "2026-08-11T00:01:00.000Z", offset: 7, sourceMode: "public_web_only", keywordOrderSnapshot: publicSnapshot })],
  publicKeywords,
  null,
  "public_web_only"
);
await expectOffset(
  "a run that seeded defaults restarts the next cursor at zero",
  0,
  [run("seeded-public", {
    startedAt: "2026-08-13T02:09:38.000Z",
    finishedAt: "2026-08-13T02:09:50.000Z",
    offset: 40,
    sourceMode: "public_web_only",
    keywordOrderSnapshot: publicSnapshot,
    defaultKeywordsInserted: 0,
    defaultKeywordsMissing: 1
  })],
  publicKeywords,
  null,
  "public_web_only"
);
await expectOffset(
  "public-web mode resets after a minimum-price edit",
  0,
  [run("latest-public", { startedAt: "2026-08-11T00:00:00.000Z", finishedAt: "2026-08-11T00:01:00.000Z", offset: 7, sourceMode: "public_web_only", keywordOrderSnapshot: publicSnapshot })],
  [richKeyword("low", 500_000), richKeyword("high", 1_100_000)],
  null,
  "public_web_only"
);
await expectOffset(
  "legacy public-web runs restart without an order snapshot",
  0,
  [run("legacy-public", { startedAt: "2026-08-11T00:00:00.000Z", finishedAt: "2026-08-11T00:01:00.000Z", offset: 7, sourceMode: "public_web_only" })],
  publicKeywords,
  null,
  "public_web_only"
);

await expectOffset(
  "updated_at alone does not reset the cursor",
  11,
  [run("latest", { startedAt: "2026-08-11T00:00:00.000Z", finishedAt: "2026-08-11T00:01:00.000Z", offset: 11 })],
  [keyword("2026-08-09T00:00:00.000Z", "2026-08-12T00:00:00.000Z")]
);

assert.ok(cursor.keywordCalls.length > 0, "cursor reads active keywords through the data-store API");
assert.ok(cursor.keywordCalls.every((options) => options?.activeOnly === true), "cursor requests active keywords only");

console.log("Sourcing cursor check passed: numeric fallback, one-shot new-keyword reset, marker pagination, timestamp fallback, lookup failure, and updated_at safety are deterministic.");
