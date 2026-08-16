import type { Category, ConditionGrade, JsonValue } from "@/lib/types";
import type { ProviderProduct, ProviderSearchResult } from "@/lib/providers/types";
import { mergeProviderProductBatches } from "@/lib/providerProductMerge";
import { parseAlgumonCoupangDiscovery } from "@/lib/providers/algumonDiscoveryParser";
import { HOTDEALS_DISCOVERY_FEED_PATH, parseHotDealsCoupangDiscovery, parseHotDealsCoupangDiscoveryFeed } from "@/lib/providers/hotdealsDiscoveryParser";
import { HOTDEALS_DISCOVERY_HOST, isApprovedHotDealsDiscoverySearchUrl } from "@/lib/providers/publicWebProfile";
import { cleanText, extractListedPriceCandidatesFromText, extractListedPriceFromText, extractReturnInfoFromText, toReturnInfoJson } from "@/lib/webReturnInfo";
import { getSiteUrl } from "@/lib/siteUrl";
import { isPublicWebHostname, safeAllowlistedPublicUrl } from "@/lib/publicWebUrlSafety";
import { collectJsonLdProducts, readJsonLdOfferPrice, readJsonLdText } from "@/lib/publicWebJsonLd";

const ROBOTS_CACHE_TTL_MS = 5 * 60_000;
type RobotsCacheEntry = { promise: Promise<RobotsFetchResult>; expiresAt: number };
const robotsCache = new Map<string, RobotsCacheEntry>();
const originNextFetchAt = new Map<string, number>();
const MAX_ROBOTS_BYTES = 250_000;
const MAX_PUBLIC_WEB_HTML_BYTES = 750_000;
const DEFAULT_PUBLIC_WEB_REQUEST_DELAY_MS = 1200;
const MAX_SUPPORTED_CRAWL_DELAY_SECONDS = 10;
const DEFAULT_PUBLIC_WEB_INSPECTION_BUDGET_MS = 5_000;
export const PUBLIC_WEB_INTAKE_ENRICHMENT_BUDGET_MS = 4_500;
export const MAX_PUBLIC_WEB_ALLOWED_HOSTS = 5;
export const MAX_PUBLIC_WEB_SEARCH_TEMPLATES = 5;
export const MAX_PUBLIC_WEB_DETAIL_PAGES = 3;

type RobotsFetchResult =
  | { status: "ok"; text: string }
  | { status: "missing" | "error"; text: null; error: string };

type LimitedTextResult =
  | { status: "ok"; text: string }
  | { status: "CONTENT_TOO_LARGE" | "FETCH_TIMEOUT"; text: null; error: string };

export type PublicWebDiagnostic = {
  status: string;
  stage?: "search" | "detail";
  url?: string;
  error?: string;
  robots_status?: string;
  crawl_delay_seconds?: number | null;
  content_type?: string | null;
  extracted_count?: number;
};

export type PublicWebInspectionStatus =
  | "ok"
  | "DISABLED"
  | "API_NOT_CONFIGURED"
  | "INVALID_CONFIG"
  | "INVALID_URL"
  | "HTTPS_REQUIRED"
  | "HOST_NOT_ALLOWED"
  | "PRODUCT_PATH_REQUIRED"
  | "PRODUCT_URL_REQUIRED"
  | "ROBOTS_UNAVAILABLE"
  | "ROBOTS_DISALLOWED"
  | "CRAWL_DELAY_TOO_HIGH"
  | "REDIRECT_BLOCKED"
  | "HTTP_ERROR"
  | "UNSUPPORTED_CONTENT_TYPE"
  | "CONTENT_TOO_LARGE"
  | "FETCH_TIMEOUT"
  | "FETCH_FAILED";

export type PublicWebProductInspectionInput = {
  url: string;
  category: Category;
  deadlineAt?: number;
};

