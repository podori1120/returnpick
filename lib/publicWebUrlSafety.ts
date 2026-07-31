export function isPublicWebHostname(hostname: string) {
  const value = hostname.trim().toLowerCase();
  if (!value) return false;
  if (value === "localhost" || value === "127.0.0.1" || value === "0.0.0.0" || value === "::1" || value.endsWith(".local")) return false;
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/.test(value);
}

export function safeAllowlistedPublicUrl(value: string, baseUrl: URL, allowedHosts: ReadonlySet<string>) {
  try {
    const url = new URL(value, baseUrl);
    const hostname = url.hostname.toLowerCase();
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    if (!isPublicWebHostname(hostname)) return null;
    if (!allowedHosts.has(hostname)) return null;
    return url;
  } catch {
    return null;
  }
}
