import type { Category } from "@/lib/types";
import type { ProviderProduct, ProviderSearchResult } from "@/lib/providers/types";
import { extractReturnInfoFromText, toReturnInfoJson } from "@/lib/webReturnInfo";

const crawlUserAgent = "ReturnPickBot/0.1 (+contact: admin@returnpick.local)";
const robotsCache = new Map<string, Promise<string | null>>();

function isEnabled() {
  return process.env.PUBLIC_WEB_CRAWL_ENABLED === "true";
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

async function getRobots(origin: string) {
  if (!robotsCache.has(origin)) {
    robotsCache.set(
      origin,
      fetch(`${origin}/robots.txt`, {
        headers: { "User-Agent": crawlUserAgent },
        cache: "no-store"
      })
        .then((response) => (response.ok ? response.text() : null))
        .catch(() => null)
    );
  }
  return robotsCache.get(origin)!;
}

function pathMatches(rule: string, pathname: string) {
  if (!rule) return false;
  const escaped = rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}`).test(pathname);
}

function isPathAllowedByRobots(robots: string | null, pathname: string) {
  if (!robots) return true;
  const lines = robots
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, "").trim())
    .filter(Boolean);

  let applies = false;
  const rules: Array<{ type: "allow" | "disallow"; path: string }> = [];

  for (const line of lines) {
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      applies = value === "*";
      continue;
    }
    if (!applies) continue;
    if (key === "allow" || key === "disallow") rules.push({ type: key, path: value });
  }

  const matched = rules
    .filter((rule) => pathMatches(rule.path, pathname))
    .sort((a, b) => b.path.length - a.path.length)[0];
  if (!matched) return true;
  if (matched.type === "allow") return true;
  return matched.path === "";
}

function extractCards(html: string, category: Category, keyword: string, pageUrl: string): ProviderProduct[] {
  const anchorMatches = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]{0,1500}?)<\/a>/gi)];
  const base = new URL(pageUrl);
  const products: ProviderProduct[] = [];

  for (const [index, match] of anchorMatches.entries()) {
    const href = new URL(match[1], base).toString();
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
  if (!hosts.size || !templates.length) return { status: "API_NOT_CONFIGURED", products: [] };

  const products: ProviderProduct[] = [];

  for (const template of templates) {
    const url = template.replace("{keyword}", encodeURIComponent(keyword));
    const parsed = new URL(url);
    if (!hosts.has(parsed.hostname.toLowerCase())) continue;

    const robots = await getRobots(parsed.origin);
    if (!isPathAllowedByRobots(robots, parsed.pathname)) {
      return { status: "ROBOTS_DISALLOWED", products: [] };
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": crawlUserAgent,
        Accept: "text/html,application/xhtml+xml"
      },
      cache: "no-store"
    });
    if (!response.ok) continue;
    const html = await response.text();
    products.push(...extractCards(html, category, keyword, url));
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  return { status: "ok", products };
}
