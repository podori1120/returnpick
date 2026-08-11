import { randomUUID } from "node:crypto";
import { extractCoupangProductId } from "@/lib/affiliateIdentity";
import {
  BOOTSTRAP_CATALOG_ENV,
  BOOTSTRAP_CATALOG_MAX_BYTES,
  BOOTSTRAP_CATALOG_MAX_PRODUCTS,
  readBootstrapCatalog
} from "@/lib/bootstrapCatalog";
import { isCoupangPartnersLink, isUsableAffiliateUrl } from "@/lib/coupangLink";
import { createCoupangDeeplink, searchCoupangProducts } from "@/lib/providers/coupangPartnersProvider";
import { searchNaverShopping } from "@/lib/providers/naverShoppingProvider";
import {
  MAX_PUBLIC_WEB_ALLOWED_HOSTS,
  MAX_PUBLIC_WEB_SEARCH_TEMPLATES,
  searchPublicWebProducts
} from "@/lib/providers/publicWebProvider";
import { getCustomerPublishReadiness } from "@/lib/quality";
import {
  OPTIONAL_CAPABILITY_ITEM_IDS,
  evaluateCatalogLaunchReadiness,
  evaluateLaunchReadiness,
  getOptionalConnectionCheckIds,
  getRequiredConnectionCheckIds
} from "@/lib/launchCapabilityPolicy";
import { getSupabaseAnonClient, getSupabaseServiceClient, hasSupabaseConfig } from "@/lib/supabase";
import type { JsonValue, ProductWithScore } from "@/lib/types";
import { isStrongAdminPassword } from "@/lib/validators";

type ReadinessState = "ready" | "missing" | "partial" | "disabled";
type ReadinessMode = "pre_approval" | "manual_launch_ready" | "api_ready" | "launch_ready";

const EXPECTED_SCHEMA_VERSION = "2026-08-11-hotdeals-identity-v1";

export type ApiReadinessItem = {
  id: string;
  label: string;
  state: ReadinessState;
  configured: boolean;
  requiredEnv: string[];
  missingEnv: string[];
  message: string;
  nextAction: string;
};

export type ApiReadinessSummary = {
  checkedAt: string;
  mode: ReadinessMode;
  items: ApiReadinessItem[];
  requiredForApiLaunch: string[];
  apiKeysReady: boolean;
  runtimeReady: boolean;
  launchReady: boolean;
  catalogLaunchReady: boolean;
  blockingItemIds: string[];
  blockingEnv: string[];
  optionalItemIds: string[];
  optionalMissingItemIds: string[];
  optionalMissingEnv: string[];
  requiredConnectionCheckIds: string[];
  optionalConnectionCheckIds: string[];
};

export type ApiConnectionCheck = {
  id: string;
  label: string;
  status: "ok" | "skipped" | "error";
  message: string;
  detail?: Record<string, JsonValue>;
};

export type SupabaseStorageReadiness = {
  status: "verified" | "unconfigured" | "unverified";
  message: string;
  checkedAt: string;
};

function normalizeUrl(value: string | undefined) {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function getPublicSiteUrlIssue(value: string | undefined) {
  const raw = value?.trim();
  if (!raw) return "missing";

  try {
    const url = new URL(raw);
    const hostname = url.hostname.toLowerCase();
    const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

    if (url.username || url.password) return "credentials_not_allowed";
    if (url.protocol !== "https:") return "https_required";
    if (localHosts.has(hostname) || hostname.endsWith(".local")) return "public_domain_required";

    return null;
  } catch {
    return "invalid_url";
  }
}

function siteUrlIssueMessage(issue: string | null) {
  switch (issue) {
    case "credentials_not_allowed":
      return "NEXT_PUBLIC_SITE_URL에는 아이디/비밀번호가 포함되면 안 됩니다.";
    case "https_required":
      return "NEXT_PUBLIC_SITE_URL은 https://로 시작하는 공개 주소여야 합니다.";
    case "public_domain_required":
      return "NEXT_PUBLIC_SITE_URL은 localhost가 아니라 외부에서 접속 가능한 배포 주소여야 합니다.";
    case "invalid_url":
      return "NEXT_PUBLIC_SITE_URL 형식이 올바르지 않습니다.";
    case "missing":
      return "NEXT_PUBLIC_SITE_URL이 없습니다.";
    default:
      return "NEXT_PUBLIC_SITE_URL이 공개 운영 주소로 설정되어 있습니다.";
  }
}

function compactText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 240) : null;
}

async function safeJsonPayload(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, JsonValue>;
  } catch {
    return { raw_text: text.slice(0, 500) };
  }
}

function telegramPayloadMessage(payload: Record<string, JsonValue>) {
  return (
    compactText(payload.description) ??
    compactText(payload.error_code) ??
    compactText(payload.message) ??
    compactText(payload.raw_text)
  );
}

function looksLikePlaceholder(value: string | undefined) {
  const raw = value?.trim().toLowerCase() ?? "";
  if (!raw) return false;
  return (
    raw.includes("your_") ||
    raw.includes("your-") ||
    raw.includes("change_me") ||
    raw.includes("changeme") ||
    raw.includes("placeholder") ||
    raw.includes("todo") ||
    raw.includes("발급") ||
    raw.includes("입력") ||
    raw === "test" ||
    raw === "secret" ||
    raw === "password" ||
    raw.startsWith("<") ||
    raw.endsWith(">")
  );
}

function isLikelyProviderSecret(value: string | undefined, minLength = 8) {
  const raw = value?.trim() ?? "";
  if (raw.length < minLength) return false;
  if (/\s/.test(raw)) return false;
  if (looksLikePlaceholder(raw)) return false;
  return true;
}

function isLikelyTelegramBotToken(value: string | undefined) {
  const raw = value?.trim() ?? "";
  if (looksLikePlaceholder(raw)) return false;
  return /^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(raw);
}

function isLikelyTelegramChatId(value: string | undefined) {
  const raw = value?.trim() ?? "";
  if (looksLikePlaceholder(raw)) return false;
  return /^-?\d{5,}$/.test(raw) || /^@[A-Za-z0-9_]{5,}$/.test(raw);
}

function connectionCheckForUnavailableItem(item: ApiReadinessItem | undefined, label: string, skippedMessage: string): ApiConnectionCheck {
  if (!item || item.state === "missing") {
    return { id: item?.id ?? label, label, status: "skipped", message: skippedMessage };
  }

  return {
    id: item.id,
    label,
    status: "error",
    message: item.message,
    detail: {
      missing_or_invalid_env: item.missingEnv,
      next_action: item.nextAction
    }
  };
}

function connectionCheckFailure(id: string, label: string, error: unknown): ApiConnectionCheck {
  const message = error instanceof Error && error.message ? error.message.slice(0, 300) : "UNKNOWN_CONNECTION_CHECK_ERROR";
  return {
    id,
    label,
    status: "error",
    message: `${label} 연결 테스트 중 예외가 발생했습니다. ${message}`,
    detail: {
      error: message
    }
  };
}

function dataQualityDependencyCheck(message: string, supabaseStatus: string): ApiConnectionCheck {
  return {
    id: "data_quality",
    label: "공개 데이터 품질",
    status: "skipped",
    message,
    detail: {
      blocked_by: "supabase",
      supabase_status: supabaseStatus,
      operator_next_action: "Supabase 운영 DB 설정과 스키마 검사를 먼저 통과시킨 뒤 공개 데이터 품질 검사를 다시 실행하세요."
    }
  };
}

function describeCoupangApiIssue(...values: Array<string | null | undefined>) {
  const raw = values.filter(Boolean).join(" | ").slice(0, 500);
  const text = raw.toLowerCase();

  if (
    text.includes("coupang_http_401") ||
    text.includes("coupang_http_403") ||
    text.includes("unauthorized") ||
    text.includes("forbidden") ||
    text.includes("permission") ||
    text.includes("not approved") ||
    text.includes("access denied") ||
    text.includes("권한") ||
    text.includes("승인")
  ) {
    return {
      code: "COUPANG_API_PERMISSION_OR_APPROVAL_REQUIRED",
      message:
        "쿠팡 파트너스 API 권한이 아직 열리지 않았거나 키 권한이 맞지 않습니다. 쿠팡 안내처럼 최종승인 후 파트너스 API 메뉴에서 발급된 키를 넣어야 검색/딥링크가 작동합니다.",
      nextAction:
        "최종승인 전이면 정상 대기 상태입니다. 승인 후 COUPANG_ACCESS_KEY, COUPANG_SECRET_KEY, COUPANG_PARTNER_ID를 새로 발급해 Vercel에 등록하고 재배포한 뒤 실제 연결 테스트를 다시 실행하세요."
    };
  }

  if (text.includes("signature") || text.includes("hmac") || text.includes("invalid key") || text.includes("invalid-key")) {
    return {
      code: "COUPANG_API_SIGNATURE_OR_KEY_MISMATCH",
      message: "쿠팡 API 서명 또는 키 값이 맞지 않습니다. 복사한 access key, secret key, partner id에 공백이나 오래된 값이 섞였는지 확인해야 합니다.",
      nextAction: "쿠팡 파트너스 API 메뉴에서 키를 다시 복사해 Vercel 환경변수 3개를 갱신하고 재배포하세요."
    };
  }

  return {
    code: "COUPANG_API_CONNECTION_FAILED",
    message: raw || "쿠팡 파트너스 API 연결에 실패했습니다.",
    nextAction: "쿠팡 파트너스 API 권한, 키 값, 일시적인 API 장애 여부를 확인한 뒤 실제 연결 테스트를 다시 실행하세요."
  };
}

function readableCoupangConnectionCheck(check: ApiConnectionCheck): ApiConnectionCheck {
  if (check.id !== "coupang") return check;

  if (check.status === "skipped") {
    return {
      ...check,
      label: "쿠팡 파트너스 API",
      message: "쿠팡 API 키가 없어 실제 연결 테스트를 건너뜁니다. 최종승인 전이면 정상 대기 상태입니다.",
      detail: {
        ...(check.detail ?? {}),
        operator_next_action:
          "최종승인 후 쿠팡 파트너스 API 메뉴에서 키를 발급받아 Vercel에 등록하고 재배포한 뒤 다시 테스트하세요."
      }
    };
  }

  if (check.status === "ok") {
    return {
      ...check,
      label: "쿠팡 파트너스 API",
      message: "쿠팡 상품 검색과 파트너스 딥링크 생성 경로가 실제 API로 확인되었습니다."
    };
  }

  const detail = check.detail ?? {};
  const issue = describeCoupangApiIssue(
    check.message,
    typeof detail.provider_status === "string" ? detail.provider_status : null,
    typeof detail.deeplink_status === "string" ? detail.deeplink_status : null,
    typeof detail.deeplink_error === "string" ? detail.deeplink_error : null
  );

  return {
    ...check,
    label: "쿠팡 파트너스 API",
    message: issue.message,
    detail: {
      ...detail,
      coupang_issue_code: issue.code,
      operator_next_action: issue.nextAction,
      raw_provider_message: check.message
    }
  };
}

function describeNaverApiIssue(...values: Array<string | null | undefined>) {
  const raw = values.filter(Boolean).join(" | ").slice(0, 500);
  const text = raw.toLowerCase();

  if (
    text.includes("naver_http_401") ||
    text.includes("naver_http_403") ||
    text.includes("unauthorized") ||
    text.includes("forbidden") ||
    text.includes("invalid client") ||
    text.includes("invalid_client") ||
    text.includes("authentication") ||
    text.includes("permission") ||
    text.includes("권한") ||
    text.includes("인증")
  ) {
    return {
      code: "NAVER_API_CREDENTIAL_OR_PERMISSION_FAILED",
      message:
        "네이버 쇼핑 API 인증에 실패했습니다. Client ID/Secret이 잘못됐거나 애플리케이션의 검색 API 사용 권한이 아직 준비되지 않았을 수 있습니다.",
      nextAction:
        "네이버 개발자센터에서 쇼핑 검색 API가 활성화된 애플리케이션의 NAVER_CLIENT_ID와 NAVER_CLIENT_SECRET을 다시 복사해 Vercel에 함께 등록하고 재배포하세요."
    };
  }

  if (
    text.includes("naver_http_429") ||
    text.includes("rate") ||
    text.includes("quota") ||
    text.includes("limit") ||
    text.includes("too many")
  ) {
    return {
      code: "NAVER_API_RATE_LIMITED",
      message: "네이버 쇼핑 API 호출 한도 또는 속도 제한에 걸렸습니다. 앱 자체 문제라기보다 운영 호출량 조정이 필요한 상태입니다.",
      nextAction: "소싱 키워드 수나 실행 주기를 잠시 줄이고, 네이버 개발자센터의 호출량/쿼터 상태를 확인한 뒤 다시 실행하세요."
    };
  }

  return {
    code: "NAVER_API_CONNECTION_FAILED",
    message: raw || "네이버 쇼핑 API 연결에 실패했습니다.",
    nextAction: "네이버 Client ID/Secret, 쇼핑 검색 API 사용 설정, 일시적인 API 장애 여부를 확인한 뒤 실제 연결 테스트를 다시 실행하세요."
  };
}

