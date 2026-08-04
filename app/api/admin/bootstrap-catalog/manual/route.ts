import { NextResponse } from "next/server";
import {
  createManualBootstrapCatalog,
  MANUAL_BOOTSTRAP_MAX_BODY_BYTES,
  type ManualBootstrapRow
} from "@/lib/manualBootstrapCatalog";
import { requireAdmin } from "@/lib/validators";

export const runtime = "nodejs";
export const maxDuration = 15;

function errorResponse(error: string, message: string, status: number) {
  return NextResponse.json({ status: "invalid", error, message }, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}

async function readBoundedBody(request: Request) {
  if (!request.body) return { ok: true as const, raw: "" };

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        chunks.push(decoder.decode());
        return { ok: true as const, raw: chunks.join("") };
      }
      if (!value) continue;
      byteLength += value.byteLength;
      if (byteLength > MANUAL_BOOTSTRAP_MAX_BODY_BYTES) {
        await reader.cancel();
        return { ok: false as const };
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const declaredLength = Number(request.headers.get("content-length") ?? "");
    if (Number.isFinite(declaredLength) && declaredLength > MANUAL_BOOTSTRAP_MAX_BODY_BYTES) {
      return errorResponse("MANUAL_BOOTSTRAP_BODY_TOO_LARGE", `임시 카탈로그 입력은 ${MANUAL_BOOTSTRAP_MAX_BODY_BYTES / 1_000}KB 이하로 보내 주세요.`, 413);
    }

    const bodyRead = await readBoundedBody(request);
    if (!bodyRead.ok) {
      return errorResponse("MANUAL_BOOTSTRAP_BODY_TOO_LARGE", `임시 카탈로그 입력은 ${MANUAL_BOOTSTRAP_MAX_BODY_BYTES / 1_000}KB 이하로 보내 주세요.`, 413);
    }
    const raw = bodyRead.raw;

    let body: { rows?: unknown; manual_identity_confirmed?: unknown };
    try {
      const parsed = JSON.parse(raw || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return errorResponse("BODY_OBJECT_REQUIRED", "요청 본문은 객체 형식이어야 합니다.", 400);
      }
      body = parsed as { rows?: unknown; manual_identity_confirmed?: unknown };
    } catch {
      return errorResponse("INVALID_JSON", "임시 카탈로그 입력 형식을 확인해 주세요.", 400);
    }

    if (!Array.isArray(body.rows)) return errorResponse("ROWS_REQUIRED", "입력한 상품 행이 없습니다.", 400);
    if (!body.rows.every((row) => Boolean(row && typeof row === "object" && !Array.isArray(row)))) {
      return errorResponse("ROW_RECORD_REQUIRED", "모든 상품 행은 객체 형식이어야 합니다.", 400);
    }
    const rows = body.rows as ManualBootstrapRow[];
    const result = createManualBootstrapCatalog(rows, body.manual_identity_confirmed === true);
    const status = result.status === "invalid" ? 400 : result.status === "too_large" ? 413 : 200;
    const payload =
      result.status === "ready"
        ? {
            ...result,
            storage_mode: "manual_input" as const,
            storage_message: "관리자가 직접 확인한 상품으로 만든 임시 공개 스냅샷입니다. Vercel 환경변수로 재배포해야 유지되며, 영구 운영에는 Supabase가 필요합니다."
          }
        : result;
    return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message.slice(0, 300) : "UNKNOWN_MANUAL_BOOTSTRAP_ERROR";
    return errorResponse("MANUAL_BOOTSTRAP_FAILED", message, 500);
  }
}
