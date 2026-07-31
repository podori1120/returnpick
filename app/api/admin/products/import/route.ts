import { NextResponse } from "next/server";
import { extractCoupangProductId } from "@/lib/affiliateIdentity";
import { getCoupangPartnersLinkIssue, isApprovalSampleAffiliateUrl, isUsableAffiliateUrl, isUsableCoupangProductUrl } from "@/lib/coupangLink";
import { createDealScore, upsertSourcedProduct } from "@/lib/dataStore";
import { getProductImageUrlIssue, isUsableProductImageUrl } from "@/lib/productImageUrl";
import { calculateDealScore } from "@/lib/scoring";
import { parseSpecsFromTitle } from "@/lib/specParser";
import { isCategory, requireAdmin } from "@/lib/validators";

type ImportItem = {
  product_id: string | null;
  title: string | null;
  status: "inserted" | "updated" | "skipped" | "error";
  reason?: string;
};

const MAX_ROWS = 40;

function importErrorResponse(error: unknown) {
  const message = error instanceof Error && error.message ? error.message.slice(0, 300) : "UNKNOWN_PRODUCT_IMPORT_ERROR";
  return NextResponse.json({ error: "ADMIN_PRODUCT_IMPORT_FAILED", message }, { status: 500 });
}

function getEntries(body: Record<string, unknown>) {
  if (typeof body.entries === "string") return body.entries.split(/\r?\n/g);
  if (Array.isArray(body.entries) && body.entries.every((entry) => typeof entry === "string")) return body.entries;
  return null;
}

function text(value: string | undefined, maxLength: number) {
  return value?.trim().slice(0, maxLength) ?? "";
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const entries = getEntries(body);
    if (!entries) {
      return NextResponse.json({ error: "ENTRIES_REQUIRED", message: "entries must be a newline string or string array." }, { status: 400 });
    }

    const rows = entries.map((entry, index) => ({ entry: entry.trim(), row: index + 1 })).filter(({ entry }) => Boolean(entry));
    if (rows.length > MAX_ROWS) {
      return NextResponse.json({ error: "TOO_MANY_ENTRIES", message: `At most ${MAX_ROWS} non-empty rows are allowed.` }, { status: 400 });
    }

    const items: ImportItem[] = [];
    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const seenSourceProductIds = new Set<string>();

    for (const { entry, row } of rows) {
      const fields = entry.split("\t");
      const title = text(fields[0], 240);
      const category = text(fields[1], 80);
      const coupangUrl = text(fields[2], 2_000);
      const affiliateUrl = text(fields[3], 2_000);
      const brand = text(fields[4], 120);
      const modelName = text(fields[5], 160);
      const imageUrl = text(fields[6], 2_000);
      const sourceProductId = extractCoupangProductId(coupangUrl);

      if (fields.length < 3 || fields.length > 7) {
        skippedCount += 1;
        items.push({ product_id: sourceProductId, title: title || null, status: "skipped", reason: "TAB_FIELD_COUNT_INVALID" });
        continue;
      }
      if (title.length < 5) {
        skippedCount += 1;
        items.push({ product_id: sourceProductId, title: title || null, status: "skipped", reason: "TITLE_MIN_LENGTH_REQUIRED" });
        continue;
      }
      if (!isCategory(category)) {
        skippedCount += 1;
        items.push({ product_id: sourceProductId, title, status: "skipped", reason: "INVALID_CATEGORY" });
        continue;
      }
      if (!isUsableCoupangProductUrl(coupangUrl) || !sourceProductId) {
        skippedCount += 1;
        items.push({ product_id: sourceProductId, title, status: "skipped", reason: "COUPANG_PRODUCT_URL_AND_ID_REQUIRED" });
        continue;
      }
      if (seenSourceProductIds.has(sourceProductId)) {
        skippedCount += 1;
        items.push({ product_id: sourceProductId, title, status: "skipped", reason: "DUPLICATE_PRODUCT_ID" });
        continue;
      }
      seenSourceProductIds.add(sourceProductId);
      if (affiliateUrl && (isApprovalSampleAffiliateUrl(affiliateUrl) || !isUsableAffiliateUrl(affiliateUrl))) {
        skippedCount += 1;
        items.push({
          product_id: sourceProductId,
          title,
          status: "skipped",
          reason: isApprovalSampleAffiliateUrl(affiliateUrl)
            ? "APPROVAL_SAMPLE_LINK_NOT_ALLOWED"
            : getCoupangPartnersLinkIssue(affiliateUrl) ?? "INVALID_AFFILIATE_URL"
        });
        continue;
      }
      if (imageUrl && !isUsableProductImageUrl(imageUrl)) {
        skippedCount += 1;
        items.push({ product_id: sourceProductId, title, status: "skipped", reason: getProductImageUrlIssue(imageUrl) ?? "INVALID_IMAGE_URL" });
        continue;
      }

      try {
        const result = await upsertSourcedProduct({
          source: "manual_admin",
          source_product_id: sourceProductId,
          category,
          title,
          brand: brand || null,
          model_name: modelName || null,
          image_url: imageUrl || null,
          source_url: coupangUrl,
          coupang_url: coupangUrl,
          affiliate_url: affiliateUrl || null,
          source_price: null,
          return_price: null,
          new_price: null,
          naver_lowest_price: null,
          condition_grade: "확인필요",
          stock_count: null,
          spec_json: parseSpecsFromTitle(title, category),
          raw_json: {
            manual_entry: {
              created_at: new Date().toISOString(),
              source: "admin_manual_batch_import",
              row,
              product_page_url: coupangUrl,
              affiliate_link_provided: Boolean(affiliateUrl)
            }
          },
          last_observed_at: null,
          sourcing_status: "needs_review",
          is_published: false,
          is_rejected: false
        });
        await createDealScore(calculateDealScore(result.product));

        if (result.inserted) insertedCount += 1;
        else updatedCount += 1;
        items.push({ product_id: result.product.id, title: result.product.title, status: result.inserted ? "inserted" : "updated" });
      } catch (error) {
        errorCount += 1;
        const reason = error instanceof Error && error.message ? error.message.slice(0, 160) : "UPSERT_FAILED";
        items.push({ product_id: sourceProductId, title, status: "error", reason });
      }
    }

    return NextResponse.json({
      status: errorCount > 0 ? (insertedCount + updatedCount > 0 ? "partial" : "error") : skippedCount > 0 ? "partial" : "ok",
      scanned_count: rows.length,
      inserted_count: insertedCount,
      updated_count: updatedCount,
      skipped_count: skippedCount,
      error_count: errorCount,
      items
    });
  } catch (error) {
    return importErrorResponse(error);
  }
}
