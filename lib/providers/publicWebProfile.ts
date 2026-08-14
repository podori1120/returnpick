export const ALGUMON_DISCOVERY_PROFILE_ID = "algumon_discovery_v1";
export const ALGUMON_DISCOVERY_HOST = "www.algumon.com";
export const ALGUMON_DISCOVERY_SEARCH_TEMPLATE = "https://www.algumon.com/n/deal?keyword={keyword}";
export const HOTDEALS_DISCOVERY_PROFILE_ID = "hotdeals_discovery_v2";
export const HOTDEALS_DISCOVERY_HOST = "www.hotdeals.kr";
export const HOTDEALS_DISCOVERY_SEARCH_TEMPLATE = "https://www.hotdeals.kr/deals/k/{keyword}";
export const ALGUMON_HOTDEALS_DISCOVERY_PROFILE_ID = "algumon_hotdeals_discovery_v1";
export const ALGUMON_HOTDEALS_DISCOVERY_HOSTS = [ALGUMON_DISCOVERY_HOST, HOTDEALS_DISCOVERY_HOST] as const;
export const ALGUMON_HOTDEALS_DISCOVERY_SEARCH_TEMPLATES = [
  ALGUMON_DISCOVERY_SEARCH_TEMPLATE,
  HOTDEALS_DISCOVERY_SEARCH_TEMPLATE
] as const;

export type PublicWebRuntimeProfile = {
  id:
    | typeof ALGUMON_DISCOVERY_PROFILE_ID
    | typeof HOTDEALS_DISCOVERY_PROFILE_ID
    | typeof ALGUMON_HOTDEALS_DISCOVERY_PROFILE_ID
    | "custom"
    | "disabled";
  enabled: boolean;
  exactMatch: boolean;
  hostCount: number;
  templateCount: number;
};

type PublicWebProfileEnv = {
  PUBLIC_WEB_CRAWL_ENABLED?: string;
  PUBLIC_WEB_ALLOWED_HOSTS?: string;
  PUBLIC_WEB_SEARCH_TEMPLATES?: string;
};

function splitProfileList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasEmptyProfileListItem(value: string | undefined) {
  return value != null && value.trim() !== "" && value.split(",").some((item) => !item.trim());
}

function matchesExactList(actual: string[], expected: readonly string[]) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

export function getPublicWebRuntimeProfile(
  env: PublicWebProfileEnv = {
    PUBLIC_WEB_CRAWL_ENABLED: process.env.PUBLIC_WEB_CRAWL_ENABLED,
    PUBLIC_WEB_ALLOWED_HOSTS: process.env.PUBLIC_WEB_ALLOWED_HOSTS,
    PUBLIC_WEB_SEARCH_TEMPLATES: process.env.PUBLIC_WEB_SEARCH_TEMPLATES
  }
): PublicWebRuntimeProfile {
  const enabled = env.PUBLIC_WEB_CRAWL_ENABLED === "true";
  const hosts = splitProfileList(env.PUBLIC_WEB_ALLOWED_HOSTS).map((host) => host.toLowerCase());
  const templates = splitProfileList(env.PUBLIC_WEB_SEARCH_TEMPLATES);
  const isAlgumonExactMatch =
    enabled &&
    !hasEmptyProfileListItem(env.PUBLIC_WEB_ALLOWED_HOSTS) &&
    !hasEmptyProfileListItem(env.PUBLIC_WEB_SEARCH_TEMPLATES) &&
    hosts.length === 1 &&
    templates.length === 1 &&
    hosts[0] === ALGUMON_DISCOVERY_HOST &&
    templates[0] === ALGUMON_DISCOVERY_SEARCH_TEMPLATE;
  const isHotDealsExactMatch =
    enabled &&
    !hasEmptyProfileListItem(env.PUBLIC_WEB_ALLOWED_HOSTS) &&
    !hasEmptyProfileListItem(env.PUBLIC_WEB_SEARCH_TEMPLATES) &&
    hosts.length === 1 &&
    templates.length === 1 &&
    hosts[0] === HOTDEALS_DISCOVERY_HOST &&
    templates[0] === HOTDEALS_DISCOVERY_SEARCH_TEMPLATE;
  const isAlgumonHotDealsExactMatch =
    enabled &&
    !hasEmptyProfileListItem(env.PUBLIC_WEB_ALLOWED_HOSTS) &&
    !hasEmptyProfileListItem(env.PUBLIC_WEB_SEARCH_TEMPLATES) &&
    matchesExactList(hosts, ALGUMON_HOTDEALS_DISCOVERY_HOSTS) &&
    matchesExactList(templates, ALGUMON_HOTDEALS_DISCOVERY_SEARCH_TEMPLATES);
  const exactMatch = isAlgumonExactMatch || isHotDealsExactMatch || isAlgumonHotDealsExactMatch;

  return {
    id: isAlgumonExactMatch
      ? ALGUMON_DISCOVERY_PROFILE_ID
      : isHotDealsExactMatch
        ? HOTDEALS_DISCOVERY_PROFILE_ID
        : isAlgumonHotDealsExactMatch
          ? ALGUMON_HOTDEALS_DISCOVERY_PROFILE_ID
          : enabled
            ? "custom"
            : "disabled",
    enabled,
    exactMatch,
    hostCount: hosts.length,
    templateCount: templates.length
  };
}

export function matchesRequiredPublicWebProfile(requiredProfile: unknown, profile = getPublicWebRuntimeProfile()) {
  if (typeof requiredProfile !== "string" || !requiredProfile.trim()) return false;
  const recognizedProfiles = new Set<string>([
    ALGUMON_DISCOVERY_PROFILE_ID,
    HOTDEALS_DISCOVERY_PROFILE_ID,
    ALGUMON_HOTDEALS_DISCOVERY_PROFILE_ID
  ]);
  return profile.enabled && profile.exactMatch && recognizedProfiles.has(requiredProfile) && requiredProfile === profile.id;
}
