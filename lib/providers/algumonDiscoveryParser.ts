export const MAX_ALGUMON_DISCOVERY_RESULTS = 8;

const MAX_ALGUMON_HTML_CHARS = 750_000;
const MAX_ALGUMON_RECORD_CHARS = 8_000;
const MAX_ALGUMON_RECORDS_SCANNED = 120;

export type AlgumonCoupangDiscoveryRecord = {
  dealId: string;
  title: string;
  siteName: string | null;
  storeName: "쿠팡";
  displayedPriceText: string | null;
  deliveryInfoText: string | null;
  sourceCreatedAt: string | null;
};

function findObjectEnd(source: string, start: number) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  const limit = Math.min(source.length, start + MAX_ALGUMON_RECORD_CHARS);

  for (let index = start; index < limit; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return index;
      if (depth < 0) return null;
    }
  }

  return null;
}

function readIntegerField(record: string, field: string) {
  const match = record.match(new RegExp(`(?:^|[,{])${field}:(\\d{1,12})(?=,|})`));
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
}

function decodeStringFragment(value: string) {
  try {
    const decoded = JSON.parse(`"${value}"`);
    return typeof decoded === "string" ? decoded : null;
  } catch {
    return null;
  }
}

function readStringField(record: string, field: string, maxLength: number) {
  const match = record.match(new RegExp(`(?:^|[,{])${field}:"((?:\\\\.|[^"\\\\]){0,${maxLength * 6}})"(?=,|})`));
  if (!match) return null;
  const decoded = decodeStringFragment(match[1]);
  if (decoded == null) return null;
  const normalized = decoded.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function readBooleanField(record: string, field: string) {
  const match = record.match(new RegExp(`(?:^|[,{])${field}:(true|false)(?=,|})`));
  return match ? match[1] === "true" : null;
}

export function parseAlgumonCoupangDiscovery(html: string): AlgumonCoupangDiscoveryRecord[] {
  if (!html || html.length > MAX_ALGUMON_HTML_CHARS) return [];

  const records: AlgumonCoupangDiscoveryRecord[] = [];
  const seenDealIds = new Set<string>();
  let cursor = 0;
  let scanned = 0;

  while (cursor < html.length && scanned < MAX_ALGUMON_RECORDS_SCANNED && records.length < MAX_ALGUMON_DISCOVERY_RESULTS) {
    const start = html.indexOf("{id:", cursor);
    if (start < 0) break;
    scanned += 1;
    cursor = start + 4;

    const end = findObjectEnd(html, start);
    if (end == null) continue;
    cursor = end + 1;
    const record = html.slice(start, end + 1);

    const dealId = readIntegerField(record, "id");
    const storeName = readStringField(record, "storeName", 30);
    const isAd = readBooleanField(record, "isAd");
    const ended = readBooleanField(record, "ended");
    if (!dealId || storeName !== "쿠팡" || isAd !== false || ended !== false || seenDealIds.has(dealId)) continue;

    const title = readStringField(record, "title", 140);
    if (!title || title.length < 3) continue;

    seenDealIds.add(dealId);
    records.push({
      dealId,
      title,
      siteName: readStringField(record, "siteName", 60),
      storeName: "쿠팡",
      displayedPriceText: readStringField(record, "price", 60),
      deliveryInfoText: readStringField(record, "deliveryInfo", 60),
      sourceCreatedAt: readStringField(record, "createdAt", 50)
    });
  }

  return records;
}
