import { NextResponse } from "next/server";
import { getProductById } from "@/lib/dataStore";
import { buildTelegramMessage, sendTelegramForProduct } from "@/lib/telegram";
import { requireAdmin } from "@/lib/validators";

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const body = (await request.json().catch(() => ({}))) as { productId?: string; mode?: "preview" | "send" };
  if (!body.productId) return NextResponse.json({ error: "PRODUCT_ID_REQUIRED" }, { status: 400 });

  if (body.mode === "preview") {
    const product = await getProductById(body.productId);
    if (!product) return NextResponse.json({ error: "PRODUCT_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ status: "preview", message: buildTelegramMessage(product) });
  }

  const result = await sendTelegramForProduct(body.productId);
  return NextResponse.json(result);
}
