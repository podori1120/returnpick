import type { JsonValue } from "@/lib/types";
import { isPublicWebHostname } from "@/lib/publicWebUrlSafety";

export type PublicWebEvidence = {
  evidence: string[];
  confidence: number | null;
  isReturnCandidate: boolean;
  sourceUrl: string | null;
  sourceTitle: string | null;
};

function asRecord(value: JsonValue | undefined): Record<string, JsonValue> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function textList(value: JsonValue | undefined) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function safePublicSourceUrl(value: JsonValue | undefined) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || !isPublicWebHostname(parsed.hostname)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function getPublicWebEvidence(raw: Record<string, JsonValue>): PublicWebEvidence | null {
  const info = asRecord(raw.web_return_info);
  if (!info) return null;
  const detail = asRecord(info.detail_page);
  const evidence = Array.from(new Set([...textList(info.evidence), ...textList(detail?.evidence)])).slice(0, 8);
  const confidence = typeof info.confidence === "number" ? info.confidence : typeof detail?.confidence === "number" ? detail.confidence : null;
  const sourceUrl = safePublicSourceUrl(info.detail_page_url) ?? safePublicSourceUrl(info.page_url);
  const sourceTitle = typeof info.detail_page_title === "string" && info.detail_page_title.trim() ? info.detail_page_title.trim().slice(0, 200) : null;
  const isReturnCandidate = Boolean(info.is_return_candidate) || Boolean(detail?.is_return_candidate);

  if (!isReturnCandidate && evidence.length === 0) return null;
  return { evidence, confidence, isReturnCandidate, sourceUrl, sourceTitle };
}
