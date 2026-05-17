import { NextResponse } from "next/server";
import { listProducts } from "@/lib/dataStore";
import { isCategory, isSourcingStatus, requireAdmin } from "@/lib/validators";

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const category = url.searchParams.get("category");
  const search = url.searchParams.get("search") ?? undefined;
  const published = url.searchParams.get("published");
  const products = await listProducts({
    status: isSourcingStatus(status) ? status : undefined,
    category: isCategory(category) ? category : undefined,
    search,
    published: published === "true" ? true : published === "false" ? false : undefined
  });

  return NextResponse.json({ products });
}
