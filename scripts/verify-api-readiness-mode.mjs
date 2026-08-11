import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const apiReadiness = read("lib/apiReadiness.ts");
const readinessRoute = read("app/api/admin/api-readiness/route.ts");
const productionVerifier = read("scripts/verify-production-readiness.mjs");

assert.match(apiReadiness, /export type ApiReadinessCheckMode = "full" \| "read_only"/);
assert.match(apiReadiness, /runApiConnectionChecks\(mode: ApiReadinessCheckMode = "full"\)/);
assert.match(apiReadiness, /const writeSmokesAllowed = mode === "full"/);
assert.match(apiReadiness, /mode === "full" && client && !failedTables\.length && !failedSchema\.length[\s\S]*runDistributionDeliveryLedgerSmokeCheck/);
assert.match(apiReadiness, /mode === "full" && client && !failedTables\.length && !failedSchema\.length && strictAffiliateFunction\?\.ok[\s\S]*runSupabaseWriteSmokeCheck/);
assert.match(apiReadiness, /mode === "full" && client && !failedTables\.length && !failedSchema\.length && strictAffiliateFunction\?\.ok && writeSmoke\?\.ok[\s\S]*runAnonPublicRlsSmokeCheck/);
assert.match(apiReadiness, /write_smoke_skipped: mode === "read_only"/);
assert.match(apiReadiness, /write-only smoke checks were skipped/);
assert.match(apiReadiness, /const constraintBlocker = writeSmokesAllowed && !publicAffiliateConstraintOk/);
assert.match(apiReadiness, /mode === "read_only"[\s\S]*Read-only Supabase schema\/RPC checks failed/);
assert.match(apiReadiness, /const readOnlyMode = check\.detail\?\.mode === "read_only"/);
assert.match(apiReadiness, /readOnlyMode && check\.status === "ok"/);
assert.match(apiReadiness, /label: "Supabase 운영 DB",\n      message: "Read-only Supabase schema\/RPC checks passed; write and anon RLS smoke checks were skipped\."/);
assert.match(apiReadiness, /Read-only Supabase checks skipped because environment is not configured; write and anon RLS smoke checks were skipped\./);
assert.match(apiReadiness, /withReadinessMode\(connectionCheckFailure\("supabase", "Supabase 운영 DB", error\), mode\)/);
assert.match(apiReadiness, /detail: \{\n        mode,\n        write_smoke_skipped: mode === "read_only"/);
assert.match(apiReadiness, /data-quality queries found blockers; write-only smoke checks and the affiliate constraint probe were skipped/);
const qualityStart = apiReadiness.indexOf("async function runPublicDataQualityCheck");
const qualityEnd = apiReadiness.indexOf("async function runAnonPublicRlsSmokeCheck");
assert.ok(qualityStart >= 0 && qualityEnd > qualityStart, "data-quality function boundaries must remain discoverable");
const qualitySource = apiReadiness.slice(qualityStart, qualityEnd);
assert.ok(qualitySource.indexOf("if (writeSmokesAllowed)") < qualitySource.indexOf('.from("sourced_products")\n      .insert('), "constraint smoke insert must stay behind full-mode guard");
assert.match(qualitySource, /if \(writeSmokesAllowed\)[\s\S]*\.from\("sourced_products"\)[\s\S]*\.delete\(/);
assert.match(qualitySource, /rejected_bad_public_affiliate_url: writeSmokesAllowed \? publicAffiliateConstraintOk : null/);
assert.match(qualitySource, /mode,\n        write_smoke_skipped: !writeSmokesAllowed,\n        public_affiliate_constraint/);

assert.match(readinessRoute, /searchParams\.get\("mode"\) === "read_only"/);
assert.match(readinessRoute, /runApiConnectionChecks\(mode\)/);
assert.match(readinessRoute, /return NextResponse\.json\(\{ readiness, storage, checks, publicWebProfile, mode \}\)/);

assert.match(productionVerifier, /\/api\/admin\/api-readiness\?mode=read_only/);
assert.match(productionVerifier, /liveChecks\.json\?\.mode !== "read_only"/);

console.log("API readiness mode checks passed: production verifier is explicit read-only; full admin/launch checks remain available.");
