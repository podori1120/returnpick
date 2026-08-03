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
const conditionGrades: ReadonlySet<ConditionGrade> = new Set(["미개봉", "최상", "상", "중", "알수없음", "확인필요"]);

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

const hiddenTagNames = new Set(["script", "style", "noscript", "template"]);
const rawTextTagNames = new Set(["script", "style", "noscript"]);
const voidTagNames = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);

function hasHiddenAttributes(attributes: string) {
  if (/(?:^|\s)hidden(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?(?=\s|\/?$)/i.test(attributes)) return true;
  if (/(?:^|\s)aria-hidden\s*=\s*(?:"true"|'true'|true)(?=\s|\/?$)/i.test(attributes)) return true;
  const styleMatch = attributes.match(/(?:^|\s)style\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  const styleValue = styleMatch?.slice(1).find(Boolean) ?? "";
  return /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(styleValue);
}

function findTagEnd(source: string, start: number) {
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

function findRawTextClosingTag(source: string, start: number, name: string) {
  const closingPattern = new RegExp(`<\\s*\\/\\s*${name}\\b[^>]*>`, "i");
  const match = closingPattern.exec(source.slice(start));
  if (!match) return null;
  const closingStart = start + (match.index ?? 0);
  const closingEnd = closingStart + match[0].length - 1;
  const nextTagStart = source.indexOf("<", closingEnd + 1);
  if (nextTagStart >= 0) {
    const nextClose = closingPattern.exec(source.slice(nextTagStart));
    if (nextClose?.index === 0) {
      return { start: nextTagStart, end: nextTagStart + nextClose[0].length - 1 };
    }
  }
  return { start: closingStart, end: closingEnd };
}

function isPotentialTagStart(source: string, index: number) {
  const character = source[index + 1];
  return character === "/" || character === "!" || character === "?" || (character != null && /[A-Za-z]/.test(character));
}

function stripHtmlComments(text: string) {
  let visible = "";
  let cursor = 0;
  while (cursor < text.length) {
    const commentStart = text.indexOf("<!--", cursor);
    if (commentStart < 0) {
      visible += text.slice(cursor);
      break;
    }
    visible += text.slice(cursor, commentStart);
    const commentEnd = text.indexOf("-->", commentStart + 4);
    if (commentEnd < 0) break;
    cursor = commentEnd + 3;
  }
  return visible;
}

export function stripHiddenMarkup(text: string) {
  const source = stripHtmlComments(text);
  const suppressedTags: string[] = [];
  let visible = "";
  let cursor = 0;

  // Track nested hidden scopes so same-name child tags cannot leak trailing text.
  while (cursor < source.length) {
    const rawTextTag = suppressedTags[suppressedTags.length - 1];
    if (rawTextTagNames.has(rawTextTag)) {
      const rawClosing = findRawTextClosingTag(source, cursor, rawTextTag);
      if (!rawClosing) {
        cursor = source.length;
        break;
      }
      suppressedTags.pop();
      cursor = rawClosing.end + 1;
      continue;
    }
    const tagStart = source.indexOf("<", cursor);
    if (tagStart < 0) {
      if (suppressedTags.length === 0) visible += source.slice(cursor);
      break;
    }
    if (!isPotentialTagStart(source, tagStart)) {
      if (suppressedTags.length === 0) visible += source.slice(cursor, tagStart + 1);
      cursor = tagStart + 1;
      continue;
    }
    const tagEnd = findTagEnd(source, tagStart);
    if (tagEnd < 0) {
      if (suppressedTags.length === 0) visible += source.slice(cursor);
      break;
    }
    if (suppressedTags.length === 0) visible += source.slice(cursor, tagStart);
    const token = source.slice(tagStart, tagEnd + 1);

    const closing = token.match(/^<\s*\/\s*([a-z][\w:-]*)\b[^>]*>$/i);
    if (closing) {
      if (suppressedTags.length > 0) {
        const name = closing[1].toLowerCase();
        const topTag = suppressedTags[suppressedTags.length - 1];
        if (hiddenTagNames.has(topTag)) {
          if (name === topTag) suppressedTags.pop();
        } else {
          const matchingIndex = suppressedTags.lastIndexOf(name);
          if (matchingIndex >= 0) suppressedTags.length = matchingIndex;
        }
      } else {
        visible += token;
      }
      cursor = tagEnd + 1;
      continue;
    }

    const opening = token.match(/^<\s*([a-z][\w:-]*)\b([\s\S]*?)>$/i);
    if (!opening) {
      if (suppressedTags.length === 0) visible += token;
      cursor = tagEnd + 1;
      continue;
    }

    const name = opening[1].toLowerCase();
    const attributes = opening[2] ?? "";
    const selfClosing = voidTagNames.has(name);
    if (suppressedTags.length > 0) {
      const topTag = suppressedTags[suppressedTags.length - 1];
      if (!hiddenTagNames.has(topTag) && !selfClosing) suppressedTags.push(name);
      else if (hiddenTagNames.has(topTag) && hiddenTagNames.has(name) && !selfClosing) suppressedTags.push(name);
    } else if (hiddenTagNames.has(name) || hasHiddenAttributes(attributes)) {
      if (!selfClosing) suppressedTags.push(name);
    } else {
      visible += token;
    }
    cursor = tagEnd + 1;
  }

  if (cursor >= source.length && suppressedTags.length === 0) visible += source.slice(cursor);
  return visible;
}

function stripVisibleMarkupTags(text: string) {
  let visible = "";
  let cursor = 0;
  while (cursor < text.length) {
    const tagStart = text.indexOf("<", cursor);
    if (tagStart < 0) {
      visible += text.slice(cursor);
      break;
    }
    if (!isPotentialTagStart(text, tagStart)) {
      visible += text.slice(cursor, tagStart + 1);
      cursor = tagStart + 1;
      continue;
    }
    const tagEnd = findTagEnd(text, tagStart);
    if (tagEnd < 0) {
      visible += text.slice(cursor);
      break;
    }
    visible += text.slice(cursor, tagStart);
    visible += " ";
    cursor = tagEnd + 1;
  }
  return visible;
}

function stripUrlTokens(text: string) {
  return text.replace(/(?:https?:\/\/|\/\/|www\.|mailto:)[^\s<>"']+|(?<![\w@])(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#][^\s<>"']*)?|(?<![\w])\/[a-z0-9._~!$&'()*+,;=:@/?#-]+|(?<![\w@])(?:[a-z0-9._~-]+\/)+[a-z0-9._~!$&'()*+,;=:@/?#-]+|(?<![\w@])(?:[a-z0-9]+[-_])?(?:return|returned|refurb(?:ished)?)[-_][a-z0-9._~/-]+|(?<![\w])[?#][^\s<>"']+/gi, " ");
}

export function cleanText(text: string) {
  return stripUrlTokens(stripVisibleMarkupTags(stripHiddenMarkup(text))).replace(/\s+/g, " ").trim();
}

function parseReturnPrice(text: string) {
  const moneyPattern = String.raw`([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{5,8})\s*원`;
  const tenThousandPattern = String.raw`([0-9]{1,4}(?:\.[0-9]+)?)\s*만\s*원`;
  const returnPriceLabel = String.raw`(?:반품\s*(?:상품\s*)?(?:가|가격)|리퍼(?:브)?\s*(?:상품\s*)?(?:가|가격)|재포장\s*(?:가|가격))`;
  const wonCandidates = [...text.matchAll(new RegExp(String.raw`${returnPriceLabel}\s*[:：]?\s*${moneyPattern}`, "gi"))]
    .filter((match) => !isPolicyReturnPriceContext(text, match.index ?? 0, match[0]))
    .map((match) => Number(match[1].replace(/,/g, "")))
    .filter((value) => Number.isFinite(value) && value >= 10_000);
  const tenThousandCandidates = [...text.matchAll(new RegExp(String.raw`${returnPriceLabel}\s*[:：]?\s*${tenThousandPattern}`, "gi"))]
    .filter((match) => !isPolicyReturnPriceContext(text, match.index ?? 0, match[0]))
    .map((match) => Number(match[1]) * 10_000)
    .filter((value) => Number.isFinite(value) && value >= 10_000);
  const allCandidates = [...wonCandidates, ...tenThousandCandidates];
  return allCandidates.length ? Math.min(...allCandidates) : null;
}

const returnPolicyLanguagePattern = /(?:교환\s*(?:및|\/|&)\s*반품|반품\s*(?:상품\s*)?(?:안내|정책|절차|방법)|(?:반품|교환|회수|수거)\s*(?:배송\s*비(?:용)?|택배\s*비(?:용)?|운송\s*비(?:용)?|수거\s*비(?:용)?|회수\s*비(?:용)?|비용|수수료)|(?:배송|택배|운송|수거|회수)\s*비(?:용)?|고객\s*부담|판매자\s*부담|환불\s*(?:안내|절차)|return\s*policy|return\s+(?:shipping|delivery)\s*(?:fee|cost|charge)|return\s*(?:fee|shipping|handling)|restocking)/i;

function hasSpecificReturnConditionEvidence(text: string) {
  return /(?:반품\s*[-–—:]?\s*(?:미개봉|최상(?:급)?|상(?:급)?|중(?:급)?|[AB](?:\+)?\s*급)(?=$|[^가-힣A-Za-z0-9])|(?:미개봉|최상(?:급)?|상(?:급)?|중(?:급)?|[AB](?:\+)?\s*급)\s*(?:반품|상품|제품)|리퍼(?:브)?|재포장|박스\s*훼손|개봉\s*(?:상품|제품|반품)|전시\s*(?:상품|제품)|returned?[-\s]+(?:item|product|price|grade)|refurb(?:ished)?|repack(?:aged|aging)?|open[-\s]?box|display(?:ed)?\s+(?:item|product))/i.test(text);
}

function hasPolicyOnlyReturnPrice(text: string) {
  return /(?:무료|무상|간편|단순)\s*반품(?:\s*(?:상품|제품|미개봉|최상(?:급)?|상(?:급)?|중(?:급)?|[AB](?:\+)?\s*급|안내|정책|가능|기간|접수|배송|비용))*\s*(?:반품\s*(?:상품\s*)?(?:가|가격)|리퍼(?:브)?\s*(?:상품\s*)?(?:가|가격)|재포장\s*(?:가|가격))\s*[:：]?\s*(?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]{5,8}|[0-9]{1,4}(?:\.[0-9]+)?)\s*(?:원|만\s*원)/i.test(text);
}

const directReturnConditionPhrase = String.raw`(?:반품\s*[-–—:]?\s*(?:미개봉|최상(?:급)?|상(?:급)?|중(?:급)?|[AB](?:\+)?\s*급)(?=$|[^가-힣A-Za-z0-9])|리퍼(?:브)?|재포장|박스\s*훼손|개봉\s*(?:상품|제품|반품)|전시\s*(?:상품|제품)|returned?[-\s]+(?:item|product|price|grade)|refurb(?:ished)?|repack(?:aged|aging)?|open[-\s]?box|display(?:ed)?\s+(?:item|product))`;

const nearbyReturnConditionPhrase = String.raw`(?:반품\s*[-–—:]\s*(?:미개봉|최상(?:급)?|상(?:급)?|중(?:급)?|[AB](?:\+)?\s*급)(?=$|[^가-힣A-Za-z0-9])|(?:미개봉|최상(?:급)?|상(?:급)?|중(?:급)?|[AB](?:\+)?\s*급)\s*(?:반품|상품|제품)(?=$|[^가-힣A-Za-z0-9])|리퍼(?:브)?|재포장|박스\s*훼손|개봉\s*(?:상품|제품|반품)|전시\s*(?:상품|제품)|returned?[-\s]+(?:item|product|price|grade)|refurb(?:ished)?|repack(?:aged|aging)?|open[-\s]?box|display(?:ed)?\s+(?:item|product))`;
const policyQualifiedReturnPhrase = String.raw`(?:무료|무상|간편|단순)\s*반품(?:\s*(?:상품|제품|미개봉|최상(?:급)?|상(?:급)?|중(?:급)?|[AB](?:\+)?\s*급))*\s*$`;

function hasDirectReturnConditionBefore(text: string, matchIndex: number) {
  const before = text.slice(Math.max(0, matchIndex - 36), matchIndex);
  return new RegExp(`${directReturnConditionPhrase}\\s*(?:-|:|·|\\.|,)?\\s*$`, "i").test(before);
}

function hasNearbyReturnConditionBefore(text: string, matchIndex: number) {
  const before = text.slice(Math.max(0, matchIndex - 128), matchIndex);
  const matches = [...before.matchAll(new RegExp(nearbyReturnConditionPhrase, "gi"))];
  const lastMatch = matches[matches.length - 1];
  if (!lastMatch) return false;
  const conditionEnd = (lastMatch.index ?? 0) + lastMatch[0].length;
  return !returnPolicyLanguagePattern.test(before.slice(conditionEnd));
}

function hasNearbyReturnConditionAfter(text: string, endIndex: number) {
  const after = text.slice(endIndex, Math.min(text.length, endIndex + 128));
  const matches = [...after.matchAll(new RegExp(nearbyReturnConditionPhrase, "gi"))];
  const firstMatch = matches[0];
  if (!firstMatch) return false;
  return !returnPolicyLanguagePattern.test(after.slice(0, firstMatch.index ?? 0));
}

function hasPolicyQualifiedReturnContextBefore(text: string, matchIndex: number) {
  const before = text.slice(Math.max(0, matchIndex - 64), matchIndex);
  return new RegExp(policyQualifiedReturnPhrase, "i").test(before);
}

function isPolicyReturnPriceContext(text: string, matchIndex: number, matchText: string) {
  const before = text.slice(Math.max(0, matchIndex - 128), matchIndex);
  const afterStart = matchIndex + matchText.length;
  const after = text.slice(afterStart, Math.min(text.length, afterStart + 128));
  if (hasPolicyQualifiedReturnContextBefore(text, matchIndex)) return true;
  if (hasDirectReturnConditionBefore(text, matchIndex)) return false;
  if (hasNearbyReturnConditionBefore(text, matchIndex)) return false;
  const policyBefore = returnPolicyLanguagePattern.test(before);
  if (hasNearbyReturnConditionAfter(text, afterStart) && !policyBefore) return false;
  return policyBefore || returnPolicyLanguagePattern.test(after);
}

function isExcludedListedPriceContext(text: string, matchIndex: number, matchText: string) {
  const contextStart = Math.max(0, matchIndex - 96);
  const contextEnd = Math.min(text.length, matchIndex + matchText.length + 96);
  const context = text.slice(contextStart, contextEnd);
  return /(?:반품|리퍼(?:브)?|재포장|쿠폰|coupon|배송|운송|택배|설치|추가\s*(?:금|비|비용|요금)|shipping|delivery\s*(?:fee|cost|charge)|\binstall(?:ation|ed|ing)?\b|\breturn(?:s|ed|ing)?\b|\brefurb(?:ished|ing)?\b|\brepack(?:aged|aging)?\b|additional[\s-]*(?:cost|fee|charge))/i.test(context);
}

function collectListedPriceCandidates(text: string) {
  const listedPriceLabel = String.raw`(?<![가-힣A-Za-z0-9])(?:판매\s*가(?:격)?|할인\s*가(?:격)?|정(?:상)?\s*가(?:격)?|상품\s*가(?:격)?|최종\s*가(?:격)?|결제\s*가(?:격)?)`;
  const moneyPattern = String.raw`([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{5,8})\s*원`;
  const tenThousandPattern = String.raw`([0-9]{1,4}(?:\.[0-9]+)?)\s*만\s*원`;
  const collect = (amountPattern: string, parse: (value: string) => number) =>
    [...text.matchAll(new RegExp(String.raw`${listedPriceLabel}\s*[:：]?\s*${amountPattern}`, "gi"))]
      .filter((match) => !isExcludedListedPriceContext(text, match.index ?? 0, match[0]))
      .map((match) => parse(match[1]))
      .filter((value) => Number.isFinite(value) && value > 0);

  const candidates = [
    ...collect(moneyPattern, (value) => Number(value.replace(/,/g, ""))),
    ...collect(tenThousandPattern, (value) => Number(value) * 10_000)
  ];
  return [...new Set(candidates)];
}

export function extractListedPriceCandidatesFromText(...parts: Array<string | null | undefined>) {
  return collectListedPriceCandidates(cleanText(parts.filter(Boolean).join(" ")));
}

export function extractListedPriceFromText(...parts: Array<string | null | undefined>) {
  const candidates = extractListedPriceCandidatesFromText(...parts);
  return candidates.length ? Math.min(...candidates) : null;
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

  const policyReturnTextRemoved = text.replace(
    /(?:무료|무상|간편|단순)\s*반품(?:\s*(?:정책|가능|기간|접수|배송|비용|안내|[AB](?:\+)?\s*급|미개봉|최상(?:급)?|상(?:급)?|중(?:급)?))?/gi,
    " "
  );
  const returnMarkerFound = /(?:반품\s*(?:[-–—:]?\s*(?:미개봉|최상(?:급)?|상(?:급)?|중(?:급)?|[AB](?:\+)?\s*급)|후보|상품|제품|가|가격|등급|상태|품질)|리퍼(?:브)?|재포장|박스\s*훼손|개봉\s*(?:상품|제품|반품)|전시\s*(?:상품|제품)|returned?[-\s]+(?:item|product|price|grade)|refurb(?:ished)?|repack(?:aged|aging)?|open[-\s]?box|display(?:ed)?\s+(?:item|product)|return[-\s]+(?:item|product|price|grade))/i.test(
    policyReturnTextRemoved
  );
  const hasPolicyLanguage = returnPolicyLanguagePattern.test(text);
  const hasSpecificReturnCondition = hasSpecificReturnConditionEvidence(text);
  const parsedReturnPrice = parseReturnPrice(text);
  const hasStrongReturnCondition = new RegExp(nearbyReturnConditionPhrase, "i").test(text);
  const isReturnCandidate = returnMarkerFound && (!hasPolicyOnlyReturnPrice(text) || hasStrongReturnCondition) && (!hasPolicyLanguage || hasSpecificReturnCondition || parsedReturnPrice != null);
  if (isReturnCandidate) evidence.push("제목 또는 설명에 반품·리퍼·재포장·전시상품 관련 표현이 있습니다.");

  if (isReturnCandidate) {
    for (const [grade, patterns] of gradePatterns) {
      if (patterns.some((pattern) => pattern.test(text))) {
        condition = grade;
        evidence.push(`웹 문구에서 '${grade}' 상태 표현을 찾았습니다.`);
        break;
      }
    }
  }

  const returnPrice = isReturnCandidate ? parsedReturnPrice : null;
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

function readJsonRecord(value: JsonValue | undefined) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

export function resolveStoredWebReturnInfo(title: string, value: JsonValue | undefined): WebReturnInfo {
  const root = readJsonRecord(value);
  if (!root) return extractReturnInfoFromText(title);

  const detailPage = readJsonRecord(root.detail_page);
  const records = [detailPage, root].filter((record): record is Record<string, JsonValue> => Boolean(record));
  const evidence = records.flatMap((record) =>
    Array.isArray(record.evidence) ? record.evidence.filter((item): item is string => typeof item === "string") : []
  );
  const conditionCandidates = records
    .map((record) => record.condition_grade)
    .filter((item): item is string => typeof item === "string" && conditionGrades.has(item as ConditionGrade)) as string[];
  const condition =
    (conditionCandidates.find((item) => !weakConditionGrades.has(item as ConditionGrade)) as ConditionGrade | undefined) ??
    (conditionCandidates[0] as ConditionGrade | undefined);
  const returnPrice = records
    .map((record) => record.return_price)
    .find((item): item is number => typeof item === "number" && Number.isFinite(item) && item >= 0) ?? null;
  const stockCount = records
    .map((record) => record.stock_count)
    .find((item): item is number => typeof item === "number" && Number.isFinite(item) && item >= 0) ?? null;
  const hasExplicitTrue = records.some((record) => record.is_return_candidate === true);
  const hasExplicitFalse = records.some((record) => record.is_return_candidate === false);
  const parsed =
    hasExplicitFalse && !hasExplicitTrue
      ? {
          isReturnCandidate: false,
          condition_grade: null,
          return_price: null,
          stock_count: null,
          evidence: [],
          confidence: 0
        }
      : extractReturnInfoFromText(title, evidence.join(" ") || null);
  const confidence = Math.max(
    0,
    ...records.map((record) => (typeof record.confidence === "number" && Number.isFinite(record.confidence) ? record.confidence : 0))
  );

  return {
    isReturnCandidate: hasExplicitTrue ? true : hasExplicitFalse ? false : parsed.isReturnCandidate,
    condition_grade: condition ?? parsed.condition_grade,
    return_price: returnPrice ?? parsed.return_price,
    stock_count: stockCount ?? parsed.stock_count,
    evidence: Array.from(new Set([...evidence, ...parsed.evidence])),
    confidence: Math.max(confidence, parsed.confidence)
  };
}

export function mergeStoredWebReturnInfo(value: JsonValue | undefined, info: WebReturnInfo): Record<string, JsonValue> {
  const root = readJsonRecord(value);
  return {
    ...(root ?? {}),
    ...toReturnInfoJson(info)
  };
}
