import type { ConditionGrade, JsonValue } from "@/lib/types";

export interface WebReturnInfo {
  isReturnCandidate: boolean;
  condition_grade: ConditionGrade | null;
  return_price: number | null;
  stock_count: number | null;
  evidence: string[];
  confidence: number;
}

const gradePatterns: Array<[ConditionGrade, RegExp[]]> = [
  ["미개봉", [/미개봉/i, /새상품\s*급/i, /unopened/i]],
  ["최상", [/반품\s*[- ]?\s*최상/i, /\b최상\b/i, /like\s*new/i]],
  ["상", [/반품\s*[- ]?\s*상\b/i, /\b상급\b/i, /\b상\b/i]],
  ["중", [/반품\s*[- ]?\s*중\b/i, /\b중급\b/i, /\b중\b/i]],
  ["알수없음", [/상태\s*미상/i, /등급\s*미상/i, /알\s*수\s*없/i]]
];

function cleanText(text: string) {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parsePrice(text: string) {
  const candidates = [...text.matchAll(/(?:반품가|쿠팡가|판매가|가격)?\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{5,8})\s*원/g)]
    .map((match) => Number(match[1].replace(/,/g, "")))
    .filter((value) => Number.isFinite(value) && value >= 10_000);
  return candidates.length ? Math.min(...candidates) : null;
}

function parseStock(text: string) {
  const match = text.match(/(?:재고|잔여|남은\s*수량)\s*([0-9]{1,3})\s*(?:개|대)?/);
  if (!match?.[1]) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function extractReturnInfoFromText(...parts: Array<string | null | undefined>): WebReturnInfo {
  const text = cleanText(parts.filter(Boolean).join(" "));
  const evidence: string[] = [];
  let condition: ConditionGrade | null = null;

  const isReturnCandidate = /반품|리퍼|재포장|박스\s*훼손|개봉\s*반품|return|refurb/i.test(text);
  if (isReturnCandidate) evidence.push("제목 또는 설명에 반품/리퍼/재포장 표현이 있습니다.");

  for (const [grade, patterns] of gradePatterns) {
    if (patterns.some((pattern) => pattern.test(text))) {
      condition = grade;
      evidence.push(`웹 문구에서 '${grade}' 상태 표현을 찾았습니다.`);
      break;
    }
  }

  const returnPrice = isReturnCandidate ? parsePrice(text) : null;
  if (returnPrice) evidence.push("웹 문구에서 가격 표현을 찾았습니다.");

  const stock = parseStock(text);
  if (stock != null) evidence.push("웹 문구에서 재고 표현을 찾았습니다.");

  const confidence = Math.min(100, (isReturnCandidate ? 40 : 0) + (condition ? 30 : 0) + (returnPrice ? 20 : 0) + (stock != null ? 10 : 0));

  return {
    isReturnCandidate,
    condition_grade: condition,
    return_price: returnPrice,
    stock_count: stock,
    evidence,
    confidence
  };
}

export function toReturnInfoJson(info: WebReturnInfo): Record<string, JsonValue> {
  return {
    is_return_candidate: info.isReturnCandidate,
    condition_grade: info.condition_grade,
    return_price: info.return_price,
    stock_count: info.stock_count,
    evidence: info.evidence,
    confidence: info.confidence
  };
}
