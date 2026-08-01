import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function loadTsModule(relativePath, aliases = {}) {
  const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const loadedModule = { exports: {} };
  const localRequire = (specifier) => aliases[specifier] ?? require(specifier);
  new Function("exports", "module", "require", output)(loadedModule.exports, loadedModule, localRequire);
  return loadedModule.exports;
}

const originalFetch = globalThis.fetch;
const originalEnv = {
  accessKey: process.env.COUPANG_ACCESS_KEY,
  secretKey: process.env.COUPANG_SECRET_KEY,
  partnerId: process.env.COUPANG_PARTNER_ID
};

process.env.COUPANG_ACCESS_KEY = "test-access-key";
process.env.COUPANG_SECRET_KEY = "test-secret-key";
process.env.COUPANG_PARTNER_ID = "test-partner";

try {
  const coupangLink = loadTsModule("lib/coupangLink.ts");
  const provider = loadTsModule("lib/providers/coupangPartnersProvider.ts", {
    "@/lib/coupangLink": coupangLink,
    crypto: { default: require("node:crypto") }
  });

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        rCode: "0",
        data: {
          result: {
            links: [{ shorten_url: "https://link.coupang.com/a/AbCd123" }]
          }
        }
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );

  const nested = await provider.createCoupangDeeplink("https://www.coupang.com/vp/products/123456");
  assert.equal(nested.status, "ok");
  assert.equal(nested.url, "https://link.coupang.com/a/AbCd123");

  delete process.env.COUPANG_ACCESS_KEY;
  delete process.env.COUPANG_SECRET_KEY;
  delete process.env.COUPANG_PARTNER_ID;
  const unavailable = await provider.createCoupangDeeplink("https://www.coupang.com/vp/products/123456");
  assert.equal(unavailable.status, "API_NOT_CONFIGURED");
} finally {
  globalThis.fetch = originalFetch;
  if (originalEnv.accessKey === undefined) delete process.env.COUPANG_ACCESS_KEY;
  else process.env.COUPANG_ACCESS_KEY = originalEnv.accessKey;
  if (originalEnv.secretKey === undefined) delete process.env.COUPANG_SECRET_KEY;
  else process.env.COUPANG_SECRET_KEY = originalEnv.secretKey;
  if (originalEnv.partnerId === undefined) delete process.env.COUPANG_PARTNER_ID;
  else process.env.COUPANG_PARTNER_ID = originalEnv.partnerId;
}

console.log("Coupang provider checks passed: nested deeplink response normalization and API-not-configured behavior.");
