#!/usr/bin/env node

import { blankEnvSources, envValue, loadEnvFiles } from "./load-env-files.mjs";

const args = process.argv.slice(2);
const requireLaunchReady = args.includes("--launch");
const strictScheduler = args.includes("--strict-scheduler");
loadEnvFiles();

function argValue(name) {
  const index = args.indexOf(name);
  if (index === -1) return "";
  return args[index + 1] ?? "";
}

function normalizeBaseUrl(value) {
  const raw = String(value ?? "").trim().replace(/\/+$/, "");
  if (!raw) return "";

  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

const siteUrl =
  normalizeBaseUrl(argValue("--site")) ||
  normalizeBaseUrl(envValue(["RETURNPICK_SITE_URL", "NEXT_PUBLIC_SITE_URL"])) ||
  "https://returnpick.vercel.app";
const adminPassword = argValue("--admin-password") || envValue(["RETURNPICK_ADMIN_PASSWORD", "ADMIN_PASSWORD"]);
const expectedApprovalUrl = envValue("NEXT_PUBLIC_COUPANG_APPROVAL_PRODUCT_URL");

const approvalRequirements = {
  cta: "\uCFE0\uD321\uC5D0\uC11C \uAC00\uACA9 \uD655\uC778",
  disclosure: "\uCFE0\uD321 \uD30C\uD2B8\uB108\uC2A4 \uD65C\uB3D9\uC758 \uC77C\uD658",
  disclosureLink: "/disclosure",
  rel: "nofollow sponsored noopener noreferrer"
};

const disclosureRequirements = {
  title: "\uC81C\uD734 \uC548\uB0B4",
  partnersDisclosure: "\uCFE0\uD321 \uD30C\uD2B8\uB108\uC2A4 \uD65C\uB3D9\uC758 \uC77C\uD658",
  commission: "\uC218\uC218\uB8CC\uB97C \uC81C\uACF5\uBC1B\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4",
  priceStock: "\uAC00\uACA9, \uC7AC\uACE0, \uBC18\uD488\uB4F1\uAE09",
  finalCheck: "\uCD5C\uC885 \uAD6C\uB9E4 \uC804"
};

const editorialPickRequirements = {
  title: "Novatech S1 창문 로봇청소기 구매 전 체크",
  purchaseCta: "쿠팡에서 가격 확인",
  disclosure: "쿠팡 파트너스 활동의 일환",
  share: "추천 링크 공유",
  copy: "링크 복사",
  socialImage: "/picks/novatech-s1-window-cleaner/opengraph-image"
};
const editorialSocialImagePath = "/picks/novatech-s1-window-cleaner/opengraph-image";
const guideEditorialRequirements = {
  path: "/picks/novatech-s1-window-cleaner",
  title: "Novatech S1 구매 전 체크 보기",
  disclosure: "쿠팡 파트너스 제휴 링크가 포함되어 있습니다"
};

const sitemapRequiredPaths = [
  "/",
  "/deals",
  "/disclosure",
  "/picks/novatech-s1-window-cleaner",
  "/guide/return-checklist",
  "/guide/safe-categories"
];

const adminUiRequiredText = [
  "상품별 링크 보강",
  "상품 이미지 URL",
  "저장 후 게시",
  "품질 보강 대기",
  "유입 채널별 전환",
  "링크 보강 큐로 이동",
  "품질 보강 후보로 이동",
  "/api/admin/session",
  "/api/admin/editorial-campaign",
  "returnpick_admin_password"
];
const editorialCardBundleRequiredText = [
  "returnpick_impressed_editorial_surfaces",
  "web_editorial_card_home",
  "web_editorial_card_deals"
];
const maxAdminScriptChunksToScan = 25;
const maxAdminScriptChunkCharacters = 1_500_000;

const results = [];

function addResult(status, name, detail) {
  results.push({ status, name, detail });
}

function fail(name, detail) {
  addResult("FAIL", name, detail);
}

function warn(name, detail) {
  addResult("WARN", name, detail);
}

function pass(name, detail) {
  addResult("PASS", name, detail);
}

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function readText(path, init = {}) {
  const response = await fetchWithTimeout(`${siteUrl}${path}`, init);
  const text = await response.text();
  return { response, text };
}

async function readBytes(path, init = {}) {
  const response = await fetchWithTimeout(`${siteUrl}${path}`, init);
  const bytes = await response.arrayBuffer();
  return { response, byteLength: bytes.byteLength };
}

async function readUrlText(url, init = {}) {
  const response = await fetchWithTimeout(url, init);
  const text = await response.text();
  return { response, text };
}

async function readJson(path, init = {}) {
  const { response, text } = await readText(path, init);
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw_text: text.slice(0, 500) };
  }

  return { response, json };
}

