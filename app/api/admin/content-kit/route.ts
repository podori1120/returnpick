import { NextResponse } from "next/server";
import { getProductById } from "@/lib/dataStore";
import { buildProductDistributionKit, getProductDistributionReadiness } from "@/lib/productDistributionKit";
import { requireAdmin } from "@/lib/validators";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  const message = error instanceof Error && error.message ? error.message.slice(0, 240) : "CONTENT_KIT_FAILED";
  const status = message === "PRODUCT_NOT_FOUND" ? 404 : message === "PRODUCT_NOT_PUBLIC_READY" ? 400 : 500;
  return NextResponse.json(
    {
      error: status === 500 ? "CONTENT_KIT_FAILED" : message,
      message:
        status === 404
          ? "상품을 찾지 못했습니다."
          : status === 400
            ? "공개 품질 기준을 통과한 상품만 배포 원고를 만들 수 있습니다."
            : "상품별 배포 원고를 만들지 못했습니다."
    },
    { status }
  );
}

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const productId = new URL(request.url).searchParams.get("product_id")?.trim();
    if (!productId) {
      return NextResponse.json({ error: "PRODUCT_ID_REQUIRED", message: "배포할 상품을 먼저 선택하세요." }, { status: 400 });
    }

    const product = await getProductById(productId);
    if (!product) return NextResponse.json({ error: "PRODUCT_NOT_FOUND", message: "상품을 찾지 못했습니다." }, { status: 404 });

    const readiness = getProductDistributionReadiness(product);
    if (!readiness.ready) {
      return NextResponse.json(
        {
          error: "PRODUCT_NOT_PUBLIC_READY",
          message: "공개 품질 기준을 통과한 상품만 배포 원고를 만들 수 있습니다.",
          blockers: readiness.blockers,
          warnings: readiness.warnings
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ kit: buildProductDistributionKit(product) });
  } catch (error) {
    return errorResponse(error);
  }
}
