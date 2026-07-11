import { listSourcingRuns } from "@/lib/dataStore";
import { isSourcingExecutionRun } from "@/lib/sourcingRunKinds";
import type { JsonValue, SourcingRun } from "@/lib/types";

export function numberFromRunLog(value: JsonValue | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function getRunNextKeywordOffset(run: SourcingRun | null | undefined) {
  return numberFromRunLog(run?.log_json?.next_keyword_offset);
}

export async function getNextSourcingKeywordOffset(limit = 10) {
  const runs = await listSourcingRuns(limit);
  for (const run of runs) {
    if (!isSourcingExecutionRun(run)) continue;
    const offset = getRunNextKeywordOffset(run);
    if (offset != null) return offset;
  }
  return 0;
}