function adminHeaders() {
  return {
    "content-type": "application/json",
    "x-admin-password": adminPassword
  };
}

function checkApprovalPage(html, status) {
  if (status !== 200) {
    fail("approval page", `/products/approval-sample returned ${status}`);
    return;
  }

  const exactOrAnyPartnersUrl = expectedApprovalUrl
    ? html.includes(expectedApprovalUrl)
    : /https:\/\/link\.coupang\.com\/a\/[A-Za-z0-9]{6,16}/.test(html);
  const missing = Object.entries(approvalRequirements)
    .filter(([, value]) => !html.includes(value))
    .map(([key]) => key);

  if (!exactOrAnyPartnersUrl) missing.push("partners_url");

  if (missing.length) {
    fail("approval page", `missing required approval evidence: ${missing.join(", ")}`);
  } else {
    pass("approval page", "CTA, disclosure, disclosure link, partners URL, and sponsored rel are present");
  }
}

function containsLikelyMojibake(value) {
  return /�|諛|荑|鍮|媛|援|留|湲|由|異|寃|쨌|\?뺤|\?좎|\?곹/.test(String(value ?? ""));
}

function checkDisclosurePage(html, status) {
  if (status !== 200) {
    fail("disclosure page", `/disclosure returned ${status}`);
    return;
  }

  const missing = Object.entries(disclosureRequirements)
    .filter(([, value]) => !html.includes(value))
    .map(([key]) => key);

  if (containsLikelyMojibake(html)) missing.push("readable_korean");

  if (missing.length) {
    fail("disclosure page", `missing required disclosure evidence: ${missing.join(", ")}`);
  } else {
    pass("disclosure page", "affiliate disclosure, commission notice, and price/stock caveat are present");
  }
}

function checkEditorialPickPage(html, status) {
  if (status !== 200) {
    fail("editorial pick", `/picks/novatech-s1-window-cleaner returned ${status}`);
    return;
  }

  const missing = Object.entries(editorialPickRequirements)
    .filter(([, value]) => !html.includes(value))
    .map(([key]) => key);

  if (containsLikelyMojibake(html)) missing.push("readable_korean");

  if (missing.length) {
    fail("editorial pick", `missing first-sale funnel evidence: ${missing.join(", ")}`);
  } else {
    pass("editorial pick", "purchase CTA, disclosure, and attributed detail sharing are present");
  }
}

function checkEditorialSocialImage(response, byteLength) {
  const contentType = response.headers.get("content-type") ?? "";
  if (response.status !== 200 || !contentType.startsWith("image/") || byteLength < 10_000) {
    fail("editorial social image", `status=${response.status}, content-type=${contentType || "missing"}, bytes=${byteLength}`);
    return;
  }

  pass("editorial social image", `product-specific preview is ${contentType} and ${byteLength} bytes`);
}

function checkGuideEditorialHandoff(name, path, html, status) {
  if (status !== 200) {
    fail(name, `${path} returned ${status}`);
    return;
  }

  const missing = Object.entries(guideEditorialRequirements)
    .filter(([, value]) => !html.includes(value))
    .map(([key]) => key);

  if (containsLikelyMojibake(html)) missing.push("readable_korean");

  if (missing.length) {
    fail(name, `missing disclosed editorial handoff: ${missing.join(", ")}`);
  } else {
    pass(name, "guide links to the disclosed editorial review before the affiliate destination");
  }
}

function checkRobotsTxt(text, status) {
  if (status !== 200) {
    fail("robots.txt", `/robots.txt returned ${status}`);
    return;
  }

  const lower = text.toLowerCase();
  const missing = [];
  if (!lower.includes("user-agent: *")) missing.push("user_agent");
  if (!lower.includes("allow: /")) missing.push("allow_root");
  if (!lower.includes("disallow: /admin")) missing.push("disallow_admin");
  if (!lower.includes("disallow: /api")) missing.push("disallow_api");
  if (!text.includes(`${siteUrl}/sitemap.xml`)) missing.push("sitemap_url");

  if (missing.length) {
    fail("robots.txt", `missing crawl policy evidence: ${missing.join(", ")}`);
  } else {
    pass("robots.txt", "public crawl policy allows the site, protects admin/api, and points to sitemap.xml");
  }
}

