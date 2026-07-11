import crypto from "crypto";
import { isUsableAffiliateUrl } from "@/lib/coupangLink";
import type { Category } from "@/lib/types";
import type { ProviderProduct, ProviderSearchResult } from "@/lib/providers/types";

const baseUrl = "https://api-gateway.coupang.com";

function envText(name: string) {
  return process.env[name]?.trim() ?? "";
}

function getCoupangCredentials() {
  return {
    accessKey: envText("COUPANG_ACCESS_KEY"),
    secretKey: envText("COUPANG_SECRET_KEY"),
    partnerId: envText("COUPANG_PARTNER_ID")
  };
}

function isConfigured() {
  const { accessKey, secretKey, partnerId } = getCoupangCredentials();
  return Boolean(accessKey && secretKey && partnerId);
}

function createAuthorization(method: string, pathWithQuery: string) {
  const { accessKey, secretKey } = getCoupangCredentials();
  const datetime = new Date().toISOString().slice(2, 19).replace(/[-:]/g, "").replace("T", "T") + "Z";
  const [path, query = ""] = pathWithQuery.split("?");
  const message = datetime + method.toUpperCase() + path + query;
  const signature = crypto.createHmac("sha256", secretKey).update(message).digest("hex");
  return `CEA algorithm=HmacSHA256,access-key=${accessKey},signed-date=${datetime},signature=${signature}`;
}