export type PublicWebProductInspectionResult = {
  status: PublicWebInspectionStatus;
  url: string | null;
  enriched_metadata: {
    title: string | null;
    image_url: string | null;
    source_price: number | null;
    return_price: number | null;
    condition_grade: ConditionGrade | null;
    stock_count: number | null;
  };
  fields_filled: string[];
  diagnostics: PublicWebDiagnostic[];
  raw_json: Record<string, JsonValue>;
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

function buildPublicWebMeta(
  diagnostics: PublicWebDiagnostic[],
  hosts: Set<string>,
  templates: string[],
  mergedDeduplicatedCount = 0
) {
  const detailDiagnostics = diagnostics.filter((item) => item.stage === "detail");
  return {
    public_web_diagnostics: diagnostics.slice(0, 12),
    public_web_diagnostic_count: diagnostics.length,
    detail_page_limit: MAX_PUBLIC_WEB_DETAIL_PAGES,
    detail_page_fetched_count: detailDiagnostics.filter((item) => item.status === "FETCHED_DETAIL").length,
    merged_deduplicated_count: mergedDeduplicatedCount,
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

async function readTextWithLimit(response: Response, maxBytes: number, deadlineAt?: number): Promise<LimitedTextResult> {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { status: "CONTENT_TOO_LARGE", text: null, error: `CONTENT_LENGTH_${declaredLength}` };
  }

  if (!response.body) {
    const text = deadlineAt == null ? await response.text() : await withDeadline(response.text(), deadlineAt);
    if (text == null) return { status: "FETCH_TIMEOUT", text: null, error: "READ_DEADLINE_EXCEEDED" };
    const byteLength = new TextEncoder().encode(text).byteLength;
    if (byteLength > maxBytes) return { status: "CONTENT_TOO_LARGE", text: null, error: `CONTENT_BYTES_${byteLength}` };
    return { status: "ok", text };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const next = await readStreamChunk(reader, deadlineAt);
    if (next.status === "timeout") {
      await reader.cancel().catch(() => undefined);
      return { status: "FETCH_TIMEOUT", text: null, error: "READ_DEADLINE_EXCEEDED" };
    }
    const { done, value } = next;
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

async function withDeadline<T>(promise: Promise<T>, deadlineAt?: number): Promise<T | null> {
  if (deadlineAt == null) return promise;
  const remainingMs = deadlineAt - Date.now();
  if (remainingMs <= 0) return null;

  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), remainingMs);
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function readStreamChunk(reader: ReadableStreamDefaultReader<Uint8Array>, deadlineAt?: number) {
  if (deadlineAt == null) return { status: "ok" as const, ...(await reader.read()) };
  const remainingMs = deadlineAt - Date.now();
  if (remainingMs <= 0) return { status: "timeout" as const };

  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    const result = await Promise.race([
      reader.read(),
      new Promise<{ status: "timeout" }>((resolve) => {
        timeout = setTimeout(() => resolve({ status: "timeout" }), remainingMs);
      })
    ]);
    if ("status" in result) return result;
    return { status: "ok" as const, ...result };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function evictRobots(origin: string, promise: Promise<RobotsFetchResult>) {
  if (robotsCache.get(origin)?.promise === promise) robotsCache.delete(origin);
}

function getRobots(origin: string, timeoutMs = 8_000, deadlineAt?: number) {
  const cached = robotsCache.get(origin);
  if (cached && (cached.expiresAt === 0 || cached.expiresAt > Date.now())) return cached.promise;
  if (cached) robotsCache.delete(origin);

  const promise = fetchWithTimeout(
    `${origin}/robots.txt`,
    {
      headers: { "User-Agent": crawlUserAgent(), Accept: "text/plain,*/*;q=0.8" },
      redirect: "manual",
      cache: "no-store"
    },
    timeoutMs
  )
    .then(async (response) => {
      if (response.ok) {
        const limited = await readTextWithLimit(response, MAX_ROBOTS_BYTES, deadlineAt);
        if (limited.status !== "ok") {
          return { status: "error", text: null, error: limited.status === "FETCH_TIMEOUT" ? "ROBOTS_FETCH_TIMEOUT" : "ROBOTS_CONTENT_TOO_LARGE" } as const;
        }
        return { status: "ok", text: limited.text } as const;
      }
      if (response.status === 404) return { status: "missing", text: null, error: "ROBOTS_TXT_NOT_FOUND" } as const;
      return { status: "error", text: null, error: `ROBOTS_HTTP_${response.status}` } as const;
    })
    .catch((error) => ({
      status: "error" as const,
      text: null,
      error: error instanceof Error ? error.message : "ROBOTS_FETCH_FAILED"
    }));

  const entry: RobotsCacheEntry = { promise, expiresAt: 0 };
  robotsCache.set(origin, entry);
  void promise.then((result) => {
    if (robotsCache.get(origin)?.promise !== promise) return;
    if (result.status === "ok") entry.expiresAt = Date.now() + ROBOTS_CACHE_TTL_MS;
    else robotsCache.delete(origin);
  });
  return promise;
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

async function waitForOriginRateLimit(origin: string, delayMs: number, deadlineAt?: number) {
  const now = Date.now();
  const nextFetchAt = originNextFetchAt.get(origin) ?? 0;
  const scheduledAt = Math.max(now, nextFetchAt);
  if (deadlineAt != null && scheduledAt > deadlineAt) return false;

  // Reserve the next slot before waiting so concurrent callers cannot wake together.
  originNextFetchAt.set(origin, scheduledAt + delayMs);
  const waitMs = scheduledAt - now;
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  return true;
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

function isAllowedPublicWebSearchContentType(value: string | null, pageUrl: URL) {
  if (isHtmlContentType(value)) return true;
  if (!isHotDealsFeedPage(pageUrl)) return false;
  const contentType = (value ?? "").toLowerCase();
  return contentType.includes("application/rss+xml") || contentType.includes("application/atom+xml") || contentType.includes("application/xml") || contentType.includes("text/xml");
}

function safeRedirectTarget(location: string | null, baseUrl: URL, status: number) {
  if (!location) return `HTTP_${status}`;
  try {
    return new URL(location, baseUrl).toString().slice(0, 240);
  } catch {
    return `INVALID_REDIRECT_${status}`;
  }
}

function readJsonLdBrand(record: Record<string, unknown>) {
  const brand = readJsonLdText(record.brand);
  return brand || null;
}

function readJsonLdImage(record: Record<string, unknown>, pageUrl: URL, allowedHosts: ReadonlySet<string>) {
  const image = readJsonLdText(record.image);
  if (!image) return null;
  return safeAllowlistedPublicUrl(image, pageUrl, allowedHosts)?.toString() ?? null;
}

function readJsonLdUrl(record: Record<string, unknown>, pageUrl: URL, allowedHosts: ReadonlySet<string>) {
  const rawUrl = readJsonLdText(record.url) || readJsonLdText(record["@id"]);
  if (!rawUrl) return null;
  return safeAllowlistedPublicUrl(rawUrl, pageUrl, allowedHosts);
}

function isLikelyProductCard(pageUrl: URL, productUrl: URL, text: string) {
  if (text.length < 8 || productUrl.pathname === "/") return false;
  if (productUrl.origin === pageUrl.origin && productUrl.pathname === pageUrl.pathname) return false;

  const pathname = productUrl.pathname.toLowerCase();
  const collectionPath = /\/(?:search|category|categories|brand|brands|tag|login|cart|help|about)(?:\/|$)/.test(pathname);
  if (collectionPath || ["/products", "/items", "/goods"].includes(pathname)) return false;

  const pathSignal = /(?:product|item|goods|detail|sku|model)/.test(pathname) || /\d{2,}/.test(pathname);
  const productTextSignal = /(?:갤럭시북|그램|맥북|아이디어패드|리전|빅터스|노트북|모니터|로보락|드리미|샤오미|다이슨|코드제로|삼성\s*제트|청소기|공기청정기|제습기|상품|제품)/i.test(text);
  const priceSignal = /(?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]{5,8})\s*원|[0-9]+(?:\.[0-9]+)?\s*만\s*원/i.test(text);
  const specSignal = /(?:[0-9]+\s*(?:gb|tb|hz|인치|형|l|리터|kg|w)|fhd|qhd|uhd|4k|rtx|core\s*i[3579]|ultra\s*[3579]|ryzen\s*[3579])/i.test(text);
  return (pathSignal && (productTextSignal || priceSignal || specSignal)) || (productTextSignal && (priceSignal || specSignal));
}

function findHtmlTagEnd(source: string, start: number) {
  let quote: '"' | "'" | null = null;
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote) quote = null;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === ">") {
      return index;
    }
  }
  return -1;
}

function readOpeningAttribute(opening: string, target: string) {
  const tagMatch = opening.match(/^<\s*[a-z][\w:-]*/i);
  if (!tagMatch) return null;
  const end = opening.endsWith(">") ? opening.length - 1 : opening.length;
  let index = tagMatch[0].length;

  while (index < end) {
    while (index < end && /[\s/]/.test(opening[index])) index += 1;
    if (index >= end) break;
    if (!/[A-Za-z_:]/.test(opening[index])) {
      index += 1;
      continue;
    }
    const nameStart = index;
    index += 1;
    while (index < end && /[\w:.-]/.test(opening[index])) index += 1;
    const name = opening.slice(nameStart, index);
    while (index < end && /\s/.test(opening[index])) index += 1;

    let value: string | null = null;
    if (opening[index] === "=") {
      index += 1;
      while (index < end && /\s/.test(opening[index])) index += 1;
      const quote = opening[index];
      if (quote === '"' || quote === "'") {
        index += 1;
        const valueStart = index;
        while (index < end && opening[index] !== quote) index += 1;
        value = opening.slice(valueStart, index);
        if (index < end) index += 1;
      } else {
        const valueStart = index;
        while (index < end && !/[\s>]/.test(opening[index])) index += 1;
        value = opening.slice(valueStart, index);
      }
    }
    if (name.toLowerCase() === target.toLowerCase()) return value;
  }
  return null;
}

function isPotentialHtmlTagStart(source: string, index: number) {
  const character = source[index + 1];
  return character === "/" || character === "!" || character === "?" || (character != null && /[A-Za-z]/.test(character));
}

const voidHtmlTagNames = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const rawMarkupTagNames = new Set(["script", "style", "noscript", "template"]);
const rawTextTagNames = new Set(["script", "style", "noscript"]);
const jsonLdMimeType = "application/ld+json";
const maxRawTagNesting = 256;

function isHiddenOpeningTag(opening: string) {
  const tagMatch = opening.match(/^<\s*[a-z][\w:-]*/i);
  if (!tagMatch) return false;
  const attributes = opening.slice(tagMatch[0].length, -1);
  if (/(?:^|\s)hidden(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?(?=\s|\/?$)/i.test(attributes)) return true;
  if (/(?:^|\s)aria-hidden\s*=\s*(?:"true"|'true'|true)(?=\s|\/?$)/i.test(attributes)) return true;
  const style = readOpeningAttribute(opening, "style") ?? "";
  return /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(style);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findRawTextClosingTag(source: string, start: number, name: string) {
  const pattern = new RegExp(`<\\s*\\/\\s*${escapeRegExp(name)}\\b[^>]*>`, "i");
  const match = pattern.exec(source.slice(start));
  if (!match) return null;
  const closingStart = start + (match.index ?? 0);
  const closingEnd = closingStart + match[0].length - 1;
  const nextTagStart = source.indexOf("<", closingEnd + 1);
  if (nextTagStart >= 0) {
    const nextClose = pattern.exec(source.slice(nextTagStart));
    if (nextClose?.index === 0) {
      return { start: nextTagStart, end: nextTagStart + nextClose[0].length - 1 };
    }
  }
  return { start: closingStart, end: closingEnd };
}

function findClosingAnchor(source: string, start: number) {
  let cursor = start;
  while (cursor < source.length) {
    const tagStart = source.indexOf("<", cursor);
    if (tagStart < 0) return null;
    if (!isPotentialHtmlTagStart(source, tagStart)) {
      cursor = tagStart + 1;
      continue;
    }
    if (source.startsWith("<!--", tagStart)) {
      const commentEnd = source.indexOf("-->", tagStart + 4);
      if (commentEnd < 0) return null;
      cursor = commentEnd + 3;
      continue;
    }
    const tagEnd = findHtmlTagEnd(source, tagStart);
    if (tagEnd < 0) return null;
    const token = source.slice(tagStart, tagEnd + 1);
    const rawOpening = token.match(/^<\s*([a-z][\w:-]*)\b([\s\S]*?)>$/i);
    if (rawOpening && rawMarkupTagNames.has(rawOpening[1].toLowerCase())) {
      const rawClosing = findClosingNamedTag(source, tagEnd + 1, rawOpening[1].toLowerCase());
      if (!rawClosing) return null;
      cursor = rawClosing.end + 1;
      continue;
    }
    if (/^<\s*\/\s*a\s*>$/i.test(token)) return { start: tagStart, end: tagEnd };
    cursor = tagEnd + 1;
  }
  return null;
}

function findClosingNamedTag(source: string, start: number, target: string) {
  let cursor = start;
  const tagStack = [target];
  while (cursor < source.length) {
    const rawTextTag = tagStack[tagStack.length - 1];
    if (rawTextTagNames.has(rawTextTag)) {
      const rawClosing = findRawTextClosingTag(source, cursor, rawTextTag);
      if (!rawClosing) return null;
      tagStack.pop();
      if (tagStack.length === 0) return rawClosing;
      cursor = rawClosing.end + 1;
      continue;
    }
    const tagStart = source.indexOf("<", cursor);
    if (tagStart < 0) return null;
    if (source.startsWith("<!--", tagStart)) {
      const commentEnd = source.indexOf("-->", tagStart + 4);
      if (commentEnd < 0) return null;
      cursor = commentEnd + 3;
      continue;
    }
    if (!isPotentialHtmlTagStart(source, tagStart)) {
      cursor = tagStart + 1;
      continue;
    }
    const tagEnd = findHtmlTagEnd(source, tagStart);
    if (tagEnd < 0) return null;
    const token = source.slice(tagStart, tagEnd + 1);
    const closing = token.match(/^<\s*\/\s*([a-z][\w:-]*)\b[^>]*>$/i);
    if (closing) {
      const closingName = closing[1].toLowerCase();
      if (tagStack[tagStack.length - 1] === closingName) {
        tagStack.pop();
        if (tagStack.length === 0) return { start: tagStart, end: tagEnd };
      }
    } else {
      const opening = token.match(/^<\s*([a-z][\w:-]*)\b([\s\S]*?)>$/i);
      const openingName = opening?.[1].toLowerCase();
      if (openingName && !voidHtmlTagNames.has(openingName) && (openingName === target || rawMarkupTagNames.has(openingName))) {
        if (tagStack.length >= maxRawTagNesting) return null;
        tagStack.push(openingName);
      }
    }
    cursor = tagEnd + 1;
  }
  return null;
}

const secondaryDetailMarkers = /(?:recommend|related|similar|upsell|cross[-\s]?sell|also[-\s]?bought|accessor(?:y|ies)|suggest(?:ed|ion)?|bundle|recently[-\s]?viewed|추천|연관|관련|비슷|함께\s*(?:구매|본)|액세서리|장바구니)/i;
const secondaryDetailAttributes = ["id", "class", "aria-label", "data-testid", "data-section", "data-component", "role"];
const secondaryHeadingContainerNames = new Set(["section", "article", "div"]);
const MAX_SECONDARY_HEADING_SCAN_BYTES = 6000;
const MAX_GENERIC_HEADING_CONTAINER_SCANS = 256;
const secondaryDetailHeadingPattern = /(?:추천(?:\s*(?:상품|제품|딜|아이템))?|연관\s*(?:상품|제품)?|관련\s*(?:상품|제품)?|비슷한\s*상품|함께\s*(?:구매|본)|recommend(?:ed|ation)?|related|similar|you\s+may\s+also\s+like)/i;

function isSecondaryDetailOpeningTag(opening: string) {
  const name = opening.match(/^<\s*([a-z][\w:-]*)\b/i)?.[1]?.toLowerCase();
  if (!name) return false;
  if (name === "aside") return true;
  return secondaryDetailAttributes.some((attribute) => secondaryDetailMarkers.test(readOpeningAttribute(opening, attribute) ?? ""));
}

function hasSecondaryDetailHeading(source: string) {
  let cursor = 0;
  while (cursor < source.length) {
    const tagStart = source.indexOf("<", cursor);
    if (tagStart < 0) return false;
    if (source.startsWith("<!--", tagStart)) {
      const commentEnd = source.indexOf("-->", tagStart + 4);
      if (commentEnd < 0) return false;
      cursor = commentEnd + 3;
      continue;
    }
    if (!isPotentialHtmlTagStart(source, tagStart)) {
      cursor = tagStart + 1;
      continue;
    }
    const tagEnd = findHtmlTagEnd(source, tagStart);
    if (tagEnd < 0) return false;
    const token = source.slice(tagStart, tagEnd + 1);
    const opening = token.match(/^<\s*([a-z][\w:-]*)\b([\s\S]*?)>$/i);
    if (!opening) {
      cursor = tagEnd + 1;
      continue;
    }
    const name = opening[1].toLowerCase();
    if (rawMarkupTagNames.has(name)) {
      const closing = findClosingNamedTag(source, tagEnd + 1, name);
      if (!closing) return false;
      cursor = closing.end + 1;
      continue;
    }
    if (secondaryHeadingContainerNames.has(name)) {
      const nestedClosing = findClosingNamedTag(source, tagEnd + 1, name);
      if (!nestedClosing) return false;
      cursor = nestedClosing.end + 1;
      continue;
    }
    if (/^h[1-6]$/.test(name) && !isHiddenOpeningTag(token)) {
      const closing = findClosingNamedTag(source, tagEnd + 1, name);
      if (!closing) return false;
      if (secondaryDetailHeadingPattern.test(cleanText(source.slice(tagEnd + 1, closing.start)))) return true;
      cursor = closing.end + 1;
      continue;
    }
    cursor = tagEnd + 1;
  }
  return false;
}

function stripSecondaryDetailSections(html: string) {
  let visible = "";
  let copyCursor = 0;
  let cursor = 0;
  let genericHeadingContainerScans = 0;

  while (cursor < html.length) {
    const tagStart = html.indexOf("<", cursor);
    if (tagStart < 0) break;
    if (html.startsWith("<!--", tagStart)) {
      const commentEnd = html.indexOf("-->", tagStart + 4);
      if (commentEnd < 0) break;
      cursor = commentEnd + 3;
      continue;
    }
    if (!isPotentialHtmlTagStart(html, tagStart)) {
      cursor = tagStart + 1;
      continue;
    }
    const tagEnd = findHtmlTagEnd(html, tagStart);
    if (tagEnd < 0) break;
    const token = html.slice(tagStart, tagEnd + 1);
    const opening = token.match(/^<\s*([a-z][\w:-]*)\b([\s\S]*?)>$/i);
    if (!opening) {
      cursor = tagEnd + 1;
      continue;
    }

    const name = opening[1].toLowerCase();
    if (rawMarkupTagNames.has(name)) {
      const rawClosing = findClosingNamedTag(html, tagEnd + 1, name);
      if (!rawClosing) break;
      cursor = rawClosing.end + 1;
      continue;
    }

   const selfClosing = voidHtmlTagNames.has(name);
   let headingContainerClosing: { start: number; end: number } | null = null;
   const headingContainer = !selfClosing && secondaryHeadingContainerNames.has(name);
    const isRecommendationHeadingContainer = headingContainer && (() => {
      const isGenericContainer = name === "div";
      if (isGenericContainer) {
        if (genericHeadingContainerScans >= MAX_GENERIC_HEADING_CONTAINER_SCANS) return false;
        genericHeadingContainerScans += 1;
      }
      const headingPreview = html.slice(tagEnd + 1, Math.min(html.length, tagEnd + 1 + MAX_SECONDARY_HEADING_SCAN_BYTES));
      if (isGenericContainer && !hasSecondaryDetailHeading(headingPreview)) return false;
      headingContainerClosing = findClosingNamedTag(html, tagEnd + 1, name);
      const headingSource = headingContainerClosing
        ? html.slice(tagEnd + 1, headingContainerClosing.start)
        : headingPreview;
      return hasSecondaryDetailHeading(headingSource);
    })();
    if (isSecondaryDetailOpeningTag(token) || isRecommendationHeadingContainer) {
      visible += html.slice(copyCursor, tagStart);
      if (selfClosing) {
        copyCursor = tagEnd + 1;
        cursor = copyCursor;
        continue;
      }
      const closing = headingContainerClosing ?? findClosingNamedTag(html, tagEnd + 1, name);
      if (!closing) {
        copyCursor = html.length;
        cursor = html.length;
        break;
      }
      copyCursor = closing.end + 1;
      cursor = copyCursor;
      continue;
    }

    cursor = tagEnd + 1;
  }

  visible += html.slice(copyCursor);
  return visible;
}

function extractVisibleJsonLdBlocks(html: string) {
  const blocks: string[] = [];
  const suppressedTags: string[] = [];
  let cursor = 0;

  while (cursor < html.length) {
    const tagStart = html.indexOf("<", cursor);
    if (tagStart < 0) break;
    if (html.startsWith("<!--", tagStart)) {
      const commentEnd = html.indexOf("-->", tagStart + 4);
      if (commentEnd < 0) break;
      cursor = commentEnd + 3;
      continue;
    }
    if (!isPotentialHtmlTagStart(html, tagStart)) {
      cursor = tagStart + 1;
      continue;
    }
    const tagEnd = findHtmlTagEnd(html, tagStart);
    if (tagEnd < 0) break;
    const token = html.slice(tagStart, tagEnd + 1);
    const closing = token.match(/^<\s*\/\s*([a-z][\w:-]*)\b[^>]*>$/i);
    if (closing) {
      if (suppressedTags.length > 0) {
        const matchingIndex = suppressedTags.lastIndexOf(closing[1].toLowerCase());
        if (matchingIndex >= 0) suppressedTags.length = matchingIndex;
      }
      cursor = tagEnd + 1;
      continue;
    }
    const opening = token.match(/^<\s*([a-z][\w:-]*)\b([\s\S]*?)>$/i);
    if (!opening) {
      cursor = tagEnd + 1;
      continue;
    }
    const name = opening[1].toLowerCase();
    const selfClosing = voidHtmlTagNames.has(name);

    if (rawMarkupTagNames.has(name)) {
      const closingTag = findClosingNamedTag(html, tagEnd + 1, name);
      if (!closingTag) break;
      const type = readOpeningAttribute(token, "type")?.trim().toLowerCase();
      if (suppressedTags.length === 0 && name === "script" && !isHiddenOpeningTag(token) && type === jsonLdMimeType) {
        blocks.push(html.slice(tagEnd + 1, closingTag.start));
      }
      cursor = closingTag.end + 1;
      continue;
    }

    if (suppressedTags.length > 0) {
      if (!selfClosing) suppressedTags.push(name);
    } else if (isHiddenOpeningTag(token)) {
      if (!selfClosing) suppressedTags.push(name);
    }
    cursor = tagEnd + 1;
  }

  return blocks;
}

function extractVisibleAnchorBlocks(html: string) {
  const blocks: Array<{ href: string; opening: string; inner: string }> = [];
  const suppressedTags: string[] = [];
  let cursor = 0;
  while (cursor < html.length) {
    const tagStart = html.indexOf("<", cursor);
    if (tagStart < 0) break;
    if (html.startsWith("<!--", tagStart)) {
      const commentEnd = html.indexOf("-->", tagStart + 4);
      if (commentEnd < 0) break;
      cursor = commentEnd + 3;
      continue;
    }
    if (!isPotentialHtmlTagStart(html, tagStart)) {
      cursor = tagStart + 1;
      continue;
    }
    const openingEnd = findHtmlTagEnd(html, tagStart);
    if (openingEnd < 0) break;
    const opening = html.slice(tagStart, openingEnd + 1);
    const closingTag = opening.match(/^<\s*\/\s*([a-z][\w:-]*)\b[^>]*>$/i);
    if (closingTag) {
      if (suppressedTags.length > 0) {
        const matchingIndex = suppressedTags.lastIndexOf(closingTag[1].toLowerCase());
        if (matchingIndex >= 0) suppressedTags.length = matchingIndex;
      }
      cursor = openingEnd + 1;
      continue;
    }
    const openingTag = opening.match(/^<\s*([a-z][\w:-]*)\b([\s\S]*?)>$/i);
    if (!openingTag) {
      cursor = openingEnd + 1;
      continue;
    }
    const name = openingTag[1].toLowerCase();
    const selfClosing = voidHtmlTagNames.has(name);

    if (rawMarkupTagNames.has(name)) {
      const closingRawTag = findClosingNamedTag(html, openingEnd + 1, name);
      if (!closingRawTag) break;
      cursor = closingRawTag.end + 1;
      continue;
    }

    if (/^<\s*a\b/i.test(opening)) {
      if (suppressedTags.length === 0 && !isHiddenOpeningTag(opening)) {
        const closing = findClosingAnchor(html, openingEnd + 1);
        if (!closing) break;
        cursor = closing.end + 1;
        const href = readOpeningAttribute(opening, "href");
        const inner = html.slice(openingEnd + 1, closing.start);
        if (href != null) blocks.push({ href, opening, inner });
        continue;
      }
      if (suppressedTags.length === 0 && isHiddenOpeningTag(opening) && !selfClosing) suppressedTags.push(name);
      else if (suppressedTags.length > 0 && !selfClosing) suppressedTags.push(name);
      cursor = openingEnd + 1;
      continue;
    }

    if (suppressedTags.length > 0) {
      if (!selfClosing) suppressedTags.push(name);
    } else if (isHiddenOpeningTag(opening)) {
      if (!selfClosing) suppressedTags.push(name);
    }
    cursor = openingEnd + 1;
  }
  return blocks;
}

function isAlgumonHost(url: URL) {
  return url.hostname === "www.algumon.com" || url.hostname === "algumon.com";
}

function isAlgumonDealSearchPage(url: URL) {
  return url.protocol === "https:" && isAlgumonHost(url) && url.pathname === "/n/deal";
}

function isHotDealsHost(url: URL) {
  return url.hostname === HOTDEALS_DISCOVERY_HOST || url.hostname === "hotdeals.kr";
}

function isHotDealsKeywordSearchPage(url: URL) {
  return isApprovedHotDealsDiscoverySearchUrl(url);
}

function isHotDealsFeedPage(url: URL) {
  return url.protocol === "https:" && isHotDealsHost(url) && url.pathname === HOTDEALS_DISCOVERY_FEED_PATH;
}

function isAllowedHotDealsHost(url: URL, allowedHosts: ReadonlySet<string>) {
  return allowedHosts.has(url.hostname.toLowerCase()) || (isHotDealsHost(url) && (allowedHosts.has(HOTDEALS_DISCOVERY_HOST) || allowedHosts.has("hotdeals.kr")));
}

function isDiscoveryOnlyProviderProduct(product: Pick<ProviderProduct, "source">) {
  if (product.source === "algumon_discovery") return true;
  return product.source === "hotdeals_discovery";
}

function extractAlgumonDiscoveryCards(html: string, category: Category, keyword: string, pageUrl: string): ProviderProduct[] {
  const page = new URL(pageUrl);
  const observedAt = new Date().toISOString();

  return parseAlgumonCoupangDiscovery(html).map((record) => ({
    source: "algumon_discovery",
    source_product_id: `algumon:${record.dealId}`,
    category,
    keyword,
    title: `[알구몬 후보 #${record.dealId}] ${record.title}`.slice(0, 140),
    brand: null,
    model_name: null,
    image_url: null,
    source_url: page.toString(),
    coupang_url: null,
    affiliate_url: null,
    source_price: null,
    return_price: null,
    new_price: null,
    condition_grade: "확인필요",
    stock_count: null,
    raw_json: {
      provider: "algumon_discovery",
      candidate_kind: "discovery_only",
      source_title: record.title,
      page_url: pageUrl,
      source_deal_id: record.dealId,
      source_site_name: record.siteName,
      store_name: record.storeName,
      displayed_price_text: record.displayedPriceText,
      delivery_info_text: record.deliveryInfoText,
      source_created_at: record.sourceCreatedAt,
      observed_at: observedAt,
      requires_manual_coupang_url: true,
      outbound_not_fetched: true
    }
  }));
}

function extractHotDealsDiscoveryCards(html: string, category: Category, keyword: string, pageUrl: string): ProviderProduct[] {
  const page = new URL(pageUrl);
  const observedAt = new Date().toISOString();

  return parseHotDealsCoupangDiscovery(html, pageUrl, keyword).map((record) => ({
    source: "hotdeals_discovery",
    source_product_id: `hotdeals:${record.siteId}:${record.dealId}`,
    category,
    keyword,
    title: record.title.slice(0, 140),
    brand: null,
    model_name: null,
    image_url: null,
    source_url: record.sourceUrl,
    coupang_url: null,
    affiliate_url: null,
    source_price: null,
    return_price: null,
    new_price: null,
    condition_grade: "확인필요",
    stock_count: null,
    raw_json: {
      provider: "hotdeals_discovery",
      candidate_kind: "discovery_only",
      discovery_only: true,
      source_title: record.title,
      source_site: record.siteId,
      source_site_id: record.siteId,
      source_deal_id: record.dealId,
      source_url: record.sourceUrl,
      page_url: page.toString(),
      observed_at: observedAt,
      requires_manual_coupang_url: true,
      outbound_not_fetched: true
    }
  }));
}

function extractCards(html: string, category: Category, keyword: string, pageUrl: string, allowedHosts: ReadonlySet<string>): ProviderProduct[] {
  const base = new URL(pageUrl);
  if (isAlgumonHost(base)) {
    if (!allowedHosts.has(base.hostname.toLowerCase())) return [];
    return isAlgumonDealSearchPage(base) ? extractAlgumonDiscoveryCards(html, category, keyword, pageUrl) : [];
  }
  if (isHotDealsHost(base)) {
    if (!isAllowedHotDealsHost(base, allowedHosts)) return [];
    if (isHotDealsFeedPage(base)) {
      const observedAt = new Date().toISOString();
      return parseHotDealsCoupangDiscoveryFeed(html, pageUrl, keyword).map((record) => ({
        source: "hotdeals_discovery",
        source_product_id: `hotdeals:${record.siteId}:${record.dealId}`,
        category,
        keyword,
        title: record.title.slice(0, 140),
        brand: null,
        model_name: null,
        image_url: null,
        source_url: record.sourceUrl,
        coupang_url: null,
        affiliate_url: null,
        source_price: null,
        return_price: null,
        new_price: null,
        condition_grade: "확인필요",
        stock_count: null,
        raw_json: {
          provider: "hotdeals_discovery",
          candidate_kind: "discovery_only",
          discovery_only: true,
          source_title: record.title,
          source_site: record.siteId,
          source_site_id: record.siteId,
          source_deal_id: record.dealId,
          source_url: record.sourceUrl,
          page_url: pageUrl,
          observed_at: observedAt,
          requires_manual_coupang_url: true,
          outbound_not_fetched: true,
          feed_only: true
        }
      }));
    }
    return isHotDealsKeywordSearchPage(base) ? extractHotDealsDiscoveryCards(html, category, keyword, pageUrl) : [];
  }
  const anchorMatches = extractVisibleAnchorBlocks(html).filter((match) => match.inner.length <= 1500);
  const products: ProviderProduct[] = [];
  const seenProductKeys = new Set<string>();

  for (const [index, match] of anchorMatches.entries()) {
    const productUrl = safeAllowlistedPublicUrl(match.href, base, allowedHosts);
    if (!productUrl) continue;
    const href = productUrl.toString();
    const productKey = `url:${href}`;
    if (seenProductKeys.has(productKey)) continue;
    const block = `${match.opening}${match.inner}</a>`;
    const text = cleanText(block);
    const returnInfo = extractReturnInfoFromText(block);
    const listedPrice = extractListedPriceFromText(block);
    if (!returnInfo.isReturnCandidate && !isLikelyProductCard(base, productUrl, text)) continue;
    seenProductKeys.add(productKey);
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
      source_price: listedPrice,
      return_price: returnInfo.return_price,
      new_price: null,
      condition_grade: returnInfo.condition_grade ?? "확인필요",
      stock_count: returnInfo.stock_count,
      raw_json: {
        provider: "public_web",
        page_url: pageUrl,
        anchor_index: index,
        candidate_kind: returnInfo.isReturnCandidate ? "return_evidence" : "product_without_return_evidence",
        price_analysis: {
          listed_price: listedPrice,
          listed_price_source: listedPrice != null ? "explicit_listed_price_label" : null
        },
        web_return_info: toReturnInfoJson(returnInfo)
      }
    });
    if (products.length >= 8) break;
  }

  if (products.length < 8) {
    for (const jsonLdText of extractVisibleJsonLdBlocks(html)) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonLdText.replace(/^\s*<!--|-->\s*$/g, "").trim());
      } catch {
        continue;
      }

      const jsonLdProducts: Array<Record<string, unknown>> = [];
      collectJsonLdProducts(parsed, jsonLdProducts);
      for (const record of jsonLdProducts) {
        const productUrl = readJsonLdUrl(record, base, allowedHosts);
        const name = readJsonLdText(record.name);
        if (!productUrl || name.length < 3) continue;
        const href = productUrl.toString();
        const productKey = `url:${href}`;
        if (seenProductKeys.has(productKey)) continue;

        const additionalProperties = Array.isArray(record.additionalProperty)
          ? record.additionalProperty.map((item) => readJsonLdText(item)).filter(Boolean).join(" ")
          : "";
        const evidenceText = [name, readJsonLdText(record.description), additionalProperties, readJsonLdText(record.itemCondition)].filter(Boolean).join(" ");
        const returnInfo = extractReturnInfoFromText(evidenceText);
        const offerPrice = readJsonLdOfferPrice(record);
        if (!returnInfo.isReturnCandidate && offerPrice == null) continue;

        seenProductKeys.add(productKey);
        products.push({
          source: "public_web",
          source_product_id: href,
          category,
          keyword,
          title: name.slice(0, 140),
          brand: readJsonLdBrand(record),
          model_name: readJsonLdText(record.sku ?? record.mpn) || null,
          image_url: readJsonLdImage(record, base, allowedHosts),
          source_url: href,
          coupang_url: href.includes("coupang.com") ? href : null,
          affiliate_url: null,
          source_price: offerPrice,
          return_price: returnInfo.return_price,
          new_price: null,
          condition_grade: returnInfo.condition_grade ?? "확인필요",
          stock_count: returnInfo.stock_count,
          raw_json: {
            provider: "public_web",
            page_url: pageUrl,
            candidate_kind: returnInfo.isReturnCandidate ? "return_evidence" : "product_without_return_evidence",
            json_ld: {
              type: readJsonLdText(record["@type"]) || null,
              sku: readJsonLdText(record.sku) || null,
              mpn: readJsonLdText(record.mpn) || null,
              offer_price: offerPrice
            },
            web_return_info: toReturnInfoJson(returnInfo)
          }
        });
        if (products.length >= 8) break;
      }
      if (products.length >= 8) break;
    }
  }

  return products;
}

