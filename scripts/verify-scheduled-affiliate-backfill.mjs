#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

function read(file) {
  return fs.readFileSync(file, "utf8");
}

const scheduler = read("lib/scheduler.ts");
const route = read("app/api/cron/affiliate-backfill/route.ts");
const workflow = read(".github/workflows/returnpick-hourly.yml");
const adminRoute = read("app/api/admin/scheduler/run/route.ts");
const readiness = read("lib/apiReadiness.ts");

assert.match(scheduler, /runScheduledAffiliateBackfill/);
assert.match(scheduler, /backfillCoupangAffiliateLinks/);
assert.match(scheduler, /AFFILIATE_BACKFILL_LIMIT/);
assert.match(scheduler, /timeBudgetMs = 52_000/);
assert.match(scheduler, /time_budget_ms: timeBudgetMs/);
assert.match(route, /cronProbeJson\("affiliate_backfill"\)/);
assert.match(route, /CRON_AFFILIATE_BACKFILL_FAILED/);
assert.match(workflow, /\/api\/cron\/sourcing[\s\S]*\/api\/cron\/affiliate-backfill[\s\S]*\/api\/cron\/telegram-digest/);
assert.match(adminRoute, /job === "affiliate_backfill"/);
assert.match(readiness, /\/api\/cron\/affiliate-backfill\?probe=1/);

console.log("Scheduled affiliate backfill checks passed: isolated route, launch gate, hourly workflow order, admin trigger, and readiness probe.");
