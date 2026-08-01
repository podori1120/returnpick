import { NextResponse } from "next/server";
import { listProducts } from "@/lib/dataStore";
import { isPublicDealVisible, toPublicDeal } from "@/lib/publicDeal";

const maxCompareItems = 12;

function compareProductsErrorResponse(error: unknown) {
  const message = error instanceof Error && error.message ? error.message.slice(0, 300) : "UNKNOWN_COMPARE_PRODUCTS_ERROR";
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
      .filter((product) => isPublicDealVisible(product) && idSet.has(product.id))
      .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
      .map(toPublicDeal);

    return NextResponse.json({ products });
  } catch (error) {
    return compareProductsErrorResponse(error);
  }
}
