import type { Category } from "@/lib/types";
import type { ProviderProduct, ProviderSearchResult } from "@/lib/providers/types";
import { extractReturnInfoFromText, toReturnInfoJson } from "@/lib/webReturnInfo";
import { getSiteUrl } from "@/lib/siteUrl";
import { isPublicWebHostname, safeAllowlistedPublicUrl } from "@/lib/publicWebUrlSafety";

const robotsCache = new Map<string, Promise<RobotsFetchResult>>();
const originNextFetchAt = new Map<string, number>();
const MAX_ROBOTS_BYTES = 250_000;
const MAX_PUBLIC_WEB_HTML_BYTES = 750_000;
const DEFAULT_PUBLIC_WEB_REQUEST_DELAY_MS = 1200;
const MAX_SUPPORTED_CRAWL_DELAY_SECONDS = 10;
export const MAX_PUBLIC_WEB_ALLOWED_HOSTS = 5;
export const MAX_PUBLIC_WEB_SEARCH_TEMPLATES = 5;

type RobotsFetchResult =
  | { status: "ok"; text: string }
  | { status: "missing" | "error"; text: null; error: string };

type LimitedTextResult =
  | { status: "ok"; text: string }
  | { status: "CONTENT_TOO_LARGE"; text: null; error: string };

type PublicWebDiagnostic = {
  status: string;
  url?: string;
  error?: string;
  robots_status?: string;
  crawl_delay_seconds?: number | null;
  content_type?: string | null;
  extracted_count?: number;
};

function isEnabled() {
  return process.env.PUBLIC_WEB_CRAWL_ENABLED === "true";
}

function crawlUserAgent() {
  return `ReturnPickBot/0.1 (+${getSiteUrl()}/disclosure)`;
}

function allowedHosts() {
  return new Set(
    (process.env.PUBLIC_WEB_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean)
  );
}

function searchTemplates() {
  return (process.env.PUBLIC_WEB_SEARCH_TEMPLATES ?? "")
    .split(",")
    .map((template) => template.trim())
    .filter(Boolean);
}

