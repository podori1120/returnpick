import { NextResponse } from "next/server";
import { getCompareProductsErrorPayload } from "@/lib/compareApiError";
import { MAX_COMPARE_ITEMS, normalizeCompareProductId } from "@/lib/compareIdentity";
import { listProducts } from "@/lib/dataStore";
import { isPublicCompareDeal, toPublicDeal } from "@/lib/publicDeal";

const maxCompareItems = MAX_COMPARE_ITEMS;

function compareProductsErrorResponse(error: unknown) {
  const { message } = getCompareProductsErrorPayload(error);
  return NextResponse.json({ ok: false, products: [], error: "COMPARE_PRODUCTS_FAILED", message });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const ids = Array.from(
      new Set(
        (url.searchParams.get("ids") ?? "")
          .split(",")
          .map(normalizeCompareProductId)
          .filter(Boolean)
          .slice(0, maxCompareItems)
      )
    );

    if (!ids.length) return NextResponse.json({ products: [] });

    const idSet = new Set(ids);
    const products = (await listProducts({ published: true }))
      .filter((product) => isPublicCompareDeal(product) && idSet.has(normalizeCompareProductId(product.id)))
      .sort((a, b) => ids.indexOf(normalizeCompareProductId(a.id)) - ids.indexOf(normalizeCompareProductId(b.id)))
      .map(toPublicDeal);

    return NextResponse.json({ products });
  } catch (error) {
    return compareProductsErrorResponse(error);
  }
}
