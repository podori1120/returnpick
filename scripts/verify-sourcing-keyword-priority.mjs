#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

const source = readFileSync(new URL("../lib/sourcingKeywordOrder.ts", import.meta.url), "utf8").replace(/^import type .*;\r?\n/gm, "");
const sourcingSource = readFileSync(new URL("../lib/sourcing.ts", import.meta.url), "utf8");
assert.match(sourcingSource, /getOrderedSourcingKeywords\(activeKeywords, sourceMode\)/);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source, { mode: "transform" })).toString("base64")}`;
const { getSourcingKeywordOrderSnapshot, getSourcingKeywordOrderVersion, orderPublicWebSourcingKeywords } = await import(moduleUrl);

const keywords = [
  { id: "laptop-low", category: "laptop", min_price: 500_000 },
  { id: "monitor-tie-first", category: "monitor", min_price: 900_000 },
  { id: "laptop-high", category: "laptop", min_price: 1_200_000 },
  { id: "robot-high", category: "robot_vacuum", min_price: 900_000 },
  { id: "monitor-tie-second", category: "monitor", min_price: 900_000 },
  { id: "laptop-tie", category: "laptop", min_price: 1_200_000 },
  { id: "monitor-missing", category: "monitor", min_price: null },
  { id: "robot-invalid", category: "robot_vacuum", min_price: -1 },
  { id: "air-invalid", category: "air_purifier", min_price: Number.NaN },
  { id: "air-missing", category: "air_purifier", min_price: null }
];
const originalKeywords = keywords.map((keyword) => ({ ...keyword }));
const ordered = orderPublicWebSourcingKeywords(keywords);

assert.deepEqual(ordered.map((keyword) => keyword.id), [
  "laptop-high",
  "monitor-tie-first",
  "robot-high",
  "air-invalid",
  "laptop-tie",
  "monitor-tie-second",
  "robot-invalid",
  "air-missing",
  "laptop-low",
  "monitor-missing"
]);
assert.deepEqual(keywords, originalKeywords, "ordering must not mutate the active keyword snapshot");
assert.notStrictEqual(ordered, keywords, "ordering must return a new array");
assert.equal(getSourcingKeywordOrderVersion("public_web_only"), "min_price_desc_category_balanced_v2");
assert.notEqual(getSourcingKeywordOrderSnapshot(keywords, "auto"), getSourcingKeywordOrderSnapshot(keywords, "public_web_only"));
assert.deepEqual(orderPublicWebSourcingKeywords([]), []);
assert.equal(getSourcingKeywordOrderSnapshot([], "public_web_only"), "[]");

console.log("Sourcing keyword priority check passed: public-web intake balances categories, preserves within-category price/tie order, leaves unknown prices last, distinguishes auto snapshots, and preserves input.");
