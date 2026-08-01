export function collectJsonLdProducts(value: unknown, products: Array<Record<string, unknown>> = [], depth = 0) {
  if (depth > 5 || value == null || typeof value !== "object") return products;
  if (Array.isArray(value)) {
    for (const item of value) collectJsonLdProducts(item, products, depth + 1);
    return products;
  }

  const record = value as Record<string, unknown>;
  const typeValues = Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]];
  const isProduct = typeValues.some((type) => typeof type === "string" && /^(?:Product|ProductGroup)$/i.test(type));
  if (isProduct) products.push(record);

  for (const key of ["@graph", "item", "mainEntity", "mainEntityOfPage"]) {
    if (record[key] && typeof record[key] === "object") collectJsonLdProducts(record[key], products, depth + 1);
  }
  return products;
}

export function readJsonLdText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(readJsonLdText).filter(Boolean).join(" ");
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return readJsonLdText(record.name ?? record.value ?? record.url);
  }
  return "";
}

export function readJsonLdNumber(value: unknown) {
  const parsed = Number(typeof value === "string" ? value.replace(/[,원₩￦\s]/g, "") : value);
  return Number.isFinite(parsed) && parsed >= 10_000 ? Math.round(parsed) : null;
}

export function readJsonLdOfferPrice(record: Record<string, unknown>) {
  const offers = Array.isArray(record.offers) ? record.offers[0] : record.offers;
  if (!offers || typeof offers !== "object") return null;
  const offer = offers as Record<string, unknown>;
  return readJsonLdNumber(offer.price ?? offer.lowPrice ?? offer.highPrice);
}
