import crypto from "crypto";
import type { Category } from "@/lib/types";
import type { ProviderProduct, ProviderSearchResult } from "@/lib/providers/types";

const baseUrl = "https://api-gateway.coupang.com";

function isConfigured() {
  return Boolean(process.env.COUPANG_ACCESS_KEY && process.env.COUPANG_SECRET_KEY && process.env.COUPANG_PARTNER_ID);
}

function createAuthorization(method: string, pathWithQuery: string) {
  const accessKey = process.env.COUPANG_ACCESS_KEY ?? "";
  const secretKey = process.env.COUPANG_SECRET_KEY ?? "";
  const datetime = new Date().toISOString().slice(2, 19).replace(/[-:]/g, "").replace("T", "T") + "Z";
  const message = datetime + method + pathWithQuery;
  const signature = crypto.createHmac("sha256", secretKey).update(message).digest("hex");
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
}

function numberFromUnknown(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeProduct(item: Record<string, unknown>, keyword: string, category: Category): ProviderProduct {
  const productId =
    item.productId ??
    item.product_id ??
    item.itemId ??
    item.id ??
    item.productNo ??
    item.vendorItemId ??
    null;
  const title = String(item.productName ?? item.title ?? item.name ?? item.itemName ?? keyword);
  const price =
    numberFromUnknown(item.productPrice) ??
    numberFromUnknown(item.price) ??
    numberFromUnknown(item.salePrice) ??
    numberFromUnknown(item.finalPrice);
  const productUrl = String(item.productUrl ?? item.url ?? item.landingUrl ?? "");
  const imageUrl = String(item.productImage ?? item.imageUrl ?? item.thumbnail ?? "");

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
    affiliate_url: typeof item.shortenUrl === "string" ? item.shortenUrl : null,
    source_price: price,
    return_price: null,
    new_price: price,
    condition_grade: "확인필요",
    stock_count: null,
    raw_json: item as ProviderProduct["raw_json"]
  };
}

export async function searchCoupangProducts(keyword: string, category: Category): Promise<ProviderSearchResult> {
  if (!isConfigured()) return { status: "API_NOT_CONFIGURED", products: [] };

  const query = new URLSearchParams({
    keyword,
    limit: "10"
  });
  const path = `/v2/providers/affiliate_open_api/apis/openapi/v1/products/search?${query.toString()}`;

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        Authorization: createAuthorization("GET", path),
        "Content-Type": "application/json"
      },
      cache: "no-store"
    });
    if (!response.ok) {
      return { status: "error", products: [], error: `COUPANG_HTTP_${response.status}` };
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const data = payload.data as Record<string, unknown> | undefined;
    const rawProducts = data?.productData ?? data?.products ?? payload.products ?? [];
    const products = Array.isArray(rawProducts)
      ? rawProducts
          .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
          .map((item) => normalizeProduct(item, keyword, category))
      : [];

    return { status: "ok", products };
  } catch (error) {
    return { status: "error", products: [], error: error instanceof Error ? error.message : "COUPANG_UNKNOWN_ERROR" };
  }
}

export async function createCoupangDeeplink(originalUrl: string) {
  if (!isConfigured()) return { status: "API_NOT_CONFIGURED" as const, url: null };

  const path = "/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink";
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: createAuthorization("POST", path),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ coupangUrls: [originalUrl] }),
      cache: "no-store"
    });

    if (!response.ok) return { status: "error" as const, url: null, error: `COUPANG_HTTP_${response.status}` };
    const payload = (await response.json()) as Record<string, unknown>;
    const data = payload.data as unknown;
    const first = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
    const deeplink = first?.shortenUrl ?? first?.landingUrl ?? first?.url;
    return { status: "ok" as const, url: typeof deeplink === "string" ? deeplink : null };
  } catch (error) {
    return {
      status: "error" as const,
      url: null,
      error: error instanceof Error ? error.message : "COUPANG_DEEPLINK_ERROR"
    };
  }
}
