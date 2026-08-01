import { NextResponse } from "next/server";
import { listSourcingExecutionRuns } from "@/lib/dataStore";
import { getApiReadinessSummary } from "@/lib/apiReadiness";
import { runSourcing } from "@/lib/sourcing";
import { getNextSourcingKeywordOffset } from "@/lib/sourcingCursor";
import { diagnoseSourcingRun } from "@/lib/sourcingDiagnostics";
import { requireAdmin } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function positiveInteger(value: unknown) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

const MOCK_FALLBACK_BLOCKED_AFTER_API_READY = "MOCK_FALLBACK_BLOCKED_AFTER_API_READY";

function sourcingErrorResponse(error: unknown) {
  const message = error instanceof Error && error.message ? error.message.slice(0, 300) : "UNKNOWN_SOURCING_RUN_ERROR";
  return NextResponse.json({ error: "SOURCING_RUN_FAILED", message }, { status: 500 });
}

function getMockFallbackDecision(body: Record<string, unknown>) {
  const readiness = getApiReadinessSummary();
  const requestedMockFallback = typeof body.useMockFallback === "boolean" ? body.useMockFallback : null;

  if (readiness.apiKeysReady && process.env.NODE_ENV === "production") {
    return {
      useMockFallback: false,
      requestedMockFallback,
      mockFallbackBlockedReason: requestedMockFallback === true ? MOCK_FALLBACK_BLOCKED_AFTER_API_READY : null,
      apiKeysReady: readiness.apiKeysReady
    };
  }

  if (requestedMockFallback !== null) {
    return {
      useMockFallback: requestedMockFallback,
      requestedMockFallback,
      mockFallbackBlockedReason: null,
      apiKeysReady: readiness.apiKeysReady
    };
  }

  return {
    useMockFallback: readiness.apiKeysReady ? false : process.env.NODE_ENV !== "production",
    requestedMockFallback,
    mockFallbackBlockedReason: null,
    apiKeysReady: readiness.apiKeysReady
  };
}

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const runs = await listSourcingExecutionRuns(10);
    return NextResponse.json({ runs });
  } catch (error) {
    return sourcingErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const readiness = getApiReadinessSummary();
    if (process.env.NODE_ENV === "production" && !readiness.apiKeysReady) {
      return NextResponse.json({
        error: "COUPANG_API_NOT_READY",
        message: "쿠팡 API 권한이 없어 자동 후보 수집을 대기 중입니다. 상품별 쿠팡 파트너스 링크는 관리자 수동 등록으로 먼저 운영할 수 있습니다.",
        readiness: {
          mode: readiness.mode,
          apiKeysReady: readiness.apiKeysReady,
          launchReady: readiness.launchReady,
          nextAction: "최종승인 후 발급된 쿠팡 API 키 3개를 등록하면 자동 후보 수집을 시작할 수 있습니다."
        }
      }, { status: 409 });
    }
    const keywordOffset = await getNextSourcingKeywordOffset();
    const mockFallbackDecision = getMockFallbackDecision(body);
    const run = await runSourcing({
      useMockFallback: mockFallbackDecision.useMockFallback,
      keywordLimit: positiveInteger(body.keywordLimit),
      keywordOffset,
      timeBudgetMs: positiveInteger(body.timeBudgetMs)
    });
    return NextResponse.json({ run, diagnosis: diagnoseSourcingRun(run), defaults: mockFallbackDecision });
  } catch (error) {
    return sourcingErrorResponse(error);
  }
}
