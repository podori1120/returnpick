import type { SourcingRun } from "@/lib/types";

export const FIRST_LAUNCH_CONFIRMED_STATUS = "launch_confirmed";
export const FIRST_LAUNCH_MARKER = "post_approval_first_launch";

export function isFirstLaunchConfirmationRun(run: SourcingRun | null | undefined) {
  return run?.status === FIRST_LAUNCH_CONFIRMED_STATUS && run.log_json?.kind === FIRST_LAUNCH_MARKER;
}

export function isSourcingExecutionRun(run: SourcingRun | null | undefined) {
  if (!run) return false;
  return !isFirstLaunchConfirmationRun(run);
}
