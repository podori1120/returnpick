export const MAX_HOTDEALS_DISCOVERY_RESULTS = 8;
export const MAX_HOTDEALS_HTML_CHARS = 750_000;
export const MAX_HOTDEALS_RECORDS_SCANNED = 120;

const HOTDEALS_CANONICAL_HOST = "www.hotdeals.kr";
const HOTDEALS_HOSTS = new Set([HOTDEALS_CANONICAL_HOST, "hotdeals.kr"]);
const MAX_HOTDEALS_TITLE_CHARS = 300;
const voidHtmlTagNames = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const rawHtmlTagNames = new Set(["script", "style", "noscript", "template"]);

export type HotDealsCoupangDiscoveryRecord = {
  siteId: string;
  dealId: string;
  title: string;
  sourceUrl: string;
};

function normalizeDiscoveryKeyword(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export function matchesHotDealsDiscoveryKeyword(title: string, keyword: string) {
  const normalizedKeyword = normalizeDiscoveryKeyword(keyword);
  if (normalizedKeyword.length < 2) return false;
  return normalizeDiscoveryKeyword(title).includes(normalizedKeyword);
}

type OpenTag = { name: string; hidden: boolean; hotDealsList?: boolean };
type TagRange = { start: number; end: number };

function isHotDealsHost(hostname: string) {
  return HOTDEALS_HOSTS.has(hostname.toLowerCase());
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
    while (index < end && /[\s/]/u.test(opening[index])) index += 1;
    if (index >= end || !/[A-Za-z_:]/u.test(opening[index])) {
      index += 1;
      continue;
    }
    const nameStart = index;
    index += 1;
    while (index < end && /[\w:.-]/u.test(opening[index])) index += 1;
    const name = opening.slice(nameStart, index);
    while (index < end && /\s/u.test(opening[index])) index += 1;

    let value: string | null = "";
    if (opening[index] === "=") {
      index += 1;
      while (index < end && /\s/u.test(opening[index])) index += 1;
      const quote = opening[index];
      if (quote === '"' || quote === "'") {
        index += 1;
        const valueStart = index;
        while (index < end && opening[index] !== quote) index += 1;
        value = opening.slice(valueStart, index);
        if (index < end) index += 1;
      } else {
        const valueStart = index;
        while (index < end && !/[\s>]/u.test(opening[index])) index += 1;
        value = opening.slice(valueStart, index);
      }
    }
    if (name.toLowerCase() === target.toLowerCase()) return value;
  }
  return null;
}

function hasClassToken(opening: string, target: string) {
  const className = readOpeningAttribute(opening, "class") ?? "";
  return className
    .split(/\s+/u)
    .map((item) => item.trim().toLowerCase())
    .includes(target.toLowerCase());
}

function isHiddenOpeningTag(opening: string) {
  if (readOpeningAttribute(opening, "hidden") !== null) return true;
  const ariaHidden = (readOpeningAttribute(opening, "aria-hidden") ?? "").trim().toLowerCase();
  if (ariaHidden === "true") return true;
  const style = readOpeningAttribute(opening, "style") ?? "";
  if (/(?:display\s*:\s*none|visibility\s*:\s*hidden)/iu.test(style)) return true;
  return ["hidden", "sr-only", "visually-hidden", "invisible", "d-none"].some((className) => hasClassToken(opening, className));
}

function isSelfClosingOpening(name: string, opening: string) {
  return voidHtmlTagNames.has(name) || /\/\s*>$/u.test(opening);
}

function isPotentialHtmlTagStart(source: string, index: number) {
  const character = source[index + 1];
  return character === "/" || character === "!" || character === "?" || (character != null && /[A-Za-z]/u.test(character));
}

function findRawClosingTag(source: string, start: number, name: string) {
  const match = new RegExp(`<\\s*\\/\\s*${name}\\b[^>]*>`, "iu").exec(source.slice(start));
  if (!match) return null;
  const closingStart = start + (match.index ?? 0);
  return { start: closingStart, end: closingStart + match[0].length - 1 } satisfies TagRange;
}

function findClosingAnchor(source: string, start: number): TagRange | null {
  let cursor = start;
  while (cursor < source.length) {
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
    const opening = token.match(/^<\s*([a-z][\w:-]*)\b([\s\S]*?)>$/iu);
    if (opening && rawHtmlTagNames.has(opening[1].toLowerCase())) {
      const rawClosing = findRawClosingTag(source, tagEnd + 1, opening[1].toLowerCase());
      if (!rawClosing) return null;
      cursor = rawClosing.end + 1;
      continue;
    }
    if (/^<\s*\/\s*a\s*>$/iu.test(token)) return { start: tagStart, end: tagEnd };
    cursor = tagEnd + 1;
  }
  return null;
}

