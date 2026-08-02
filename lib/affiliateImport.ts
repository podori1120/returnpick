import { extractCoupangProductId } from "@/lib/affiliateIdentity";
import type { ProductWithScore } from "@/lib/types";

export type AffiliateImportTarget = {
  productId: string | null;
  sourceProductId: string | null;
  affiliateUrl: string;
};

export type AffiliateImportMatch = {
  product: ProductWithScore | null;
  matchedBy: "internal_id" | "coupang_product_id" | undefined;
  ambiguous: boolean;
};

const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const partnersLinkPattern = /https:\/\/link\.coupang\.com\/[^\s,;]+/i;
const coupangProductUrlPattern = /https?:\/\/(?:www\.)?(?:[a-z0-9-]+\.)?coupang\.com\/vp\/products\/\d+(?:[^\s,;)]*)?/i;
const labeledProductIdPattern = /(?:coupang[_\s-]*product[_\s-]*id|product[_\s-]*id)\s*[:=]\s*(\d{6,20})/i;
const numericProductIdPattern = /(?:^|[\s,;\t])(\d{8,20})(?=$|[\s,;\t])/;

function normalizeAffiliateUrl(value: string | null | undefined) {
  return value?.trim().replace(/[)\].,;]+$/g, "") ?? "";
}

function normalizeProductId(value: string | null | undefined) {
  return value?.trim() || null;
}

export function parseAffiliateImportLine(line: string): AffiliateImportTarget {
  const productId = line.match(uuidPattern)?.[0] ?? null;
  const coupangProductUrl = line.match(coupangProductUrlPattern)?.[0] ?? null;
  const sourceProductId =
    (coupangProductUrl ? extractCoupangProductId(coupangProductUrl) : null) ??
    line.match(labeledProductIdPattern)?.[1] ??
    line.match(numericProductIdPattern)?.[1] ??
    null;
  const affiliateUrl = normalizeAffiliateUrl(line.match(partnersLinkPattern)?.[0] ?? null);
  return { productId, sourceProductId, affiliateUrl };
}

export function findAffiliateImportProduct(products: ProductWithScore[], target: AffiliateImportTarget): AffiliateImportMatch {
  if (target.productId) {
    return {
      product: products.find((candidate) => candidate.id === target.productId) ?? null,
      matchedBy: "internal_id",
      ambiguous: false
    };
  }

  if (!target.sourceProductId) return { product: null, matchedBy: undefined, ambiguous: false };

  const matches = products.filter((product) => {
    const storedSourceProductId = normalizeProductId(product.source_product_id);
    const coupangProductId = extractCoupangProductId(product.coupang_url) ?? extractCoupangProductId(product.source_url);
    return storedSourceProductId === target.sourceProductId || coupangProductId === target.sourceProductId;
  });

  return {
    product: matches.length === 1 ? matches[0] : null,
    matchedBy: matches.length === 1 ? "coupang_product_id" : undefined,
    ambiguous: matches.length > 1
  };
}
