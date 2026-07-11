import { NextResponse } from "next/server";
import { listProducts } from "@/lib/dataStore";
import { isCategory, isSourcingStatus, requireAdmin } from "@/lib/validators";

function adminProductsErrorResponse(error: unknown) {
  const message = error instanceof Error && error.message ? error.message.slice(0, 300) : "UNKNOWN_ADMIN_PRODUCTS_ERROR";
  return NextResponse.json({ error: "ADMIN_PRODUCTS_FAILED", message }, { status: 500 });
}

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
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
  } catch (error) {
    return adminProductsErrorResponse(error);
  }
}
