import { NextResponse } from "next/server";
import { getCategoryLabel } from "@/lib/category";
import { listProducts } from "@/lib/dataStore";
import { matchesProductSearch, normalizeProductSearchText } from "@/lib/productSearch";
import { isPublicDealVisible } from "@/lib/publicDeal";

export const dynamic = "force-dynamic";

function response(body: Record<string, unknown>) {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive"
    }
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = normalizeProductSearchText(url.searchParams.get("q") ?? "").slice(0, 80);
  if (query.length < 2) return response({ items: [] });

  const products = (await listProducts({ published: true }))
    .filter(isPublicDealVisible)
    .filter((product) => matchesProductSearch(product, query))
    .sort((a, b) => {
      const aTitle = normalizeProductSearchText(a.title);
      const bTitle = normalizeProductSearchText(b.title);
      const aExact = aTitle.startsWith(query) ? 1 : 0;
      const bExact = bTitle.startsWith(query) ? 1 : 0;
      return bExact - aExact || (b.latest_score?.total_score ?? 0) - (a.latest_score?.total_score ?? 0);
    })
    .slice(0, 8)
    .map((product) => ({
      id: product.id,
      title: product.title,
      brand: product.brand,
      model_name: product.model_name,
      category_label: getCategoryLabel(product.category),
      score: product.latest_score?.total_score ?? null,
      detail_url: `/deals/${product.id}`
    }));

  return response({ items: products });
}
