import type { Category, JsonValue } from "@/lib/types";

export type NaverMatchProduct = {
  category: Category;
  title: string;
  brand?: string | null;
  model_name?: string | null;
  spec_json?: Record<string, JsonValue>;
};

export type NaverMatchCandidate = {
  title: string;
  brand?: string | null;
  maker?: string | null;
  category1?: string | null;
  category2?: string | null;
  category3?: string | null;
  category4?: string | null;
};

export type NaverSkuMatchConfidence = "strong" | "moderate" | "rejected";

export type NaverSkuMatchEvidence = {
  accepted: boolean;
  confidence: NaverSkuMatchConfidence;
  score: number;
  reason_code: string;
  matched_signals: string[];
  conflict_signals: string[];
  missing_signals: string[];
};

type ComparableSpecKey = "ram" | "ssd" | "cpu" | "gpu" | "os" | "size" | "resolution" | "refresh_rate" | "capacity" | "coverage";
type ComparableSpecs = Record<ComparableSpecKey, string[]>;

const emptySpecs = (): ComparableSpecs => ({
  ram: [],
  ssd: [],
  cpu: [],
  gpu: [],
  os: [],
  size: [],
  resolution: [],
  refresh_rate: [],
  capacity: [],
  coverage: []
});

const brandAliases: Array<{ id: string; patterns: RegExp[] }> = [
  { id: "samsung", patterns: [/samsung/i, /삼성/] },
  { id: "lg", patterns: [/(?:^|\s)lg(?:전자)?(?:\s|$)/i, /엘지/] },
  { id: "lenovo", patterns: [/lenovo/i, /레노버/] },
  { id: "asus", patterns: [/asus/i, /에이수스/, /아수스/] },
  { id: "hp", patterns: [/(?:^|\s)hp(?:\s|$)/i, /휴렛팩커드/] },
  { id: "apple", patterns: [/apple/i, /애플/] },
  { id: "msi", patterns: [/(?:^|\s)msi(?:\s|$)/i] },
  { id: "roborock", patterns: [/roborock/i, /로보락/] },
  { id: "dreame", patterns: [/dreame/i, /드리미/] },
  { id: "xiaomi", patterns: [/xiaomi/i, /샤오미/] },
  { id: "dyson", patterns: [/dyson/i, /다이슨/] },
  { id: "winix", patterns: [/winix/i, /위닉스/] }
];

const modelAliases: Array<[RegExp, string]> = [
  [/아이디어패드/gi, "ideapad"],
  [/갤럭시북/gi, "galaxybook"],
  [/맥북에어/gi, "macbookair"],
  [/맥북프로/gi, "macbookpro"],
  [/맥북/gi, "macbook"],
  [/리전/gi, "legion"],
  [/빅터스/gi, "victus"],
  [/코드제로/gi, "codezero"],
  [/타워프라임/gi, "towerprime"],
  [/제트/gi, "jet"],
  [/그램/gi, "gram"]
];

const categoryPatterns: Record<Category, RegExp[]> = {
  laptop: [/노트북/i, /notebook/i, /laptop/i, /맥북/i],
  monitor: [/모니터/i, /monitor/i, /display/i],
  robot_vacuum: [/로봇\s*청소기/i, /robot\s*vacuum/i],
  cordless_vacuum: [/무선\s*청소기/i, /스틱\s*청소기/i, /cordless\s*vacuum/i],
  air_purifier: [/공기\s*청정기/i, /air\s*purifier/i],
  dehumidifier: [/제습기/i, /dehumidifier/i]
};

const hardAccessoryPattern = /(?:전용|호환|교체용|리필|단품|부품|액세서리|케이스|파우치|필름|보호유리|모니터암|벽걸이\s*브라켓|케이블|리모컨|먼지봉투|물걸레포)/i;
const ambiguousAccessoryPattern = /(?:필터|배터리|충전기|어댑터|거치대|스탠드|브러시|도크)/i;
const accessoryQualifierPattern = /(?:전용|호환|교체용|리필|단품|부품|액세서리)/i;
const laptopAccessoryPattern = /(?:키스킨|키보드\s*커버|노트북\s*거치대|노트북\s*스탠드|노트북\s*충전기|노트북\s*어댑터)/i;
const monitorAccessoryPattern = /(?:모니터\s*거치대|모니터\s*스탠드|모니터\s*암|모니터암|디스플레이\s*케이블)/i;