function numberFromUnknown(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringFromUnknown(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstUsableAffiliateUrl(...values: unknown[]) {
  for (const value of values) {
    const url = stringFromUnknown(value);
    if (isUsableAffiliateUrl(url)) return url;
  }
  return null;
}

function firstPresentField(item: Record<string, unknown>, fields: string[]) {
  return fields.find((field) => item[field] != null && String(item[field]).trim() !== "") ?? null;
}

function jsonRecordFromItem(item: Record<string, unknown>): NonNullable<ProviderProduct["raw_json"]> {
  return item as NonNullable<ProviderProduct["raw_json"]>;
}

function compactErrorText(value: unknown) {
  const text = stringFromUnknown(value);
  return text ? text.slice(0, 240) : null;
}

function payloadErrorMessage(payload: Record<string, unknown>) {
  return (
    compactErrorText(payload.rMessage) ??
    compactErrorText(payload.message) ??
    compactErrorText(payload.errorMessage) ??
    compactErrorText(payload.error) ??
    compactErrorText(payload.code) ??
    compactErrorText(payload.rCode) ??
    compactErrorText(payload.raw_text)
  );
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

type ProductParseContext = {
  path: string;
  arrayPath: string | null;
  rawProductCount: number;
};

function normalizeProduct(item: Record<string, unknown>, keyword: string, category: Category, context: ProductParseContext): ProviderProduct {
  const productIdField = firstPresentField(item, ["productId", "product_id", "itemId", "id", "productNo", "vendorItemId"]);
  const titleField = firstPresentField(item, ["productName", "title", "name", "itemName"]);
  const priceField = firstPresentField(item, ["productPrice", "price", "salePrice", "finalPrice"]);
  const productUrlField = firstPresentField(item, ["productUrl", "url", "landingUrl"]);
  const imageUrlField = firstPresentField(item, ["productImage", "imageUrl", "thumbnail"]);
  const affiliateField = firstPresentField(item, ["shortenUrl", "shortUrl", "affiliateUrl", "productUrl", "url", "landingUrl"]);
  const productId = productIdField ? item[productIdField] : null;
  const title = String(titleField ? item[titleField] : keyword);
  const price = priceField ? numberFromUnknown(item[priceField]) : null;
  const productUrl = productUrlField ? String(item[productUrlField] ?? "") : "";
  const imageUrl = imageUrlField ? String(item[imageUrlField] ?? "") : "";
  const affiliateUrl = firstUsableAffiliateUrl(item.shortenUrl, item.shortUrl, item.affiliateUrl, item.productUrl, item.url, item.landingUrl);

  return {
    source: "coupang_partners",
    source_product_id: productId == null ? null : String(productId),
    category,
    keyword,
    title,
    brand: typeof item.brand === "string" ? item.brand : null,
    model_name: typeof item.modelName === "string" ? item.modelName : null,
    image_url: imageUrl || null,
    source_url: productUrl || null,
    coupang_url: productUrl || null,
    affiliate_url: affiliateUrl,
    source_price: price,
    return_price: null,
    new_price: price,
    condition_grade: "확인필요",
    stock_count: null,
    raw_json: {
      ...jsonRecordFromItem(item),
      coupang_provider_parse: {
        path: context.path,
        array_path: context.arrayPath,
        raw_product_count: context.rawProductCount,
        product_id_field: productIdField,
        title_field: titleField,
        price_field: priceField,
        product_url_field: productUrlField,
        image_url_field: imageUrlField,
        affiliate_url_field: affiliateUrl ? affiliateField : null,
        affiliate_url_usable: Boolean(affiliateUrl)
      }
    }
  };
}

function getPayloadError(payload: Record<string, unknown>) {
  const code = stringFromUnknown(payload.rCode) ?? stringFromUnknown(payload.code) ?? stringFromUnknown(payload.status);
  if (!code || code === "0" || code.toUpperCase() === "SUCCESS" || code.toUpperCase() === "OK") return null;
  return stringFromUnknown(payload.rMessage) ?? stringFromUnknown(payload.message) ?? code;
}

function extractProductArray(payload: Record<string, unknown>) {
  const data = payload.data as Record<string, unknown> | Record<string, unknown>[] | undefined;
  if (Array.isArray(data)) return { items: data, arrayPath: "data" };
  const dataRecord = data && typeof data === "object" ? data : undefined;
  const candidates: Array<[string, unknown]> = [
    ["data.productData", dataRecord?.productData],
    ["data.products", dataRecord?.products],
    ["data.items", dataRecord?.items],
    ["data.productList", dataRecord?.productList],
    ["data.results", dataRecord?.results],
    ["productData", payload.productData],
    ["products", payload.products],
    ["items", payload.items],
    ["productList", payload.productList],
    ["results", payload.results]
  ];
  const match = candidates.find(([, value]) => Array.isArray(value));
  return match ? { items: match[1] as Record<string, unknown>[], arrayPath: match[0] } : null;
}

async function fetchCoupangJson(method: "GET" | "POST", path: string, body?: Record<string, unknown>) {
  const response = await fetchWithTimeout(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: createAuthorization(method, path),
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store"
  });

  const text = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    payload = { raw_text: text.slice(0, 500) };
  }
  if (!response.ok) {
    const detail = payloadErrorMessage(payload);
    return { ok: false as const, status: response.status, payload, error: detail ? `COUPANG_HTTP_${response.status}: ${detail}` : `COUPANG_HTTP_${response.status}` };
  }

  const payloadError = getPayloadError(payload);
  if (payloadError) return { ok: false as const, status: response.status, payload, error: payloadError };
  return { ok: true as const, status: response.status, payload };
}

export async function searchCoupangProducts(keyword: string, category: Category): Promise<ProviderSearchResult> {
  if (!isConfigured()) return { status: "API_NOT_CONFIGURED", products: [] };

  const { partnerId } = getCoupangCredentials();
  const query = new URLSearchParams({
    keyword,
    limit: "10"
  });
  if (partnerId) query.set("subId", partnerId);
  const searchPaths = [
    `/v2/providers/affiliate_open_api/apis/openapi/v1/products/search?${query.toString()}`,
    `/v2/providers/affiliate_open_api/apis/openapi/products/search?${query.toString()}`
  ];

  try {
    const errors: string[] = [];
    for (const path of searchPaths) {
      const result = await fetchCoupangJson("GET", path);
      if (!result.ok) {
        errors.push(`${path}: ${result.error}`);
        if (result.status !== 404 && result.status !== 405) break;
        continue;
      }

      const extracted = extractProductArray(result.payload);
      const rawProducts = extracted?.items ?? [];
      const products = rawProducts
        .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
        .map((item) =>
          normalizeProduct(item, keyword, category, {
            path,
            arrayPath: extracted?.arrayPath ?? null,
            rawProductCount: rawProducts.length
          })
        );

      return {
        status: "ok",
        products,
        meta: {
          provider_path: path,
          response_array_path: extracted?.arrayPath ?? null,
          raw_product_count: rawProducts.length,
          normalized_product_count: products.length,
          searched_path_count: searchPaths.length
        }
      };
    }

    return {
      status: "error",
      products: [],
      error: errors.join(" | ") || "COUPANG_EMPTY_RESPONSE",
      meta: {
        searched_paths: searchPaths,
        errors: errors.slice(0, 4)
      }
    };
  } catch (error) {
    return { status: "error", products: [], error: error instanceof Error ? error.message : "COUPANG_UNKNOWN_ERROR" };
  }
}

export async function createCoupangDeeplink(originalUrl: string) {
  if (!isConfigured()) return { status: "API_NOT_CONFIGURED" as const, url: null };

  const paths = [
    "/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink",
    "/v2/providers/affiliate_open_api/apis/openapi/deeplink"
  ];
  const body: Record<string, unknown> = { coupangUrls: [originalUrl] };
  const { partnerId } = getCoupangCredentials();
  if (partnerId) body.subId = partnerId;

  try {
    const errors: string[] = [];
    for (const path of paths) {
      const result = await fetchCoupangJson("POST", path, body);
      if (!result.ok) {
        errors.push(`${path}: ${result.error}`);
        if (result.status !== 404 && result.status !== 405) break;
        continue;
      }

      const data = result.payload.data as unknown;
      const first = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : data && typeof data === "object" ? (data as Record<string, unknown>) : undefined;
      const deeplink = firstUsableAffiliateUrl(first?.shortenUrl, first?.shortUrl, first?.affiliateUrl, first?.landingUrl, first?.url);
      if (deeplink) return { status: "ok" as const, url: deeplink };

      const rawUrl = stringFromUnknown(first?.shortenUrl) ?? stringFromUnknown(first?.landingUrl) ?? stringFromUnknown(first?.url);
      errors.push(
        rawUrl
          ? `${path}: COUPANG_DEEPLINK_NO_PARTNERS_URL`
          : `${path}: COUPANG_DEEPLINK_EMPTY_RESPONSE`
      );
      break;
    }

    return { status: "error" as const, url: null, error: errors.join(" | ") || "COUPANG_DEEPLINK_EMPTY_RESPONSE" };
  } catch (error) {
    return {
      status: "error" as const,
      url: null,
      error: error instanceof Error ? error.message : "COUPANG_DEEPLINK_ERROR"
    };
  }
}
