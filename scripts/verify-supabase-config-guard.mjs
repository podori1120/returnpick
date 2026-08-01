#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  getSupabaseBrowserClient,
  getSupabaseServiceClient,
  hasSupabaseConfig
} from "../lib/supabase.ts";

const envNames = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
const original = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));

function setEnv(values) {
  for (const name of envNames) {
    if (Object.prototype.hasOwnProperty.call(values, name)) process.env[name] = values[name];
    else delete process.env[name];
  }
}

function assertNotConfigured(values, label, { expectBrowser = false, expectService = false } = {}) {
  setEnv(values);
  assert.equal(hasSupabaseConfig(), false, `${label}: config must be rejected`);
  assert.equal(getSupabaseBrowserClient() === null, !expectBrowser, `${label}: browser client state`);
  assert.equal(getSupabaseServiceClient() === null, !expectService, `${label}: service client state`);
}

assertNotConfigured({}, "missing values");
assertNotConfigured(
  {
    NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "a".repeat(80),
    SUPABASE_SERVICE_ROLE_KEY: "b".repeat(80)
  },
  "invalid URL"
);
assertNotConfigured(
  {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "short",
    SUPABASE_SERVICE_ROLE_KEY: "short"
  },
  "short anon key"
);
assertNotConfigured(
  {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "a".repeat(80),
    SUPABASE_SERVICE_ROLE_KEY: "[SENSITIVE]"
  },
  "masked service key",
  { expectBrowser: true }
);

for (const [name, value] of Object.entries(original)) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

console.log("Supabase config guard checks passed: missing, invalid, short, and masked values stay in safe local mode.");
