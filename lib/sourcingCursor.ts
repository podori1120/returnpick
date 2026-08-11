import { listKeywords, listSourcingExecutionRuns } from "@/lib/dataStore";
import { isSourcingExecutionRun } from "@/lib/sourcingRunKinds";
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

function getNumericFallbackOffset(runs: SourcingRun[]) {
  for (const run of runs) {
    if (!isSourcingExecutionRun(run)) continue;
    const offset = getRunNextKeywordOffset(run);
    if (offset != null) return offset;
  }
  return 0;
}

export async function getNextSourcingKeywordOffset(limit = 10) {
  const executionRuns = await listSourcingExecutionRuns(limit);
  const numericFallbackOffset = getNumericFallbackOffset(executionRuns);
  const latestRun = executionRuns[0];
  const latestOffset = getRunNextKeywordOffset(latestRun);

  if (latestOffset == null || !latestRun) return numericFallbackOffset;

  let activeKeywords: SourcingKeyword[];
  try {
    activeKeywords = await listKeywords({ activeOnly: true });
  } catch {
    return numericFallbackOffset;
  }

  if (hasActiveKeywordCreatedAfter(activeKeywords, latestRun) === true) return 0;
  return latestOffset;
}
