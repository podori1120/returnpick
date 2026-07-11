import { existsSync, readFileSync } from "node:fs";

export const defaultEnvFiles = [".env.production", ".env.local", ".env"];

const envFileCache = new Map();
const rawEnvFileCache = new Map();

export function parseEnvFile(file) {
  if (!existsSync(file)) return {};

  const values = {};
  for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 0) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    values[key] = value;
  }

  return values;
}

export function parseRawEnvFile(file) {
  if (!existsSync(file)) return {};

  const values = {};
  for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmedLine = rawLine.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) continue;
    const index = rawLine.indexOf("=");
    if (index < 0) continue;
    const key = rawLine.slice(0, index).trim();
    values[key] = rawLine.slice(index + 1);
  }

  return values;
}

function envFileValues(file) {
  if (!envFileCache.has(file)) {
    envFileCache.set(file, parseEnvFile(file));
  }

  return envFileCache.get(file) ?? {};
}

function rawEnvFileValues(file) {
  if (!rawEnvFileCache.has(file)) {
    rawEnvFileCache.set(file, parseRawEnvFile(file));
  }

  return rawEnvFileCache.get(file) ?? {};
}

export function loadEnvFiles(options = {}) {
  const files = options.files ?? defaultEnvFiles;
  const override = Boolean(options.override);
  const loaded = [];

  for (const file of files) {
    if (!existsSync(file)) continue;
    const values = envFileValues(file);
    loaded.push(file);

    for (const [key, value] of Object.entries(values)) {
      const trimmed = String(value ?? "").trim();
      if (!trimmed) continue;
      if (override || !String(process.env[key] ?? "").trim()) {
        process.env[key] = trimmed;
      }
    }
  }

  return loaded;
}

export function envValue(names) {
  const keys = Array.isArray(names) ? names : [names];

  for (const key of keys) {
    const value = String(process.env[key] ?? "").trim();
    if (value) return value;
  }

  return "";
}

export function envRawEntries(names, options = {}) {
  const keys = Array.isArray(names) ? names : [names];
  const files = options.files ?? defaultEnvFiles;
  const entries = [];

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(process.env, key)) {
      entries.push({ key, source: `${key} in process env`, value: String(process.env[key] ?? "") });
    }
  }

  for (const file of files) {
    const values = rawEnvFileValues(file);
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        entries.push({ key, source: `${key} in ${file}`, value: String(values[key] ?? "") });
      }
    }
  }

  return entries;
}

export function envSource(names, options = {}) {
  const keys = Array.isArray(names) ? names : [names];
  const files = options.files ?? defaultEnvFiles;

  for (const key of keys) {
    const value = String(process.env[key] ?? "").trim();
    if (value) return `${key} in process env`;
  }

  for (const file of files) {
    const values = envFileValues(file);
    for (const key of keys) {
      const value = String(values[key] ?? "").trim();
      if (value) return `${key} in ${file}`;
    }
  }

  return "";
}

export function blankEnvSources(names, options = {}) {
  const keys = Array.isArray(names) ? names : [names];
  const files = options.files ?? defaultEnvFiles;
  const sources = [];

  for (const file of files) {
    const values = envFileValues(file);
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(values, key) && !String(values[key] ?? "").trim()) {
        sources.push(`${key} in ${file}`);
      }
    }
  }

  return sources;
}
