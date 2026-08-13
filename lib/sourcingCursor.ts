import { listKeywords, listSourcingExecutionRuns } from "@/lib/dataStore";
import { isSourcingExecutionRun } from "@/lib/sourcingRunKinds";
import { DATASTORE_SOURCING_KEYWORD_ORDER_VERSION, getSourcingKeywordOrderSnapshot, type SourcingMode } from "@/lib/sourcingKeywordOrder";
import type { JsonValue, SourcingKeyword, SourcingRun } from "@/lib/types";

export function numberFromRunLog(value: JsonValue | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function getRunNextKeywordOffset(run: SourcingRun | null | undefined) {
  return numberFromRunLog(run?.log_json?.next_keyword_offset);
}

function parseTimestamp(value: string | null | undefined) {
  if (typeof value !== "string" || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getRunReferenceTimestamp(run: SourcingRun | null | undefined) {
  if (!run) return null;
  return parseTimestamp(run.finished_at) ?? parseTimestamp(run.started_at);
}

function getRunSourceMode(run: SourcingRun | null | undefined): SourcingMode {
  return run?.log_json?.source_mode === "public_web_only" ? "public_web_only" : "auto";
}

function getRunKeywordOrderSnapshot(run: SourcingRun | null | undefined) {
  const value = run?.log_json?.keyword_order_snapshot;
  return typeof value === "string" ? value : null;
}

function isCursorCompatibleRun(run: SourcingRun, sourceMode: SourcingMode) {
  if (getRunSourceMode(run) !== sourceMode) return false;
  const snapshot = getRunKeywordOrderSnapshot(run);
  if (snapshot != null) return true;
  // Older automatic runs used the datastore order and did not persist a snapshot.
  // They remain usable for auto mode; public-web mode must start safely at zero.
  return sourceMode === "auto" && (run.log_json?.keyword_order_version == null || run.log_json?.keyword_order_version === DATASTORE_SOURCING_KEYWORD_ORDER_VERSION);
}

function hasActiveKeywordCreatedAfter(
  activeKeywords: ReadonlyArray<Pick<SourcingKeyword, "created_at">>,
  referenceRun: SourcingRun | null | undefined
) {
  const referenceTimestamp = getRunReferenceTimestamp(referenceRun);
  if (referenceTimestamp == null || !Array.isArray(activeKeywords)) return null;

  const createdTimestamps: number[] = [];
  for (const keyword of activeKeywords) {
    if (!keyword || typeof keyword !== "object") return null;
    const createdTimestamp = parseTimestamp(keyword.created_at);
    if (createdTimestamp == null) return null;
    createdTimestamps.push(createdTimestamp);
  }

  return createdTimestamps.some((createdTimestamp) => createdTimestamp > referenceTimestamp);
}

function getNumericFallbackOffset(runs: SourcingRun[], sourceMode: SourcingMode) {
  for (const run of runs) {
    if (!isSourcingExecutionRun(run)) continue;
    if (!isCursorCompatibleRun(run, sourceMode)) continue;
    const offset = getRunNextKeywordOffset(run);
    if (offset != null) return offset;
  }
  return 0;
}

export async function getNextSourcingKeywordOffset(sourceMode: SourcingMode = "auto", limit = 10) {
  const executionRuns = await listSourcingExecutionRuns(limit);
  const numericFallbackOffset = getNumericFallbackOffset(executionRuns, sourceMode);
  const latestRun = executionRuns.find((run) => isSourcingExecutionRun(run) && isCursorCompatibleRun(run, sourceMode));
  const latestOffset = getRunNextKeywordOffset(latestRun);

  if (latestOffset == null || !latestRun) return numericFallbackOffset;

  let activeKeywords: SourcingKeyword[];
  try {
    activeKeywords = await listKeywords({ activeOnly: true });
  } catch {
    return numericFallbackOffset;
  }

  if (getRunKeywordOrderSnapshot(latestRun) != null) {
    if (getSourcingKeywordOrderSnapshot(activeKeywords, sourceMode) !== getRunKeywordOrderSnapshot(latestRun)) return 0;
  } else if (sourceMode === "public_web_only") {
    return 0;
  }
  if (hasActiveKeywordCreatedAfter(activeKeywords, latestRun) === true) return 0;
  return latestOffset;
}
