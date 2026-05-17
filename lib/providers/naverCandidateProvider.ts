import { stripHtml } from "@/lib/format";
import { searchNaverShopping } from "@/lib/providers/naverShoppingProvider";
import type { ProviderProduct, ProviderSearchResult } from "@/lib/providers/types";
import type { Category } from "@/lib/types";
import { extractReturnInfoFromText, toReturnInfoJson } from "@/lib/webReturnInfo";

export async function searchNaverReturnCandidates(keyword: string, category: Category): Promise<ProviderSearchResult> {
  const returnResult = await searchNaverShopping(`${keyword} 반품`);
  if (returnResult.status !== "ok") return { status: returnResult.status, products: [], error: returnResult.error };

  const generalResult = await searchNaverShopping(keyword);
  const mergedItems = [...returnResult.items, ...(generalResult.status === "ok" ? generalResult.items : [])];
  const seen = new Set<string>();

  const products: ProviderProduct[] = mergedItems
    .filter((item) => {
      const key = item.link ?? item.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((item) => {
      const title = stripHtml(item.title);
      const returnInfo = extractReturnInfoFromText(title, item.mallName ?? "", item.brand ?? "", item.maker ?? "");
      return { item, title, returnInfo };
    })
    .slice(0, 12)
    .map(({ item, title, returnInfo }) => ({
      source: "naver_shopping",
      source_product_id: item.link ?? `${category}-${keyword}-${title}`,
      category,
      keyword,
      title,
      brand: item.brand || item.maker || null,
      model_name: null,
      image_url: item.image,
      source_url: item.link,
      coupang_url: item.mallName?.includes("쿠팡") ? item.link : null,
      affiliate_url: null,
      source_price: item.lprice,
      return_price: returnInfo.isReturnCandidate ? returnInfo.return_price ?? item.lprice : null,
      new_price: null,
      condition_grade: returnInfo.condition_grade ?? "확인필요",
      stock_count: returnInfo.stock_count,
      raw_json: {
        provider: "naver_shopping_candidate",
        mall_name: item.mallName,
        web_return_info: toReturnInfoJson(returnInfo)
      }
    }));

  return { status: "ok", products };
}