function checkSitemapXml(xml, status) {
  if (status !== 200) {
    fail("sitemap.xml", `/sitemap.xml returned ${status}`);
    return;
  }

  const missing = sitemapRequiredPaths.filter((path) => !xml.includes(`${siteUrl}${path}`));

  if (missing.length) {
    fail("sitemap.xml", `missing public routes: ${missing.join(", ")}`);
  } else {
    pass("sitemap.xml", "core public, editorial, disclosure, and guide routes are listed");
  }
}

function headerValue(headers, name) {
  return String(headers?.get?.(name) ?? "").trim();
}

function checkPublicSecurityHeaders(response) {
  const missing = [];
  if (headerValue(response.headers, "referrer-policy") !== "strict-origin-when-cross-origin") missing.push("referrer_policy");
  if (headerValue(response.headers, "x-content-type-options").toLowerCase() !== "nosniff") missing.push("content_type_options");
  if (headerValue(response.headers, "x-frame-options").toUpperCase() !== "DENY") missing.push("frame_options");

  const permissions = headerValue(response.headers, "permissions-policy").toLowerCase();
  for (const directive of ["camera=()", "microphone=()", "geolocation=()", "payment=()"]) {
    if (!permissions.includes(directive)) missing.push(`permissions_${directive.replace(/[=()]/g, "")}`);
  }

  if (missing.length) {
    fail("public security headers", `missing or invalid headers: ${missing.join(", ")}`);
  } else {
    pass("public security headers", "referrer, content-type, frame, and permissions policy headers are present");
  }
}

function checkPrivateRouteHeaders(name, response) {
  const robots = headerValue(response.headers, "x-robots-tag").toLowerCase();
  const cache = headerValue(response.headers, "cache-control").toLowerCase();
  const missing = [];
  for (const token of ["noindex", "nofollow", "noarchive"]) {
    if (!robots.includes(token)) missing.push(`robots_${token}`);
  }
  if (!cache.includes("no-store")) missing.push("cache_no_store");

  if (missing.length) {
    fail(name, `missing private-route headers: ${missing.join(", ")}`);
  } else {
    pass(name, "noindex/nofollow/noarchive and no-store headers are present");
  }
}

function checkAdminLaunchApiProtection(response, json) {
  const status = response.status;
  const errorText = String(json?.error ?? json?.code ?? json?.message ?? json?.raw_text ?? "").trim();
  const upperErrorText = errorText.toUpperCase();
  const expectedAdminBlocks = [
    "UNAUTHORIZED",
    "ADMIN_PASSWORD_NOT_CONFIGURED",
    "ADMIN_PASSWORD_WEAK_CONFIGURATION"
  ];
  const hasExpectedAdminBlock = expectedAdminBlocks.some((code) => upperErrorText.includes(code));

  if (status === 404 || status === 405) {
    fail("launch api protection", `/api/admin/launch returned ${status}; first-launch route may be missing`);
  } else if (status < 400) {
    fail("launch api protection", `/api/admin/launch accepted an unauthenticated POST with ${status}`);
  } else if (!hasExpectedAdminBlock) {
    fail(
      "launch api protection",
      `/api/admin/launch returned ${status}, but not an expected admin auth/config block: ${errorText || "empty body"}`
    );
  } else {
    pass("launch api protection", `unauthenticated first-launch POST is blocked with ${status} (${errorText})`);
  }
}

function checkAdminSessionProtection(response, json) {
  const errorText = String(json?.error ?? json?.code ?? json?.message ?? json?.raw_text ?? "").trim();
  const expectedBlocks = ["UNAUTHORIZED", "ADMIN_PASSWORD_NOT_CONFIGURED", "ADMIN_PASSWORD_WEAK_CONFIGURATION"];
  if (response.status === 404 || response.status === 405) {
    fail("admin session protection", `/api/admin/session returned ${response.status}; session route may be missing`);
  } else if (response.status < 400) {
    fail("admin session protection", `/api/admin/session exposed an authenticated session without credentials (${response.status})`);
  } else if (!expectedBlocks.some((code) => errorText.toUpperCase().includes(code))) {
    fail("admin session protection", `/api/admin/session returned ${response.status} with an unexpected auth response: ${errorText || "empty body"}`);
  } else {
    pass("admin session protection", `unauthenticated session probe is blocked with ${response.status} (${errorText})`);
  }
}

