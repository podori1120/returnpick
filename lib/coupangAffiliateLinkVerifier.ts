import "server-only";
import { getCoupangPartnersLinkIssue } from "@/lib/coupangLink";

export type CoupangAffiliateLinkVerificationCode =
  | "RESOLVED_PRODUCT"
  | "RESOLVED_PRODUCT_ACCESS_LIMITED"
  | "INVALID_AFFILIATE_URL"
  | "REDIRECT_BLOCKED"
  | "REDIRECT_LIMIT"
  | "NOT_PRODUCT_PAGE"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_HTTP_ERROR";

export type CoupangAffiliateLinkVerification = {
  ok: boolean;
  code: CoupangAffiliateLinkVerificationCode;
  message: string;
  final_url?: string;
  product_id?: string;
  http_status?: number;
  redirect_count: number;
  checked_at: string;
};

const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 4_000;
const TOTAL_TIMEOUT_MS = 8_000;
const redirectStatuses = new Set([301, 302, 303, 307, 308]);
const accessLimitedStatuses = new Set([401, 403, 405, 429]);

function result(
  input: Omit<CoupangAffiliateLinkVerification, "checked_at"> & Partial<Pick<CoupangAffiliateLinkVerification, "checked_at">>
): CoupangAffiliateLinkVerification {
  return { ...input, checked_at: input.checked_at ?? new Date().toISOString() };
}

function isAllowedCoupangDestination(url: URL) {
  if (url.protocol !== "https:" || url.port || url.username || url.password) return false;
  return url.hostname === "coupang.com" || url.hostname.endsWith(".coupang.com");
}

function safeDestinationUrl(url: URL) {
  return `${url.origin}${url.pathname}`;
}

function productIdFromUrl(url: URL) {
  return url.pathname.match(/^\/vp\/products\/(\d+)(?:\/|$)/)?.[1] ?? null;
}

async function cancelResponseBody(response: Response) {
  await response.body?.cancel().catch(() => undefined);
}

async function fetchHeadersOnly(url: URL, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
        "User-Agent": "ReturnPickLinkCheck/0.1 (+https://returnpick.vercel.app/disclosure)"
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function verifyCoupangAffiliateLinkResolution(value: string): Promise<CoupangAffiliateLinkVerification> {
  const issue = getCoupangPartnersLinkIssue(value);
  if (issue) {
    return result({
      ok: false,
      code: "INVALID_AFFILIATE_URL",
      message: "https://link.coupang.com/a/... 형식의 쿠팡 파트너스 링크만 확인할 수 있습니다.",
      redirect_count: 0
    });
  }

  let current = new URL(value);
  let redirectCount = 0;
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;

  while (true) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      return result({ ok: false, code: "UPSTREAM_TIMEOUT", message: "쿠팡 링크 확인 시간이 초과됐습니다.", redirect_count: redirectCount });
    }

    let response: Response;
    try {
      response = await fetchHeadersOnly(current, Math.min(REQUEST_TIMEOUT_MS, remainingMs));
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      return result({
        ok: false,
        code: timedOut ? "UPSTREAM_TIMEOUT" : "UPSTREAM_HTTP_ERROR",
        message: timedOut ? "쿠팡 링크 확인 시간이 초과됐습니다." : "쿠팡 링크에 연결하지 못했습니다. 잠시 후 다시 확인하세요.",
        redirect_count: redirectCount
      });
    }

    const location = response.headers.get("location");
    const status = response.status;
    await cancelResponseBody(response);

    if (redirectStatuses.has(status)) {
      if (!location) {
        return result({
          ok: false,
          code: "UPSTREAM_HTTP_ERROR",
          message: "쿠팡 리다이렉트 응답에 목적지가 없습니다.",
          http_status: status,
          redirect_count: redirectCount
        });
      }
      if (redirectCount >= MAX_REDIRECTS) {
        return result({ ok: false, code: "REDIRECT_LIMIT", message: "쿠팡 링크의 이동 단계가 너무 많습니다.", http_status: status, redirect_count: redirectCount });
      }

      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        return result({ ok: false, code: "REDIRECT_BLOCKED", message: "쿠팡 링크의 이동 주소를 안전하게 해석할 수 없습니다.", http_status: status, redirect_count: redirectCount });
      }
      if (!isAllowedCoupangDestination(next)) {
        return result({ ok: false, code: "REDIRECT_BLOCKED", message: "쿠팡 HTTPS 상품 도메인이 아닌 이동 목적지는 차단했습니다.", http_status: status, redirect_count: redirectCount });
      }

      current = next;
      redirectCount += 1;
      continue;
    }

    const finalUrl = safeDestinationUrl(current);
    const productId = productIdFromUrl(current);
    if (productId) {
      if (accessLimitedStatuses.has(status)) {
        return result({
          ok: true,
          code: "RESOLVED_PRODUCT_ACCESS_LIMITED",
          message: "쿠팡 상품 페이지 목적지를 확인했습니다. 쿠팡이 자동 요청은 제한했으므로 브라우저에서 최종 상품을 확인하세요.",
          final_url: finalUrl,
          product_id: productId,
          http_status: status,
          redirect_count: redirectCount
        });
      }
      if (status >= 200 && status < 400) {
        return result({
          ok: true,
          code: "RESOLVED_PRODUCT",
          message: "쿠팡 상품 상세 페이지로 정상 연결됩니다.",
          final_url: finalUrl,
          product_id: productId,
          http_status: status,
          redirect_count: redirectCount
        });
      }
      return result({
        ok: false,
        code: "UPSTREAM_HTTP_ERROR",
        message: "상품 페이지 경로는 확인했지만 쿠팡 응답 상태가 정상적이지 않습니다.",
        final_url: finalUrl,
        product_id: productId,
        http_status: status,
        redirect_count: redirectCount
      });
    }

    return result({
      ok: false,
      code: status >= 400 ? "UPSTREAM_HTTP_ERROR" : "NOT_PRODUCT_PAGE",
      message: status >= 400 ? "쿠팡 링크 응답 상태가 정상적이지 않습니다." : "쿠팡 상품 상세 페이지가 아닌 주소로 연결됩니다.",
      final_url: isAllowedCoupangDestination(current) ? finalUrl : undefined,
      http_status: status,
      redirect_count: redirectCount
    });
  }
}
