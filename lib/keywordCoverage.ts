export type KeywordCoverageRow = {
  keyword: string;
  category: string;
  is_active?: boolean | null;
};

export function normalizeKeywordKey(keyword: string) {
  return keyword.trim().toLowerCase();
}

function keywordIdentity(keyword: KeywordCoverageRow) {
  return `${keyword.category.trim()}:${normalizeKeywordKey(keyword.keyword)}`;
}

export function getSourcingKeywordCoverage(
  keywords: ReadonlyArray<KeywordCoverageRow>,
  defaults: ReadonlyArray<KeywordCoverageRow>
) {
  const uniqueKeywords = new Map<string, boolean>();
  for (const keyword of keywords) {
    const key = keywordIdentity(keyword);
    uniqueKeywords.set(key, Boolean(uniqueKeywords.get(key) || keyword.is_active));
  }

  const defaultKeys = new Set(defaults.map(keywordIdentity));
  const missingDefaultCount = [...defaultKeys].filter((key) => !uniqueKeywords.has(key)).length;

  return {
    total_count: uniqueKeywords.size,
    active_count: [...uniqueKeywords.values()].filter(Boolean).length,
    default_count: defaultKeys.size,
    missing_default_count: missingDefaultCount
  };
}
