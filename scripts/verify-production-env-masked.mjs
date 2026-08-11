#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const checker = join(root, "scripts", "verify-production-env.mjs");
const tempRoot = await mkdtemp(join(tmpdir(), "returnpick-env-mask-"));

const requiredNames = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL",
  "ADMIN_PASSWORD",
  "CRON_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
];

const baseValues = {
  NEXT_PUBLIC_SITE_URL: "https://returnpick.example",
  NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL: "https://link.coupang.com/a/abcdef",
  ADMIN_PASSWORD: "AdminPassphrase123",
  CRON_SECRET: "cron-secret-123456789",
  NEXT_PUBLIC_SUPABASE_URL: "https://returnpick.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "a".repeat(48),
  SUPABASE_SERVICE_ROLE_KEY: "b".repeat(48),
  PUBLIC_WEB_CRAWL_ENABLED: "false"
};

const childEnv = { ...process.env };
for (const name of [
  ...requiredNames,
  "PUBLIC_WEB_CRAWL_ENABLED",
  "PUBLIC_WEB_ALLOWED_HOSTS",
  "PUBLIC_WEB_SEARCH_TEMPLATES",
  "RETURNPICK_BOOTSTRAP_CATALOG_JSON"
]) {
  delete childEnv[name];
}

function fixture(values, { localValues = null } = {}) {
  const lines = Object.entries(values).map(([name, value]) => `${name}=${value}`);
  return {
    production: `${lines.join("\n")}\n`,
    local: localValues ? `${Object.entries(localValues).map(([name, value]) => `${name}=${value}`).join("\n")}\n` : null
  };
}

async function writeFixture(values, options = {}) {
  const files = fixture(values, options);
  await writeFile(join(tempRoot, ".env.production"), files.production, "utf8");
  if (files.local == null) {
    await rm(join(tempRoot, ".env.local"), { force: true });
  } else {
    await writeFile(join(tempRoot, ".env.local"), files.local, "utf8");
  }
}

function runChecker(extraArgs) {
  const result = spawnSync(process.execPath, [checker, "--launch", ...extraArgs], {
    cwd: tempRoot,
    env: childEnv,
    encoding: "utf8",
    windowsHide: true
  });
  return {
    status: result.status ?? 1,
    output: `${result.stdout ?? ""}\n${result.stderr ?? ""}`
  };
}

function assertNoFixtureSecrets(output) {
  assert(!output.includes(baseValues.ADMIN_PASSWORD), "checker output must not expose fixture secrets");
  assert(!output.includes(baseValues.NEXT_PUBLIC_SUPABASE_ANON_KEY), "checker output must not expose key fixture values");
  assert(!output.includes(baseValues.SUPABASE_SERVICE_ROLE_KEY), "checker output must not expose service fixture values");
}

try {
  await writeFixture({
    ...baseValues,
    NEXT_PUBLIC_SUPABASE_URL: '"[SENSITIVE]"',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: '"[REDACTED]"',
    SUPABASE_SERVICE_ROLE_KEY: '"[ENCRYPTED]"'
  });

  const strictMasked = runChecker([]);
  assert.notEqual(strictMasked.status, 0, "strict launch mode must reject masked required values");
  assert.match(strictMasked.output, /FAIL NEXT_PUBLIC_SUPABASE_URL/);
  assertNoFixtureSecrets(strictMasked.output);

  const allowedMasked = runChecker(["--allow-vercel-masked"]);
  assert.equal(allowedMasked.status, 0, "explicit masked mode should allow only Vercel-masked production values");
  assert.match(allowedMasked.output, /WARN NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(allowedMasked.output, /WARN SUPABASE_KEYS_DIFFER/);
  assertNoFixtureSecrets(allowedMasked.output);

  await writeFixture({
    ...baseValues,
    NEXT_PUBLIC_SUPABASE_URL: "[SENSITIVE]",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "[REDACTED]",
    SUPABASE_SERVICE_ROLE_KEY: "[ENCRYPTED]"
  });
  const unquotedMasked = runChecker(["--allow-vercel-masked"]);
  assert.notEqual(unquotedMasked.status, 0, "unquoted mask markers must not bypass production validation");
  assert.match(unquotedMasked.output, /FAIL NEXT_PUBLIC_SUPABASE_URL/);
  assertNoFixtureSecrets(unquotedMasked.output);

  await writeFixture({
    ...baseValues,
    NEXT_PUBLIC_SUPABASE_URL: "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: '"[SENSITIVE]"',
    SUPABASE_SERVICE_ROLE_KEY: '"[SENSITIVE]"'
  });
  const blankValue = runChecker(["--allow-vercel-masked"]);
  assert.notEqual(blankValue.status, 0, "explicit masked mode must still reject blank production values");
  assert.match(blankValue.output, /FAIL NEXT_PUBLIC_SUPABASE_URL/);
  assertNoFixtureSecrets(blankValue.output);

  await writeFixture({
    ...baseValues,
    NEXT_PUBLIC_SUPABASE_URL: "not-a-public-url",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: '"[SENSITIVE]"',
    SUPABASE_SERVICE_ROLE_KEY: '"[SENSITIVE]"'
  });
  const invalidValue = runChecker(["--allow-vercel-masked"]);
  assert.notEqual(invalidValue.status, 0, "explicit masked mode must still reject invalid production values");
  assert.match(invalidValue.output, /FAIL NEXT_PUBLIC_SUPABASE_URL/);
  assertNoFixtureSecrets(invalidValue.output);

  await writeFixture(
    {
      ...baseValues,
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: '"[SENSITIVE]"',
      SUPABASE_SERVICE_ROLE_KEY: '"[SENSITIVE]"'
    },
    { localValues: { NEXT_PUBLIC_SUPABASE_URL: '"[SENSITIVE]"' } }
  );
  const localOnlyMask = runChecker(["--allow-vercel-masked"]);
  assert.notEqual(localOnlyMask.status, 0, "a local-only mask must not prove a production value");
  assert.match(localOnlyMask.output, /FAIL NEXT_PUBLIC_SUPABASE_URL/);
  assertNoFixtureSecrets(localOnlyMask.output);

  const deploySource = await readFile(join(root, "scripts", "run-production-deploy.mjs"), "utf8");
  const doctorSource = await readFile(join(root, "scripts", "run-production-doctor.mjs"), "utf8");
  assert.match(deploySource, /verify-production-env\.mjs", "--launch", "--allow-vercel-masked"/);
  assert.match(deploySource, /run-production-doctor\.mjs", "--launch", "--allow-vercel-masked"/);
  assert.match(doctorSource, /allowVercelMasked/);
  assert.match(doctorSource, /envArgs\.push\("--allow-vercel-masked"\)/);
  assert.match(doctorSource, /schemaValuesMasked/);
  assert.match(doctorSource, /SQL schema verification needs a trusted environment/);
  console.log("Production env masked-value guard checks passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
