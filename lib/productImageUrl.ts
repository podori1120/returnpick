export type ProductImageUrlIssue =
  | "IMAGE_URL_REQUIRED"
  | "IMAGE_URL_TOO_LONG"
  | "IMAGE_URL_HTTPS_REQUIRED"
  | "IMAGE_URL_PUBLIC_HOST_REQUIRED"
  | "IMAGE_URL_CREDENTIALS_OR_PORT_NOT_ALLOWED";

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
    return null;
  } catch {
    return "IMAGE_URL_HTTPS_REQUIRED";
  }
}

export function isUsableProductImageUrl(value: string | null | undefined) {
  return getProductImageUrlIssue(value) === null;
}
