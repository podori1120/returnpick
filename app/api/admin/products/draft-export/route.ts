import { NextResponse } from "next/server";
import { getAffiliateIdentityReadiness } from "@/lib/affiliateIdentity";
import { getCategoryLabel } from "@/lib/category";
import { isUsableAffiliateUrl, isUsableCoupangProductUrl } from "@/lib/coupangLink";
import { listProducts } from "@/lib/dataStore";
import { getCustomerPublishReadiness } from "@/lib/quality";
import type { ProductWithScore } from "@/lib/types";
import { requireAdmin, requirePersistentStorage } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 40;
const REVIEW_STATUS = "review_only";
const AFFILIATE_DISCLOSURE = "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";
const REVIEW_WARNING = "게시 전에 반품 가격, 반품 등급, 재고, 가격·배송·반품 등 최종 구매 조건을 쿠팡에서 다시 확인하고, 제휴 관계를 명시해야 합니다.";
const REQUIRED_REVIEW_CONFIRMATIONS = [
  "반품 가격은 게시 전에 최종 확인해야 합니다.",
  "반품 등급은 게시 전에 최종 확인해야 합니다.",
  "재고는 게시 전에 최종 확인해야 합니다.",
  "최종 구매 조건(가격·배송·반품)은 게시 전에 쿠팡에서 재확인해야 합니다.",
  "제휴 관계(쿠팡 파트너스)는 게시 전에 명시해야 합니다."
] as const;

type DraftExportItem = {
  id: string;
  title: string;
  category: string;
  new_price?: number;
  public_note: string;
  affiliate_disclosure: string;
  product_url: string;
  affiliate_url: string;
  review_status: typeof REVIEW_STATUS;
  review_blockers: string[];
};

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

function safeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function parseLimit(value: string | null) {
  if (value === null) return DEFAULT_LIMIT;
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= MAX_LIMIT ? parsed : null;
}

function parseFormat(value: string | null) {
  if (value === null || value === "json") return "json" as const;
  if (value === "markdown") return "markdown" as const;
  return null;
}

function canonicalVerifiedUrl(
  value: string | null | undefined,
  checker: (candidate: string | null | undefined) => boolean
) {
  if (!checker(value)) return null;
  try {
    const url = new URL(value as string);
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

function isEligibleDraft(product: ProductWithScore) {
  return (
    product.is_published !== true &&
    product.sourcing_status !== "published" &&
    isUsableAffiliateUrl(product.affiliate_url) &&
    isUsableCoupangProductUrl(product.coupang_url) &&
    getAffiliateIdentityReadiness(product).ready &&
    Boolean(product.public_note?.trim())
  );
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.trim())));
}

function toDraftExportItem(product: ProductWithScore): DraftExportItem | null {
  const productUrl = canonicalVerifiedUrl(product.coupang_url, isUsableCoupangProductUrl);
  const affiliateUrl = canonicalVerifiedUrl(product.affiliate_url, isUsableAffiliateUrl);
  const title = safeText(product.title, 240);
  const publicNote = safeText(product.public_note, 500);
  if (!productUrl || !affiliateUrl || !title || !publicNote) return null;

  const publicReadiness = getCustomerPublishReadiness(product);
  const item: DraftExportItem = {
    id: safeText(product.id, 80),
    title,
    category: getCategoryLabel(product.category),
    public_note: publicNote,
    affiliate_disclosure: AFFILIATE_DISCLOSURE,
    product_url: productUrl,
    affiliate_url: affiliateUrl,
    review_status: REVIEW_STATUS,
    review_blockers: unique([
      ...publicReadiness.blockers.map((blocker) => safeText(blocker, 200)),
      ...REQUIRED_REVIEW_CONFIRMATIONS
    ])
  };

  if (typeof product.new_price === "number" && Number.isFinite(product.new_price)) {
    item.new_price = product.new_price;
  }

  return item;
}

function escapeMarkdownText(value: string) {
  return value.replace(/[\\`*_{}[\]()#+.!|>~-]/g, "\\$&");
}

function markdownLink(label: string, url: string) {
  return `[${escapeMarkdownText(label)}](<${url}>)`;
}

function formatPrice(value: number) {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function renderMarkdown(items: DraftExportItem[], generatedAt: string, eligibleCount: number) {
  const lines = [
    "# ReturnPick 검토용 초안",
    "",
    "> 검토용 초안이며 자동 게시·전송하지 않습니다.",
    `> ${REVIEW_WARNING}`,
    `> ${AFFILIATE_DISCLOSURE}`,
    "",
    `- 생성 시각: ${generatedAt}`,
    `- 검토 후보: ${eligibleCount}건 중 ${items.length}건`,
    "- 상태: review_only",
    ""
  ];

  if (items.length === 0) {
    lines.push("검토 가능한 후보가 없습니다.");
    return `${lines.join("\n")}\n`;
  }

  items.forEach((item, index) => {
    lines.push(
      `## ${index + 1}. ${escapeMarkdownText(item.title)}`,
      `- 카테고리: ${escapeMarkdownText(item.category)}`
    );
    if (item.new_price !== undefined) lines.push(`- 기록된 새상품 가격: ${formatPrice(item.new_price)}`);
    lines.push(
      `- 검토 메모: ${escapeMarkdownText(item.public_note)}`,
      `- 검토 상태: ${item.review_status}`,
      "- 검토 차단·확인 항목:",
      ...item.review_blockers.map((blocker) => `  - ${escapeMarkdownText(blocker)}`),
      `- 상품 URL: ${markdownLink("쿠팡 상품 상세 확인", item.product_url)}`,
      `- 파트너스 URL: ${markdownLink("쿠팡 파트너스 링크", item.affiliate_url)}`,
      `- 제휴 고지: ${AFFILIATE_DISCLOSURE}`,
      ""
    );
  });

  return `${lines.join("\n")}\n`;
}

function exportErrorResponse() {
  return privateJson({ error: "ADMIN_DRAFT_EXPORT_FAILED" }, 500);
}

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const storageUnavailable = requirePersistentStorage();
  if (storageUnavailable) return storageUnavailable;

  const url = new URL(request.url);
  const format = parseFormat(url.searchParams.get("format"));
  const limit = parseLimit(url.searchParams.get("limit"));
  if (!format) return privateJson({ error: "INVALID_DRAFT_EXPORT_FORMAT" }, 400);
  if (limit === null) return privateJson({ error: "INVALID_DRAFT_EXPORT_LIMIT" }, 400);

  try {
    const products = await listProducts();
    const eligibleProducts = products.filter(isEligibleDraft);
    const items = eligibleProducts
      .slice(0, limit)
      .map(toDraftExportItem)
      .filter((item): item is DraftExportItem => Boolean(item));
    const generatedAt = new Date().toISOString();

    if (format === "markdown") {
      return new Response(renderMarkdown(items, generatedAt, eligibleProducts.length), {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": 'attachment; filename="returnpick-review-drafts.md"'
        }
      });
    }

    return privateJson({
      generated_at: generatedAt,
      format,
      counts: {
        eligible: eligibleProducts.length,
        exported: items.length
      },
      items
    });
  } catch {
    return exportErrorResponse();
  }
}
