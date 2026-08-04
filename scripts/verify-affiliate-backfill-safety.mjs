#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("lib/affiliateLinkBackfill.ts", "utf8");

assert.doesNotMatch(source, /verifyCoupangAffiliateLinkResolution/, "scheduled affiliate backfill must not fetch affiliate URLs");
assert.match(source, /REMOTE_CHECK_DEFERRED/, "scheduled backfill must record deferred destination checks");
assert.match(source, /예약 보강에서는 파트너스 링크를 자동 방문하지 않습니다/, "operators must see why scheduled verification is deferred");
assert.match(source, /resolved\.status === "provided"/, "existing links must wait for explicit operator verification instead of repeating remote requests");
assert.match(source, /AFFILIATE_IDENTITY_VERIFICATION_REQUIRED/, "deferred links must remain unpublished until identity verification");
assert.match(source, /관리자 링크 큐에서 브라우저 확인/, "the deferred path must hand off to the operator queue");

console.log("Affiliate backfill safety check passed: scheduled jobs never visit partner links and defer identity verification to an explicit admin action.");
