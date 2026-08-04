import { NextResponse } from "next/server";
import { listProducts, updateProduct } from "@/lib/dataStore";
import { getCoupangPartnersLinkIssue, isApprovalSampleAffiliateUrl, isUsableAffiliateUrl } from "@/lib/coupangLink";
import { getCustomerPublishReadiness } from "@/lib/quality";
import { getAffiliateIdentityReadiness } from "@/lib/affiliateIdentity";
import { findAffiliateImportProduct, parseAffiliateImportLine } from "@/lib/affiliateImport";
import { createManualCatalogReview, isManualCatalogSource } from "@/lib/manualCatalogReview";
import { requireAdmin, requirePersistentStorage } from "@/lib/validators";

type ImportItem = {
  product_id: string;
  matched_by?: "internal_id" | "coupang_product_id";
  title?: string | null;
  status: "valid" | "updated" | "skipped" | "error";
  reason?: string;
  affiliate_url?: string | null;
};

function importErrorResponse(error: unknown) {
  const message = error instanceof Error && error.message ? error.message.slice(0, 300) : "UNKNOWN_AFFILIATE_LINK_IMPORT_ERROR";
  return NextResponse.json({ error: "BULK_AFFILIATE_LINK_IMPORT_FAILED", message }, { status: 500 });
}