const titleStopWords = new Set([
  "반품",
  "리퍼",
  "중고",
  "미개봉",
  "최상",
  "상급",
  "확인필요",
  "알수없음",
  "무료배송",
  "정품",
  "공식",
  "쿠팡",
  "파트너스",
  "노트북",
  "모니터",
  "청소기",
  "공기청정기",
  "제습기",
  "제품",
  "상품"
]);

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function text(value: unknown) {
  return String(value ?? "").normalize("NFKC").toLowerCase();
}

function compact(value: unknown) {
  let normalized = text(value);
  for (const [pattern, replacement] of modelAliases) normalized = normalized.replace(pattern, replacement);
  return normalized.replace(/[^a-z0-9가-힣]/g, "");
}

function candidateText(candidate: NaverMatchCandidate) {
  return [candidate.title, candidate.brand, candidate.maker, candidate.category1, candidate.category2, candidate.category3, candidate.category4]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");
}

function canonicalBrand(value: string) {
  return brandAliases.find((brand) => brand.patterns.some((pattern) => pattern.test(value)))?.id ?? null;
}

function hasCategorySignal(category: Category, value: string) {
  return categoryPatterns[category].some((pattern) => pattern.test(value));
}

function looksLikeAccessory(category: Category, title: string, fullCandidateText: string, categorySignal: boolean) {
  if (hardAccessoryPattern.test(title)) return true;
  if (category === "laptop" && laptopAccessoryPattern.test(title)) return true;
  if (category === "monitor" && monitorAccessoryPattern.test(title)) return true;
  if (ambiguousAccessoryPattern.test(title) && /(?:액세서리|주변기기|부품|소모품|필터|배터리)/i.test(fullCandidateText.replace(title, ""))) return true;
  return ambiguousAccessoryPattern.test(title) && (!categorySignal || accessoryQualifierPattern.test(title));
}

function normalizeModel(value: string | null | undefined) {
  const normalized = compact(value);
  if (/^\d{2}(?:fhd|qhd|uhd|4k)\d{2,3}$/.test(normalized)) return null;
  if (normalized.length < 3 || /^(?:기타|미정|unknown|노트북|모니터|청소기|공기청정기|제습기)$/.test(normalized)) return null;
  return normalized;
}

function isStrongModelName(value: string | null) {
  if (!value) return false;
  return value.length >= 5 || /\d/.test(value);
}

function extractModelCodes(value: string) {
  const excluded = /^(?:lg|hp|msi|asus|amd|intel|rtx|gtx|arc|ram|ssd|nvme|usb|wifi|fhd|qhd|uhd|4k)|^i[3579]\d+|^m[1-5](?:[- ]?(?:pro|max|ultra))?$|^ultra[3579]\d*|^ryzen[3579]\d*|^(?:windows|win)\d+|^\d+(?:gb|tb|hz|kg|l)$/i;
  const matches = text(value).match(/[a-z0-9][a-z0-9-]{1,24}/g) ?? [];
  const candidates = unique(
    matches
      .map((item) => item.replace(/-/g, ""))
      .filter((item) => /[a-z]/.test(item) && /\d/.test(item) && item.length >= 2 && !excluded.test(item))
  );
  // Keep short model codes such as S8 and V15, but do not match a shared suffix of a longer SKU.
  return candidates.filter((item) => !candidates.some((other) => other !== item && other.includes(item)));
}

function allMatches(value: string, pattern: RegExp, mapper: (match: RegExpExecArray) => string) {
  const output: string[] = [];
  const regex = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(value))) output.push(mapper(match));
  return unique(output);
}

function normalizeCpu(value: string) {
  return compact(value).replace(/^intel/, "").replace(/^amd/, "");
}

function normalizeResolution(value: string) {
  const normalized = compact(value);
  if (normalized === "4k" || normalized === "uhd") return "uhd";
  if (normalized === "wqhd") return "qhd";
  return normalized;
}

function addSpec(specs: ComparableSpecs, key: ComparableSpecKey, value: unknown, normalizer: (value: string) => string = compact) {
  if (typeof value !== "string" && typeof value !== "number") return;
  const normalized = normalizer(String(value));
  if (!normalized) return;
  if (key === "cpu") {
    const compatibleIndex = specs.cpu.findIndex((current) => current.startsWith(normalized) || normalized.startsWith(current));
    if (compatibleIndex >= 0) {
      specs.cpu[compatibleIndex] = specs.cpu[compatibleIndex].length >= normalized.length ? specs.cpu[compatibleIndex] : normalized;
      return;
    }
  }
  specs[key] = unique([...specs[key], normalized]);
}