function readMetaContent(html: string, names: string[]) {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const nameMatch = tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i);
    const contentMatch = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i);
    if (nameMatch && contentMatch && wanted.has(nameMatch[1].toLowerCase())) {
      return contentMatch[1].trim().slice(0, 2_000) || null;
    }
  }
  return null;
}

function readHtmlTitle(html: string) {
  const match = html.match(/<title\b[^>]*>([\s\S]{0,500}?)<\/title>/i);
  return match?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300) || null;
}

function enrichProductFromDetail(product: ProviderProduct, html: string, detailUrl: URL, allowedHosts: ReadonlySet<string>) {
  const detailEvidenceMarkup = stripSecondaryDetailSections(html);
  const detailInfo = extractReturnInfoFromText(detailEvidenceMarkup);
  const listedPriceCandidates = extractListedPriceCandidatesFromText(detailEvidenceMarkup);
  const listedPrice = listedPriceCandidates.length === 1 ? listedPriceCandidates[0] : null;
  const detailPriceIsAmbiguous = listedPriceCandidates.length > 1;
  const imageValue = readMetaContent(html, ["og:image", "twitter:image"]);
  const detailImage = imageValue ? safeAllowlistedPublicUrl(imageValue, detailUrl, allowedHosts)?.toString() ?? null : null;
  const existingWebInfo = product.raw_json?.web_return_info;
  const detailEvidence = toReturnInfoJson(detailInfo);
  const detailTitle = readMetaContent(html, ["og:title", "twitter:title"]) ?? readHtmlTitle(html);

  return {
    ...product,
    image_url: product.image_url ?? detailImage,
    source_price: product.source_price ?? (detailPriceIsAmbiguous ? null : listedPrice),
    return_price: detailInfo.return_price ?? product.return_price ?? null,
    new_price: product.new_price ?? null,
    condition_grade: detailInfo.condition_grade ?? product.condition_grade ?? "확인필요",
    stock_count: detailInfo.stock_count ?? product.stock_count ?? null,
    raw_json: {
      ...(product.raw_json ?? {}),
      web_return_info: {
        ...(typeof existingWebInfo === "object" && existingWebInfo !== null && !Array.isArray(existingWebInfo) ? existingWebInfo : {}),
        detail_page: {
          ...detailEvidence,
          listed_price: listedPrice,
          listed_price_candidates: listedPriceCandidates,
          listed_price_source:
            listedPrice != null
              ? "explicit_listed_price_label"
              : listedPriceCandidates.length > 1
                ? "ambiguous_multiple_labeled_prices"
                : null
        },
        detail_page_title: detailTitle,
        detail_page_url: detailUrl.toString()
      }
    }
  };
}