function getRawEntries(body: Record<string, unknown>) {
  if (Array.isArray(body.entries)) return body.entries.map((entry) => String(entry ?? ""));
  if (typeof body.entries === "string") return body.entries.split(/\r?\n/g);
  if (typeof body.text === "string") return body.text.split(/\r?\n/g);
  return [];
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const storageUnavailable = requirePersistentStorage();
  if (storageUnavailable) return storageUnavailable;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const lines = getRawEntries(body)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 80);
    const dryRun = body.dryRun === true;
    const publish = body.publish === true;
    const products = await listProducts();

    const items: ImportItem[] = [];
    let validCount = 0;
    let updatedCount = 0;
    let publishedCount = 0;
    let identityPendingCount = 0;
    let publishBlockedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const seenProductIds = new Set<string>();

    for (const line of lines) {
      const { productId, sourceProductId, affiliateUrl } = parseAffiliateImportLine(line);
      if ((!productId && !sourceProductId) || !affiliateUrl) {
        skippedCount += 1;
        items.push({ product_id: productId ?? sourceProductId ?? "UNKNOWN", title: null, status: "skipped", reason: "PRODUCT_ID_AND_LINK_REQUIRED" });
        continue;
      }

      if (isApprovalSampleAffiliateUrl(affiliateUrl)) {
        skippedCount += 1;
        items.push({ product_id: productId ?? sourceProductId ?? "UNKNOWN", title: null, status: "skipped", reason: "APPROVAL_SAMPLE_LINK_NOT_ALLOWED", affiliate_url: affiliateUrl });
        continue;
      }
      if (!isUsableAffiliateUrl(affiliateUrl)) {
        skippedCount += 1;
        items.push({ product_id: productId ?? sourceProductId ?? "UNKNOWN", title: null, status: "skipped", reason: getCoupangPartnersLinkIssue(affiliateUrl) ?? "INVALID_AFFILIATE_URL", affiliate_url: affiliateUrl });
        continue;
      }

      const resolved = findAffiliateImportProduct(products, { productId, sourceProductId, affiliateUrl });
      const product = resolved.product;
      const matchedBy = resolved.matchedBy;
      if (resolved.ambiguous) {
        skippedCount += 1;
        items.push({ product_id: sourceProductId ?? "UNKNOWN", title: null, status: "skipped", reason: "AMBIGUOUS_SOURCE_PRODUCT_ID", affiliate_url: affiliateUrl });
        continue;
      }
      if (!product) {
        skippedCount += 1;
        items.push({ product_id: productId ?? sourceProductId ?? "UNKNOWN", title: null, status: "skipped", reason: "PRODUCT_NOT_FOUND", affiliate_url: affiliateUrl });
        continue;
      }

      if (seenProductIds.has(product.id)) {
        skippedCount += 1;
        items.push({ product_id: product.id, title: product.title, matched_by: matchedBy, status: "skipped", reason: "DUPLICATE_PRODUCT_ID", affiliate_url: affiliateUrl });
        continue;
      }
      seenProductIds.add(product.id);

      const resolvedProductId = product.id;

      const affiliateIdentity = getAffiliateIdentityReadiness({ ...product, affiliate_url: affiliateUrl });
      if (affiliateIdentity.status === "MISMATCH") {
        skippedCount += 1;
        items.push({ product_id: resolvedProductId, title: product.title, matched_by: matchedBy, status: "skipped", reason: "AFFILIATE_TARGET_MISMATCH", affiliate_url: affiliateUrl });
        continue;
      }

      try {
        if (dryRun) {
          validCount += 1;
          const reason = publish && !affiliateIdentity.ready ? "AFFILIATE_IDENTITY_VERIFICATION_REQUIRED" : undefined;
          if (reason) identityPendingCount += 1;
          items.push({ product_id: resolvedProductId, title: product.title, matched_by: matchedBy, status: "valid", reason, affiliate_url: affiliateUrl });
          continue;
        }

        if (publish && !affiliateIdentity.ready) {
          await updateProduct(resolvedProductId, { affiliate_url: affiliateUrl });
          updatedCount += 1;
          identityPendingCount += 1;
          items.push({
            product_id: resolvedProductId,
            title: product.title,
            matched_by: matchedBy,
            status: "updated",
            reason: "AFFILIATE_IDENTITY_VERIFICATION_REQUIRED",
            affiliate_url: affiliateUrl
          });
          continue;
        }

        if (publish) {
          const readiness = getCustomerPublishReadiness({ ...product, affiliate_url: affiliateUrl });
          if (!readiness.ready) {
            await updateProduct(resolvedProductId, { affiliate_url: affiliateUrl });
            updatedCount += 1;
            publishBlockedCount += 1;
            items.push({
              product_id: resolvedProductId,
              title: product.title,
              matched_by: matchedBy,
              status: "updated",
              reason: `PUBLISH_BLOCKED_PUBLIC_QUALITY: ${readiness.blockers.slice(0, 3).join(", ")}`,
              affiliate_url: affiliateUrl
            });
            continue;
          }
        }

        await updateProduct(
          resolvedProductId,
          publish
            ? {
                affiliate_url: affiliateUrl,
                ...(isManualCatalogSource(product.source) ? { raw_json: createManualCatalogReview(product.raw_json) } : {}),
                sourcing_status: "published",
                is_published: true,
                is_rejected: false
              }
            : { affiliate_url: affiliateUrl }
        );
        updatedCount += 1;
        if (publish) publishedCount += 1;
        items.push({ product_id: resolvedProductId, title: product.title, matched_by: matchedBy, status: "updated", reason: publish ? "PUBLISHED" : undefined, affiliate_url: affiliateUrl });
      } catch (error) {
        errorCount += 1;
        const reason = error instanceof Error && error.message ? error.message.slice(0, 160) : "UPDATE_FAILED";
        items.push({ product_id: resolvedProductId, title: product.title, matched_by: matchedBy, status: "error", reason, affiliate_url: affiliateUrl });
      }
    }

    const hasPublishBlockers = identityPendingCount > 0 || publishBlockedCount > 0;
    return NextResponse.json({
      status: errorCount > 0 ? (updatedCount > 0 ? "partial" : "error") : hasPublishBlockers ? "partial" : "ok",
      scanned_count: lines.length,
      valid_count: validCount,
      updated_count: updatedCount,
      published_count: publishedCount,
      identity_pending_count: identityPendingCount,
      publish_blocked_count: publishBlockedCount,
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
