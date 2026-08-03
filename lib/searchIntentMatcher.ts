export type SearchIntentProduct = {
  category: string;
  title: string;
  brand?: string | null;
  model_name?: string | null;
  keyword?: string | null;
  spec_json?: unknown;
};

export type SearchIntentRule = {
  category: string;
  searchQueries: string[];
  excludeQueries?: string[];
};

function collectSearchValues(value: unknown, output: string[]) {
  if (typeof value === "string" || typeof value === "number") {
    output.push(String(value));
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectSearchValues(item, output));
    return;
  }

  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectSearchValues(item, output));
  }
}

function normalize(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function matchesQuery(product: SearchIntentProduct, query: string) {
  const terms = normalize(query).split(" ").filter(Boolean);
  if (!terms.length) return false;
  const values: string[] = [product.title, product.brand ?? "", product.model_name ?? "", product.keyword ?? ""];
  collectSearchValues(product.spec_json, values);
  const fields = values.map(normalize).filter(Boolean);
  return terms.every((term) => fields.some((field) => field.includes(term)));
}

export function matchesSearchIntent(product: SearchIntentProduct, rule: SearchIntentRule) {
  if (product.category !== rule.category) return false;
  const positiveMatch = rule.searchQueries.length === 0 || rule.searchQueries.some((query) => matchesQuery(product, query));
  if (!positiveMatch) return false;
  return !(rule.excludeQueries ?? []).some((query) => matchesQuery(product, query));
}
