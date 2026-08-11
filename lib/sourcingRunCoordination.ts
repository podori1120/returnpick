import { createHash } from "node:crypto";

// The production sourcing budget is capped below one minute. Keep the
// idempotency window comfortably above that budget so an invocation started at
// the end of a slot cannot immediately start a second run in the next slot.
export const SOURCING_RUN_COORDINATION_WINDOW_MS = 120_000;
export const SOURCING_RUN_COORDINATION_ACTIVE_MAX_AGE_MS = 300_000;
const SOURCING_RUN_COORDINATION_VERSION = "v1";

export type CoordinatedSourcingMode = "auto" | "public_web_only";

export type CoordinatedSourcingRunLike = {
  status: string;
  started_at?: string | null;
  log_json?: unknown;
};

export function getCoordinatedSourceMode(logJson: unknown): CoordinatedSourcingMode | null {
  if (!logJson || typeof logJson !== "object" || Array.isArray(logJson)) return null;
  const sourceMode = (logJson as { source_mode?: unknown }).source_mode;
  return sourceMode === "auto" || sourceMode === "public_web_only" ? sourceMode : null;
}

export function isCoordinatedActiveRun(
  run: CoordinatedSourcingRunLike,
  sourceMode: CoordinatedSourcingMode | null,
  nowMs = Date.now()
) {
  if (run.status !== "running") return false;

  const startedAt = typeof run.started_at === "string" ? Date.parse(run.started_at) : Number.NaN;
  if (!Number.isFinite(startedAt)) return true;

  const safeNowMs = Number.isFinite(nowMs) ? nowMs : Date.now();
  if (Math.abs(safeNowMs - startedAt) >= SOURCING_RUN_COORDINATION_ACTIVE_MAX_AGE_MS) return false;

  const existingMode = getCoordinatedSourceMode(run.log_json);
  // Unknown-mode legacy runs are treated conservatively as a conflict. New
  // coordinated runs persist their mode in the sanitized log JSON.
  return existingMode == null || sourceMode == null || existingMode === sourceMode;
}

export function findCoordinatedActiveRun<T extends CoordinatedSourcingRunLike>(
  runs: readonly T[],
  sourceMode: CoordinatedSourcingMode | null,
  nowMs = Date.now()
) {
  return runs.find((run) => isCoordinatedActiveRun(run, sourceMode, nowMs)) ?? null;
}

export type SourcingRunExecutionWindow = {
  executionKey: string;
  sourceMode: CoordinatedSourcingMode;
  executionSlot: string;
  windowStart: string;
  windowEnd: string;
};

function uuidFromDigest(input: string) {
  const bytes = Uint8Array.from(createHash("sha256").update(input).digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getSourcingRunExecutionWindow(
  sourceMode: CoordinatedSourcingMode,
  nowMs = Date.now(),
  executionSlot: string | number = "default"
): SourcingRunExecutionWindow {
  const safeNowMs = Number.isFinite(nowMs) ? nowMs : Date.now();
  const windowStartMs = Math.floor(safeNowMs / SOURCING_RUN_COORDINATION_WINDOW_MS) * SOURCING_RUN_COORDINATION_WINDOW_MS;
  const windowEndMs = windowStartMs + SOURCING_RUN_COORDINATION_WINDOW_MS;
  const normalizedSlot = String(executionSlot).trim().slice(0, 80) || "default";
  const executionKey = uuidFromDigest(
    `returnpick:sourcing:${SOURCING_RUN_COORDINATION_VERSION}:${sourceMode}:${windowStartMs}:${normalizedSlot}`
  );

  return {
    executionKey,
    sourceMode,
    executionSlot: normalizedSlot,
    windowStart: new Date(windowStartMs).toISOString(),
    windowEnd: new Date(windowEndMs).toISOString()
  };
}

export function getSourcingRunExecutionLog(window: SourcingRunExecutionWindow) {
  return {
    coordination: "server_derived_window_v1",
    execution_key: window.executionKey,
    execution_slot: window.executionSlot,
    execution_window_start: window.windowStart,
    execution_window_end: window.windowEnd,
    source_mode: window.sourceMode
  } as const;
}
