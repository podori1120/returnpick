import { NextResponse } from "next/server";
import { createBootstrapCatalog } from "@/lib/bootstrapCatalog";
import { listProducts } from "@/lib/dataStore";
import { hasSupabaseConfig } from "@/lib/supabase";
import { requireAdmin } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const products = await listProducts();
    const result = createBootstrapCatalog(products);
    const storageMode = hasSupabaseConfig() ? "supabase" : "memory_fallback";
    return NextResponse.json(
      {
        ...result,
        storage_mode: storageMode,
        storage_message:
          storageMode === "supabase"
            ? "현재 상품과 검수 상태를 Supabase 운영 DB에서 읽었습니다."
            : "현재 요청은 임시 메모리 저장소에서 읽었습니다. Vercel 재배포나 서버리스 인스턴스 교체 전에는 후보·수정 사항이 보존되지 않을 수 있습니다."
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0"
        }
      }
    );
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
