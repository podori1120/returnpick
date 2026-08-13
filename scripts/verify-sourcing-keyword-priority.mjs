#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

const source = readFileSync(new URL("../lib/sourcingKeywordOrder.ts", import.meta.url), "utf8").replace(/^import type .*;\r?\n/gm, "");
const sourcingSource = readFileSync(new URL("../lib/sourcing.ts", import.meta.url), "utf8");
assert.match(sourcingSource, /getOrderedSourcingKeywords\(activeKeywords, sourceMode\)/);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source, { mode: "transform" })).toString("base64")}`;
const { getSourcingKeywordOrderSnapshot, orderPublicWebSourcingKeywords } = await import(moduleUrl);

const keywords = [
  { id: "missing", min_price: null },
  { id: "mid", min_price: 600_000 },
  { id: "high", min_price: 1_200_000 },
  { id: "tie", min_price: 1_200_000 },
  { id: "invalid", min_price: -1 }
];
const originalIds = keywords.map((keyword) => keyword.id);
const ordered = orderPublicWebSourcingKeywords(keywords);

assert.deepEqual(ordered.map((keyword) => keyword.id), ["high", "tie", "mid", "missing", "invalid"]);
assert.deepEqual(keywords.map((keyword) => keyword.id), originalIds, "ordering must not mutate the active keyword snapshot");
assert.equal(orderPublicWebSourcingKeywords([]).length, 0);
assert.notEqual(getSourcingKeywordOrderSnapshot(keywords, "auto"), getSourcingKeywordOrderSnapshot(keywords, "public_web_only"));

console.log("Sourcing keyword priority check passed: public-web intake puts configured higher minimum prices first, preserves ties, and leaves unknown prices last without mutation.");