function staticScriptSourcesFromHtml(html) {
  return [
    ...new Set(
      Array.from(String(html ?? "").matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi))
        .map((match) => match[1].replaceAll("&amp;", "&"))
        .filter((src) => src.includes("/_next/static/") && src.includes(".js"))
    )
  ];
}

async function checkAdminUiBundle(html, status) {
  if (status !== 200) {
    fail("admin ui bundle", `/admin returned ${status}`);
    return;
  }

  const scriptSources = staticScriptSourcesFromHtml(html);
  if (!scriptSources.length) {
    fail("admin ui bundle", "no Next.js static script chunks found on /admin");
    return;
  }

  const missing = new Set(adminUiRequiredText);
  let scanned = 0;
  let fetched = 0;

  for (const source of scriptSources.slice(0, maxAdminScriptChunksToScan)) {
    scanned += 1;
    let scriptUrl = "";

    try {
      scriptUrl = new URL(source, siteUrl).toString();
      const script = await readUrlText(scriptUrl);
      if (!script.response.ok) continue;
      fetched += 1;
      const text = script.text.slice(0, maxAdminScriptChunkCharacters);
      for (const requiredText of [...missing]) {
        if (text.includes(requiredText)) missing.delete(requiredText);
      }
      if (!missing.size) break;
    } catch {
      // A single stale or transient chunk should not hide a clearer missing-text result.
    }
  }

  if (missing.size) {
    fail(
      "admin ui bundle",
      `missing deployed admin repair text: ${[...missing].join(", ")}; fetched ${fetched}/${scanned} chunks`
    );
  } else {
    pass("admin ui bundle", `deployed admin repair cards are present in JS chunks; fetched ${fetched}/${scanned} chunks`);
  }
}

async function checkEditorialCardTrackingBundle(pages) {
  const unavailable = pages.find((page) => page.status !== 200);
  if (unavailable) {
    fail("editorial card tracking bundle", `${unavailable.path} returned ${unavailable.status}`);
    return;
  }

  const scriptSources = [...new Set(pages.flatMap((page) => staticScriptSourcesFromHtml(page.html)))];
  if (!scriptSources.length) {
    fail("editorial card tracking bundle", "no Next.js static script chunks found on public card pages");
    return;
  }

  const missing = new Set(editorialCardBundleRequiredText);
  let scanned = 0;
  let fetched = 0;
  for (const source of scriptSources.slice(0, maxAdminScriptChunksToScan)) {
    scanned += 1;
    try {
      const script = await readUrlText(new URL(source, siteUrl).toString());
      if (!script.response.ok) continue;
      fetched += 1;
      const text = script.text.slice(0, maxAdminScriptChunkCharacters);
      for (const requiredText of [...missing]) {
        if (text.includes(requiredText)) missing.delete(requiredText);
      }
      if (!missing.size) break;
    } catch {
      // Continue scanning other chunks so one stale asset does not hide the deployed contract.
    }
  }

  if (missing.size) {
    fail("editorial card tracking bundle", `missing deployed tracking text: ${[...missing].join(", ")}; fetched ${fetched}/${scanned} chunks`);
  } else {
    pass("editorial card tracking bundle", `home/deals card impressions are present in deployed client chunks; fetched ${fetched}/${scanned} chunks`);
  }
}

function summarizeReadiness(readiness) {
  if (!readiness || typeof readiness !== "object") return "readiness payload missing";
  const blocking = Array.isArray(readiness.blockingItemIds) ? readiness.blockingItemIds.join(", ") : "";
  return `mode=${readiness.mode ?? "unknown"}, launchReady=${Boolean(readiness.launchReady)}, blocking=${blocking || "none"}`;
}

function checkReadiness(readiness) {
  if (!readiness || typeof readiness !== "object") {
    fail("admin readiness", "readiness payload missing");
    return;
  }

  if (requireLaunchReady) {
    if (readiness.launchReady) {
      pass("admin readiness", summarizeReadiness(readiness));
    } else {
      fail("admin readiness", summarizeReadiness(readiness));
    }
    return;
  }

  if (readiness.mode === "launch_ready") {
    pass("admin readiness", summarizeReadiness(readiness));
  } else {
    warn("admin readiness", summarizeReadiness(readiness));
  }
}

