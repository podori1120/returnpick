"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, ExternalLink, Link2, RefreshCw, Search, ShieldCheck, Upload, Wand2 } from "lucide-react";
import { getAffiliateIdentityReadiness } from "@/lib/affiliateIdentity";
import { getCategoryLabel } from "@/lib/category";
import { buildCoupangSearchUrl, isApprovalSampleAffiliateUrl, isCoupangPartnersLink, isUsableAffiliateUrl } from "@/lib/coupangLink";
import { formatPrice } from "@/lib/format";
import { getCustomerPublishReadiness } from "@/lib/quality";
import { getNaverPriceTrust } from "@/lib/naverPriceTrust";
import { scrollToAdminAnchor } from "@/lib/adminNavigation";
import { isManualPromotionSource } from "@/lib/manualPromotion";
import type { ProductWithScore } from "@/lib/types";

function headers(password: string) {
  return { "Content-Type": "application/json", "x-admin-password": password };
}

type SaveMode = "save" | "publish";
type BackfillMatchEvidence = {
  relevance_score?: number;
  min_relevance?: number;
  matched_tokens?: string[];
  candidate_count?: number;
  url_candidate_count?: number;
  relevance_candidate_count?: number;
  rejected_by_relevance_count?: number;
};

type BackfillResultItem = {
  product_id: string;
  title: string;
  status: string;
  reason?: string;
  query?: string | null;
  source_url?: string | null;
  manual_search_url?: string | null;
  matched_title?: string | null;
  match?: BackfillMatchEvidence | null;
};

type BackfillResult = {
  status: string;
  scanned_count: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  items?: BackfillResultItem[];
};

type ProductsResponse = {
  products?: ProductWithScore[];
  error?: string;
  message?: string;
};

type BackfillResponse = BackfillResult & {
  error?: string;
  message?: string;
};

type BulkImportResult = {
  status: string;
  scanned_count: number;
  valid_count?: number;
  updated_count: number;
  published_count?: number;
  identity_pending_count?: number;
  publish_blocked_count?: number;
  skipped_count: number;
  error_count: number;
  dry_run?: boolean;
  publish_requested?: boolean;
  items?: Array<{
    product_id: string;
    matched_by?: "internal_id" | "coupang_product_id";
    title?: string | null;
    status: string;
    reason?: string;
    affiliate_url?: string | null;
  }>;
};

type BulkImportResponse = BulkImportResult & {
  error?: string;
  message?: string;
};

type AffiliateLinkVerification = {
  ok: boolean;
  code: string;
  identity_status?: "MATCH" | "MISMATCH" | "UNRESOLVED" | "EXPECTED_ID_UNAVAILABLE" | "MANUAL_CONFIRMED";
  message: string;
  final_url?: string;
  product_id?: string;
  expected_product_id?: string;
  http_status?: number;
  redirect_count: number;
  checked_at: string;
};

type AffiliateLinkVerificationResponse = {
  verification?: AffiliateLinkVerification;
  error?: string;
  message?: string;
};

type ManualPromotionResponse = {
  error?: string;
  message?: string;
  product?: ProductWithScore;
};

function hasPublicProductMarker(product: Pick<ProductWithScore, "is_published" | "sourcing_status">) {
  return product.is_published === true || product.sourcing_status === "published";
}

const MAX_BULK_LINK_CHECKS = 8;
const MAX_BULK_TEMPLATE_LINES = 80;
const LINK_QUEUE_PAGE_SIZE = 24;

type CheckedAffiliateLinkVerification = AffiliateLinkVerification & {
  checked_url: string;
};

function noticeClassName(type: "info" | "success" | "error") {
  if (type === "error") return "border-coral/30 bg-coral/10 text-coral";
  if (type === "success") return "border-pine/30 bg-pine/10 text-pine";
  return "border-line bg-mist text-steel";
}

function backfillMessage(result: BackfillResult) {
  const base = `확인 ${result.scanned_count}개, 저장 ${result.updated_count}개, 건너뜀 ${result.skipped_count}개, 오류 ${result.error_count}개`;
  if (result.status === "API_NOT_CONFIGURED") return `쿠팡 파트너스 API 키가 없어 자동 보강은 대기 상태입니다. ${base}`;
  if (result.status === "partial" || result.status === "error") return `파트너스 링크 자동 보강 일부 실패: ${base}`;
  return `파트너스 링크 자동 보강 완료: ${base}`;
}

function bulkImportMessage(result: BulkImportResult) {
  const valid = result.dry_run ? `, 저장 가능 ${result.valid_count ?? 0}개` : "";
  const published = result.publish_requested ? `, 게시 ${result.published_count ?? 0}개` : "";
  const identityPending = result.identity_pending_count ? `, 목적지 확인 필요 ${result.identity_pending_count}개` : "";
  const publishBlocked = result.publish_blocked_count ? `, 품질 확인 필요 ${result.publish_blocked_count}개` : "";
  const base = `확인 ${result.scanned_count}줄${valid}, 저장 ${result.updated_count}개${published}${identityPending}${publishBlocked}, 건너뜀 ${result.skipped_count}개, 오류 ${result.error_count}개`;
  if (result.dry_run) return `대량 링크 검증 완료: ${base}`;
  if (result.publish_requested && (result.identity_pending_count || result.publish_blocked_count)) {
    return `링크 저장 완료, 게시 전 확인 필요: ${base}`;
  }
  if (result.status === "partial" || result.status === "error") return `대량 링크 입력 일부 실패: ${base}`;
  return `대량 링크 입력 완료: ${base}`;
}

function bulkImportNoticeType(result: BulkImportResult): "info" | "success" | "error" {
  if (result.status === "error") return "error";
  if (result.status === "partial" || (result.publish_requested && (result.published_count ?? 0) === 0)) return "info";
  return "success";
}

function linkResultStatusLabel(status: string) {
  const labels: Record<string, string> = {
    ok: "완료",
    partial: "일부 완료",
    error: "실패",
    API_NOT_CONFIGURED: "API 키 필요",
    updated: "저장 완료",
    valid: "검증 통과",
    dry_run: "저장 가능",
    skipped: "건너뜀"
  };
  return labels[status] ?? status;
}

function linkResultStatusClassName(status: string) {
  if (status === "ok" || status === "updated" || status === "valid" || status === "dry_run") return "text-pine";
  if (status === "error" || status === "API_NOT_CONFIGURED") return "text-coral";
  return "text-steel";
}

