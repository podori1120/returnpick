import { NextResponse } from "next/server";
import { createBootstrapCatalog } from "@/lib/bootstrapCatalog";
import { listProducts } from "@/lib/dataStore";
import { requireAdmin } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const products = await listProducts();
    const result = createBootstrapCatalog(products);
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    });
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message.slice(0, 300) : "UNKNOWN_BOOTSTRAP_CATALOG_ERROR";
    return NextResponse.json(
      {
        status: "error",
        error: "BOOTSTRAP_CATALOG_EXPORT_FAILED",
        message
      },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
