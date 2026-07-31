#!/usr/bin/env node

import { isPublicWebHostname, safeAllowlistedPublicUrl } from "../lib/publicWebUrlSafety.ts";

const allowedHosts = new Set(["returns.example.com", "shop.example.com"]);
const pageUrl = new URL("https://returns.example.com/search?q=vacuum");

const cases = [
  ["relative product URL", "/products/123", "https://returns.example.com/products/123"],
  ["explicit allowlisted host", "https://shop.example.com/deals/456", "https://shop.example.com/deals/456"],
  ["off-allowlist host", "https://tracking.example.net/click/123", null],
  ["unlisted subdomain", "https://cdn.returns.example.com/products/123", null],
  ["credential-bearing URL", "https://user:pass@returns.example.com/products/123", null],
  ["non-http URL", "javascript:alert(1)", null],
  ["loopback URL", "http://127.0.0.1/products/123", null]
];

for (const [name, value, expected] of cases) {
  const actual = safeAllowlistedPublicUrl(value, pageUrl, allowedHosts)?.toString() ?? null;
  if (actual !== expected) {
    throw new Error(`${name}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

if (!isPublicWebHostname("returns.example.com") || isPublicWebHostname("localhost")) {
  throw new Error("public hostname validation contract failed");
}

console.log(`Public web URL safety checks passed: ${cases.length} allowlist and URL boundary cases.`);
