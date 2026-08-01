import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;
let serviceClient: SupabaseClient | null = null;
const placeholderEnvValues = new Set(["[sensitive]", "[redacted]", "[encrypted]", "undefined", "null"]);

function getEnvValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value || placeholderEnvValues.has(value.toLowerCase())) return null;
  return value;
}

function getSupabaseKey(name: string) {
  const value = getEnvValue(name);
  if (!value || value.length < 40 || /\s/.test(value)) return null;
  return value;
}

function getValidSupabaseUrl() {
  const value = getEnvValue("NEXT_PUBLIC_SUPABASE_URL");
  if (!value) return null;

  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) return null;
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function hasSupabaseConfig() {
  return Boolean(
    getValidSupabaseUrl() &&
      getSupabaseKey("NEXT_PUBLIC_SUPABASE_ANON_KEY") &&
      getSupabaseKey("SUPABASE_SERVICE_ROLE_KEY")
  );
}

export function getSupabaseBrowserClient() {
  const url = getValidSupabaseUrl();
  const key = getSupabaseKey("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !key) return null;
  if (!browserClient) browserClient = createClient(url, key);
  return browserClient;
}

export function getSupabaseAnonClient() {
  return getSupabaseBrowserClient();
}

export function getSupabaseServiceClient() {
  const url = getValidSupabaseUrl();
  const key = getSupabaseKey("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  if (!serviceClient) {
    serviceClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }
  return serviceClient;
}
