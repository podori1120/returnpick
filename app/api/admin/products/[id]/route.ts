import { NextResponse } from "next/server";
import { calculateDealScore } from "@/lib/scoring";
import { createDealScore, getProductById, updateProduct } from "@/lib/dataStore";
import { parseSpecsFromTitle } from "@/lib/specParser";
import { toNumberOrNull } from "@/lib/format";
import { isConditionGrade, isSourcingStatus, requireAdmin, sanitizeText } from "@/lib/validators";
import type { ConditionGrade, SourcedProduct, SourcingStatus } from "@/lib/types";

function normalizePatch(body: Record<string, unknown>, current: SourcedProduct) {
  const patch: Partial<SourcedProduct> = {};
  const textFields = ["affiliate_url", "public_note", "admin_memo", "rejection_reason"] as const;
  const numberFields = ["return_price", "new_price", "naver_lowest_price", "stock_count", "source_price"] as const;

  for (const field of textFields) {
    if (field in body) patch[field] = sanitizeText(body[field], "") || null;
  }
  for (const field of numberFields) {
    if (field in body) patch[field] = toNumberOrNull(body[field]);
  }

  if ("condition_grade" in body && isConditionGrade(body.condition_grade)) {
    patch.condition_grade = body.condition_grade as ConditionGrade;
  }
  if ("sourcing_status" in body && isSourcingStatus(body.sourcing_status)) {
    patch.sourcing_status = body.sourcing_status as SourcingStatus;
  }
  if ("title" in body) {
    patch.title = sanitizeText(body.title, current.title);
    patch.spec_json = parseSpecsFromTitle(patch.title, current.category);
  }

  return patch;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const product = await getProductById(id);
  if (!product) return NextResponse.json({ error: "PRODUCT_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ product });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const current = await getProductById(id);
  if (!current) return NextResponse.json({ error: "PRODUCT_NOT_FOUND" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : null;
  let patch = normalizePatch(body, current);

  if (action === "approve") {
    patch = { ...patch, sourcing_status: "approved", is_rejected: false, is_published: false };
  }
  if (action === "publish") {
    patch = { ...patch, sourcing_status: "published", is_published: true, is_rejected: false };
  }
  if (action === "unpublish") {
    patch = { ...patch, sourcing_status: "approved", is_published: false };
  }
  if (action === "reject") {
    patch = {
      ...patch,
      sourcing_status: "rejected",
      is_rejected: true,
      is_published: false,
      rejection_reason: patch.rejection_reason ?? "관리자 거절"
    };
  }
  if (action === "sold_out") {
    patch = { ...patch, sourcing_status: "sold_out", is_published: false };
  }

  const updated = await updateProduct(id, patch);
  const score = calculateDealScore(updated);
  await createDealScore(score);

  return NextResponse.json({ product: await getProductById(id) });
}
