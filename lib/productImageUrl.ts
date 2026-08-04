export type ProductImageUrlIssue =
  | "IMAGE_URL_REQUIRED"
  | "IMAGE_URL_TOO_LONG"
  | "IMAGE_URL_HTTPS_REQUIRED"
  | "IMAGE_URL_PUBLIC_HOST_REQUIRED"
  | "IMAGE_URL_CREDENTIALS_OR_PORT_NOT_ALLOWED"
  | "IMAGE_HOST_NOT_ALLOWED";

const navigationHosts = new Set(["coupang.com", "www.coupang.com", "link.coupang.com", "partners.coupang.com"]);

function isHostOrSubdomain(hostname: string, baseHost: string) {
  return hostname === baseHost || hostname.endsWith(`.${baseHost}`);
}

function isAllowlistedManualImageHost(hostname: string) {
  return (
    isHostOrSubdomain(hostname, "coupangcdn.com") ||
    hostname === "image.coupang.com" ||
    hostname === "img.coupang.com" ||
    hostname === "thumbnail.coupang.com" ||
    isHostOrSubdomain(hostname, "pstatic.net")
  );
}

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPublicHostname(hostname: string) {
  const host = hostname.trim().toLowerCase();
  if (!host || !host.includes(".") || host.includes(":")) return false;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".lan")) {
    return false;
  }
  return !isPrivateIpv4(host);
}

export function getProductImageUrlIssue(value: string | null | undefined): ProductImageUrlIssue | null {
  const raw = value?.trim() ?? "";
  if (!raw) return "IMAGE_URL_REQUIRED";
  if (raw.length > 2_000) return "IMAGE_URL_TOO_LONG";

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return "IMAGE_URL_HTTPS_REQUIRED";
    if (url.username || url.password || url.port) return "IMAGE_URL_CREDENTIALS_OR_PORT_NOT_ALLOWED";
    if (!isPublicHostname(url.hostname)) return "IMAGE_URL_PUBLIC_HOST_REQUIRED";
    if (navigationHosts.has(url.hostname.toLowerCase())) return "IMAGE_HOST_NOT_ALLOWED";
    return null;
  } catch {
    return "IMAGE_URL_HTTPS_REQUIRED";
  }
}

export function isUsableProductImageUrl(value: string | null | undefined) {
  return getProductImageUrlIssue(value) === null;
}

/** Manual catalog input only accepts product image CDNs, never arbitrary navigation or affiliate destinations. */
export function isUsableManualProductImageUrl(value: string | null | undefined) {
  if (!isUsableProductImageUrl(value)) return false;
  try {
    return isAllowlistedManualImageHost(new URL(value!.trim()).hostname.toLowerCase());
  } catch {
    return false;
  }
}