function linkResultReasonLabel(reason?: string | null) {
  if (!reason) return null;
  if (reason === "AFFILIATE_IDENTITY_VERIFICATION_REQUIRED") return "링크는 저장했지만 목적지 확인 전이라 게시하지 않았습니다. 각 행에서 링크 확인을 실행하세요.";
  if (reason === "COUPANG_API_NOT_CONFIGURED") return "쿠팡 파트너스 API 키가 아직 없습니다.";
  if (reason === "PRODUCT_ID_AND_LINK_REQUIRED") return "상품 ID와 파트너스 링크가 모두 필요합니다.";
  if (reason === "DUPLICATE_PRODUCT_ID") return "같은 상품 ID가 중복 입력되었습니다.";
  if (reason === "AMBIGUOUS_SOURCE_PRODUCT_ID") return "같은 쿠팡 상품번호를 가진 후보가 여러 개라 잘못 연결될 수 있어 중단했습니다.";
  if (reason === "APPROVAL_SAMPLE_LINK_NOT_ALLOWED") return "승인용 샘플 링크는 실상품에 사용할 수 없습니다.";
  if (reason === "PRODUCT_NOT_FOUND") return "해당 상품 ID를 찾지 못했습니다.";
  if (reason === "PUBLISHED") return "저장 후 게시까지 완료했습니다.";
  if (reason === "INVALID_AFFILIATE_URL") return "상품별 쿠팡 파트너스 단축 링크 형식이 아닙니다.";
  if (reason === "AFFILIATE_TARGET_MISMATCH") return "후보와 다른 쿠팡 상품번호로 연결되어 저장·게시하지 않았습니다.";
  if (reason.startsWith("PUBLISH_BLOCKED_PUBLIC_QUALITY")) return `링크는 저장했지만 게시 전 품질 확인이 필요합니다. ${reason.split(":").slice(1).join(":").trim()}`;
  if (reason.startsWith("DIRECT_DEEPLINK_FAILED")) return "기존 쿠팡 URL을 파트너스 링크로 변환하지 못했습니다.";
  if (reason.includes("COUPANG_MATCH_RELEVANCE_TOO_LOW") || reason.includes("MATCH_RELEVANCE_TOO_LOW")) return "쿠팡 검색 결과의 상품명/스펙 관련도가 낮아 자동 저장하지 않았습니다.";
  if (reason.includes("NO_USABLE_PARTNERS_URL")) return "API 응답에서 사용할 수 있는 파트너스 링크를 찾지 못했습니다.";
  if (reason.includes("NO_PRODUCT_URL")) return "매칭 상품에 변환 가능한 쿠팡 상품 URL이 없습니다.";
  if (reason.includes("NO_MATCH")) return "쿠팡 검색에서 매칭 상품을 찾지 못했습니다.";
  if (reason.startsWith("AFFILIATE_BACKFILL_UPDATE_FAILED")) return "파트너스 링크를 DB에 저장하지 못했습니다.";
  return reason.slice(0, 180);
}

function backfillMatchSummary(item: BackfillResultItem) {
  const match = item.match;
  if (!match) return null;

  const score = match.relevance_score ?? 0;
  const minScore = match.min_relevance ?? 0;
  const tokens = match.matched_tokens?.filter(Boolean).slice(0, 4).join(", ");
  const parts = [`관련도 ${score}/${minScore}`];
  if (tokens) parts.push(`매칭 ${tokens}`);
  if (typeof match.url_candidate_count === "number") parts.push(`URL 후보 ${match.url_candidate_count}개`);
  if (typeof match.rejected_by_relevance_count === "number" && match.rejected_by_relevance_count > 0) {
    parts.push(`관련도 제외 ${match.rejected_by_relevance_count}개`);
  }
  return parts.join(" · ");
}

function backfillResultLinks(item: BackfillResultItem) {
  const links = [
    item.manual_search_url ? { href: item.manual_search_url, label: "쿠팡 검색 열기" } : null,
    item.source_url && item.source_url !== item.manual_search_url ? { href: item.source_url, label: "원본 보기" } : null
  ].filter((link): link is { href: string; label: string } => Boolean(link));
  return links.slice(0, 2);
}

function backfillManualItems(result: BackfillResult | null) {
  return (
    result?.items
      ?.filter((item) => item.status === "skipped" || item.status === "error")
      .slice(0, 24) ?? []
  );
}

function buildBackfillManualTemplate(result: BackfillResult | null) {
  return backfillManualItems(result)
    .map((item) => {
      const title = item.matched_title ?? item.title;
      const referenceUrl = item.manual_search_url ?? item.source_url ?? "";
      return `${item.product_id}\t상품별 파트너스 링크 붙여넣기\t${title}\t${referenceUrl}`;
    })
    .join("\n");
}

