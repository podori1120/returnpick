import { NextResponse } from "next/server";
import { calculateDealScore } from "@/lib/scoring";
import { createDealScore, listProducts, upsertSourcedProduct } from "@/lib/dataStore";
import { extractCoupangProductId } from "@/lib/affiliateIdentity";
import { isUsableCoupangProductUrl } from "@/lib/coupangLink";
import { getProductImageUrlIssue, isUsableProductImageUrl } from "@/lib/productImageUrl";
import { isCategory, isSourcingStatus, requireAdmin, sanitizeText } from "@/lib/validators";
import { parseSpecsFromTitle } from "@/lib/specParser";

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

function boundedText(value: unknown, maxLength: number) {
  return sanitizeText(value, "").slice(0, maxLength);
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const title = boundedText(body.title, 240);
    const category = body.category;
    const coupangUrl = boundedText(body.coupang_url, 2_000);
    const imageUrl = boundedText(body.image_url, 2_000);

    if (title.length < 5) {
      return NextResponse.json({ error: "TITLE_REQUIRED", message: "상품명을 5자 이상 입력하세요." }, { status: 400 });
    }
    if (!isCategory(category)) {
      return NextResponse.json({ error: "CATEGORY_REQUIRED", message: "지원하는 카테고리를 선택하세요." }, { status: 400 });
    }
    if (!isUsableCoupangProductUrl(coupangUrl)) {
      return NextResponse.json(
        {
          error: "COUPANG_PRODUCT_URL_REQUIRED",
          message: "쿠팡 상품 상세 URL(https://www.coupang.com/vp/products/...)을 입력하세요. 검색 결과·공통 랜딩 주소는 후보로 저장하지 않습니다."
        },
        { status: 400 }
      );
    }

    const sourceProductId = extractCoupangProductId(coupangUrl);
    if (!sourceProductId) {
      return NextResponse.json({ error: "COUPANG_PRODUCT_ID_REQUIRED", message: "쿠팡 상품번호를 확인할 수 있는 상품 상세 URL이 필요합니다." }, { status: 400 });
    }

    if (imageUrl && !isUsableProductImageUrl(imageUrl)) {
      return NextResponse.json(
        { error: "INVALID_IMAGE_URL", message: `상품 이미지 URL을 확인하세요. (${getProductImageUrlIssue(imageUrl) ?? "HTTPS 공개 이미지 주소 필요"})` },
        { status: 400 }
      );
    }

    const result = await upsertSourcedProduct({
      source: "manual_admin",
      source_product_id: sourceProductId,
      category,
      title,
      keyword: boundedText(body.keyword, 120) || null,
      brand: boundedText(body.brand, 120) || null,
      model_name: boundedText(body.model_name, 160) || null,
      image_url: imageUrl || null,
      source_url: coupangUrl,
      coupang_url: coupangUrl,
      affiliate_url: null,
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
          product_page_url: coupangUrl,
          source: "admin_manual"
        }
      },
      sourcing_status: "needs_review",
      is_published: false,
      is_rejected: false,
      public_note: boundedText(body.public_note, 500) || null,
      admin_memo: boundedText(body.admin_memo, 500) || null
    });

    const score = calculateDealScore(result.product);
    await createDealScore(score);

    return NextResponse.json(
      {
        product: result.product,
        score,
        inserted: result.inserted,
        message: result.inserted ? "실제 쿠팡 상품을 검토 대기 후보로 추가했습니다." : "기존 상품에 상품 상세 URL 정보를 반영했습니다."
      },
      { status: result.inserted ? 201 : 200 }
    );
  } catch (error) {
    return adminProductsErrorResponse(error);
  }
}