function findClosingNamedTag(source: string, start: number, target: string): TagRange | null {
  let depth = 1;
  let cursor = start;
  while (cursor < source.length) {
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
    const closing = token.match(/^<\s*\/\s*([a-z][\w:-]*)\b[^>]*>$/iu);
    if (closing && closing[1].toLowerCase() === target) {
      depth -= 1;
      if (depth === 0) return { start: tagStart, end: tagEnd };
    } else {
      const opening = token.match(/^<\s*([a-z][\w:-]*)\b([\s\S]*?)>$/iu);
      const name = opening?.[1].toLowerCase();
      if (name && name === target && !isSelfClosingOpening(name, token)) depth += 1;
      if (name && rawHtmlTagNames.has(name)) {
        const rawClosing = findRawClosingTag(source, tagEnd + 1, name);
        if (!rawClosing) return null;
        cursor = rawClosing.end + 1;
        continue;
      }
    }
    cursor = tagEnd + 1;
  }
  return null;
}

function popOpenTag(tags: OpenTag[], name: string) {
  for (let index = tags.length - 1; index >= 0; index -= 1) {
    if (tags[index].name === name) {
      tags.splice(index);
      return;
    }
  }
}

function hasHotDealsListParent(tags: OpenTag[]) {
  return tags.length > 0 && tags[tags.length - 1].hotDealsList === true;
}

function decodeHtmlEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"'
  };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/giu, (entity, body: string) => {
    const lower = body.toLowerCase();
    if (lower in named) return named[lower];
    if (lower.startsWith("#x")) {
      const codePoint = Number.parseInt(lower.slice(2), 16);
      return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
    }
    if (lower.startsWith("#")) {
      const codePoint = Number.parseInt(lower.slice(1), 10);
      return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
    }
    return entity;
  });
}

function extractVisibleText(source: string) {
  const openTags: OpenTag[] = [];
  const text: string[] = [];
  let cursor = 0;

  while (cursor < source.length) {
    const tagStart = source.indexOf("<", cursor);
    if (tagStart < 0) {
      if (!openTags.some((tag) => tag.hidden)) text.push(decodeHtmlEntities(source.slice(cursor)));
      break;
    }
    if (!openTags.some((tag) => tag.hidden)) text.push(decodeHtmlEntities(source.slice(cursor, tagStart)));
    if (source.startsWith("<!--", tagStart)) {
      const commentEnd = source.indexOf("-->", tagStart + 4);
      if (commentEnd < 0) break;
      cursor = commentEnd + 3;
      continue;
    }
    if (!isPotentialHtmlTagStart(source, tagStart)) {
      cursor = tagStart + 1;
      continue;
    }
    const tagEnd = findHtmlTagEnd(source, tagStart);
    if (tagEnd < 0) break;
    const token = source.slice(tagStart, tagEnd + 1);
    const closing = token.match(/^<\s*\/\s*([a-z][\w:-]*)\b[^>]*>$/iu);
    if (closing) {
      popOpenTag(openTags, closing[1].toLowerCase());
      cursor = tagEnd + 1;
      continue;
    }
    const opening = token.match(/^<\s*([a-z][\w:-]*)\b([\s\S]*?)>$/iu);
    if (!opening) {
      cursor = tagEnd + 1;
      continue;
    }
    const name = opening[1].toLowerCase();
    if (rawHtmlTagNames.has(name)) {
      const rawClosing = findRawClosingTag(source, tagEnd + 1, name);
      if (!rawClosing) break;
      cursor = rawClosing.end + 1;
      continue;
    }
    if ((name === "br" || name === "p" || name === "div" || name === "li") && !openTags.some((tag) => tag.hidden)) text.push(" ");
    if (!isSelfClosingOpening(name, token)) {
      openTags.push({
        name,
        hidden: openTags.some((tag) => tag.hidden) || isHiddenOpeningTag(token),
        hotDealsList: hasClassToken(token, "public-deal-list")
      });
    }
    cursor = tagEnd + 1;
  }

  return text.join("").replace(/\s+/gu, " ").trim();
}

