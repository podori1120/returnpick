#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

const source = readFileSync(new URL("../lib/sourcingCursor.ts", import.meta.url), "utf8")
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
${source}
export { getNextSourcingKeywordOffset };
export { mockRuns, mockKeywords, keywordCalls };
export { setKeywordError };
`;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(mockModule, { mode: "transform" })).toString("base64")}`;
const cursor = await import(moduleUrl);

function run(id, { startedAt, finishedAt = null, offset, launchMarker = false } = {}) {
  return {
    id,
    status: launchMarker ? "launch_confirmed" : "completed",
    started_at: startedAt,
    finished_at: finishedAt,
    log_json: {
      ...(offset === undefined ? {} : { next_keyword_offset: offset }),
      ...(launchMarker ? { kind: "post_approval_first_launch" } : {})
    }
  };
}

function keyword(createdAt, updatedAt = createdAt) {
  return { created_at: createdAt, updated_at: updatedAt };
}

async function expectOffset(name, expected, runs, keywords, error = null) {
  cursor.mockRuns.splice(0, cursor.mockRuns.length, ...runs);
  cursor.mockKeywords.splice(0, cursor.mockKeywords.length, ...keywords);
  cursor.setKeywordError(error);
  const actual = await cursor.getNextSourcingKeywordOffset();
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

await expectOffset(
  "updated_at alone does not reset the cursor",
  11,
  [run("latest", { startedAt: "2026-08-11T00:00:00.000Z", finishedAt: "2026-08-11T00:01:00.000Z", offset: 11 })],
  [keyword("2026-08-09T00:00:00.000Z", "2026-08-12T00:00:00.000Z")]
);

assert.ok(cursor.keywordCalls.length > 0, "cursor reads active keywords through the data-store API");
assert.ok(cursor.keywordCalls.every((options) => options?.activeOnly === true), "cursor requests active keywords only");

console.log("Sourcing cursor check passed: numeric fallback, one-shot new-keyword reset, marker pagination, timestamp fallback, lookup failure, and updated_at safety are deterministic.");
