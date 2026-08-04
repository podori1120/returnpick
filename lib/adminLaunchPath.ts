export type AdminStorageStatus = "verified" | "unconfigured" | "unverified";

export type AdminLaunchPathInput = {
  readinessKnown: boolean;
  launchReady: boolean;
  catalogLaunchReady: boolean;
  storageStatus: AdminStorageStatus | null;
};

export type AdminLaunchPath = {
  mode: "unknown" | "persistent" | "temporary" | "recovery";
  anchor: "admin-api-readiness" | "admin-first-launch" | "admin-bootstrap-catalog";
  label: "설정 보강" | "첫 가동" | "카탈로그 공개" | "임시 카탈로그 입력" | "저장소 확인";
};

export function isAdminStorageStatus(value: unknown): value is AdminStorageStatus {
  return value === "verified" || value === "unconfigured" || value === "unverified";
}

export function getAdminLaunchPath(input: AdminLaunchPathInput): AdminLaunchPath {
  if (!input.readinessKnown || !isAdminStorageStatus(input.storageStatus)) {
    return { mode: "unknown", anchor: "admin-api-readiness", label: "설정 보강" };
  }

  if (input.storageStatus === "unverified") {
    return { mode: "recovery", anchor: "admin-api-readiness", label: "저장소 확인" };
  }

  if (input.storageStatus === "unconfigured") {
    return {
      mode: "temporary",
      anchor: "admin-bootstrap-catalog",
      label: input.catalogLaunchReady ? "카탈로그 공개" : "임시 카탈로그 입력"
    };
  }

  if (input.launchReady) {
    return { mode: "persistent", anchor: "admin-first-launch", label: "첫 가동" };
  }

  return { mode: "persistent", anchor: "admin-api-readiness", label: "설정 보강" };
}