function specsFromTitle(value: string) {
  const source = text(value);
  const specs = emptySpecs();

  specs.ram = allMatches(source, /(?<!\d)(\d{1,2})\s*gb(?:\s*(?:ram|램|메모리))?/gi, (match) => `${Number(match[1])}gb`);
  specs.ssd = allMatches(source, /(?<!\d)(\d{3,4})\s*gb(?:\s*(?:ssd|nvme|저장))?|((?:\d+(?:\.\d+)?)\s*tb)(?:\s*(?:ssd|nvme|저장))?/gi, (match) => {
    if (match[1]) return `${Number(match[1])}gb`;
    const terabytes = Number(match[2]?.replace(/[^0-9.]/g, ""));
    return `${Math.round(terabytes * 1024)}gb`;
  });
  specs.cpu = unique([
    ...allMatches(source, /ultra\s*[3579]\s*\d{3}[a-z]{0,3}/gi, (match) => normalizeCpu(match[0])),
    ...allMatches(source, /i[3579]-?\s*\d{4,5}[a-z]{0,3}/gi, (match) => normalizeCpu(match[0])),
    ...allMatches(source, /ryzen\s*[3579]\s*\d{4}[a-z]{0,3}/gi, (match) => normalizeCpu(match[0])),
    ...allMatches(source, /(?:apple\s*)?m[1-5](?:\s*(?:pro|max|ultra))?/gi, (match) => normalizeCpu(match[0]))
  ]);
  if (!specs.cpu.length) {
    specs.cpu = unique([
      ...allMatches(source, /ultra\s*[3579]/gi, (match) => normalizeCpu(match[0])),
      ...allMatches(source, /(?:^|\s)i[3579](?:\s|$)/gi, (match) => normalizeCpu(match[0])),
      ...allMatches(source, /ryzen\s*[3579]/gi, (match) => normalizeCpu(match[0]))
    ]);
  }
  specs.gpu = unique([
    ...allMatches(source, /(?:rtx|gtx)\s*\d{4}/gi, (match) => compact(match[0])),
    ...allMatches(source, /arc\s*[a-z]?\d{3}/gi, (match) => compact(match[0]))
  ]);
  if (/(?:freedos|프리도스)/i.test(source)) specs.os.push("freedos");
  if (/(?:windows|win\s*11|윈도우)/i.test(source)) specs.os.push("windows");
  specs.size = allMatches(source, /(?<!\d)(\d{2})\s*(?:인치|형|inch|\")/gi, (match) => `${Number(match[1])}inch`);
  specs.resolution = allMatches(source, /(?:fhd|wqhd|qhd|uhd|4k)/gi, (match) => normalizeResolution(match[0]));
  specs.refresh_rate = allMatches(source, /(\d{2,3})\s*hz/gi, (match) => `${Number(match[1])}hz`);
  specs.capacity = allMatches(source, /(?<!\d)(\d{1,2}(?:\.\d+)?)\s*(?:l|리터)/gi, (match) => `${Number(match[1])}l`);
  specs.coverage = unique([
    ...allMatches(source, /(?<!\d)(\d{1,3})\s*(?:평형|평)/gi, (match) => `${Number(match[1])}pyeong`),
    ...allMatches(source, /(?<!\d)(\d{1,3})\s*(?:㎡|m2)/gi, (match) => `${Math.round(Number(match[1]) / 3.3058)}pyeong`)
  ]);
  return specs;
}

function sourceSpecs(product: NaverMatchProduct) {
  const specs = specsFromTitle(product.title);
  const raw = product.spec_json ?? {};
  addSpec(specs, "ram", raw.ram);
  addSpec(specs, "ssd", raw.ssd, (value) => {
    const normalized = text(value);
    const terabytes = Number(normalized.match(/\d+(?:\.\d+)?/)?.[0]);
    if (normalized.includes("tb") && Number.isFinite(terabytes)) return `${Math.round(terabytes * 1024)}gb`;
    const gigabytes = Number(normalized.match(/\d+/)?.[0]);
    return Number.isFinite(gigabytes) ? `${gigabytes}gb` : "";
  });
  addSpec(specs, "cpu", raw.cpu, normalizeCpu);
  addSpec(specs, "gpu", raw.gpu);
  addSpec(specs, "os", raw.os);
  addSpec(specs, "size", raw.size, (value) => {
    const parsed = Number(value.match(/\d+/)?.[0]);
    return Number.isFinite(parsed) ? `${parsed}inch` : "";
  });
  addSpec(specs, "resolution", raw.resolution, normalizeResolution);
  addSpec(specs, "refresh_rate", raw.refresh_rate, (value) => {
    const parsed = Number(value.match(/\d+/)?.[0]);
    return Number.isFinite(parsed) ? `${parsed}hz` : "";
  });
  addSpec(specs, "capacity", raw.capacity, (value) => {
    const parsed = Number(value.match(/\d+(?:\.\d+)?/)?.[0]);
    return Number.isFinite(parsed) ? `${parsed}l` : "";
  });
  if (!specs.coverage.length) {
    addSpec(specs, "coverage", raw.coverage, (value) => {
      const parsed = Number(value.match(/\d+/)?.[0]);
      return Number.isFinite(parsed) ? `${parsed}pyeong` : "";
    });
  }
  return specs;
}

function criticalSpecs(category: Category): ComparableSpecKey[] {
  if (category === "laptop") return ["ram", "ssd", "cpu", "gpu", "os"];
  if (category === "monitor") return ["size", "resolution", "refresh_rate"];
  if (category === "air_purifier") return ["coverage"];
  if (category === "dehumidifier") return ["capacity"];
  return [];
}

function compatibleSpec(key: ComparableSpecKey, source: string, candidate: string) {
  if (source === candidate) return true;
  if (key === "cpu" && candidate.startsWith(source)) return true;
  return false;
}

function distinctiveTitleTokens(value: string) {
  return unique(
    text(value)
      .replace(/[^a-z0-9가-힣]+/g, " ")
      .split(/\s+/)
      .map((token) => compact(token))
      .filter((token) => token.length >= 2 && !titleStopWords.has(token))
      .filter((token) => !/^\d+(?:gb|tb|hz|kg|l)$/.test(token))
  ).slice(0, 12);
}

function rejected(reasonCode: string, matched: string[], conflicts: string[], missing: string[], score = 0): NaverSkuMatchEvidence {
  return {
    accepted: false,
    confidence: "rejected",
    score,
    reason_code: reasonCode,
    matched_signals: matched.slice(0, 12),
    conflict_signals: conflicts.slice(0, 8),
    missing_signals: missing.slice(0, 8)
  };
}

export function matchNaverProductSku(product: NaverMatchProduct, candidate: NaverMatchCandidate): NaverSkuMatchEvidence {
  const fullCandidateText = candidateText(candidate);
  const categorySignal = hasCategorySignal(product.category, fullCandidateText);
  const matched: string[] = [];
  const conflicts: string[] = [];
  const missing: string[] = [];
  let score = 0;

  if (looksLikeAccessory(product.category, candidate.title, fullCandidateText, categorySignal)) {
    return rejected("ACCESSORY_ONLY", matched, ["accessory_result"], missing);
  }
  if (!categorySignal) return rejected("CATEGORY_MISMATCH", matched, [`category:${product.category}`], missing);
  matched.push(`category:${product.category}`);
  score += 15;

  const sourceBrand = canonicalBrand(`${product.brand ?? ""} ${product.title}`);
  const candidateBrand = canonicalBrand(`${candidate.brand ?? ""} ${candidate.maker ?? ""} ${candidate.title}`);
  if (sourceBrand && candidateBrand && sourceBrand !== candidateBrand) {
    return rejected("BRAND_MISMATCH", matched, [`brand:${sourceBrand}!=${candidateBrand}`], missing, score);
  }
  if (sourceBrand && candidateBrand === sourceBrand) {
    matched.push(`brand:${sourceBrand}`);
    score += 15;
  }

  const sourceModel = normalizeModel(product.model_name);
  const candidateCompact = compact(fullCandidateText);
  const modelNameMatch = Boolean(sourceModel && candidateCompact.includes(sourceModel));
  const sourceCodes = extractModelCodes(product.title);
  const candidateCodes = extractModelCodes(fullCandidateText);
  const matchingCodes = sourceCodes.filter((code) => candidateCodes.includes(code));
  const modelCodeMatch = matchingCodes.length > 0;

  if (modelCodeMatch) {
    matched.push(`model_code:${matchingCodes[0]}`);
    score += 50;
  } else if (modelNameMatch && sourceModel) {
    matched.push(`model:${sourceModel}`);
    score += 42;
  }

  if (sourceCodes.length && !modelCodeMatch) {
    conflicts.push(`model_code:${sourceCodes[0]}!=${candidateCodes[0] ?? "missing"}`);
    return rejected("MODEL_MISMATCH", matched, conflicts, missing, score);
  }
  if (isStrongModelName(sourceModel) && !modelNameMatch && !modelCodeMatch) {
    conflicts.push(`model:${sourceModel}!=missing`);
    return rejected("MODEL_MISMATCH", matched, conflicts, missing, score);
  }

  const expectedSpecs = sourceSpecs(product);
  const actualSpecs = specsFromTitle(candidate.title);
  let specMatches = 0;

  for (const key of criticalSpecs(product.category)) {
    const expected = expectedSpecs[key];
    const actual = actualSpecs[key];
    if (expected.length > 1) {
      conflicts.push(`${key}:source_multiple`);
      return rejected("SOURCE_VARIANT_AMBIGUOUS", matched, conflicts, missing, score);
    }
    if (!expected.length) continue;
    if (actual.length > 1) {
      conflicts.push(`${key}:candidate_multiple`);
      return rejected("CANDIDATE_VARIANT_AMBIGUOUS", matched, conflicts, missing, score);
    }
    if (!actual.length) {
      missing.push(key);
      continue;
    }
    if (!compatibleSpec(key, expected[0], actual[0])) {
      conflicts.push(`${key}:${expected[0]}!=${actual[0]}`);
      return rejected("SPEC_CONFLICT", matched, conflicts, missing, score);
    }
    matched.push(`${key}:${expected[0]}`);
    specMatches += 1;
    score += 12;
  }

  const titleTokens = distinctiveTitleTokens(product.title);
  const matchedTitleTokens = titleTokens.filter((token) => candidateCompact.includes(token)).slice(0, 4);
  for (const token of matchedTitleTokens) matched.push(`title:${token}`);
  score += matchedTitleTokens.length * 4;

  if (missing.length && !modelCodeMatch) return rejected("SPEC_MISSING", matched, conflicts, missing, score);

  const hasModelIdentity = modelCodeMatch || modelNameMatch;
  if (product.category === "robot_vacuum" || product.category === "cordless_vacuum") {
    if (!hasModelIdentity) return rejected("INSUFFICIENT_IDENTITY", matched, conflicts, missing, score);
  } else if (!hasModelIdentity) {
    const enoughSpecIdentity = specMatches >= 2 || (specMatches >= 1 && Boolean(sourceBrand && candidateBrand === sourceBrand) && matchedTitleTokens.length >= 2);
    if (!enoughSpecIdentity) return rejected("INSUFFICIENT_IDENTITY", matched, conflicts, missing, score);
  }

  return {
    accepted: true,
    confidence: modelCodeMatch || (modelNameMatch && specMatches >= 1) ? "strong" : "moderate",
    score,
    reason_code: modelCodeMatch ? "EXACT_MODEL_CODE" : modelNameMatch ? "EXACT_MODEL_NAME" : "SPEC_IDENTITY",
    matched_signals: unique(matched).slice(0, 12),
    conflict_signals: [],
    missing_signals: missing.slice(0, 8)
  };
}

export function naverSkuConfidenceRank(confidence: NaverSkuMatchConfidence) {
  if (confidence === "strong") return 2;
  if (confidence === "moderate") return 1;
  return 0;
}

export function shouldPreferNaverSkuCandidate(
  candidate: { price: number; relevanceScore: number; sku: NaverSkuMatchEvidence },
  current: { price: number; relevanceScore: number; sku: NaverSkuMatchEvidence } | null
) {
  if (!current) return true;
  const candidateRank = naverSkuConfidenceRank(candidate.sku.confidence);
  const currentRank = naverSkuConfidenceRank(current.sku.confidence);
  if (candidateRank !== currentRank) return candidateRank > currentRank;
  if (candidate.sku.score !== current.sku.score) return candidate.sku.score > current.sku.score;
  if (candidate.relevanceScore !== current.relevanceScore) return candidate.relevanceScore > current.relevanceScore;
  return candidate.price < current.price;
}