function checkConnectionCards(readiness, checks) {
  if (!Array.isArray(checks)) {
    fail("connection checks", "checks payload missing");
    return;
  }

  const failed = checks.filter((check) => check?.status === "error");
  const requiredIds = Array.isArray(readiness?.requiredConnectionCheckIds) ? readiness.requiredConnectionCheckIds : [];
  const returnedIds = new Set(checks.map((check) => check?.id).filter(Boolean));
  const missingRequired = requiredIds.filter((id) => !returnedIds.has(id));

  if (requireLaunchReady && missingRequired.length) {
    fail("connection checks", `required cards missing: ${missingRequired.join(", ")}`);
  } else if (missingRequired.length) {
    warn("connection checks", `required cards missing: ${missingRequired.join(", ")}`);
  }

  if (requireLaunchReady && failed.length) {
    fail("connection checks", `failed cards: ${failed.map((check) => check.id || check.label).join(", ")}`);
  } else if (failed.length) {
    warn("connection checks", `failed cards: ${failed.map((check) => check.id || check.label).join(", ")}`);
  } else if (!missingRequired.length) {
    pass("connection checks", `${checks.length} cards returned, no error cards`);
  }
}

function checkSchedulerHealth(json) {
  const sourcing = json?.insights?.sourcing;
  if (!sourcing || typeof sourcing !== "object") {
    fail("scheduler health", "sourcing insight payload missing");
    return;
  }

  const reason = sourcing.automation_block_reason || "none";
  const interval = sourcing.expected_interval_minutes ?? "unknown";
  const target = sourcing.operator_action?.target_anchor || "none";

  if (reason === "LAUNCH_NOT_READY") {
    if (requireLaunchReady || strictScheduler) fail("scheduler health", `blocked=${reason}, target=${target}`);
    else warn("scheduler health", `blocked=${reason}, target=${target}, interval=${interval}`);
    return;
  }

  if (reason === "FIRST_LAUNCH_NOT_CONFIRMED") {
    if (strictScheduler) fail("scheduler health", `blocked=${reason}, target=${target}`);
    else warn("scheduler health", `API checks can be ready, but first launch must still be confirmed: target=${target}`);
    return;
  }

  pass("scheduler health", `blocked=${reason}, interval=${interval}`);
}

function adminPasswordMissingDetail() {
  const blankSources = blankEnvSources(["RETURNPICK_ADMIN_PASSWORD", "ADMIN_PASSWORD"]);
  const sourceDetail = blankSources.length
    ? `ADMIN password is blank in ${blankSources.join(", ")}.`
    : "Set RETURNPICK_ADMIN_PASSWORD or ADMIN_PASSWORD. The script also reads .env.production, .env.local, and .env.";
  return `${sourceDetail} Admin API live checks are skipped in report mode and required in launch mode.`;
}

