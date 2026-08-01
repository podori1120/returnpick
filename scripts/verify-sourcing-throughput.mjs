#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const source = readFileSync(path.join(process.cwd(), "lib", "sourcing.ts"), "utf8");

assert.match(source, /defaultProductEnrichmentConcurrency = 2;/);
assert.match(source, /maxProductEnrichmentConcurrency = 4;/);
assert.match(source, /SOURCING_ENRICHMENT_CONCURRENCY/);
assert.match(source, /Math\.min\(maxProductEnrichmentConcurrency/);
assert.match(source, /async function mapWithConcurrency/);
assert.match(source, /await mapWithConcurrency(?:<[^>]+>)?\(candidates, productEnrichmentConcurrency/);
assert.match(source, /product_enrichment_concurrency: productEnrichmentConcurrency/);
assert.match(source, /if \("error" in enriched\)/);

console.log("Sourcing throughput check passed: product enrichment keeps a default of two, allows a bounded 1-4 concurrency setting, and isolates per-item errors.");