async function enrichProductDetails(
  products: ProviderProduct[],
  allowedHosts: ReadonlySet<string>,
  diagnostics: PublicWebDiagnostic[]
) {
  const enriched = [...products];
  const seenUrls = new Set<string>();
  let requestCount = 0;

  for (const [index, product] of enriched.entries()) {
    if (requestCount >= MAX_PUBLIC_WEB_DETAIL_PAGES) break;
    if (isDiscoveryOnlyProviderProduct(product)) {
      diagnostics.push({ stage: "detail", status: "DISCOVERY_ONLY_DETAIL_SKIPPED", url: product.source_url ?? undefined });
      continue;
    }
    if (!product.source_url) continue;

    let detailUrl: URL;
    try {
      const safeDetailUrl = safeAllowlistedPublicUrl(product.source_url, new URL(product.source_url), allowedHosts);
      if (!safeDetailUrl) continue;
      detailUrl = safeDetailUrl;
    } catch {
      continue;
    }
    if (!detailUrl || detailUrl.pathname === "/") continue;
    const normalizedUrl = detailUrl.toString();
    if (seenUrls.has(normalizedUrl)) continue;
    seenUrls.add(normalizedUrl);

    const searchPageUrl = typeof product.raw_json?.page_url === "string" ? product.raw_json.page_url : null;
    if (searchPageUrl && normalizedUrl === searchPageUrl) continue;

    const robots = await getRobots(detailUrl.origin);
    if (robots.status !== "ok") {
      diagnostics.push({ stage: "detail", status: "ROBOTS_UNAVAILABLE", url: normalizedUrl, robots_status: robots.status, error: robots.error });
      continue;
    }
    if (!isPathAllowedByRobots(robots.text, detailUrl.pathname, crawlUserAgent())) {
      diagnostics.push({ stage: "detail", status: "ROBOTS_DISALLOWED", url: normalizedUrl, robots_status: robots.status });
      continue;
    }

    const crawlDelaySeconds = crawlDelaySecondsForRobots(robots.text, crawlUserAgent());
    if (crawlDelaySeconds != null && crawlDelaySeconds > MAX_SUPPORTED_CRAWL_DELAY_SECONDS) {
      diagnostics.push({ stage: "detail", status: "CRAWL_DELAY_TOO_HIGH", url: normalizedUrl, error: `CRAWL_DELAY_${crawlDelaySeconds}` });
      continue;
    }

    requestCount += 1;
    await waitForOriginRateLimit(detailUrl.origin, Math.max(DEFAULT_PUBLIC_WEB_REQUEST_DELAY_MS, Math.ceil((crawlDelaySeconds ?? 0) * 1000)));
    const response = await fetchWithTimeout(normalizedUrl, {
      headers: { "User-Agent": crawlUserAgent(), Accept: "text/html,application/xhtml+xml" },
      redirect: "manual",
      cache: "no-store"
    });
    if (response.status >= 300 && response.status < 400) {
      diagnostics.push({ stage: "detail", status: "REDIRECT_BLOCKED", url: normalizedUrl, error: safeRedirectTarget(response.headers.get("location"), detailUrl, response.status) });
      continue;
    }
    if (!response.ok) {
      diagnostics.push({ stage: "detail", status: "HTTP_ERROR", url: normalizedUrl, error: `HTTP_${response.status}` });
      continue;
    }

    const contentType = response.headers.get("content-type");
    if (!isHtmlContentType(contentType)) {
      diagnostics.push({ stage: "detail", status: "UNSUPPORTED_CONTENT_TYPE", url: normalizedUrl, content_type: contentType, error: contentType ?? "MISSING_CONTENT_TYPE" });
      continue;
    }
    const htmlResult = await readTextWithLimit(response, MAX_PUBLIC_WEB_HTML_BYTES);
    if (htmlResult.status !== "ok") {
      diagnostics.push({ stage: "detail", status: "CONTENT_TOO_LARGE", url: normalizedUrl, error: htmlResult.error });
      continue;
    }

    enriched[index] = enrichProductFromDetail(product, htmlResult.text, detailUrl, allowedHosts);
    diagnostics.push({
      stage: "detail",
      status: "FETCHED_DETAIL",
      url: normalizedUrl,
      robots_status: robots.status,
      crawl_delay_seconds: crawlDelaySeconds,
      content_type: contentType
    });
  }

  return enriched;
}

