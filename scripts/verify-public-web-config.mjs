#!/usr/bin/env node

import { envValue, loadEnvFiles } from "./load-env-files.mjs";

loadEnvFiles();

const MAX_PUBLIC_WEB_ALLOWED_HOSTS = 5;
const MAX_PUBLIC_WEB_SEARCH_TEMPLATES = 5;
const MAX_SUPPORTED_CRAWL_DELAY_SECONDS = 10;
const MAX_ROBOTS_BYTES = 250_000;
const SAMPLE_KEYWORD = "returnpick-test";

const results = [];

function add(status, name, detail) {
  results.push({ status, name, detail });
}

function splitList(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isPublicHostname(host) {
  const raw = host.trim().toLowerCase();
  if (!raw) return false;
  if (raw.includes("://") || raw.includes("/") || raw.includes("?") || raw.includes("#")) return false;
  if (raw === "*" || raw.includes("*")) return false;
  if (raw === "localhost" || raw === "127.0.0.1" || raw === "0.0.0.0" || raw === "::1" || raw.endsWith(".local")) return false;
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/.test(raw);
}

function safeTemplateUrl(template) {
  if (!template.includes("{keyword}")) return null;
  try {
    const url = new URL(template.replace("{keyword}", encodeURIComponent(SAMPLE_KEYWORD)));
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    if (!isPublicHostname(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url, init, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function readTextWithLimit(response, maxBytes) {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { status: "CONTENT_TOO_LARGE", text: null, error: `CONTENT_LENGTH_${declaredLength}` };
  }

  if (!response.body) {
    const text = await response.text();
    const byteLength = new TextEncoder().encode(text).byteLength;
    if (byteLength > maxBytes) return { status: "CONTENT_TOO_LARGE", text: null, error: `CONTENT_BYTES_${byteLength}` };
    return { status: "ok", text };
  }

  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return { status: "CONTENT_TOO_LARGE", text: null, error: `CONTENT_BYTES_${received}` };
    }
    chunks.push(value);
  }

  const body = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { status: "ok", text: new TextDecoder().decode(body) };
}

function parseCrawlDelaySeconds(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseRobotsGroups(robots) {
  const lines = robots
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, "").trim())
    .filter(Boolean);
  const groups = [];
  let current = { agents: [], rules: [], crawlDelaySeconds: null };

  for (const line of lines) {
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (key === "user-agent") {
      if ((current.rules.length || current.crawlDelaySeconds != null) && current.agents.length) {
        groups.push(current);
        current = { agents: [], rules: [], crawlDelaySeconds: null };
      }
      if (value) current.agents.push(value.toLowerCase());
      continue;
    }

    if ((key === "allow" || key === "disallow") && current.agents.length) {
      current.rules.push({ type: key, path: value });
      continue;
    }

    if (key === "crawl-delay" && current.agents.length) {
      current.crawlDelaySeconds = parseCrawlDelaySeconds(value);
    }
  }

  if (current.agents.length) groups.push(current);
  return groups;
}

function selectRobotsGroup(groups, userAgent) {
  const ua = userAgent.toLowerCase();
  const specific = groups
    .flatMap((group) =>
      group.agents
        .filter((agent) => agent !== "*" && ua.startsWith(agent))
        .map((agent) => ({ group, agent }))
    )
    .sort((a, b) => b.agent.length - a.agent.length)[0]?.group;
  return specific ?? groups.find((group) => group.agents.includes("*")) ?? null;
}

function pathMatches(rule, pathname) {
  if (!rule) return false;
  const hasEndAnchor = rule.endsWith("$");
  const pattern = hasEndAnchor ? rule.slice(0, -1) : rule;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}${hasEndAnchor ? "$" : ""}`).test(pathname);
}

function robotsAllowsPath(robots, pathname, userAgent) {
  const group = selectRobotsGroup(parseRobotsGroups(robots), userAgent);
  const matchedRules = (group?.rules ?? []).filter((rule) => pathMatches(rule.path, pathname));
  const longestLength = Math.max(0, ...matchedRules.map((rule) => rule.path.length));
  const matched = matchedRules
    .filter((rule) => rule.path.length === longestLength)
    .sort((a, b) => (a.type === "allow" ? -1 : 1) - (b.type === "allow" ? -1 : 1))[0];
  if (!matched) return true;
  if (matched.type === "allow") return true;
  return matched.path === "";
}

function crawlDelayForRobots(robots, userAgent) {
  const group = selectRobotsGroup(parseRobotsGroups(robots), userAgent);
  return group?.crawlDelaySeconds ?? null;
}

async function checkRobots(url, userAgent) {
  const robotsUrl = `${url.origin}/robots.txt`;
  try {
    const response = await fetchWithTimeout(robotsUrl, {
      headers: { "User-Agent": userAgent, Accept: "text/plain,*/*;q=0.8" },
      redirect: "manual",
      cache: "no-store"
    });

    if (response.status >= 300 && response.status < 400) {
      add("FAIL", `robots:${url.hostname}`, `redirect blocked at ${robotsUrl}`);
      return;
    }
    if (response.status === 404) {
      add("FAIL", `robots:${url.hostname}`, "robots.txt not found; ReturnPick treats this as not allowed");
      return;
    }
    if (!response.ok) {
      add("FAIL", `robots:${url.hostname}`, `robots.txt returned HTTP_${response.status}`);
      return;
    }

    const robotsResult = await readTextWithLimit(response, MAX_ROBOTS_BYTES);
    if (robotsResult.status !== "ok") {
      add("FAIL", `robots:${url.hostname}`, `robots.txt too large: ${robotsResult.error}`);
      return;
    }

    const robots = robotsResult.text;
    const crawlDelay = crawlDelayForRobots(robots, userAgent);
    const allowed = robotsAllowsPath(robots, url.pathname, userAgent);

    if (!allowed) {
      add("FAIL", `robots:${url.hostname}${url.pathname}`, "robots.txt disallows the template path");
      return;
    }
    if (crawlDelay != null && crawlDelay > MAX_SUPPORTED_CRAWL_DELAY_SECONDS) {
      add("FAIL", `crawl-delay:${url.hostname}`, `Crawl-delay ${crawlDelay}s is too high for serverless sourcing`);
      return;
    }

    add("PASS", `robots:${url.hostname}${url.pathname}`, `allowed${crawlDelay != null ? `; crawl-delay ${crawlDelay}s` : ""}`);
  } catch (error) {
    add("FAIL", `robots:${url.hostname}`, error instanceof Error ? error.message : "robots fetch failed");
  }
}

async function main() {
  const enabled = envValue("PUBLIC_WEB_CRAWL_ENABLED") === "true";
  const hosts = splitList(envValue("PUBLIC_WEB_ALLOWED_HOSTS"));
  const templates = splitList(envValue("PUBLIC_WEB_SEARCH_TEMPLATES"));
  const siteUrl = envValue("NEXT_PUBLIC_SITE_URL") || "https://returnpick.vercel.app";
  const userAgent = `ReturnPickBot/0.1 (+${siteUrl.replace(/\/+$/, "")}/disclosure)`;

  console.log("ReturnPick public web collection check");
  console.log("=".repeat(42));
  console.log(`enabled: ${enabled ? "true" : "false"}`);
  console.log(`user-agent: ${userAgent}`);

  if (!enabled) {
    console.log("PUBLIC_WEB_CRAWL_ENABLED is not true. No public web requests were made.");
    return;
  }

  add(hosts.length > 0 ? "PASS" : "FAIL", "PUBLIC_WEB_ALLOWED_HOSTS", hosts.length ? `${hosts.length} host(s)` : "missing");
  add(hosts.length <= MAX_PUBLIC_WEB_ALLOWED_HOSTS ? "PASS" : "FAIL", "allowed host count", `${hosts.length}/${MAX_PUBLIC_WEB_ALLOWED_HOSTS}`);
  add(templates.length > 0 ? "PASS" : "FAIL", "PUBLIC_WEB_SEARCH_TEMPLATES", templates.length ? `${templates.length} template(s)` : "missing");
  add(templates.length <= MAX_PUBLIC_WEB_SEARCH_TEMPLATES ? "PASS" : "FAIL", "search template count", `${templates.length}/${MAX_PUBLIC_WEB_SEARCH_TEMPLATES}`);

  const allowedHostSet = new Set(hosts.map((host) => host.toLowerCase()));
  for (const host of hosts) {
    add(isPublicHostname(host) ? "PASS" : "FAIL", `host:${host}`, "public hostname without protocol/path/wildcards");
  }

  const templateUrls = [];
  for (const template of templates) {
    const url = safeTemplateUrl(template);
    if (!url) {
      add("FAIL", `template:${template}`, "must be http(s), public host, no credentials, and include {keyword}");
      continue;
    }
    if (!allowedHostSet.has(url.hostname.toLowerCase())) {
      add("FAIL", `template:${template}`, `host ${url.hostname} is not in PUBLIC_WEB_ALLOWED_HOSTS`);
      continue;
    }
    add("PASS", `template:${url.hostname}`, url.toString());
    templateUrls.push(url);
  }

  for (const url of templateUrls) {
    await checkRobots(url, userAgent);
  }

  console.log("=".repeat(42));
  for (const item of results) console.log(`${item.status} ${item.name} - ${item.detail}`);

  const failed = results.filter((item) => item.status === "FAIL");
  console.log("=".repeat(42));
  console.log(`summary: ${results.length - failed.length} pass, ${failed.length} fail`);
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
