type CoupangLinkProduct = {
  title: string;
  brand?: string | null;
  model_name?: string | null;
  affiliate_url?: string | null;
  coupang_url?: string | null;
  source_url?: string | null;
};

export type CoupangOutboundLink = {
  href: string;
  label: string;
  isAffiliate: boolean;
  status: "affiliate" | "source" | "search";
  helperText: string;
};

const genericPartnerShortLinks = new Set(["dpyguokdsm"]);
const partnerShortPathPattern = /^\/a\/([A-Za-z0-9]{6,16})$/;
const suspiciousPartnerCodePattern = /(test|sample|example|fake|dummy|dryrun|safecheck|nonexisting|readiness)/i;

export function cleanCoupangSearchQuery(product: Pick<CoupangLinkProduct, "title" | "brand" | "model_name">) {
  let raw = product.title;
  if (product.model_name && !raw.toLowerCase().includes(product.model_name.toLowerCase())) {
    raw = `${product.model_name} ${raw}`;
  }
  if (product.brand && !raw.toLowerCase().includes(product.brand.toLowerCase())) {
    raw = `${product.brand} ${raw}`;
  }
  return raw
    .replace(/반품\s*[-–]?\s*(미개봉|최상|상|중|확인필요|알수없음)?/gi, " ")
    .replace(/\b(return|returned|renewed|refurbished|open\s*box)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
}

export function buildCoupangSearchUrl(product: Pick<CoupangLinkProduct, "title" | "brand" | "model_name">) {
  const query = cleanCoupangSearchQuery(product) || product.title;
  const params = new URLSearchParams({ q: query, channel: "user" });
  return `https://www.coupang.com/np/search?${params.toString()}`;
}

function parseUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function isCoupangUrl(value: string | null | undefined) {
  const url = parseUrl(value);
  if (!url) return false;
  return url.hostname === "coupang.com" || url.hostname.endsWith(".coupang.com");
}

export function isGenericCoupangLandingUrl(value: string | null | undefined) {
  const url = parseUrl(value);
  if (!url) return false;

  const path = url.pathname.toLowerCase();
  if (url.hostname === "link.coupang.com") {
    const shortCode = path.split("/").filter(Boolean).pop()?.toLowerCase();
    return Boolean(shortCode && genericPartnerShortLinks.has(shortCode));
  }

  if (!isCoupangUrl(value)) return false;
  if (path.includes("/np/goldbox")) return true;
  if (url.hostname === "pages.coupang.com" && path === "/p/121237") return true;
  return false;
}

export function isUsableCoupangProductUrl(value: string | null | undefined) {
  const url = parseUrl(value);
  if (!url || !isCoupangUrl(value)) return false;
  if (isGenericCoupangLandingUrl(value)) return false;
  return url.pathname.includes("/vp/products/");
}

function isUsableCoupangSearchUrl(value: string | null | undefined) {
  const url = parseUrl(value);
  if (!url || !isCoupangUrl(value)) return false;
  if (isGenericCoupangLandingUrl(value)) return false;
  return url.pathname.includes("/np/search") && Boolean(url.searchParams.get("q"));
}

export function isUsableAffiliateUrl(value: string | null | undefined) {
  return isCoupangPartnersLink(value) && !isApprovalSampleAffiliateUrl(value);
}

export function isCoupangPartnersLink(value: string | null | undefined) {
  return getCoupangPartnersLinkIssue(value) === null;
}

export function getCoupangPartnersLinkIssue(value: string | null | undefined) {
  const url = parseUrl(value);
  if (!url) return "INVALID_URL";
  if (url.protocol !== "https:") return "PARTNERS_LINK_MUST_USE_HTTPS";
  if (url.username || url.password) return "PARTNERS_LINK_CREDENTIALS_NOT_ALLOWED";
  if (url.port) return "PARTNERS_LINK_DEFAULT_PORT_REQUIRED";
  if (url.hostname !== "link.coupang.com") return "PARTNERS_LINK_HOST_REQUIRED";
  if (isGenericCoupangLandingUrl(value)) return "GENERIC_PARTNERS_LINK_NOT_ALLOWED";

  const match = url.pathname.match(partnerShortPathPattern);
  if (!match) return "PARTNERS_SHORT_LINK_PATH_REQUIRED";
  if (suspiciousPartnerCodePattern.test(match[1])) return "SUSPICIOUS_PARTNERS_SHORT_CODE";
  return null;
}

export function isApprovalSampleAffiliateUrl(value: string | null | undefined) {
  const url = parseUrl(value);
  const approvalUrl = parseUrl(process.env.NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL);
  if (!url || !approvalUrl) return false;
  return url.protocol === approvalUrl.protocol && url.hostname === approvalUrl.hostname && url.pathname === approvalUrl.pathname;
}

export function getCoupangOutboundLink(product: CoupangLinkProduct): CoupangOutboundLink {
  if (isUsableAffiliateUrl(product.affiliate_url)) {
    return {
      href: product.affiliate_url!,
      label: "쿠팡에서 가격 확인",
      isAffiliate: true,
      status: "affiliate",
      helperText: "상품별 쿠팡 파트너스 링크로 이동합니다."
    };
  }

  const sourceUrl = [product.coupang_url, product.source_url].find((url) => isUsableCoupangProductUrl(url));
  if (sourceUrl) {
    return {
      href: sourceUrl,
      label: "쿠팡 상품 보기",
      isAffiliate: false,
      status: "source",
      helperText: "상품별 파트너스 링크 보강 전이라 일반 쿠팡 상품 페이지로 이동합니다."
    };
  }

  const searchUrl = [product.coupang_url, product.source_url].find((url) => isUsableCoupangSearchUrl(url));
  if (searchUrl) {
    return {
      href: searchUrl,
      label: "쿠팡에서 상품 검색",
      isAffiliate: false,
      status: "search",
      helperText: "상품별 파트너스 링크 보강 전이라 상품명 기반 쿠팡 검색 결과로 이동합니다."
    };
  }

  return {
    href: buildCoupangSearchUrl(product),
    label: "쿠팡에서 상품 검색",
    isAffiliate: false,
    status: "search",
    helperText: "상품별 파트너스 링크 보강 전이라 상품명 기반 쿠팡 검색 결과로 이동합니다."
  };
}
