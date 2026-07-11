import { NextResponse } from "next/server";
import { getProductById, updateProduct } from "@/lib/dataStore";
import { getCoupangPartnersLinkIssue, isApprovalSampleAffiliateUrl, isUsableAffiliateUrl } from "@/lib/coupangLink";
import { getCustomerPublishReadiness } from "@/lib/quality";
import { requireAdmin } from "@/lib/validators";

type ImportItem = {
  product_id: string;
  title?: string | null;
  status: "valid" | "updated" | "skipped" | "error";
  reason?: string;
  affiliate_url?: string | null;
};

const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const partnersLinkPattern = /https:\/\/link\.coupang\.com\/[^\s,;]+/i;

function importErrorResponse(error: unknown) {
  const message = error instanceof Error && error.message ? error.message.slice(0, 300) : "UNKNOWN_AFFILIATE_LINK_IMPORT_ERROR";
  return NextResponse.json({ error: "BULK_AFFILIATE_LINK_IMPORT_FAILED", message }, { status: 500 });
}

function normalizeAffiliateUrl(value: string | null | undefined) {
  return value?.trim().replace(/[)\].,;]+$/g, "") ?? "";
}

function getRawEntries(body: Record<string, unknown>) {
  if (Array.isArray(body.entries)) return body.entries.map((entry) => String(entry ?? ""));
  if (typeof body.entries === "string") return body.entries.split(/\r?\n/g);
  if (typeof body.text === "string") return body.text.split(/\r?\n/g);
  return [];
}

function parseImportLine(line: string) {
  const productId = line.match(uuidPattern)?.[0] ?? null;
  const affiliateUrl = normalizeAffiliateUrl(line.match(partnersLinkPattern)?.[0] ?? null);
  return { productId, affiliateUrl };
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const lines = getRawEntries(body)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 80);
    const dryRun = body.dryRun === true;
    const publish = body.publish === true;

    const items: ImportItem[] = [];
    let validCount = 0;
    let updatedCount = 0;
    let publishedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const seenProductIds = new Set<string>();

    for (const line of lines) {
      const { productId, affiliateUrl } = parseImportLine(line);
      if (!productId || !affiliateUrl) {
        skippedCount += 1;
        items.push({ product_id: productId ?? "UNKNOWN", title: null, status: "skipped", reason: "PRODUCT_ID_AND_LINK_REQUIRED" });
        continue;
      }
      if (seenProductIds.has(productId)) {
        skippedCount += 1;
        items.push({ product_id: productId, title: null, status: "skipped", reason: "DUPLICATE_PRODUCT_ID" });
        continue;
      }
      seenProductIds.add(productId);

      if (isApprovalSampleAffiliateUrl(affiliateUrl)) {
        skippedCount += 1;
        items.push({ product_id: productId, title: null, status: "skipped", reason: "APPROVAL_SAMPLE_LINK_NOT_ALLOWED", affiliate_url: affiliateUrl });
        continue;
      }
      if (!isUsableAffiliateUrl(affiliateUrl)) {
        skippedCount += 1;
        items.push({ product_id: productId, title: null, status: "skipped", reason: getCoupangPartnersLinkIssue(affiliateUrl) ?? "INVALID_AFFILIATE_URL", affiliate_url: affiliateUrl });
        continue;
      }

      const product = await getProductById(productId);
      if (!product) {
        skippedCount += 1;
        items.push({ product_id: productId, title: null, status: "skipped", reason: "PRODUCT_NOT_FOUND", affiliate_url: affiliateUrl });
        continue;
      }

      try {
        if (dryRun) {
          validCount += 1;
          items.push({ product_id: productId, title: product.title, status: "valid", affiliate_url: affiliateUrl });
          continue;
        }

        if (publish) {
          const readiness = getCustomerPublishReadiness({ ...product, affiliate_url: affiliateUrl });
          if (!readiness.ready) {
            await updateProduct(productId, { affiliate_url: affiliateUrl });
            updatedCount += 1;
            items.push({
              product_id: productId,
              title: product.title,
              status: "updated",
              reason: `PUBLISH_BLOCKED_PUBLIC_QUALITY: ${readiness.blockers.slice(0, 3).join(", ")}`,
              affiliate_url: affiliateUrl
            });
            continue;
          }
        }

        await updateProduct(
          productId,
          publish
            ? { affiliate_url: affiliateUrl, sourcing_status: "published", is_published: true, is_rejected: false }
            : { affiliate_url: affiliateUrl }
        );
        updatedCount += 1;
        if (publish) publishedCount += 1;
        items.push({ product_id: productId, title: product.title, status: "updated", reason: publish ? "PUBLISHED" : undefined, affiliate_url: affiliateUrl });
      } catch (error) {
        errorCount += 1;
        const reason = error instanceof Error && error.message ? error.message.slice(0, 160) : "UPDATE_FAILED";
        items.push({ product_id: productId, title: product.title, status: "error", reason, affiliate_url: affiliateUrl });
      }
    }

    return NextResponse.json({
      status: errorCount > 0 ? (updatedCount > 0 ? "partial" : "error") : "ok",
      scanned_count: lines.length,
      valid_count: validCount,
      updated_count: updatedCount,
      published_count: publishedCount,
      skipped_count: skippedCount,
      error_count: errorCount,
      dry_run: dryRun,
      publish_requested: publish,
      items
    });
  } catch (error) {
    return importErrorResponse(error);
  }
}
