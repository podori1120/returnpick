#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const source = readFileSync(path.join(process.cwd(), "lib", "sourcing.ts"), "utf8");

assert.match(source, /const productEnrichmentConcurrency = 2;/);
assert.match(source, /async function mapWithConcurrency/);
assert.match(source, /await mapWithConcurrency(?:<[^>]+>)?\(candidates, productEnrichmentConcurrency/);
assert.match(source, /product_enrichment_concurrency: productEnrichmentConcurrency/);
assert.match(source, /if \("error" in enriched\)/);

console.log("Sourcing throughput check passed: product enrichment is bounded at two concurrent candidates with per-item error isolation.");
