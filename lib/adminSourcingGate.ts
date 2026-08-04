export type SourcingGateReadiness = {
  apiKeysReady: boolean;
  runtimeReady: boolean;
  items: ReadonlyArray<{ id: string; state: string }>;
};

export type SourcingGateOptions = {
  isProduction: boolean;
  loading: boolean;
  hasError: boolean;
};

export type SourcingGateState = {
  publicWebOnly: boolean;
  blockedInProduction: boolean;
  disabled: boolean;
  phase: "loading" | "error" | "blocked" | "public_web" | "ready";
};

function hasReadyPublicWeb(readiness: SourcingGateReadiness | null) {
  return Boolean(readiness?.items.some((item) => item.id === "public_web" && item.state === "ready"));
}

export function getSourcingGateState(readiness: SourcingGateReadiness | null, options: SourcingGateOptions): SourcingGateState {
  const publicWebOnly = Boolean(readiness && !readiness.apiKeysReady && readiness.runtimeReady && hasReadyPublicWeb(readiness));
  const blockedInProduction = Boolean(readiness && options.isProduction && !readiness.apiKeysReady && !publicWebOnly);
  const disabled = options.loading || options.hasError || !readiness || blockedInProduction;
  const phase = options.loading
    ? "loading"
    : options.hasError || !readiness
      ? "error"
      : blockedInProduction
        ? "blocked"
        : publicWebOnly
          ? "public_web"
          : "ready";

  return { publicWebOnly, blockedInProduction, disabled, phase };
}