function readableNaverConnectionCheck(check: ApiConnectionCheck): ApiConnectionCheck {
  if (check.id !== "naver") return check;

  if (check.status === "skipped") {
    return {
      ...check,
      label: "네이버 쇼핑 API",
      message: "네이버 API 키가 없어 실제 연결 테스트를 건너뜁니다. 승인 전에는 가격 기준선을 수동/기존값으로 유지할 수 있습니다.",
      detail: {
        ...(check.detail ?? {}),
        operator_next_action: "NAVER_CLIENT_ID와 NAVER_CLIENT_SECRET을 네이버 개발자센터에서 발급받아 Vercel에 함께 등록하세요."
      }
    };
  }

  if (check.status === "ok") {
    return {
      ...check,
      label: "네이버 쇼핑 API",
      message: check.message || "네이버 쇼핑 API로 최저가 기준선 검색 경로가 확인되었습니다."
    };
  }

  const detail = check.detail ?? {};
  const issue = describeNaverApiIssue(
    check.message,
    typeof detail.provider_status === "string" ? detail.provider_status : null
  );

  return {
    ...check,
    label: "네이버 쇼핑 API",
    message: issue.message,
    detail: {
      ...detail,
      naver_issue_code: issue.code,
      operator_next_action: typeof detail.operator_next_action === "string" ? detail.operator_next_action : issue.nextAction,
      raw_provider_message: check.message
    }
  };
}

function readinessRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function hasFailedReadinessStep(value: unknown) {
  const record = readinessRecord(value);
  const steps = Array.isArray(record.steps) ? record.steps : [];
  return steps.some((step) => {
    const stepRecord = readinessRecord(step);
    return stepRecord.ok === false || Boolean(stepRecord.error);
  });
}

function hasArrayFailure(value: unknown) {
  return Array.isArray(value) && value.some((item) => Boolean(readinessRecord(item).error));
}