function buildPublicWebMeta(diagnostics: PublicWebDiagnostic[], hosts: Set<string>, templates: string[]) {
  return {
    public_web_diagnostics: diagnostics.slice(0, 12),
    public_web_diagnostic_count: diagnostics.length,
    allowed_host_count: hosts.size,
    template_count: templates.length,
    user_agent: crawlUserAgent(),
    max_html_bytes: MAX_PUBLIC_WEB_HTML_BYTES,
    max_robots_bytes: MAX_ROBOTS_BYTES
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function readTextWithLimit(response: Response, maxBytes: number): Promise<LimitedTextResult> {
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
  const chunks: Uint8Array[] = [];
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

async function getRobots(origin: string) {
  if (!robotsCache.has(origin)) {
    robotsCache.set(
      origin,
      fetchWithTimeout(`${origin}/robots.txt`, {
        headers: { "User-Agent": crawlUserAgent(), Accept: "text/plain,*/*;q=0.8" },
        redirect: "manual",
        cache: "no-store"
      })
        .then(async (response) => {
          if (response.ok) {
            const limited = await readTextWithLimit(response, MAX_ROBOTS_BYTES);
            if (limited.status !== "ok") return { status: "error", text: null, error: "ROBOTS_CONTENT_TOO_LARGE" } as const;
            return { status: "ok", text: limited.text } as const;
          }
          if (response.status === 404) return { status: "missing", text: null, error: "ROBOTS_TXT_NOT_FOUND" } as const;
          return { status: "error", text: null, error: `ROBOTS_HTTP_${response.status}` } as const;
        })
        .catch((error) => ({
          status: "error" as const,
          text: null,
          error: error instanceof Error ? error.message : "ROBOTS_FETCH_FAILED"
        }))
    );
  }
  return robotsCache.get(origin)!;
}

function pathMatches(rule: string, pathname: string) {
  if (!rule) return false;
  const hasEndAnchor = rule.endsWith("$");
  const pattern = hasEndAnchor ? rule.slice(0, -1) : rule;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}${hasEndAnchor ? "$" : ""}`).test(pathname);
}

type RobotsRule = { type: "allow" | "disallow"; path: string };
type RobotsGroup = { agents: string[]; rules: RobotsRule[]; crawlDelaySeconds: number | null };

function parseCrawlDelaySeconds(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseRobotsGroups(robots: string): RobotsGroup[] {
  const lines = robots
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, "").trim())
    .filter(Boolean);

  const groups: RobotsGroup[] = [];
  let current: RobotsGroup = { agents: [], rules: [], crawlDelaySeconds: null };

  for (const line of lines) {
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (!key) continue;

    if (key === "user-agent") {
      const agent = value.toLowerCase();
      if ((current.rules.length || current.crawlDelaySeconds != null) && current.agents.length) {
        groups.push(current);
        current = { agents: [], rules: [], crawlDelaySeconds: null };
      }
      if (agent) current.agents.push(agent);
      continue;
    }

    if (key === "allow" || key === "disallow") {
      if (!current.agents.length) continue;
      current.rules.push({ type: key, path: value });
      continue;
    }

    if (key === "crawl-delay") {
      if (!current.agents.length) continue;
      current.crawlDelaySeconds = parseCrawlDelaySeconds(value);
    }
  }

  if (current.agents.length) groups.push(current);
  return groups;
}

function selectRobotsGroup(groups: RobotsGroup[], userAgent: string) {
  const ua = userAgent.toLowerCase();
  const specific = groups
    .flatMap((group) =>
      group.agents
        .filter((agent) => agent !== "*" && ua.startsWith(agent))
        .map((agent) => ({ group, agent }))
    )
    .sort((a, b) => b.agent.length - a.agent.length)[0]?.group;

  if (specific) return specific;
  return groups.find((group) => group.agents.includes("*")) ?? null;
}

function isPathAllowedByRobots(robots: string | null, pathname: string, userAgent: string) {
  if (!robots) return false;
  const groups = parseRobotsGroups(robots);
  const group = selectRobotsGroup(groups, userAgent);
  const rules = group?.rules ?? [];

  const matchedRules = rules.filter((rule) => pathMatches(rule.path, pathname));
  const longestLength = Math.max(0, ...matchedRules.map((rule) => rule.path.length));
  const matched = matchedRules
    .filter((rule) => rule.path.length === longestLength)
    .sort((a, b) => (a.type === "allow" ? -1 : 1) - (b.type === "allow" ? -1 : 1))[0];
  if (!matched) return true;
  if (matched.type === "allow") return true;
  return matched.path === "";
}

function crawlDelaySecondsForRobots(robots: string | null, userAgent: string) {
  if (!robots) return null;
  const group = selectRobotsGroup(parseRobotsGroups(robots), userAgent);
  return group?.crawlDelaySeconds ?? null;
}

async function waitForOriginRateLimit(origin: string, delayMs: number) {
  const nextFetchAt = originNextFetchAt.get(origin) ?? 0;
  const waitMs = Math.max(0, nextFetchAt - Date.now());
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  originNextFetchAt.set(origin, Date.now() + delayMs);
}

function safeTemplateUrl(template: string, keyword: string) {
  if (!template.includes("{keyword}")) return null;
  try {
    const url = new URL(template.replace("{keyword}", encodeURIComponent(keyword)));
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    if (!isPublicWebHostname(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

function isHtmlContentType(value: string | null) {
  const contentType = (value ?? "").toLowerCase();
  return contentType.includes("text/html") || contentType.includes("application/xhtml+xml");
}

function safeRedirectTarget(location: string | null, baseUrl: URL, status: number) {
  if (!location) return `HTTP_${status}`;
  try {
    return new URL(location, baseUrl).toString().slice(0, 240);
  } catch {
    return `INVALID_REDIRECT_${status}`;
  }
}

function extractCards(html: string, category: Category, keyword: string, pageUrl: string, allowedHosts: ReadonlySet<string>): ProviderProduct[] {
  const anchorMatches = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,1500}?)<\/a>/gi)];
  const base = new URL(pageUrl);
  const products: ProviderProduct[] = [];

  for (const [index, match] of anchorMatches.entries()) {
    const productUrl = safeAllowlistedPublicUrl(match[1], base, allowedHosts);
    if (!productUrl) continue;
    const href = productUrl.toString();
    const block = match[2].replace(/<script[\s\S]*?<\/script>/gi, " ");
    const text = block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const returnInfo = extractReturnInfoFromText(text, href);
    if (!returnInfo.isReturnCandidate || text.length < 8) continue;
    products.push({
      source: "public_web",
      source_product_id: href,
      category,
      keyword,
      title: text.slice(0, 140),
      brand: null,
      model_name: null,
      image_url: null,
      source_url: href,
      coupang_url: href.includes("coupang.com") ? href : null,
      affiliate_url: null,
      source_price: returnInfo.return_price,
      return_price: returnInfo.return_price,
      new_price: null,
      condition_grade: returnInfo.condition_grade ?? "확인필요",
      stock_count: returnInfo.stock_count,
      raw_json: {
        provider: "public_web",
        page_url: pageUrl,
        anchor_index: index,
        web_return_info: toReturnInfoJson(returnInfo)
      }
    });
    if (products.length >= 8) break;
  }

  return products;
}

export async function searchPublicWebProducts(keyword: string, category: Category): Promise<ProviderSearchResult> {
  if (!isEnabled()) return { status: "DISABLED", products: [] };

  const hosts = allowedHosts();
  const templates = searchTemplates();
  if (!hosts.size || !templates.length) {
    const diagnostics: PublicWebDiagnostic[] = [{ status: "API_NOT_CONFIGURED", error: "PUBLIC_WEB_ALLOWED_HOSTS_OR_TEMPLATES_MISSING" }];
    return { status: "API_NOT_CONFIGURED", products: [], meta: buildPublicWebMeta(diagnostics, hosts, templates) };
  }
  if (hosts.size > MAX_PUBLIC_WEB_ALLOWED_HOSTS || templates.length > MAX_PUBLIC_WEB_SEARCH_TEMPLATES) {
    const diagnostics: PublicWebDiagnostic[] = [{ status: "INVALID_TEMPLATE", error: "PUBLIC_WEB_CONFIG_TOO_BROAD" }];
    return {
      status: "INVALID_TEMPLATE",
      products: [],
      error: `PUBLIC_WEB_CONFIG_TOO_BROAD: allow up to ${MAX_PUBLIC_WEB_ALLOWED_HOSTS} hosts and ${MAX_PUBLIC_WEB_SEARCH_TEMPLATES} templates.`,
      meta: buildPublicWebMeta(diagnostics, hosts, templates)
    };
  }

  const products: ProviderProduct[] = [];
  const diagnostics: PublicWebDiagnostic[] = [];

  for (const template of templates) {
    const parsed = safeTemplateUrl(template, keyword);
    if (!parsed) {
      diagnostics.push({ status: "INVALID_TEMPLATE", url: template });
      continue;
    }
    const url = parsed.toString();
    if (!hosts.has(parsed.hostname.toLowerCase())) {
      diagnostics.push({ status: "HOST_NOT_ALLOWED", url });
      continue;
    }

    const robots = await getRobots(parsed.origin);
    if (robots.status !== "ok") {
      diagnostics.push({ status: "ROBOTS_UNAVAILABLE", url, robots_status: robots.status, error: robots.error });
      continue;
    }
    if (!isPathAllowedByRobots(robots.text, parsed.pathname, crawlUserAgent())) {
      diagnostics.push({ status: "ROBOTS_DISALLOWED", url, robots_status: robots.status });
      continue;
    }

    const crawlDelaySeconds = crawlDelaySecondsForRobots(robots.text, crawlUserAgent());
    if (crawlDelaySeconds != null && crawlDelaySeconds > MAX_SUPPORTED_CRAWL_DELAY_SECONDS) {
      diagnostics.push({ status: "CRAWL_DELAY_TOO_HIGH", url, error: `CRAWL_DELAY_${crawlDelaySeconds}` });
      continue;
    }
    const requestDelayMs = Math.max(DEFAULT_PUBLIC_WEB_REQUEST_DELAY_MS, Math.ceil((crawlDelaySeconds ?? 0) * 1000));
    await waitForOriginRateLimit(parsed.origin, requestDelayMs);

    const response = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": crawlUserAgent(),
        Accept: "text/html,application/xhtml+xml"
      },
      redirect: "manual",
      cache: "no-store"
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      diagnostics.push({
        status: "REDIRECT_BLOCKED",
        url,
        error: safeRedirectTarget(location, parsed, response.status)
      });
      continue;
    }
    if (!response.ok) {
      diagnostics.push({ status: "HTTP_ERROR", url, error: `HTTP_${response.status}` });
      continue;
    }

    const contentType = response.headers.get("content-type");
    if (!isHtmlContentType(contentType)) {
      diagnostics.push({ status: "UNSUPPORTED_CONTENT_TYPE", url, content_type: contentType, error: contentType ?? "MISSING_CONTENT_TYPE" });
      continue;
    }

    const htmlResult = await readTextWithLimit(response, MAX_PUBLIC_WEB_HTML_BYTES);
    if (htmlResult.status !== "ok") {
      diagnostics.push({ status: "CONTENT_TOO_LARGE", url, error: htmlResult.error });
      continue;
    }

    const html = htmlResult.text;
    const extracted = extractCards(html, category, keyword, url, hosts);
    diagnostics.push({
      status: "FETCHED_HTML",
      url,
      robots_status: robots.status,
      crawl_delay_seconds: crawlDelaySeconds,
      content_type: contentType,
      extracted_count: extracted.length
    });
    products.push(...extracted);
  }

  const meta = buildPublicWebMeta(diagnostics, hosts, templates);
  if (products.length) return { status: "ok", products, meta };
  const firstBlocking = diagnostics.find((item) => item.status === "ROBOTS_DISALLOWED" || item.status === "ROBOTS_UNAVAILABLE");
  if (firstBlocking?.status === "ROBOTS_DISALLOWED") return { status: "ROBOTS_DISALLOWED", products: [], error: firstBlocking.url, meta };
  if (firstBlocking?.status === "ROBOTS_UNAVAILABLE") {
    return { status: "ROBOTS_UNAVAILABLE", products: [], error: firstBlocking.error ?? firstBlocking.url, meta };
  }
  if (diagnostics.some((item) => item.status === "INVALID_TEMPLATE")) {
    return { status: "INVALID_TEMPLATE", products: [], error: "PUBLIC_WEB_SEARCH_TEMPLATES contains an invalid or unsupported URL.", meta };
  }
  const firstContentIssue = diagnostics.find((item) => item.status === "UNSUPPORTED_CONTENT_TYPE" || item.status === "CONTENT_TOO_LARGE");
  if (firstContentIssue?.status === "UNSUPPORTED_CONTENT_TYPE") return { status: "UNSUPPORTED_CONTENT_TYPE", products: [], error: firstContentIssue.error ?? firstContentIssue.url, meta };
  if (firstContentIssue?.status === "CONTENT_TOO_LARGE") return { status: "CONTENT_TOO_LARGE", products: [], error: firstContentIssue.error ?? firstContentIssue.url, meta };
  const firstRedirect = diagnostics.find((item) => item.status === "REDIRECT_BLOCKED");
  if (firstRedirect) return { status: "REDIRECT_BLOCKED", products: [], error: firstRedirect.error ?? firstRedirect.url, meta };
  const firstCrawlDelay = diagnostics.find((item) => item.status === "CRAWL_DELAY_TOO_HIGH");
  if (firstCrawlDelay) return { status: "CRAWL_DELAY_TOO_HIGH", products: [], error: firstCrawlDelay.error ?? firstCrawlDelay.url, meta };
  return { status: "ok", products, meta };
}
