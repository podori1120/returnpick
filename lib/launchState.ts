import { createSourcingRun, getLatestSourcingRunByStatus } from "@/lib/dataStore";
import { FIRST_LAUNCH_CONFIRMED_STATUS, FIRST_LAUNCH_MARKER, isFirstLaunchConfirmationRun } from "@/lib/sourcingRunKinds";
import type { JsonValue } from "@/lib/types";

function now() {
  return new Date().toISOString();
}

export async function getFirstLaunchConfirmation() {
  const run = await getLatestSourcingRunByStatus(FIRST_LAUNCH_CONFIRMED_STATUS);
  return isFirstLaunchConfirmationRun(run) ? run : null;
}

export async function markFirstLaunchConfirmed(input: {
  summary?: Record<string, JsonValue>;
  delta_summary?: Record<string, JsonValue>;
  launch_data_signal?: JsonValue;
  connection_check_ids?: string[];
}) {
  const stamp = now();
  return createSourcingRun({
    status: FIRST_LAUNCH_CONFIRMED_STATUS,
    started_at: stamp,
    finished_at: stamp,
    log_json: {
      kind: FIRST_LAUNCH_MARKER,
      confirmed_at: stamp,
      summary: input.summary ?? {},
      delta_summary: input.delta_summary ?? {},
      launch_data_signal: input.launch_data_signal ?? {},
      connection_check_ids: input.connection_check_ids ?? []
    }
  });
}