async function main() {
  console.log("ReturnPick production readiness check");
  console.log(`site: ${siteUrl}`);
  console.log(`mode: ${requireLaunchReady ? "launch" : "report"}${strictScheduler ? " + strict scheduler" : ""}`);
  console.log("=".repeat(44));

  if (!adminPassword) {
    const detail = adminPasswordMissingDetail();
    if (requireLaunchReady) fail("admin password", detail);
    else warn("admin password", detail);
  } else {
    pass("admin password", "provided by CLI, environment, or local env file");
  }

  try {
    const approval = await readText("/products/approval-sample");
    checkApprovalPage(approval.text, approval.response.status);
  } catch (error) {
    fail("approval page", error instanceof Error ? error.message : "fetch failed");
  }

  try {
    const disclosure = await readText("/disclosure");
    checkDisclosurePage(disclosure.text, disclosure.response.status);
  } catch (error) {
    fail("disclosure page", error instanceof Error ? error.message : "fetch failed");
  }

  try {
    const editorialPick = await readText("/picks/novatech-s1-window-cleaner");
    checkEditorialPickPage(editorialPick.text, editorialPick.response.status);
  } catch (error) {
    fail("editorial pick", error instanceof Error ? error.message : "fetch failed");
  }

  try {
    const editorialSocialImage = await readBytes(editorialSocialImagePath);
    checkEditorialSocialImage(editorialSocialImage.response, editorialSocialImage.byteLength);
  } catch (error) {
    fail("editorial social image", error instanceof Error ? error.message : "fetch failed");
  }

  try {
    const returnChecklistGuide = await readText("/guide/return-checklist");
    checkGuideEditorialHandoff("return checklist handoff", "/guide/return-checklist", returnChecklistGuide.text, returnChecklistGuide.response.status);
  } catch (error) {
    fail("return checklist handoff", error instanceof Error ? error.message : "fetch failed");
  }

  try {
    const safeCategoriesGuide = await readText("/guide/safe-categories");
    checkGuideEditorialHandoff("safe categories handoff", "/guide/safe-categories", safeCategoriesGuide.text, safeCategoriesGuide.response.status);
  } catch (error) {
    fail("safe categories handoff", error instanceof Error ? error.message : "fetch failed");
  }

  try {
    const robots = await readText("/robots.txt");
    checkRobotsTxt(robots.text, robots.response.status);
  } catch (error) {
    fail("robots.txt", error instanceof Error ? error.message : "fetch failed");
  }

  try {
    const sitemap = await readText("/sitemap.xml");
    checkSitemapXml(sitemap.text, sitemap.response.status);
  } catch (error) {
    fail("sitemap.xml", error instanceof Error ? error.message : "fetch failed");
  }

  try {
    const home = await readText("/");
    checkPublicSecurityHeaders(home.response);
  } catch (error) {
    fail("public security headers", error instanceof Error ? error.message : "fetch failed");
  }

  try {
    const [home, deals] = await Promise.all([readText("/"), readText("/deals")]);
    await checkEditorialCardTrackingBundle([
      { path: "/", html: home.text, status: home.response.status },
      { path: "/deals", html: deals.text, status: deals.response.status }
    ]);
  } catch (error) {
    fail("editorial card tracking bundle", error instanceof Error ? error.message : "fetch failed");
  }

  try {
    const admin = await readText("/admin");
    checkPrivateRouteHeaders("admin route headers", admin.response);
    await checkAdminUiBundle(admin.text, admin.response.status);
  } catch (error) {
    fail("admin route headers", error instanceof Error ? error.message : "fetch failed");
    fail("admin ui bundle", error instanceof Error ? error.message : "fetch failed");
  }

  try {
    const api = await readText("/api/admin/api-readiness");
    checkPrivateRouteHeaders("admin api headers", api.response);
  } catch (error) {
    fail("admin api headers", error instanceof Error ? error.message : "fetch failed");
  }

  try {
    const sessionApi = await readJson("/api/admin/session");
    checkPrivateRouteHeaders("admin session api headers", sessionApi.response);
    checkAdminSessionProtection(sessionApi.response, sessionApi.json);
  } catch (error) {
    fail("admin session api headers", error instanceof Error ? error.message : "GET failed");
    fail("admin session protection", error instanceof Error ? error.message : "GET failed");
  }

  try {
    const launchApi = await readJson("/api/admin/launch", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ preset: "quick", confirm: false })
    });
    checkPrivateRouteHeaders("admin launch api headers", launchApi.response);
    checkAdminLaunchApiProtection(launchApi.response, launchApi.json);
  } catch (error) {
    fail("admin launch api headers", error instanceof Error ? error.message : "fetch failed");
    fail("launch api protection", error instanceof Error ? error.message : "POST failed");
  }

  let readiness = null;

  if (adminPassword) {
    try {
      const readinessResponse = await readJson("/api/admin/api-readiness", {
        headers: adminHeaders()
      });

      if (!readinessResponse.response.ok) {
        fail("admin readiness", `GET returned ${readinessResponse.response.status}`);
      } else {
        readiness = readinessResponse.json?.readiness;
        checkReadiness(readiness);
      }
    } catch (error) {
      fail("admin readiness", error instanceof Error ? error.message : "GET failed");
    }

    try {
      const liveChecks = await readJson("/api/admin/api-readiness", {
        method: "POST",
        headers: adminHeaders()
      });

      if (!liveChecks.response.ok) {
        fail("connection checks", `POST returned ${liveChecks.response.status}`);
      } else {
        readiness = liveChecks.json?.readiness ?? readiness;
        checkConnectionCards(readiness, liveChecks.json?.checks);
      }
    } catch (error) {
      fail("connection checks", error instanceof Error ? error.message : "POST failed");
    }

    try {
      const scheduler = await readJson("/api/admin/scheduler-health", {
        headers: adminHeaders()
      });

      if (!scheduler.response.ok) {
        fail("scheduler health", `GET returned ${scheduler.response.status}`);
      } else {
        checkSchedulerHealth(scheduler.json);
      }
    } catch (error) {
      fail("scheduler health", error instanceof Error ? error.message : "GET failed");
    }
  }

  for (const item of results) {
    console.log(`${item.status} ${item.name} - ${item.detail}`);
  }

  const failed = results.filter((item) => item.status === "FAIL");
  const warnings = results.filter((item) => item.status === "WARN");
  console.log("=".repeat(44));
  console.log(`summary: ${results.length - failed.length - warnings.length} pass, ${warnings.length} warn, ${failed.length} fail`);

  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
