import { NextResponse } from "next/server";
import { getCompareProductsErrorPayload } from "@/lib/compareApiError";
import { listProducts } from "@/lib/dataStore";
import { getDealFreshness } from "@/lib/dealFreshness";
import { isDemoProduct, isPublicDealReady, isPublicDealVisible, toPublicDeal } from "@/lib/publicDeal";
import type { ProductWithScore } from "@/lib/types";

const maxCompareItems = 12;

function isPublicCompareProduct(product: ProductWithScore) {
  return (
    isPublicDealVisible(product) &&
    !isDemoProduct(product) &&
    isPublicDealReady(product) &&
    getDealFreshness(product).status !== "stale"
  );
}

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
          .map((id) => id.trim())
          .filter(Boolean)
          .slice(0, maxCompareItems)
      )
    );

    if (!ids.length) return NextResponse.json({ products: [] });

    const idSet = new Set(ids);
    const products = (await listProducts({ published: true }))
      .filter((product) => isPublicCompareProduct(product) && idSet.has(product.id))
      .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
      .map(toPublicDeal);

    return NextResponse.json({ products });
  } catch (error) {
    return compareProductsErrorResponse(error);
  }
}
