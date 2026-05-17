import { NextResponse } from "next/server";
import { listProducts } from "@/lib/dataStore";
import { toPublicDeal } from "@/lib/publicDeal";

const maxCompareItems = 12;

export async function GET(request: Request) {
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
    .filter((product) => product.sourcing_status === "published" && idSet.has(product.id))
    .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
    .map(toPublicDeal);

  return NextResponse.json({ products });
}