export default function AdminAffiliateLinkQueue({
  password,
  refreshToken,
  onCompleted
}: {
  password: string;
  refreshToken: number;
  onCompleted: () => void;
}) {
  const [products, setProducts] = useState<ProductWithScore[]>([]);
  const [query, setQuery] = useState("");
  const [publishedOnly, setPublishedOnly] = useState(false);
  const [queuePage, setQueuePage] = useState(0);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [bulkText, setBulkText] = useState("");
  const [bulkPublish, setBulkPublish] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [backfillResult, setBackfillResult] = useState<BackfillResult | null>(null);
  const [bulkImportRunning, setBulkImportRunning] = useState(false);
  const [bulkImportResult, setBulkImportResult] = useState<BulkImportResult | null>(null);
  const [bulkVerificationRunning, setBulkVerificationRunning] = useState(false);
  const [checkingLinkId, setCheckingLinkId] = useState<string | null>(null);
  const [manualPromotingId, setManualPromotingId] = useState<string | null>(null);
  const [linkVerifications, setLinkVerifications] = useState<Record<string, CheckedAffiliateLinkVerification>>({});
  const [notice, setNotice] = useState<{ type: "info" | "success" | "error"; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [targetProductId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const candidateId = new URLSearchParams(window.location.search).get("candidate")?.trim() ?? "";
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidateId)
      ? candidateId
      : null;
  });
  const handledTargetRef = useRef<string | null>(null);

  async function loadProducts() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/products", { headers: headers(password) });
      const data = (await response.json().catch(() => ({}))) as ProductsResponse;
      if (!response.ok || !Array.isArray(data.products)) {
        setNotice({ type: "error", message: data.message ?? data.error ?? "파트너스 링크 보강 대상을 불러오지 못했습니다." });
        return;
      }
      const nextProducts = data.products;
      setProducts(nextProducts);
      setInputs((current) => ({
        ...Object.fromEntries(nextProducts.map((product) => [product.id, product.affiliate_url ?? ""])),
        ...current
      }));
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 파트너스 링크 보강 대상을 불러오지 못했습니다." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, [password, refreshToken]);

  const missingProducts = useMemo(
    () =>
      products
        .filter(
          (product) =>
            !isUsableAffiliateUrl(product.affiliate_url) ||
            !getAffiliateIdentityReadiness(product).ready
        )
        .filter((product) => (publishedOnly ? product.is_published || product.sourcing_status === "published" : true))
        .filter((product) => (query ? product.title.toLowerCase().includes(query.toLowerCase()) : true))
        .sort((a, b) => {
          const aTarget = a.id === targetProductId ? 1 : 0;
          const bTarget = b.id === targetProductId ? 1 : 0;
          const aPublished = a.is_published || a.sourcing_status === "published" ? 1 : 0;
          const bPublished = b.is_published || b.sourcing_status === "published" ? 1 : 0;
          return bTarget - aTarget || bPublished - aPublished || (b.latest_score?.total_score ?? 0) - (a.latest_score?.total_score ?? 0);
        }),
    [products, publishedOnly, query, targetProductId]
  );
  const publicReadyCount = products.filter(
    (product) =>
      product.is_published &&
      product.sourcing_status === "published" &&
      getCustomerPublishReadiness(product).ready
  ).length;
  const manualPromotionProducts = useMemo(
    () =>
      products
        .filter((product) => !hasPublicProductMarker(product))
        .filter((product) => isManualPromotionSource(product.source) && getAffiliateIdentityReadiness(product).ready)
        .sort((a, b) => (b.latest_score?.total_score ?? 0) - (a.latest_score?.total_score ?? 0)),
    [products]
  );
  const hiddenPublishedCount = products.filter(
    (product) =>
      (product.is_published || product.sourcing_status === "published") &&
      !getCustomerPublishReadiness(product).ready
  ).length;
  const totalQueuePages = Math.max(1, Math.ceil(missingProducts.length / LINK_QUEUE_PAGE_SIZE));
  const currentQueuePage = Math.min(queuePage, totalQueuePages - 1);
  const visibleProducts = missingProducts.slice(
    currentQueuePage * LINK_QUEUE_PAGE_SIZE,
    (currentQueuePage + 1) * LINK_QUEUE_PAGE_SIZE
  );
  const pendingVerificationVisibleProducts = useMemo(
    () =>
      visibleProducts.filter((product) => {
        const affiliateUrl = inputs[product.id]?.trim() ?? "";
        const verification = linkVerifications[product.id];
        return isCoupangPartnersLink(affiliateUrl) && !isApprovalSampleAffiliateUrl(affiliateUrl) && verification?.checked_url !== affiliateUrl;
      }),
    [inputs, linkVerifications, visibleProducts]
  );
  const verifiedVisibleProducts = useMemo(
    () =>
      visibleProducts.filter((product) => {
        const affiliateUrl = inputs[product.id]?.trim() ?? "";
        const verification = linkVerifications[product.id];
        return (
          isCoupangPartnersLink(affiliateUrl) &&
          verification?.checked_url === affiliateUrl &&
          (verification.identity_status === "MATCH" || verification.identity_status === "MANUAL_CONFIRMED")
        );
      }),
    [inputs, linkVerifications, visibleProducts]
  );

  useEffect(() => {
    if (!targetProductId || handledTargetRef.current === targetProductId) return;
    if (!visibleProducts.some((product) => product.id === targetProductId)) return;

    handledTargetRef.current = targetProductId;
    const timer = window.setTimeout(() => scrollToAdminAnchor(`admin-affiliate-product-${targetProductId}`), 80);
    return () => window.clearTimeout(timer);
  }, [targetProductId, visibleProducts]);

  async function copyTitle(product: ProductWithScore) {
    await navigator.clipboard.writeText(product.title);
    setCopiedId(product.id);
    window.setTimeout(() => setCopiedId((current) => (current === product.id ? null : current)), 1500);
  }

  async function verifyAffiliateUrl(
    product: ProductWithScore,
    mode: "verify" | "manual_confirm" = "verify",
    affiliateUrlOverride?: string
  ): Promise<CheckedAffiliateLinkVerification> {
    const affiliateUrl = affiliateUrlOverride?.trim() ?? inputs[product.id]?.trim() ?? "";
    if (!isCoupangPartnersLink(affiliateUrl)) {
      const verification: CheckedAffiliateLinkVerification = {
        ok: false,
        code: "INVALID_AFFILIATE_URL",
        message: "https://link.coupang.com/a/... 형식의 파트너스 링크를 먼저 입력하세요.",
        redirect_count: 0,
        checked_at: new Date().toISOString(),
        checked_url: affiliateUrl
      };
      setLinkVerifications((current) => ({ ...current, [product.id]: verification }));
      return verification;
    }

    setCheckingLinkId(product.id);
    setLinkVerifications((current) => {
      const next = { ...current };
      delete next[product.id];
      return next;
    });
    try {
      const response = await fetch("/api/admin/affiliate-links/verify", {
        method: "POST",
        headers: headers(password),
        body: JSON.stringify({ product_id: product.id, affiliate_url: affiliateUrl, mode })
      });
      const data = (await response.json().catch(() => ({}))) as AffiliateLinkVerificationResponse;
      if (!response.ok || !data.verification) {
        const verification: CheckedAffiliateLinkVerification = {
          ok: false,
          code: data.error ?? "LINK_VERIFICATION_FAILED",
          message: data.message ?? "링크 목적지를 확인하지 못했습니다.",
          redirect_count: 0,
          checked_at: new Date().toISOString(),
          checked_url: affiliateUrl
        };
        setLinkVerifications((current) => ({ ...current, [product.id]: verification }));
        return verification;
      }
      const verification: CheckedAffiliateLinkVerification = { ...data.verification, checked_url: affiliateUrl };
      setLinkVerifications((current) => ({ ...current, [product.id]: verification }));
      return verification;
    } catch {
      const verification: CheckedAffiliateLinkVerification = {
        ok: false,
        code: "LINK_VERIFICATION_NETWORK_ERROR",
        message: "네트워크 문제로 링크 목적지를 확인하지 못했습니다.",
        redirect_count: 0,
        checked_at: new Date().toISOString(),
        checked_url: affiliateUrl
      };
      setLinkVerifications((current) => ({ ...current, [product.id]: verification }));
      return verification;
    } finally {
      setCheckingLinkId(null);
    }
  }

  async function verifyVisibleAffiliateLinks() {
    const targets = pendingVerificationVisibleProducts.slice(0, MAX_BULK_LINK_CHECKS);
    if (!targets.length) {
      setNotice({ type: "info", message: "현재 화면에 자동 확인할 상품별 파트너스 링크가 없습니다." });
      return;
    }

    setBulkVerificationRunning(true);
    setNotice({ type: "info", message: `현재 화면의 파트너스 링크 ${targets.length}건을 순차 확인 중입니다.` });
    let matchedCount = 0;
    let mismatchCount = 0;
    let manualCount = 0;
    try {
      for (const product of targets) {
        const verification = await verifyAffiliateUrl(product, "verify", inputs[product.id]);
        if (verification.ok) matchedCount += 1;
        else if (verification.identity_status === "MISMATCH") mismatchCount += 1;
        else manualCount += 1;
      }
      await loadProducts();
      setNotice({
        type: mismatchCount ? "info" : "success",
        message: `자동 확인 ${targets.length}건 완료 · 상품 일치 ${matchedCount}건 · 불일치 ${mismatchCount}건 · 수동 확인 필요 ${manualCount}건`
      });
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 일괄 링크 확인을 끝내지 못했습니다. 남은 링크를 다시 실행하세요." });
    } finally {
      setBulkVerificationRunning(false);
    }
  }

  async function publishVerifiedVisibleLinks() {
    if (!verifiedVisibleProducts.length) {
      setNotice({ type: "info", message: "상품번호 일치 확인이 끝난 링크가 현재 화면에 없습니다." });
      return;
    }

    const entries = verifiedVisibleProducts
      .map((product) => `${product.id}\t${inputs[product.id]?.trim() ?? ""}`)
      .join("\n");
    setBulkImportRunning(true);
    setBulkImportResult(null);
    setNotice({ type: "info", message: `상품번호 확인이 끝난 링크 ${verifiedVisibleProducts.length}건을 품질 게이트와 함께 게시하는 중입니다.` });
    try {
      const response = await fetch("/api/admin/affiliate-links/import", {
        method: "POST",
        headers: headers(password),
        body: JSON.stringify({ entries, dryRun: false, publish: true })
      });
      const data = (await response.json().catch(() => ({}))) as BulkImportResponse;
      if (!response.ok) {
        setNotice({ type: "error", message: data.message ?? data.error ?? "확인된 링크 일괄 게시에 실패했습니다." });
        return;
      }
      setBulkImportResult(data);
      setNotice({ type: bulkImportNoticeType(data), message: bulkImportMessage(data) });
      await loadProducts();
      onCompleted();
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 확인된 링크 일괄 게시를 실행하지 못했습니다." });
    } finally {
      setBulkImportRunning(false);
    }
  }

  function buildBulkTemplate(products: ProductWithScore[]) {
    return products
      .slice(0, MAX_BULK_TEMPLATE_LINES)
      .map((product) => `${product.id}\t${product.title}\t${buildCoupangSearchUrl(product)}`)
      .join("\n");
  }

  async function copyBulkTemplate(scope: "page" | "all") {
    const sourceProducts = scope === "all" ? missingProducts : visibleProducts;
    const template = buildBulkTemplate(sourceProducts);
    if (!template) {
      setNotice({ type: "info", message: "현재 복사할 링크 보강 대상이 없습니다." });
      return;
    }
    setBulkText(template);
    try {
      await navigator.clipboard.writeText(template);
      const copiedCount = template.split(/\r?\n/g).length;
      const truncated = sourceProducts.length > copiedCount ? ` · 전체 ${sourceProducts.length}개 중 ${copiedCount}개` : "";
      setNotice({ type: "success", message: `대량 입력 템플릿 ${copiedCount}개를 복사했습니다${truncated}. 각 줄의 상품 ID 옆에 상품별 파트너스 링크를 붙여넣으세요.` });
    } catch {
      setNotice({ type: "info", message: "브라우저가 클립보드 복사를 막아 템플릿을 입력창에만 채웠습니다." });
    }
  }

  async function fillBackfillFailuresTemplate() {
    const template = buildBackfillManualTemplate(backfillResult);
    if (!template) {
      setNotice({ type: "info", message: "대량 입력으로 넘길 자동 보강 실패 항목이 없습니다." });
      return;
    }
    setBulkText(template);
    try {
      await navigator.clipboard.writeText(template);
      setNotice({ type: "success", message: "자동 보강 실패 항목을 대량 입력 템플릿으로 옮겼습니다. 각 줄의 빈칸에 상품별 파트너스 링크를 붙여넣으세요." });
    } catch {
      setNotice({ type: "info", message: "자동 보강 실패 항목을 대량 입력창에 채웠습니다. 각 줄의 빈칸에 상품별 파트너스 링크를 붙여넣으세요." });
    }
  }

  async function runBulkImport(mode: "dry_run" | "save") {
    if (!bulkText.trim()) {
      setNotice({ type: "error", message: "상품 ID와 쿠팡 파트너스 링크가 들어간 줄을 붙여넣어 주세요." });
      return;
    }
    setBulkImportRunning(true);
    setBulkImportResult(null);
    setNotice({ type: "info", message: mode === "dry_run" ? "상품별 파트너스 링크를 저장 전 검증 중입니다." : "상품별 파트너스 링크를 대량 저장 중입니다." });
    try {
      const response = await fetch("/api/admin/affiliate-links/import", {
        method: "POST",
        headers: headers(password),
        body: JSON.stringify({ entries: bulkText, dryRun: mode === "dry_run", publish: mode === "save" && bulkPublish })
      });
      const data = (await response.json().catch(() => ({}))) as BulkImportResponse;
      if (!response.ok) {
        setNotice({ type: "error", message: data.message ?? data.error ?? "대량 링크 입력에 실패했습니다." });
        return;
      }
      setBulkImportResult(data);
      setNotice({ type: bulkImportNoticeType(data), message: bulkImportMessage(data) });
      if (mode === "save") {
        await loadProducts();
        onCompleted();
      }
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 대량 링크 입력을 실행하지 못했습니다." });
    } finally {
      setBulkImportRunning(false);
    }
  }

  async function saveAffiliateUrl(product: ProductWithScore, mode: SaveMode) {
    const affiliateUrl = inputs[product.id]?.trim() ?? "";
    if (!isUsableAffiliateUrl(affiliateUrl)) {
      setNotice({ type: "error", message: "상품별 쿠팡 파트너스 링크를 입력하세요. 예: https://link.coupang.com/a/..." });
      return;
    }
    if (isApprovalSampleAffiliateUrl(affiliateUrl)) {
      setNotice({ type: "error", message: "승인용 샘플 링크는 심사용 페이지 전용입니다. 이 상품의 상품별 파트너스 링크를 새로 입력하세요." });
      return;
    }
    setSavingId(product.id);
    setNotice({
      type: "info",
      message: mode === "publish" ? "파트너스 링크를 저장하고 게시 상태를 확인하는 중입니다." : "파트너스 링크를 저장하고 목적지를 확인하는 중입니다."
    });
    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: headers(password),
        body: JSON.stringify(mode === "publish" ? { affiliate_url: affiliateUrl, action: "publish" } : { affiliate_url: affiliateUrl })
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
        setNotice({ type: "error", message: data.message ?? data.error ?? "파트너스 링크 저장에 실패했습니다." });
        return;
      }
      const verification = mode === "save" ? await verifyAffiliateUrl(product, "verify", affiliateUrl) : null;
      await loadProducts();
      if (mode === "publish") {
        setNotice({ type: "success", message: "파트너스 링크를 저장하고 게시했습니다." });
      } else if (verification?.ok) {
        setNotice({ type: "success", message: "파트너스 링크 저장과 목적지 확인을 완료했습니다." });
      } else {
        setNotice({ type: "info", message: "링크는 저장했지만 목적지 확인이 추가로 필요합니다. 아래 결과를 확인한 뒤 수동 확인을 진행하세요." });
      }
      onCompleted();
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 파트너스 링크를 저장하지 못했습니다." });
    } finally {
      setSavingId(null);
    }
  }

  async function runApiBackfill() {
    setBackfillRunning(true);
    setBackfillResult(null);
    setNotice({ type: "info", message: "쿠팡 API로 상품별 파트너스 링크를 보강 중입니다." });
    try {
      const response = await fetch("/api/admin/affiliate-links/backfill", {
        method: "POST",
        headers: headers(password),
        body: JSON.stringify({ limit: 24 })
      });
      const data = (await response.json().catch(() => ({}))) as BackfillResponse;
      if (!response.ok) {
        setNotice({ type: "error", message: data.message ?? data.error ?? "API 기반 파트너스 링크 보강에 실패했습니다." });
        return;
      }
      setBackfillResult(data);
      setNotice({
        type: data.status === "ok" ? "success" : "error",
        message: backfillMessage(data)
      });
      await loadProducts();
      onCompleted();
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 API 기반 파트너스 링크 보강을 실행하지 못했습니다." });
    } finally {
      setBackfillRunning(false);
    }
  }

  async function promoteDiscoveryProduct(product: ProductWithScore) {
    if (hasPublicProductMarker(product)) {
      setNotice({ type: "error", message: "공개 표식이 있는 상품은 수동 검수 전환을 시작하지 않습니다." });
      return;
    }
    if (!isManualPromotionSource(product.source) || !getAffiliateIdentityReadiness(product).ready) {
      setNotice({ type: "error", message: "알구몬·HotDeals 후보의 상품번호 일치 확인을 먼저 완료하세요." });
      return;
    }
    if (!window.confirm("이 발견 후보를 수동 검수 후보로 전환합니다. 원본 출처를 보존하며 공개 게시하지 않습니다. 계속할까요?")) return;

    const latestProduct = products.find((candidate) => candidate.id === product.id) ?? product;
    if (hasPublicProductMarker(latestProduct)) {
      setNotice({ type: "error", message: "상품 상태가 공개로 바뀌어 수동 검수 전환을 중단했습니다." });
      return;
    }

    setManualPromotingId(product.id);
    setNotice({ type: "info", message: "발견 후보를 수동 검수 대기 상태로 전환하는 중입니다. 공개 게시하지 않습니다." });
    try {
      const response = await fetch(`/api/admin/products/${product.id}/manual-promote`, {
        method: "POST",
        headers: headers(password),
        body: JSON.stringify({ manual_review_confirmed: true })
      });
      const data = (await response.json().catch(() => ({}))) as ManualPromotionResponse;
      if (!response.ok) {
        if (data.error === "MANUAL_PROMOTION_PUBLIC_CONFLICT") {
          setProducts((current) => current.filter((item) => item.id !== product.id));
        }
        setNotice({ type: "error", message: data.message ?? data.error ?? "수동 검수 전환에 실패했습니다." });
        return;
      }
      await loadProducts();
      onCompleted();
      setNotice({ type: "success", message: "수동 검수 후보로 전환했습니다. 현재 상품은 공개 게시되지 않았습니다." });
    } catch {
      setNotice({ type: "error", message: "네트워크 문제로 수동 검수 전환을 완료하지 못했습니다." });
    } finally {
      setManualPromotingId(null);
    }
  }

  const backfillManualItemCount = backfillManualItems(backfillResult).length;

  return (
    <section id="admin-affiliate-links" className="scroll-mt-4 rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-pine">파트너스 링크 보강</p>
          <h2 className="text-xl font-black">상품별 파트너스 링크 보강</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-steel">
            승인 대기 중에는 쿠팡 파트너스 웹에서 상품별 링크를 직접 만들고 여기에 붙여넣습니다. 링크를 저장하고 후보 상품과의 일치 확인을 마친 상품만 공개 딜과 구매 CTA에 노출됩니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-pine px-3 py-2 text-sm font-black text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
            onClick={runApiBackfill}
            disabled={backfillRunning}
            type="button"
          >
            <Wand2 size={15} aria-hidden /> API로 24개 자동 보강
          </button>
          <button
            className="focus-ring inline-flex items-center gap-2 rounded-lg border border-pine/30 bg-pine/5 px-3 py-2 text-sm font-black text-pine hover:bg-pine/10 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={verifyVisibleAffiliateLinks}
            disabled={bulkVerificationRunning || checkingLinkId !== null || !pendingVerificationVisibleProducts.length}
            type="button"
          >
            <ShieldCheck className={bulkVerificationRunning ? "animate-pulse" : ""} size={15} aria-hidden />
            {bulkVerificationRunning
              ? "링크 확인 중"
              : `미확인 링크 ${Math.min(MAX_BULK_LINK_CHECKS, pendingVerificationVisibleProducts.length)}건 확인`}
          </button>
          <button
            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-pine px-3 py-2 text-sm font-black text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void publishVerifiedVisibleLinks()}
            disabled={bulkImportRunning || bulkVerificationRunning || checkingLinkId !== null || !verifiedVisibleProducts.length}
            title="상품번호 일치 확인이 끝난 링크만 품질 게이트를 거쳐 게시합니다."
            type="button"
          >
            <Upload size={15} aria-hidden /> {bulkImportRunning ? "일괄 게시 중" : `확인된 링크 ${verifiedVisibleProducts.length}건 게시`}
          </button>
          <button className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-black hover:bg-mist disabled:opacity-60" onClick={loadProducts} disabled={loading} type="button">
            <RefreshCw size={15} aria-hidden /> {loading ? "불러오는 중" : "새로고침"}
          </button>
        </div>
      </div>

      {notice ? (
        <p className={`mt-4 rounded-lg border px-3 py-2 text-sm font-bold ${noticeClassName(notice.type)}`} role="status" aria-live="polite">
          {notice.message}
        </p>
      ) : null}

      {manualPromotionProducts.length ? (
        <div className="mt-4 rounded-lg border border-pine/30 bg-pine/5 p-4">
          <p className="text-sm font-black text-pine">발견 후보 수동 검수 전환</p>
          <p className="mt-1 max-w-3xl text-xs font-bold leading-5 text-steel">
            상품번호 일치 확인이 끝난 Algumon/HotDeals 후보만 표시합니다. 버튼을 누르면 원본 출처를 보존한 수동 검수 후보로 바꾸며, 이 작업만으로는 공개 게시하지 않습니다.
          </p>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {manualPromotionProducts.slice(0, 12).map((product) => (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-white px-3 py-2" key={product.id}>
                <div className="min-w-0">
                  <p className="truncate text-xs font-black text-ink">{product.title}</p>
                  <p className="mt-1 text-[11px] font-bold text-steel">{product.source} · 상품번호 일치 확인 완료</p>
                </div>
                <button
                  className="focus-ring inline-flex shrink-0 items-center justify-center rounded-lg border border-pine/40 px-3 py-2 text-xs font-black text-pine hover:bg-pine/10 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={manualPromotingId !== null || bulkImportRunning || bulkVerificationRunning}
                  onClick={() => void promoteDiscoveryProduct(product)}
                  title="원본 출처를 보존하고 수동 검수로 전환합니다. 공개 게시하지 않습니다."
                  type="button"
                >
                  {manualPromotingId === product.id ? "전환 중" : "수동 검수로 전환 · 미게시"}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {backfillResult ? (
        <div className="mt-4 rounded-lg border border-line bg-mist p-4 text-sm font-bold text-steel">
          <p className="font-black text-ink">
            API 자동 보강 결과: <span className={linkResultStatusClassName(backfillResult.status)}>{linkResultStatusLabel(backfillResult.status)}</span> · 확인 {backfillResult.scanned_count}개 · 저장 {backfillResult.updated_count}개 · 건너뜀{" "}
            {backfillResult.skipped_count}개 · 오류 {backfillResult.error_count}개
          </p>
          {backfillResult.status === "API_NOT_CONFIGURED" ? (
            <p className="mt-2 text-coral">쿠팡 파트너스 API 키가 아직 없어 자동 보강은 대기 상태입니다. 최종승인 후 API 키를 넣고 다시 실행하세요.</p>
          ) : null}
          {backfillManualItemCount ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs font-black text-ink hover:bg-mist"
                onClick={fillBackfillFailuresTemplate}
                type="button"
              >
                <Copy size={13} aria-hidden /> 실패 {backfillManualItemCount}개 대량 입력으로 보내기
              </button>
              <span className="text-xs font-bold text-steel">검색 URL은 참고용입니다. 쿠팡 파트너스에서 만든 상품별 링크로 바꿔 붙여넣으세요.</span>
            </div>
          ) : null}
          {backfillResult.items?.slice(0, 3).length ? (
            <ul className="mt-2 space-y-1 text-xs">
              {backfillResult.items.slice(0, 3).map((item) => {
                const resultLinks = backfillResultLinks(item);
                const matchSummary = backfillMatchSummary(item);
                return (
                  <li key={`${item.product_id}-${item.status}`}>
                    <span className={`font-black ${linkResultStatusClassName(item.status)}`}>{linkResultStatusLabel(item.status)}</span>:{" "}
                    {item.matched_title ?? item.title}
                    {item.query ? <span className="text-steel"> · 검색어 {item.query}</span> : null}
                    {matchSummary ? <span className="text-steel"> · {matchSummary}</span> : null}
                    {linkResultReasonLabel(item.reason) ? <span className="text-coral"> · {linkResultReasonLabel(item.reason)}</span> : null}
                    {resultLinks.length ? (
                      <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                        {resultLinks.map((link) => (
                          <a
                            className="focus-ring inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-1 font-black text-ink hover:bg-mist"
                            href={link.href}
                            key={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink size={12} aria-hidden /> {link.label}
                          </a>
                        ))}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 rounded-lg border border-line bg-mist p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-black">대량 링크 입력</h3>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-steel">
              각 줄에 내부 상품 ID, 쿠팡 상품번호 또는 쿠팡 상품 상세 URL 중 하나와 상품별 파트너스 링크를 붙여넣으세요. 제목은 참고용이며, 같은 쿠팡 상품번호가 여러 후보에 있으면 저장하지 않습니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-black hover:bg-mist disabled:opacity-60"
              onClick={() => void copyBulkTemplate("page")}
              disabled={!visibleProducts.length}
              type="button"
              title="현재 페이지 템플릿 복사"
            >
              <Copy size={15} aria-hidden /> 현재 24개 템플릿
            </button>
            <button
              className="focus-ring inline-flex items-center gap-2 rounded-lg border border-pine/30 bg-pine/5 px-3 py-2 text-sm font-black text-pine hover:bg-pine/10 disabled:opacity-60"
              onClick={() => void copyBulkTemplate("all")}
              disabled={!missingProducts.length}
              type="button"
              title="대기 중인 상품을 최대 80줄까지 복사합니다."
            >
              <Copy size={15} aria-hidden /> 전체 대기 템플릿
            </button>
          </div>
        </div>
        <textarea
          className="focus-ring mt-3 min-h-28 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
          value={bulkText}
          onChange={(event) => setBulkText(event.target.value)}
          placeholder={`상품ID\thttps://link.coupang.com/a/상품별링크\n예: 33f28f30-79f6-425e-ac6b-275bc330d620\thttps://link.coupang.com/a/...\n또는: 1234567890\thttps://link.coupang.com/a/...`}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-2 text-xs font-bold text-steel">
            <p>승인용 샘플 링크와 일반 쿠팡 상품 URL은 저장하지 않습니다. 한 번에 최대 80줄까지 처리하며, 전체 템플릿도 최대 80개까지 복사합니다.</p>
            <label className="inline-flex items-center gap-2">
              <input checked={bulkPublish} onChange={(event) => setBulkPublish(event.target.checked)} type="checkbox" />
              저장한 상품을 바로 게시 상태로 전환
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-black hover:bg-mist disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => runBulkImport("dry_run")}
              disabled={bulkImportRunning || !bulkText.trim()}
              type="button"
            >
              {bulkImportRunning ? "확인 중" : "검증만"}
            </button>
            <button
              className="focus-ring inline-flex items-center gap-2 rounded-lg bg-pine px-4 py-2 text-sm font-black text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => runBulkImport("save")}
              disabled={bulkImportRunning || !bulkText.trim()}
              type="button"
            >
              <Upload size={15} aria-hidden /> {bulkImportRunning ? "저장 중" : bulkPublish ? "대량 저장 후 게시" : "대량 저장"}
            </button>
          </div>
        </div>
        {bulkImportResult ? (
          <div className="mt-3 rounded-lg border border-line bg-white p-3 text-sm font-bold text-steel">
            <p className="font-black text-ink">
              대량 입력 결과: <span className={linkResultStatusClassName(bulkImportResult.status)}>{linkResultStatusLabel(bulkImportResult.status)}</span> · 확인 {bulkImportResult.scanned_count}줄
              {bulkImportResult.dry_run ? ` · 저장 가능 ${bulkImportResult.valid_count ?? 0}개` : ""} · 저장 {bulkImportResult.updated_count}개
              {bulkImportResult.publish_requested ? ` · 게시 ${bulkImportResult.published_count ?? 0}개` : ""}
              {bulkImportResult.identity_pending_count ? ` · 목적지 확인 필요 ${bulkImportResult.identity_pending_count}개` : ""}
              {bulkImportResult.publish_blocked_count ? ` · 품질 확인 필요 ${bulkImportResult.publish_blocked_count}개` : ""} · 건너뜀 {bulkImportResult.skipped_count}개 · 오류 {bulkImportResult.error_count}개
            </p>
            {bulkImportResult.publish_requested && bulkImportResult.identity_pending_count ? (
              <p className="mt-2 font-black text-coral">저장된 링크는 각 상품 행에서 링크 확인을 실행한 뒤에만 게시할 수 있습니다.</p>
            ) : null}
            {bulkImportResult.items?.slice(0, 4).length ? (
              <ul className="mt-2 space-y-1 text-xs">
                {bulkImportResult.items.slice(0, 4).map((item, index) => (
                  <li key={`${item.product_id}-${index}`}>
                    <span className={`font-black ${linkResultStatusClassName(item.status)}`}>{linkResultStatusLabel(item.status)}</span>:{" "}
                    {item.title ?? item.product_id}
                    {linkResultReasonLabel(item.reason) ? <span className="text-coral"> · {linkResultReasonLabel(item.reason)}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-mist p-4">
          <p className="text-xs font-black text-steel">보강·일치 확인 필요</p>
          <p className="mt-1 text-2xl font-black">{missingProducts.length.toLocaleString("ko-KR")}개</p>
        </div>
        <div className="rounded-lg border border-line bg-mist p-4">
          <p className="text-xs font-black text-steel">공개 숨김 상태</p>
          <p className="mt-1 text-2xl font-black">{hiddenPublishedCount.toLocaleString("ko-KR")}개</p>
        </div>
        <div className="rounded-lg border border-line bg-mist p-4">
          <p className="text-xs font-black text-steel">공개 가능</p>
          <p className="mt-1 text-2xl font-black">{publicReadyCount.toLocaleString("ko-KR")}개</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 lg:grid-cols-[1fr_auto]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-steel" size={16} aria-hidden />
          <input
            className="focus-ring w-full rounded-lg border border-line py-2 pl-9 pr-3 text-sm"
            value={query}
             onChange={(event) => {
               setQuery(event.target.value);
               setQueuePage(0);
             }}
            placeholder="상품명으로 보강 대상 검색"
          />
        </label>
        <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-bold text-steel">
           <input
             checked={publishedOnly}
             onChange={(event) => {
               setPublishedOnly(event.target.checked);
               setQueuePage(0);
             }}
             type="checkbox"
           />
          기존 게시 상품 먼저
        </label>
      </div>

      {missingProducts.length > LINK_QUEUE_PAGE_SIZE ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-mist px-3 py-2 text-xs font-bold text-steel">
          <span>
            링크 보강 대상 {missingProducts.length.toLocaleString("ko-KR")}개 · 현재 {currentQueuePage + 1}/{totalQueuePages}페이지
          </span>
          <div className="flex items-center gap-2">
            <button
              className="focus-ring rounded-md border border-line bg-white px-3 py-1.5 font-black text-ink hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setQueuePage(Math.max(0, currentQueuePage - 1))}
              disabled={currentQueuePage === 0}
              type="button"
            >
              이전
            </button>
            <button
              className="focus-ring rounded-md border border-line bg-white px-3 py-1.5 font-black text-ink hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setQueuePage(Math.min(totalQueuePages - 1, currentQueuePage + 1))}
              disabled={currentQueuePage >= totalQueuePages - 1}
              type="button"
            >
              다음
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {visibleProducts.map((product) => {
          const inputValue = inputs[product.id] ?? "";
          const approvalSampleAffiliate = isApprovalSampleAffiliateUrl(inputValue);
          const linkReady = isUsableAffiliateUrl(inputValue) && !approvalSampleAffiliate;
          const verification = linkVerifications[product.id]?.checked_url === inputValue.trim() ? linkVerifications[product.id] : null;
          const identityReady = verification?.identity_status === "MATCH" || verification?.identity_status === "MANUAL_CONFIRMED";
          const identityMismatch = verification?.identity_status === "MISMATCH";
          const manualConfirmationAvailable = verification?.identity_status === "UNRESOLVED" || verification?.identity_status === "EXPECTED_ID_UNAVAILABLE";
          const searchUrl = buildCoupangSearchUrl(product);
          const naverPrice = getNaverPriceTrust(product);
          return (
            <article
              id={`admin-affiliate-product-${product.id}`}
              key={product.id}
              className="scroll-mt-4 rounded-lg border border-line p-4"
            >
              <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-black">
                    <span className="rounded-md bg-mist px-2 py-1 text-steel">{getCategoryLabel(product.category)}</span>
                    <span className="rounded-md bg-lemon/30 px-2 py-1 text-ink">{product.sourcing_status}</span>
                    <span className="rounded-md bg-pine/10 px-2 py-1 text-pine">{product.latest_score?.total_score ?? 0}점</span>
                  </div>
                  <h3 className="mt-2 line-clamp-2 text-sm font-black">{product.title}</h3>
                  <p className="mt-1 text-xs font-bold text-steel">
                    판매가 {formatPrice(product.return_price ?? product.source_price ?? product.new_price)} · 네이버 {naverPrice.trustedPrice ? formatPrice(naverPrice.trustedPrice) : naverPrice.label} · 재고{" "}
                    {product.stock_count ?? "확인필요"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-black hover:bg-mist"
                      href={searchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink size={14} aria-hidden /> 쿠팡에서 상품 찾기
                    </a>
                    <button className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-black hover:bg-mist" onClick={() => copyTitle(product)} type="button">
                      <Copy size={14} aria-hidden /> {copiedId === product.id ? "복사됨" : "상품명 복사"}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-black text-steel">
                    상품별 파트너스 URL
                    <input
                      className="focus-ring mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink"
                      value={inputValue}
                      onChange={(event) => {
                        setInputs((current) => ({ ...current, [product.id]: event.target.value }));
                        setLinkVerifications((current) => {
                          const next = { ...current };
                          delete next[product.id];
                          return next;
                        });
                      }}
                      placeholder="https://link.coupang.com/a/..."
                    />
                  </label>
                  <p className={linkReady ? "mt-2 text-xs font-bold text-pine" : "mt-2 text-xs font-bold text-coral"}>
                    {linkReady
                      ? "링크 저장은 가능하며, 게시 전 자동 상품번호 확인 또는 명시적 수동 확인이 필요합니다."
                      : approvalSampleAffiliate
                        ? "승인용 샘플 링크는 이 상품에 저장하거나 게시할 수 없습니다."
                        : "쿠팡 파트너스에서 만든 상품별 링크를 붙여넣어 주세요."}
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <button
                      className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-black hover:bg-mist disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => verifyAffiliateUrl(product)}
                      disabled={!isCoupangPartnersLink(inputValue) || checkingLinkId !== null || bulkVerificationRunning}
                      type="button"
                    >
                      <RefreshCw className={checkingLinkId === product.id ? "animate-spin" : ""} size={14} aria-hidden />
                      {checkingLinkId === product.id ? "목적지 확인 중" : "자동 목적지 확인"}
                    </button>
                    {isCoupangPartnersLink(inputValue) ? (
                      <a
                        className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-black hover:bg-mist"
                        href={inputValue}
                        target="_blank"
                        rel="nofollow sponsored noopener noreferrer"
                      >
                        <ExternalLink size={14} aria-hidden /> 브라우저로 직접 열기
                      </a>
                    ) : (
                      <button
                        className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-black opacity-50"
                        disabled
                        type="button"
                      >
                        <ExternalLink size={14} aria-hidden /> 브라우저로 직접 열기
                      </button>
                    )}
                  </div>
                  {verification ? (
                    <div
                      className={
                        verification.ok
                          ? "mt-2 rounded-lg bg-pine/10 p-3 text-xs font-bold text-pine"
                          : verification.code === "INVALID_AFFILIATE_URL" || verification.code === "REDIRECT_BLOCKED" || identityMismatch
                            ? "mt-2 rounded-lg bg-red-50 p-3 text-xs font-bold text-red-700"
                            : "mt-2 rounded-lg bg-lemon/30 p-3 text-xs font-bold text-ink"
                      }
                      role="status"
                      aria-live="polite"
                    >
                      <p>{verification.message}</p>
                      {verification.product_id || verification.expected_product_id ? (
                        <p className="mt-1">
                          후보 상품번호 {verification.expected_product_id ?? "확인필요"} · 링크 상품번호 {verification.product_id ?? "확인필요"} · HTTP{" "}
                          {verification.http_status ?? "확인필요"} · 이동 {verification.redirect_count}회
                        </p>
                      ) : null}
                      <p className="mt-1 font-semibold">
                        {identityReady
                          ? "현재 링크는 게시 품질 게이트를 통과했습니다."
                          : identityMismatch
                            ? "다른 상품으로 연결되어 현재 링크의 저장·게시를 차단합니다."
                            : "자동 해석이 부족합니다. 브라우저에서 상품명과 옵션을 확인한 뒤 수동 확인을 완료하세요."}
                      </p>
                      {manualConfirmationAvailable ? (
                        <button
                          className="focus-ring mt-2 inline-flex items-center justify-center rounded-lg border border-current px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => verifyAffiliateUrl(product, "manual_confirm")}
                          disabled={checkingLinkId !== null || bulkVerificationRunning}
                          type="button"
                        >
                          브라우저 확인 완료
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <button
                      className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-black hover:bg-mist disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => saveAffiliateUrl(product, "save")}
                      disabled={!linkReady || identityMismatch || savingId === product.id || bulkVerificationRunning}
                      type="button"
                    >
                      <Link2 size={14} aria-hidden /> 링크 저장
                    </button>
                    <button
                      className="focus-ring rounded-lg bg-pine px-3 py-2 text-xs font-black text-white hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => saveAffiliateUrl(product, "publish")}
                      disabled={!linkReady || !identityReady || savingId === product.id || bulkVerificationRunning}
                      title={identityReady ? "검수된 현재 링크를 저장하고 게시합니다." : "게시 전 상품번호 일치 확인이 필요합니다."}
                      type="button"
                    >
                      저장 후 게시
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
        {!visibleProducts.length ? (
          <div className="rounded-lg border border-line bg-mist p-6 text-center text-sm font-bold text-steel">현재 조건에 맞는 링크 보강 대상이 없습니다.</div>
        ) : null}
      </div>
    </section>
  );
}
