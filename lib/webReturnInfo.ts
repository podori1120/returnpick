import type { ConditionGrade, JsonValue } from "@/lib/types";

export interface WebReturnInfo {
  isReturnCandidate: boolean;
  condition_grade: ConditionGrade | null;
  return_price: number | null;
  stock_count: number | null;
  evidence: string[];
  confidence: number;
}

export interface ReturnEvidenceSource {
  condition_grade?: ConditionGrade | null;
  return_price?: number | null;
  stock_count?: number | null;
}

const weakConditionGrades: ReadonlySet<ConditionGrade> = new Set(["알수없음", "확인필요"]);

export function resolveConditionGrade(
  providerGrade: ConditionGrade | null | undefined,
  webGrade: ConditionGrade | null | undefined
): ConditionGrade {
  if (providerGrade && !weakConditionGrades.has(providerGrade)) return providerGrade;
  return webGrade ?? providerGrade ?? "확인필요";
}

export function resolveWebReturnEvidence(source: ReturnEvidenceSource, web: WebReturnInfo) {
  return {
    condition_grade: resolveConditionGrade(source.condition_grade, web.condition_grade),
    return_price: source.return_price ?? web.return_price ?? null,
    stock_count: source.stock_count ?? web.stock_count ?? null
  };
}

function standaloneKoreanTerm(term: string) {
  return new RegExp(`(?:^|[^가-힣A-Za-z0-9])${term}(?=$|[^가-힣A-Za-z0-9])`, "i");
}

const gradePatterns: Array<[ConditionGrade, RegExp[]]> = [
  ["미개봉", [standaloneKoreanTerm("미개봉"), /새상품\s*급/i, /미사용\s*(?:품|상품)?/i, /unopened/i]],
  ["최상", [/반품\s*[- ]?\s*최상(?:급)?(?=$|[^가-힣A-Za-z0-9])/i, standaloneKoreanTerm("최상급"), /A\+\s*급/i, /like\s*new/i]],
  ["상", [/반품\s*[- ]?\s*상(?:급)?(?=$|[^가-힣A-Za-z0-9])/i, /상급/i, /A\s*급/i, standaloneKoreanTerm("상")]],
  ["중", [/반품\s*[- ]?\s*중(?:급)?(?=$|[^가-힣A-Za-z0-9])/i, /중급/i, /B\s*급/i, standaloneKoreanTerm("중")]],
  ["알수없음", [/상태\s*(?:미상|불명)/i, /등급\s*(?:미상|불명)/i, /알\s*수\s*없/i]]
];

function cleanText(text: string) {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseReturnPrice(text: string) {
  const moneyPattern = String.raw`([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{5,8})\s*원`;
  const tenThousandPattern = String.raw`([0-9]{1,4}(?:\.[0-9]+)?)\s*만\s*원`;
  const returnPriceLabel = String.raw`(?:반품\s*(?:상품\s*)?(?:가|가격)|리퍼(?:브)?\s*(?:상품\s*)?(?:가|가격)|재포장\s*(?:가|가격))`;
  const wonCandidates = [...text.matchAll(new RegExp(String.raw`${returnPriceLabel}\s*[:：]?\s*${moneyPattern}`, "gi"))]
    .map((match) => Number(match[1].replace(/,/g, "")))
    .filter((value) => Number.isFinite(value) && value >= 10_000);
  const tenThousandCandidates = [...text.matchAll(new RegExp(String.raw`${returnPriceLabel}\s*[:：]?\s*${tenThousandPattern}`, "gi"))]
    .map((match) => Number(match[1]) * 10_000)
    .filter((value) => Number.isFinite(value) && value >= 10_000);
  const allCandidates = [...wonCandidates, ...tenThousandCandidates];
  return allCandidates.length ? Math.min(...allCandidates) : null;
}

function parseStock(text: string) {
  const match = text.match(/(?:재고|잔여|남은\s*수량)\s*[:：]?\s*([0-9]{1,3})\s*(?:개|대)?/) ?? text.match(/([0-9]{1,3})\s*(?:개|대)\s*남(?:음|았)/);
  if (!match?.[1]) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function extractReturnInfoFromText(...parts: Array<string | null | undefined>): WebReturnInfo {
  const text = cleanText(parts.filter(Boolean).join(" "));
  const evidence: string[] = [];
  let condition: ConditionGrade | null = null;

  const isReturnCandidate = /반품|리퍼(?:브)?|재포장|박스\s*훼손|개봉\s*(?:상품|제품|반품)|전시\s*(?:상품|제품)|return|refurb/i.test(text);
  if (isReturnCandidate) evidence.push("제목 또는 설명에 반품·리퍼·재포장·전시상품 관련 표현이 있습니다.");

  for (const [grade, patterns] of gradePatterns) {
    if (patterns.some((pattern) => pattern.test(text))) {
      condition = grade;
      evidence.push(`웹 문구에서 '${grade}' 상태 표현을 찾았습니다.`);
      break;
    }
  }

  const returnPrice = isReturnCandidate ? parseReturnPrice(text) : null;
  if (returnPrice) evidence.push("웹 문구에서 반품가 또는 반품등급에 연결된 가격 표현을 찾았습니다.");

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