function summarizePublicQualityBlockers(items: Array<{ readiness: ReturnType<typeof getCustomerPublishReadiness> }>) {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const blocker of item.readiness.blockers) {
      counts.set(blocker, (counts.get(blocker) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([blocker, count]) => ({ blocker, count }));
}

function publicQualityNextAction(summary: Array<{ blocker: string; count: number }>, approvalLinkReuseCount: number, publicAffiliateConstraintOk: boolean) {
  if (!publicAffiliateConstraintOk) {
    return "최신 sql/schema.sql을 Supabase에 다시 적용해 공개 상품의 쿠팡 파트너스 링크 DB 제약을 먼저 복구하세요.";
  }
  if (approvalLinkReuseCount > 0) {
    return "승인용 샘플 링크를 실제 상품에 재사용한 행을 상품별 쿠팡 파트너스 링크로 바꾼 뒤 다시 테스트하세요.";
  }
  const top = summary[0];
  if (top) {
    return `공개 보류 상품의 최다 blocker는 '${top.blocker}' ${top.count}건입니다. 관리자 후보 검토에서 이 항목부터 보강한 뒤 다시 실제 연결 테스트를 실행하세요.`;
  }
  return "공개 데이터 품질은 통과했습니다. 첫 가동 실행으로 후보 수집, 제휴 링크 보강, 네이버 가격 보강을 이어가면 됩니다.";
}

function describeSupabaseIssue(detail: Record<string, JsonValue>, fallbackMessage: string) {
  const schemaVersion = readinessRecord(detail.schema_version);
  const schemaVersionErrors = Array.isArray(schemaVersion.errors) ? schemaVersion.errors : [];
  const schemaVersionOk = schemaVersion.ok === true;

  if (detail.missing_or_invalid_env) {
    return {
      code: "SUPABASE_ENV_INVALID",
      message: "Supabase 환경변수 값이 비어 있거나 형식이 맞지 않습니다. 운영 DB 연결 전에 URL, anon key, service role key를 다시 확인해야 합니다.",
      nextAction: "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY를 Supabase 프로젝트에서 다시 복사해 Vercel에 등록하고 재배포하세요."
    };
  }

  if (schemaVersionErrors.length > 0 || (schemaVersion.actual && !schemaVersionOk)) {
    return {
      code: "SUPABASE_SCHEMA_VERSION_MISMATCH",
      message: "Supabase 테이블은 연결됐지만 최신 schema.sql 버전 표식이 맞지 않습니다. 오래된 SQL이 적용된 상태일 수 있습니다.",
      nextAction: "Supabase SQL Editor에서 C:\\projects\\returnpick\\sql\\schema.sql 전체를 연속 두 번 오류 없이 실행한 뒤 Vercel을 재배포하고 실제 연결 테스트를 다시 누르세요."
    };
  }

  if (hasArrayFailure(detail.tables) || hasArrayFailure(detail.schema)) {
    return {
      code: "SUPABASE_TABLE_OR_COLUMN_MISSING",
      message: "Supabase 필수 테이블 또는 컬럼 일부가 없습니다. API 키가 있어도 후보 저장, 점수 저장, 클릭 추적이 바로 실패할 수 있습니다.",
      nextAction: "Supabase SQL Editor에서 최신 sql/schema.sql을 연속 두 번 오류 없이 실행해 테이블과 컬럼을 맞춘 뒤 다시 테스트하세요."
    };
  }

  if (hasFailedReadinessStep(detail.strict_affiliate_function)) {
    return {
      code: "SUPABASE_STRICT_AFFILIATE_FUNCTION_FAILED",
      message: "상품별 쿠팡 파트너스 링크를 검증하는 DB 함수 또는 제약이 최신 상태가 아닙니다.",
      nextAction: "최신 sql/schema.sql을 다시 적용해 is_strict_coupang_partners_url 함수와 공개 상품 제약을 갱신하세요."
    };
  }

  if (hasFailedReadinessStep(detail.write_smoke)) {
    return {
      code: "SUPABASE_WRITE_SMOKE_FAILED",
      message: "Supabase 쓰기 테스트가 실패했습니다. 실행 로그나 클릭 이벤트 저장이 운영에서 남지 않을 수 있습니다.",
      nextAction: "SUPABASE_SERVICE_ROLE_KEY가 service role 키인지 확인하고, sourcing_runs와 affiliate_events 테이블 권한/제약을 최신 SQL로 맞추세요."
    };
  }

  if (hasFailedReadinessStep(detail.anon_public_rls_smoke)) {
    return {
      code: "SUPABASE_PUBLIC_RLS_FAILED",
      message: "공개 사용자 기준 RLS 검증이 실패했습니다. 공개 상품이 보이지 않거나 비공개 상품이 노출될 위험이 있습니다.",
      nextAction: "sql/schema.sql의 RLS 정책을 다시 적용하고, anon key가 해당 Supabase 프로젝트의 공개 anon key인지 확인하세요."
    };
  }

  return {
    code: "SUPABASE_CONNECTION_FAILED",
    message: fallbackMessage || "Supabase 운영 DB 연결 테스트에 실패했습니다.",
    nextAction: "Supabase 프로젝트 URL, 키, 최신 SQL 적용 여부를 확인한 뒤 실제 연결 테스트를 다시 실행하세요."
  };
}

function readableSupabaseConnectionCheck(check: ApiConnectionCheck): ApiConnectionCheck {
  if (check.id !== "supabase") return check;

  if (check.status === "skipped") {
    return {
      ...check,
      label: "Supabase 운영 DB",
      message: "Supabase 환경변수가 없어 운영 DB 연결 테스트를 건너뜁니다. 승인 전 화면 확인은 가능하지만 실제 반복 운영에는 Supabase 연결이 필요합니다.",
      detail: {
        ...(check.detail ?? {}),
        operator_next_action: "Supabase 프로젝트를 만들고 sql/schema.sql을 적용한 뒤 URL, anon key, service role key를 Vercel에 등록하세요."
      }
    };
  }

  if (check.status === "ok") {
    return {
      ...check,
      label: "Supabase 운영 DB",
      message: "Supabase 테이블, 최신 스키마 버전, 쓰기 로그, 클릭 이벤트, 공개 RLS 경로가 모두 확인되었습니다."
    };
  }

  const issue = describeSupabaseIssue(check.detail ?? {}, check.message);
  return {
    ...check,
    label: "Supabase 운영 DB",
    message: issue.message,
    detail: {
      ...(check.detail ?? {}),
      supabase_issue_code: issue.code,
      operator_next_action: issue.nextAction,
      raw_provider_message: check.message
    }
  };
}

function describeTelegramApiIssue(detail: Record<string, JsonValue>, ...values: Array<string | null | undefined>) {
  const raw = values.filter(Boolean).join(" | ").slice(0, 500);
  const text = raw.toLowerCase();
  const getMeStatus = typeof detail.get_me_status === "number" ? detail.get_me_status : Number(detail.get_me_status ?? 0);
  const getChatStatus = typeof detail.get_chat_status === "number" ? detail.get_chat_status : Number(detail.get_chat_status ?? 0);

  if (
    getMeStatus === 429 ||
    getChatStatus === 429 ||
    text.includes("too many") ||
    text.includes("rate") ||
    text.includes("retry after")
  ) {
    return {
      code: "TELEGRAM_API_RATE_LIMITED",
      message: "Telegram Bot API 호출 제한에 걸렸습니다. 토큰과 chat ID가 틀린 것이 아니라 잠시 후 재시도해야 하는 상태일 수 있습니다.",
      nextAction: "몇 분 뒤 실제 연결 테스트를 다시 실행하고, 반복되면 텔레그램 다이제스트 발송 주기와 수동 테스트 횟수를 줄이세요."
    };
  }

  if (
    [401, 404].includes(getMeStatus) ||
    text.includes("unauthorized") ||
    text.includes("invalid token") ||
    text.includes("token")
  ) {
    return {
      code: "TELEGRAM_BOT_TOKEN_INVALID",
      message: "TELEGRAM_BOT_TOKEN이 Telegram Bot API에서 거부되었습니다. BotFather에서 발급한 토큰이 아니거나 복사 과정에서 값이 달라졌을 가능성이 큽니다.",
      nextAction: "BotFather에서 현재 봇의 token을 다시 복사해 Vercel의 TELEGRAM_BOT_TOKEN에 등록한 뒤 재배포하고 실제 연결 테스트를 다시 실행하세요."
    };
  }

  if (
    [400, 403, 404].includes(getChatStatus) ||
    text.includes("chat not found") ||
    text.includes("forbidden") ||
    text.includes("bot was blocked") ||
    text.includes("not enough rights") ||
    text.includes("user not found")
  ) {
    return {
      code: "TELEGRAM_CHAT_ACCESS_FAILED",
      message: "Telegram 봇이 TELEGRAM_CHAT_ID 대상 채팅에 접근하지 못했습니다. chat ID가 틀렸거나, 봇이 채널/그룹에 초대되지 않았거나, 발송 권한이 부족할 수 있습니다.",
      nextAction: "봇을 발송 채널이나 그룹에 추가하고 관리자 권한을 준 뒤, 실제 대상의 chat ID 또는 @channel username을 TELEGRAM_CHAT_ID에 다시 등록하세요."
    };
  }

  return {
    code: "TELEGRAM_API_CONNECTION_FAILED",
    message: raw || "Telegram Bot API 연결 테스트에 실패했습니다.",
    nextAction: "TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, 봇의 채널 참여 여부를 확인한 뒤 실제 연결 테스트를 다시 실행하세요."
  };
}

function readableTelegramConnectionCheck(check: ApiConnectionCheck): ApiConnectionCheck {
  if (check.id !== "telegram") return check;

  if (check.status === "skipped") {
    return {
      ...check,
      label: "텔레그램 Bot API",
      message: "텔레그램 토큰 또는 chat ID가 없어 실제 연결 테스트를 건너뜁니다. 승인 전에는 발송 없이 사이트와 수동 운영 흐름을 확인할 수 있습니다.",
      detail: {
        ...(check.detail ?? {}),
        operator_next_action: "BotFather에서 TELEGRAM_BOT_TOKEN을 만들고 발송 채널/채팅의 TELEGRAM_CHAT_ID를 Vercel에 등록하세요."
      }
    };
  }

  if (check.status === "ok") {
    return {
      ...check,
      label: "텔레그램 Bot API",
      message: "Bot 토큰과 chat ID 접근이 확인되었습니다. 게시 상품 발송 준비가 끝났습니다."
    };
  }

  const detail = check.detail ?? {};
  const issue = describeTelegramApiIssue(
    detail,
    check.message,
    typeof detail.error === "string" ? detail.error : null
  );

  return {
    ...check,
    label: "텔레그램 Bot API",
    message: issue.message,
    detail: {
      ...detail,
      telegram_issue_code: issue.code,
      operator_next_action: issue.nextAction,
      raw_provider_message: check.message
    }
  };
}

function normalizeReadinessProduct(product: ProductWithScore): ProductWithScore {
  const dealScores = [...(product.deal_scores ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return {
    ...product,
    deal_scores: dealScores,
    latest_score: dealScores[0] ?? null
  };
}

function buildPublicSiteUrlItem(): ApiReadinessItem {
  const requiredEnv = ["NEXT_PUBLIC_SITE_URL"];
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";
  const issue = getPublicSiteUrlIssue(raw);
  const missingEnv = issue ? requiredEnv : [];

  return {
    id: "site",
    label: "공개 사이트 URL",
    state: issue === "missing" ? "missing" : issue ? "partial" : "ready",
    configured: !issue,
    requiredEnv,
    missingEnv,
    message: siteUrlIssueMessage(issue),
    nextAction: "NEXT_PUBLIC_SITE_URL=https://returnpick.vercel.app 형태의 실제 배포 주소로 등록하세요."
  };
}

function buildCoupangItem(): ApiReadinessItem {
  const requiredEnv = ["COUPANG_ACCESS_KEY", "COUPANG_SECRET_KEY", "COUPANG_PARTNER_ID"];
  const accessKey = process.env.COUPANG_ACCESS_KEY?.trim();
  const secretKey = process.env.COUPANG_SECRET_KEY?.trim();
  const partnerId = process.env.COUPANG_PARTNER_ID?.trim();
  const missingEnv = requiredEnv.filter((name) => !process.env[name]?.trim());
  const invalidEnv = [
    accessKey && !isLikelyProviderSecret(accessKey, 8) ? "COUPANG_ACCESS_KEY" : null,
    secretKey && !isLikelyProviderSecret(secretKey, 8) ? "COUPANG_SECRET_KEY" : null,
    partnerId && !isLikelyProviderSecret(partnerId, 2) ? "COUPANG_PARTNER_ID" : null
  ].filter((value): value is string => Boolean(value));
  const ready = !missingEnv.length && !invalidEnv.length;
  const issueEnv = Array.from(new Set([...missingEnv, ...invalidEnv]));

  return {
    id: "coupang",
    label: "쿠팡 파트너스 API",
    state: !accessKey && !secretKey && !partnerId ? "missing" : ready ? "ready" : "partial",
    configured: ready,
    requiredEnv,
    missingEnv: ready ? [] : issueEnv,
    message: ready
      ? "쿠팡 API 검색과 딥링크 자동 보강에 필요한 키가 모두 입력되어 있습니다."
      : missingEnv.length
        ? "API 권한이 아직 없어도 상품별로 확인한 쿠팡 파트너스 링크를 수동 등록해 사이트를 운영할 수 있습니다."
        : "쿠팡 API 값에 공백, 너무 짧은 값, 또는 예시/placeholder 값이 포함된 것 같습니다. 수동 링크 운영은 계속할 수 있습니다.",
    nextAction: "자동 후보 수집과 딥링크 보강이 필요해지면 최종승인 후 쿠팡 파트너스 API 메뉴에서 COUPANG_ACCESS_KEY, COUPANG_SECRET_KEY, COUPANG_PARTNER_ID를 발급해 Vercel에 등록하세요."
  };
}

function readableCoupangReadinessItem(item: ApiReadinessItem): ApiReadinessItem {
  const allMissing = item.state === "missing";
  const ready = item.state === "ready";

  return {
    ...item,
    label: "쿠팡 파트너스 API",
    message: ready
      ? "쿠팡 API 검색과 파트너스 딥링크 자동 보강에 필요한 키 3개가 모두 입력되어 있습니다."
      : allMissing
        ? "API 권한 대기 중입니다. 상품별로 확인한 쿠팡 파트너스 링크를 수동 등록하면 사이트 출시는 가능합니다."
        : "쿠팡 API 값에 공백, 너무 짧은 값, 예시/placeholder 값이 포함된 것 같습니다. 수동 링크 운영은 계속할 수 있습니다.",
    nextAction:
      "자동 후보 수집과 딥링크 보강이 필요해지면 최종승인 후 쿠팡 파트너스 API 메뉴에서 키 3개를 발급해 Vercel에 등록하세요."
  };
}

function buildNaverItem(): ApiReadinessItem {
  const requiredEnv = ["NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"];
  const clientId = process.env.NAVER_CLIENT_ID?.trim();
  const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim();
  const missingEnv = requiredEnv.filter((name) => !process.env[name]?.trim());
  const invalidEnv = [
    clientId && !isLikelyProviderSecret(clientId, 5) ? "NAVER_CLIENT_ID" : null,
    clientSecret && !isLikelyProviderSecret(clientSecret, 5) ? "NAVER_CLIENT_SECRET" : null
  ].filter((value): value is string => Boolean(value));
  const ready = !missingEnv.length && !invalidEnv.length;
  const issueEnv = Array.from(new Set([...missingEnv, ...invalidEnv]));

  return {
    id: "naver",
    label: "네이버 쇼핑 검색 API",
    state: !clientId && !clientSecret ? "missing" : ready ? "ready" : "partial",
    configured: ready,
    requiredEnv,
    missingEnv: ready ? [] : issueEnv,
    message: ready
      ? "네이버 최저가 보강과 후보 참고 수집을 실행할 수 있습니다."
      : missingEnv.length
        ? "네이버 Client ID와 Secret을 함께 등록해야 최저가 보강이 켜집니다."
        : "네이버 API 값에 공백, 너무 짧은 값, 또는 예시/placeholder 값이 포함된 것 같습니다.",
    nextAction: "NAVER_CLIENT_ID와 NAVER_CLIENT_SECRET을 네이버 개발자센터에서 다시 복사해 Vercel에 함께 등록하세요."
  };
}

function buildTelegramItem(): ApiReadinessItem {
  const requiredEnv = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"];
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  const missingEnv = requiredEnv.filter((name) => !process.env[name]?.trim());
  const invalidEnv = [
    token && !isLikelyTelegramBotToken(token) ? "TELEGRAM_BOT_TOKEN" : null,
    chatId && !isLikelyTelegramChatId(chatId) ? "TELEGRAM_CHAT_ID" : null
  ].filter((value): value is string => Boolean(value));
  const ready = !missingEnv.length && !invalidEnv.length;
  const issueEnv = Array.from(new Set([...missingEnv, ...invalidEnv]));

  return {
    id: "telegram",
    label: "텔레그램 발송",
    state: !token && !chatId ? "missing" : ready ? "ready" : "partial",
    configured: ready,
    requiredEnv,
    missingEnv: ready ? [] : issueEnv,
    message: ready
      ? "게시 상품을 텔레그램으로 발송할 수 있습니다."
      : missingEnv.length
        ? "Bot token과 chat ID를 함께 등록해야 텔레그램 발송이 켜집니다."
        : "텔레그램 token 또는 chat ID 형식이 맞지 않습니다. token은 숫자:문자열 형태이고 chat ID는 숫자 또는 @채널명이어야 합니다.",
    nextAction: "TELEGRAM_BOT_TOKEN은 BotFather에서, TELEGRAM_CHAT_ID는 실제 발송 대상 채팅에서 확인한 값으로 다시 등록하세요."
  };
}

function buildApprovalLinkItem(): ApiReadinessItem {
  const requiredEnv = ["NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL"];
  const raw = process.env.NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL?.trim() ?? "";
  const missing = !raw;
  const valid = isCoupangPartnersLink(raw);

  return {
    id: "approval_link",
    label: "승인용 파트너스 링크",
    state: missing ? "missing" : valid ? "ready" : "partial",
    configured: valid,
    requiredEnv,
    missingEnv: valid ? [] : requiredEnv,
    message: missing
      ? "승인용 캡처 페이지의 구매 버튼이 비활성화됩니다."
      : valid
        ? "승인용 상품 페이지의 쿠팡 버튼이 실제 파트너스 링크로 연결됩니다."
        : "승인용 링크는 https://link.coupang.com/a/짧은코드 형태의 쿠팡 파트너스 링크여야 합니다.",
    nextAction: "NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL에 쿠팡 파트너스에서 생성한 https://link.coupang.com/a/... 링크를 등록하세요."
  };
}

function buildCronSecretItem(): ApiReadinessItem {
  const requiredEnv = ["CRON_SECRET"];
  const raw = process.env.CRON_SECRET?.trim() ?? "";
  const missing = !raw;
  const valid = raw.length >= 16;

  return {
    id: "cron_secret",
    label: "Vercel Cron 보호값",
    state: missing ? "missing" : valid ? "ready" : "partial",
    configured: valid,
    requiredEnv,
    missingEnv: valid ? [] : requiredEnv,
    message: missing
      ? "운영 환경에서는 스케줄러 호출 보호를 위해 CRON_SECRET이 필요합니다."
      : valid
        ? "예약 수집 API가 충분한 길이의 Bearer 토큰으로 보호됩니다."
        : "CRON_SECRET은 추측하기 어렵도록 16자 이상으로 설정해야 합니다.",
    nextAction: "16자 이상 랜덤 문자열을 CRON_SECRET으로 등록하고 Vercel Cron 호출 헤더에 사용하세요."
  };
}

function splitEnvList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getPublicWebHostIssue(host: string) {
  const raw = host.trim().toLowerCase();
  if (!raw) return "missing_host";
  if (raw.includes("://") || raw.includes("/") || raw.includes("?") || raw.includes("#")) return "host_only_required";
  if (raw === "*" || raw.includes("*")) return "wildcard_not_allowed";
  if (raw === "localhost" || raw === "127.0.0.1" || raw === "0.0.0.0" || raw === "::1" || raw.endsWith(".local")) return "public_host_required";
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/.test(raw)) return "invalid_host";
  return null;
}

function getPublicWebTemplateIssue(template: string, allowedHosts: Set<string>) {
  const raw = template.trim();
  if (!raw) return "missing_template";
  if (!raw.includes("{keyword}")) return "keyword_placeholder_required";

  try {
    const url = new URL(raw.replace("{keyword}", "returnpick-test"));
    const hostname = url.hostname.toLowerCase();
    if (!["http:", "https:"].includes(url.protocol)) return "http_https_required";
    if (url.username || url.password) return "credentials_not_allowed";
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname === "::1" || hostname.endsWith(".local")) return "public_host_required";
    if (!allowedHosts.has(hostname)) return "template_host_not_allowed";
    return null;
  } catch {
    return "invalid_template_url";
  }
}

function buildPublicWebItem(): ApiReadinessItem {
  const requiredEnv = ["PUBLIC_WEB_ALLOWED_HOSTS", "PUBLIC_WEB_SEARCH_TEMPLATES"];
  const enabled = process.env.PUBLIC_WEB_CRAWL_ENABLED === "true";

  if (!enabled) {
    return {
      id: "public_web",
      label: "공개 웹 참고 수집",
      state: "disabled",
      configured: false,
      requiredEnv,
      missingEnv: [],
      message: "기본값은 꺼짐입니다. 공식 API 보조가 필요할 때만 켜세요.",
      nextAction: `PUBLIC_WEB_CRAWL_ENABLED=true일 때 allowlist와 검색 템플릿을 함께 등록하세요. 호스트와 템플릿은 각각 최대 ${MAX_PUBLIC_WEB_ALLOWED_HOSTS}개까지만 사용하세요.`
    };
  }

  const hosts = splitEnvList(process.env.PUBLIC_WEB_ALLOWED_HOSTS);
  const templates = splitEnvList(process.env.PUBLIC_WEB_SEARCH_TEMPLATES);
  const allowedHostSet = new Set(hosts.map((host) => host.toLowerCase()));
  const hostIssues = hosts.map((host) => ({ host, issue: getPublicWebHostIssue(host) })).filter((item) => item.issue);
  const templateIssues = templates
    .map((template) => ({ template, issue: getPublicWebTemplateIssue(template, allowedHostSet) }))
    .filter((item) => item.issue);
  const tooManyHosts = hosts.length > MAX_PUBLIC_WEB_ALLOWED_HOSTS;
  const tooManyTemplates = templates.length > MAX_PUBLIC_WEB_SEARCH_TEMPLATES;
  const missingEnv = requiredEnv.filter((name) => !process.env[name]?.trim());
  const ready =
    !missingEnv.length &&
    hosts.length > 0 &&
    templates.length > 0 &&
    !hostIssues.length &&
    !templateIssues.length &&
    !tooManyHosts &&
    !tooManyTemplates;
  const issueEnv = Array.from(
    new Set([
      ...missingEnv,
      ...(hostIssues.length ? ["PUBLIC_WEB_ALLOWED_HOSTS"] : []),
      ...(templateIssues.length ? ["PUBLIC_WEB_SEARCH_TEMPLATES"] : []),
      ...(tooManyHosts ? ["PUBLIC_WEB_ALLOWED_HOSTS"] : []),
      ...(tooManyTemplates ? ["PUBLIC_WEB_SEARCH_TEMPLATES"] : [])
    ])
  );

  return {
    id: "public_web",
    label: "공개 웹 참고 수집",
    state: ready ? "ready" : "partial",
    configured: ready,
    requiredEnv,
    missingEnv: ready ? [] : issueEnv,
    message: ready
      ? "허용 호스트와 검색 템플릿이 안전한 형식이며, 실제 수집 전 robots.txt 확인 경로를 사용합니다."
      : missingEnv.length
        ? "공개 웹 참고 수집을 켰지만 allowlist와 검색 템플릿이 모두 준비되지 않았습니다."
        : tooManyHosts
          ? `PUBLIC_WEB_ALLOWED_HOSTS는 최대 ${MAX_PUBLIC_WEB_ALLOWED_HOSTS}개 호스트까지만 허용합니다.`
          : tooManyTemplates
            ? `PUBLIC_WEB_SEARCH_TEMPLATES는 최대 ${MAX_PUBLIC_WEB_SEARCH_TEMPLATES}개 URL까지만 허용합니다.`
            : hostIssues.length
              ? "PUBLIC_WEB_ALLOWED_HOSTS에는 프로토콜/경로/와일드카드 없이 공개 호스트명만 넣어야 합니다."
              : "PUBLIC_WEB_SEARCH_TEMPLATES는 http/https URL이고 {keyword}를 포함하며 allowlist 호스트와 일치해야 합니다.",
    nextAction: `공개웹 수집을 쓰려면 PUBLIC_WEB_ALLOWED_HOSTS=example.com, PUBLIC_WEB_SEARCH_TEMPLATES=https://example.com/search?q={keyword} 형태로 등록하세요. 호스트와 템플릿은 각각 최대 ${MAX_PUBLIC_WEB_ALLOWED_HOSTS}개까지만 사용하세요.`
  };
}

function buildAdminPasswordItem(): ApiReadinessItem {
  const requiredEnv = ["ADMIN_PASSWORD"];
  const raw = process.env.ADMIN_PASSWORD?.trim() ?? "";
  const missing = !raw;
  const valid = isStrongAdminPassword(raw);

  return {
    id: "admin_password",
    label: "관리자 비밀번호",
    state: missing ? "missing" : valid ? "ready" : "partial",
    configured: valid,
    requiredEnv,
    missingEnv: valid ? [] : requiredEnv,
    message: missing
      ? "배포 환경에서는 ADMIN_PASSWORD가 없으면 관리자 API가 닫힙니다."
      : valid
        ? "관리자 API가 충분히 긴 비밀번호로 보호됩니다."
        : "ADMIN_PASSWORD는 12자 이상이어야 하며 공백, 예시값, password/test/admin 같은 쉬운 값을 사용할 수 없습니다.",
    nextAction: "Vercel에 12자 이상 랜덤 문자열을 ADMIN_PASSWORD로 등록한 뒤 /admin에서 같은 값으로 로그인하세요."
  };
}

function getSupabaseUrlIssue(value: string | undefined) {
  const raw = value?.trim();
  if (!raw) return "missing_url";

  try {
    const url = new URL(raw);
    const hostname = url.hostname.toLowerCase();
    const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

    if (url.username || url.password) return "credentials_not_allowed";
    if (url.protocol !== "https:") return "https_required";
    if (localHosts.has(hostname) || hostname.endsWith(".local")) return "public_project_url_required";

    return null;
  } catch {
    return "invalid_url";
  }
}

function isLikelySupabaseKey(value: string | undefined) {
  const raw = value?.trim() ?? "";
  if (raw.length < 40) return false;
  if (/\s/.test(raw)) return false;
  return true;
}

function buildSupabaseItem(): ApiReadinessItem {
  const requiredEnv = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const urlIssue = getSupabaseUrlIssue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const missingEnv = requiredEnv.filter((name) => !process.env[name]?.trim());
  const keyIssues = [
    anonKey && !isLikelySupabaseKey(anonKey) ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : null,
    serviceKey && !isLikelySupabaseKey(serviceKey) ? "SUPABASE_SERVICE_ROLE_KEY" : null,
    anonKey && serviceKey && anonKey === serviceKey ? "SUPABASE_KEYS_MUST_DIFFER" : null
  ].filter((value): value is string => Boolean(value));
  const ready = !missingEnv.length && !urlIssue && !keyIssues.length;
  const issueEnv = Array.from(new Set([...missingEnv, ...(urlIssue ? ["NEXT_PUBLIC_SUPABASE_URL"] : []), ...keyIssues]));

  return {
    id: "supabase",
    label: "Supabase 운영 DB",
    state: !process.env.NEXT_PUBLIC_SUPABASE_URL && !anonKey && !serviceKey ? "missing" : ready ? "ready" : "partial",
    configured: ready,
    requiredEnv,
    missingEnv: ready ? [] : issueEnv,
    message: ready
      ? "운영 DB에 상품, 점수, 클릭 이벤트, 스케줄 로그를 저장할 수 있습니다."
      : missingEnv.length
        ? "Supabase URL, anon key, service role key를 모두 입력해야 운영 저장소를 사용할 수 있습니다."
        : urlIssue
          ? "NEXT_PUBLIC_SUPABASE_URL은 외부 접속 가능한 https Supabase 프로젝트 URL이어야 합니다."
          : keyIssues.includes("SUPABASE_KEYS_MUST_DIFFER")
            ? "anon key와 service role key가 같습니다. Supabase에서 각각의 키를 따로 복사해야 합니다."
            : "Supabase key 값이 너무 짧거나 공백이 포함되어 있습니다. Supabase 프로젝트 설정에서 다시 복사하세요.",
    nextAction: "Supabase SQL 적용 후 URL, anon key, service role key를 Vercel에 정확히 등록하세요."
  };
}

function buildBootstrapCatalogItem(): ApiReadinessItem {
  const requiredEnv = [BOOTSTRAP_CATALOG_ENV];
  const catalog = readBootstrapCatalog();

  if (!catalog.configured) {
    return {
      id: "bootstrap_catalog",
      label: "승인 전 임시 공개 카탈로그",
      state: "missing",
      configured: false,
      requiredEnv,
      missingEnv: requiredEnv,
      message: "Supabase가 아직 없을 때 공개 상품을 잠시 보존하는 보조 경로가 설정되지 않았습니다. 정식 운영에는 Supabase가 필요합니다.",
      nextAction: `${BOOTSTRAP_CATALOG_ENV}는 관리자에서 검수 완료 상품을 내보낼 때만 사용하세요. 클릭 집계와 자동 수정은 Supabase에 저장해야 합니다.`
    };
  }

  if (!catalog.ok) {
    const issueCodes = Array.from(new Set(catalog.issues.map((issue) => issue.code))).slice(0, 3).join(", ");
    return {
      id: "bootstrap_catalog",
      label: "승인 전 임시 공개 카탈로그",
      state: "partial",
      configured: false,
      requiredEnv,
      missingEnv: requiredEnv,
      message: `카탈로그 환경변수는 있지만 검증에 실패했습니다${issueCodes ? ` (${issueCodes})` : ""}. 공개 상품 복구에 사용되지 않습니다.`,
      nextAction: `관리자에서 새 JSON을 다시 만들어 ${BOOTSTRAP_CATALOG_ENV} 값 전체를 교체하세요. 최대 ${BOOTSTRAP_CATALOG_MAX_PRODUCTS}개·${BOOTSTRAP_CATALOG_MAX_BYTES.toLocaleString("ko-KR")}바이트입니다.`
    };
  }

  if (!catalog.products.length) {
    return {
      id: "bootstrap_catalog",
      label: "승인 전 임시 공개 카탈로그",
      state: "partial",
      configured: false,
      requiredEnv,
      missingEnv: [],
      message: "카탈로그 JSON은 읽었지만 공개 가능한 상품이 0개입니다. 확인된 상품별 파트너스 링크와 공개 품질을 먼저 준비하세요.",
      nextAction: "관리자에서 실제 상품을 검수·게시한 뒤 승인 전 임시 출시 카탈로그를 다시 생성하세요. 이 경로는 Supabase를 대체하지 않습니다."
    };
  }

  return {
    id: "bootstrap_catalog",
    label: "승인 전 임시 공개 카탈로그",
    state: "ready",
    configured: true,
    requiredEnv,
    missingEnv: [],
    message: `검증된 공개 상품 ${catalog.products.length.toLocaleString("ko-KR")}개를 임시 환경변수에서 복구할 수 있습니다.`,
    nextAction: "정식 운영 전 Supabase를 연결하세요. 임시 카탈로그는 공개 상품 보존만 담당하며 클릭 집계·후보 수정·반복 소싱은 저장하지 않습니다."
  };
}

async function runSupabaseWriteSmokeCheck(client: NonNullable<ReturnType<typeof getSupabaseServiceClient>>) {
  const runId = randomUUID();
  const eventId = randomUUID();
  const timestamp = new Date().toISOString();
  const steps: Array<{ step: string; ok: boolean; error: string | null }> = [];

  const runInsert = await client
    .from("sourcing_runs")
    .insert({
      id: runId,
      status: "readiness_check",
      started_at: timestamp,
      finished_at: timestamp,
      keyword_count: 0,
      found_count: 0,
      inserted_count: 0,
      updated_count: 0,
      error_count: 0,
      error_message: null,
      log_json: { source: "api_readiness", smoke_test: true, created_at: timestamp }
    })
    .select("id,status")
    .single();
  steps.push({ step: "sourcing_runs_insert", ok: !runInsert.error, error: runInsert.error?.message ?? null });

  if (!runInsert.error) {
    const runUpdate = await client
      .from("sourcing_runs")
      .update({
        status: "readiness_check_updated",
        log_json: { source: "api_readiness", smoke_test: true, updated_at: new Date().toISOString() }
      })
      .eq("id", runId)
      .select("id,status")
      .single();
    steps.push({ step: "sourcing_runs_update", ok: !runUpdate.error, error: runUpdate.error?.message ?? null });

    const runDelete = await client.from("sourcing_runs").delete().eq("id", runId);
    steps.push({ step: "sourcing_runs_cleanup", ok: !runDelete.error, error: runDelete.error?.message ?? null });
  }

  const eventInsert = await client
    .from("affiliate_events")
    .insert({
      id: eventId,
      product_id: null,
      event_type: "detail_view",
      channel: "api_readiness",
      anon_session_id: "readiness-smoke",
      referrer: "admin",
      utm_source: "readiness"
    })
    .select("id,event_type")
    .single();
  steps.push({ step: "affiliate_events_insert", ok: !eventInsert.error, error: eventInsert.error?.message ?? null });

  if (!eventInsert.error) {
    const eventDelete = await client.from("affiliate_events").delete().eq("id", eventId);
    steps.push({ step: "affiliate_events_cleanup", ok: !eventDelete.error, error: eventDelete.error?.message ?? null });
  }

  return {
    ok: steps.every((step) => step.ok),
    steps
  };
}

async function runDistributionDeliveryLedgerSmokeCheck(client: NonNullable<ReturnType<typeof getSupabaseServiceClient>>) {
  const productId = randomUUID();
  const requestKey = randomUUID();
  const steps: Array<{ step: string; ok: boolean; error: string | null }> = [];

  const productInsert = await client
    .from("sourced_products")
    .insert({
      id: productId,
      source: "api_readiness",
      source_product_id: `distribution-ledger-${productId}`,
      category: "laptop",
      title: `ReturnPick distribution ledger smoke ${productId}`,
      sourcing_status: "candidate",
      is_published: false,
      raw_json: { source: "api_readiness", smoke_test: "distribution_ledger" }
    })
    .select("id")
    .single();
  steps.push({ step: "distribution_ledger_product_insert", ok: !productInsert.error, error: productInsert.error?.message ?? null });

  let firstDeliveryInserted = false;
  if (!productInsert.error) {
    const firstDelivery = await client
      .from("distribution_deliveries")
      .insert({
        product_id: productId,
        channel: "api_readiness",
        status: "pending",
        delivery_mode: "draft",
        request_key: requestKey,
        attempt_count: 1
      })
      .select("id,request_key,attempt_count")
      .single();
    firstDeliveryInserted = !firstDelivery.error;
    steps.push({ step: "distribution_ledger_first_claim", ok: firstDeliveryInserted, error: firstDelivery.error?.message ?? null });

    if (firstDelivery.data && !firstDelivery.error) {
      const duplicateDelivery = await client
        .from("distribution_deliveries")
        .insert({
          product_id: productId,
          channel: "api_readiness",
          status: "pending",
          delivery_mode: "draft",
          request_key: randomUUID(),
          attempt_count: 1
        })
        .select("id")
        .single();
      const duplicateRejected = duplicateDelivery.error?.code === "23505";
      steps.push({
        step: "distribution_ledger_unique_channel_product",
        ok: duplicateRejected,
        error: duplicateRejected
          ? null
          : duplicateDelivery.error?.message ?? "DISTRIBUTION_LEDGER_DUPLICATE_INSERT_ACCEPTED"
      });

      const failedTransition = await client
        .from("distribution_deliveries")
        .update({ status: "failed", last_error: "OAUTH_PREWRITE_SMOKE" })
        .eq("id", firstDelivery.data.id)
        .eq("status", "pending")
        .eq("request_key", firstDelivery.data.request_key)
        .select("id,request_key,attempt_count")
        .maybeSingle();
      steps.push({
        step: "distribution_ledger_prewrite_failure_cas",
        ok: !failedTransition.error && Boolean(failedTransition.data),
        error: failedTransition.error?.message ?? (failedTransition.data ? null : "DISTRIBUTION_LEDGER_PREWRITE_CAS_MISSED")
      });

      if (failedTransition.data) {
        const retryKey = randomUUID();
        const retryClaim = await client
          .from("distribution_deliveries")
          .update({ status: "pending", request_key: retryKey, attempt_count: 2, last_error: null })
          .eq("id", failedTransition.data.id)
          .eq("status", "failed")
          .eq("request_key", failedTransition.data.request_key)
          .select("id,request_key,attempt_count")
          .maybeSingle();
        const retryClaimed = !retryClaim.error && retryClaim.data?.request_key === retryKey && retryClaim.data?.attempt_count === 2;
        steps.push({
          step: "distribution_ledger_failed_retry_cas",
          ok: retryClaimed,
          error: retryClaim.error?.message ?? (retryClaimed ? null : "DISTRIBUTION_LEDGER_RETRY_CAS_MISSED")
        });

        if (retryClaim.data) {
          const staleUpdate = await client
            .from("distribution_deliveries")
            .update({ status: "succeeded" })
            .eq("id", retryClaim.data.id)
            .eq("status", "pending")
            .eq("request_key", requestKey)
            .select("id")
            .maybeSingle();
          const staleRejected = !staleUpdate.error && !staleUpdate.data;
          steps.push({
            step: "distribution_ledger_stale_request_rejected",
            ok: staleRejected,
            error: staleUpdate.error?.message ?? (staleRejected ? null : "DISTRIBUTION_LEDGER_STALE_REQUEST_UPDATED")
          });
        }
      }
    }
  }

  const candidateRpc = await client.rpc("list_distribution_candidate_ids", {
    p_channel: "api_readiness",
    p_limit: 5,
    p_after_score: null,
    p_after_created_at: null,
    p_after_id: null
  });
  steps.push({
    step: "distribution_ledger_keyset_candidate_rpc",
    ok: !candidateRpc.error && Array.isArray(candidateRpc.data),
    error: candidateRpc.error?.message ?? (Array.isArray(candidateRpc.data) ? null : "DISTRIBUTION_CANDIDATE_RPC_INVALID")
  });

  if (!productInsert.error) {
    const deliveryCleanup = await client.from("distribution_deliveries").delete().eq("product_id", productId);
    steps.push({ step: "distribution_ledger_cleanup", ok: !deliveryCleanup.error, error: deliveryCleanup.error?.message ?? null });
  }
  const productCleanup = await client.from("sourced_products").delete().eq("id", productId);
  steps.push({ step: "distribution_ledger_product_cleanup", ok: !productCleanup.error, error: productCleanup.error?.message ?? null });

  return {
    ok: steps.every((step) => step.ok),
    steps
  };
}

async function runStrictAffiliateSqlFunctionSmokeCheck(client: NonNullable<ReturnType<typeof getSupabaseServiceClient>>) {
  const probes = [
    {
      step: "strict_affiliate_function_accepts_short_link",
      url: "https://link.coupang.com/a/AbC123xYz9",
      expected: true
    },
    {
      step: "strict_affiliate_function_rejects_fake_code",
      url: "https://link.coupang.com/a/readiness",
      expected: false
    },
    {
      step: "strict_affiliate_function_rejects_regular_coupang_url",
      url: "https://www.coupang.com/vp/products/123456789",
      expected: false
    }
  ];
  const steps = await Promise.all(
    probes.map(async (probe) => {
      const { data, error } = await client.rpc("is_strict_coupang_partners_url", { value: probe.url });
      return {
        step: probe.step,
        ok: !error && data === probe.expected,
        error: error?.message ?? null,
        value: typeof data === "boolean" ? data : null
      };
    })
  );

  return {
    ok: steps.every((step) => step.ok),
    steps
  };
}

async function runPublicDataQualityCheck(client: NonNullable<ReturnType<typeof getSupabaseServiceClient>>): Promise<ApiConnectionCheck> {
  const approvalUrl = process.env.NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL?.trim() ?? "";
  const invalidPublicId = randomUUID();
  const invalidPublicInsert = await client
    .from("sourced_products")
    .insert({
      id: invalidPublicId,
      source: "readiness_check",
      source_product_id: `invalid-public-affiliate-${invalidPublicId}`,
      category: "laptop",
      title: `ReturnPick invalid public affiliate smoke ${invalidPublicId}`,
      affiliate_url: "https://link.coupang.com/a/readiness",
      sourcing_status: "published",
      is_published: true,
      raw_json: { source: "api_readiness", should_be_rejected: true }
    })
    .select("id")
    .single();
  const invalidPublicCleanup = invalidPublicInsert.error ? null : await client.from("sourced_products").delete().eq("id", invalidPublicId);
  const invalidPublicRejectedByConstraint =
    invalidPublicInsert.error?.code === "23514" ||
    invalidPublicInsert.error?.message?.includes("sourced_products_public_affiliate_url_check") ||
    invalidPublicInsert.error?.details?.includes("sourced_products_public_affiliate_url_check") ||
    false;
  const invalidPublicUnexpectedError = invalidPublicInsert.error && !invalidPublicRejectedByConstraint ? invalidPublicInsert.error : null;
  const publicAffiliateConstraintOk = invalidPublicRejectedByConstraint;
  const publicBaseQuery = () => client.from("sourced_products").select("id", { count: "exact", head: true }).eq("is_published", true).eq("sourcing_status", "published");

  const published = await publicBaseQuery();
  const missingAffiliate = await publicBaseQuery().is("affiliate_url", null);
  const statusMismatch = await client.from("sourced_products").select("id", { count: "exact", head: true }).eq("is_published", true).neq("sourcing_status", "published");
  const approvalLinkReuse = approvalUrl
    ? await client.from("sourced_products").select("id", { count: "exact", head: true }).eq("affiliate_url", approvalUrl)
    : null;
  const publicProductsForAffiliateAudit = await client
    .from("sourced_products")
    .select("*, deal_scores(*)")
    .eq("is_published", true)
    .eq("sourcing_status", "published")
    .limit(5000);
  const auditedPublicProducts = ((publicProductsForAffiliateAudit.data ?? []) as ProductWithScore[]).map(normalizeReadinessProduct);
  const badAffiliateProducts = auditedPublicProducts.filter(
    (product) => product.affiliate_url && !isUsableAffiliateUrl(product.affiliate_url)
  );
  const publicQualityBlockedProducts = auditedPublicProducts
    .map((product) => ({ product, readiness: getCustomerPublishReadiness(product) }))
    .filter((item) => !item.readiness.ready);

  const queryErrors = [
    published.error,
    missingAffiliate.error,
    statusMismatch.error,
    approvalLinkReuse?.error ?? null,
    publicProductsForAffiliateAudit.error,
    invalidPublicUnexpectedError,
    invalidPublicCleanup?.error ?? null
  ].filter(Boolean);

  if (queryErrors.length) {
    return {
      id: "data_quality",
      label: "공개 데이터 품질",
      status: "error",
      message: `공개 데이터 품질 검사 ${queryErrors.length}건에 실패했습니다. sourced_products 권한과 컬럼을 확인하세요.`,
      detail: {
        errors: queryErrors.map((error) => error?.message ?? "UNKNOWN_DATA_QUALITY_ERROR")
      }
    };
  }

  const publishedCount = published.count ?? 0;
  const missingAffiliateCount = missingAffiliate.count ?? 0;
  const badAffiliateCount = badAffiliateProducts.length;
  const publicQualityBlockedCount = publicQualityBlockedProducts.length;
  const publicReadyCount = Math.max(0, publishedCount - publicQualityBlockedCount);
  const publicQualityBlockerSummary = summarizePublicQualityBlockers(publicQualityBlockedProducts);
  const statusMismatchCount = statusMismatch.count ?? 0;
  const approvalLinkReuseCount = approvalLinkReuse?.count ?? 0;
  const blockingCount = publicQualityBlockedCount + approvalLinkReuseCount + (publicAffiliateConstraintOk ? 0 : 1);
  const operatorNextAction = publicQualityNextAction(publicQualityBlockerSummary, approvalLinkReuseCount, publicAffiliateConstraintOk);

  return {
    id: "data_quality",
    label: "공개 데이터 품질",
    status: blockingCount ? "error" : "ok",
    message: blockingCount
      ? `공개 상품 데이터 정리가 필요합니다. 고객공개 품질 블로커 ${publicQualityBlockedCount}건, 제휴 링크 누락 ${missingAffiliateCount}건, 비정상 파트너스 링크 ${badAffiliateCount}건, 승인용 링크 재사용 ${approvalLinkReuseCount}건, DB 제약 ${publicAffiliateConstraintOk ? "통과" : "미적용"}.`
      : `공개 상품 ${publishedCount}건의 구매 CTA와 고객공개 품질 기준, DB 제약이 통과했습니다.`,
    detail: {
      published_count: publishedCount,
      published_public_ready_count: publicReadyCount,
      published_customer_hidden_count: publicQualityBlockedCount,
      published_missing_affiliate_url: missingAffiliateCount,
      published_non_partners_affiliate_url: badAffiliateCount,
      published_public_quality_blockers: publicQualityBlockedCount,
      audited_public_affiliate_rows: auditedPublicProducts.length,
      published_status_mismatch: statusMismatchCount,
      approval_sample_link_reuse: approvalLinkReuseCount,
      public_quality_blocker_summary: publicQualityBlockerSummary,
      operator_next_action: operatorNextAction,
      public_affiliate_constraint: {
        rejected_bad_public_affiliate_url: publicAffiliateConstraintOk,
        rejection_code: invalidPublicInsert.error?.code ?? null,
        rejection_message: invalidPublicInsert.error?.message ?? null,
        cleanup_error: invalidPublicCleanup?.error?.message ?? null
      },
      sample_bad_affiliate_products: badAffiliateProducts.slice(0, 5).map((product) => ({
        id: product.id,
        title: typeof product.title === "string" ? product.title.slice(0, 120) : null,
        affiliate_url: product.affiliate_url
      })),
      sample_public_quality_blocked_products: publicQualityBlockedProducts.slice(0, 5).map(({ product, readiness }) => ({
        id: product.id,
        title: typeof product.title === "string" ? product.title.slice(0, 120) : null,
        blockers: readiness.blockers.slice(0, 5)
      }))
    }
  };
}

async function runAnonPublicRlsSmokeCheck(client: NonNullable<ReturnType<typeof getSupabaseServiceClient>>) {
  const anonClient = getSupabaseAnonClient();
  const productId = randomUUID();
  const scoreId = randomUUID();
  const snapshotId = randomUUID();
  const timestamp = new Date().toISOString();
  const smokeAffiliateCode = `rp${productId.replace(/-/g, "").slice(0, 10)}`;
  const steps: Array<{ step: string; ok: boolean; error: string | null; count?: number | null }> = [];

  if (!anonClient) {
    return {
      ok: false,
      steps: [{ step: "anon_client_available", ok: false, error: "SUPABASE_ANON_CLIENT_NOT_AVAILABLE" }]
    };
  }

  const productInsert = await client
    .from("sourced_products")
    .insert({
      id: productId,
      source: "readiness_check",
      source_product_id: `anon-rls-${productId}`,
      category: "laptop",
      title: `ReturnPick anon RLS smoke ${productId}`,
      affiliate_url: `https://link.coupang.com/a/${smokeAffiliateCode}`,
      source_price: 1000000,
      return_price: 800000,
      condition_grade: "최상",
      sourcing_status: "published",
      is_published: true,
      raw_json: { source: "api_readiness", smoke_test: "anon_rls", created_at: timestamp }
    })
    .select("id")
    .single();
  steps.push({ step: "public_product_insert", ok: !productInsert.error, error: productInsert.error?.message ?? null });

  if (!productInsert.error) {
    const scoreInsert = await client
      .from("deal_scores")
      .insert({
        id: scoreId,
        product_id: productId,
        total_score: 80,
        price_score: 24,
        condition_score: 17,
        spec_score: 16,
        category_risk_score: 8,
        hidden_cost_score: 7,
        as_score: 4,
        timing_score: 4,
        verdict: "추천",
        reasons: ["anon rls smoke"],
        risk_flags: [],
        score_detail: { source: "api_readiness", smoke_test: true }
      })
      .select("id")
      .single();
    steps.push({ step: "public_score_insert", ok: !scoreInsert.error, error: scoreInsert.error?.message ?? null });

    const snapshotInsert = await client
      .from("product_snapshots")
      .insert({
        id: snapshotId,
        product_id: productId,
        source_price: 1000000,
        return_price: 800000,
        naver_lowest_price: 980000,
        condition_grade: "최상",
        change_flags: ["NEW_PRODUCT"],
        raw_json: { source: "api_readiness", smoke_test: true }
      })
      .select("id")
      .single();
    steps.push({ step: "public_snapshot_insert", ok: !snapshotInsert.error, error: snapshotInsert.error?.message ?? null });

    if (!scoreInsert.error && !snapshotInsert.error) {
      const visibleProduct = await anonClient.from("sourced_products").select("id", { count: "exact", head: true }).eq("id", productId);
      steps.push({
        step: "anon_can_read_affiliate_ready_product",
        ok: !visibleProduct.error && visibleProduct.count === 1,
        error: visibleProduct.error?.message ?? null,
        count: visibleProduct.count ?? null
      });

      const publicProductColumns = await anonClient
        .from("sourced_products")
        .select("id,title,affiliate_url,public_note,last_observed_at")
        .eq("id", productId)
        .maybeSingle();
      steps.push({
        step: "anon_can_read_public_product_columns",
        ok: !publicProductColumns.error && publicProductColumns.data?.id === productId,
        error: publicProductColumns.error?.message ?? null,
        count: publicProductColumns.data ? 1 : 0
      });

      const restrictedProductColumns = await anonClient
        .from("sourced_products")
        .select("raw_json,admin_memo,rejection_reason")
        .eq("id", productId)
        .maybeSingle();
      steps.push({
        step: "anon_cannot_read_internal_product_columns",
        ok: Boolean(restrictedProductColumns.error),
        error: restrictedProductColumns.error?.message ?? null,
        count: restrictedProductColumns.data ? 1 : 0
      });

      const visibleScore = await anonClient.from("deal_scores").select("id", { count: "exact", head: true }).eq("id", scoreId);
      steps.push({
        step: "anon_can_read_public_score",
        ok: !visibleScore.error && visibleScore.count === 1,
        error: visibleScore.error?.message ?? null,
        count: visibleScore.count ?? null
      });

      const visibleSnapshot = await anonClient.from("product_snapshots").select("id", { count: "exact", head: true }).eq("id", snapshotId);
      steps.push({
        step: "anon_can_read_public_snapshot",
        ok: !visibleSnapshot.error && visibleSnapshot.count === 1,
        error: visibleSnapshot.error?.message ?? null,
        count: visibleSnapshot.count ?? null
      });

      const restrictedSnapshotColumns = await anonClient
        .from("product_snapshots")
        .select("raw_json")
        .eq("id", snapshotId)
        .maybeSingle();
      steps.push({
        step: "anon_cannot_read_internal_snapshot_columns",
        ok: Boolean(restrictedSnapshotColumns.error),
        error: restrictedSnapshotColumns.error?.message ?? null,
        count: restrictedSnapshotColumns.data ? 1 : 0
      });

      const unpublish = await client.from("sourced_products").update({ is_published: false, sourcing_status: "approved" }).eq("id", productId);
      steps.push({ step: "public_product_unpublish", ok: !unpublish.error, error: unpublish.error?.message ?? null });

      if (!unpublish.error) {
        const hiddenProduct = await anonClient.from("sourced_products").select("id", { count: "exact", head: true }).eq("id", productId);
        steps.push({
          step: "anon_cannot_read_unpublished_product",
          ok: !hiddenProduct.error && hiddenProduct.count === 0,
          error: hiddenProduct.error?.message ?? null,
          count: hiddenProduct.count ?? null
        });

        const hiddenScore = await anonClient.from("deal_scores").select("id", { count: "exact", head: true }).eq("id", scoreId);
        steps.push({
          step: "anon_cannot_read_unpublished_score",
          ok: !hiddenScore.error && hiddenScore.count === 0,
          error: hiddenScore.error?.message ?? null,
          count: hiddenScore.count ?? null
        });

        const hiddenSnapshot = await anonClient.from("product_snapshots").select("id", { count: "exact", head: true }).eq("id", snapshotId);
        steps.push({
          step: "anon_cannot_read_unpublished_snapshot",
          ok: !hiddenSnapshot.error && hiddenSnapshot.count === 0,
          error: hiddenSnapshot.error?.message ?? null,
          count: hiddenSnapshot.count ?? null
        });
      }
    }
  }

  const cleanup = await client.from("sourced_products").delete().eq("id", productId);
  steps.push({ step: "anon_rls_cleanup", ok: !cleanup.error, error: cleanup.error?.message ?? null });

  return {
    ok: steps.every((step) => step.ok),
    steps
  };
}

async function fetchWithTimeout(
  url: string,
  timeoutMs = 8000,
  headers: Record<string, string> = {},
  redirect: "follow" | "error" | "manual" = "follow"
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      cache: "no-store",
      redirect,
      signal: controller.signal,
      headers: {
        "user-agent": "ReturnPick-Readiness/1.0",
        ...headers
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function runCronProbeCheck(): Promise<ApiConnectionCheck> {
  const siteUrl = normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL);
  const siteUrlIssue = getPublicSiteUrlIssue(process.env.NEXT_PUBLIC_SITE_URL);
  const secret = process.env.CRON_SECRET?.trim();

  if (!siteUrl || !secret) {
    return {
      id: "cron",
      label: "Vercel Cron 엔드포인트",
      status: "skipped",
      message: "NEXT_PUBLIC_SITE_URL 또는 CRON_SECRET이 없어 Cron 인증 probe를 건너뜁니다."
    };
  }

  if (siteUrlIssue) {
    return {
      id: "cron",
      label: "Vercel Cron 엔드포인트",
      status: "error",
      message: `Cron probe를 실행할 수 없습니다. ${siteUrlIssueMessage(siteUrlIssue)}`,
      detail: {
        site_url: process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? null,
        site_url_issue: siteUrlIssue
      }
    };
  }

  const probes = [
    { id: "sourcing", url: `${siteUrl}/api/cron/sourcing?probe=1` },
    { id: "affiliate_backfill", url: `${siteUrl}/api/cron/affiliate-backfill?probe=1` },
    { id: "telegram_digest", url: `${siteUrl}/api/cron/telegram-digest?probe=1` }
  ];

  const results = await Promise.all(
    probes.map(async (probe) => {
      try {
        const response = await fetchWithTimeout(probe.url, 8000, { authorization: `Bearer ${secret}` });
        const payload = await safeJsonPayload(response);
        const result = payload.result && typeof payload.result === "object" && !Array.isArray(payload.result) ? payload.result : {};
        const authorized = response.ok && result.status === "authorized" && result.probe === true && result.job_started === false;
        return {
          id: probe.id,
          url: probe.url,
          status: response.status,
          authorized,
          message: authorized ? "authorized" : compactText(payload.error) ?? compactText(payload.raw_text) ?? "CRON_PROBE_FAILED"
        };
      } catch (error) {
        return {
          id: probe.id,
          url: probe.url,
          status: null,
          authorized: false,
          message: error instanceof Error ? error.message : "CRON_PROBE_FAILED"
        };
      }
    })
  );

  const failed = results.filter((result) => !result.authorized);
  return {
    id: "cron",
    label: "Vercel Cron 엔드포인트",
    status: failed.length ? "error" : "ok",
    message: failed.length
      ? `Cron probe ${failed.length}건이 실패했습니다. CRON_SECRET, NEXT_PUBLIC_SITE_URL, 배포 alias를 확인하세요.`
      : "소싱과 텔레그램 Cron 엔드포인트가 CRON_SECRET으로 인증되고 실제 작업 없이 probe에 응답했습니다.",
    detail: { probes: results }
  };
}

async function runPublicSiteLiveCheck(): Promise<ApiConnectionCheck> {
  const siteUrl = normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL);
  const siteUrlIssue = getPublicSiteUrlIssue(process.env.NEXT_PUBLIC_SITE_URL);
  const approvalUrl = process.env.NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL?.trim() ?? "";

  if (!siteUrl) {
    return {
      id: "site_live",
      label: "공개 사이트/승인 페이지",
      status: "skipped",
      message: "NEXT_PUBLIC_SITE_URL이 없어 공개 승인 페이지 검사를 건너뜁니다."
    };
  }

  if (siteUrlIssue) {
    return {
      id: "site_live",
      label: "공개 사이트 승인 페이지",
      status: "error",
      message: `공개 승인 페이지를 검사할 수 없습니다. ${siteUrlIssueMessage(siteUrlIssue)}`,
      detail: {
        site_url: process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? null,
        site_url_issue: siteUrlIssue
      }
    };
  }

  const approvalPageUrl = `${siteUrl}/products/approval-sample`;
  try {
    const response = await fetchWithTimeout(approvalPageUrl);
    const body = await response.text();
    const hasCta = body.includes("쿠팡에서 가격 확인");
    const hasNotice = body.includes("쿠팡 파트너스 활동의 일환");
    const hasDisclosure = body.includes("/disclosure");
    const hasApprovalUrl = approvalUrl ? body.includes(approvalUrl) : false;
    let approvalRedirect: Record<string, JsonValue> | null = null;
    if (approvalUrl && isCoupangPartnersLink(approvalUrl)) {
      try {
        const redirectResponse = await fetchWithTimeout(approvalUrl, 8000, {}, "manual");
        const location = redirectResponse.headers.get("location");
        let destination: URL | null = null;
        try {
          destination = location ? new URL(location, approvalUrl) : null;
        } catch {
          destination = null;
        }
        const productId = extractCoupangProductId(destination?.toString());
        approvalRedirect = {
          checked: true,
          http_status: redirectResponse.status,
          location_host: destination?.hostname ?? null,
          product_id: productId,
          resolves_to_product: Boolean(productId)
        };
      } catch {
        approvalRedirect = {
          checked: true,
          error: "AFFILIATE_REDIRECT_CHECK_FAILED",
          resolves_to_product: false
        };
      }
    }
    const approvalRedirectOk = !approvalUrl || approvalRedirect?.resolves_to_product === true;
    const ok = response.ok && hasCta && hasNotice && hasDisclosure && (!approvalUrl || hasApprovalUrl) && approvalRedirectOk;

    return {
      id: "site_live",
      label: "공개 사이트/승인 페이지",
      status: ok ? "ok" : "error",
      message: ok
        ? "공개 승인 페이지가 응답하고 CTA, 제휴 고지, 제휴 안내 링크가 확인되었습니다."
        : `승인 페이지 라이브 확인이 부족합니다. HTTP ${response.status}, CTA ${hasCta ? "확인" : "누락"}, 고지 ${hasNotice ? "확인" : "누락"}`,
      detail: {
        approval_page_url: approvalPageUrl,
        http_status: response.status,
        has_cta: hasCta,
        has_affiliate_notice: hasNotice,
        has_disclosure_link: hasDisclosure,
        has_approval_affiliate_url: hasApprovalUrl,
        approval_url_configured: Boolean(approvalUrl),
        approval_redirect: approvalRedirect
      }
    };
  } catch (error) {
    return {
      id: "site_live",
      label: "공개 사이트/승인 페이지",
      status: "error",
      message: error instanceof Error ? error.message : "PUBLIC_SITE_CHECK_FAILED",
      detail: {
        approval_page_url: approvalPageUrl
      }
    };
  }
}

export function getApiReadinessSummary(): ApiReadinessSummary {
  const coupangEnv = ["COUPANG_ACCESS_KEY", "COUPANG_SECRET_KEY", "COUPANG_PARTNER_ID"];
  const supabaseEnv = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const publicWebEnabled = process.env.PUBLIC_WEB_CRAWL_ENABLED === "true";

  const items: ApiReadinessItem[] = [
    readableCoupangReadinessItem(buildCoupangItem()),
    buildNaverItem(),
    buildSupabaseItem(),
    buildBootstrapCatalogItem(),
    buildTelegramItem(),
    buildPublicSiteUrlItem(),
    buildApprovalLinkItem(),
    buildAdminPasswordItem(),
    buildCronSecretItem(),
    buildPublicWebItem()
  ];

  const itemById = new Map(items.map((item) => [item.id, item]));
  const optionalItemIds = [...OPTIONAL_CAPABILITY_ITEM_IDS];
  const { apiKeysReady, runtimeReady, launchReady, blockingItemIds, optionalMissingItemIds } = evaluateLaunchReadiness(items, publicWebEnabled);
  const catalogLaunchReady = evaluateCatalogLaunchReadiness(items);
  const blockingEnv = blockingItemIds.flatMap((id) => itemById.get(id)?.missingEnv ?? []);
  const optionalMissingEnv = optionalMissingItemIds.flatMap((id) => itemById.get(id)?.missingEnv ?? []);
  const mode: ReadinessMode = launchReady ? (apiKeysReady ? "launch_ready" : "manual_launch_ready") : apiKeysReady ? "api_ready" : "pre_approval";

  return {
    checkedAt: new Date().toISOString(),
    mode,
    items,
    requiredForApiLaunch: [
      ...coupangEnv,
      ...supabaseEnv,
      "ADMIN_PASSWORD",
      "CRON_SECRET",
      "NEXT_PUBLIC_SITE_URL",
      "NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL"
    ],
    apiKeysReady,
    runtimeReady,
    launchReady,
    catalogLaunchReady,
    blockingItemIds,
    blockingEnv,
    optionalItemIds,
    optionalMissingItemIds,
    optionalMissingEnv,
    requiredConnectionCheckIds: getRequiredConnectionCheckIds(publicWebEnabled, apiKeysReady),
    optionalConnectionCheckIds: getOptionalConnectionCheckIds(apiKeysReady)
  };
}

export async function getSupabaseStorageReadiness(): Promise<SupabaseStorageReadiness> {
  const checkedAt = new Date().toISOString();
  const summary = getApiReadinessSummary();
  const supabaseItem = summary.items.find((item) => item.id === "supabase");

  if (!supabaseItem || supabaseItem.state === "missing") {
    return {
      status: "unconfigured",
      message: "Supabase 운영 DB 환경변수가 아직 연결되지 않았습니다.",
      checkedAt
    };
  }

  if (supabaseItem.state !== "ready") {
    return {
      status: "unverified",
      message: "Supabase 환경변수 형식 또는 필수 값이 완전하지 않습니다.",
      checkedAt
    };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return {
      status: "unverified",
      message: "Supabase 서버 클라이언트를 만들지 못했습니다. 운영 키를 확인하세요.",
      checkedAt
    };
  }

  try {
    const [schemaVersion, products, distributionLedger] = await Promise.all([
      client.from("returnpick_schema_meta").select("value").eq("key", "schema_version").maybeSingle(),
      client.from("sourced_products").select("id", { count: "exact", head: true }).limit(1),
      client.from("distribution_deliveries").select("id,product_id,channel,status,delivery_mode,request_key", { count: "exact", head: true }).limit(1)
    ]);
    const schemaVersionValue =
      schemaVersion.data && typeof schemaVersion.data === "object" && "value" in schemaVersion.data
        ? String(schemaVersion.data.value ?? "")
        : "";

    if (schemaVersion.error || products.error || distributionLedger.error || schemaVersionValue !== EXPECTED_SCHEMA_VERSION) {
      return {
        status: "unverified",
        message: "Supabase에 연결됐지만 최신 schema.sql 또는 핵심 테이블 확인이 필요합니다.",
        checkedAt
      };
    }

    return {
      status: "verified",
      message: "Supabase 핵심 테이블과 최신 스키마 버전이 확인되었습니다.",
      checkedAt
    };
  } catch {
    return {
      status: "unverified",
      message: "Supabase 라이브 연결 확인에 실패했습니다. URL, 키와 schema.sql을 확인하세요.",
      checkedAt
    };
  }
}

export async function runApiConnectionChecks(): Promise<ApiConnectionCheck[]> {
  const summary = getApiReadinessSummary();
  const itemById = new Map(summary.items.map((item) => [item.id, item]));
  const checks: ApiConnectionCheck[] = [];
  let dataQualityCheck: ApiConnectionCheck | null = null;

  try {
  const coupang = itemById.get("coupang");
  if (!coupang?.configured) {
    checks.push(connectionCheckForUnavailableItem(coupang, "쿠팡 파트너스 API", "쿠팡 API 키가 없어 테스트를 건너뜁니다."));
  } else {
    const result = await searchCoupangProducts("갤럭시북", "laptop");
    const sample = result.products.find((product) => product.affiliate_url || product.coupang_url || product.source_url);
    const sampleOriginalUrl = sample?.coupang_url ?? sample?.source_url ?? null;
    const providerMeta = readinessRecord(result.meta);
    const firstParseDetail = readinessRecord(result.products[0]?.raw_json?.coupang_provider_parse);
    let deeplinkStatus: JsonValue = result.status === "ok" ? "skipped_no_product_url" : "not_tested";
    let deeplinkUrl: string | null = null;
    let deeplinkError: string | null = null;

    if (sample?.affiliate_url) {
      deeplinkStatus = "provided_by_search";
      deeplinkUrl = sample.affiliate_url;
    } else {
      if (result.status === "ok" && sampleOriginalUrl) {
        const deeplink = await createCoupangDeeplink(sampleOriginalUrl);
        deeplinkStatus = deeplink.status;
        deeplinkUrl = deeplink.url ?? null;
        deeplinkError = "error" in deeplink ? deeplink.error ?? null : null;
      }
    }

    const searchOk = result.status === "ok";
    const deeplinkOk = deeplinkStatus === "provided_by_search" || (deeplinkStatus === "ok" && Boolean(deeplinkUrl));
    const coupangOk = searchOk && deeplinkOk;
    const providerPath = typeof providerMeta.provider_path === "string" ? providerMeta.provider_path : null;
    const responseArrayPath =
      typeof providerMeta.response_array_path === "string"
        ? providerMeta.response_array_path
        : typeof firstParseDetail.array_path === "string"
          ? firstParseDetail.array_path
          : null;
    const rawProductCount =
      typeof providerMeta.raw_product_count === "number"
        ? providerMeta.raw_product_count
        : typeof firstParseDetail.raw_product_count === "number"
          ? firstParseDetail.raw_product_count
          : null;
    const normalizedProductCount =
      typeof providerMeta.normalized_product_count === "number" ? providerMeta.normalized_product_count : result.products.length;
    const sampleProductUrlField =
      typeof firstParseDetail.product_url_field === "string" ? firstParseDetail.product_url_field : null;
    const sampleAffiliateUrlField =
      typeof firstParseDetail.affiliate_url_field === "string" ? firstParseDetail.affiliate_url_field : null;
    const coupangNextAction =
      !searchOk
        ? null
        : result.products.length === 0
          ? "쿠팡 검색 API는 응답했지만 상품 후보 배열이 비어 있습니다. 관리자 후보 수집에서 다른 키워드로 재시도하고, provider_path와 response_array_path가 실제 쿠팡 응답 구조와 맞는지 확인하세요."
          : !sample
            ? "검색 상품은 들어왔지만 파트너스 링크로 바꿀 상품 URL을 찾지 못했습니다. coupang_provider_parse의 product_url_field와 원본 raw_json 필드를 확인하세요."
            : !deeplinkOk
              ? "상품 URL은 찾았지만 파트너스 딥링크 생성이 확인되지 않았습니다. 쿠팡 API 권한, deeplink endpoint, COUPANG_PARTNER_ID 값을 다시 확인하세요."
              : null;
    checks.push({
      id: "coupang",
      label: "쿠팡 파트너스 API",
      status: coupangOk ? "ok" : "error",
      message: coupangOk
        ? `${result.products.length}개 상품 검색과 파트너스 링크 생성 경로가 확인되었습니다.`
        : searchOk
          ? `상품 검색은 됐지만 딥링크 생성 확인이 필요합니다. 상태: ${String(deeplinkStatus)}`
          : result.error ?? result.status,
      detail: {
        provider_status: result.status,
        product_count: result.products.length,
        sample_title: result.products[0]?.title ?? null,
        provider_path: providerPath,
        response_array_path: responseArrayPath,
        raw_product_count: rawProductCount,
        normalized_product_count: normalizedProductCount,
        sample_has_product_url: Boolean(sampleOriginalUrl),
        sample_product_url_field: sampleProductUrlField,
        sample_affiliate_url_field: sampleAffiliateUrlField,
        sample_affiliate_url_usable: Boolean(sample?.affiliate_url),
        deeplink_status: deeplinkStatus,
        deeplink_created: Boolean(deeplinkUrl),
        deeplink_error: deeplinkError,
        operator_next_action: coupangNextAction
      }
    });
  }

  } catch (error) {
    checks.push(connectionCheckFailure("coupang", "쿠팡 파트너스 API", error));
  }

  try {
  const naver = itemById.get("naver");
  if (!naver?.configured) {
    checks.push(connectionCheckForUnavailableItem(naver, "네이버 쇼핑 API", "네이버 API 키가 없어 테스트를 건너뜁니다."));
  } else {
    const result = await searchNaverShopping("갤럭시북");
    const prices = result.items.map((item) => item.lprice).filter((price): price is number => typeof price === "number" && Number.isFinite(price));
    const meta = readinessRecord(result.meta);
    const naverOk = result.status === "ok" && prices.length > 0;
    const naverNextAction =
      result.status !== "ok"
        ? null
        : result.items.length === 0
          ? "네이버 쇼핑 API는 응답했지만 테스트 검색어의 items 배열이 비어 있습니다. query, api_total, items_path를 확인하고 네이버 쇼핑 검색 API 권한과 검색어를 다시 점검하세요."
          : prices.length === 0
            ? "네이버 검색 결과는 들어왔지만 lprice가 있는 항목이 없습니다. 네이버 응답의 가격 필드와 검색어 매칭을 확인한 뒤 가격 보강을 다시 실행하세요."
            : null;
    checks.push({
      id: "naver",
      label: "네이버 쇼핑 API",
      status: naverOk ? "ok" : "error",
      message: naverOk
        ? `${result.items.length}개 가격 후보를 검색했고 최저가 기준을 확인했습니다.`
        : result.status === "ok"
          ? `네이버 검색은 응답했지만 가격 기준 확인이 필요합니다. 검색 결과 ${result.items.length}개, 가격 항목 ${prices.length}개`
          : result.error ?? result.status,
      detail: {
        provider_status: result.status,
        query: typeof meta.query === "string" ? meta.query : "갤럭시북",
        api_total: typeof meta.api_total === "number" ? meta.api_total : null,
        api_display: typeof meta.api_display === "number" ? meta.api_display : null,
        items_path: typeof meta.items_path === "string" ? meta.items_path : null,
        item_count: result.items.length,
        raw_item_count: typeof meta.raw_item_count === "number" ? meta.raw_item_count : result.items.length,
        normalized_item_count: typeof meta.normalized_item_count === "number" ? meta.normalized_item_count : result.items.length,
        priced_item_count: typeof meta.priced_item_count === "number" ? meta.priced_item_count : prices.length,
        lowest_price: prices.length ? Math.min(...prices) : null,
        sample_title: result.items[0]?.title ?? null,
        sample_mall_name: result.items[0]?.mallName ?? null,
        operator_next_action: naverNextAction
      }
    });
  }

  } catch (error) {
    checks.push(connectionCheckFailure("naver", "네이버 쇼핑 API", error));
  }

  try {
    const publicWeb = itemById.get("public_web");
    if (publicWeb?.state === "disabled") {
      checks.push({
        id: "public_web",
        label: "공개 웹 참고 수집",
        status: "skipped",
        message: "공개 웹 참고 수집이 꺼져 있어 robots.txt 라이브 점검을 건너뜁니다."
      });
    } else if (publicWeb?.state !== "ready") {
      checks.push(connectionCheckForUnavailableItem(publicWeb, "공개 웹 참고 수집", "공개 웹 allowlist 또는 검색 템플릿이 없어 테스트를 건너뜁니다."));
    } else {
      const result = await searchPublicWebProducts("갤럭시북", "laptop");
      const ok = result.status === "ok";
      checks.push({
        id: "public_web",
        label: "공개 웹 참고 수집",
        status: ok ? "ok" : "error",
        message: ok
          ? `allowlist, robots.txt, HTML 응답 경로가 확인되었습니다. 참고 후보 ${result.products.length}개`
          : `공개 웹 참고 수집 점검 실패: ${result.status}`,
        detail: {
          provider_status: result.status,
          product_count: result.products.length,
          error: result.error ?? null
        }
      });
    }
  } catch (error) {
    checks.push(connectionCheckFailure("public_web", "공개 웹 참고 수집", error));
  }

  try {
    checks.push(await runPublicSiteLiveCheck());
  } catch (error) {
    checks.push(connectionCheckFailure("site_live", "공개 사이트 승인 페이지", error));
  }

  try {
    checks.push(await runCronProbeCheck());
  } catch (error) {
    checks.push(connectionCheckFailure("cron", "Vercel Cron 엔드포인트", error));
  }

  try {
  const supabase = itemById.get("supabase");
  if (!hasSupabaseConfig()) {
    checks.push({ id: "supabase", label: "Supabase 운영 DB", status: "skipped", message: "Supabase 값이 없어 로컬 저장소 모드입니다." });
    dataQualityCheck = dataQualityDependencyCheck("Supabase 값이 없어 공개 데이터 품질 검사를 건너뜁니다.", "not_configured");
  } else if (supabase?.state !== "ready") {
    checks.push({
      id: "supabase",
      label: "Supabase 운영 DB",
      status: "error",
      message: supabase?.message ?? "Supabase 환경변수 형식을 확인하세요.",
      detail: {
        missing_or_invalid_env: supabase?.missingEnv ?? [],
        next_action: supabase?.nextAction ?? "Supabase URL과 key를 다시 확인하세요."
      }
    });
    dataQualityCheck = dataQualityDependencyCheck("Supabase 환경변수가 준비되지 않아 공개 데이터 품질 검사를 건너뜁니다.", "invalid_configuration");
  } else {
    const client = getSupabaseServiceClient();
    const requiredTables = [
      "sourcing_keywords",
      "sourced_products",
      "deal_scores",
      "sourcing_runs",
      "telegram_logs",
      "distribution_deliveries",
      "affiliate_events",
      "product_snapshots"
    ];
    const requiredSchemaChecks = [
      { table: "sourcing_keywords", columns: "id,keyword,keyword_key,category,is_active" },
      { table: "sourced_products", columns: "id,affiliate_url,naver_lowest_price,condition_grade,sourcing_status,last_observed_at" },
      { table: "deal_scores", columns: "id,product_id,total_score,risk_flags,score_detail" },
      { table: "telegram_logs", columns: "id,product_id,target_type,target_key,status,created_at" },
      { table: "distribution_deliveries", columns: "id,product_id,channel,status,delivery_mode,request_key,provider_post_id,attempt_count,updated_at" },
      { table: "affiliate_events", columns: "id,event_type,channel,utm_source,anon_session_id" },
      { table: "product_snapshots", columns: "id,product_id,change_flags,observed_at" }
    ];
    const tableChecks = client
      ? await Promise.all(
          requiredTables.map(async (table) => {
            const { count, error } = await client.from(table).select("id", { count: "exact", head: true });
            return { table, count: count ?? null, error: error?.message ?? null };
          })
        )
      : requiredTables.map((table) => ({ table, count: null, error: "SUPABASE_CLIENT_NOT_AVAILABLE" }));
    const schemaChecks = client
      ? await Promise.all(
          requiredSchemaChecks.map(async (check) => {
            const { error } = await client.from(check.table).select(check.columns, { count: "exact", head: true }).limit(1);
            return { table: check.table, columns: check.columns, error: error?.message ?? null };
          })
        )
      : requiredSchemaChecks.map((check) => ({ ...check, error: "SUPABASE_CLIENT_NOT_AVAILABLE" }));
    const schemaVersionCheck = client
      ? await client.from("returnpick_schema_meta").select("key,value,updated_at").eq("key", "schema_version").maybeSingle()
      : { data: null, error: { message: "SUPABASE_CLIENT_NOT_AVAILABLE" } };
    const schemaVersionValue =
      schemaVersionCheck.data && typeof schemaVersionCheck.data === "object" && "value" in schemaVersionCheck.data
        ? String(schemaVersionCheck.data.value ?? "")
        : "";
    const schemaVersionOk = schemaVersionValue === EXPECTED_SCHEMA_VERSION;
    const schemaVersionFailures =
      schemaVersionCheck.error || !schemaVersionOk
        ? [
            {
              expected: EXPECTED_SCHEMA_VERSION,
              actual: schemaVersionValue || null,
              error: schemaVersionCheck.error?.message ?? "SCHEMA_VERSION_MISMATCH"
            }
          ]
        : [];
    const failedTables = tableChecks.filter((check) => check.error);
    const failedSchema = schemaChecks.filter((check) => check.error);
    const strictAffiliateFunction =
      client && !failedTables.length && !failedSchema.length ? await runStrictAffiliateSqlFunctionSmokeCheck(client) : null;
    const distributionLedgerSmoke =
      client && !failedTables.length && !failedSchema.length ? await runDistributionDeliveryLedgerSmokeCheck(client) : null;
    const writeSmoke =
      client && !failedTables.length && !failedSchema.length && strictAffiliateFunction?.ok ? await runSupabaseWriteSmokeCheck(client) : null;
    const anonRlsSmoke =
      client && !failedTables.length && !failedSchema.length && strictAffiliateFunction?.ok && writeSmoke?.ok
        ? await runAnonPublicRlsSmokeCheck(client)
        : null;
    const failedStrictAffiliateFunctionSteps = strictAffiliateFunction?.steps.filter((step) => !step.ok) ?? [];
    const failedDistributionLedgerSteps = distributionLedgerSmoke?.steps.filter((step) => !step.ok) ?? [];
    const failedWriteSteps = writeSmoke?.steps.filter((step) => !step.ok) ?? [];
    const failedAnonRlsSteps = anonRlsSmoke?.steps.filter((step) => !step.ok) ?? [];
    const failedCount =
      failedTables.length +
      failedSchema.length +
      schemaVersionFailures.length +
      failedStrictAffiliateFunctionSteps.length +
      failedDistributionLedgerSteps.length +
      failedWriteSteps.length +
      failedAnonRlsSteps.length;
    checks.push({
      id: "supabase",
      label: "Supabase 운영 DB",
      status: failedCount ? "error" : "ok",
      message: failedCount
        ? `테이블/스키마/쓰기/RLS 확인 ${failedCount}건에 실패했습니다. schema.sql과 Supabase key를 다시 확인하세요.`
        : "필수 운영 테이블, 최신 컬럼, 실행 로그/클릭 이벤트 쓰기, anon 공개 RLS 경로가 모두 확인되었습니다.",
      detail: {
        tables: tableChecks,
        schema: schemaChecks,
        schema_version: {
          expected: EXPECTED_SCHEMA_VERSION,
          actual: schemaVersionValue || null,
          ok: schemaVersionOk,
          updated_at:
            schemaVersionCheck.data && typeof schemaVersionCheck.data === "object" && "updated_at" in schemaVersionCheck.data
              ? String(schemaVersionCheck.data.updated_at ?? "")
              : null,
          errors: schemaVersionFailures
        },
        strict_affiliate_function: strictAffiliateFunction,
        distribution_delivery_ledger_smoke: distributionLedgerSmoke,
        write_smoke: writeSmoke,
        anon_public_rls_smoke: anonRlsSmoke
      }
    });
    dataQualityCheck =
      !failedCount && client
        ? await runPublicDataQualityCheck(client)
        : dataQualityDependencyCheck("Supabase 스키마 또는 쓰기 검사가 통과하지 않아 공개 데이터 품질 검사를 건너뜁니다.", "schema_check_failed");
  }

  } catch (error) {
    const failure = connectionCheckFailure("supabase", "Supabase 운영 DB", error);
    const existingSupabaseIndex = checks.findIndex((check) => check.id === "supabase");
    if (existingSupabaseIndex >= 0) checks[existingSupabaseIndex] = failure;
    else checks.push(failure);
    dataQualityCheck = dataQualityDependencyCheck("Supabase 연결 테스트 중 예외가 발생해 공개 데이터 품질 검사를 건너뜁니다.", "connection_error");
  }

  checks.push(
    dataQualityCheck ?? dataQualityDependencyCheck("Supabase 검사 결과를 확인할 수 없어 공개 데이터 품질 검사를 건너뜁니다.", "unknown")
  );

  try {
  const telegram = itemById.get("telegram");
  if (!telegram?.configured) {
    checks.push(connectionCheckForUnavailableItem(telegram, "텔레그램 Bot API", "텔레그램 토큰 또는 chat ID가 없어 테스트를 건너뜁니다."));
  } else {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID ?? "";
    const botResponse = await fetchWithTimeout(`https://api.telegram.org/bot${token}/getMe`);
    const botPayload = await safeJsonPayload(botResponse);
    const chatResponse = await fetchWithTimeout(`https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(chatId)}`);
    const chatPayload = await safeJsonPayload(chatResponse);
    const botOk = botResponse.ok && botPayload.ok !== false;
    const chatOk = chatResponse.ok && chatPayload.ok !== false;
    checks.push({
      id: "telegram",
      label: "텔레그램 Bot API",
      status: botOk && chatOk ? "ok" : "error",
      message: botOk && chatOk ? "Bot 토큰과 chat ID 접근이 확인되었습니다." : `TELEGRAM_CHECK_FAILED: ${telegramPayloadMessage(chatPayload) ?? telegramPayloadMessage(botPayload) ?? "토큰 또는 chat ID를 확인하세요."}`,
      detail: {
        get_me_status: botResponse.status,
        get_chat_status: chatResponse.status,
        get_me_ok: botOk,
        get_chat_ok: chatOk,
        bot_username:
          botPayload.result && typeof botPayload.result === "object" && !Array.isArray(botPayload.result) && typeof botPayload.result.username === "string"
            ? botPayload.result.username
            : null,
        chat_type:
          chatPayload.result && typeof chatPayload.result === "object" && !Array.isArray(chatPayload.result) && typeof chatPayload.result.type === "string"
            ? chatPayload.result.type
            : null,
        error: telegramPayloadMessage(chatPayload) ?? telegramPayloadMessage(botPayload)
      }
    });
  }

  } catch (error) {
    checks.push(connectionCheckFailure("telegram", "텔레그램 Bot API", error));
  }

  return checks.map((check) =>
    readableTelegramConnectionCheck(readableSupabaseConnectionCheck(readableNaverConnectionCheck(readableCoupangConnectionCheck(check))))
  );
}
