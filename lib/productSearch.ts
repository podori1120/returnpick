import type { ProductWithScore } from "@/lib/types";

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

export function normalizeProductSearchText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function getProductSearchFields(product: Pick<ProductWithScore, "title" | "brand" | "model_name" | "keyword" | "spec_json">) {
  const values: string[] = [product.title, product.brand ?? "", product.model_name ?? "", product.keyword ?? ""];
  collectSearchValues(product.spec_json, values);
  return values.map(normalizeProductSearchText).filter(Boolean);
}

export function matchesProductSearch(product: Pick<ProductWithScore, "title" | "brand" | "model_name" | "keyword" | "spec_json">, query: string | null | undefined) {
  const terms = normalizeProductSearchText(query ?? "").split(" ").filter(Boolean);
  if (!terms.length) return true;

  const fields = getProductSearchFields(product);
  return terms.every((term) => fields.some((field) => field.includes(term)));
}