function compactInspectionDiagnostics(diagnostics: PublicWebDiagnostic[]) {
  return diagnostics.slice(0, 6).map((item) => ({
    status: item.status,
    stage: item.stage ?? null,
    url: item.url ?? null,
    error: item.error ?? null,
    robots_status: item.robots_status ?? null,
    crawl_delay_seconds: item.crawl_delay_seconds ?? null,
    content_type: item.content_type ?? null,
    extracted_count: item.extracted_count ?? null
  }));
}

function emptyInspectionMetadata() {
  return {
    title: null,
    image_url: null,
    source_price: null,
    return_price: null,
    condition_grade: null,
    stock_count: null
  } as const;
}

/** Inspect one explicit allowlisted page without creating or publishing a product. */
export async function inspectPublicWebProductUrl(input: PublicWebProductInspectionInput): Promise<PublicWebProductInspectionResult> {
  const deadlineAt =
    typeof input.deadlineAt === "number" && Number.isFinite(input.deadlineAt)
      ? input.deadlineAt
      : Date.now() + DEFAULT_PUBLIC_WEB_INSPECTION_BUDGET_MS;

  if (!isEnabled()) {
    return { status: "DISABLED", url: null, enriched_metadata: emptyInspectionMetadata(), fields_filled: [], diagnostics: [], raw_json: {} };
  }

  const rawUrl = input.url.trim();
  if (!rawUrl) {
    return { status: "INVALID_URL", url: null, enriched_metadata: emptyInspectionMetadata(), fields_filled: [], diagnostics: [], raw_json: {} };
  }

  const hosts = allowedHosts();
  if (!hosts.size || hosts.size > MAX_PUBLIC_WEB_ALLOWED_HOSTS || Array.from(hosts).some((host) => !isPublicWebHostname(host))) {
    return {
      status: "INVALID_CONFIG",
      url: null,
      enriched_metadata: emptyInspectionMetadata(),
      fields_filled: [],
      diagnostics: [{ stage: "detail", status: "INVALID_CONFIG", error: "PUBLIC_WEB_ALLOWED_HOSTS_INVALID" }],
      raw_json: {}
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { status: "INVALID_URL", url: null, enriched_metadata: emptyInspectionMetadata(), fields_filled: [], diagnostics: [], raw_json: {} };
  }
  if (parsed.protocol !== "https:") {
    return { status: "HTTPS_REQUIRED", url: null, enriched_metadata: emptyInspectionMetadata(), fields_filled: [], diagnostics: [{ stage: "detail", status: "HTTPS_REQUIRED" }], raw_json: {} };
  }

  const detailUrl = safeAllowlistedPublicUrl(rawUrl, parsed, hosts);
  if (!detailUrl) {
    return {
      status: "HOST_NOT_ALLOWED",
      url: null,
      enriched_metadata: emptyInspectionMetadata(),
      fields_filled: [],
      diagnostics: [{ stage: "detail", status: "HOST_NOT_ALLOWED", url: rawUrl.slice(0, 240) }],
      raw_json: {}
    };
  }
  if (detailUrl.pathname === "/") {
    return {
      status: "PRODUCT_PATH_REQUIRED",
      url: detailUrl.toString(),
      enriched_metadata: emptyInspectionMetadata(),
      fields_filled: [],
      diagnostics: [{ stage: "detail", status: "PRODUCT_PATH_REQUIRED", url: detailUrl.toString() }],
      raw_json: {}
    };
  }

  const normalizedUrl = detailUrl.toString();
  if (deadlineAt <= Date.now()) {
    return {
      status: "FETCH_TIMEOUT",
      url: normalizedUrl,
      enriched_metadata: emptyInspectionMetadata(),
      fields_filled: [],
      diagnostics: [{ stage: "detail", status: "FETCH_TIMEOUT", url: normalizedUrl, error: "INSPECTION_DEADLINE_EXCEEDED" }],
      raw_json: {}
    };
  }

  const diagnostics: PublicWebDiagnostic[] = [];
  let robots: RobotsFetchResult | null;
  const robotsPromise = getRobots(detailUrl.origin, Math.min(8_000, deadlineAt - Date.now()), deadlineAt);
  try {
    robots = await withDeadline(robotsPromise, deadlineAt);
  } catch (error) {
    evictRobots(detailUrl.origin, robotsPromise);
    diagnostics.push({ stage: "detail", status: "FETCH_FAILED", url: normalizedUrl, error: error instanceof Error ? error.message.slice(0, 160) : "ROBOTS_FETCH_FAILED" });
    return { status: "FETCH_FAILED", url: normalizedUrl, enriched_metadata: emptyInspectionMetadata(), fields_filled: [], diagnostics, raw_json: {} };
  }
  if (!robots) {
    evictRobots(detailUrl.origin, robotsPromise);
    diagnostics.push({ stage: "detail", status: "FETCH_TIMEOUT", url: normalizedUrl, error: "ROBOTS_DEADLINE_EXCEEDED" });
    return { status: "FETCH_TIMEOUT", url: normalizedUrl, enriched_metadata: emptyInspectionMetadata(), fields_filled: [], diagnostics, raw_json: {} };
  }
  if (robots.status !== "ok") {
    diagnostics.push({ stage: "detail", status: "ROBOTS_UNAVAILABLE", url: normalizedUrl, robots_status: robots.status, error: robots.error });
    return { status: "ROBOTS_UNAVAILABLE", url: normalizedUrl, enriched_metadata: emptyInspectionMetadata(), fields_filled: [], diagnostics, raw_json: {} };
  }
  if (!isPathAllowedByRobots(robots.text, detailUrl.pathname, crawlUserAgent())) {
    diagnostics.push({ stage: "detail", status: "ROBOTS_DISALLOWED", url: normalizedUrl, robots_status: robots.status });
    return { status: "ROBOTS_DISALLOWED", url: normalizedUrl, enriched_metadata: emptyInspectionMetadata(), fields_filled: [], diagnostics, raw_json: {} };
  }

  const crawlDelaySeconds = crawlDelaySecondsForRobots(robots.text, crawlUserAgent());
  if (crawlDelaySeconds != null && crawlDelaySeconds > MAX_SUPPORTED_CRAWL_DELAY_SECONDS) {
    diagnostics.push({ stage: "detail", status: "CRAWL_DELAY_TOO_HIGH", url: normalizedUrl, error: `CRAWL_DELAY_${crawlDelaySeconds}` });
    return { status: "CRAWL_DELAY_TOO_HIGH", url: normalizedUrl, enriched_metadata: emptyInspectionMetadata(), fields_filled: [], diagnostics, raw_json: {} };
  }

  const waitReady = await waitForOriginRateLimit(
    detailUrl.origin,
    Math.max(DEFAULT_PUBLIC_WEB_REQUEST_DELAY_MS, Math.ceil((crawlDelaySeconds ?? 0) * 1000)),
    deadlineAt
  );
  if (!waitReady) {
    diagnostics.push({ stage: "detail", status: "FETCH_TIMEOUT", url: normalizedUrl, error: "RATE_LIMIT_DEADLINE_EXCEEDED" });
    return { status: "FETCH_TIMEOUT", url: normalizedUrl, enriched_metadata: emptyInspectionMetadata(), fields_filled: [], diagnostics, raw_json: {} };
  }

  let response: Response;
  try {
    const remainingMs = deadlineAt - Date.now();
    if (remainingMs <= 0) throw new Error("INSPECTION_DEADLINE_EXCEEDED");
    response = await fetchWithTimeout(normalizedUrl, {
      headers: { "User-Agent": crawlUserAgent(), Accept: "text/html,application/xhtml+xml" },
      redirect: "manual",
      cache: "no-store"
    }, Math.min(8_000, remainingMs));
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 160) : "FETCH_FAILED";
    const timedOut = message === "INSPECTION_DEADLINE_EXCEEDED" || message.toLowerCase().includes("abort");
    diagnostics.push({ stage: "detail", status: timedOut ? "FETCH_TIMEOUT" : "FETCH_FAILED", url: normalizedUrl, error: message });
    return { status: timedOut ? "FETCH_TIMEOUT" : "FETCH_FAILED", url: normalizedUrl, enriched_metadata: emptyInspectionMetadata(), fields_filled: [], diagnostics, raw_json: {} };
  }
  if (response.status >= 300 && response.status < 400) {
    diagnostics.push({ stage: "detail", status: "REDIRECT_BLOCKED", url: normalizedUrl, error: safeRedirectTarget(response.headers.get("location"), detailUrl, response.status) });
    return { status: "REDIRECT_BLOCKED", url: normalizedUrl, enriched_metadata: emptyInspectionMetadata(), fields_filled: [], diagnostics, raw_json: {} };
  }
  if (!response.ok) {
    diagnostics.push({ stage: "detail", status: "HTTP_ERROR", url: normalizedUrl, error: `HTTP_${response.status}` });
    return { status: "HTTP_ERROR", url: normalizedUrl, enriched_metadata: emptyInspectionMetadata(), fields_filled: [], diagnostics, raw_json: {} };
  }

  const contentType = response.headers.get("content-type");
  if (!isHtmlContentType(contentType)) {
    diagnostics.push({ stage: "detail", status: "UNSUPPORTED_CONTENT_TYPE", url: normalizedUrl, content_type: contentType, error: contentType ?? "MISSING_CONTENT_TYPE" });
    return { status: "UNSUPPORTED_CONTENT_TYPE", url: normalizedUrl, enriched_metadata: emptyInspectionMetadata(), fields_filled: [], diagnostics, raw_json: {} };
  }
  let htmlResult: LimitedTextResult;
  try {
    htmlResult = await readTextWithLimit(response, MAX_PUBLIC_WEB_HTML_BYTES, deadlineAt);
  } catch (error) {
    diagnostics.push({ stage: "detail", status: "FETCH_FAILED", url: normalizedUrl, error: error instanceof Error ? error.message.slice(0, 160) : "BODY_READ_FAILED" });
    return { status: "FETCH_FAILED", url: normalizedUrl, enriched_metadata: emptyInspectionMetadata(), fields_filled: [], diagnostics, raw_json: {} };
  }
  if (htmlResult.status !== "ok") {
    diagnostics.push({ stage: "detail", status: htmlResult.status, url: normalizedUrl, error: htmlResult.error });
    return { status: htmlResult.status, url: normalizedUrl, enriched_metadata: emptyInspectionMetadata(), fields_filled: [], diagnostics, raw_json: {} };
  }

  const pageTitle = readMetaContent(htmlResult.text, ["og:title", "twitter:title"]) ?? readHtmlTitle(htmlResult.text);
  const baseProduct: ProviderProduct = {
    source: "public_web_manual",
    source_product_id: null,
    category: input.category,
    keyword: "",
    title: pageTitle || "공개 웹 상품",
    image_url: null,
    source_url: normalizedUrl,
    coupang_url: normalizedUrl,
    affiliate_url: null,
    source_price: null,
    return_price: null,
    new_price: null,
    stock_count: null,
    raw_json: { provider: "public_web_manual" }
  };
  const enriched = enrichProductFromDetail(baseProduct, htmlResult.text, detailUrl, hosts);
  diagnostics.push({
    stage: "detail",
    status: "FETCHED_DETAIL",
    url: normalizedUrl,
    robots_status: robots.status,
    crawl_delay_seconds: crawlDelaySeconds,
    content_type: contentType
  });

  const detailPage =
    enriched.raw_json?.web_return_info && typeof enriched.raw_json.web_return_info === "object" && !Array.isArray(enriched.raw_json.web_return_info)
      ? (enriched.raw_json.web_return_info as Record<string, JsonValue>).detail_page
      : null;
  const detailPageRecord = detailPage && typeof detailPage === "object" && !Array.isArray(detailPage) ? (detailPage as Record<string, JsonValue>) : null;
  const extractedConditionGrade = detailPageRecord?.condition_grade;
  const conditionGrade =
    typeof extractedConditionGrade === "string" &&
    ["미개봉", "최상", "상", "중", "알수없음"].includes(extractedConditionGrade)
      ? (extractedConditionGrade as ConditionGrade)
      : null;
  const enrichedMetadata = {
    title: pageTitle ?? null,
    image_url: enriched.image_url ?? null,
    source_price: enriched.source_price ?? null,
    return_price: enriched.return_price ?? null,
    condition_grade: conditionGrade,
    stock_count: enriched.stock_count ?? null
  };
  const fieldsFilled = Object.entries(enrichedMetadata)
    .filter(([, value]) => value !== null && value !== "")
    .map(([key]) => key);
  const rawJson = {
    ...(enriched.raw_json ?? {}),
    public_web_inspection: {
      url: normalizedUrl,
      status: "ok",
      diagnostics: compactInspectionDiagnostics(diagnostics)
    }
  } satisfies Record<string, JsonValue>;

  return { status: "ok", url: normalizedUrl, enriched_metadata: enrichedMetadata, fields_filled: fieldsFilled, diagnostics, raw_json: rawJson };
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

  const invalidHost = Array.from(hosts).find((host) => !isPublicWebHostname(host));
  if (invalidHost) {
    const diagnostics: PublicWebDiagnostic[] = [{ status: "INVALID_TEMPLATE", error: "PUBLIC_WEB_ALLOWED_HOSTS_CONTAINS_INVALID_HOST" }];
    return {
      status: "INVALID_TEMPLATE",
      products: [],
      error: `PUBLIC_WEB_ALLOWED_HOSTS contains an invalid host: ${invalidHost.slice(0, 120)}`,
      meta: buildPublicWebMeta(diagnostics, hosts, templates)
    };
  }

  const invalidTemplate = templates.find((template) => {
    const parsed = safeTemplateUrl(template, "returnpick-test");
    return !parsed || !hosts.has(parsed.hostname.toLowerCase());
  });
  if (invalidTemplate) {
    const diagnostics: PublicWebDiagnostic[] = [{ status: "INVALID_TEMPLATE", error: "PUBLIC_WEB_CONFIG_INVALID_BEFORE_FETCH" }];
    return {
      status: "INVALID_TEMPLATE",
      products: [],
      error: "PUBLIC_WEB_SEARCH_TEMPLATES contains an invalid or non-allowlisted URL.",
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
      diagnostics.push({ stage: "search", status: "ROBOTS_UNAVAILABLE", url, robots_status: robots.status, error: robots.error });
      continue;
    }
    if (!isPathAllowedByRobots(robots.text, parsed.pathname, crawlUserAgent())) {
      diagnostics.push({ stage: "search", status: "ROBOTS_DISALLOWED", url, robots_status: robots.status });
      continue;
    }

    const crawlDelaySeconds = crawlDelaySecondsForRobots(robots.text, crawlUserAgent());
    if (crawlDelaySeconds != null && crawlDelaySeconds > MAX_SUPPORTED_CRAWL_DELAY_SECONDS) {
      diagnostics.push({ stage: "search", status: "CRAWL_DELAY_TOO_HIGH", url, error: `CRAWL_DELAY_${crawlDelaySeconds}` });
      continue;
    }
    const requestDelayMs = Math.max(DEFAULT_PUBLIC_WEB_REQUEST_DELAY_MS, Math.ceil((crawlDelaySeconds ?? 0) * 1000));
    await waitForOriginRateLimit(parsed.origin, requestDelayMs);

    const response = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": crawlUserAgent(),
        Accept: "text/html,application/xhtml+xml,application/rss+xml,application/atom+xml,application/xml;q=0.9,text/xml;q=0.8"
      },
      redirect: "manual",
      cache: "no-store"
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      diagnostics.push({
        stage: "search",
        status: "REDIRECT_BLOCKED",
        url,
        error: safeRedirectTarget(location, parsed, response.status)
      });
      continue;
    }
    if (!response.ok) {
      diagnostics.push({ stage: "search", status: "HTTP_ERROR", url, error: `HTTP_${response.status}` });
      continue;
    }

    const contentType = response.headers.get("content-type");
    if (!isAllowedPublicWebSearchContentType(contentType, parsed)) {
      diagnostics.push({ stage: "search", status: "UNSUPPORTED_CONTENT_TYPE", url, content_type: contentType, error: contentType ?? "MISSING_CONTENT_TYPE" });
      continue;
    }

    const htmlResult = await readTextWithLimit(response, MAX_PUBLIC_WEB_HTML_BYTES);
    if (htmlResult.status !== "ok") {
      diagnostics.push({ stage: "search", status: "CONTENT_TOO_LARGE", url, error: htmlResult.error });
      continue;
    }

    const html = htmlResult.text;
    const extracted = extractCards(html, category, keyword, url, hosts);
    diagnostics.push({
      stage: "search",
      status: "FETCHED_HTML",
      url,
      robots_status: robots.status,
      crawl_delay_seconds: crawlDelaySeconds,
      content_type: contentType,
      extracted_count: extracted.length
    });
    products.push(...extracted);
  }

  const enrichedProducts = products.length ? await enrichProductDetails(products, hosts, diagnostics) : products;
  const merged = mergeProviderProductBatches([{ provider: "public_web", products: enrichedProducts }]);
  const meta = buildPublicWebMeta(diagnostics, hosts, templates, merged.deduplicatedCount);
  if (merged.products.length) return { status: "ok", products: merged.products, meta };
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
  return { status: "ok", products: merged.products, meta };
}
