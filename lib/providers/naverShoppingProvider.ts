import { stripHtml, toNumberOrNull } from "@/lib/format";

export interface NaverShoppingItem {
  title: string;
  link: string | null;
  image: string | null;
  lprice: number | null;
  mallName: string | null;
  brand: string | null;
  maker: string | null;
  category1: string | null;
  category2: string | null;
  category3: string | null;
  category4: string | null;
}

function isConfigured() {
  return Boolean(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET);
}

export async function searchNaverShopping(query: string): Promise<{ status: "ok" | "API_NOT_CONFIGURED" | "error"; items: NaverShoppingItem[]; error?: string }> {
  if (!isConfigured()) return { status: "API_NOT_CONFIGURED", items: [] };

  const params = new URLSearchParams({
    query,
    display: "10",
    sort: "sim"
  });

  try {
    const response = await fetch(`https://openapi.naver.com/v1/search/shop.json?${params.toString()}`, {
      headers: {
        "X-Naver-Client-Id": process.env.NAVER_CLIENT_ID ?? "",
        "X-Naver-Client-Secret": process.env.NAVER_CLIENT_SECRET ?? ""
      },
      cache: "no-store"
    });

    if (!response.ok) return { status: "error", items: [], error: `NAVER_HTTP_${response.status}` };
    const payload = (await response.json()) as { items?: Record<string, unknown>[] };
    const items = (payload.items ?? []).map((item) => ({
      title: stripHtml(String(item.title ?? "")),
      link: typeof item.link === "string" ? item.link : null,
      image: typeof item.image === "string" ? item.image : null,
      lprice: toNumberOrNull(item.lprice),
      mallName: typeof item.mallName === "string" ? item.mallName : null,
      brand: typeof item.brand === "string" ? item.brand : null,
      maker: typeof item.maker === "string" ? item.maker : null,
      category1: typeof item.category1 === "string" ? item.category1 : null,
      category2: typeof item.category2 === "string" ? item.category2 : null,
      category3: typeof item.category3 === "string" ? item.category3 : null,
      category4: typeof item.category4 === "string" ? item.category4 : null
    }));

    return { status: "ok", items };
  } catch (error) {
    return { status: "error", items: [], error: error instanceof Error ? error.message : "NAVER_UNKNOWN_ERROR" };
  }
}

export async function getLowestPrice(query: string) {
  const result = await searchNaverShopping(query);
  if (result.status !== "ok") return null;
  const prices = result.items.map((item) => item.lprice).filter((price): price is number => typeof price === "number" && price > 0);
  return prices.length > 0 ? Math.min(...prices) : null;
}
