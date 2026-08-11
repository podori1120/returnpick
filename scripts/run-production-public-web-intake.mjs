#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { envValue, loadEnvFiles } from "./load-env-files.mjs";

const DEFAULT_SITE_URL = "https://returnpick.vercel.app";
const ALLOWED_PROFILES = new Map([
  ["algumon_discovery_v1", { hostCount: 1, templateCount: 1 }],
  ["hotdeals_discovery_v2", { hostCount: 1, templateCount: 1 }],
  ["algumon_hotdeals_discovery_v1", { hostCount: 2, templateCount: 2 }]
]);
const REQUIRED_CHECK_IDS = ["supabase", "data_quality", "site_live", "cron", "public_web"];
const RECENT_RUN_WINDOW_MS = 15 * 60 * 1000;
const FIRST_LAUNCH_KIND = "post_approval_first_launch";

function normalizeSiteUrl(value) {
  try {
    const url = new URL(String(value ?? "").trim());
    const expected = new URL(DEFAULT_SITE_URL);
    if (
      url.origin !== expected.origin ||
      url.username ||
      url.password ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash
    ) return "";
    return expected.origin;
  } catch {
    return "";
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function realSourcingRuns(body) {
  return asArray(asRecord(body).runs).filter(
    (run) => !(run?.status === "launch_confirmed" && run?.log_json?.kind === FIRST_LAUNCH_KIND)
  );
}

function activeKeywordSnapshot(body) {
  return asArray(asRecord(body).keywords)
    .filter((keyword) => keyword?.is_active === true)
    .map((keyword) => [
      String(keyword?.id ?? ""),
      String(keyword?.category ?? ""),
      String(keyword?.keyword ?? ""),
      keyword?.min_price ?? null,
      keyword?.max_price ?? null,
      keyword?.min_discount_rate ?? null
    ]);
}

function sameSnapshot(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isRecentOrRunning(run, nowMs) {
  if (!run) return false;
  if (run.status === "running") return true;
  return [run.started_at, run.finished_at].some((value) => {
    const timestamp = Date.parse(String(value ?? ""));
    return Number.isFinite(timestamp) && Math.abs(nowMs - timestamp) <= RECENT_RUN_WINDOW_MS;
  });
}

function validateReadiness(body) {
  const record = asRecord(body);
  const readiness = asRecord(record.readiness);
  const profile = asRecord(readiness.publicWebProfile ?? record.publicWebProfile);
  const expected = ALLOWED_PROFILES.get(profile.id);
  const checks = new Map(asArray(record.checks).map((check) => [check?.id, check?.status]));
  const requiredIds = asArray(readiness.requiredConnectionCheckIds);
  const storage = asRecord(record.storage);
  const valid = Boolean(
    storage.status === "verified" &&
      readiness.runtimeReady === true &&
      readiness.launchReady === true &&
      profile.enabled === true &&
      profile.exactMatch === true &&
      expected &&
      profile.hostCount === expected.hostCount &&
      profile.templateCount === expected.templateCount &&
      requiredIds.length > 0 &&
      requiredIds.every((id) => checks.get(id) === "ok") &&
      REQUIRED_CHECK_IDS.every((id) => checks.get(id) === "ok")
  );

  return { valid, profileId: valid ? profile.id : null };
}

function summarizeRun(body) {
  const record = asRecord(body);
  const run = asRecord(record.run);
  const log = asRecord(run.log_json);
  const diagnosis = asRecord(record.diagnosis);
  const signals = asRecord(diagnosis.signals);
  return {
    id: typeof run.id === "string" ? run.id : null,
    status: typeof run.status === "string" ? run.status : null,
    source_mode: typeof record.source_mode === "string" ? record.source_mode : null,
    keyword_count: Number.isFinite(run.keyword_count) ? run.keyword_count : null,
    processed_keyword_count: Number.isFinite(log.processed_keyword_count) ? log.processed_keyword_count : null,
    found_count: Number.isFinite(run.found_count) ? run.found_count : null,
    inserted_count: Number.isFinite(run.inserted_count) ? run.inserted_count : null,
    updated_count: Number.isFinite(run.updated_count) ? run.updated_count : null,
    error_count: Number.isFinite(run.error_count) ? run.error_count : null,
    stopped_by_time_budget: typeof log.stopped_by_time_budget === "boolean" ? log.stopped_by_time_budget : null,
    keyword_start_offset: Number.isFinite(log.keyword_start_offset) ? log.keyword_start_offset : null,
    next_keyword_offset: Number.isFinite(log.next_keyword_offset) ? log.next_keyword_offset : null,
    public_web_diagnostic_statuses: asArray(signals.publicWebDiagnosticStatuses)
      .filter((status) => typeof status === "string")
      .slice(0, 4)
  };
}

function continuationAllowed(body, keywordSnapshotAvailable) {
  const record = asRecord(body);
  const run = asRecord(record.run);
  const log = asRecord(run.log_json);
  const diagnosis = asRecord(record.diagnosis);
  const signals = asRecord(diagnosis.signals);
  const statuses = asArray(signals.publicWebDiagnosticStatuses);
  const logs = asArray(log.logs);
  const zeroCounts = [run.error_count, run.found_count, run.inserted_count, run.updated_count].every((value) => value === 0);

  return Boolean(
    keywordSnapshotAvailable &&
      record.source_mode === "public_web_only" &&
      run.status === "completed" &&
      zeroCounts &&
      log.stopped_by_time_budget === false &&
      Number.isFinite(log.processed_keyword_count) &&
      log.processed_keyword_count === run.keyword_count &&
      statuses.length > 0 &&
      statuses.every((status) => status === "FETCHED_HTML") &&
      Number.isFinite(log.active_keyword_count) &&
      log.active_keyword_count > log.processed_keyword_count &&
      Number.isFinite(log.next_keyword_offset) &&
      Number.isFinite(log.keyword_start_offset) &&
      log.next_keyword_offset !== log.keyword_start_offset &&
      !logs.some((item) => item?.status === "default_keywords_seeded")
  );
}

function statusReport(status, reason, profile = null, runs = [], continuation = false) {
  return { status, profile, runs, continuation, reason };
}

function requestErrorCode(error) {
  if (error?.name === "AbortError") return "REQUEST_TIMEOUT";
  return String(error?.cause?.code ?? error?.name ?? "REQUEST_FAILED").slice(0, 80);
}

export async function runProductionPublicWebIntake({
  siteUrl = DEFAULT_SITE_URL,
  adminPassword,
  fetchImpl = fetch,
  now = () => Date.now(),
  requestTimeoutMs = 70_000
} = {}) {
  if (!adminPassword) return { exitCode: 2, report: statusReport("BLOCKED_AUTH", "ADMIN_PASSWORD_MISSING") };
  const targetSiteUrl = normalizeSiteUrl(siteUrl);
  if (!targetSiteUrl) return { exitCode: 3, report: statusReport("BLOCKED_NOOP", "INVALID_SITE_URL") };

  const headers = { "content-type": "application/json", "x-admin-password": adminPassword };
  const requestJson = async (path, init = {}, { retryReadOnly = false, timeoutMs = requestTimeoutMs } = {}) => {
    const attempts = retryReadOnly ? 2 : 1;
    let lastError = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(`${targetSiteUrl}${path}`, {
          ...init,
          redirect: "error",
          headers: { ...headers, ...asRecord(init.headers) },
          signal: controller.signal
        });
        const body = await response.json().catch(() => null);
        if (retryReadOnly && response.status >= 500 && attempt + 1 < attempts) continue;
        return { response, body };
      } catch (error) {
        lastError = error;
        if (attempt + 1 >= attempts) throw error;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError ?? new Error("REQUEST_FAILED");
  };

  let profileId = null;
  const runs = [];
  try {
    const readinessResponse = await requestJson(
      "/api/admin/api-readiness",
      { method: "POST" },
      { retryReadOnly: true, timeoutMs: 60_000 }
    );
    if (readinessResponse.response.status !== 200) {
      return { exitCode: 3, report: statusReport("BLOCKED_NOOP", `READINESS_HTTP_${readinessResponse.response.status}`) };
    }
    const readiness = validateReadiness(readinessResponse.body);
    if (!readiness.valid) return { exitCode: 3, report: statusReport("BLOCKED_NOOP", "READINESS_GUARD_FAILED") };
    profileId = readiness.profileId;

    const priorRuns = await requestJson("/api/admin/sourcing/run", { method: "GET" }, { retryReadOnly: true, timeoutMs: 30_000 });
    if (priorRuns.response.status !== 200) {
      return { exitCode: 3, report: statusReport("BLOCKED_NOOP", `RUN_GUARD_HTTP_${priorRuns.response.status}`, profileId) };
    }
    if (realSourcingRuns(priorRuns.body).some((run) => isRecentOrRunning(run, now()))) {
      return { exitCode: 3, report: statusReport("BLOCKED_NOOP", "RECENT_OR_RUNNING_SOURCING", profileId) };
    }

    let keywordSnapshot = null;
    try {
      const keywords = await requestJson("/api/admin/keywords", { method: "GET" }, { retryReadOnly: true, timeoutMs: 30_000 });
      if (keywords.response.status === 200) keywordSnapshot = activeKeywordSnapshot(keywords.body);
    } catch {
      keywordSnapshot = null;
    }

    const requestBody = {
      sourceMode: "public_web_only",
      requiredPublicWebProfile: profileId,
      useMockFallback: false,
      keywordLimit: 8,
      timeBudgetMs: 52_000
    };
    let firstResponse;
    try {
      firstResponse = await requestJson("/api/admin/sourcing/run", {
        method: "POST",
        body: JSON.stringify(requestBody)
      });
    } catch (error) {
      return { exitCode: 1, report: statusReport("PARTIAL", requestErrorCode(error), profileId) };
    }
    if (firstResponse.response.status === 409 && firstResponse.body?.error === "PUBLIC_WEB_PROFILE_MISMATCH") {
      return { exitCode: 3, report: statusReport("BLOCKED_NOOP", "PUBLIC_WEB_PROFILE_MISMATCH", profileId) };
    }
    if (firstResponse.response.status !== 200) {
      return {
        exitCode: 1,
        report: statusReport("PARTIAL", `FIRST_HTTP_${firstResponse.response.status}`, profileId)
      };
    }
    runs.push(summarizeRun(firstResponse.body));

    let allowContinuation = continuationAllowed(firstResponse.body, keywordSnapshot !== null);
    if (allowContinuation) {
      try {
        const [latest, currentKeywords] = await Promise.all([
          requestJson("/api/admin/sourcing/run", { method: "GET" }, { retryReadOnly: true, timeoutMs: 30_000 }),
          requestJson("/api/admin/keywords", { method: "GET" }, { retryReadOnly: true, timeoutMs: 30_000 })
        ]);
        const latestRuns = realSourcingRuns(latest.body);
        const latestId = latestRuns[0]?.id;
        allowContinuation = Boolean(
          latest.response.status === 200 &&
            latestId === firstResponse.body?.run?.id &&
            !latestRuns.some((run) => run?.id !== latestId && run?.status === "running") &&
            currentKeywords.response.status === 200 &&
            sameSnapshot(keywordSnapshot, activeKeywordSnapshot(currentKeywords.body))
        );
      } catch {
        allowContinuation = false;
      }
    }

    if (allowContinuation) {
      const log = asRecord(firstResponse.body?.run?.log_json);
      const keywordLimit = Math.min(8, log.active_keyword_count - log.processed_keyword_count);
      let continuationResponse;
      try {
        continuationResponse = await requestJson("/api/admin/sourcing/run", {
          method: "POST",
          body: JSON.stringify({ ...requestBody, keywordLimit })
        });
      } catch (error) {
        return {
          exitCode: 1,
          report: statusReport("PARTIAL", `CONTINUATION_${requestErrorCode(error)}`, profileId, runs)
        };
      }
      if (continuationResponse.response.status === 409 && continuationResponse.body?.error === "PUBLIC_WEB_PROFILE_MISMATCH") {
        return {
          exitCode: 1,
          report: statusReport("PARTIAL", "CONTINUATION_PROFILE_MISMATCH", profileId, runs)
        };
      }
      if (continuationResponse.response.status !== 200) {
        return {
          exitCode: 1,
          report: statusReport("PARTIAL", `CONTINUATION_HTTP_${continuationResponse.response.status}`, profileId, runs)
        };
      }
      runs.push(summarizeRun(continuationResponse.body));
    }

    const completed = runs.every(
      (run) => run.source_mode === "public_web_only" && run.status === "completed" && run.error_count === 0
    );
    return {
      exitCode: completed ? 0 : 1,
      report: statusReport(
        completed ? "COMPLETED_REVIEW_ONLY" : "PARTIAL",
        allowContinuation ? "CONTINUATION_COMPLETED" : "FIRST_RUN_ONLY",
        profileId,
        runs,
        allowContinuation
      )
    };
  } catch (error) {
    return {
      exitCode: runs.length ? 1 : 3,
      report: statusReport(runs.length ? "PARTIAL" : "BLOCKED_NOOP", requestErrorCode(error), profileId, runs)
    };
  }
}

async function main() {
  loadEnvFiles();
  const adminPassword = envValue(["RETURNPICK_ADMIN_PASSWORD", "ADMIN_PASSWORD"]);
  const result = await runProductionPublicWebIntake({ siteUrl: DEFAULT_SITE_URL, adminPassword });
  console.log(JSON.stringify(result.report));
  process.exitCode = result.exitCode;
}

const executedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (executedPath === import.meta.url) {
  main().catch((error) => {
    console.log(JSON.stringify(statusReport("BLOCKED_NOOP", requestErrorCode(error))));
    process.exitCode = 3;
  });
}

export { activeKeywordSnapshot, continuationAllowed, isRecentOrRunning, normalizeSiteUrl, summarizeRun, validateReadiness };