function extractVisibleH2Title(inner: string) {
  const openTags: OpenTag[] = [];
  let cursor = 0;

  while (cursor < inner.length) {
    const tagStart = inner.indexOf("<", cursor);
    if (tagStart < 0) return null;
    if (inner.startsWith("<!--", tagStart)) {
      const commentEnd = inner.indexOf("-->", tagStart + 4);
      if (commentEnd < 0) return null;
      cursor = commentEnd + 3;
      continue;
    }
    if (!isPotentialHtmlTagStart(inner, tagStart)) {
      cursor = tagStart + 1;
      continue;
    }
    const tagEnd = findHtmlTagEnd(inner, tagStart);
    if (tagEnd < 0) return null;
    const token = inner.slice(tagStart, tagEnd + 1);
    const closing = token.match(/^<\s*\/\s*([a-z][\w:-]*)\b[^>]*>$/iu);
    if (closing) {
      popOpenTag(openTags, closing[1].toLowerCase());
      cursor = tagEnd + 1;
      continue;
    }
    const opening = token.match(/^<\s*([a-z][\w:-]*)\b([\s\S]*?)>$/iu);
    if (!opening) {
      cursor = tagEnd + 1;
      continue;
    }
    const name = opening[1].toLowerCase();
    if (rawHtmlTagNames.has(name)) {
      const rawClosing = findRawClosingTag(inner, tagEnd + 1, name);
      if (!rawClosing) return null;
      cursor = rawClosing.end + 1;
      continue;
    }
    const hidden = openTags.some((tag) => tag.hidden) || isHiddenOpeningTag(token);
    if (name === "h2") {
      const closingTag = findClosingNamedTag(inner, tagEnd + 1, name);
      if (!closingTag) return null;
      if (hidden) return null;
      const title = extractVisibleText(inner.slice(tagEnd + 1, closingTag.start));
      return title && title.length <= MAX_HOTDEALS_TITLE_CHARS ? title : null;
    }
    if (!isSelfClosingOpening(name, token)) {
      openTags.push({ name, hidden, hotDealsList: hasClassToken(token, "public-deal-list") });
    }
    cursor = tagEnd + 1;
  }
  return null;
}

function parseHotDealsDetailUrl(rawHref: string, page: URL) {
  try {
    const href = decodeHtmlEntities(rawHref.trim());
    const parsed = new URL(href, page);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || !isHotDealsHost(parsed.hostname)) return null;
    if (parsed.search || parsed.hash) return null;
    const match = parsed.pathname.match(/^\/deals\/([A-Za-z0-9_-]+)\/(\d+)$/u);
    if (!match) return null;
    return {
      siteId: match[1],
      dealId: match[2],
      sourceUrl: `https://${HOTDEALS_CANONICAL_HOST}${parsed.pathname}`
    };
  } catch {
    return null;
  }
}

export function parseHotDealsCoupangDiscovery(html: string, pageUrl: string, keyword?: string): HotDealsCoupangDiscoveryRecord[] {
  if (!html || html.length > MAX_HOTDEALS_HTML_CHARS) return [];

  let page: URL;
  try {
    page = new URL(pageUrl);
  } catch {
    return [];
  }
  if (page.protocol !== "https:" || !isHotDealsHost(page.hostname)) return [];

  const records: HotDealsCoupangDiscoveryRecord[] = [];
  const seen = new Set<string>();
  const openTags: OpenTag[] = [];
  let cursor = 0;
  let scanned = 0;

  while (cursor < html.length && scanned < MAX_HOTDEALS_RECORDS_SCANNED && records.length < MAX_HOTDEALS_DISCOVERY_RESULTS) {
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
    const closing = token.match(/^<\s*\/\s*([a-z][\w:-]*)\b[^>]*>$/iu);
    if (closing) {
      popOpenTag(openTags, closing[1].toLowerCase());
      cursor = tagEnd + 1;
      continue;
    }
    const opening = token.match(/^<\s*([a-z][\w:-]*)\b([\s\S]*?)>$/iu);
    if (!opening) {
      cursor = tagEnd + 1;
      continue;
    }
    const name = opening[1].toLowerCase();
    if (rawHtmlTagNames.has(name)) {
      const rawClosing = findRawClosingTag(html, tagEnd + 1, name);
      if (!rawClosing) break;
      cursor = rawClosing.end + 1;
      continue;
    }

    if (name === "a") {
      scanned += 1;
      const closingAnchor = findClosingAnchor(html, tagEnd + 1);
      if (!closingAnchor) break;
      const hidden = openTags.some((tag) => tag.hidden) || isHiddenOpeningTag(token);
      if (!hidden && hasClassToken(token, "public-deal-card") && hasHotDealsListParent(openTags)) {
        const canonical = parseHotDealsDetailUrl(readOpeningAttribute(token, "href") ?? "", page);
        const title = extractVisibleH2Title(html.slice(tagEnd + 1, closingAnchor.start));
        const keywordMatches = keyword == null || matchesHotDealsDiscoveryKeyword(title ?? "", keyword);
        if (canonical && title && keywordMatches && title.startsWith("[쿠팡]") && title.length <= MAX_HOTDEALS_TITLE_CHARS) {
          const key = `${canonical.siteId}:${canonical.dealId}`;
          if (!seen.has(key)) {
            seen.add(key);
            records.push({ ...canonical, title });
          }
        }
      }
      cursor = closingAnchor.end + 1;
      continue;
    }

    if (!isSelfClosingOpening(name, token)) {
      openTags.push({
        name,
        hidden: openTags.some((tag) => tag.hidden) || isHiddenOpeningTag(token),
        hotDealsList: hasClassToken(token, "public-deal-list")
      });
    }
    cursor = tagEnd + 1;
  }

  return records;
}

export const parseHotDealsDiscovery = parseHotDealsCoupangDiscovery;
